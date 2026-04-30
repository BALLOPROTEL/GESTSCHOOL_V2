import * as request from "supertest";

import {
  cleanDatabase,
  closeE2eApp,
  configureE2eEnvironment,
  createE2eApp,
  ensureCanonicalTimetableResources,
  flushBackgroundTasks,
  login,
  provisionAcademicBaseline,
  seedUsers,
  TENANT_ID,
  type AcademicBaseline,
  type E2eAppContext
} from "./support/e2e-harness";

configureE2eEnvironment();
jest.setTimeout(120_000);

describe("School life + portal flows (e2e)", () => {
  let context: E2eAppContext;
  let baseline: AcademicBaseline;
  let canonicalTeacherAssignmentId: string;
  let canonicalRoomId: string;
  let linkedRoomId: string;
  let linkedTimetableSlotId: string;
  let teacherAssignmentId: string;

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

    const canonicalResources = await ensureCanonicalTimetableResources(context.prisma, {
      schoolYearId: baseline.schoolYearId,
      classId: baseline.classId,
      subjectId: baseline.subjectId
    });
    canonicalTeacherAssignmentId = canonicalResources.teacherAssignmentId;
    canonicalRoomId = canonicalResources.roomId;
  });

  afterAll(async () => {
    await closeE2eApp(context);
  });

  it("should manage attendance, timetable conflicts and notification dispatch", async () => {
    const scolariteTokens = await login(context.app, "scolarite@gestschool.local", "scolarite123");

    const attendance = await request(context.app.getHttpServer())
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .send({
        studentId: baseline.studentOneId,
        classId: baseline.classId,
        attendanceDate: "2026-09-10",
        status: "ABSENT",
        reason: "Sick"
      })
      .expect(201);

    expect(attendance.body.schoolYearId).toBe(baseline.schoolYearId);

    const updatedAttendance = await request(context.app.getHttpServer())
      .patch(`/api/v1/attendance/${attendance.body.id}`)
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .send({ status: "EXCUSED" })
      .expect(200);

    expect(updatedAttendance.body.status).toBe("EXCUSED");

    const bulkAttendance = await request(context.app.getHttpServer())
      .post("/api/v1/attendance/bulk")
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .send({
        classId: baseline.classId,
        attendanceDate: "2026-09-11",
        defaultStatus: "ABSENT",
        entries: [
          { studentId: baseline.studentOneId },
          { studentId: baseline.studentTwoId }
        ]
      })
      .expect(201);

    expect(bulkAttendance.body.createdCount).toBe(2);
    expect(bulkAttendance.body.errorCount).toBe(0);

    const summary = await request(context.app.getHttpServer())
      .get("/api/v1/attendance/summary")
      .query({ classId: baseline.classId, fromDate: "2026-09-01", toDate: "2026-09-30" })
      .set("Authorization", `Bearer ${scolariteTokens.accessToken}`)
      .expect(200);

    expect(summary.body.total).toBeGreaterThanOrEqual(2);
    expect(summary.body.byStatus.ABSENT).toBeGreaterThanOrEqual(2);

    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");

    const timetableSlot = await request(context.app.getHttpServer())
      .post("/api/v1/timetable-slots")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        classId: baseline.classId,
        subjectId: baseline.subjectId,
        track: "FRANCOPHONE",
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "09:00",
        roomId: canonicalRoomId,
        teacherAssignmentId: canonicalTeacherAssignmentId
      })
      .expect(201);

    expect(timetableSlot.body.schoolYearId).toBe(baseline.schoolYearId);

    await request(context.app.getHttpServer())
      .post("/api/v1/timetable-slots")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        classId: baseline.classId,
        subjectId: baseline.subjectId,
        track: "FRANCOPHONE",
        dayOfWeek: 1,
        startTime: "08:30",
        endTime: "09:30",
        roomId: canonicalRoomId,
        teacherAssignmentId: canonicalTeacherAssignmentId
      })
      .expect(409);

    const pendingOutboxEvents = await context.prisma.outboxEvent.findMany({
      where: {
        tenantId: TENANT_ID,
        eventType: "notification.requested",
        dedupeKey: {
          contains: "notification-request:school-life:attendance:"
        },
        status: "PENDING"
      }
    });
    expect(pendingOutboxEvents.length).toBeGreaterThanOrEqual(2);

    const beforeProcessing = await request(context.app.getHttpServer())
      .get("/api/v1/notifications")
      .query({ studentId: baseline.studentOneId, audienceRole: "PARENT" })
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    expect(
      beforeProcessing.body.some((item: { title: string }) => item.title.includes("Alerte"))
    ).toBe(false);

    const flushed = await flushBackgroundTasks(context.backgroundTasks);
    expect(flushed.notificationRequests.processedCount).toBeGreaterThanOrEqual(2);

    const autoNotifications = await request(context.app.getHttpServer())
      .get("/api/v1/notifications")
      .query({ studentId: baseline.studentOneId, audienceRole: "PARENT" })
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    expect(
      autoNotifications.body.some((item: { title: string }) => item.title.includes("Alerte"))
    ).toBe(true);

    const scheduledNotification = await request(context.app.getHttpServer())
      .post("/api/v1/notifications")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        title: "Rappel planning",
        message: "Notification planifiee a envoyer.",
        audienceRole: "PARENT",
        channel: "IN_APP",
        scheduledAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      })
      .expect(201);

    expect(scheduledNotification.body.status).toBe("SCHEDULED");

    const dispatch = await request(context.app.getHttpServer())
      .post("/api/v1/notifications/dispatch-pending")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({ limit: 20 })
      .expect(201);

    expect(dispatch.body.dispatchedCount).toBeGreaterThanOrEqual(1);
  });

  it("should enforce teacher and parent portal scoping with fine-grained permissions", async () => {
    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");
    const comptableTokens = await login(context.app, "comptable@gestschool.local", "comptable123");

    const teacherUser = await context.prisma.user.findFirst({
      where: {
        tenantId: TENANT_ID,
        username: "enseignant@gestschool.local",
        deletedAt: null
      }
    });
    const parentUser = await context.prisma.user.findFirst({
      where: {
        tenantId: TENANT_ID,
        username: "parent@gestschool.local",
        deletedAt: null
      }
    });

    expect(teacherUser?.id).toBeDefined();
    expect(parentUser?.id).toBeDefined();

    const portalTeacher = await context.prisma.teacher.create({
      data: {
        tenantId: TENANT_ID,
        matricule: "ENS-PORTAL-001",
        firstName: "Portail",
        lastName: "Enseignant",
        email: "portail.enseignant@gestschool.local",
        teacherType: "TITULAIRE",
        status: "ACTIVE",
        userId: teacherUser!.id
      }
    });

    await context.prisma.teacherSkill.create({
      data: {
        tenantId: TENANT_ID,
        teacherId: portalTeacher.id,
        subjectId: baseline.subjectId,
        track: "FRANCOPHONE",
        status: "ACTIVE"
      }
    });

    const teacherAssignment = await request(context.app.getHttpServer())
      .post("/api/v1/teachers/assignments")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        teacherId: portalTeacher.id,
        classId: baseline.classId,
        schoolYearId: baseline.schoolYearId,
        subjectId: baseline.subjectId,
        track: "FRANCOPHONE",
        startDate: "2026-09-01",
        status: "ACTIVE"
      })
      .expect(201);
    teacherAssignmentId = teacherAssignment.body.id;

    const roomType = await request(context.app.getHttpServer())
      .post("/api/v1/rooms/types")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        code: "CLASSROOM-P1",
        name: "Salle pedagogique P1",
        status: "ACTIVE"
      })
      .expect(201);

    const room = await request(context.app.getHttpServer())
      .post("/api/v1/rooms")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        code: "P1-101",
        name: "Salle P1 101",
        roomTypeId: roomType.body.id,
        capacity: 32,
        status: "ACTIVE",
        isSharedBetweenCurricula: true
      })
      .expect(201);
    linkedRoomId = room.body.id;

    const linkedSlot = await request(context.app.getHttpServer())
      .post("/api/v1/timetable-slots")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        classId: baseline.classId,
        subjectId: baseline.subjectId,
        track: "FRANCOPHONE",
        dayOfWeek: 3,
        startTime: "10:00",
        endTime: "11:00",
        roomId: linkedRoomId,
        teacherAssignmentId
      })
      .expect(201);
    linkedTimetableSlotId = linkedSlot.body.id;

    const portalParent = await context.prisma.parent.create({
      data: {
        tenantId: TENANT_ID,
        parentalRole: "PERE",
        firstName: "Portail",
        lastName: "Parent",
        primaryPhone: "+22370000001",
        email: "portail.parent@gestschool.local",
        status: "ACTIVE",
        userId: parentUser!.id
      }
    });

    await request(context.app.getHttpServer())
      .post("/api/v1/parents/links")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        parentId: portalParent.id,
        studentId: baseline.studentOneId,
        relationType: "PERE",
        isPrimaryContact: true,
        legalGuardian: true,
        emergencyContact: true
      })
      .expect(201);

    const feePlan = await request(context.app.getHttpServer())
      .post("/api/v1/fee-plans")
      .set("Authorization", `Bearer ${comptableTokens.accessToken}`)
      .send({
        schoolYearId: baseline.schoolYearId,
        levelId: baseline.levelId,
        label: "Frais parent portail",
        totalAmount: 150000,
        currency: "CFA"
      })
      .expect(201);

    await request(context.app.getHttpServer())
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${comptableTokens.accessToken}`)
      .send({
        studentId: baseline.studentOneId,
        schoolYearId: baseline.schoolYearId,
        feePlanId: feePlan.body.id,
        dueDate: "2026-11-15"
      })
      .expect(201);

    const teacherTokens = await login(context.app, "enseignant@gestschool.local", "teacher1234");

    const teacherClasses = await request(context.app.getHttpServer())
      .get("/api/v1/portal/teacher/classes")
      .set("Authorization", `Bearer ${teacherTokens.accessToken}`)
      .expect(200);

    expect(teacherClasses.body.some((item: { classId: string }) => item.classId === baseline.classId)).toBe(true);

    const teacherTimetable = await request(context.app.getHttpServer())
      .get("/api/v1/portal/teacher/timetable")
      .query({ classId: baseline.classId, dayOfWeek: 3 })
      .set("Authorization", `Bearer ${teacherTokens.accessToken}`)
      .expect(200);

    expect(
      teacherTimetable.body.some(
        (item: { id: string; roomId?: string; teacherAssignmentId?: string }) =>
          item.id === linkedTimetableSlotId &&
          item.roomId === linkedRoomId &&
          item.teacherAssignmentId === teacherAssignmentId
      )
    ).toBe(true);

    await request(context.app.getHttpServer())
      .post("/api/v1/portal/teacher/grades")
      .set("Authorization", `Bearer ${teacherTokens.accessToken}`)
      .send({
        studentId: baseline.studentOneId,
        classId: baseline.classId,
        subjectId: baseline.subjectId,
        academicPeriodId: baseline.academicPeriodId,
        assessmentLabel: "Interro portail",
        assessmentType: "DEVOIR",
        score: 14,
        scoreMax: 20
      })
      .expect(201);

    const extraClass = await request(context.app.getHttpServer())
      .post("/api/v1/classes")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        schoolYearId: baseline.schoolYearId,
        levelId: baseline.levelId,
        track: "FRANCOPHONE",
        code: "CP1-B",
        label: "CP1 B",
        capacity: 30,
        status: "ACTIVE"
      })
      .expect(201);

    await request(context.app.getHttpServer())
      .get("/api/v1/portal/teacher/students")
      .query({ classId: extraClass.body.id })
      .set("Authorization", `Bearer ${teacherTokens.accessToken}`)
      .expect(403);

    const parentTokens = await login(context.app, "parent@gestschool.local", "parent1234");

    const children = await request(context.app.getHttpServer())
      .get("/api/v1/portal/parent/children")
      .set("Authorization", `Bearer ${parentTokens.accessToken}`)
      .expect(200);

    expect(children.body.some((item: { studentId: string }) => item.studentId === baseline.studentOneId)).toBe(true);

    await request(context.app.getHttpServer())
      .get("/api/v1/portal/parent/grades")
      .query({ studentId: baseline.studentOneId })
      .set("Authorization", `Bearer ${parentTokens.accessToken}`)
      .expect(200);

    await request(context.app.getHttpServer())
      .get("/api/v1/portal/parent/invoices")
      .query({ studentId: baseline.studentOneId })
      .set("Authorization", `Bearer ${parentTokens.accessToken}`)
      .expect(200);

    const parentTimetable = await request(context.app.getHttpServer())
      .get("/api/v1/portal/parent/timetable")
      .query({ studentId: baseline.studentOneId })
      .set("Authorization", `Bearer ${parentTokens.accessToken}`)
      .expect(200);

    expect(
      parentTimetable.body.some(
        (item: { slotId: string; roomId?: string; teacherAssignmentId?: string }) =>
          item.slotId === linkedTimetableSlotId &&
          item.roomId === linkedRoomId &&
          item.teacherAssignmentId === teacherAssignmentId
      )
    ).toBe(true);

    await request(context.app.getHttpServer())
      .get("/api/v1/portal/parent/grades")
      .query({ studentId: baseline.studentTwoId })
      .set("Authorization", `Bearer ${parentTokens.accessToken}`)
      .expect(403);
  });
});
