import { createHash } from "node:crypto";

import * as request from "supertest";

import { NotificationGatewayService } from "../src/notifications/notification-gateway.service";
import {
  cleanDatabase,
  closeE2eApp,
  configureE2eEnvironment,
  createE2eApp,
  login,
  provisionAcademicBaseline,
  seedUsers,
  TENANT_ID,
  type AcademicBaseline,
  type E2eAppContext
} from "./support/e2e-harness";

configureE2eEnvironment();
jest.setTimeout(120_000);

describe("Provider integrations (e2e)", () => {
  let context: E2eAppContext;
  let baseline: AcademicBaseline;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  const paydunyaHash = createHash("sha512").update("test-master-key").digest("hex");

  beforeAll(async () => {
    process.env.PAYMENT_PROVIDER = "paydunya";
    process.env.PAYDUNYA_MODE = "sandbox";
    process.env.PAYDUNYA_MASTER_KEY = "test-master-key";
    process.env.PAYDUNYA_PRIVATE_KEY = "test-private-key";
    process.env.PAYDUNYA_TOKEN = "test-token";
    process.env.PAYDUNYA_CALLBACK_URL = "https://api.example.test/api/v1/payments/paydunya/callback";
    process.env.PAYDUNYA_RETURN_URL = "https://app.example.test";
    process.env.PAYDUNYA_CANCEL_URL = "https://app.example.test";
    process.env.FILE_STORAGE_DRIVER = "SUPABASE";
    process.env.SUPABASE_URL = "https://project-ref.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    process.env.NOTIFICATIONS_EMAIL_PROVIDER = "brevo";
    process.env.NOTIFICATIONS_SMS_PROVIDER = "brevo";
    process.env.BREVO_API_KEY = "test-brevo-key";
    process.env.BREVO_SENDER_EMAIL = "no-reply@example.test";
    process.env.BREVO_SENDER_NAME = "GestSchool";
    process.env.BREVO_SMS_SENDER = "GestSchool";
    process.env.BREVO_SMS_DRY_RUN = "true";
    process.env.ALLOW_REAL_SMS = "false";
    process.env.MONITORING_METRICS_TOKEN = "test-metrics-token";
    process.env.STORAGE_PROVIDER = "supabase";

    fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" || input instanceof URL ? input.toString() : input.url;
      if (url.includes("/checkout-invoice/create")) {
        return jsonResponse({
          response_code: "00",
          response_text: "https://app.paydunya.com/sandbox-checkout/invoice/test-provider-token",
          description: "Checkout Invoice Created",
          token: "test-provider-token"
        });
      }
      if (url.includes("/checkout-invoice/confirm/test-provider-token")) {
        return jsonResponse({
          response_code: "00",
          response_text: "Transaction Found",
          status: "completed",
          hash: paydunyaHash,
          receipt_url: "https://app.paydunya.com/sandbox-checkout/receipt/pdf/test-provider-token.pdf",
          invoice: {
            token: "test-provider-token",
            total_amount: 150000
          }
        });
      }
      if (url.includes("/storage/v1/object/upload/sign/")) {
        return jsonResponse({
          signedURL: "/storage/v1/object/upload/sign/gestschool-documents/signed-path?token=signed-upload-token",
          token: "signed-upload-token"
        });
      }
      if (url.includes("/v3/smtp/email")) {
        return jsonResponse({ messageId: "<brevo-message-id>" });
      }
      return jsonResponse({ message: "Unexpected provider URL" }, 500);
    });

    context = await createE2eApp();
    await cleanDatabase(context.prisma);
    await seedUsers(context.prisma);

    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");
    const scolariteTokens = await login(context.app, "scolarite@gestschool.local", "scolarite123");
    baseline = await provisionAcademicBaseline(
      context.app,
      adminTokens.accessToken,
      scolariteTokens.accessToken
    );
  });

  afterAll(async () => {
    fetchSpy.mockRestore();
    delete process.env.PAYMENT_PROVIDER;
    delete process.env.PAYDUNYA_MODE;
    delete process.env.PAYDUNYA_MASTER_KEY;
    delete process.env.PAYDUNYA_PRIVATE_KEY;
    delete process.env.PAYDUNYA_TOKEN;
    delete process.env.PAYDUNYA_CALLBACK_URL;
    delete process.env.PAYDUNYA_RETURN_URL;
    delete process.env.PAYDUNYA_CANCEL_URL;
    delete process.env.FILE_STORAGE_DRIVER;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NOTIFICATIONS_EMAIL_PROVIDER;
    delete process.env.NOTIFICATIONS_SMS_PROVIDER;
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_SENDER_EMAIL;
    delete process.env.BREVO_SENDER_NAME;
    delete process.env.BREVO_SMS_SENDER;
    delete process.env.BREVO_SMS_DRY_RUN;
    delete process.env.ALLOW_REAL_SMS;
    delete process.env.MONITORING_METRICS_TOKEN;
    delete process.env.STORAGE_PROVIDER;
    await closeE2eApp(context);
  });

  it("initiates PayDunya sandbox checkout and confirms payment only after provider confirmation", async () => {
    const comptableTokens = await login(context.app, "comptable@gestschool.local", "comptable123");

    const feePlan = await request(context.app.getHttpServer())
      .post("/api/v1/fee-plans")
      .set("Authorization", `Bearer ${comptableTokens.accessToken}`)
      .send({
        schoolYearId: baseline.schoolYearId,
        levelId: baseline.levelId,
        label: "Frais PayDunya sandbox",
        totalAmount: 150000,
        currency: "CFA"
      })
      .expect(201);

    const invoice = await request(context.app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${comptableTokens.accessToken}`)
      .send({
        studentId: baseline.studentOneId,
        schoolYearId: baseline.schoolYearId,
        feePlanId: feePlan.body.id,
        dueDate: "2026-12-10"
      })
      .expect(201);

    const initiation = await request(context.app.getHttpServer())
      .post("/api/v1/payments/paydunya/initiate")
      .set("Authorization", `Bearer ${comptableTokens.accessToken}`)
      .send({ invoiceId: invoice.body.id })
      .expect(201);

    expect(initiation.body.provider).toBe("PAYDUNYA");
    expect(initiation.body.providerStatus).toBe("PENDING");
    expect(initiation.body.checkoutUrl).toContain("sandbox-checkout/invoice/test-provider-token");
    expect(JSON.stringify(initiation.body)).not.toContain("test-master-key");
    expect(JSON.stringify(initiation.body)).not.toContain("test-private-key");

    const callbackBody = {
      data: {
        status: "completed",
        hash: paydunyaHash,
        invoice: {
          token: "test-provider-token",
          total_amount: 150000
        }
      }
    };

    const callback = await request(context.app.getHttpServer())
      .post("/api/v1/payments/paydunya/callback")
      .send(callbackBody)
      .expect(201);

    expect(callback.body.providerStatus).toBe("COMPLETED");
    expect(callback.body.paymentId).toBeDefined();

    const paymentsAfterFirstCallback = await context.prisma.payment.count({
      where: { tenantId: TENANT_ID, invoiceId: invoice.body.id, paymentMethod: "PAYDUNYA" }
    });
    expect(paymentsAfterFirstCallback).toBe(1);

    await request(context.app.getHttpServer())
      .post("/api/v1/payments/paydunya/callback")
      .send(callbackBody)
      .expect(201);

    const paymentsAfterDuplicateCallback = await context.prisma.payment.count({
      where: { tenantId: TENANT_ID, invoiceId: invoice.body.id, paymentMethod: "PAYDUNYA" }
    });
    expect(paymentsAfterDuplicateCallback).toBe(1);

    const paidInvoice = await context.prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.body.id }
    });
    expect(paidInvoice.status).toBe("PAID");
  });

  it("returns Supabase signed upload descriptors without exposing the service role key", async () => {
    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");

    const descriptor = await request(context.app.getHttpServer())
      .post("/api/v1/storage/upload-descriptor")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        fileName: "certificat-medical.pdf",
        mimeType: "application/pdf",
        bucket: "documents",
        studentId: baseline.studentOneId
      })
      .expect(201);

    expect(descriptor.body.driver).toBe("SUPABASE");
    expect(descriptor.body.bucket).toBe("gestschool-documents");
    expect(descriptor.body.key).toContain(`tenants/${TENANT_ID}/students/${baseline.studentOneId}`);
    expect(descriptor.body.uploadUrl).toContain("/storage/v1/object/upload/sign/");
    expect(JSON.stringify(descriptor.body)).not.toContain("test-service-role-key");
  });

  it("dispatches Brevo email through provider API and keeps SMS in dry-run by default", async () => {
    const gateway = context.app.get(NotificationGatewayService);

    const emailDispatch = await gateway.dispatch({
      notificationId: "notif-email-001",
      tenantId: TENANT_ID,
      channel: "EMAIL",
      title: "Compte cree",
      message: "Vos identifiants GestSchool sont disponibles.",
      targetAddress: "parent@example.test"
    });

    expect(emailDispatch.provider).toBe("BREVO_EMAIL");
    expect(emailDispatch.providerMessageId).toBe("<brevo-message-id>");

    const callsBeforeSms = fetchSpy.mock.calls.length;
    const smsDispatch = await gateway.dispatch({
      notificationId: "notif-sms-001",
      tenantId: TENANT_ID,
      channel: "SMS",
      title: "Paiement recu",
      message: "Paiement recu.",
      targetAddress: "+22370000000"
    });

    expect(smsDispatch.provider).toBe("BREVO_SMS_DRY_RUN");
    expect(fetchSpy.mock.calls.length).toBe(callsBeforeSms);
  });

  it("exposes provider configuration checks without returning secrets", async () => {
    const response = await request(context.app.getHttpServer())
      .get("/api/v1/monitoring/providers")
      .set("x-metrics-token", "test-metrics-token")
      .expect(200);

    expect(response.body.storage.enabled).toBe(true);
    expect(response.body.storage.required.SUPABASE_SERVICE_ROLE_KEY).toBe(true);
    expect(response.body.notifications.email.enabled).toBe(true);
    expect(response.body.notifications.sms.dryRun).toBe(true);
    expect(response.body.payments.enabled).toBe(true);
    expect(response.body.payments.mode).toBe("sandbox");
    expect(JSON.stringify(response.body)).not.toContain("test-service-role-key");
    expect(JSON.stringify(response.body)).not.toContain("test-brevo-key");
    expect(JSON.stringify(response.body)).not.toContain("test-master-key");
    expect(JSON.stringify(response.body)).not.toContain("test-private-key");
  });
});

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
