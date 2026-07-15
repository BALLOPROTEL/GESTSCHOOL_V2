import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PDFDocument } from "pdf-lib";
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
  let storageRoot: string;

  beforeAll(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), "gestschool-resource-e2e-"));
    process.env.STORAGE_PROVIDER = "LOCAL";
    process.env.FILE_STORAGE_DRIVER = "LOCAL";
    process.env.FILE_STORAGE_LOCAL_ROOT = storageRoot;
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
    await rm(storageRoot, { recursive: true, force: true });
    delete process.env.STORAGE_PROVIDER;
    delete process.env.FILE_STORAGE_DRIVER;
    delete process.env.FILE_STORAGE_LOCAL_ROOT;
  });

  it("should manage teacher profile, skill, assignment and a private validated document", async () => {
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

    const pdf = await PDFDocument.create();
    pdf.addPage([320, 240]);
    const pdfBuffer = Buffer.from(await pdf.save());

    const document = await request(context.app.getHttpServer())
      .post(`/api/v1/teachers/${teacher.body.id}/documents`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .field("documentType", "CONTRAT")
      .field("documentName", "Contrat Awa Diallo")
      .field("status", "ACTIVE")
      .attach("file", pdfBuffer, {
        filename: "contrat-awa-diallo.pdf",
        contentType: "application/pdf"
      })
      .expect(201);

    expect(document.body.documentType).toBe("CONTRAT");
    expect(document.body.fileUrl).toBe(`/api/v1/teachers/documents/${document.body.id}/content`);
    expect(document.body.fileUrl).not.toContain("/tmp/");

    await request(context.app.getHttpServer())
      .post(`/api/v1/teachers/${teacher.body.id}/documents`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .field("documentType", "AUTRE")
      .field("documentName", "Script interdit")
      .attach("file", Buffer.from("#!/bin/sh\necho unsafe"), {
        filename: "script.sh",
        contentType: "text/x-sh"
      })
      .expect(400);

    await request(context.app.getHttpServer())
      .post(`/api/v1/teachers/${teacher.body.id}/documents`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .field("documentType", "CONTRAT")
      .field("documentName", "Contrat lourd")
      .attach("file", Buffer.alloc(10 * 1024 * 1024 + 1, 0x61), {
        filename: "contrat-lourd.pdf",
        contentType: "application/pdf"
      })
      .expect(413);

    const teacherTokens = await login(context.app, "enseignant@gestschool.local", "teacher1234");
    await request(context.app.getHttpServer())
      .post(`/api/v1/teachers/${teacher.body.id}/documents`)
      .set("Authorization", `Bearer ${teacherTokens.accessToken}`)
      .field("documentType", "CONTRAT")
      .field("documentName", "Document non autorisé")
      .attach("file", pdfBuffer, {
        filename: "non-autorise.pdf",
        contentType: "application/pdf"
      })
      .expect(403);

    await request(context.app.getHttpServer())
      .post("/api/v1/teachers/11111111-1111-4111-8111-111111111111/documents")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .field("documentType", "CONTRAT")
      .field("documentName", "Ressource arbitraire")
      .attach("file", pdfBuffer, {
        filename: "arbitraire.pdf",
        contentType: "application/pdf"
      })
      .expect(404);

    await request(context.app.getHttpServer())
      .get(`/api/v1/teachers/documents/${document.body.id}/content`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect("Content-Type", /application\/pdf/)
      .expect("X-Content-Type-Options", "nosniff")
      .expect("Cache-Control", "private, no-store")
      .expect("Content-Disposition", /attachment/)
      .expect(200)
      .then((response) => {
        expect(Buffer.compare(response.body, pdfBuffer)).toBe(0);
      });

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

    await request(context.app.getHttpServer())
      .delete(`/api/v1/teachers/documents/${document.body.id}`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(204);

    await request(context.app.getHttpServer())
      .get(`/api/v1/teachers/documents/${document.body.id}/content`)
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .expect(404);
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
