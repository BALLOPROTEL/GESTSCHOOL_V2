import { createHash } from "node:crypto";

import * as request from "supertest";
import * as sharp from "sharp";

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

const createSharp = sharp as unknown as (
  input: sharp.SharpOptions,
) => sharp.Sharp;

configureE2eEnvironment();
jest.setTimeout(120_000);

describe("Provider integrations (e2e)", () => {
  let context: E2eAppContext;
  let baseline: AcademicBaseline;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let avatarPng: Buffer;
  let failNextStorageUpload = false;
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
    process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS = "gestschool-documents";
    process.env.SUPABASE_STORAGE_BUCKET_AVATARS = "gestschool-avatars";
    process.env.SUPABASE_STORAGE_AVATARS_PUBLIC = "false";
    process.env.SUPABASE_STORAGE_SIGNED_URL_TTL_SECONDS = "300";
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

    avatarPng = await createSharp({
      create: { width: 32, height: 32, channels: 3, background: "#1264a3" }
    })
      .png()
      .toBuffer();

    fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
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
      if (url.includes("/storage/v1/object/gestschool-avatars/")) {
        if (init?.method === "POST" && failNextStorageUpload) {
          failNextStorageUpload = false;
          return jsonResponse({ message: "simulated storage failure" }, 503);
        }
        return jsonResponse({ Key: "avatar-object-key" });
      }
      if (url.includes("/storage/v1/object/sign/gestschool-avatars/")) {
        return jsonResponse({
          signedURL: "/storage/v1/object/sign/gestschool-avatars/avatar.png?token=short-lived"
        });
      }
      if (url.endsWith("/storage/v1/object/gestschool-avatars") && init?.method === "DELETE") {
        return jsonResponse({ message: "deleted" });
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
    delete process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS;
    delete process.env.SUPABASE_STORAGE_BUCKET_AVATARS;
    delete process.env.SUPABASE_STORAGE_AVATARS_PUBLIC;
    delete process.env.SUPABASE_STORAGE_SIGNED_URL_TTL_SECONDS;
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

    await request(context.app.getHttpServer())
      .post("/api/v1/payments/paydunya/callback")
      .send({
        data: {
          status: "completed",
          hash: "invalid-callback-hash",
          invoice: {
            token: "test-provider-token",
            total_amount: 150000
          }
        }
      })
      .expect(401);

    const paymentsAfterRejectedCallback = await context.prisma.payment.count({
      where: { tenantId: TENANT_ID, invoiceId: invoice.body.id, paymentMethod: "PAYDUNYA" }
    });
    expect(paymentsAfterRejectedCallback).toBe(0);

    const callbacks = await Promise.all([
      request(context.app.getHttpServer())
        .post("/api/v1/payments/paydunya/callback")
        .send(callbackBody),
      request(context.app.getHttpServer())
        .post("/api/v1/payments/paydunya/callback")
        .send(callbackBody)
    ]);

    expect(callbacks.map((response) => response.status)).toEqual([201, 201]);
    expect(
      callbacks.every((response) => response.body.providerStatus === "COMPLETED")
    ).toBe(true);
    expect(callbacks[0].body.paymentId).toBeDefined();
    expect(callbacks[1].body.paymentId).toBe(callbacks[0].body.paymentId);

    const paymentsAfterDuplicateCallback = await context.prisma.payment.count({
      where: { tenantId: TENANT_ID, invoiceId: invoice.body.id, paymentMethod: "PAYDUNYA" }
    });
    expect(paymentsAfterDuplicateCallback).toBe(1);

    const paidInvoice = await context.prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.body.id }
    });
    expect(paidInvoice.status).toBe("PAID");
  });

  it("does not expose the removed generic upload descriptor endpoint", async () => {
    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");

    await request(context.app.getHttpServer())
      .post("/api/v1/storage/upload-descriptor")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        fileName: "certificat-medical.pdf",
        mimeType: "application/pdf",
        bucket: "documents",
        studentId: baseline.studentOneId
      })
      .expect(404);
  });

  it("uploads, replaces and removes an authenticated user's validated avatar", async () => {
    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");

    const firstResponse = await request(context.app.getHttpServer())
      .post("/api/v1/users/me/avatar")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .attach("file", avatarPng, {
        filename: "avatar.png",
        contentType: "image/png"
      })
      .expect(201);

    expect(firstResponse.body.user.avatarUrl).toContain(
      "/storage/v1/object/sign/gestschool-avatars/"
    );
    expect(firstResponse.body.user.avatarUrl).toContain("token=short-lived");
    expect(JSON.stringify(firstResponse.body)).not.toContain("test-service-role-key");

    const firstPersisted = await context.prisma.user.findUniqueOrThrow({
      where: {
        tenantId_username: {
          tenantId: TENANT_ID,
          username: "admin@gestschool.local"
        }
      }
    });
    expect(firstPersisted.avatarStorageKey).toBeTruthy();

    const secondResponse = await request(context.app.getHttpServer())
      .post("/api/v1/users/me/avatar")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .attach("file", avatarPng, {
        filename: "avatar-remplacement.png",
        contentType: "image/png"
      })
      .expect(201);

    const persistedUser = await context.prisma.user.findUniqueOrThrow({
      where: {
        tenantId_username: {
          tenantId: TENANT_ID,
          username: "admin@gestschool.local"
        }
      }
    });
    expect(persistedUser.avatarUrl).toBeNull();
    expect(persistedUser.avatarStorageKey).not.toBe(firstPersisted.avatarStorageKey);

    const deleteCallsAfterReplacement = fetchSpy.mock.calls.filter(([input, init]) => {
      const url = typeof input === "string" || input instanceof URL ? input.toString() : input.url;
      return url.endsWith("/storage/v1/object/gestschool-avatars") && init?.method === "DELETE";
    });
    expect(deleteCallsAfterReplacement).toHaveLength(1);

    const profileResponse = await request(context.app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    expect(profileResponse.body.user.avatarUrl).toContain(
      "/storage/v1/object/sign/gestschool-avatars/"
    );

    await request(context.app.getHttpServer())
      .delete("/api/v1/users/me/avatar")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    const removed = await context.prisma.user.findUniqueOrThrow({ where: { id: persistedUser.id } });
    expect(removed.avatarUrl).toBeNull();
    expect(removed.avatarStorageKey).toBeNull();
  });

  it("does not mutate avatar metadata when the storage provider fails", async () => {
    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");
    const before = await context.prisma.user.findFirstOrThrow({
      where: { tenantId: TENANT_ID, username: "admin@gestschool.local" }
    });

    failNextStorageUpload = true;
    await request(context.app.getHttpServer())
      .post("/api/v1/users/me/avatar")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .attach("file", avatarPng, { filename: "provider-failure.png", contentType: "image/png" })
      .expect(503);

    const after = await context.prisma.user.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.avatarUrl).toBe(before.avatarUrl);
    expect(after.avatarStorageKey).toBe(before.avatarStorageKey);
  });

  it("rejects avatar uploads larger than the multipart limit", async () => {
    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");

    await request(context.app.getHttpServer())
      .post("/api/v1/users/me/avatar")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .attach("file", Buffer.alloc(2 * 1024 * 1024 + 1, 0x61), {
        filename: "avatar-too-large.png",
        contentType: "image/png"
      })
      .expect(413);
  });

  it("rejects multiple avatar files in one multipart request", async () => {
    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");

    await request(context.app.getHttpServer())
      .post("/api/v1/users/me/avatar")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .attach("file", avatarPng, {
        filename: "avatar-one.png",
        contentType: "image/png"
      })
      .attach("file", avatarPng, {
        filename: "avatar-two.png",
        contentType: "image/png"
      })
      .expect(400);
  });

  it("rejects avatar files with a forbidden declared MIME type", async () => {
    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");

    await request(context.app.getHttpServer())
      .post("/api/v1/users/me/avatar")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .attach("file", Buffer.from("not-an-image"), {
        filename: "avatar.txt",
        contentType: "text/plain"
      })
      .expect(400);
  });

  it("rejects malformed multipart avatar requests without returning a server error", async () => {
    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");

    const response = await request(context.app.getHttpServer())
      .post("/api/v1/users/me/avatar")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .set("Content-Type", "multipart/form-data; boundary=broken-boundary")
      .send("--broken-boundary\r\nContent-Disposition: form-data; name=\"file\"");

    expect(response.status).toBe(400);
  });

  it("dispatches Brevo email through provider API and keeps SMS in dry-run by default", async () => {
    const gateway = context.app.get(NotificationGatewayService);

    const emailDispatch = await gateway.dispatch({
      notificationId: "notif-email-001",
      tenantId: TENANT_ID,
      channel: "EMAIL",
      title: "Compte cree",
      message: "Vos identifiants GestSchool sont disponibles.",
      targetAddress: "parent@example.test",
      idempotencyKey: "provider-e2e:email:notif-email-001:v1",
      attemptNo: 1
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
      targetAddress: "+22370000000",
      idempotencyKey: "provider-e2e:sms:notif-sms-001:v1",
      attemptNo: 1
    });

    expect(smsDispatch.provider).toBe("BREVO_SMS_DRY_RUN");
    expect(fetchSpy.mock.calls.length).toBe(callsBeforeSms);
  });

  it("exposes provider configuration checks without returning secrets", async () => {
    await request(context.app.getHttpServer()).get("/api/v1/monitoring/providers").expect(403);

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

  it("rejects unsafe public monitoring and notification webhook secrets", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousMetricsToken = process.env.MONITORING_METRICS_TOKEN;

    process.env.NODE_ENV = "production";
    process.env.MONITORING_METRICS_TOKEN = "change-me";

    try {
      await request(context.app.getHttpServer())
        .get("/api/v1/monitoring/providers")
        .set("x-metrics-token", "change-me")
        .expect(403);
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousMetricsToken === undefined) {
        delete process.env.MONITORING_METRICS_TOKEN;
      } else {
        process.env.MONITORING_METRICS_TOKEN = previousMetricsToken;
      }
    }

    await request(context.app.getHttpServer())
      .post("/api/v1/notifications/delivery-events")
      .set("x-notification-webhook-secret", "invalid-webhook-secret")
      .send({
        tenantId: TENANT_ID,
        providerMessageId: "provider-message-unauthorized",
        provider: "WEBHOOK_EMAIL",
        status: "DELIVERED",
        occurredAt: "2026-09-12T08:01:00.000Z"
      })
      .expect(403);
  });
});

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
