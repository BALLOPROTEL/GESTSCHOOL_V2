import { AdmissionCaseMode } from "@prisma/client";
import * as request from "supertest";

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

describe("Admission academic placement policy (e2e)", () => {
  let context: E2eAppContext;
  let adminToken: string;
  let scolariteToken: string;
  let baseline: AcademicBaseline;

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
    baseline = await provisionAcademicBaseline(
      context.app,
      adminToken,
      scolariteToken,
    );
  });

  afterAll(async () => closeE2eApp(context));

  const options = (query = "") =>
    request(context.app.getHttpServer())
      .get(`/api/v1/admission-cases/academic-options${query}`)
      .set("Authorization", `Bearer ${adminToken}`);

  const createCase = async () =>
    request(context.app.getHttpServer())
      .post("/api/v1/admission-cases")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mode: AdmissionCaseMode.NEW_ADMISSION })
      .expect(201);

  const saveAcademics = (
    admissionCaseId: string,
    data: Record<string, unknown>,
  ) =>
    request(context.app.getHttpServer())
      .patch(`/api/v1/admission-cases/${admissionCaseId}/sections/ACADEMICS`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ expectedVersion: 1, data });

  const validSelection = () => ({
    schoolYearId: baseline.schoolYearId,
    cycleId: baseline.cycleId,
    track: "FRANCOPHONE",
    levelId: baseline.levelId,
    classId: baseline.classId,
  });

  it("exposes only progressive tenant-scoped choices with informational capacity", async () => {
    const initial = await options().expect(200);
    expect(initial.body).toMatchObject({
      contractVersion: "1",
      selectionPolicy: {
        schoolYear: "SINGLE_ACTIVE",
        classCapacity: "INFORMATIONAL",
        automaticClassSelection: false,
        automaticStudentSelection: false,
      },
      tracks: [],
      levels: [],
      classes: [],
    });
    expect(initial.body.schoolYears).toEqual([
      expect.objectContaining({ id: baseline.schoolYearId }),
    ]);

    const withYear = await options(
      `?schoolYearId=${baseline.schoolYearId}`,
    ).expect(200);
    expect(withYear.body.tracks).toEqual(["FRANCOPHONE"]);
    expect(withYear.body.levels).toEqual([]);
    expect(withYear.body.classes).toEqual([]);

    const withTrack = await options(
      `?schoolYearId=${baseline.schoolYearId}&track=FRANCOPHONE`,
    ).expect(200);
    expect(withTrack.body.levels).toEqual([
      expect.objectContaining({
        id: baseline.levelId,
        cycleId: baseline.cycleId,
      }),
    ]);
    expect(withTrack.body.classes).toEqual([]);

    const withLevel = await options(
      `?schoolYearId=${baseline.schoolYearId}&track=FRANCOPHONE&levelId=${baseline.levelId}&cycleId=${baseline.cycleId}`,
    ).expect(200);
    expect(withLevel.body.classes).toEqual([
      expect.objectContaining({
        id: baseline.classId,
        currentEnrollmentCount: 2,
        capacity: 30,
        placesRemaining: 28,
        capacityStatus: "AVAILABLE",
      }),
    ]);
  });

  it("rejects malformed or out-of-order option filters", async () => {
    await options("?schoolYearId=not-a-uuid").expect(400);
    const response = await options(`?levelId=${baseline.levelId}`).expect(400);
    expect(response.body).toMatchObject({
      code: "ACADEMIC_CONTEXT_INVALID",
    });
  });

  it("rejects another tenant and incompatible hierarchy without revealing it", async () => {
    const otherYear = await context.prisma.schoolYear.create({
      data: {
        tenantId: OTHER_TENANT_ID,
        code: "I5-OTHER-YEAR",
        label: "I5 other year",
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
        code: "I5-OTHER-CYCLE",
        label: "I5 other cycle",
        sortOrder: 1,
        status: "ACTIVE",
      },
    });
    const otherLevel = await context.prisma.level.create({
      data: {
        tenantId: OTHER_TENANT_ID,
        cycleId: otherCycle.id,
        code: "I5-OTHER-LEVEL",
        label: "I5 other level",
        track: "FRANCOPHONE",
        sortOrder: 1,
        status: "ACTIVE",
      },
    });
    const otherClass = await context.prisma.classroom.create({
      data: {
        tenantId: OTHER_TENANT_ID,
        schoolYearId: otherYear.id,
        levelId: otherLevel.id,
        code: "I5-OTHER-CLASS",
        label: "I5 other class",
        track: "FRANCOPHONE",
        status: "ACTIVE",
      },
    });

    const hiddenYear = await options(`?schoolYearId=${otherYear.id}`).expect(
      400,
    );
    expect(hiddenYear.body).toMatchObject({
      code: "SCHOOL_YEAR_NOT_AVAILABLE",
    });

    const admissionCase = await createCase();
    const hiddenClass = await saveAcademics(admissionCase.body.id, {
      ...validSelection(),
      classId: otherClass.id,
    }).expect(400);
    expect(hiddenClass.body).toMatchObject({ code: "CLASS_NOT_AVAILABLE" });
  });

  it("rejects incompatible, inactive and unavailable academic references on PATCH", async () => {
    const secondLevel = await context.prisma.level.create({
      data: {
        tenantId: TENANT_ID,
        cycleId: baseline.cycleId,
        code: "I5-SECOND-LEVEL",
        label: "I5 second level",
        track: "FRANCOPHONE",
        sortOrder: 2,
        status: "ACTIVE",
      },
    });
    const secondClass = await context.prisma.classroom.create({
      data: {
        tenantId: TENANT_ID,
        schoolYearId: baseline.schoolYearId,
        levelId: secondLevel.id,
        code: "I5-SECOND-CLASS",
        label: "I5 second class",
        track: "FRANCOPHONE",
        status: "ACTIVE",
      },
    });
    const admissionCase = await createCase();

    const incompatibleClass = await saveAcademics(admissionCase.body.id, {
      ...validSelection(),
      classId: secondClass.id,
    }).expect(400);
    expect(incompatibleClass.body).toMatchObject({
      code: "CLASS_NOT_AVAILABLE",
    });

    await context.prisma.level.update({
      where: { id: baseline.levelId },
      data: { status: "INACTIVE" },
    });
    const inactiveLevel = await saveAcademics(
      admissionCase.body.id,
      validSelection(),
    ).expect(400);
    expect(inactiveLevel.body).toMatchObject({ code: "LEVEL_NOT_AVAILABLE" });
    await context.prisma.level.update({
      where: { id: baseline.levelId },
      data: { status: "ACTIVE" },
    });

    await context.prisma.classroom.update({
      where: { id: baseline.classId },
      data: { status: "INACTIVE" },
    });
    const inactiveClass = await saveAcademics(
      admissionCase.body.id,
      validSelection(),
    ).expect(400);
    expect(inactiveClass.body).toMatchObject({ code: "CLASS_NOT_AVAILABLE" });
    await context.prisma.classroom.update({
      where: { id: baseline.classId },
      data: { status: "ACTIVE" },
    });

    await context.prisma.schoolYear.update({
      where: { id: baseline.schoolYearId },
      data: { status: "CLOSED", isActive: false },
    });
    const closedYear = await saveAcademics(
      admissionCase.body.id,
      validSelection(),
    ).expect(400);
    expect(closedYear.body).toMatchObject({
      code: "SCHOOL_YEAR_NOT_AVAILABLE",
    });
    await context.prisma.schoolYear.update({
      where: { id: baseline.schoolYearId },
      data: { status: "ACTIVE", isActive: true },
    });
  });

  it("keeps a full class selectable because capacity is informational", async () => {
    await context.prisma.classroom.update({
      where: { id: baseline.classId },
      data: { capacity: 2 },
    });
    const response = await options(
      `?schoolYearId=${baseline.schoolYearId}&track=FRANCOPHONE&levelId=${baseline.levelId}&cycleId=${baseline.cycleId}`,
    ).expect(200);
    expect(response.body.classes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: baseline.classId,
          currentEnrollmentCount: 2,
          placesRemaining: 0,
          capacityStatus: "FULL",
        }),
      ]),
    );
    await context.prisma.classroom.update({
      where: { id: baseline.classId },
      data: { capacity: 30 },
    });
  });
});
