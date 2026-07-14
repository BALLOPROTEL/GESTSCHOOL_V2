import * as request from "supertest";

import {
  cleanDatabase,
  closeE2eApp,
  configureE2eEnvironment,
  createE2eApp,
  login,
  seedUsers,
  type E2eAppContext
} from "./support/e2e-harness";

configureE2eEnvironment();
jest.setTimeout(120_000);

describe("HTTP platform boundaries (e2e)", () => {
  let context: E2eAppContext;
  let accessToken: string;

  beforeAll(async () => {
    context = await createE2eApp();
    await cleanDatabase(context.prisma);
    await seedUsers(context.prisma);
    accessToken = (await login(context.app, "admin@gestschool.local", "admin12345")).accessToken;
  });

  afterAll(async () => {
    await closeE2eApp(context);
  });

  it("rejects malformed UUID route parameters before reaching the service", async () => {
    const response = await request(context.app.getHttpServer())
      .get("/api/v1/students/not-a-uuid")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body.statusCode).toBe(400);
  });

  it("sets API security headers and hides the Express implementation", async () => {
    const response = await request(context.app.getHttpServer())
      .get("/api/v1/health/live")
      .expect(200);

    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["content-security-policy"]).toBeUndefined();
  });

  it("returns a structured 404 for unmatched routes", async () => {
    const response = await request(context.app.getHttpServer())
      .get("/api/v1/students/00000000-0000-4000-8000-000000000999/unexpected")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body.statusCode).toBe(404);
  });

  it("rejects nested query objects when the endpoint expects a scalar UUID", async () => {
    const response = await request(context.app.getHttpServer())
      .get("/api/v1/analytics/overview")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ "schoolYearId[value]": "00000000-0000-4000-8000-000000000001" })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
  });

  it("rejects non-whitelisted request properties through the global validation pipe", async () => {
    const response = await request(context.app.getHttpServer())
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        matricule: "HTTP-BOUNDARY-001",
        firstName: "Aminata",
        lastName: "Diallo",
        sex: "F",
        nested: { unexpected: true }
      })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
  });
});
