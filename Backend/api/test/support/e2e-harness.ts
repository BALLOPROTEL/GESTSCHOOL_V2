import { type INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { hash } from "bcryptjs";
import * as request from "supertest";

import { AppModule } from "../../src/app.module";
import { BackgroundTasksService } from "../../src/background/background-tasks.service";
import { PrismaService } from "../../src/database/prisma.service";
import { UserRole } from "../../src/security/roles.enum";

export const TENANT_ID = "00000000-0000-0000-0000-000000000001";

export type E2eAppContext = {
  app: INestApplication;
  backgroundTasks: BackgroundTasksService;
  jwtService: JwtService;
  prisma: PrismaService;
};

export type AcademicBaseline = {
  studentOneId: string;
  studentTwoId: string;
  businessParentId: string;
  businessParentLinkId: string;
  schoolYearId: string;
  cycleId: string;
  levelId: string;
  classId: string;
  subjectId: string;
  academicPeriodId: string;
  enrollmentOneId: string;
  enrollmentTwoId: string;
};

export function configureE2eEnvironment(): void {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL is required for backend e2e tests.");
  }

  if (!looksLikeDedicatedTestDatabase(testDatabaseUrl)) {
    throw new Error(
      "TEST_DATABASE_URL must point to a dedicated disposable test database whose name or host contains test, e2e or jest."
    );
  }

  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.DIRECT_URL = process.env.TEST_DIRECT_URL?.trim() || testDatabaseUrl;
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
  process.env.JWT_ISSUER = process.env.JWT_ISSUER || "gestschool-test";
  process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE || "gestschool-test-clients";
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
  process.env.REFRESH_TOKEN_TTL_DAYS = process.env.REFRESH_TOKEN_TTL_DAYS || "30";
  process.env.DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || TENANT_ID;
  process.env.REDIS_URL = "";
  process.env.NOTIFICATIONS_WORKER_ENABLED = "false";
  process.env.NOTIFY_EMAIL_PROVIDER = process.env.NOTIFY_EMAIL_PROVIDER || "MOCK";
  process.env.NOTIFY_SMS_PROVIDER = process.env.NOTIFY_SMS_PROVIDER || "MOCK";
  process.env.NOTIFICATION_WEBHOOK_SECRET = process.env.NOTIFICATION_WEBHOOK_SECRET || "test-webhook-secret";
  process.env.TIMETABLE_REQUIRE_CANONICAL_REFS = "true";
  process.env.RATE_LIMIT_DISABLED = "true";
}

export async function createE2eApp(): Promise<E2eAppContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix("api/v1");
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    jwtService: app.get(JwtService),
    backgroundTasks: app.get(BackgroundTasksService)
  };
}

export async function closeE2eApp(context: Partial<E2eAppContext>): Promise<void> {
  if (context.prisma) {
    await cleanDatabase(context.prisma);
  }
  if (context.app) {
    await context.app.close();
  }
}

export async function login(
  app: INestApplication,
  username: string,
  password: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ username, password, tenantId: TENANT_ID })
    .expect(201);

  return {
    accessToken: response.body.accessToken,
    refreshToken: response.body.refreshToken
  };
}

export async function flushBackgroundTasks(backgroundTasks: BackgroundTasksService) {
  return backgroundTasks.runOnce();
}

export async function provisionAcademicBaseline(
  app: INestApplication,
  adminAccessToken: string,
  scolariteAccessToken: string
): Promise<AcademicBaseline> {
  const firstStudent = await request(app.getHttpServer())
    .post("/api/v1/students")
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .send({
      matricule: "MAT-26-001",
      firstName: "Jean",
      lastName: "Kouassi",
      sex: "M",
      birthDate: "2014-10-02"
    })
    .expect(201);

  const secondStudent = await request(app.getHttpServer())
    .post("/api/v1/students")
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .send({
      matricule: "MAT-26-002",
      firstName: "Marie",
      lastName: "Kone",
      sex: "F",
      birthDate: "2014-03-14"
    })
    .expect(201);

  const parent = await request(app.getHttpServer())
    .post("/api/v1/parents")
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .send({
      parentalRole: "PERE",
      firstName: "Moussa",
      lastName: "Kone",
      primaryPhone: "+22370000000",
      email: "moussa.kone@example.com",
      status: "ACTIVE"
    })
    .expect(201);

  const parentLink = await request(app.getHttpServer())
    .post("/api/v1/parents/links")
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .send({
      parentId: parent.body.id,
      studentId: secondStudent.body.id,
      relationType: "PERE",
      isPrimaryContact: true,
      legalGuardian: true,
      financialResponsible: true,
      emergencyContact: true
    })
    .expect(201);

  const schoolYear = await request(app.getHttpServer())
    .post("/api/v1/school-years")
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .send({
      code: "AS-2026-2027",
      label: "2026-2027",
      startDate: "2026-09-01",
      endDate: "2027-06-30",
      status: "ACTIVE",
      isDefault: true
    })
    .expect(201);

  const cycle = await request(app.getHttpServer())
    .post("/api/v1/cycles")
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .send({
      schoolYearId: schoolYear.body.id,
      code: "PRIMARY",
      label: "Primary",
      academicStage: "PRIMARY",
      sortOrder: 1
    })
    .expect(201);

  const level = await request(app.getHttpServer())
    .post("/api/v1/levels")
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .send({
      cycleId: cycle.body.id,
      code: "CP1",
      label: "CP1",
      track: "FRANCOPHONE",
      sortOrder: 1,
      status: "ACTIVE"
    })
    .expect(201);

  const classroom = await request(app.getHttpServer())
    .post("/api/v1/classes")
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .send({
      schoolYearId: schoolYear.body.id,
      levelId: level.body.id,
      track: "FRANCOPHONE",
      code: "CP1-A",
      label: "CP1 A",
      capacity: 30,
      status: "ACTIVE"
    })
    .expect(201);

  const subject = await request(app.getHttpServer())
    .post("/api/v1/subjects")
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .send({
      code: "MATH",
      label: "Mathematiques",
      status: "ACTIVE",
      nature: "FRANCOPHONE"
    })
    .expect(201);

  const academicPeriod = await request(app.getHttpServer())
    .post("/api/v1/academic-periods")
    .set("Authorization", `Bearer ${adminAccessToken}`)
    .send({
      schoolYearId: schoolYear.body.id,
      code: "T1",
      label: "Trimestre 1",
      startDate: "2026-09-01",
      endDate: "2026-12-20",
      periodType: "TRIMESTER",
      sortOrder: 1,
      status: "ACTIVE"
    })
    .expect(201);

  const firstEnrollment = await request(app.getHttpServer())
    .post("/api/v1/enrollments")
    .set("Authorization", `Bearer ${scolariteAccessToken}`)
    .send({
      studentId: firstStudent.body.id,
      classId: classroom.body.id,
      schoolYearId: schoolYear.body.id,
      enrollmentDate: "2026-09-05"
    })
    .expect(201);

  const secondEnrollment = await request(app.getHttpServer())
    .post("/api/v1/enrollments")
    .set("Authorization", `Bearer ${scolariteAccessToken}`)
    .send({
      studentId: secondStudent.body.id,
      classId: classroom.body.id,
      schoolYearId: schoolYear.body.id,
      enrollmentDate: "2026-09-06"
    })
    .expect(201);

  return {
    studentOneId: firstStudent.body.id,
    studentTwoId: secondStudent.body.id,
    businessParentId: parent.body.id,
    businessParentLinkId: parentLink.body.id,
    schoolYearId: schoolYear.body.id,
    cycleId: cycle.body.id,
    levelId: level.body.id,
    classId: classroom.body.id,
    subjectId: subject.body.id,
    academicPeriodId: academicPeriod.body.id,
    enrollmentOneId: firstEnrollment.body.id,
    enrollmentTwoId: secondEnrollment.body.id
  };
}

export async function ensureCanonicalTimetableResources(
  prisma: PrismaService,
  params: { schoolYearId: string; classId: string; subjectId: string }
): Promise<{ teacherAssignmentId: string; roomId: string }> {
  const teacher = await prisma.teacher.create({
    data: {
      tenantId: TENANT_ID,
      matricule: "ENS-TIMETABLE-001",
      firstName: "Aminata",
      lastName: "Traore",
      teacherType: "TITULAIRE",
      status: "ACTIVE"
    }
  });

  await prisma.teacherSkill.create({
    data: {
      tenantId: TENANT_ID,
      teacherId: teacher.id,
      subjectId: params.subjectId,
      track: "FRANCOPHONE",
      status: "ACTIVE"
    }
  });

  const assignment = await prisma.teacherAssignment.create({
    data: {
      tenantId: TENANT_ID,
      teacherId: teacher.id,
      schoolYearId: params.schoolYearId,
      classId: params.classId,
      subjectId: params.subjectId,
      track: "FRANCOPHONE",
      startDate: new Date("2026-09-01"),
      status: "ACTIVE"
    }
  });

  const roomType = await prisma.roomType.create({
    data: {
      tenantId: TENANT_ID,
      code: "E2E-CLASSROOM",
      name: "Salle de classe E2E",
      status: "ACTIVE"
    }
  });

  const room = await prisma.room.create({
    data: {
      tenantId: TENANT_ID,
      code: "E2E-A1",
      name: "Salle A1 E2E",
      roomTypeId: roomType.id,
      capacity: 32,
      status: "ACTIVE",
      isSharedBetweenCurricula: true
    }
  });

  return {
    teacherAssignmentId: assignment.id,
    roomId: room.id
  };
}

export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  await prisma.refreshToken.deleteMany({});
  await prisma.iamAuditLog.deleteMany({});
  await prisma.outboxEvent.deleteMany({});
  await prisma.teacherClassAssignment.deleteMany({});
  await prisma.parentStudentLink.deleteMany({});
  await prisma.parent.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.mosqueDonation.deleteMany({});
  await prisma.mosqueActivity.deleteMany({});
  await prisma.mosqueMember.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.attendanceAttachment.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.timetableSlot.deleteMany({});
  await prisma.roomAvailability.deleteMany({});
  await prisma.roomAssignment.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.roomType.deleteMany({});
  await prisma.teacherDocument.deleteMany({});
  await prisma.teacherAssignment.deleteMany({});
  await prisma.teacherSkill.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.feePlan.deleteMany({});
  await prisma.reportCard.deleteMany({});
  await prisma.gradeEntry.deleteMany({});
  await prisma.studentTrackPlacement.deleteMany({});
  await prisma.pedagogicalRule.deleteMany({});
  await prisma.enrollment.deleteMany({});
  await prisma.academicPeriod.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.classroom.deleteMany({});
  await prisma.level.deleteMany({});
  await prisma.cycle.deleteMany({});
  await prisma.schoolYear.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.teacher.deleteMany({});
  await prisma.user.deleteMany({});
}

export async function seedUsers(prisma: PrismaService): Promise<void> {
  const users = [
    {
      username: "admin@gestschool.local",
      password: "admin12345",
      role: UserRole.ADMIN,
      accountType: "STAFF"
    },
    {
      username: "scolarite@gestschool.local",
      password: "scolarite123",
      role: UserRole.SCOLARITE,
      accountType: "STAFF"
    },
    {
      username: "comptable@gestschool.local",
      password: "comptable123",
      role: UserRole.COMPTABLE,
      accountType: "STAFF"
    },
    {
      username: "enseignant@gestschool.local",
      password: "teacher1234",
      role: UserRole.ENSEIGNANT,
      accountType: "TEACHER"
    },
    {
      username: "parent@gestschool.local",
      password: "parent1234",
      role: UserRole.PARENT,
      accountType: "PARENT"
    }
  ] as const;

  for (const user of users) {
    const passwordHash = await hash(user.password, 10);
    await prisma.user.create({
      data: {
        tenantId: TENANT_ID,
        username: user.username,
        email: user.username,
        displayName: user.username,
        accountType: user.accountType,
        passwordHash,
        role: user.role
      }
    });
  }
}

function looksLikeDedicatedTestDatabase(databaseUrl: string): boolean {
  try {
    const parsed = new URL(databaseUrl);
    const databaseName = parsed.pathname.replace(/^\//, "").toLowerCase();
    const host = parsed.hostname.toLowerCase();
    return [databaseName, host].some(
      (value) => value.includes("test") || value.includes("e2e") || value.includes("jest")
    );
  } catch {
    const normalized = databaseUrl.trim().toLowerCase();
    return normalized.includes("test") || normalized.includes("e2e") || normalized.includes("jest");
  }
}
