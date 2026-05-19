import { createHash, randomBytes, randomUUID } from "node:crypto";

import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma, type User, type UserSecurityToken } from "@prisma/client";
import { compare, hash } from "bcryptjs";

import { AuditService } from "../audit/audit.service";
import { findPasswordPolicyViolation } from "../common/password-policy";
import { PrismaService } from "../database/prisma.service";
import { NotificationGatewayService } from "../notifications/notification-gateway.service";
import { UserRole } from "../security/roles.enum";
import { ActivateAccountDto } from "./dto/activate-account.dto";
import { FirstConnectionDto } from "./dto/first-connection.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { ResendActivationDto } from "./dto/resend-activation.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: string;
  user: {
    id: string;
    username: string;
    role: UserRole;
    tenantId: string;
  };
};

export type ForgotPasswordResponse = {
  message: string;
};

export type MessageResponse = {
  message: string;
};

export type TokenStatusResponse = {
  valid: boolean;
  expiresAt?: string;
};

export type ActivationDeliveryResponse = {
  sent: boolean;
  message: string;
};

type SecurityTokenType = "ACTIVATION" | "PASSWORD_RESET";

@Injectable()
export class AuthService {
  constructor(
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly notificationGateway: NotificationGatewayService,
    private readonly prisma: PrismaService
  ) {}

  async login(payload: LoginDto): Promise<AuthTokensResponse> {
    const tenantId = payload.tenantId || this.getDefaultTenantId();
    const identifier = payload.username.trim();

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { username: identifier },
          { email: identifier }
        ]
      }
    });

    if (!user) {
      throw new UnauthorizedException("Invalid username or password.");
    }

    const status = this.userStatus(user);
    if (status === "PENDING_ACTIVATION") {
      throw new UnauthorizedException(
        "Votre compte n’est pas encore activé. Consultez votre email ou demandez un nouveau lien."
      );
    }
    if (!user.isActive || status === "INACTIVE" || status === "ARCHIVED" || status === "DISABLED") {
      throw new UnauthorizedException("Compte désactivé. Contactez l’administration.");
    }

    const isPasswordValid = await compare(payload.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid username or password.");
    }

    const tokens = await this.issueTokens(user);
    await this.logAuthAudit(user.tenantId, user.id, "AUTH_LOGIN_SUCCESS", {
      username: user.username,
      role: user.role
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { updatedAt: new Date() }
    });
    return tokens;
  }

  async refresh(refreshToken: string): Promise<AuthTokensResponse> {
    const tokenHash = this.hashToken(refreshToken);
    const refreshRecord = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });

    if (
      !refreshRecord ||
      !refreshRecord.user.isActive ||
      refreshRecord.user.deletedAt ||
      this.userStatus(refreshRecord.user) !== "ACTIVE"
    ) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    await this.prisma.refreshToken.update({
      where: { id: refreshRecord.id },
      data: { revokedAt: new Date() }
    });

    const tokens = await this.issueTokens(refreshRecord.user);
    await this.logAuthAudit(
      refreshRecord.user.tenantId,
      refreshRecord.user.id,
      "AUTH_REFRESH_SUCCESS"
    );
    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const rows = await this.prisma.refreshToken.findMany({
      where: {
        tokenHash,
        revokedAt: null
      },
      select: {
        tenantId: true,
        userId: true
      }
    });

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    if (rows[0]) {
      await this.logAuthAudit(rows[0].tenantId, rows[0].userId, "AUTH_LOGOUT_SUCCESS");
    }
  }

  async forgotPassword(payload: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    const tenantId = payload.tenantId || this.getDefaultTenantId();
    const identifier = payload.username.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { username: identifier },
          { email: identifier }
        ]
      }
    });

    const genericMessage =
      "Si un compte correspond à ces informations, un email de réinitialisation a été envoyé.";
    if (!user || !this.isEligibleForPasswordReset(user)) {
      return { message: genericMessage };
    }

    try {
      const { rawToken, expiresAt } = await this.createSecurityToken(user, "PASSWORD_RESET");
      await this.sendPasswordResetEmail(user, rawToken, expiresAt);
      await this.logAuthAudit(user.tenantId, user.id, "AUTH_FORGOT_PASSWORD_REQUESTED", {
        username: user.username
      });
    } catch {
      await this.logAuthAudit(user.tenantId, user.id, "AUTH_FORGOT_PASSWORD_EMAIL_FAILED", {
        username: user.username
      });
    }

    return { message: genericMessage };
  }

  async resetPassword(payload: ResetPasswordDto): Promise<MessageResponse> {
    const tokenRecord = await this.requireUsableSecurityToken(payload.token, "PASSWORD_RESET");
    const user = tokenRecord.user;

    if (!this.isEligibleForPasswordReset(user)) {
      throw new UnauthorizedException("Token de réinitialisation invalide ou expiré.");
    }

    this.assertPasswordPolicy(payload.newPassword, user.username);

    const samePassword = await compare(payload.newPassword, user.passwordHash);
    if (samePassword) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l’ancien.");
    }

    await this.replaceUserPassword(user, payload.newPassword, tokenRecord.id);
    await this.logAuthAudit(user.tenantId, user.id, "AUTH_PASSWORD_RESET_SUCCESS", {
      username: user.username
    });
    return { message: "Mot de passe réinitialisé avec succès." };
  }

  async activateAccount(payload: ActivateAccountDto): Promise<MessageResponse> {
    const tokenRecord = await this.requireUsableSecurityToken(payload.token, "ACTIVATION");
    const user = tokenRecord.user;

    if (user.deletedAt || this.userStatus(user) === "ARCHIVED") {
      throw new UnauthorizedException("Lien d’activation invalide ou expiré.");
    }

    this.assertPasswordPolicy(payload.newPassword, user.username);

    const passwordHash = await hash(payload.newPassword, 10);
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          status: "ACTIVE",
          isActive: true,
          mustChangePasswordAtFirstLogin: false,
          activatedAt: now,
          disabledAt: null,
          updatedAt: now
        }
      });

      await transaction.userSecurityToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: now }
      });

      await transaction.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null
        },
        data: { revokedAt: now }
      });
    });

    await this.logAuthAudit(user.tenantId, user.id, "AUTH_ACCOUNT_ACTIVATED", {
      username: user.username
    });
    return { message: "Compte activé. Vous pouvez maintenant vous connecter." };
  }

  async resendActivation(payload: ResendActivationDto): Promise<ForgotPasswordResponse> {
    const tenantId = payload.tenantId || this.getDefaultTenantId();
    const identifier = payload.username.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { username: identifier },
          { email: identifier }
        ]
      }
    });

    const genericMessage =
      "Si un compte en attente correspond à ces informations, un email d’activation a été envoyé.";
    if (!user || this.userStatus(user) !== "PENDING_ACTIVATION") {
      return { message: genericMessage };
    }

    try {
      const { rawToken, expiresAt } = await this.createSecurityToken(user, "ACTIVATION");
      await this.sendActivationEmail(user, rawToken, expiresAt);
      await this.logAuthAudit(user.tenantId, user.id, "AUTH_ACTIVATION_RESENT", {
        username: user.username
      });
    } catch {
      await this.logAuthAudit(user.tenantId, user.id, "AUTH_ACTIVATION_EMAIL_FAILED", {
        username: user.username
      });
    }
    return { message: genericMessage };
  }

  async activationStatus(token: string): Promise<TokenStatusResponse> {
    return this.securityTokenStatus(token, "ACTIVATION");
  }

  async resetStatus(token: string): Promise<TokenStatusResponse> {
    return this.securityTokenStatus(token, "PASSWORD_RESET");
  }

  async createActivationForUser(userId: string): Promise<ActivationDeliveryResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException("Utilisateur introuvable.");
    }
    if (this.userStatus(user) !== "PENDING_ACTIVATION") {
      return {
        sent: false,
        message: "Le compte n’est pas en attente d’activation."
      };
    }

    const { rawToken, expiresAt } = await this.createSecurityToken(user, "ACTIVATION");
    await this.sendActivationEmail(user, rawToken, expiresAt);
    await this.logAuthAudit(user.tenantId, user.id, "AUTH_ACTIVATION_SENT", {
      username: user.username
    });
    return {
      sent: true,
      message: "Email d’activation envoyé."
    };
  }

  async completeFirstConnection(payload: FirstConnectionDto): Promise<MessageResponse> {
    const tenantId = payload.tenantId || this.getDefaultTenantId();
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        username: payload.username,
        isActive: true,
        deletedAt: null
      }
    });

    if (!user) {
      throw new UnauthorizedException("Compte introuvable.");
    }

    const hasTemporaryPassword = await compare(payload.temporaryPassword, user.passwordHash);
    if (!hasTemporaryPassword) {
      throw new UnauthorizedException("Mot de passe temporaire invalide.");
    }

    if (payload.newPassword === payload.temporaryPassword) {
      throw new BadRequestException(
        "Le nouveau mot de passe doit etre different du mot de passe temporaire."
      );
    }

    this.assertPasswordPolicy(payload.newPassword, user.username);

    await this.replaceUserPassword(user, payload.newPassword);
    await this.logAuthAudit(user.tenantId, user.id, "AUTH_FIRST_CONNECTION_COMPLETED", {
      username: user.username
    });
    return { message: "Premiere connexion finalisee. Vous pouvez maintenant vous connecter." };
  }

  private async createSecurityToken(
    user: Pick<User, "id" | "tenantId">,
    type: SecurityTokenType
  ): Promise<{ rawToken: string; expiresAt: Date }> {
    const rawToken = randomBytes(48).toString("base64url");
    const tokenHash = this.hashToken(rawToken);
    const expiresIn =
      type === "ACTIVATION"
        ? this.configService.get<string>("ACCOUNT_ACTIVATION_EXPIRES_IN", "48h")
        : this.configService.get<string>("PASSWORD_RESET_EXPIRES_IN", "30m");
    const expiresAt = new Date(Date.now() + this.resolveExpirationSeconds(expiresIn) * 1000);
    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      await transaction.userSecurityToken.updateMany({
        where: {
          userId: user.id,
          type,
          usedAt: null
        },
        data: {
          usedAt: now
        }
      });

      await transaction.userSecurityToken.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          type,
          tokenHash,
          expiresAt
        }
      });
    });

    return { rawToken, expiresAt };
  }

  private async requireUsableSecurityToken(
    rawToken: string,
    type: SecurityTokenType
  ): Promise<UserSecurityToken & { user: User }> {
    const tokenHash = this.hashToken(rawToken.trim());
    const token = await this.prisma.userSecurityToken.findFirst({
      where: {
        tokenHash,
        type,
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    });

    if (!token || token.user.deletedAt) {
      throw new UnauthorizedException(
        type === "ACTIVATION"
          ? "Lien d’activation invalide ou expiré."
          : "Token de réinitialisation invalide ou expiré."
      );
    }

    return token;
  }

  private async securityTokenStatus(
    rawToken: string,
    type: SecurityTokenType
  ): Promise<TokenStatusResponse> {
    if (!rawToken.trim()) return { valid: false };

    const token = await this.prisma.userSecurityToken.findFirst({
      where: {
        tokenHash: this.hashToken(rawToken.trim()),
        type,
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      select: {
        expiresAt: true,
        user: {
          select: {
            deletedAt: true,
            isActive: true,
            status: true
          }
        }
      }
    });

    if (!token || token.user.deletedAt) return { valid: false };
    if (type === "ACTIVATION" && token.user.status !== "PENDING_ACTIVATION") {
      return { valid: false };
    }
    if (type === "PASSWORD_RESET" && !this.isEligibleForPasswordReset(token.user)) {
      return { valid: false };
    }

    return { valid: true, expiresAt: token.expiresAt.toISOString() };
  }

  private async sendActivationEmail(user: User, token: string, expiresAt: Date): Promise<void> {
    const targetAddress = this.userEmailAddress(user);
    if (!targetAddress) {
      throw new BadRequestException("Aucune adresse email disponible pour envoyer l’activation.");
    }

    const activationUrl = this.buildPublicUrl("/activate", token);
    const displayName = user.displayName || user.username;
    const expirationDate = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: this.configService.get<string>("APP_TIMEZONE", "Europe/Paris")
    }).format(expiresAt);

    await this.notificationGateway.dispatch({
      notificationId: randomUUID(),
      tenantId: user.tenantId,
      channel: "EMAIL",
      targetAddress,
      title: "Activation de votre compte GestSchool",
      message: [
        `Bonjour ${displayName},`,
        "",
        "Un compte a été créé pour vous sur GestSchool - Al Manarat Islamiyat.",
        "",
        "Pour finaliser votre première connexion, cliquez sur le lien ci-dessous :",
        activationUrl,
        "",
        `Ce lien expire le ${expirationDate}.`,
        "",
        "Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.",
        "",
        "Al Manarat Islamiyat"
      ].join("\n")
    });
  }

  private async sendPasswordResetEmail(user: User, token: string, expiresAt: Date): Promise<void> {
    const targetAddress = this.userEmailAddress(user);
    if (!targetAddress) {
      return;
    }

    const resetUrl = this.buildPublicUrl("/reset-password", token);
    const displayName = user.displayName || user.username;
    const expirationDate = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: this.configService.get<string>("APP_TIMEZONE", "Europe/Paris")
    }).format(expiresAt);

    await this.notificationGateway.dispatch({
      notificationId: randomUUID(),
      tenantId: user.tenantId,
      channel: "EMAIL",
      targetAddress,
      title: "Réinitialisation de votre mot de passe GestSchool",
      message: [
        `Bonjour ${displayName},`,
        "",
        "Vous avez demandé la réinitialisation de votre mot de passe GestSchool.",
        "",
        "Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe :",
        resetUrl,
        "",
        `Ce lien expire le ${expirationDate}.`,
        "",
        "Si vous n’avez pas demandé cette opération, ignorez cet email.",
        "",
        "Al Manarat Islamiyat"
      ].join("\n")
    });
  }

  private buildPublicUrl(path: "/activate" | "/reset-password", token: string): string {
    const baseUrl = this.resolvePublicBaseUrl();
    return `${baseUrl}${path}?token=${encodeURIComponent(token)}`;
  }

  private resolvePublicBaseUrl(): string {
    const isProduction =
      this.configService.get<string>("NODE_ENV", "development").trim().toLowerCase() ===
      "production";
    const configuredCandidates = [
      this.configService.get<string>("AUTH_PUBLIC_BASE_URL", ""),
      this.configService.get<string>("FRONTEND_APP_URL", ""),
      this.configService.get<string>("APP_PUBLIC_URL", "")
    ];
    const corsCandidates = this.configService
      .get<string>("CORS_ORIGINS", "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const fallbackCandidates = isProduction
      ? ["https://gestschool.vercel.app"]
      : ["http://localhost:5173"];

    for (const candidate of [...configuredCandidates, ...corsCandidates, ...fallbackCandidates]) {
      const normalized = this.normalizePublicBaseUrl(candidate);
      if (!normalized) continue;
      if (isProduction && !this.isProductionSafePublicUrl(normalized)) continue;
      return normalized;
    }

    throw new Error("AUTH_PUBLIC_BASE_URL must be configured with a public HTTPS URL.");
  }

  private normalizePublicBaseUrl(rawValue: string): string | null {
    const value = rawValue.trim();
    if (!value || value === "*") return null;

    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

      const pathname = parsed.pathname.replace(/\/+$/, "");
      return `${parsed.origin}${pathname === "/" ? "" : pathname}`.replace(/\/+$/, "");
    } catch {
      return null;
    }
  }

  private isProductionSafePublicUrl(baseUrl: string): boolean {
    const parsed = new URL(baseUrl);
    const hostname = parsed.hostname.toLowerCase();

    if (parsed.protocol !== "https:") return false;
    if (hostname === "localhost" || hostname === "0.0.0.0" || hostname === "::1") return false;
    if (hostname.startsWith("127.")) return false;
    if (hostname.startsWith("10.")) return false;
    if (hostname.startsWith("192.168.")) return false;

    const secondOctet = Number(hostname.split(".")[1]);
    if (
      hostname.startsWith("172.") &&
      Number.isFinite(secondOctet) &&
      secondOctet >= 16 &&
      secondOctet <= 31
    ) {
      return false;
    }

    return true;
  }

  private userEmailAddress(user: Pick<User, "email" | "username">): string | null {
    const candidates = [user.email, user.username];
    for (const candidate of candidates) {
      const value = candidate?.trim();
      if (value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return value;
    }
    return null;
  }

  private isEligibleForPasswordReset(
    user: Pick<User, "isActive" | "status" | "deletedAt">
  ): boolean {
    if (user.deletedAt) return false;
    const status = this.userStatus(user);
    return user.isActive && status === "ACTIVE";
  }

  private userStatus(user: Pick<User, "status">): string {
    return (user.status || "ACTIVE").trim().toUpperCase();
  }

  private async issueTokens(user: User): Promise<AuthTokensResponse> {
    const expiresIn = this.configService.get<string>("JWT_EXPIRES_IN", "1h");
    const expiresInSeconds = this.resolveExpirationSeconds(expiresIn);
    const refreshDaysRaw = this.configService.get<string>(
      "REFRESH_TOKEN_TTL_DAYS",
      "30"
    );
    const refreshDaysCandidate = Number(refreshDaysRaw);
    const refreshDays =
      Number.isFinite(refreshDaysCandidate) && refreshDaysCandidate > 0
        ? refreshDaysCandidate
        : 30;

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId
      },
      {
        expiresIn: expiresInSeconds,
        issuer: this.getJwtIssuer(),
        audience: this.getJwtAudience()
      }
    );

    const rawRefreshToken = randomBytes(48).toString("base64url");
    const refreshTokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt
      }
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      tokenType: "Bearer",
      expiresIn,
      user: {
        id: user.id,
        username: user.username,
        role: user.role as UserRole,
        tenantId: user.tenantId
      }
    };
  }

  private getDefaultTenantId(): string {
    return this.configService.get<string>(
      "DEFAULT_TENANT_ID",
      "00000000-0000-0000-0000-000000000001"
    );
  }

  private getJwtIssuer(): string {
    return this.configService.get<string>("JWT_ISSUER", "gestschool");
  }

  private getJwtAudience(): string {
    return this.configService.get<string>("JWT_AUDIENCE", "gestschool-clients");
  }

  private assertPasswordPolicy(password: string, username?: string): void {
    const violation = findPasswordPolicyViolation(password, username);
    if (violation) {
      throw new BadRequestException(violation);
    }
  }

  private async replaceUserPassword(
    user: Pick<User, "id" | "tenantId">,
    nextPassword: string,
    consumedTokenId?: string
  ): Promise<void> {
    const now = new Date();
    const passwordHash = await hash(nextPassword, 10);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePasswordAtFirstLogin: false,
          updatedAt: now
        }
      });

      if (consumedTokenId) {
        await transaction.userSecurityToken.update({
          where: { id: consumedTokenId },
          data: { usedAt: now }
        });
      }

      await transaction.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });
    });
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private resolveExpirationSeconds(expiresIn: string): number {
    const pattern = /^(\d+)([smhd])?$/i;
    const match = expiresIn.trim().match(pattern);

    if (!match) {
      return 3600;
    }

    const value = Number(match[1]);
    const unit = (match[2] || "s").toLowerCase();

    if (unit === "s") {
      return value;
    }
    if (unit === "m") {
      return value * 60;
    }
    if (unit === "h") {
      return value * 3600;
    }
    return value * 86400;
  }

  private async logAuthAudit(
    tenantId: string,
    userId: string,
    action: string,
    payload?: Prisma.InputJsonValue
  ): Promise<void> {
    try {
      await this.auditService.enqueueLog({
        tenantId,
        userId,
        action,
        resource: "auth",
        payload
      });
    } catch {
      // Never block auth flow because of audit logging issues.
    }
  }
}
