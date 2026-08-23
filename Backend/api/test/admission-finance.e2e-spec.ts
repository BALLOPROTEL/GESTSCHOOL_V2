import {
  AdmissionCaseMode,
  AdmissionCaseStatus,
  type AcademicTrack,
  Prisma,
} from "@prisma/client";
import * as request from "supertest";

import type { AdmissionDraftData } from "../src/admissions/admission-cases.types";
import {
  type AcademicBaseline,
  type E2eAppContext,
  TENANT_ID,
  cleanDatabase,
  closeE2eApp,
  configureE2eEnvironment,
  createE2eApp,
  login,
  provisionAcademicBaseline,
  seedUsers,
} from "./support/e2e-harness";

const OTHER_TENANT_ID = "90000000-0000-4000-8000-000000000001";

configureE2eEnvironment();

describe("Admission finance policy (e2e)", () => {
  let context: E2eAppContext;
  let adminToken: string;
  let scolariteToken: string;
  let adminUserId: string;
  let baseline: AcademicBaseline;
  let compatiblePlanId: string;
  let sequence = 0;

  beforeAll(async () => {
    context = await createE2eApp();
    await cleanDatabase(context.prisma);
    await seedUsers(context.prisma);
    adminToken = (
      await login(context.app, "admin@gestschool.local", "admin12345")
    ).accessToken;
    scolariteToken = (
      await login(context.app, "scolarite@gestschool.local", "scolarite123")
    ).accessToken;
    adminUserId = (
      await context.prisma.user.findFirstOrThrow({
        where: { tenantId: TENANT_ID, username: "admin@gestschool.local" },
        select: { id: true },
      })
    ).id;
    baseline = await provisionAcademicBaseline(
      context.app,
      adminToken,
      scolariteToken,
    );
    compatiblePlanId = (
      await context.prisma.feePlan.create({
        data: {
          tenantId: TENANT_ID,
          schoolYearId: baseline.schoolYearId,
          levelId: baseline.levelId,
          label: "I6 standard",
          totalAmount: new Prisma.Decimal(125000),
          currency: "CFA",
        },
      })
    ).id;
  }, 120_000);

  afterAll(async () => {
    if (context) await closeE2eApp(context);
  }, 120_000);

  const next = (prefix: string): string => `${prefix}-${++sequence}`;

  const academics = (override: Partial<AdmissionDraftData["ACADEMICS"]> = {}) => ({
    schoolYearId: baseline.schoolYearId,
    cycleId: baseline.cycleId,
    levelId: baseline.levelId,
    classId: baseline.classId,
    track: "FRANCOPHONE" as AcademicTrack,
    ...override,
  });

  const newAdmissionDraft = (
    finance?: AdmissionDraftData["FINANCE"],
  ): AdmissionDraftData => {
    const suffix = next("I6");
    return {
      STUDENT: {
        matriculeMode: "AUTO",
        firstName: `Finance${sequence}`,
        lastName: `Admission${sequence}`,
        sex: "F",
        birthDate: "2015-02-10",
      },
      GUARDIANS: {
        guardians: [
          {
            source: "NEW_GUARDIAN",
            parentalRole: "TUTEUR",
            firstName: `Guardian${suffix}`,
            lastName: `Family${suffix}`,
            primaryPhone: `+22372${String(sequence).padStart(6, "0")}`,
            relationType: "TUTEUR",
            isPrimaryContact: true,
            legalGuardian: true,
            financialResponsible: true,
          },
        ],
      },
      ACADEMICS: academics(),
      ...(finance ? { FINANCE: finance } : {}),
    };
  };

  const createReadyCase = async (input?: {
    mode?: AdmissionCaseMode;
    studentId?: string;
    draft?: AdmissionDraftData;
  }) =>
    context.prisma.admissionCase.create({
      data: {
        tenantId: TENANT_ID,
        mode: input?.mode ?? AdmissionCaseMode.NEW_ADMISSION,
        status: AdmissionCaseStatus.READY,
        studentId: input?.studentId,
        schoolYearId:
          input?.draft?.ACADEMICS?.schoolYearId ?? baseline.schoolYearId,
        draftData: (input?.draft ?? newAdmissionDraft()) as Prisma.InputJsonObject,
        createdByUserId: adminUserId,
        updatedByUserId: adminUserId,
      },
    });

  const finalize = (id: string, key: string, expectedVersion = 1) =>
    request(context.app.getHttpServer())
      .post(`/api/v1/admission-cases/${id}/finalize`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ expectedVersion, idempotencyKey: key });

  const businessCounts = async () => ({
    students: await context.prisma.student.count(),
    parents: await context.prisma.parent.count(),
    links: await context.prisma.parentStudentLink.count(),
    placements: await context.prisma.studentTrackPlacement.count(),
    enrollments: await context.prisma.enrollment.count(),
    invoices: await context.prisma.invoice.count(),
    payments: await context.prisma.payment.count(),
  });

  it("returns only compatible plans and honest SCOLARITE capabilities", async () => {
    const admissionCase = await createReadyCase({
      draft: newAdmissionDraft({
        mode: "FEE_PLAN",
        feePlanId: compatiblePlanId,
      }),
    });
    await context.prisma.feePlan.create({
      data: {
        tenantId: OTHER_TENANT_ID,
        schoolYearId: baseline.schoolYearId,
        levelId: baseline.levelId,
        label: "I6 hidden other tenant",
        totalAmount: new Prisma.Decimal(999999),
        currency: "CFA",
      },
    });

    const response = await request(context.app.getHttpServer())
      .get(
        `/api/v1/admission-cases/finance-options?admissionCaseId=${admissionCase.id}`,
      )
      .set("Authorization", `Bearer ${scolariteToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      contractVersion: "1",
      admissionCaseId: admissionCase.id,
      policy: "OPTIONAL",
      supportedModes: ["FEE_PLAN", "DEFERRED"],
      selectedIntent: {
        mode: "FEE_PLAN",
        feePlanId: compatiblePlanId,
      },
      capabilities: {
        canReadFeePlans: true,
        canSelectFeePlan: true,
        canDefer: true,
        canCreateInvoice: false,
        automaticInvoiceCreation: false,
      },
      blockingIssues: [],
    });
    expect(response.body.plans).toEqual([
      expect.objectContaining({
        id: compatiblePlanId,
        totalAmount: 125000,
        currency: "CFA",
      }),
    ]);
  });

  it("rejects incompatible and cross-tenant fee plans on PATCH", async () => {
    const secondLevel = await context.prisma.level.create({
      data: {
        tenantId: TENANT_ID,
        cycleId: baseline.cycleId,
        code: next("I6-LEVEL"),
        label: "I6 second level",
        track: "FRANCOPHONE",
        sortOrder: 99,
        status: "ACTIVE",
      },
    });
    const incompatiblePlan = await context.prisma.feePlan.create({
      data: {
        tenantId: TENANT_ID,
        schoolYearId: baseline.schoolYearId,
        levelId: secondLevel.id,
        label: "I6 incompatible",
        totalAmount: new Prisma.Decimal(130000),
        currency: "CFA",
      },
    });
    const crossTenantPlan = await context.prisma.feePlan.create({
      data: {
        tenantId: OTHER_TENANT_ID,
        schoolYearId: baseline.schoolYearId,
        levelId: baseline.levelId,
        label: next("I6-CROSS"),
        totalAmount: new Prisma.Decimal(140000),
        currency: "CFA",
      },
    });
    const created = await request(context.app.getHttpServer())
      .post("/api/v1/admission-cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mode: "NEW_ADMISSION" })
      .expect(201);
    await request(context.app.getHttpServer())
      .patch(`/api/v1/admission-cases/${created.body.id}/sections/ACADEMICS`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ expectedVersion: 1, data: academics() })
      .expect(200);

    const incompatible = await request(context.app.getHttpServer())
      .patch(`/api/v1/admission-cases/${created.body.id}/sections/FINANCE`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        expectedVersion: 2,
        data: { mode: "FEE_PLAN", feePlanId: incompatiblePlan.id },
      })
      .expect(400);
    expect(incompatible.body.code).toBe("FEE_PLAN_NOT_COMPATIBLE");

    const hidden = await request(context.app.getHttpServer())
      .patch(`/api/v1/admission-cases/${created.body.id}/sections/FINANCE`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        expectedVersion: 2,
        data: { mode: "FEE_PLAN", feePlanId: crossTenantPlan.id },
      })
      .expect(400);
    expect(hidden.body.code).toBe("FEE_PLAN_NOT_AVAILABLE");
  });

  it("finalizes a compatible plan as a traced intent without invoice or payment", async () => {
    const admissionCase = await createReadyCase({
      draft: newAdmissionDraft({
        mode: "FEE_PLAN",
        feePlanId: compatiblePlanId,
      }),
    });
    const before = await businessCounts();
    const idempotencyKey = `i6-plan-${admissionCase.id}`;
    const response = await finalize(admissionCase.id, idempotencyKey).expect(
      201,
    );

    expect(response.body).toMatchObject({
      status: "CONFIRMED",
      finance: {
        policy: "OPTIONAL",
        mode: "FEE_PLAN",
        feePlanId: compatiblePlanId,
        amount: 125000,
        currency: "CFA",
        invoiceGeneration: "DEFERRED",
      },
      invoiceIds: [],
    });
    const after = await businessCounts();
    expect(after).toMatchObject({
      invoices: before.invoices,
      payments: before.payments,
    });
    expect(after.students).toBe(before.students + 1);
    expect(after.placements).toBe(before.placements + 1);
    expect(after.enrollments).toBe(before.enrollments + 1);

    const audit = await context.prisma.iamAuditLog.findFirstOrThrow({
      where: { resourceId: admissionCase.id, action: "ADMISSION_CONFIRMED" },
      orderBy: { createdAt: "desc" },
    });
    const event = await context.prisma.outboxEvent.findFirstOrThrow({
      where: {
        aggregateId: admissionCase.id,
        eventType: "admission.confirmed",
      },
    });
    expect(audit.payload).toMatchObject({
      finance: { mode: "FEE_PLAN", feePlanId: compatiblePlanId },
    });
    expect(event.payload).toMatchObject({
      finance: { mode: "FEE_PLAN", feePlanId: compatiblePlanId },
    });

    const replay = await finalize(admissionCase.id, idempotencyKey).expect(201);
    expect(replay.body).toEqual(response.body);
    await expect(businessCounts()).resolves.toEqual(after);
  });

  it("allows deferred and unspecified finance under the optional policy", async () => {
    for (const finance of [{ mode: "DEFERRED" as const }, undefined]) {
      const admissionCase = await createReadyCase({
        draft: newAdmissionDraft(finance),
      });
      const before = await businessCounts();
      const response = await finalize(
        admissionCase.id,
        `i6-optional-${admissionCase.id}`,
      ).expect(201);
      expect(response.body.finance).toMatchObject({
        policy: "OPTIONAL",
        mode: finance ? "DEFERRED" : "UNSPECIFIED",
        invoiceGeneration: "DEFERRED",
      });
      const after = await businessCounts();
      expect(after.invoices).toBe(before.invoices);
      expect(after.payments).toBe(before.payments);
    }
  });

  it("revalidates a removed plan at finalize and rolls back every business write", async () => {
    const plan = await context.prisma.feePlan.create({
      data: {
        tenantId: TENANT_ID,
        schoolYearId: baseline.schoolYearId,
        levelId: baseline.levelId,
        label: next("I6-REMOVED"),
        totalAmount: new Prisma.Decimal(150000),
        currency: "CFA",
      },
    });
    const admissionCase = await createReadyCase({
      draft: newAdmissionDraft({ mode: "FEE_PLAN", feePlanId: plan.id }),
    });
    await context.prisma.feePlan.delete({ where: { id: plan.id } });
    const before = await businessCounts();

    const response = await finalize(
      admissionCase.id,
      `i6-removed-${admissionCase.id}`,
    ).expect(409);
    expect(response.body.code).toBe("FEE_PLAN_NOT_AVAILABLE");
    await expect(businessCounts()).resolves.toEqual(before);
    await expect(
      context.prisma.admissionCase.findUniqueOrThrow({
        where: { id: admissionCase.id },
        select: { status: true, failureCode: true },
      }),
    ).resolves.toEqual({
      status: AdmissionCaseStatus.FAILED,
      failureCode: "FEE_PLAN_NOT_AVAILABLE",
    });
  });

  it("keeps historical invoices unchanged during re-enrollment", async () => {
    const historicalInvoice = await context.prisma.invoice.create({
      data: {
        tenantId: TENANT_ID,
        studentId: baseline.studentOneId,
        schoolYearId: baseline.schoolYearId,
        feePlanId: compatiblePlanId,
        invoiceNo: next("I6-HIST"),
        amountDue: new Prisma.Decimal(125000),
        amountPaid: new Prisma.Decimal(25000),
        status: "PARTIAL",
      },
    });
    await context.prisma.schoolYear.update({
      where: { id: baseline.schoolYearId },
      data: { status: "CLOSED", isActive: false },
    });
    const nextYear = await context.prisma.schoolYear.create({
      data: {
        tenantId: TENANT_ID,
        code: next("I6-YEAR"),
        label: "I6 next year",
        startDate: new Date("2027-09-01"),
        endDate: new Date("2028-06-30"),
        status: "ACTIVE",
        isActive: true,
      },
    });
    const cycle = await context.prisma.cycle.create({
      data: {
        tenantId: TENANT_ID,
        schoolYearId: nextYear.id,
        code: next("I6-CYCLE"),
        label: "I6 cycle",
        sortOrder: 1,
        status: "ACTIVE",
      },
    });
    const level = await context.prisma.level.create({
      data: {
        tenantId: TENANT_ID,
        cycleId: cycle.id,
        code: next("I6-NEXT-LEVEL"),
        label: "I6 next level",
        track: "FRANCOPHONE",
        sortOrder: 1,
        status: "ACTIVE",
      },
    });
    const classroom = await context.prisma.classroom.create({
      data: {
        tenantId: TENANT_ID,
        schoolYearId: nextYear.id,
        levelId: level.id,
        code: next("I6-NEXT-CLASS"),
        label: "I6 next class",
        track: "FRANCOPHONE",
        status: "ACTIVE",
      },
    });
    const draft: AdmissionDraftData = {
      ACADEMICS: {
        schoolYearId: nextYear.id,
        cycleId: cycle.id,
        levelId: level.id,
        classId: classroom.id,
        track: "FRANCOPHONE",
      },
      FINANCE: { mode: "DEFERRED" },
    };
    const admissionCase = await createReadyCase({
      mode: AdmissionCaseMode.RE_ENROLLMENT,
      studentId: baseline.studentOneId,
      draft,
    });

    await finalize(
      admissionCase.id,
      `i6-reenrollment-${admissionCase.id}`,
    ).expect(201);
    const unchanged = await context.prisma.invoice.findUniqueOrThrow({
      where: { id: historicalInvoice.id },
    });
    expect(unchanged).toMatchObject({
      amountDue: historicalInvoice.amountDue,
      amountPaid: historicalInvoice.amountPaid,
      status: historicalInvoice.status,
      feePlanId: historicalInvoice.feePlanId,
    });
    expect(await context.prisma.payment.count()).toBe(0);
  });
});
