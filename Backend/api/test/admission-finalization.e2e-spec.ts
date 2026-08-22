import {
  AcademicPlacementStatus,
  AdmissionCaseMode,
  AdmissionCaseStatus,
  type AcademicTrack,
  Prisma,
} from "@prisma/client";
import * as request from "supertest";

import {
  AdmissionFinalizationService,
  type AdmissionFinalizationCheckpoint,
} from "../src/admissions/admission-finalization.service";
import type {
  AdmissionDraftData,
  AdmissionGuardianDraft,
} from "../src/admissions/admission-cases.types";
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
const ADMISSION_EVENT = "admission.confirmed";

type BusinessCounts = {
  students: number;
  parents: number;
  links: number;
  placements: number;
  enrollments: number;
  invoices: number;
  confirmationAudits: number;
  admissionEvents: number;
};

configureE2eEnvironment();

describe("Admission transactional finalization (e2e)", () => {
  let context: E2eAppContext;
  let adminToken: string;
  let adminUserId: string;
  let baseline: AcademicBaseline;
  let finalizationService: AdmissionFinalizationService;
  let sequence = 0;

  beforeAll(async () => {
    context = await createE2eApp();
    await cleanDatabase(context.prisma);
    await seedUsers(context.prisma);
    adminToken = (
      await login(context.app, "admin@gestschool.local", "admin12345")
    ).accessToken;
    adminUserId = (
      await context.prisma.user.findFirstOrThrow({
        where: { tenantId: TENANT_ID, username: "admin@gestschool.local" },
        select: { id: true },
      })
    ).id;
    const scolariteToken = (
      await login(context.app, "scolarite@gestschool.local", "scolarite123")
    ).accessToken;
    baseline = await provisionAcademicBaseline(
      context.app,
      adminToken,
      scolariteToken,
    );
    finalizationService = context.app.get(AdmissionFinalizationService);
  });

  afterAll(async () => {
    await closeE2eApp(context);
  });

  const next = (prefix: string): string => `${prefix}-${++sequence}`;

  const academics = (override: Partial<AdmissionDraftData["ACADEMICS"]> = {}) => ({
    schoolYearId: baseline.schoolYearId,
    cycleId: baseline.cycleId,
    levelId: baseline.levelId,
    classId: baseline.classId,
    track: "FRANCOPHONE" as AcademicTrack,
    ...override,
  });

  const newStudentDraft = (
    suffix: string,
    guardians?: AdmissionGuardianDraft[],
  ): AdmissionDraftData => ({
    STUDENT: {
      matricule: `ADM-${sequence}-${suffix}`.slice(0, 30),
      firstName: `Admission${sequence}`,
      lastName: `Student${sequence}`,
      sex: "F",
      birthDate: `2015-01-${String((sequence % 27) + 1).padStart(2, "0")}`,
      admissionDate: "2026-08-20",
    },
    GUARDIANS: { guardians: guardians ?? [newGuardian(suffix)] },
    ACADEMICS: academics(),
    FINANCE: { disposition: "DEFERRED" },
  });

  const newGuardian = (suffix: string): AdmissionGuardianDraft => ({
    source: "NEW_GUARDIAN",
    parentalRole: "TUTEUR",
    firstName: `Guardian${suffix}`,
    lastName: `Family${suffix}`,
    primaryPhone: `+22371${String(sequence).padStart(6, "0")}`,
    relationType: "TUTEUR",
    isPrimaryContact: true,
    legalGuardian: true,
    financialResponsible: true,
    emergencyContact: true,
  });

  const createReadyCase = async (input?: {
    mode?: AdmissionCaseMode;
    studentId?: string;
    draftData?: AdmissionDraftData;
    tenantId?: string;
  }) => {
    const suffix = next("CASE");
    return context.prisma.admissionCase.create({
      data: {
        tenantId: input?.tenantId ?? TENANT_ID,
        mode: input?.mode ?? AdmissionCaseMode.NEW_ADMISSION,
        status: AdmissionCaseStatus.READY,
        studentId: input?.studentId,
        schoolYearId:
          input?.draftData?.ACADEMICS?.schoolYearId ?? baseline.schoolYearId,
        draftData: (input?.draftData ?? newStudentDraft(suffix)) as Prisma.InputJsonObject,
        createdByUserId: adminUserId,
        updatedByUserId: adminUserId,
      },
    });
  };

  const finalize = (
    caseId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ) =>
    request(context.app.getHttpServer())
      .post(`/api/v1/admission-cases/${caseId}/finalize`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ expectedVersion, idempotencyKey });

  const businessCounts = async (): Promise<BusinessCounts> => ({
    students: await context.prisma.student.count(),
    parents: await context.prisma.parent.count(),
    links: await context.prisma.parentStudentLink.count(),
    placements: await context.prisma.studentTrackPlacement.count(),
    enrollments: await context.prisma.enrollment.count(),
    invoices: await context.prisma.invoice.count(),
    confirmationAudits: await context.prisma.iamAuditLog.count({
      where: { action: "ADMISSION_CONFIRMED" },
    }),
    admissionEvents: await context.prisma.outboxEvent.count({
      where: { eventType: ADMISSION_EVENT },
    }),
  });

  it("finalizes NEW_ADMISSION atomically and returns a stable idempotent result", async () => {
    const suffix = next("NEW");
    const admissionCase = await createReadyCase({
      draftData: newStudentDraft(suffix, [newGuardian(suffix)]),
    });
    const before = await businessCounts();
    const key = `finalize-${admissionCase.id}`;

    const first = await finalize(admissionCase.id, 1, key).expect(201);
    expect(first.body).toMatchObject({
      contractVersion: "1",
      admissionCaseId: admissionCase.id,
      status: "CONFIRMED",
      invoiceIds: [],
      version: 3,
    });
    expect(first.body.guardianIds).toHaveLength(1);
    expect(first.body.parentStudentLinkIds).toHaveLength(1);

    const persisted = await context.prisma.admissionCase.findUniqueOrThrow({
      where: { id: admissionCase.id },
    });
    expect(persisted).toMatchObject({
      status: AdmissionCaseStatus.CONFIRMED,
      version: 3,
      failureCode: null,
      finalizationLeaseToken: null,
    });
    expect(persisted.finalizationResult).toEqual(first.body);

    const placement = await context.prisma.studentTrackPlacement.findUniqueOrThrow({
      where: { id: first.body.placementId },
    });
    const enrollment = await context.prisma.enrollment.findUniqueOrThrow({
      where: { id: first.body.enrollmentId },
    });
    expect(placement).toMatchObject({
      tenantId: TENANT_ID,
      studentId: first.body.studentId,
      legacyEnrollmentId: enrollment.id,
    });
    expect(enrollment).toMatchObject({
      tenantId: TENANT_ID,
      studentId: first.body.studentId,
      classId: placement.classId,
      schoolYearId: placement.schoolYearId,
      track: placement.track,
    });
    await expect(businessCounts()).resolves.toEqual({
      students: before.students + 1,
      parents: before.parents + 1,
      links: before.links + 1,
      placements: before.placements + 1,
      enrollments: before.enrollments + 1,
      invoices: before.invoices,
      confirmationAudits: before.confirmationAudits + 1,
      admissionEvents: before.admissionEvents + 1,
    });

    const countsAfterFirst = await businessCounts();
    const replay = await finalize(admissionCase.id, 1, key).expect(201);
    expect(replay.body).toEqual(first.body);
    await expect(businessCounts()).resolves.toEqual(countsAfterFirst);

    await context.prisma.admissionCase.update({
      where: { id: admissionCase.id },
      data: {
        draftData: {
          ...(persisted.draftData as Prisma.JsonObject),
          FINANCE: { disposition: "DEFERRED", note: "changed-after-confirmation" },
        },
      },
    });
    const changedPayload = await finalize(admissionCase.id, 3, key).expect(409);
    expect(changedPayload.body).toMatchObject({
      code: "ADMISSION_IDEMPOTENCY_CONFLICT",
    });
    await expect(businessCounts()).resolves.toEqual(countsAfterFirst);

    const contradictory = await finalize(
      admissionCase.id,
      1,
      `${key}-different`,
    ).expect(409);
    expect(contradictory.body).toMatchObject({
      code: "ADMISSION_IDEMPOTENCY_CONFLICT",
    });

    const immutable = await request(context.app.getHttpServer())
      .patch(`/api/v1/admission-cases/${admissionCase.id}/sections/FINANCE`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ expectedVersion: 3, data: { disposition: "IMMEDIATE" } })
      .expect(409);
    expect(immutable.body.code).toBe("ADMISSION_INVALID_TRANSITION");
  });

  it("blocks suspected student and guardian duplicates without partial writes", async () => {
    const studentSuffix = next("DUPLICATE-STUDENT");
    const duplicateDraft = newStudentDraft(studentSuffix);
    await context.prisma.student.create({
      data: {
        tenantId: TENANT_ID,
        matricule: `EXISTING-${studentSuffix}`.slice(0, 30),
        firstName: duplicateDraft.STUDENT!.firstName!,
        lastName: duplicateDraft.STUDENT!.lastName!,
        sex: duplicateDraft.STUDENT!.sex!,
        birthDate: new Date(duplicateDraft.STUDENT!.birthDate!),
      },
    });
    const duplicateStudentCase = await createReadyCase({
      draftData: duplicateDraft,
    });
    const beforeStudentConflict = await businessCounts();
    const studentConflict = await finalize(
      duplicateStudentCase.id,
      1,
      `duplicate-student-${duplicateStudentCase.id}`,
    ).expect(409);
    expect(studentConflict.body.code).toBe("STUDENT_DUPLICATE_SUSPECTED");
    await expect(businessCounts()).resolves.toEqual(beforeStudentConflict);

    const guardianSuffix = next("DUPLICATE-GUARDIAN");
    const guardian = newGuardian(guardianSuffix);
    await context.prisma.parent.create({
      data: {
        tenantId: TENANT_ID,
        parentalRole: guardian.parentalRole!,
        firstName: guardian.firstName!,
        lastName: guardian.lastName!,
        primaryPhone: guardian.primaryPhone!,
        status: "ACTIVE",
      },
    });
    const duplicateGuardianCase = await createReadyCase({
      draftData: newStudentDraft(guardianSuffix, [guardian]),
    });
    const beforeGuardianConflict = await businessCounts();
    const guardianConflict = await finalize(
      duplicateGuardianCase.id,
      1,
      `duplicate-guardian-${duplicateGuardianCase.id}`,
    ).expect(409);
    expect(guardianConflict.body.code).toBe("GUARDIAN_DUPLICATE_SUSPECTED");
    await expect(businessCounts()).resolves.toEqual(beforeGuardianConflict);
  });

  it("reuses an existing guardian without creating a duplicate parent", async () => {
    const suffix = next("EXISTING-GUARDIAN");
    const admissionCase = await createReadyCase({
      draftData: newStudentDraft(suffix, [
        {
          source: "EXISTING_GUARDIAN",
          parentId: baseline.businessParentId,
          relationType: "PERE",
          isPrimaryContact: true,
          legalGuardian: true,
        },
      ]),
    });
    const before = await businessCounts();

    const response = await finalize(
      admissionCase.id,
      1,
      `existing-guardian-${admissionCase.id}`,
    ).expect(201);

    expect(response.body.guardianIds).toEqual([baseline.businessParentId]);
    await expect(businessCounts()).resolves.toEqual({
      students: before.students + 1,
      parents: before.parents,
      links: before.links + 1,
      placements: before.placements + 1,
      enrollments: before.enrollments + 1,
      invoices: before.invoices,
      confirmationAudits: before.confirmationAudits + 1,
      admissionEvents: before.admissionEvents + 1,
    });
  });

  it("finalizes RE_ENROLLMENT without recreating the student or historical placement", async () => {
    const suffix = next("REENROLL");
    const student = await context.prisma.student.create({
      data: {
        tenantId: TENANT_ID,
        matricule: `RE-${suffix}`,
        firstName: "Existing",
        lastName: suffix,
        sex: "M",
      },
    });
    const oldYear = await context.prisma.schoolYear.create({
      data: {
        tenantId: TENANT_ID,
        code: `OLD-${suffix}`.slice(0, 20),
        label: `Old ${suffix}`.slice(0, 40),
        startDate: new Date("2025-09-01"),
        endDate: new Date("2026-06-30"),
        status: "CLOSED",
        isActive: false,
      },
    });
    const oldCycle = await context.prisma.cycle.create({
      data: {
        tenantId: TENANT_ID,
        schoolYearId: oldYear.id,
        code: `OC-${suffix}`.slice(0, 20),
        label: `Old cycle ${suffix}`.slice(0, 100),
        sortOrder: 1,
        status: "INACTIVE",
      },
    });
    const oldLevel = await context.prisma.level.create({
      data: {
        tenantId: TENANT_ID,
        cycleId: oldCycle.id,
        code: `OL-${suffix}`.slice(0, 20),
        label: `Old level ${suffix}`.slice(0, 100),
        sortOrder: 1,
        track: "FRANCOPHONE",
        status: "INACTIVE",
      },
    });
    const oldClass = await context.prisma.classroom.create({
      data: {
        tenantId: TENANT_ID,
        schoolYearId: oldYear.id,
        levelId: oldLevel.id,
        code: `OCL-${suffix}`.slice(0, 30),
        label: `Old class ${suffix}`.slice(0, 100),
        track: "FRANCOPHONE",
        status: "INACTIVE",
      },
    });
    const oldEnrollment = await context.prisma.enrollment.create({
      data: {
        tenantId: TENANT_ID,
        schoolYearId: oldYear.id,
        studentId: student.id,
        classId: oldClass.id,
        track: "FRANCOPHONE",
        enrollmentDate: new Date("2025-09-05"),
      },
    });
    const oldPlacement = await context.prisma.studentTrackPlacement.create({
      data: {
        tenantId: TENANT_ID,
        studentId: student.id,
        schoolYearId: oldYear.id,
        track: "FRANCOPHONE",
        levelId: oldLevel.id,
        classId: oldClass.id,
        legacyEnrollmentId: oldEnrollment.id,
        placementStatus: AcademicPlacementStatus.COMPLETED,
        startDate: new Date("2025-09-05"),
      },
    });
    const admissionCase = await createReadyCase({
      mode: AdmissionCaseMode.RE_ENROLLMENT,
      studentId: student.id,
      draftData: { GUARDIANS: { guardians: [] }, ACADEMICS: academics() },
    });
    const before = await businessCounts();

    const response = await finalize(
      admissionCase.id,
      1,
      `reenroll-${admissionCase.id}`,
    ).expect(201);

    expect(response.body.studentId).toBe(student.id);
    await expect(businessCounts()).resolves.toEqual({
      ...before,
      placements: before.placements + 1,
      enrollments: before.enrollments + 1,
      confirmationAudits: before.confirmationAudits + 1,
      admissionEvents: before.admissionEvents + 1,
    });
    await expect(
      context.prisma.studentTrackPlacement.findUnique({
        where: { id: oldPlacement.id },
      }),
    ).resolves.toMatchObject({ legacyEnrollmentId: oldEnrollment.id });
  });

  it("allows only one business finalization under two concurrent requests", async () => {
    const suffix = next("CONCURRENT");
    const admissionCase = await createReadyCase({
      draftData: newStudentDraft(suffix, [newGuardian(suffix)]),
    });
    const before = await businessCounts();
    const key = `concurrent-${admissionCase.id}`;

    const responses = await Promise.all([
      finalize(admissionCase.id, 1, key),
      finalize(admissionCase.id, 1, key),
    ]);
    expect(responses.some((response) => response.status === 201)).toBe(true);
    expect(
      responses.every((response) => [201, 409].includes(response.status)),
    ).toBe(true);
    const conflict = responses.find((response) => response.status === 409);
    if (conflict) {
      expect([
        "ADMISSION_FINALIZATION_IN_PROGRESS",
        "ADMISSION_VERSION_CONFLICT",
      ]).toContain(conflict.body.code);
    }
    await expect(businessCounts()).resolves.toEqual({
      students: before.students + 1,
      parents: before.parents + 1,
      links: before.links + 1,
      placements: before.placements + 1,
      enrollments: before.enrollments + 1,
      invoices: before.invoices,
      confirmationAudits: before.confirmationAudits + 1,
      admissionEvents: before.admissionEvents + 1,
    });
  });

  it("rolls back cleanly for placement conflicts, disabled classes and cross-tenant references", async () => {
    const conflictStudent = await context.prisma.student.create({
      data: {
        tenantId: TENANT_ID,
        matricule: next("PLACEMENT-STUDENT"),
        firstName: "Placement",
        lastName: "Conflict",
        sex: "M",
      },
    });
    await context.prisma.enrollment.create({
      data: {
        tenantId: TENANT_ID,
        schoolYearId: baseline.schoolYearId,
        studentId: conflictStudent.id,
        classId: baseline.classId,
        track: "FRANCOPHONE",
        enrollmentDate: new Date("2026-09-01"),
      },
    });
    await context.prisma.studentTrackPlacement.create({
      data: {
        tenantId: TENANT_ID,
        studentId: conflictStudent.id,
        schoolYearId: baseline.schoolYearId,
        track: "FRANCOPHONE",
        levelId: baseline.levelId,
        classId: baseline.classId,
        placementStatus: "ACTIVE",
      },
    });
    const placementCase = await createReadyCase({
      mode: AdmissionCaseMode.RE_ENROLLMENT,
      studentId: conflictStudent.id,
      draftData: { ACADEMICS: academics() },
    });
    const beforePlacement = await businessCounts();
    const placementConflict = await finalize(
      placementCase.id,
      1,
      `placement-conflict-${placementCase.id}`,
    ).expect(409);
    expect(placementConflict.body.code).toBe("PLACEMENT_CONFLICT");
    await expect(businessCounts()).resolves.toEqual(beforePlacement);

    const disabledSuffix = next("DISABLED");
    const disabledCase = await createReadyCase({
      draftData: newStudentDraft(disabledSuffix),
    });
    const beforeDisabled = await businessCounts();
    await context.prisma.classroom.update({
      where: { id: baseline.classId },
      data: { status: "INACTIVE" },
    });
    const disabled = await finalize(
      disabledCase.id,
      1,
      `disabled-class-${disabledCase.id}`,
    ).expect(409);
    expect(disabled.body.code).toBe("CLASS_NOT_AVAILABLE");
    await expect(businessCounts()).resolves.toEqual(beforeDisabled);
    await context.prisma.classroom.update({
      where: { id: baseline.classId },
      data: { status: "ACTIVE" },
    });

    const otherYear = await context.prisma.schoolYear.create({
      data: {
        tenantId: OTHER_TENANT_ID,
        code: next("OTHER-YEAR").slice(0, 20),
        label: next("Other year").slice(0, 40),
        startDate: new Date("2026-09-01"),
        endDate: new Date("2027-06-30"),
        status: "ACTIVE",
        isActive: true,
      },
    });
    const otherCycle = await context.prisma.cycle.create({
      data: {
        tenantId: OTHER_TENANT_ID,
        schoolYearId: otherYear.id,
        code: next("OTHER-CYCLE").slice(0, 20),
        label: "Other cycle",
        sortOrder: 1,
      },
    });
    const otherLevel = await context.prisma.level.create({
      data: {
        tenantId: OTHER_TENANT_ID,
        cycleId: otherCycle.id,
        code: next("OTHER-LEVEL").slice(0, 20),
        label: "Other level",
        sortOrder: 1,
        track: "FRANCOPHONE",
      },
    });
    const otherClass = await context.prisma.classroom.create({
      data: {
        tenantId: OTHER_TENANT_ID,
        schoolYearId: otherYear.id,
        levelId: otherLevel.id,
        code: next("OTHER-CLASS").slice(0, 30),
        label: "Other class",
        track: "FRANCOPHONE",
      },
    });
    const crossSuffix = next("CROSS");
    const crossCase = await createReadyCase({
      draftData: {
        ...newStudentDraft(crossSuffix),
        ACADEMICS: academics({
          schoolYearId: otherYear.id,
          cycleId: otherCycle.id,
          levelId: otherLevel.id,
          classId: otherClass.id,
        }),
      },
    });
    const beforeCrossTenant = await businessCounts();
    const crossTenant = await finalize(
      crossCase.id,
      1,
      `cross-tenant-${crossCase.id}`,
    ).expect(409);
    expect(crossTenant.body.code).toBe("CLASS_NOT_AVAILABLE");
    await expect(businessCounts()).resolves.toEqual(beforeCrossTenant);
  });

  it.each<AdmissionFinalizationCheckpoint>([
    "AFTER_STUDENT",
    "AFTER_GUARDIAN",
    "AFTER_PARENT_STUDENT_LINK",
    "AFTER_PLACEMENT",
    "AFTER_ENROLLMENT",
    "BEFORE_AUDIT_OUTBOX",
    "BEFORE_COMMIT",
  ])("rolls back every business write when fault injection occurs at %s", async (point) => {
    const suffix = next(`ROLLBACK-${point}`);
    const admissionCase = await createReadyCase({
      draftData: newStudentDraft(suffix, [newGuardian(suffix)]),
    });
    const before = await businessCounts();
    const checkpointTarget = finalizationService as unknown as {
      checkpoint(value: AdmissionFinalizationCheckpoint): void;
    };
    const spy = jest
      .spyOn(checkpointTarget, "checkpoint")
      .mockImplementation((value) => {
        if (value === point) throw new Error(`Injected failure at ${point}`);
      });

    try {
      const response = await finalize(
        admissionCase.id,
        1,
        `rollback-${point}-${admissionCase.id}`,
      ).expect(500);
      expect(response.body.code).toBe("ADMISSION_FINALIZATION_FAILED");
    } finally {
      spy.mockRestore();
    }

    await expect(businessCounts()).resolves.toEqual(before);
    const failed = await context.prisma.admissionCase.findUniqueOrThrow({
      where: { id: admissionCase.id },
    });
    expect(failed).toMatchObject({
      status: AdmissionCaseStatus.FAILED,
      version: 3,
      failureCode: "ADMISSION_FINALIZATION_FAILED",
      finalizationLeaseToken: null,
    });
    expect(failed.failureMessage).not.toContain("Injected failure");

    if (point === "BEFORE_COMMIT") {
      const retry = await finalize(
        admissionCase.id,
        failed.version,
        `rollback-${point}-${admissionCase.id}`,
      ).expect(201);
      expect(retry.body.status).toBe("CONFIRMED");
    }
  });
});
