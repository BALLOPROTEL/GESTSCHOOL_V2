import { AdmissionCaseMode, AdmissionCaseStatus, Prisma } from "@prisma/client";
import * as request from "supertest";

import type { AdmissionDraftData } from "../src/admissions/admission-cases.types";
import { ParentsService } from "../src/parents/parents.service";
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

describe("Admission identity and guardian policy (e2e)", () => {
  let context: E2eAppContext;
  let adminToken: string;
  let scolariteToken: string;
  let comptableToken: string;
  let adminUserId: string;
  let baseline: AcademicBaseline;
  let parentsService: ParentsService;
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
    comptableToken = (
      await login(context.app, "comptable@gestschool.local", "comptable123")
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
    parentsService = context.app.get(ParentsService);
  });

  afterAll(async () => {
    await closeE2eApp(context);
  });

  const next = (prefix: string): string => `${prefix}-${++sequence}`;

  const academics = () => ({
    schoolYearId: baseline.schoolYearId,
    cycleId: baseline.cycleId,
    levelId: baseline.levelId,
    classId: baseline.classId,
    track: "FRANCOPHONE" as const,
  });

  const autoDraft = (
    suffix: string,
    guardianId = baseline.businessParentId,
  ): AdmissionDraftData => ({
    STUDENT: {
      matriculeMode: "AUTO",
      firstName: `Auto${suffix}`.slice(0, 100),
      lastName: `Student${suffix}`.slice(0, 100),
      sex: "F",
      birthDate: `2014-03-${String((sequence % 27) + 1).padStart(2, "0")}`,
    },
    GUARDIANS: {
      guardians: [
        {
          source: "EXISTING_GUARDIAN",
          parentId: guardianId,
          relationType: "PERE",
          isPrimaryContact: true,
          legalGuardian: true,
        },
      ],
    },
    ACADEMICS: academics(),
  });

  const createReadyCase = (draftData: AdmissionDraftData) =>
    context.prisma.admissionCase.create({
      data: {
        tenantId: TENANT_ID,
        mode: AdmissionCaseMode.NEW_ADMISSION,
        status: AdmissionCaseStatus.READY,
        schoolYearId: baseline.schoolYearId,
        draftData: draftData as Prisma.InputJsonObject,
        createdByUserId: adminUserId,
        updatedByUserId: adminUserId,
      },
    });

  const finalize = (
    id: string,
    version: number,
    key: string,
    token = adminToken,
  ) =>
    request(context.app.getHttpServer())
      .post(`/api/v1/admission-cases/${id}/finalize`)
      .set("Authorization", `Bearer ${token}`)
      .send({ expectedVersion: version, idempotencyKey: key });

  it("classifies student and guardian matches without leaking another tenant", async () => {
    const suffix = next("SEARCH");
    const student = await context.prisma.student.create({
      data: {
        tenantId: TENANT_ID,
        matricule: `SRCH-${suffix}`,
        firstName: "Awa",
        lastName: suffix,
        sex: "F",
        birthDate: new Date("2014-02-03"),
        phone: "+223 70 12 34 56",
        email: `awa.${sequence}@example.test`,
      },
    });
    const exact = await request(context.app.getHttpServer())
      .get("/api/v1/admission-cases/search/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ matricule: student.matricule.toLowerCase() })
      .expect(200);
    expect(exact.body).toMatchObject({
      matchKind: "EXACT_MATCH",
      code: "STUDENT_EXACT_MATCH",
      matches: [
        expect.objectContaining({
          id: student.id,
          matchKind: "EXACT_MATCH",
          blocksCreation: true,
        }),
      ],
    });

    const possible = await request(context.app.getHttpServer())
      .get("/api/v1/admission-cases/search/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ firstName: " Awa ", lastName: suffix, birthDate: "2014-02-03" })
      .expect(200);
    expect(possible.body).toMatchObject({
      matchKind: "POSSIBLE_MATCH",
      code: "STUDENT_DUPLICATE_SUSPECTED",
    });

    const guardian = await context.prisma.parent.create({
      data: {
        tenantId: TENANT_ID,
        parentalRole: "RESPONSABLE_LEGAL",
        firstName: "Mariam",
        lastName: suffix,
        primaryPhone: "+223 76 98 76 54",
        email: `mariam.${sequence}@example.test`,
        status: "ACTIVE",
      },
    });
    const guardianSearch = await request(context.app.getHttpServer())
      .get("/api/v1/admission-cases/search/guardians")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ phone: "00223 76 98 76 54".replace("00", "+") })
      .expect(200);
    expect(guardianSearch.body).toMatchObject({
      matchKind: "POSSIBLE_MATCH",
      code: "GUARDIAN_DUPLICATE_SUSPECTED",
      matches: [
        expect.objectContaining({
          id: guardian.id,
          blocksCreation: true,
          parentalRole: "RESPONSABLE_LEGAL",
        }),
      ],
    });
    expect(guardianSearch.body.matches[0].phoneHint).not.toContain("76987654");
    expect(guardianSearch.body.matches[0].emailHint).not.toContain(
      `mariam.${sequence}`,
    );

    await context.prisma.student.create({
      data: {
        tenantId: OTHER_TENANT_ID,
        matricule: "CROSS-TENANT-I4",
        firstName: "Hidden",
        lastName: "Student",
        sex: "M",
      },
    });
    const hidden = await request(context.app.getHttpServer())
      .get("/api/v1/admission-cases/search/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ matricule: "CROSS-TENANT-I4" })
      .expect(200);
    expect(hidden.body).toEqual({
      matchKind: "NO_MATCH",
      code: null,
      matches: [],
    });

    await context.prisma.parent.create({
      data: {
        tenantId: OTHER_TENANT_ID,
        parentalRole: "TUTEUR",
        firstName: "Hidden",
        lastName: "Guardian",
        primaryPhone: "+22379999999",
        status: "ACTIVE",
      },
    });
    const hiddenGuardian = await request(context.app.getHttpServer())
      .get("/api/v1/admission-cases/search/guardians")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ phone: "+22379999999" })
      .expect(200);
    expect(hiddenGuardian.body).toEqual({
      matchKind: "NO_MATCH",
      code: null,
      matches: [],
    });

    await request(context.app.getHttpServer())
      .get("/api/v1/admission-cases/search/students")
      .set("Authorization", `Bearer ${comptableToken}`)
      .query({ matricule: student.matricule })
      .expect(403);
  });

  it("requires birth date and a primary guardian, auto-selecting a sole guardian", async () => {
    const created = await request(context.app.getHttpServer())
      .post("/api/v1/admission-cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mode: "NEW_ADMISSION" })
      .expect(201);
    const student = await request(context.app.getHttpServer())
      .patch(`/api/v1/admission-cases/${created.body.id}/sections/STUDENT`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        expectedVersion: 1,
        data: {
          matriculeMode: "AUTO",
          firstName: "Without",
          lastName: "Birthdate",
          sex: "M",
        },
      })
      .expect(200);
    expect(student.body.completion.STUDENT).toBe(false);
    expect(student.body.blockingIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ADMISSION_STUDENT_SECTION_INCOMPLETE",
        }),
        expect.objectContaining({ code: "GUARDIAN_REQUIRED" }),
      ]),
    );

    const guardian = await request(context.app.getHttpServer())
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
    expect(guardian.body.sections.GUARDIANS.guardians[0].isPrimaryContact).toBe(
      true,
    );

    const manualDenied = await request(context.app.getHttpServer())
      .patch(`/api/v1/admission-cases/${created.body.id}/sections/STUDENT`)
      .set("Authorization", `Bearer ${scolariteToken}`)
      .send({
        expectedVersion: 3,
        data: {
          matriculeMode: "MANUAL",
          matricule: "advanced-override",
          firstName: "Manual",
          lastName: "Denied",
          sex: "F",
          birthDate: "2014-05-06",
        },
      })
      .expect(403);
    expect(manualDenied.body.code).toBe("MATRICULE_OVERRIDE_FORBIDDEN");
  });

  it("allocates unique tenant-scoped matricules under concurrent finalization and replays stably", async () => {
    const cases = await Promise.all(
      Array.from({ length: 6 }, async (_, index) => {
        const suffix = next(`AUTO-${index}`);
        return createReadyCase(autoDraft(suffix));
      }),
    );
    const responses = await Promise.all(
      cases.map((admissionCase) =>
        finalize(
          admissionCase.id,
          admissionCase.version,
          `auto-matricule-${admissionCase.id}`,
        ),
      ),
    );
    expect(
      responses.map((response) => ({
        status: response.status,
        code: response.body.code ?? null,
      })),
    ).toEqual(Array(6).fill({ status: 201, code: null }));
    const matricules = responses.map(
      (response) => response.body.studentMatricule,
    );
    expect(new Set(matricules).size).toBe(6);
    expect(matricules.every((value) => /^GST-2026-\d{6}$/.test(value))).toBe(
      true,
    );
    expect(
      await context.prisma.student.count({
        where: { tenantId: TENANT_ID, matricule: { in: matricules } },
      }),
    ).toBe(6);

    const replay = await finalize(
      cases[0].id,
      cases[0].version,
      `auto-matricule-${cases[0].id}`,
    ).expect(201);
    expect(replay.body.studentMatricule).toBe(matricules[0]);
  });

  it("supports new and existing guardians while rejecting duplicate identities and matricules", async () => {
    const suffix = next("NEW-GUARDIAN");
    const newGuardianDraft: AdmissionDraftData = {
      ...autoDraft(suffix),
      GUARDIANS: {
        guardians: [
          {
            source: "EXISTING_GUARDIAN",
            parentId: baseline.businessParentId,
            relationType: "PERE",
            isPrimaryContact: true,
            legalGuardian: true,
          },
          {
            source: "NEW_GUARDIAN",
            parentalRole: "RESPONSABLE_LEGAL",
            firstName: `Guardian${suffix}`,
            lastName: "Family",
            primaryPhone: `+22375${String(sequence).padStart(6, "0")}`,
            relationType: "RESPONSABLE_LEGAL",
            isPrimaryContact: false,
            legalGuardian: true,
          },
        ],
      },
    };
    const admissionCase = await createReadyCase(newGuardianDraft);
    const created = await finalize(
      admissionCase.id,
      1,
      `new-guardian-${admissionCase.id}`,
    ).expect(201);
    expect(created.body.guardianIds).toHaveLength(2);
    expect(created.body.parentStudentLinkIds).toHaveLength(2);
    expect(
      await context.prisma.parentStudentLink.count({
        where: {
          tenantId: TENANT_ID,
          studentId: created.body.studentId,
          isPrimaryContact: true,
          archivedAt: null,
        },
      }),
    ).toBe(1);

    const manual = next("MANUAL").toUpperCase();
    await context.prisma.student.create({
      data: {
        tenantId: TENANT_ID,
        matricule: manual.toLowerCase(),
        firstName: "Existing",
        lastName: "Matricule",
        sex: "M",
      },
    });
    const conflictCase = await createReadyCase({
      ...autoDraft(next("CONFLICT")),
      STUDENT: {
        matriculeMode: "MANUAL",
        matricule: manual,
        firstName: "Different",
        lastName: "Student",
        sex: "M",
        birthDate: "2013-01-02",
      },
    });
    const conflict = await finalize(
      conflictCase.id,
      1,
      `matricule-conflict-${conflictCase.id}`,
    ).expect(409);
    expect(conflict.body.code).toBe("MATRICULE_CONFLICT");

    const duplicateGuardianDraft = autoDraft(next("DUP-GUARDIAN"));
    duplicateGuardianDraft.GUARDIANS = newGuardianDraft.GUARDIANS;
    const duplicateGuardianCase = await createReadyCase(duplicateGuardianDraft);
    const duplicateGuardian = await finalize(
      duplicateGuardianCase.id,
      1,
      `guardian-duplicate-${duplicateGuardianCase.id}`,
    ).expect(409);
    expect(duplicateGuardian.body.code).toBe("GUARDIAN_DUPLICATE_SUSPECTED");
  });

  it("enforces one primary guardian under concurrent PostgreSQL writes", async () => {
    const suffix = next("PRIMARY");
    const student = await context.prisma.student.create({
      data: {
        tenantId: TENANT_ID,
        matricule: `PRIMARY-${suffix}`,
        firstName: "Primary",
        lastName: suffix,
        sex: "F",
      },
    });
    const parents = await Promise.all(
      ["One", "Two"].map((name, index) =>
        context.prisma.parent.create({
          data: {
            tenantId: TENANT_ID,
            parentalRole: "TUTEUR",
            firstName: name,
            lastName: suffix,
            primaryPhone: `+22374${sequence}${index}0000`,
          },
        }),
      ),
    );
    const attempts = await Promise.allSettled(
      parents.map((parent) =>
        context.prisma.$transaction((transaction) =>
          parentsService.createLinkForAdmission(
            TENANT_ID,
            {
              parentId: parent.id,
              studentId: student.id,
              relationType: "TUTEUR",
              isPrimaryContact: true,
            },
            transaction,
          ),
        ),
      ),
    );
    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === "rejected"),
    ).toHaveLength(1);
    expect(
      await context.prisma.parentStudentLink.count({
        where: {
          tenantId: TENANT_ID,
          studentId: student.id,
          isPrimaryContact: true,
          archivedAt: null,
        },
      }),
    ).toBe(1);
  });

  it("re-enrollment reuses identity and relations without mutating either", async () => {
    const suffix = next("REENROLL-IDENTITY");
    const student = await context.prisma.student.create({
      data: {
        tenantId: TENANT_ID,
        matricule: `RE-${suffix}`,
        firstName: "Existing",
        lastName: suffix,
        sex: "M",
        birthDate: new Date("2013-02-04"),
      },
      select: { id: true, firstName: true, lastName: true, matricule: true },
    });
    await context.prisma.parentStudentLink.create({
      data: {
        tenantId: TENANT_ID,
        parentId: baseline.businessParentId,
        studentId: student.id,
        relationType: "PERE",
        isPrimaryContact: true,
        legalGuardian: true,
      },
    });
    const linkCount = await context.prisma.parentStudentLink.count({
      where: { tenantId: TENANT_ID, studentId: student.id },
    });
    const admissionCase = await context.prisma.admissionCase.create({
      data: {
        tenantId: TENANT_ID,
        mode: AdmissionCaseMode.RE_ENROLLMENT,
        status: AdmissionCaseStatus.READY,
        studentId: student.id,
        schoolYearId: baseline.schoolYearId,
        draftData: { ACADEMICS: academics() },
        createdByUserId: adminUserId,
        updatedByUserId: adminUserId,
      },
    });
    const response = await finalize(
      admissionCase.id,
      1,
      `reenrollment-i4-${admissionCase.id}`,
    ).expect(201);
    expect(response.body.studentId).toBe(student.id);
    expect(response.body.guardianIds).toEqual([]);
    await expect(
      context.prisma.student.findUniqueOrThrow({
        where: { id: student.id },
        select: { id: true, firstName: true, lastName: true, matricule: true },
      }),
    ).resolves.toEqual(student);
    expect(
      await context.prisma.parentStudentLink.count({
        where: { tenantId: TENANT_ID, studentId: student.id },
      }),
    ).toBe(linkCount);
  });

  it("reopens correctable FAILED cases but keeps technical failures on retry", async () => {
    const correctable = await context.prisma.admissionCase.create({
      data: {
        tenantId: TENANT_ID,
        mode: AdmissionCaseMode.NEW_ADMISSION,
        status: AdmissionCaseStatus.FAILED,
        draftData: autoDraft(next("REOPEN")) as Prisma.InputJsonObject,
        schoolYearId: baseline.schoolYearId,
        failedAt: new Date(),
        failureCode: "CLASS_NOT_AVAILABLE",
        failureMessage: "Admission finalization failed without partial writes.",
        createdByUserId: adminUserId,
        updatedByUserId: adminUserId,
      },
    });
    const reopened = await request(context.app.getHttpServer())
      .post(`/api/v1/admission-cases/${correctable.id}/reopen`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ expectedVersion: 1 })
      .expect(201);
    expect(reopened.body).toMatchObject({
      status: "READY",
      recoveryAction: null,
      failureCode: null,
      version: 2,
    });

    const technical = await context.prisma.admissionCase.create({
      data: {
        tenantId: TENANT_ID,
        mode: AdmissionCaseMode.NEW_ADMISSION,
        status: AdmissionCaseStatus.FAILED,
        draftData: autoDraft(next("RETRY")) as Prisma.InputJsonObject,
        schoolYearId: baseline.schoolYearId,
        failedAt: new Date(),
        failureCode: "ADMISSION_FINALIZATION_FAILED",
        failureMessage: "Admission finalization failed without partial writes.",
        createdByUserId: adminUserId,
        updatedByUserId: adminUserId,
      },
    });
    const retryOnly = await request(context.app.getHttpServer())
      .post(`/api/v1/admission-cases/${technical.id}/reopen`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ expectedVersion: 1 })
      .expect(409);
    expect(retryOnly.body.code).toBe("ADMISSION_RETRY_REQUIRED");
    const read = await request(context.app.getHttpServer())
      .get(`/api/v1/admission-cases/${technical.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(read.body.recoveryAction).toBe("RETRY");
  });
});
