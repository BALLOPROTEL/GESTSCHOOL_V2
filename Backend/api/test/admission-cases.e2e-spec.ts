import { AdmissionCaseMode, AdmissionCaseStatus } from "@prisma/client";
import * as request from "supertest";

import {
  type AcademicBaseline,
  type E2eAppContext,
  TENANT_ID,
  closeE2eApp,
  configureE2eEnvironment,
  createE2eApp,
  login,
  provisionAcademicBaseline,
  seedUsers,
} from "./support/e2e-harness";

const OTHER_TENANT_ID = "90000000-0000-4000-8000-000000000001";

configureE2eEnvironment();

describe("Admission cases (e2e)", () => {
  let context: E2eAppContext;
  let adminToken: string;
  let scolariteToken: string;
  let baseline: AcademicBaseline;
  let businessCountsBefore: Record<string, number>;

  beforeAll(async () => {
    context = await createE2eApp();
    await seedUsers(context.prisma);
    adminToken = (await login(
      context.app,
      "admin@gestschool.local",
      "admin12345",
    )).accessToken;
    scolariteToken = (await login(
      context.app,
      "scolarite@gestschool.local",
      "scolarite123",
    )).accessToken;
    baseline = await provisionAcademicBaseline(
      context.app,
      adminToken,
      scolariteToken,
    );
    businessCountsBefore = await businessCounts();
  });

  afterAll(async () => {
    await closeE2eApp(context);
  });

  const businessCounts = async (): Promise<Record<string, number>> => ({
    students: await context.prisma.student.count(),
    parents: await context.prisma.parent.count(),
    parentStudentLinks: await context.prisma.parentStudentLink.count(),
    placements: await context.prisma.studentTrackPlacement.count(),
    enrollments: await context.prisma.enrollment.count(),
    invoices: await context.prisma.invoice.count(),
  });

  it("persists and resumes a NEW_ADMISSION draft until backend readiness", async () => {
    const created = await request(context.app.getHttpServer())
      .post("/api/v1/admission-cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mode: AdmissionCaseMode.NEW_ADMISSION })
      .expect(201);

    expect(created.body).toMatchObject({
      contractVersion: "1",
      payloadVersion: 1,
      mode: AdmissionCaseMode.NEW_ADMISSION,
      status: AdmissionCaseStatus.DRAFT,
      version: 1,
      ready: false,
      sections: { DOCUMENTS: null },
    });

    const studentSaved = await request(context.app.getHttpServer())
      .patch(`/api/v1/admission-cases/${created.body.id}/sections/STUDENT`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        expectedVersion: 1,
        data: {
          matriculeMode: "AUTO",
          firstName: "Draft",
          lastName: "Student",
          sex: "F",
          birthDate: "2014-02-10",
        },
      })
      .expect(200);

    expect(studentSaved.body).toMatchObject({
      status: AdmissionCaseStatus.DRAFT,
      version: 2,
      completion: { STUDENT: true, GUARDIANS: false, ACADEMICS: false },
    });

    const guardiansSaved = await request(context.app.getHttpServer())
      .patch(`/api/v1/admission-cases/${created.body.id}/sections/GUARDIANS`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        expectedVersion: 2,
        data: {
          guardians: [
            {
              source: "EXISTING_GUARDIAN",
              parentId: baseline.businessParentId,
              relationType: "PERE",
            },
          ],
        },
      })
      .expect(200);
    expect(guardiansSaved.body).toMatchObject({
      status: AdmissionCaseStatus.DRAFT,
      version: 3,
      completion: { STUDENT: true, GUARDIANS: true, ACADEMICS: false },
      sections: {
        GUARDIANS: {
          guardians: [expect.objectContaining({ isPrimaryContact: true })],
        },
      },
    });

    const academicsSaved = await request(context.app.getHttpServer())
      .patch(`/api/v1/admission-cases/${created.body.id}/sections/ACADEMICS`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        expectedVersion: 3,
        data: {
          schoolYearId: baseline.schoolYearId,
          cycleId: baseline.cycleId,
          levelId: baseline.levelId,
          classId: baseline.classId,
          track: "FRANCOPHONE",
        },
      })
      .expect(200);

    expect(academicsSaved.body).toMatchObject({
      status: AdmissionCaseStatus.READY,
      version: 4,
      ready: true,
      completion: { STUDENT: true, ACADEMICS: true },
    });

    const resumed = await request(context.app.getHttpServer())
      .get(`/api/v1/admission-cases/${created.body.id}`)
      .set("Authorization", `Bearer ${scolariteToken}`)
      .expect(200);

    expect(resumed.body).toMatchObject({
      id: created.body.id,
      version: 4,
      status: AdmissionCaseStatus.READY,
      sections: {
        STUDENT: { matriculeMode: "AUTO" },
        ACADEMICS: { classId: baseline.classId },
      },
    });

    const listed = await request(context.app.getHttpServer())
      .get("/api/v1/admission-cases?page=1&limit=10&status=READY")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(listed.body).toMatchObject({ page: 1, pageSize: 10 });
    expect(listed.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.body.id })]),
    );
  });

  it("allows only one of two concurrent PATCH requests with the same version", async () => {
    const created = await request(context.app.getHttpServer())
      .post("/api/v1/admission-cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mode: AdmissionCaseMode.NEW_ADMISSION })
      .expect(201);
    const admissionCase = await context.prisma.admissionCase.findUniqueOrThrow({
      where: { id: created.body.id as string },
    });

    const [financeResponse, guardianResponse] = await Promise.all([
      request(context.app.getHttpServer())
        .patch(
          `/api/v1/admission-cases/${admissionCase.id}/sections/FINANCE`,
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          expectedVersion: admissionCase.version,
          data: { mode: "DEFERRED" },
        }),
      request(context.app.getHttpServer())
        .patch(
          `/api/v1/admission-cases/${admissionCase.id}/sections/GUARDIANS`,
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          expectedVersion: admissionCase.version,
          data: { guardians: [] },
        }),
    ]);

    expect([financeResponse.status, guardianResponse.status].sort()).toEqual([
      200, 409,
    ]);
    const conflict =
      financeResponse.status === 409 ? financeResponse : guardianResponse;
    expect(conflict.body).toMatchObject({
      code: "ADMISSION_VERSION_CONFLICT",
    });

    const persisted = await context.prisma.admissionCase.findUniqueOrThrow({
      where: { id: admissionCase.id },
    });
    expect(persisted.version).toBe(admissionCase.version + 1);
    const draft = persisted.draftData as Record<string, unknown>;
    expect(
      Number(Object.prototype.hasOwnProperty.call(draft, "FINANCE")) +
        Number(Object.prototype.hasOwnProperty.call(draft, "GUARDIANS")),
    ).toBe(1);
  });

  it("rejects stale versions, unknown sections and status injection", async () => {
    const admissionCase = await context.prisma.admissionCase.findFirstOrThrow({
      where: { tenantId: TENANT_ID, mode: AdmissionCaseMode.NEW_ADMISSION },
      orderBy: { createdAt: "desc" },
    });

    const stale = await request(context.app.getHttpServer())
      .patch(`/api/v1/admission-cases/${admissionCase.id}/sections/FINANCE`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ expectedVersion: admissionCase.version - 1, data: {} })
      .expect(409);
    expect(stale.body).toMatchObject({ code: "ADMISSION_VERSION_CONFLICT" });

    await request(context.app.getHttpServer())
      .patch(`/api/v1/admission-cases/${admissionCase.id}/sections/UNKNOWN`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ expectedVersion: admissionCase.version, data: {} })
      .expect(400);

    await request(context.app.getHttpServer())
      .patch(`/api/v1/admission-cases/${admissionCase.id}/sections/FINANCE`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        expectedVersion: admissionCase.version,
        data: {},
        status: AdmissionCaseStatus.CONFIRMED,
      })
      .expect(400);
  });

  it("creates RE_ENROLLMENT only for a selectable student in the same tenant", async () => {
    const created = await request(context.app.getHttpServer())
      .post("/api/v1/admission-cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        mode: AdmissionCaseMode.RE_ENROLLMENT,
        studentId: baseline.studentOneId,
      })
      .expect(201);
    expect(created.body).toMatchObject({
      mode: AdmissionCaseMode.RE_ENROLLMENT,
      studentId: baseline.studentOneId,
      completion: { STUDENT: true },
      status: AdmissionCaseStatus.DRAFT,
    });

    await request(context.app.getHttpServer())
      .post("/api/v1/admission-cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mode: AdmissionCaseMode.RE_ENROLLMENT })
      .expect(400);

    const otherTenantStudent = await context.prisma.student.create({
      data: {
        tenantId: OTHER_TENANT_ID,
        matricule: "OTHER-TENANT-STUDENT",
        firstName: "Other",
        lastName: "Tenant",
        sex: "M",
      },
    });
    await request(context.app.getHttpServer())
      .post("/api/v1/admission-cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        mode: AdmissionCaseMode.RE_ENROLLMENT,
        studentId: otherTenantStudent.id,
      })
      .expect(400);
    await context.prisma.student.delete({
      where: { id: otherTenantStudent.id },
    });
  });

  it("hides cases belonging to another tenant", async () => {
    const hidden = await context.prisma.admissionCase.create({
      data: {
        tenantId: OTHER_TENANT_ID,
        mode: AdmissionCaseMode.NEW_ADMISSION,
      },
    });

    const response = await request(context.app.getHttpServer())
      .get(`/api/v1/admission-cases/${hidden.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);
    expect(response.body).toMatchObject({ code: "ADMISSION_CASE_NOT_FOUND" });
  });

  it("cancels a draft permanently and rejects subsequent modifications", async () => {
    const created = await request(context.app.getHttpServer())
      .post("/api/v1/admission-cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mode: AdmissionCaseMode.NEW_ADMISSION })
      .expect(201);

    const cancelled = await request(context.app.getHttpServer())
      .post(`/api/v1/admission-cases/${created.body.id}/cancel`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ expectedVersion: 1 })
      .expect(201);
    expect(cancelled.body).toMatchObject({
      status: AdmissionCaseStatus.CANCELLED,
      version: 2,
      ready: false,
    });
    expect(cancelled.body.cancelledAt).toEqual(expect.any(String));

    const response = await request(context.app.getHttpServer())
      .patch(`/api/v1/admission-cases/${created.body.id}/sections/STUDENT`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ expectedVersion: 2, data: { firstName: "No" } })
      .expect(409);
    expect(response.body).toMatchObject({ code: "ADMISSION_CASE_CANCELLED" });
  });

  it("never creates or mutates business rows while saving drafts", async () => {
    expect(await context.prisma.admissionCase.count()).toBeGreaterThan(0);
    await expect(businessCounts()).resolves.toEqual(businessCountsBefore);
  });
});
