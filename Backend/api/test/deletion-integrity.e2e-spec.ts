import { hash } from "bcryptjs";
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
  seedUsers
} from "./support/e2e-harness";

configureE2eEnvironment();

describe("Deletion referential integrity (e2e)", () => {
  let context: E2eAppContext;
  let adminToken: string;
  let scolariteToken: string;
  let baseline: AcademicBaseline;

  beforeAll(async () => {
    context = await createE2eApp();
    await seedUsers(context.prisma);
    adminToken = (await login(context.app, "admin@gestschool.local", "admin12345")).accessToken;
    scolariteToken = (await login(context.app, "scolarite@gestschool.local", "scolarite123")).accessToken;
    baseline = await provisionAcademicBaseline(context.app, adminToken, scolariteToken);
  });

  afterAll(async () => {
    await closeE2eApp(context);
  });

  it("deletes a user, cascades authentication tokens and detaches retained profiles", async () => {
    const user = await context.prisma.user.create({
      data: {
        tenantId: TENANT_ID,
        username: "delete-user@gestschool.local",
        email: "delete-user@gestschool.local",
        passwordHash: await hash("temporary-password", 10),
        role: "ENSEIGNANT",
        accountType: "TEACHER"
      }
    });
    const teacher = await context.prisma.teacher.create({
      data: {
        tenantId: TENANT_ID,
        matricule: "DELETE-USER-TEACHER",
        firstName: "Test",
        lastName: "Teacher",
        status: "ACTIVE",
        userId: user.id
      }
    });
    await context.prisma.refreshToken.create({
      data: {
        tenantId: TENANT_ID,
        userId: user.id,
        tokenHash: "delete-user-refresh-token",
        expiresAt: new Date("2099-01-01T00:00:00.000Z")
      }
    });
    await context.prisma.userSecurityToken.create({
      data: {
        tenantId: TENANT_ID,
        userId: user.id,
        type: "ACTIVATION",
        tokenHash: "delete-user-security-token",
        expiresAt: new Date("2099-01-01T00:00:00.000Z")
      }
    });

    await request(context.app.getHttpServer())
      .delete(`/api/v1/users/${user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(204);

    await expect(context.prisma.user.findUnique({ where: { id: user.id } })).resolves.toBeNull();
    await expect(context.prisma.refreshToken.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(context.prisma.userSecurityToken.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(context.prisma.teacher.findUnique({ where: { id: teacher.id } })).resolves.toMatchObject({
      userId: null
    });
  });

  it("deletes an unreferenced student and retains notifications without the student link", async () => {
    const student = await context.prisma.student.create({
      data: {
        tenantId: TENANT_ID,
        matricule: "DELETE-STUDENT-OK",
        firstName: "Test",
        lastName: "Student",
        sex: "F"
      }
    });
    const notification = await context.prisma.notification.create({
      data: {
        tenantId: TENANT_ID,
        studentId: student.id,
        title: "Deletion integrity test",
        message: "Technical test payload",
        idempotencyKey: "delete-student-notification"
      }
    });

    await request(context.app.getHttpServer())
      .delete(`/api/v1/students/${student.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(204);

    await expect(context.prisma.student.findUnique({ where: { id: student.id } })).resolves.toBeNull();
    await expect(
      context.prisma.notification.findUnique({ where: { id: notification.id } })
    ).resolves.toMatchObject({ studentId: null });
  });

  it("returns 409 and preserves a student that has family history", async () => {
    const student = await context.prisma.student.create({
      data: {
        tenantId: TENANT_ID,
        matricule: "DELETE-STUDENT-BLOCKED",
        firstName: "Blocked",
        lastName: "Student",
        sex: "M"
      }
    });
    const parent = await context.prisma.parent.create({
      data: {
        tenantId: TENANT_ID,
        firstName: "Test",
        lastName: "Parent",
        primaryPhone: "+000000000",
        status: "ACTIVE"
      }
    });
    const link = await context.prisma.parentStudentLink.create({
      data: {
        tenantId: TENANT_ID,
        parentId: parent.id,
        studentId: student.id,
        relationType: "OTHER"
      }
    });

    const response = await request(context.app.getHttpServer())
      .delete(`/api/v1/students/${student.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(409);

    expect(response.body).toMatchObject({ code: "ENTITY_DELETE_RESTRICTED" });
    await expect(context.prisma.student.findUnique({ where: { id: student.id } })).resolves.not.toBeNull();
    await expect(context.prisma.parentStudentLink.findUnique({ where: { id: link.id } })).resolves.not.toBeNull();
  });

  it("deletes an unreferenced teacher and its subordinate skills", async () => {
    const subject = await context.prisma.subject.create({
      data: {
        tenantId: TENANT_ID,
        code: "DELETE-TEACH-SUBJ",
        label: "Deletion test subject"
      }
    });
    const teacher = await context.prisma.teacher.create({
      data: {
        tenantId: TENANT_ID,
        matricule: "DELETE-TEACHER-OK",
        firstName: "Test",
        lastName: "Teacher",
        status: "ACTIVE"
      }
    });
    const skill = await context.prisma.teacherSkill.create({
      data: {
        tenantId: TENANT_ID,
        teacherId: teacher.id,
        subjectId: subject.id,
        track: "FRANCOPHONE"
      }
    });

    await request(context.app.getHttpServer())
      .delete(`/api/v1/teachers/${teacher.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(204);

    await expect(context.prisma.teacher.findUnique({ where: { id: teacher.id } })).resolves.toBeNull();
    await expect(context.prisma.teacherSkill.findUnique({ where: { id: skill.id } })).resolves.toBeNull();
  });

  it("returns 409 and preserves a teacher that owns a stored document", async () => {
    const teacher = await context.prisma.teacher.create({
      data: {
        tenantId: TENANT_ID,
        matricule: "DELETE-TEACHER-BLOCKED",
        firstName: "Blocked",
        lastName: "Teacher",
        status: "ACTIVE"
      }
    });
    const document = await context.prisma.teacherDocument.create({
      data: {
        tenantId: TENANT_ID,
        teacherId: teacher.id,
        documentType: "OTHER",
        fileUrl: "private://deletion-test-document",
        originalName: "deletion-test.pdf"
      }
    });

    const response = await request(context.app.getHttpServer())
      .delete(`/api/v1/teachers/${teacher.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(409);

    expect(response.body).toMatchObject({ code: "ENTITY_DELETE_RESTRICTED" });
    await expect(context.prisma.teacher.findUnique({ where: { id: teacher.id } })).resolves.not.toBeNull();
    await expect(context.prisma.teacherDocument.findUnique({ where: { id: document.id } })).resolves.not.toBeNull();
  });

  it("deletes an unreferenced parent and rejects a parent with family links", async () => {
    const deletableParent = await context.prisma.parent.create({
      data: {
        tenantId: TENANT_ID,
        firstName: "Deletable",
        lastName: "Parent",
        primaryPhone: "+000000001",
        status: "ACTIVE"
      }
    });
    await request(context.app.getHttpServer())
      .delete(`/api/v1/parents/${deletableParent.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(204);
    await expect(
      context.prisma.parent.findUnique({ where: { id: deletableParent.id } })
    ).resolves.toBeNull();

    const linkedParent = await context.prisma.parent.create({
      data: {
        tenantId: TENANT_ID,
        firstName: "Linked",
        lastName: "Parent",
        primaryPhone: "+000000002",
        status: "ACTIVE"
      }
    });
    const student = await context.prisma.student.create({
      data: {
        tenantId: TENANT_ID,
        matricule: "DELETE-PARENT-STUDENT",
        firstName: "Test",
        lastName: "Student",
        sex: "F"
      }
    });
    await context.prisma.parentStudentLink.create({
      data: {
        tenantId: TENANT_ID,
        parentId: linkedParent.id,
        studentId: student.id,
        relationType: "OTHER"
      }
    });

    const response = await request(context.app.getHttpServer())
      .delete(`/api/v1/parents/${linkedParent.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(409);
    expect(response.body).toMatchObject({ code: "ENTITY_DELETE_RESTRICTED" });
    await expect(
      context.prisma.parent.findUnique({ where: { id: linkedParent.id } })
    ).resolves.not.toBeNull();
  });

  it("deletes a placement and its legacy enrollment while detaching retained grades", async () => {
    const placement = await context.prisma.studentTrackPlacement.findFirst({
      where: {
        tenantId: TENANT_ID,
        studentId: baseline.studentOneId,
        schoolYearId: baseline.schoolYearId
      },
      select: { id: true, legacyEnrollmentId: true }
    });
    if (!placement?.legacyEnrollmentId) throw new Error("Expected baseline placement and enrollment.");

    const grade = await request(context.app.getHttpServer())
      .post("/api/v1/grades")
      .set("Authorization", `Bearer ${scolariteToken}`)
      .send({
        studentId: baseline.studentOneId,
        classId: baseline.classId,
        subjectId: baseline.subjectId,
        academicPeriodId: baseline.academicPeriodId,
        assessmentLabel: "Placement deletion grade",
        score: 14,
        scoreMax: 20,
        coefficient: 1
      })
      .expect(201);

    await request(context.app.getHttpServer())
      .delete(`/api/v1/enrollments/placements/${placement.id}`)
      .set("Authorization", `Bearer ${scolariteToken}`)
      .expect(200);

    await expect(context.prisma.studentTrackPlacement.findUnique({ where: { id: placement.id } })).resolves.toBeNull();
    await expect(context.prisma.enrollment.findUnique({ where: { id: placement.legacyEnrollmentId } })).resolves.toBeNull();
    await expect(context.prisma.gradeEntry.findUnique({ where: { id: grade.body.id } })).resolves.toMatchObject({
      placementId: null
    });
  });

  it("deletes a grade and removes its now-obsolete report card in one workflow", async () => {
    const grade = await request(context.app.getHttpServer())
      .post("/api/v1/grades")
      .set("Authorization", `Bearer ${scolariteToken}`)
      .send({
        studentId: baseline.studentTwoId,
        classId: baseline.classId,
        subjectId: baseline.subjectId,
        academicPeriodId: baseline.academicPeriodId,
        assessmentLabel: "Grade deletion report card",
        score: 17,
        scoreMax: 20,
        coefficient: 1
      })
      .expect(201);

    const report = await request(context.app.getHttpServer())
      .post("/api/v1/report-cards/generate")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        studentId: baseline.studentTwoId,
        classId: baseline.classId,
        academicPeriodId: baseline.academicPeriodId,
        publish: true
      })
      .expect(201);

    await request(context.app.getHttpServer())
      .delete(`/api/v1/grades/${grade.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    await expect(context.prisma.gradeEntry.findUnique({ where: { id: grade.body.id } })).resolves.toBeNull();
    await expect(context.prisma.reportCard.findUnique({ where: { id: report.body.id } })).resolves.toBeNull();
  });

  it("returns a stable 409 and retains attendance with a justification attachment", async () => {
    const attendance = await request(context.app.getHttpServer())
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${scolariteToken}`)
      .send({
        studentId: baseline.studentTwoId,
        classId: baseline.classId,
        attendanceDate: "2026-09-15",
        status: "ABSENT",
        reason: "Deletion audit justification"
      })
      .expect(201);

    const attachment = await context.prisma.attendanceAttachment.create({
      data: {
        tenantId: TENANT_ID,
        attendanceId: attendance.body.id,
        fileName: "deletion-audit-justification.pdf",
        fileUrl: "private://deletion-audit-justification",
        mimeType: "application/pdf",
        size: 1
      }
    });

    const response = await request(context.app.getHttpServer())
      .delete(`/api/v1/attendance/${attendance.body.id}`)
      .set("Authorization", `Bearer ${scolariteToken}`)
      .expect(409);

    expect(response.body).toMatchObject({ code: "ENTITY_DELETE_RESTRICTED" });
    await expect(context.prisma.attendance.findUnique({ where: { id: attendance.body.id } })).resolves.not.toBeNull();
    await expect(context.prisma.attendanceAttachment.findUnique({ where: { id: attachment.id } })).resolves.not.toBeNull();
  });

  it("keeps archive operations explicit and does not report a physical deletion", async () => {
    const student = await context.prisma.student.create({
      data: {
        tenantId: TENANT_ID,
        matricule: "ARCHIVE-STUDENT",
        firstName: "Archive",
        lastName: "Student",
        sex: "M"
      }
    });

    await request(context.app.getHttpServer())
      .post(`/api/v1/students/${student.id}/archive`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(204);

    await expect(context.prisma.student.findUnique({ where: { id: student.id } })).resolves.toMatchObject({
      status: "ARCHIVED",
      deletedAt: expect.any(Date)
    });
  });
});
