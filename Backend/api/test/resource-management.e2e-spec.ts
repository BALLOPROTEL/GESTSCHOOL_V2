import * as request from "supertest";

import {
  cleanDatabase,
  closeE2eApp,
  configureE2eEnvironment,
  createE2eApp,
  login,
  provisionAcademicBaseline,
  seedUsers,
  type AcademicBaseline,
  type E2eAppContext
} from "./support/e2e-harness";

configureE2eEnvironment();
jest.setTimeout(120_000);

describe("Teachers + rooms management flows (e2e)", () => {
  let context: E2eAppContext;
  let baseline: AcademicBaseline;

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
  });

  afterAll(async () => {
    await closeE2eApp(context);
  });

  it("should manage teacher profile, skill, assignment and document metadata", async () => {
    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");

    const teacher = await request(context.app.getHttpServer())
      .post("/api/v1/teachers")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        matricule: "ENS-CORE-001",
        firstName: "Awa",
        lastName: "Diallo",
        email: "awa.diallo@gestschool.local",
        teacherType: "TITULAIRE",
        status: "ACTIVE"
      })
      .expect(201);

    const skill = await request(context.app.getHttpServer())
      .post("/api/v1/teachers/skills")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        teacherId: teacher.body.id,
        subjectId: baseline.subjectId,
        track: "FRANCOPHONE",
        levelId: baseline.levelId,
        status: "ACTIVE"
      })
      .expect(201);

    expect(skill.body.teacherId).toBe(teacher.body.id);

    const assignment = await request(context.app.getHttpServer())
      .post("/api/v1/teachers/assignments")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        teacherId: teacher.body.id,
        schoolYearId: baseline.schoolYearId,
        classId: baseline.classId,
        subjectId: baseline.subjectId,
        track: "FRANCOPHONE",
        startDate: "2026-09-01",
        workloadHours: 6,
        status: "ACTIVE"
      })
      .expect(201);

    expect(assignment.body.teacherId).toBe(teacher.body.id);

    const document = await request(context.app.getHttpServer())
      .post("/api/v1/teachers/documents")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        teacherId: teacher.body.id,
        documentType: "CONTRAT",
        fileUrl: "https://cdn.test.local/contracts/ens-core-001.pdf",
        originalName: "contrat-awa-diallo.pdf",
        mimeType: "application/pdf",
        status: "ACTIVE"
      })
      .expect(201);

    expect(document.body.documentType).toBe("CONTRAT");

    const detail = await request(context.app.getHttpServer())
      .get(`/api/v1/teachers/${teacher.body.id}`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    expect(detail.body.skills).toHaveLength(1);
    expect(detail.body.assignments).toHaveLength(1);
    expect(detail.body.documents).toHaveLength(1);

    const workloads = await request(context.app.getHttpServer())
      .get("/api/v1/teachers/workloads")
      .query({ schoolYearId: baseline.schoolYearId, track: "FRANCOPHONE" })
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    expect(workloads.body.some((item: { teacherId: string }) => item.teacherId === teacher.body.id)).toBe(true);
  });

  it("should manage room type, room, assignment, availability and occupancy", async () => {
    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");

    const roomType = await request(context.app.getHttpServer())
      .post("/api/v1/rooms/types")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        code: "LAB-SCI",
        name: "Laboratoire sciences",
        status: "ACTIVE"
      })
      .expect(201);

    const room = await request(context.app.getHttpServer())
      .post("/api/v1/rooms")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        code: "SCI-201",
        name: "Laboratoire 201",
        roomTypeId: roomType.body.id,
        capacity: 24,
        status: "ACTIVE",
        isSharedBetweenCurricula: false,
        defaultTrack: "FRANCOPHONE"
      })
      .expect(201);

    const assignment = await request(context.app.getHttpServer())
      .post("/api/v1/rooms/assignments")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        roomId: room.body.id,
        schoolYearId: baseline.schoolYearId,
        classId: baseline.classId,
        levelId: baseline.levelId,
        track: "FRANCOPHONE",
        subjectId: baseline.subjectId,
        assignmentType: "SUBJECT_ROOM",
        startDate: "2026-09-01",
        status: "ACTIVE"
      })
      .expect(201);

    expect(assignment.body.roomId).toBe(room.body.id);

    const availability = await request(context.app.getHttpServer())
      .post("/api/v1/rooms/availabilities")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        roomId: room.body.id,
        dayOfWeek: 2,
        startTime: "14:00",
        endTime: "16:00",
        availabilityType: "UNAVAILABLE",
        schoolYearId: baseline.schoolYearId
      })
      .expect(201);

    expect(availability.body.roomId).toBe(room.body.id);

    const detail = await request(context.app.getHttpServer())
      .get(`/api/v1/rooms/${room.body.id}`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    expect(detail.body.assignments).toHaveLength(1);
    expect(detail.body.availabilities).toHaveLength(1);

    const occupancy = await request(context.app.getHttpServer())
      .get("/api/v1/rooms/occupancy")
      .query({ schoolYearId: baseline.schoolYearId, track: "FRANCOPHONE" })
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(200);

    expect(occupancy.body.some((item: { roomId: string }) => item.roomId === room.body.id)).toBe(true);
  });
});
