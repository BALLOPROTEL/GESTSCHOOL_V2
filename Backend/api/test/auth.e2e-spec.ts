import * as request from "supertest";

import { UserRole } from "../src/security/roles.enum";
import {
  cleanDatabase,
  closeE2eApp,
  configureE2eEnvironment,
  createE2eApp,
  flushBackgroundTasks,
  login,
  seedUsers,
  TENANT_ID,
  type E2eAppContext
} from "./support/e2e-harness";

configureE2eEnvironment();
jest.setTimeout(120_000);

describe("Auth + access guards (e2e)", () => {
  let context: E2eAppContext;

  beforeAll(async () => {
    context = await createE2eApp();
    await cleanDatabase(context.prisma);
    await seedUsers(context.prisma);
  });

  afterAll(async () => {
    await closeE2eApp(context);
  });

  it("POST /auth/login should return access and refresh tokens", async () => {
    const response = await request(context.app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        username: "admin@gestschool.local",
        password: "admin12345",
        tenantId: TENANT_ID
      })
      .expect(201);

    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
    expect(response.body.user.role).toBe("ADMIN");
  });

  it("GET /students should reject missing token", async () => {
    await request(context.app.getHttpServer()).get("/api/v1/students").expect(401);
  });

  it("GET /students should reject token with invalid audience", async () => {
    const invalidAudienceToken = await context.jwtService.signAsync(
      {
        sub: "invalid-user",
        username: "admin@gestschool.local",
        role: UserRole.ADMIN,
        tenantId: TENANT_ID
      },
      {
        secret: process.env.JWT_SECRET,
        issuer: process.env.JWT_ISSUER,
        audience: "wrong-audience",
        expiresIn: 3600
      }
    );

    await request(context.app.getHttpServer())
      .get("/api/v1/students")
      .set("Authorization", `Bearer ${invalidAudienceToken}`)
      .expect(401);
  });

  it("GET /students should reject role not authorized", async () => {
    const parentTokens = await login(context.app, "parent@gestschool.local", "parent1234");

    await request(context.app.getHttpServer())
      .get("/api/v1/students")
      .set("Authorization", `Bearer ${parentTokens.accessToken}`)
      .expect(403);
  });

  it("GET /students should reject tenant header override", async () => {
    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");

    await request(context.app.getHttpServer())
      .get("/api/v1/students")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .set("x-tenant-id", "00000000-0000-0000-0000-000000000999")
      .expect(403);
  });

  it("POST /auth/refresh should rotate refresh token and persist audit trail", async () => {
    await flushBackgroundTasks(context.backgroundTasks);
    const beforeRefreshAuditCount = await context.prisma.iamAuditLog.count({
      where: {
        tenantId: TENANT_ID,
        action: "AUTH_REFRESH_SUCCESS"
      }
    });

    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");

    const firstRefresh = await request(context.app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: adminTokens.refreshToken })
      .expect(201);

    expect(firstRefresh.body.accessToken).toBeDefined();
    expect(firstRefresh.body.refreshToken).toBeDefined();

    await request(context.app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: adminTokens.refreshToken })
      .expect(401);

    const pendingAuditEvents = await context.prisma.outboxEvent.count({
      where: {
        tenantId: TENANT_ID,
        eventType: "iam.audit-log.requested",
        status: "PENDING"
      }
    });
    expect(pendingAuditEvents).toBeGreaterThanOrEqual(1);

    const flushed = await flushBackgroundTasks(context.backgroundTasks);
    expect(flushed.audit.processedCount).toBeGreaterThanOrEqual(1);

    const afterRefreshAuditCount = await context.prisma.iamAuditLog.count({
      where: {
        tenantId: TENANT_ID,
        action: "AUTH_REFRESH_SUCCESS"
      }
    });
    expect(afterRefreshAuditCount).toBe(beforeRefreshAuditCount + 1);
  });

  it("POST /auth/logout should revoke refresh token", async () => {
    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");

    await request(context.app.getHttpServer())
      .post("/api/v1/auth/logout")
      .send({ refreshToken: adminTokens.refreshToken })
      .expect(204);

    await request(context.app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: adminTokens.refreshToken })
      .expect(401);
  });
});
