import { createHash, randomBytes } from "node:crypto";

import * as request from "supertest";
import { hash } from "bcryptjs";

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

  it("POST /auth/login should reject pending activation accounts", async () => {
    await context.prisma.user.create({
      data: {
        tenantId: TENANT_ID,
        username: "pending-login@gestschool.local",
        email: "pending-login@gestschool.local",
        displayName: "Compte en attente",
        accountType: "STAFF",
        passwordHash: await hash("PendingLogin123!", 10),
        role: UserRole.SCOLARITE,
        status: "PENDING_ACTIVATION",
        isActive: false
      }
    });

    const response = await request(context.app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        username: "pending-login@gestschool.local",
        password: "PendingLogin123!",
        tenantId: TENANT_ID
      })
      .expect(401);

    expect(response.body.message).toContain("pas encore activé");
  });

  it("POST /auth/forgot-password should be generic and store only a reset token hash", async () => {
    const before = await context.prisma.userSecurityToken.count({
      where: { type: "PASSWORD_RESET" }
    });

    const existing = await request(context.app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ username: "admin@gestschool.local", tenantId: TENANT_ID })
      .expect(201);

    const missing = await request(context.app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ username: "missing@gestschool.local", tenantId: TENANT_ID })
      .expect(201);

    expect(existing.body.message).toBe(missing.body.message);
    expect(existing.body.debugResetToken).toBeUndefined();

    const rows = await context.prisma.userSecurityToken.findMany({
      where: { type: "PASSWORD_RESET" },
      orderBy: { createdAt: "desc" }
    });
    expect(rows).toHaveLength(before + 1);
    expect(rows[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("POST /auth/reset-password should consume a reset token once", async () => {
    const user = await context.prisma.user.create({
      data: {
        tenantId: TENANT_ID,
        username: "reset-user@gestschool.local",
        email: "reset-user@gestschool.local",
        displayName: "Reset User",
        accountType: "STAFF",
        passwordHash: await hash("ResetOld123!", 10),
        role: UserRole.SCOLARITE,
        status: "ACTIVE",
        isActive: true,
        activatedAt: new Date()
      }
    });
    const rawToken = randomBytes(48).toString("base64url");
    await context.prisma.userSecurityToken.create({
      data: {
        tenantId: TENANT_ID,
        userId: user.id,
        type: "PASSWORD_RESET",
        tokenHash: createHash("sha256").update(rawToken).digest("hex"),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      }
    });

    await request(context.app.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .send({ token: rawToken, newPassword: "SecureNew123!" })
      .expect(201);

    await request(context.app.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .send({ token: rawToken, newPassword: "ResetAgain123!" })
      .expect(401);

    await request(context.app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        username: "reset-user@gestschool.local",
        password: "SecureNew123!",
        tenantId: TENANT_ID
      })
      .expect(201);
  });

  it("POST /auth/activate should activate a pending account and consume the token once", async () => {
    const user = await context.prisma.user.create({
      data: {
        tenantId: TENANT_ID,
        username: "activate-user@gestschool.local",
        email: "activate-user@gestschool.local",
        displayName: "Activate User",
        accountType: "STAFF",
        passwordHash: await hash("ActivationPlaceholder123!", 10),
        role: UserRole.SCOLARITE,
        status: "PENDING_ACTIVATION",
        isActive: false
      }
    });
    const rawToken = randomBytes(48).toString("base64url");
    await context.prisma.userSecurityToken.create({
      data: {
        tenantId: TENANT_ID,
        userId: user.id,
        type: "ACTIVATION",
        tokenHash: createHash("sha256").update(rawToken).digest("hex"),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      }
    });

    await request(context.app.getHttpServer())
      .post("/api/v1/auth/activate")
      .send({ token: rawToken, newPassword: "ActivationNew123!" })
      .expect(201);

    const activated = await context.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(activated.status).toBe("ACTIVE");
    expect(activated.isActive).toBe(true);
    expect(activated.activatedAt).toBeTruthy();

    await request(context.app.getHttpServer())
      .post("/api/v1/auth/activate")
      .send({ token: rawToken, newPassword: "ActivationNew456!" })
      .expect(401);

    await request(context.app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        username: "activate-user@gestschool.local",
        password: "ActivationNew123!",
        tenantId: TENANT_ID
      })
      .expect(201);
  });

  it("POST /users should create a pending user and queue an activation token", async () => {
    const adminTokens = await login(context.app, "admin@gestschool.local", "admin12345");

    const response = await request(context.app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminTokens.accessToken}`)
      .send({
        username: "new-account@gestschool.local",
        email: "new-account@gestschool.local",
        accountType: "STAFF",
        roleId: UserRole.SCOLARITE,
        staffDisplayName: "Nouvel utilisateur",
        sendActivationEmail: true
      })
      .expect(201);

    expect(response.body.temporaryPassword).toBeUndefined();
    expect(response.body.status).toBe("PENDING_ACTIVATION");
    expect(response.body.activationEmailSent).toBe(true);

    const token = await context.prisma.userSecurityToken.findFirst({
      where: { userId: response.body.id, type: "ACTIVATION" }
    });
    expect(token?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
