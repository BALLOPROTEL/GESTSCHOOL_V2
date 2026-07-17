import * as request from "supertest";

import {
  cleanDatabase,
  closeE2eApp,
  configureE2eEnvironment,
  createE2eApp,
  login,
  provisionAcademicBaseline,
  seedUsers,
  TENANT_ID,
  type AcademicBaseline,
  type E2eAppContext
} from "./support/e2e-harness";

configureE2eEnvironment();
jest.setTimeout(120_000);

const SECOND_TENANT_ID = "22222222-2222-4222-8222-222222222222";
const RACE_TIMEOUT_MS = 10_000;

describe("PostgreSQL tenant uniqueness under concurrency (e2e)", () => {
  let context: E2eAppContext;
  let baseline: AcademicBaseline;
  let accessToken: string;

  beforeAll(async () => {
    context = await createE2eApp();
    await cleanDatabase(context.prisma);
    await seedUsers(context.prisma);
    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");
    const scolariteTokens = await login(context.app, "scolarite@gestschool.local", "scolarite123");
    accessToken = adminTokens.accessToken;
    baseline = await provisionAcademicBaseline(
      context.app,
      adminTokens.accessToken,
      scolariteTokens.accessToken
    );
  });

  afterAll(async () => {
    await closeE2eApp(context);
  });

  it("allows exactly one nullable teacher skill and returns 409 for the concurrent duplicate", async () => {
    const teacher = await createTeacher("ENS-RACE-001", "Aminata", "Coulibaly");
    const payload = {
      teacherId: teacher.id,
      subjectId: baseline.subjectId,
      track: "FRANCOPHONE",
      status: "ACTIVE"
    };

    const responses = await race([
      post("/api/v1/teachers/skills", payload),
      post("/api/v1/teachers/skills", payload)
    ]);

    expectStatuses(responses, [201, 409]);
    await expect(
      context.prisma.teacherSkill.count({
        where: {
          tenantId: TENANT_ID,
          teacherId: teacher.id,
          subjectId: baseline.subjectId,
          cycleId: null,
          levelId: null
        }
      })
    ).resolves.toBe(1);
  });

  it("allows exactly one teacher assignment during two identical creates", async () => {
    const teacher = await createTeacher("ENS-RACE-002", "Oumar", "Salah");
    await post("/api/v1/teachers/skills", {
      teacherId: teacher.id,
      subjectId: baseline.subjectId,
      track: "FRANCOPHONE",
      status: "ACTIVE"
    }).expect(201);

    const payload = {
      teacherId: teacher.id,
      schoolYearId: baseline.schoolYearId,
      classId: baseline.classId,
      subjectId: baseline.subjectId,
      track: "FRANCOPHONE",
      startDate: "2026-09-01",
      status: "ACTIVE"
    };
    const responses = await race([
      post("/api/v1/teachers/assignments", payload),
      post("/api/v1/teachers/assignments", payload)
    ]);

    expectStatuses(responses, [201, 409]);
    await expect(
      context.prisma.teacherAssignment.count({
        where: {
          tenantId: TENANT_ID,
          teacherId: teacher.id,
          schoolYearId: baseline.schoolYearId,
          classId: baseline.classId,
          subjectId: baseline.subjectId,
          track: "FRANCOPHONE"
        }
      })
    ).resolves.toBe(1);
  });

  it("enforces one active homeroom teacher even when different assignments race", async () => {
    const teacherOne = await createTeacher("ENS-HOME-001", "Mariam", "Diallo");
    const teacherTwo = await createTeacher("ENS-HOME-002", "Boubacar", "Traore");
    const secondSubject = await post("/api/v1/subjects", {
      code: "SCI-RACE",
      label: "Sciences concurrence",
      status: "ACTIVE",
      nature: "FRANCOPHONE"
    }).expect(201);

    await Promise.all([
      post("/api/v1/teachers/skills", {
        teacherId: teacherOne.id,
        subjectId: baseline.subjectId,
        track: "FRANCOPHONE",
        status: "ACTIVE"
      }).expect(201),
      post("/api/v1/teachers/skills", {
        teacherId: teacherTwo.id,
        subjectId: secondSubject.body.id,
        track: "FRANCOPHONE",
        status: "ACTIVE"
      }).expect(201)
    ]);

    const assignment = (teacherId: string, subjectId: string) => ({
      teacherId,
      schoolYearId: baseline.schoolYearId,
      classId: baseline.classId,
      subjectId,
      track: "FRANCOPHONE",
      startDate: "2026-09-01",
      isHomeroomTeacher: true,
      status: "ACTIVE"
    });
    const responses = await race([
      post("/api/v1/teachers/assignments", assignment(teacherOne.id, baseline.subjectId)),
      post("/api/v1/teachers/assignments", assignment(teacherTwo.id, secondSubject.body.id))
    ]);

    expectStatuses(responses, [201, 409]);
    await expect(
      context.prisma.teacherAssignment.count({
        where: {
          tenantId: TENANT_ID,
          schoolYearId: baseline.schoolYearId,
          classId: baseline.classId,
          track: "FRANCOPHONE",
          isHomeroomTeacher: true,
          status: "ACTIVE"
        }
      })
    ).resolves.toBe(1);
  });

  it("protects nullable room assignment and availability scopes", async () => {
    const room = await createRoom("ROOM-RACE-001");
    const assignmentPayload = {
      roomId: room.id,
      schoolYearId: baseline.schoolYearId,
      assignmentType: "SHARED_ROOM",
      status: "ACTIVE"
    };
    const assignmentResponses = await race([
      post("/api/v1/rooms/assignments", assignmentPayload),
      post("/api/v1/rooms/assignments", assignmentPayload)
    ]);
    expectStatuses(assignmentResponses, [201, 409]);

    const availabilityPayload = {
      roomId: room.id,
      availabilityType: "AVAILABLE"
    };
    const availabilityResponses = await race([
      post("/api/v1/rooms/availabilities", availabilityPayload),
      post("/api/v1/rooms/availabilities", availabilityPayload)
    ]);
    expectStatuses(availabilityResponses, [201, 409]);

    await expect(
      context.prisma.roomAssignment.count({
        where: { tenantId: TENANT_ID, roomId: room.id, schoolYearId: baseline.schoolYearId }
      })
    ).resolves.toBe(1);
    await expect(
      context.prisma.roomAvailability.count({
        where: {
          tenantId: TENANT_ID,
          roomId: room.id,
          schoolYearId: null,
          periodId: null,
          dayOfWeek: null,
          startTime: null,
          endTime: null,
          availabilityType: "AVAILABLE"
        }
      })
    ).resolves.toBe(1);
  });

  it("allows only one of two updates converging on the same nullable room slot", async () => {
    const room = await createRoom("ROOM-RACE-002");
    const first = await post("/api/v1/rooms/availabilities", {
      roomId: room.id,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "09:00",
      availabilityType: "UNAVAILABLE"
    }).expect(201);
    const second = await post("/api/v1/rooms/availabilities", {
      roomId: room.id,
      dayOfWeek: 2,
      startTime: "08:00",
      endTime: "09:00",
      availabilityType: "UNAVAILABLE"
    }).expect(201);
    const target = {
      dayOfWeek: 3,
      startTime: "10:00",
      endTime: "11:00"
    };

    const responses = await race([
      patch(`/api/v1/rooms/availabilities/${first.body.id}`, target),
      patch(`/api/v1/rooms/availabilities/${second.body.id}`, target)
    ]);

    expectStatuses(responses, [200, 409]);
    await expect(
      context.prisma.roomAvailability.count({
        where: {
          tenantId: TENANT_ID,
          roomId: room.id,
          dayOfWeek: 3,
          startTime: "10:00",
          endTime: "11:00",
          availabilityType: "UNAVAILABLE"
        }
      })
    ).resolves.toBe(1);
  });

  it("deduplicates a concurrent parent/student relation", async () => {
    const parent = await post("/api/v1/parents", {
      parentalRole: "TUTEUR",
      firstName: "Fatou",
      lastName: "Konate",
      primaryPhone: "+22370000999",
      status: "ACTIVE"
    }).expect(201);
    const payload = {
      parentId: parent.body.id,
      studentId: baseline.studentOneId,
      relationType: "TUTEUR",
      isPrimaryContact: false
    };

    const responses = await race([
      post("/api/v1/parents/links", payload),
      post("/api/v1/parents/links", payload)
    ]);

    expectStatuses(responses, [201, 409]);
    await expect(
      context.prisma.parentStudentLink.count({
        where: {
          tenantId: TENANT_ID,
          parentId: parent.body.id,
          studentId: baseline.studentOneId,
          archivedAt: null
        }
      })
    ).resolves.toBe(1);
  });

  it("keeps identical business values isolated between tenants", async () => {
    const roomType = await context.prisma.roomType.create({
      data: {
        tenantId: SECOND_TENANT_ID,
        code: "RACE",
        name: "Salle concurrence",
        status: "ACTIVE",
        updatedAt: new Date()
      }
    });
    const secondTenantRoom = await context.prisma.room.create({
      data: {
        tenantId: SECOND_TENANT_ID,
        code: "ROOM-RACE-001",
        name: "Salle concurrence",
        roomTypeId: roomType.id,
        capacity: 30,
        status: "ACTIVE",
        updatedAt: new Date()
      }
    });

    await context.prisma.roomAvailability.create({
      data: {
        tenantId: SECOND_TENANT_ID,
        roomId: secondTenantRoom.id,
        availabilityType: "AVAILABLE",
        updatedAt: new Date()
      }
    });

    await expect(
      context.prisma.roomAvailability.count({
        where: { availabilityType: "AVAILABLE", tenantId: { in: [TENANT_ID, SECOND_TENANT_ID] } }
      })
    ).resolves.toBeGreaterThanOrEqual(2);
  });

  function post(path: string, payload: Record<string, unknown>) {
    return request(context.app.getHttpServer())
      .post(path)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(payload);
  }

  function patch(path: string, payload: Record<string, unknown>) {
    return request(context.app.getHttpServer())
      .patch(path)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(payload);
  }

  async function createTeacher(matricule: string, firstName: string, lastName: string) {
    const response = await post("/api/v1/teachers", {
      matricule,
      firstName,
      lastName,
      teacherType: "TITULAIRE",
      status: "ACTIVE"
    }).expect(201);
    return response.body as { id: string };
  }

  async function createRoom(code: string) {
    const roomType = await post("/api/v1/rooms/types", {
      code: `TYPE-${code}`,
      name: `Type ${code}`,
      status: "ACTIVE"
    }).expect(201);
    const room = await post("/api/v1/rooms", {
      code,
      name: `Salle ${code}`,
      roomTypeId: roomType.body.id,
      capacity: 30,
      status: "ACTIVE",
      isSharedBetweenCurricula: true
    }).expect(201);
    return room.body as { id: string };
  }
});

async function race<T>(operations: Array<Promise<T>>): Promise<T[]> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.all(operations),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Concurrent database operations exceeded the deadlock timeout.")),
          RACE_TIMEOUT_MS
        );
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function expectStatuses(
  responses: Array<{ status: number }>,
  expected: number[]
): void {
  expect(
    responses.map((response) => response.status).sort((left, right) => left - right)
  ).toEqual(expected);
}
