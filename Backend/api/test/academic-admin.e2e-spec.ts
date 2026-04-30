import * as request from "supertest";

import {
  cleanDatabase,
  closeE2eApp,
  configureE2eEnvironment,
  createE2eApp,
  login,
  provisionAcademicBaseline,
  seedUsers,
  type AcademicBaseline,
  type E2eAppContext
} from "./support/e2e-harness";

configureE2eEnvironment();
jest.setTimeout(120_000);

describe("Academic administration core flows (e2e)", () => {
  let context: E2eAppContext;
  let baseline: AcademicBaseline;
  let feePlanId: string;
  let invoiceId: string;
  let paymentId: string;
  let reportCardId: string;

  beforeAll(async () => {
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
    await closeE2eApp(context);
  });

  it("should expose enrollments for the seeded academic baseline", async () => {
    const scolariteTokens = await login(context.app, "scolarite@gestschool.local", "scolarite123");

    const listed = await request(context.app.getHttpServer())
      .get("/api/v1/enrollments")
      .query({ classId: baseline.classId, schoolYearId: baseline.schoolYearId })
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .expect(200);

    expect(listed.body).toHaveLength(2);
  });

  it("should create fee plans, invoices and payments", async () => {
    const comptableTokens = await login(context.app, "comptable@gestschool.local", "comptable123");

    const feePlan = await request(context.app.getHttpServer())
      .post("/api/v1/fee-plans")
      .set("Authorization", `Bearer ${comptableTokens.accessToken}`)
      .send({
        schoolYearId: baseline.schoolYearId,
        levelId: baseline.levelId,
        label: "Frais CP1",
        totalAmount: 300000,
        currency: "CFA"
      })
      .expect(201);

    feePlanId = feePlan.body.id;

    const invoice = await request(context.app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${comptableTokens.accessToken}`)
      .send({
        studentId: baseline.studentOneId,
        schoolYearId: baseline.schoolYearId,
        feePlanId,
        dueDate: "2026-10-31"
      })
      .expect(201);

    invoiceId = invoice.body.id;
    expect(invoice.body.amountDue).toBe(300000);
    expect(invoice.body.status).toBe("OPEN");

    const payment = await request(context.app.getHttpServer())
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${comptableTokens.accessToken}`)
      .send({
        invoiceId,
        paidAmount: 120000,
        paymentMethod: "CASH"
      })
      .expect(201);

    paymentId = payment.body.id;
    expect(payment.body.receiptNo).toContain("RCP-");

    const invoices = await request(context.app.getHttpServer())
      .get("/api/v1/invoices")
      .query({ studentId: baseline.studentOneId, schoolYearId: baseline.schoolYearId })
      .set("Authorization", `Bearer ${comptableTokens.accessToken}`)
      .expect(200);

    expect(invoices.body).toHaveLength(1);
    expect(invoices.body[0].amountPaid).toBe(120000);
    expect(invoices.body[0].status).toBe("PARTIAL");

    const receipt = await request(context.app.getHttpServer())
      .get(`/api/v1/payments/${paymentId}/receipt`)
      .set("Authorization", `Bearer ${comptableTokens.accessToken}`)
      .expect(200);

    expect(receipt.body.pdfDataUrl).toContain("data:application/pdf;base64,");
  });

  it("should create grades in bulk and generate a report card", async () => {
    const scolariteTokens = await login(context.app, "scolarite@gestschool.local", "scolarite123");

    await request(context.app.getHttpServer())
      .post("/api/v1/grades")
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .send({
        studentId: baseline.studentOneId,
        classId: baseline.classId,
        subjectId: baseline.subjectId,
        academicPeriodId: baseline.academicPeriodId,
        assessmentLabel: "Devoir 1",
        assessmentType: "DEVOIR",
        score: 16,
        scoreMax: 20
      })
      .expect(201);

    const bulk = await request(context.app.getHttpServer())
      .post("/api/v1/grades/bulk")
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .send({
        classId: baseline.classId,
        subjectId: baseline.subjectId,
        academicPeriodId: baseline.academicPeriodId,
        assessmentLabel: "Composition",
        assessmentType: "COMPOSITION",
        scoreMax: 20,
        grades: [
          {
            studentId: baseline.studentOneId,
            score: 18
          },
          {
            studentId: baseline.studentTwoId,
            score: 12
          }
        ]
      })
      .expect(201);

    expect(bulk.body.upsertedCount).toBe(2);

    const summary = await request(context.app.getHttpServer())
      .get("/api/v1/grades/class-summary")
      .query({ classId: baseline.classId, academicPeriodId: baseline.academicPeriodId })
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .expect(200);

    expect(summary.body.students).toHaveLength(2);

    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");
    const report = await request(context.app.getHttpServer())
      .post("/api/v1/report-cards/generate")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        studentId: baseline.studentOneId,
        classId: baseline.classId,
        academicPeriodId: baseline.academicPeriodId,
        publish: true
      })
      .expect(201);

    reportCardId = report.body.id;
    expect(report.body.pdfDataUrl).toContain("data:application/pdf;base64,");

    const pdf = await request(context.app.getHttpServer())
      .get(`/api/v1/report-cards/${reportCardId}/pdf`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    expect(pdf.body.pdfDataUrl).toContain("data:application/pdf;base64,");
  });
});
