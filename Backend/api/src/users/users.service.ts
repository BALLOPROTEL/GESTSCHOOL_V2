import { randomBytes } from "node:crypto";

import { compare, hash } from "bcryptjs";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";

import { AuditService } from "../audit/audit.service";
import { AuthService } from "../auth/auth.service";
import { findPasswordPolicyViolation } from "../common/password-policy";
import { PrismaService } from "../database/prisma.service";
import {
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  hasPermission,
  type PermissionAction,
  type PermissionResource
} from "../security/permissions.types";
import { UserRole } from "../security/roles.enum";
import { FileValidationService } from "../storage/file-validation.service";
import { StorageService } from "../storage/storage.service";
import { type StoredObjectReference } from "../storage/storage-provider";
import { type AccountType, CreateUserDto, type UserStatus } from "./dto/create-user.dto";
import {
  type RolePermissionItemDto,
  UpdateRolePermissionsDto
} from "./dto/update-role-permissions.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ChangeMyPasswordDto, UpdateMyProfileDto } from "./dto/me-profile.dto";

type UserWithProfiles = Prisma.UserGetPayload<{
  include: {
    teacherProfile: true;
    parentProfile: true;
    studentProfile: true;
  };
}>;

export type UserView = {
  id: string;
  tenantId: string;
  username: string;
  role: UserRole;
  roleId: UserRole;
  accountType: AccountType;
  email?: string;
  phone?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  establishmentId?: string;
  staffFunction?: string;
  department?: string;
  notes?: string;
  mustChangePasswordAtFirstLogin: boolean;
  teacherId?: string;
  parentId?: string;
  studentId?: string;
  temporaryPassword?: string;
  status: UserStatus | string;
  activatedAt?: string;
  disabledAt?: string;
  lastLoginAt?: string;
  activationEmailSent?: boolean;
  activationEmailError?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RolePermissionView = {
  role: UserRole;
  resource: PermissionResource;
  action: PermissionAction;
  allowed: boolean;
  source: "DEFAULT" | "CUSTOM";
};

export type UserActivityView = {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  createdAt: string;
};

export type MyProfileView = {
  user: UserView;
  context: {
    tenantId: string;
    tenantName: string;
    activeSchoolYear?: {
      id: string;
      code: string;
      label: string;
      status: string;
      isActive: boolean;
    };
    timeZone: string;
  };
  preferences?: {
    language?: string;
    theme?: string;
    emailNotificationsEnabled?: boolean;
    systemNotificationsEnabled?: boolean;
  };
  permissions: RolePermissionView[];
};

export type MySessionView = {
  id: string;
  label: string;
  createdAt: string;
  expiresAt: string;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly fileValidationService: FileValidationService
  ) {}

  async list(tenantId: string): Promise<UserView[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null
      },
      include: this.userProfileInclude(),
      orderBy: [{ username: "asc" }]
    });

    return rows.map((row) => this.toView(row));
  }

  async getMyProfile(tenantId: string, userId: string): Promise<MyProfileView> {
    const user = await this.requireUserWithProfiles(tenantId, userId);
    return this.toMyProfileView(user);
  }

  async updateMyProfile(
    tenantId: string,
    userId: string,
    payload: UpdateMyProfileDto
  ): Promise<MyProfileView> {
    this.assertNoForbiddenProfileMutation(payload as Record<string, unknown>);
    const existing = await this.requireUser(tenantId, userId);
    const now = new Date();

    const updated = await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: existing.id },
        data: {
          displayName: this.optionalEmptyToNull(payload.displayName),
          firstName: this.optionalEmptyToNull(payload.firstName),
          lastName: this.optionalEmptyToNull(payload.lastName),
          phone: this.optionalEmptyToNull(payload.phone),
          updatedAt: now
        }
      });

      await this.auditService.enqueueLog(
        {
          tenantId,
          userId,
          action: "USER_PROFILE_UPDATED",
          resource: "users",
          resourceId: existing.id,
          payload: {
            displayNameChanged: payload.displayName !== undefined,
            firstNameChanged: payload.firstName !== undefined,
            lastNameChanged: payload.lastName !== undefined,
            phoneChanged: payload.phone !== undefined,
            preferencesChanged:
              payload.language !== undefined ||
              payload.theme !== undefined ||
              payload.emailNotificationsEnabled !== undefined ||
              payload.systemNotificationsEnabled !== undefined
          } as unknown as Prisma.InputJsonValue
        },
        transaction
      );

      return transaction.user.findUniqueOrThrow({
        where: { id: existing.id },
        include: this.userProfileInclude()
      });
    });

    return this.toMyProfileView(updated, {
      language: payload.language,
      theme: payload.theme,
      emailNotificationsEnabled: payload.emailNotificationsEnabled,
      systemNotificationsEnabled: payload.systemNotificationsEnabled
    });
  }

  async uploadMyAvatar(
    tenantId: string,
    userId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer }
  ): Promise<MyProfileView> {
    const existing = await this.requireUser(tenantId, userId);
    const validated = await this.fileValidationService.validate(file, "avatar");
    const stored = await this.uploadAvatarToStorage(tenantId, userId, validated);
    const previousReference = this.avatarStorageReference(existing);
    let updated: UserWithProfiles;
    try {
      updated = await this.prisma.$transaction(async (transaction) => {
        const mutation = await transaction.user.updateMany({
          where: {
            id: existing.id,
            tenantId,
            updatedAt: existing.updatedAt,
            avatarStorageDriver: existing.avatarStorageDriver,
            avatarStorageBucket: existing.avatarStorageBucket,
            avatarStorageKey: existing.avatarStorageKey
          },
          data: {
            avatarUrl: null,
            avatarStorageDriver: stored.driver,
            avatarStorageBucket: stored.bucket,
            avatarStorageKey: stored.key,
            avatarMimeType: stored.mimeType,
            avatarSize: stored.size,
            updatedAt: new Date()
          }
        });
        if (mutation.count !== 1) {
          throw new ConflictException(
            "Le profil a changé pendant l’upload. Rechargez la page puis réessayez."
          );
        }

        await this.auditService.enqueueLog(
          {
            tenantId,
            userId,
            action: "USER_AVATAR_UPDATED",
            resource: "users",
            resourceId: existing.id,
            payload: {
              driver: stored.driver,
              bucket: stored.bucket,
              key: stored.key,
              mimeType: stored.mimeType,
              size: stored.size
            } as unknown as Prisma.InputJsonValue
          },
          transaction
        );

        return transaction.user.findUniqueOrThrow({
          where: { id: existing.id },
          include: this.userProfileInclude()
        });
      });
    } catch (error) {
      await this.deleteStoredObjectAfterFailure(stored, "new avatar rollback");
      throw error;
    }

    if (previousReference) {
      try {
        await this.storageService.deleteFile(previousReference);
      } catch (error) {
        await this.rollbackAvatarReplacement(existing, stored, error);
        throw new ServiceUnavailableException(
          "La photo précédente n'a pas pu être remplacée sans risque. Le profil a été restauré."
        );
      }
    }
    return this.toMyProfileView(updated);
  }

  private async uploadAvatarToStorage(
    tenantId: string,
    userId: string,
    file: Awaited<ReturnType<FileValidationService["validate"]>>
  ) {
    try {
      return await this.storageService.storeValidatedFile({
        tenantId,
        bucketKind: "avatars",
        scope: ["avatars", userId],
        file
      });
    } catch (error) {
      this.logger.error(
        `Unable to upload avatar for user ${userId}`,
        error instanceof Error ? error.stack : undefined
      );
      throw new ServiceUnavailableException(this.avatarStorageFailureMessage(error));
    }
  }

  private avatarStorageFailureMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : "";
    const normalized = message.toLowerCase();

    if (normalized.includes("supabase_url is required")) {
      return "Configuration Supabase incomplète : SUPABASE_URL est manquant côté API.";
    }
    if (normalized.includes("supabase_service_role_key is required")) {
      return "Configuration Supabase incomplète : SUPABASE_SERVICE_ROLE_KEY est manquant côté API.";
    }
    if (
      normalized.includes("(401)") ||
      normalized.includes("(403)") ||
      normalized.includes("invalid compact jws") ||
      normalized.includes("jwt") ||
      normalized.includes("unauthorized")
    ) {
      return "Supabase refuse l’upload avatar. Vérifiez que SUPABASE_SERVICE_ROLE_KEY est bien la clé service_role du projet Supabase.";
    }
    if (normalized.includes("bucket") && normalized.includes("not found")) {
      return "Le bucket Supabase des avatars est introuvable. Créez le bucket gestschool-avatars ou vérifiez SUPABASE_STORAGE_BUCKET_AVATARS.";
    }
    if (normalized.includes("(404)")) {
      return "Supabase Storage renvoie 404. Vérifiez SUPABASE_URL côté API : elle doit ressembler à https://<project-ref>.supabase.co, sans /storage/v1.";
    }
    if (
      normalized.includes("row-level security") ||
      normalized.includes("violates row-level security") ||
      normalized.includes("rls")
    ) {
      return "Supabase bloque l’écriture Storage par une policy RLS. Vérifiez que SUPABASE_SERVICE_ROLE_KEY est la clé service_role et que le bucket avatars accepte les uploads serveur.";
    }
    if (normalized.includes("invalid api key") || normalized.includes("api key")) {
      return "Supabase refuse la clé API. Vérifiez SUPABASE_SERVICE_ROLE_KEY dans Render et recolle la clé service_role complète.";
    }
    if (normalized.includes("(413)") || normalized.includes("payload too large")) {
      return "L’image est trop lourde pour Supabase Storage. Utilisez une image JPG, PNG ou WebP de 2 Mo maximum.";
    }
    if (normalized.includes("(415)") || normalized.includes("mime")) {
      return "Supabase refuse le type de fichier. Utilisez uniquement JPG, PNG ou WebP.";
    }
    if (
      normalized.includes("fetch failed") ||
      normalized.includes("enotfound") ||
      normalized.includes("econnrefused")
    ) {
      return "Supabase Storage est inaccessible depuis l’API. Vérifiez SUPABASE_URL et la connectivité Render.";
    }

    return `Le stockage avatar Supabase est indisponible. Diagnostic sécurisé : ${this.sanitizeAvatarStorageDiagnostic(message)}.`;
  }

  private sanitizeAvatarStorageDiagnostic(message: string): string {
    return (
      message
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [masqué]")
        .replace(/apikey["':=\s]+[A-Za-z0-9._-]+/gi, "apikey [masqué]")
        .replace(/service[_-]?role[_-]?key["':=\s]+[A-Za-z0-9._-]+/gi, "service_role_key [masqué]")
        .replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}/g, "[jwt masqué]")
        .slice(0, 320) || "erreur Supabase non détaillée"
    );
  }

  async removeMyAvatar(tenantId: string, userId: string): Promise<MyProfileView> {
    const existing = await this.requireUser(tenantId, userId);
    const previousReference = this.avatarStorageReference(existing);
    const updated = await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: existing.id },
        data: {
          avatarUrl: null,
          avatarStorageDriver: null,
          avatarStorageBucket: null,
          avatarStorageKey: null,
          avatarMimeType: null,
          avatarSize: null,
          updatedAt: new Date()
        }
      });

      await this.auditService.enqueueLog(
        {
          tenantId,
          userId,
          action: "USER_AVATAR_REMOVED",
          resource: "users",
          resourceId: existing.id,
          payload: {} as Prisma.InputJsonValue
        },
        transaction
      );

      return transaction.user.findUniqueOrThrow({
        where: { id: existing.id },
        include: this.userProfileInclude()
      });
    });

    if (previousReference) {
      try {
        await this.storageService.deleteFile(previousReference);
      } catch (error) {
        await this.restoreAvatarMetadata(existing, "USER_AVATAR_REMOVE_ROLLED_BACK", error);
        throw new ServiceUnavailableException(
          "La photo n'a pas pu être supprimée du stockage. Le profil a été restauré."
        );
      }
    }
    return this.toMyProfileView(updated);
  }

  private async rollbackAvatarReplacement(
    previous: User,
    replacement: StoredObjectReference,
    providerError: unknown
  ): Promise<void> {
    await this.restoreAvatarMetadata(previous, "USER_AVATAR_UPDATE_ROLLED_BACK", providerError);
    await this.deleteStoredObjectAfterFailure(replacement, "replacement avatar rollback");
  }

  private async restoreAvatarMetadata(
    previous: User,
    auditAction: string,
    providerError: unknown
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.user.update({
          where: { id: previous.id },
          data: {
            avatarUrl: previous.avatarUrl,
            avatarStorageDriver: previous.avatarStorageDriver,
            avatarStorageBucket: previous.avatarStorageBucket,
            avatarStorageKey: previous.avatarStorageKey,
            avatarMimeType: previous.avatarMimeType,
            avatarSize: previous.avatarSize,
            updatedAt: new Date()
          }
        });
        await this.auditService.enqueueLog(
          {
            tenantId: previous.tenantId,
            userId: previous.id,
            action: auditAction,
            resource: "users",
            resourceId: previous.id,
            payload: { reason: "storage_provider_failure" } as Prisma.InputJsonValue
          },
          transaction
        );
      });
    } catch (rollbackError) {
      this.logger.error(
        `Critical avatar metadata rollback failure for user ${previous.id}`,
        rollbackError instanceof Error ? rollbackError.stack : undefined
      );
      throw new ServiceUnavailableException(
        "Le stockage et le profil n'ont pas pu être resynchronisés automatiquement."
      );
    } finally {
      this.logger.error(
        `Avatar storage operation failed for user ${previous.id}`,
        providerError instanceof Error ? providerError.stack : undefined
      );
    }
  }

  private avatarStorageReference(user: User): StoredObjectReference | null {
    const driver = user.avatarStorageDriver;
    if (
      (driver !== "LOCAL" && driver !== "SUPABASE") ||
      !user.avatarStorageBucket ||
      !user.avatarStorageKey
    ) {
      return null;
    }
    return {
      driver,
      bucket: user.avatarStorageBucket,
      key: user.avatarStorageKey,
      tenantId: user.tenantId
    };
  }

  private async deleteStoredObjectAfterFailure(
    reference: StoredObjectReference,
    context: string
  ): Promise<void> {
    try {
      await this.storageService.deleteFile(reference);
    } catch (error) {
      this.logger.error(
        `Storage cleanup failed (${context}) for ${reference.driver}:${reference.bucket}/${reference.key}`,
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  async changeMyPassword(
    tenantId: string,
    userId: string,
    payload: ChangeMyPasswordDto
  ): Promise<{ message: string }> {
    if (payload.newPassword !== payload.confirmPassword) {
      throw new BadRequestException("La confirmation du mot de passe ne correspond pas.");
    }

    const user = await this.requireUser(tenantId, userId);
    const currentPasswordValid = await compare(payload.currentPassword, user.passwordHash);
    if (!currentPasswordValid) {
      throw new BadRequestException("Le mot de passe actuel est incorrect.");
    }

    this.assertPasswordPolicy(payload.newPassword, user.username);
    const samePassword = await compare(payload.newPassword, user.passwordHash);
    if (samePassword) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l’ancien.");
    }

    const passwordHash = await hash(payload.newPassword, 10);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePasswordAtFirstLogin: false,
          updatedAt: new Date()
        }
      });

      await transaction.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });

      await this.auditService.enqueueLog(
        {
          tenantId,
          userId,
          action: "USER_PASSWORD_CHANGED",
          resource: "users",
          resourceId: user.id,
          payload: {
            username: user.username
          } as unknown as Prisma.InputJsonValue
        },
        transaction
      );
    });

    return { message: "Mot de passe modifié avec succès." };
  }

  async listMyActivity(tenantId: string, userId: string): Promise<UserActivityView[]> {
    const rows = await this.prisma.iamAuditLog.findMany({
      where: {
        tenantId,
        userId
      },
      orderBy: [{ createdAt: "desc" }],
      take: 10
    });

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      resource: row.resource,
      resourceId: row.resourceId || undefined,
      createdAt: row.createdAt.toISOString()
    }));
  }

  async listMySessions(tenantId: string, userId: string): Promise<MySessionView[]> {
    const rows = await this.prisma.refreshToken.findMany({
      where: {
        tenantId,
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: 20
    });

    return rows.map((row, index) => ({
      id: row.id,
      label: index === 0 ? "Session active" : `Session ${index + 1}`,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString()
    }));
  }

  async logoutAllMySessions(tenantId: string, userId: string): Promise<{ revokedSessions: number }> {
    const now = new Date();
    const result = await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshToken.updateMany({
        where: {
          tenantId,
          userId,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });

      await this.auditService.enqueueLog(
        {
          tenantId,
          userId,
          action: "USER_SESSIONS_REVOKED",
          resource: "users",
          resourceId: userId,
          payload: {
            revokedSessions: revoked.count
          } as unknown as Prisma.InputJsonValue
        },
        transaction
      );

      return revoked;
    });

    return { revokedSessions: result.count };
  }

  async create(
    tenantId: string,
    actorUserId: string,
    payload: CreateUserDto
  ): Promise<UserView> {
    const role = this.resolveRole(payload.roleId, payload.role);
    const accountType = payload.accountType || this.inferAccountType(role);
    this.assertAccountRoleCompatibility(accountType, role);
    this.assertAttachmentPayload(accountType, payload);
    const passwordMode = payload.passwordMode || "AUTO";
    if (passwordMode === "MANUAL" && payload.password !== payload.confirmPassword) {
      throw new BadRequestException("La confirmation du mot de passe ne correspond pas.");
    }

    const status = this.resolveInitialUserStatus(payload);
    const password = passwordMode === "AUTO" ? this.generateTemporaryPassword() : payload.password;
    if (!password) {
      throw new BadRequestException("Mot de passe requis en mode manuel.");
    }
    this.assertPasswordPolicy(password, payload.username);
    const passwordHash = await hash(password, 10);
    const identity = await this.resolveIdentityForCreate(tenantId, payload, accountType);
    const mustChangePasswordAtFirstLogin =
      status === "PENDING_ACTIVATION"
        ? false
        : payload.mustChangePasswordAtFirstLogin ?? passwordMode === "AUTO";
    const isActive = status === "ACTIVE";

    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            tenantId,
            username: payload.username.trim(),
            email: identity.email || this.emptyToNull(payload.email),
            phone: identity.phone || this.emptyToNull(payload.phone),
            passwordHash,
            role,
            accountType,
            displayName: identity.displayName,
            firstName: identity.firstName,
            lastName: identity.lastName,
            avatarUrl: null,
            establishmentId: payload.establishmentId || identity.establishmentId,
            staffFunction: this.emptyToNull(payload.staffFunction),
            department: this.emptyToNull(payload.department),
            notes: this.emptyToNull(payload.notes),
            mustChangePasswordAtFirstLogin,
            status,
            isActive,
            activatedAt: status === "ACTIVE" ? new Date() : null,
            disabledAt: status === "INACTIVE" || status === "ARCHIVED" ? new Date() : null,
            updatedAt: new Date()
          }
        });

        await this.attachBusinessProfile(transaction, tenantId, user.id, accountType, {
          teacherId: payload.teacherId,
          parentId: payload.parentId,
          studentId: payload.studentId
        });

        await this.auditService.enqueueLog(
          {
            tenantId,
            userId: actorUserId,
            action: "USER_CREATED",
            resource: "users",
            resourceId: user.id,
            payload: {
              username: user.username,
              role: user.role,
              accountType: user.accountType,
              status: user.status,
              isActive: user.isActive,
              teacherId: payload.teacherId,
              parentId: payload.parentId,
              studentId: payload.studentId
            } as unknown as Prisma.InputJsonValue
          },
          transaction
        );

        return transaction.user.findUniqueOrThrow({
          where: { id: user.id },
          include: this.userProfileInclude()
        });
      });

      let activationEmailSent = false;
      let activationEmailError: string | undefined;
      if (status === "PENDING_ACTIVATION" && payload.sendActivationEmail !== false) {
        try {
          const delivery = await this.authService.createActivationForUser(created.id);
          activationEmailSent = delivery.sent;
        } catch (error) {
          activationEmailError =
            error instanceof Error ? error.message : "Email d’activation non envoyé.";
        }
      }

      return {
        ...this.toView(created),
        activationEmailSent,
        activationEmailError
      };
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Username, email or business profile already linked for this tenant.");
      throw error;
    }
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    payload: UpdateUserDto
  ): Promise<UserView> {
    const existing = await this.requireUser(tenantId, id);
    if (existing.id === actorUserId && payload.isActive === false) {
      throw new ConflictException("You cannot deactivate your own account.");
    }
    const nextAccountType = payload.accountType || this.inferAccountType(existing.role as UserRole, existing.accountType);
    const nextRole = this.resolveRole(payload.roleId, payload.role, existing.role as UserRole);
    const touchesIamModel =
      payload.accountType !== undefined ||
      payload.roleId !== undefined ||
      payload.role !== undefined ||
      payload.teacherId !== undefined ||
      payload.parentId !== undefined ||
      payload.studentId !== undefined;

    if (touchesIamModel) {
      this.assertAccountRoleCompatibility(nextAccountType, nextRole);
      this.assertAttachmentPayload(nextAccountType, {
        ...payload,
        teacherId: payload.teacherId,
        parentId: payload.parentId,
        studentId: payload.studentId
      });
    }

    if (payload.passwordMode === "MANUAL" && payload.password !== payload.confirmPassword) {
      throw new BadRequestException("La confirmation du mot de passe ne correspond pas.");
    }
    if (payload.passwordMode === "AUTO") {
      throw new BadRequestException("La regeneration automatique du mot de passe n'est pas disponible sur la modification.");
    }

    const identity = touchesIamModel
      ? await this.resolveIdentityForUpdate(tenantId, existing, {
          ...payload,
          accountType: nextAccountType,
          roleId: nextRole
        })
      : undefined;
    const statusPatch = this.resolveUpdatedUserStatus(existing, payload);
    const now = new Date();

    const data: Prisma.UserUpdateInput = {
      username: payload.username?.trim(),
      email: identity?.email ?? this.optionalEmptyToNull(payload.email),
      phone: identity?.phone ?? this.optionalEmptyToNull(payload.phone),
      role: touchesIamModel ? nextRole : undefined,
      accountType: touchesIamModel ? nextAccountType : undefined,
      displayName: identity?.displayName ?? this.optionalEmptyToNull(payload.displayName),
      firstName: identity?.firstName ?? this.optionalEmptyToNull(payload.firstName),
      lastName: identity?.lastName ?? this.optionalEmptyToNull(payload.lastName),
      establishmentId: payload.establishmentId ?? identity?.establishmentId,
      staffFunction: this.optionalEmptyToNull(payload.staffFunction),
      department: this.optionalEmptyToNull(payload.department),
      notes: this.optionalEmptyToNull(payload.notes),
      mustChangePasswordAtFirstLogin: payload.mustChangePasswordAtFirstLogin,
      status: statusPatch,
      isActive: statusPatch ? statusPatch === "ACTIVE" : payload.isActive,
      activatedAt: statusPatch === "ACTIVE" && !existing.activatedAt ? now : undefined,
      disabledAt:
        statusPatch === "INACTIVE" || statusPatch === "ARCHIVED"
          ? now
          : statusPatch === "ACTIVE"
            ? null
            : undefined,
      updatedAt: now
    };

    if (payload.password) {
      const usernameForPolicy = payload.username?.trim() || existing.username;
      this.assertPasswordPolicy(payload.password, usernameForPolicy);
      const samePassword = await compare(payload.password, existing.passwordHash);
      if (samePassword) {
        throw new BadRequestException("Le nouveau mot de passe doit etre different de l'ancien.");
      }
      data.passwordHash = await hash(payload.password, 10);
    }

    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        await transaction.user.update({
          where: { id: existing.id },
          data
        });

        if (touchesIamModel) {
          await this.attachBusinessProfile(transaction, tenantId, existing.id, nextAccountType, {
            teacherId: payload.teacherId,
            parentId: payload.parentId,
            studentId: payload.studentId
          });
        }

        if (
          payload.isActive === false ||
          statusPatch === "INACTIVE" ||
          statusPatch === "ARCHIVED" ||
          payload.password
        ) {
          await transaction.refreshToken.updateMany({
            where: {
              userId: existing.id,
              revokedAt: null
            },
            data: {
              revokedAt: new Date()
            }
          });
        }

        return transaction.user.findUniqueOrThrow({
          where: { id: existing.id },
          include: this.userProfileInclude()
        });
      });

      await this.logAudit(tenantId, actorUserId, "USER_UPDATED", "users", updated.id, {
        username: updated.username,
        role: updated.role,
        accountType: updated.accountType,
        status: updated.status,
        isActive: updated.isActive
      });

      return this.toView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Username, email or business profile already linked for this tenant.");
      throw error;
    }
  }

  async remove(tenantId: string, actorUserId: string, id: string): Promise<void> {
    if (id === actorUserId) {
      throw new ConflictException("You cannot delete your own account.");
    }

    const existing = await this.requireUser(tenantId, id);
    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: existing.id },
        data: {
          isActive: false,
          status: "ARCHIVED",
          disabledAt: now,
          deletedAt: now,
          updatedAt: now
        }
      });

      await transaction.refreshToken.updateMany({
        where: {
          userId: existing.id,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });

      await this.auditService.enqueueLog(
        {
          tenantId,
          userId: actorUserId,
          action: "USER_DELETED",
          resource: "users",
          resourceId: existing.id,
          payload: {
            username: existing.username
          }
        },
        transaction
      );
    });
  }

  async sendActivation(
    tenantId: string,
    actorUserId: string,
    id: string
  ): Promise<{ message: string; sent: boolean }> {
    const existing = await this.requireUser(tenantId, id);
    if (existing.status !== "PENDING_ACTIVATION") {
      throw new ConflictException("Ce compte n’est pas en attente d’activation.");
    }

    const delivery = await this.authService.createActivationForUser(existing.id);
    await this.logAudit(tenantId, actorUserId, "USER_ACTIVATION_SENT", "users", existing.id, {
      username: existing.username
    });
    return delivery;
  }

  async listRolePermissions(
    tenantId: string,
    role: UserRole
  ): Promise<RolePermissionView[]> {
    const customRows = await this.prisma.rolePermission.findMany({
      where: {
        tenantId,
        role
      }
    });

    const customMap = new Map<string, boolean>();
    for (const row of customRows) {
      customMap.set(`${row.resource}:${row.action}`, row.allowed);
    }

    const entries: RolePermissionView[] = [];
    for (const resource of PERMISSION_RESOURCES) {
      for (const action of PERMISSION_ACTIONS) {
        const key = `${resource}:${action}`;
        const defaultAllowed = hasPermission(role, { resource, action });
        if (!defaultAllowed && !customMap.has(key)) {
          continue;
        }

        entries.push({
          role,
          resource,
          action,
          allowed: customMap.has(key) ? customMap.get(key) === true : defaultAllowed,
          source: customMap.has(key) ? "CUSTOM" : "DEFAULT"
        });
      }
    }

    return entries.sort(
      (left, right) =>
        left.resource.localeCompare(right.resource) ||
        left.action.localeCompare(right.action)
    );
  }

  async updateRolePermissions(
    tenantId: string,
    actorUserId: string,
    role: UserRole,
    payload: UpdateRolePermissionsDto
  ): Promise<RolePermissionView[]> {
    const normalized = new Map<string, RolePermissionItemDto>();
    for (const item of payload.permissions) {
      normalized.set(`${item.resource}:${item.action}`, item);
    }

    await this.prisma.$transaction(async (transaction) => {
      for (const item of normalized.values()) {
        const defaultAllowed = hasPermission(role, {
          resource: item.resource,
          action: item.action
        });

        if (item.allowed === defaultAllowed) {
          await transaction.rolePermission.deleteMany({
            where: {
              tenantId,
              role,
              resource: item.resource,
              action: item.action
            }
          });
          continue;
        }

        await transaction.rolePermission.upsert({
          where: {
            tenantId_role_resource_action: {
              tenantId,
              role,
              resource: item.resource,
              action: item.action
            }
          },
          create: {
            tenantId,
            role,
            resource: item.resource,
            action: item.action,
            allowed: item.allowed,
            updatedAt: new Date()
          },
          update: {
            allowed: item.allowed,
            updatedAt: new Date()
          }
        });
      }

      await this.auditService.enqueueLog(
        {
          tenantId,
          userId: actorUserId,
          action: "ROLE_PERMISSIONS_UPDATED",
          resource: "role_permissions",
          payload: {
            role,
            updatedPermissions: [...normalized.values()]
          } as unknown as Prisma.InputJsonValue
        },
        transaction
      );
    });

    return this.listRolePermissions(tenantId, role);
  }

  private userProfileInclude() {
    return {
      teacherProfile: true,
      parentProfile: true,
      studentProfile: true
    } satisfies Prisma.UserInclude;
  }

  private resolveRole(roleId?: UserRole, legacyRole?: UserRole, fallback?: UserRole): UserRole {
    const role = roleId || legacyRole || fallback;
    if (!role || !Object.values(UserRole).includes(role)) {
      throw new BadRequestException("Role d'acces requis.");
    }
    return role;
  }

  private resolveInitialUserStatus(payload: CreateUserDto): UserStatus {
    if (payload.status) return payload.status;
    if (payload.isActive === false) return "INACTIVE";
    return "PENDING_ACTIVATION";
  }

  private resolveUpdatedUserStatus(
    existing: Pick<User, "status">,
    payload: UpdateUserDto
  ): UserStatus | undefined {
    if (payload.status) return payload.status as UserStatus;
    if (payload.isActive === true) return "ACTIVE";
    if (payload.isActive === false) return "INACTIVE";
    return existing.status as UserStatus | undefined;
  }

  private inferAccountType(role: UserRole, storedAccountType?: string | null): AccountType {
    if (storedAccountType && ["STAFF", "TEACHER", "PARENT", "STUDENT"].includes(storedAccountType)) {
      return storedAccountType as AccountType;
    }
    if (role === UserRole.ENSEIGNANT) return "TEACHER";
    if (role === UserRole.PARENT) return "PARENT";
    if (role === UserRole.STUDENT) return "STUDENT";
    return "STAFF";
  }

  private assertAccountRoleCompatibility(accountType: AccountType, role: UserRole): void {
    const allowedRoles: Record<AccountType, UserRole[]> = {
      STAFF: [UserRole.ADMIN, UserRole.SCOLARITE, UserRole.COMPTABLE],
      TEACHER: [UserRole.ENSEIGNANT],
      PARENT: [UserRole.PARENT],
      STUDENT: [UserRole.STUDENT]
    };

    if (!allowedRoles[accountType].includes(role)) {
      throw new ConflictException("Le type de compte et le role d'acces selectionnes sont incompatibles.");
    }
  }

  private assertAttachmentPayload(
    accountType: AccountType,
    payload: {
      teacherId?: string;
      parentId?: string;
      studentId?: string;
      staffDisplayName?: string;
      displayName?: string;
    }
  ): void {
    const hasTeacher = Boolean(payload.teacherId);
    const hasParent = Boolean(payload.parentId);
    const hasStudent = Boolean(payload.studentId);

    if (accountType === "TEACHER" && (!hasTeacher || hasParent || hasStudent)) {
      throw new BadRequestException("Un compte enseignant doit etre rattache uniquement a une fiche enseignant.");
    }
    if (accountType === "PARENT" && (!hasParent || hasTeacher || hasStudent)) {
      throw new BadRequestException("Un compte parent doit etre rattache uniquement a une fiche parent.");
    }
    if (accountType === "STUDENT" && (!hasStudent || hasTeacher || hasParent)) {
      throw new BadRequestException("Un compte eleve doit etre rattache uniquement a une fiche eleve.");
    }
    if (accountType === "STAFF" && (hasTeacher || hasParent || hasStudent)) {
      throw new BadRequestException("Un compte staff ne doit pas etre rattache a une fiche enseignant, parent ou eleve.");
    }
    if (accountType === "STAFF" && !payload.staffDisplayName?.trim() && !payload.displayName?.trim()) {
      throw new BadRequestException("Le nom affiche staff est requis.");
    }
  }

  private async resolveIdentityForCreate(
    tenantId: string,
    payload: CreateUserDto,
    accountType: AccountType
  ): Promise<{
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    establishmentId: string | null;
  }> {
    return this.resolveBusinessIdentity(tenantId, undefined, {
      accountType,
      teacherId: payload.teacherId,
      parentId: payload.parentId,
      studentId: payload.studentId,
      staffDisplayName: payload.staffDisplayName,
      displayName: payload.displayName,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      establishmentId: payload.establishmentId
    });
  }

  private async resolveIdentityForUpdate(
    tenantId: string,
    existing: User,
    payload: UpdateUserDto & { accountType: AccountType; roleId: UserRole }
  ): Promise<{
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    establishmentId: string | null;
  }> {
    return this.resolveBusinessIdentity(tenantId, existing.id, {
      accountType: payload.accountType,
      teacherId: payload.teacherId,
      parentId: payload.parentId,
      studentId: payload.studentId,
      staffDisplayName: payload.staffDisplayName,
      displayName: payload.displayName,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      establishmentId: payload.establishmentId
    });
  }

  private async resolveBusinessIdentity(
    tenantId: string,
    currentUserId: string | undefined,
    payload: {
      accountType: AccountType;
      teacherId?: string;
      parentId?: string;
      studentId?: string;
      staffDisplayName?: string;
      displayName?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      establishmentId?: string;
    }
  ): Promise<{
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    establishmentId: string | null;
  }> {
    if (payload.accountType === "TEACHER") {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: payload.teacherId, tenantId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          primaryPhone: true,
          establishmentId: true,
          status: true,
          archivedAt: true,
          userId: true
        }
      });
      if (!teacher) throw new NotFoundException("Fiche enseignant introuvable.");
      this.assertBusinessProfileCanBeLinked(teacher.status, teacher.archivedAt, teacher.userId, currentUserId, "enseignant");
      return {
        displayName: `${teacher.firstName} ${teacher.lastName}`.trim(),
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email,
        phone: teacher.primaryPhone,
        establishmentId: teacher.establishmentId
      };
    }

    if (payload.accountType === "PARENT") {
      const parent = await this.prisma.parent.findFirst({
        where: { id: payload.parentId, tenantId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          primaryPhone: true,
          establishmentId: true,
          status: true,
          archivedAt: true,
          userId: true
        }
      });
      if (!parent) throw new NotFoundException("Fiche parent introuvable.");
      this.assertBusinessProfileCanBeLinked(parent.status, parent.archivedAt, parent.userId, currentUserId, "parent");
      return {
        displayName: `${parent.firstName} ${parent.lastName}`.trim(),
        firstName: parent.firstName,
        lastName: parent.lastName,
        email: parent.email,
        phone: parent.primaryPhone,
        establishmentId: parent.establishmentId
      };
    }

    if (payload.accountType === "STUDENT") {
      const student = await this.prisma.student.findFirst({
        where: { id: payload.studentId, tenantId, deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          establishmentId: true,
          status: true,
          archivedAt: true,
          userId: true
        }
      });
      if (!student) throw new NotFoundException("Fiche eleve introuvable.");
      this.assertBusinessProfileCanBeLinked(student.status, student.archivedAt, student.userId, currentUserId, "eleve");
      return {
        displayName: `${student.firstName} ${student.lastName}`.trim(),
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phone: student.phone,
        establishmentId: student.establishmentId
      };
    }

    const displayName = payload.staffDisplayName?.trim() || payload.displayName?.trim();
    if (!displayName) {
      throw new BadRequestException("Le nom affiche staff est requis.");
    }
    return {
      displayName,
      firstName: this.emptyToNull(payload.firstName),
      lastName: this.emptyToNull(payload.lastName),
      email: this.emptyToNull(payload.email),
      phone: this.emptyToNull(payload.phone),
      establishmentId: payload.establishmentId || null
    };
  }

  private assertBusinessProfileCanBeLinked(
    status: string,
    archivedAt: Date | null,
    linkedUserId: string | null,
    currentUserId: string | undefined,
    label: string
  ): void {
    if (archivedAt || status !== "ACTIVE") {
      throw new ConflictException(`La fiche ${label} doit etre active pour creer un compte.`);
    }
    if (linkedUserId && linkedUserId !== currentUserId) {
      throw new ConflictException(`Cette fiche ${label} est deja rattachee a un compte utilisateur.`);
    }
  }

  private async attachBusinessProfile(
    transaction: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    accountType: AccountType,
    ids: { teacherId?: string; parentId?: string; studentId?: string }
  ): Promise<void> {
    await transaction.teacher.updateMany({
      where: { tenantId, userId, ...(ids.teacherId ? { id: { not: ids.teacherId } } : {}) },
      data: { userId: null, updatedAt: new Date() }
    });
    await transaction.parent.updateMany({
      where: { tenantId, userId, ...(ids.parentId ? { id: { not: ids.parentId } } : {}) },
      data: { userId: null, updatedAt: new Date() }
    });
    await transaction.student.updateMany({
      where: { tenantId, userId, ...(ids.studentId ? { id: { not: ids.studentId } } : {}) },
      data: { userId: null, updatedAt: new Date() }
    });

    if (accountType === "TEACHER" && ids.teacherId) {
      await transaction.teacher.update({ where: { id: ids.teacherId }, data: { userId, updatedAt: new Date() } });
    }
    if (accountType === "PARENT" && ids.parentId) {
      await transaction.parent.update({ where: { id: ids.parentId }, data: { userId, updatedAt: new Date() } });
    }
    if (accountType === "STUDENT" && ids.studentId) {
      await transaction.student.update({ where: { id: ids.studentId }, data: { userId, updatedAt: new Date() } });
    }
  }

  private async requireUser(tenantId: string, id: string): Promise<User> {
    const row = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      }
    });

    if (!row) {
      throw new NotFoundException("User not found.");
    }

    return row;
  }

  private async requireUserWithProfiles(tenantId: string, id: string): Promise<UserWithProfiles> {
    const row = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      },
      include: this.userProfileInclude()
    });

    if (!row) {
      throw new NotFoundException("User not found.");
    }

    return row;
  }

  private async toMyProfileView(
    row: UserWithProfiles,
    preferences?: MyProfileView["preferences"]
  ): Promise<MyProfileView> {
    const activeSchoolYear = await this.prisma.schoolYear.findFirst({
      where: {
        tenantId: row.tenantId,
        OR: [{ isActive: true }, { isDefault: true }]
      },
      orderBy: [{ isActive: "desc" }, { isDefault: "desc" }, { sortOrder: "asc" }, { startDate: "desc" }]
    });
    const role = row.role as UserRole;

    const user = this.toView(row);
    const avatarReference = this.avatarStorageReference(row);
    if (avatarReference && row.avatarMimeType) {
      try {
        user.avatarUrl = await this.storageService.createTemporaryAccessUrl(
          avatarReference,
          row.avatarMimeType
        );
      } catch (error) {
        this.logger.warn(
          `Unable to create temporary avatar access for user ${row.id}: ${
            error instanceof Error ? error.message : "unknown storage error"
          }`
        );
        user.avatarUrl = undefined;
      }
    }

    return {
      user,
      context: {
        tenantId: row.tenantId,
        tenantName: "Al Manarat Islamiyat",
        activeSchoolYear: activeSchoolYear
          ? {
              id: activeSchoolYear.id,
              code: activeSchoolYear.code,
              label: activeSchoolYear.label,
              status: activeSchoolYear.status,
              isActive: activeSchoolYear.isActive
            }
          : undefined,
        timeZone: process.env.TZ || "Europe/Paris"
      },
      preferences,
      permissions: await this.listRolePermissions(row.tenantId, role)
    };
  }

  private async logAudit(
    tenantId: string,
    actorUserId: string,
    action: string,
    resource: string,
    resourceId: string,
    payload?: Prisma.InputJsonValue
  ): Promise<void> {
    await this.auditService.enqueueLog({
      tenantId,
      userId: actorUserId,
      action,
      resource,
      resourceId,
      payload
    });
  }

  private toView(row: UserWithProfiles): UserView {
    const role = row.role as UserRole;
    return {
      id: row.id,
      tenantId: row.tenantId,
      username: row.username,
      role,
      roleId: role,
      accountType: this.inferAccountType(role, row.accountType),
      email: row.email || undefined,
      phone: row.phone || undefined,
      displayName: row.displayName || undefined,
      firstName: row.firstName || undefined,
      lastName: row.lastName || undefined,
      avatarUrl: row.avatarUrl || undefined,
      establishmentId: row.establishmentId || undefined,
      staffFunction: row.staffFunction || undefined,
      department: row.department || undefined,
      notes: row.notes || undefined,
      mustChangePasswordAtFirstLogin: row.mustChangePasswordAtFirstLogin,
      teacherId: row.teacherProfile?.id,
      parentId: row.parentProfile?.id,
      studentId: row.studentProfile?.id,
      status: row.status,
      activatedAt: row.activatedAt?.toISOString(),
      disabledAt: row.disabledAt?.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString(),
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private assertPasswordPolicy(password: string, username?: string): void {
    const violation = findPasswordPolicyViolation(password, username);
    if (violation) {
      throw new BadRequestException(violation);
    }
  }

  private generateTemporaryPassword(): string {
    return `Gs-${randomBytes(9).toString("base64url")}aA1!`;
  }

  private emptyToNull(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private optionalEmptyToNull(value?: string): string | null | undefined {
    if (value === undefined) return undefined;
    return this.emptyToNull(value);
  }

  private assertNoForbiddenProfileMutation(payload: Record<string, unknown>): void {
    const forbiddenFields = [
      "role",
      "roleId",
      "accountType",
      "status",
      "tenantId",
      "permissions",
      "password",
      "passwordHash",
      "createdAt",
      "lastLoginAt",
      "isActive",
      "mustChangePasswordAtFirstLogin"
    ];
    const forbidden = forbiddenFields.find((field) => payload[field] !== undefined);
    if (forbidden) {
      throw new BadRequestException(`Le champ ${forbidden} ne peut pas être modifié depuis Mon profil.`);
    }
  }

  private handleKnownPrismaConflict(error: unknown, message: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(message);
    }
  }
}
