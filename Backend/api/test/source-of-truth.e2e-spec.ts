import * as request from "supertest";

import {
  cleanDatabase,
  closeE2eApp,
  configureE2eEnvironment,
  createE2eApp,
  ensureCanonicalTimetableResources,
  login,
  provisionAcademicBaseline,
  seedUsers,
  TENANT_ID,
  type AcademicBaseline,
  type E2eAppContext
} from "./support/e2e-harness";

configureE2eEnvironment();
jest.setTimeout(120_000);

describe("Source-of-truth guardrails (e2e)", () => {
  let context: E2eAppContext;
  let baseline: AcademicBaseline;
  let adminAccessToken: string;
  let scolariteAccessToken: string;

  beforeAll(async () => {
    context = await createE2eApp();
    await cleanDatabase(context.prisma);
    await seedUsers(context.prisma);

    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");
    const scolariteTokens = await login(context.app, "scolarite@gestschool.local", "scolarite123");
    adminAccessToken = adminTokens.accessToken;
    scolariteAccessToken = scolariteTokens.accessToken;
    baseline = await provisionAcademicBaseline(context.app, adminAccessToken, scolariteAccessToken);
  });

  afterAll(async () => {
    await closeE2eApp(context);
  });

  it("keeps StudentTrackPlacement canonical while Enrollment remains a compatibility mirror", async () => {
    const initialPlacements = await request(context.app.getHttpServer())
      .get("/api/v1/enrollments/placements")
      .query({ studentId: baseline.studentOneId, schoolYearId: baseline.schoolYearId })
      .set("Authorization", `Bearer ${scolariteAccessToken}`)
      .expect(200);

    const initialPlacement = initialPlacements.body.find(
      (item: { track: string }) => item.track === "FRANCOPHONE"
    );
    expect(initialPlacement).toMatchObject({
      studentId: baseline.studentOneId,
      schoolYearId: baseline.schoolYearId,
      classId: baseline.classId,
      legacyEnrollmentId: baseline.enrollmentOneId,
      track: "FRANCOPHONE"
    });

    const initialEnrollments = await request(context.app.getHttpServer())
      .get("/api/v1/enrollments")
      .query({ studentId: baseline.studentOneId, schoolYearId: baseline.schoolYearId })
      .set("Authorization", `Bearer ${scolariteAccessToken}`)
      .expect(200);

    expect(initialEnrollments.body).toHaveLength(1);
    expect(initialEnrollments.body[0].placementId).toBe(initialPlacement.id);

    const arabophoneLevel = await request(context.app.getHttpServer())
      .post("/api/v1/levels")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        cycleId: baseline.cycleId,
        code: "AR-CP1",
        label: "CP1 Arabophone",
        track: "ARABOPHONE",
        sortOrder: 2,
        status: "ACTIVE"
      })
      .expect(201);

    const arabophoneClass = await request(context.app.getHttpServer())
      .post("/api/v1/classes")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        schoolYearId: baseline.schoolYearId,
        levelId: arabophoneLevel.body.id,
        track: "ARABOPHONE",
        code: "AR-CP1-A",
        label: "CP1 Arabophone A",
        capacity: 30,
        status: "ACTIVE"
      })
      .expect(201);

    const arabophonePlacement = await request(context.app.getHttpServer())
      .post("/api/v1/enrollments/placements")
      .set("Authorization", `Bearer ${scolariteAccessToken}`)
      .send({
        studentId: baseline.studentOneId,
        schoolYearId: baseline.schoolYearId,
        track: "ARABOPHONE",
        levelId: arabophoneLevel.body.id,
        classId: arabophoneClass.body.id,
        placementStatus: "ACTIVE",
        startDate: "2026-09-07"
      })
      .expect(201);

    expect(arabophonePlacement.body).toMatchObject({
      studentId: baseline.studentOneId,
      schoolYearId: baseline.schoolYearId,
      classId: arabophoneClass.body.id,
      track: "ARABOPHONE"
    });
    expect(arabophonePlacement.body.legacyEnrollmentId).toBeDefined();

    const allPlacements = await request(context.app.getHttpServer())
      .get("/api/v1/enrollments/placements")
      .query({ studentId: baseline.studentOneId, schoolYearId: baseline.schoolYearId })
      .set("Authorization", `Bearer ${scolariteAccessToken}`)
      .expect(200);

    expect(allPlacements.body.map((item: { track: string }) => item.track).sort()).toEqual([
      "ARABOPHONE",
      "FRANCOPHONE"
    ]);
    expect(allPlacements.body.filter((item: { isPrimary: boolean }) => item.isPrimary)).toHaveLength(1);

    const arabophoneEnrollments = await request(context.app.getHttpServer())
      .get("/api/v1/enrollments")
      .query({
        studentId: baseline.studentOneId,
        schoolYearId: baseline.schoolYearId,
        track: "ARABOPHONE"
      })
      .set("Authorization", `Bearer ${scolariteAccessToken}`)
      .expect(200);

    expect(arabophoneEnrollments.body).toHaveLength(1);
    expect(arabophoneEnrollments.body[0].placementId).toBe(arabophonePlacement.body.id);
  });

  it("writes grades, report cards and attendance against StudentTrackPlacement", async () => {
    const placements = await request(context.app.getHttpServer())
      .get("/api/v1/enrollments/placements")
      .query({ studentId: baseline.studentTwoId, schoolYearId: baseline.schoolYearId })
      .set("Authorization", `Bearer ${scolariteAccessToken}`)
      .expect(200);

    const placement = placements.body.find(
      (item: { track: string }) => item.track === "FRANCOPHONE"
    );
    expect(placement).toBeDefined();

    const grade = await request(context.app.getHttpServer())
      .post("/api/v1/grades")
      .set("Authorization", `Bearer ${scolariteAccessToken}`)
      .send({
        studentId: baseline.studentTwoId,
        classId: baseline.classId,
        placementId: placement.id,
        subjectId: baseline.subjectId,
        academicPeriodId: baseline.academicPeriodId,
        assessmentLabel: "Placement guard",
        assessmentType: "DEVOIR",
        score: 15,
        scoreMax: 20
      })
      .expect(201);

    expect(grade.body.placementId).toBe(placement.id);

    const updatedGrade = await request(context.app.getHttpServer())
      .post("/api/v1/grades")
      .set("Authorization", `Bearer ${scolariteAccessToken}`)
      .send({
        studentId: baseline.studentTwoId,
        classId: baseline.classId,
        placementId: placement.id,
        subjectId: baseline.subjectId,
        academicPeriodId: baseline.academicPeriodId,
        assessmentLabel: "Placement guard",
        assessmentType: "DEVOIR",
        score: 16,
        scoreMax: 20
      })
      .expect(201);

    expect(updatedGrade.body.id).toBe(grade.body.id);

    const persistedGrades = await context.prisma.gradeEntry.findMany({
      where: {
        tenantId: TENANT_ID,
        placementId: placement.id,
        subjectId: baseline.subjectId,
        academicPeriodId: baseline.academicPeriodId,
        assessmentLabel: "Placement guard"
      }
    });
    expect(persistedGrades).toHaveLength(1);
    expect(persistedGrades[0].classId).toBe(baseline.classId);

    const reportCard = await request(context.app.getHttpServer())
      .post("/api/v1/report-cards/generate")
      .set("Authorization", `Bearer ${scolariteAccessToken}`)
      .send({
        studentId: baseline.studentTwoId,
        classId: baseline.classId,
        placementId: placement.id,
        academicPeriodId: baseline.academicPeriodId,
        publish: true
      })
      .expect(201);

    expect(reportCard.body.placementId).toBe(placement.id);

    const persistedReportCards = await context.prisma.reportCard.findMany({
      where: {
        tenantId: TENANT_ID,
        placementId: placement.id,
        academicPeriodId: baseline.academicPeriodId
      }
    });
    expect(persistedReportCards).toHaveLength(1);

    const attendance = await request(context.app.getHttpServer())
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${scolariteAccessToken}`)
      .send({
        studentId: baseline.studentTwoId,
        classId: baseline.classId,
        placementId: placement.id,
        attendanceDate: "2026-09-15",
        status: "ABSENT",
        reason: "Placement guard"
      })
      .expect(201);

    expect(attendance.body.placementId).toBe(placement.id);

    await request(context.app.getHttpServer())
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${scolariteAccessToken}`)
      .send({
        studentId: baseline.studentTwoId,
        classId: baseline.classId,
        placementId: placement.id,
        attendanceDate: "2026-09-15",
        status: "LATE"
      })
      .expect(409);

    const persistedAttendance = await context.prisma.attendance.findMany({
      where: {
        tenantId: TENANT_ID,
        placementId: placement.id,
        attendanceDate: new Date("2026-09-15")
      }
    });
    expect(persistedAttendance).toHaveLength(1);
  });

  it("uses Parent and ParentStudentLink as canonical portal scope while keeping parentUserId as bridge only", async () => {
    const parentUser = await context.prisma.user.findFirstOrThrow({
      where: {
        tenantId: TENANT_ID,
        username: "parent@gestschool.local",
        deletedAt: null
      }
    });

    const parentProfile = await request(context.app.getHttpServer())
      .post("/api/v1/parents")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        parentalRole: "MERE",
        firstName: "Portail",
        lastName: "Mere",
        primaryPhone: "+22370000002",
        email: "portail.mere@gestschool.local",
        userId: parentUser.id,
        status: "ACTIVE"
      })
      .expect(201);

    const link = await request(context.app.getHttpServer())
      .post("/api/v1/parents/links")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        parentId: parentProfile.body.id,
        studentId: baseline.studentOneId,
        relationType: "MERE",
        isPrimaryContact: true,
        legalGuardian: true,
        financialResponsible: true,
        emergencyContact: true
      })
      .expect(201);

    expect(link.body.parentId).toBe(parentProfile.body.id);
    expect(link.body.parentUserId).toBe(parentUser.id);

    const parentTokens = await login(context.app, "parent@gestschool.local", "parent1234");
    const children = await request(context.app.getHttpServer())
      .get("/api/v1/portal/parent/children")
      .set("Authorization", `Bearer ${parentTokens.accessToken}`)
      .expect(200);

    expect(children.body.some((item: { studentId: string }) => item.studentId === baseline.studentOneId)).toBe(true);
  });

  it("rejects legacy-only timetable slots when canonical source-of-truth guard is enabled", async () => {
    await request(context.app.getHttpServer())
      .post("/api/v1/timetable-slots")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        classId: baseline.classId,
        subjectId: baseline.subjectId,
        track: "FRANCOPHONE",
        dayOfWeek: 4,
        startTime: "08:00",
        endTime: "09:00",
        room: "Salle texte legacy",
        teacherName: "Nom enseignant legacy"
      })
      .expect(400);

    const canonicalResources = await ensureCanonicalTimetableResources(context.prisma, {
      schoolYearId: baseline.schoolYearId,
      classId: baseline.classId,
      subjectId: baseline.subjectId
    });

    const canonicalSlot = await request(context.app.getHttpServer())
      .post("/api/v1/timetable-slots")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .send({
        classId: baseline.classId,
        subjectId: baseline.subjectId,
        track: "FRANCOPHONE",
        dayOfWeek: 4,
        startTime: "08:00",
        endTime: "09:00",
        roomId: canonicalResources.roomId,
        teacherAssignmentId: canonicalResources.teacherAssignmentId
      })
      .expect(201);

    expect(canonicalSlot.body.roomId).toBe(canonicalResources.roomId);
    expect(canonicalSlot.body.teacherAssignmentId).toBe(canonicalResources.teacherAssignmentId);
  });
});
