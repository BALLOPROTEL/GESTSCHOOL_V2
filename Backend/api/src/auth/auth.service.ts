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
    const now = new Date();
    await this.logAuthAudit(user.tenantId, user.id, "AUTH_LOGIN_SUCCESS", {
      username: user.username,
      role: user.role
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: now,
        updatedAt: now
      }
    });
    return tokens;
  }

  async refresh(refreshToken: string): Promise<AuthTokensResponse> {
    const tokenHash = this.hashToken(refreshToken);
    const refreshRecord = await this.prisma.refreshToken.findUnique({
      where: {
        tokenHash
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

    const revoked = await this.prisma.refreshToken.updateMany({
      where: {
        id: refreshRecord.id,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      data: { revokedAt: new Date() }
    });
    if (revoked.count !== 1) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

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
    const title = "Activation de votre compte GestSchool";
    const intro = "Un compte a été créé pour vous sur GestSchool - Al Manarat Islamiyat.";
    const instruction =
      "Pour finaliser votre première connexion, cliquez sur le bouton ci-dessous.";

    await this.notificationGateway.dispatch({
      notificationId: randomUUID(),
      tenantId: user.tenantId,
      channel: "EMAIL",
      idempotencyKey: `auth-activation:${this.hashToken(token)}`,
      attemptNo: 1,
      targetAddress,
      title,
      message: [
        `Bonjour ${displayName},`,
        "",
        intro,
        "",
        instruction,
        activationUrl,
        "",
        `Ce lien expire le ${expirationDate}.`,
        "",
        "Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.",
        "",
        "Al Manarat Islamiyat"
      ].join("\n"),
      htmlMessage: this.buildAuthEmailHtml({
        buttonLabel: "Activer mon compte",
        displayName,
        expirationDate,
        intro,
        securityNote: "Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.",
        title,
        url: activationUrl
      })
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
    const title = "Réinitialisation de votre mot de passe GestSchool";
    const intro = "Vous avez demandé la réinitialisation de votre mot de passe GestSchool.";
    const instruction =
      "Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.";

    await this.notificationGateway.dispatch({
      notificationId: randomUUID(),
      tenantId: user.tenantId,
      channel: "EMAIL",
      idempotencyKey: `auth-password-reset:${this.hashToken(token)}`,
      attemptNo: 1,
      targetAddress,
      title,
      message: [
        `Bonjour ${displayName},`,
        "",
        intro,
        "",
        instruction,
        resetUrl,
        "",
        `Ce lien expire le ${expirationDate}.`,
        "",
        "Si vous n’avez pas demandé cette opération, ignorez cet email.",
        "",
        "Al Manarat Islamiyat"
      ].join("\n"),
      htmlMessage: this.buildAuthEmailHtml({
        buttonLabel: "Réinitialiser mon mot de passe",
        displayName,
        expirationDate,
        intro,
        securityNote: "Si vous n’avez pas demandé cette opération, ignorez cet email.",
        title,
        url: resetUrl
      })
    });
  }

  private buildAuthEmailHtml(input: {
    buttonLabel: string;
    displayName: string;
    expirationDate: string;
    intro: string;
    securityNote: string;
    title: string;
    url: string;
  }): string {
    const logoUrl = this.emailLogoUrl();
    const safeButtonLabel = this.escapeHtml(input.buttonLabel);
    const safeDisplayName = this.escapeHtml(input.displayName);
    const safeExpirationDate = this.escapeHtml(input.expirationDate);
    const safeIntro = this.escapeHtml(input.intro);
    const safeSecurityNote = this.escapeHtml(input.securityNote);
    const safeTitle = this.escapeHtml(input.title);
    const safeUrl = this.escapeHtml(input.url);

    return `<!doctype html>
<html lang="fr">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f8fb;color:#101828;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#f4f8fb;margin:0;padding:0;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;border-collapse:collapse;">
            <tr>
              <td style="padding:0 0 18px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="width:64px;height:64px;border-radius:18px;background:#ffffff;border:1px solid #d8e6f3;box-shadow:0 8px 20px rgba(16,24,40,0.08);text-align:center;vertical-align:middle;">
                      <img src="${this.escapeHtml(logoUrl)}" width="56" height="56" alt="Al Manarat Islamiyat" style="display:block;width:56px;height:56px;object-fit:contain;margin:4px auto;border:0;" />
                    </td>
                    <td style="padding-left:14px;vertical-align:middle;">
                      <div style="font-size:20px;font-weight:800;line-height:1.2;color:#07111f;">Al Manarat Islamiyat</div>
                      <div style="font-size:13px;font-weight:600;line-height:1.45;color:#667085;">GestSchool - Espace sécurisé</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #d7e4f2;border-radius:22px;box-shadow:0 20px 44px rgba(16,24,40,0.10);overflow:hidden;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="height:8px;background:#51CED8;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:34px 34px 28px 34px;">
                      <p style="margin:0 0 12px 0;color:#00576b;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;">Compte sécurisé</p>
                      <h1 style="margin:0 0 18px 0;color:#07111f;font-size:28px;line-height:1.18;font-weight:800;">${safeTitle}</h1>
                      <p style="margin:0 0 14px 0;color:#344054;font-size:16px;line-height:1.65;">Bonjour ${safeDisplayName},</p>
                      <p style="margin:0 0 22px 0;color:#344054;font-size:16px;line-height:1.65;">${safeIntro}</p>
                      <p style="margin:0 0 26px 0;color:#344054;font-size:16px;line-height:1.65;">Cliquez sur le bouton ci-dessous pour continuer.</p>
                      <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 26px 0;">
                        <tr>
                          <td bgcolor="#51CED8" style="border-radius:14px;background:#51CED8;">
                            <a href="${safeUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:15px 24px;border-radius:14px;background:#51CED8;color:#07111f;font-size:16px;font-weight:800;text-decoration:none;">${safeButtonLabel}</a>
                          </td>
                        </tr>
                      </table>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:0 0 22px 0;">
                        <tr>
                          <td style="padding:16px 18px;border-radius:14px;background:#f7fbfc;border:1px solid #d9edf1;">
                            <p style="margin:0;color:#475467;font-size:14px;line-height:1.55;">Si le bouton ne s’affiche pas correctement, <a href="${safeUrl}" target="_blank" rel="noopener" style="color:#006b80;font-weight:800;text-decoration:underline;">cliquez ici</a>.</p>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 18px 0;color:#667085;font-size:14px;line-height:1.55;">Ce lien expire le <strong style="color:#344054;">${safeExpirationDate}</strong>.</p>
                      <p style="margin:0;color:#667085;font-size:14px;line-height:1.55;">${safeSecurityNote}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 10px 0 10px;color:#98a2b3;font-size:12px;line-height:1.55;">
                © Al Manarat Islamiyat. Email automatique, merci de ne pas répondre.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private emailLogoUrl(): string {
    const configured = this.configService.get<string>("EMAIL_BRAND_LOGO_URL", "").trim();
    if (configured) return configured;
    return `${this.resolvePublicBaseUrl()}/logo.png`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

    const sessionId = randomUUID();
    const rawRefreshToken = randomBytes(48).toString("base64url");
    const refreshTokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId,
        sid: sessionId
      },
      {
        expiresIn: expiresInSeconds,
        issuer: this.getJwtIssuer(),
        audience: this.getJwtAudience()
      }
    );

    await this.prisma.refreshToken.create({
      data: {
        id: sessionId,
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
      "00000000-0000-4000-8000-000000000001"
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
