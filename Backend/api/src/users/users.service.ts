import { randomBytes } from "node:crypto";

import { compare, hash } from "bcryptjs";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";

import { AuditService } from "../audit/audit.service";
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
import { type AccountType, CreateUserDto } from "./dto/create-user.dto";
import {
  type RolePermissionItemDto,
  UpdateRolePermissionsDto
} from "./dto/update-role-permissions.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

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

@Injectable()
export class UsersService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
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

    const password = passwordMode === "AUTO" ? this.generateTemporaryPassword() : payload.password;
    if (!password) {
      throw new BadRequestException("Mot de passe requis en mode manuel.");
    }
    this.assertPasswordPolicy(password, payload.username);
    const passwordHash = await hash(password, 10);
    const identity = await this.resolveIdentityForCreate(tenantId, payload, accountType);
    const mustChangePasswordAtFirstLogin =
      payload.mustChangePasswordAtFirstLogin ?? passwordMode === "AUTO";

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
            avatarUrl: identity.avatarUrl,
            establishmentId: payload.establishmentId || identity.establishmentId,
            staffFunction: this.emptyToNull(payload.staffFunction),
            department: this.emptyToNull(payload.department),
            notes: this.emptyToNull(payload.notes),
            mustChangePasswordAtFirstLogin,
            isActive: payload.isActive ?? true,
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

      return {
        ...this.toView(created),
        temporaryPassword: passwordMode === "AUTO" ? password : undefined
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

    const data: Prisma.UserUpdateInput = {
      username: payload.username?.trim(),
      email: identity?.email ?? this.optionalEmptyToNull(payload.email),
      phone: identity?.phone ?? this.optionalEmptyToNull(payload.phone),
      role: touchesIamModel ? nextRole : undefined,
      accountType: touchesIamModel ? nextAccountType : undefined,
      displayName: identity?.displayName ?? this.optionalEmptyToNull(payload.displayName),
      firstName: identity?.firstName ?? this.optionalEmptyToNull(payload.firstName),
      lastName: identity?.lastName ?? this.optionalEmptyToNull(payload.lastName),
      avatarUrl: identity?.avatarUrl ?? this.optionalEmptyToNull(payload.avatarUrl),
      establishmentId: payload.establishmentId ?? identity?.establishmentId,
      staffFunction: this.optionalEmptyToNull(payload.staffFunction),
      department: this.optionalEmptyToNull(payload.department),
      notes: this.optionalEmptyToNull(payload.notes),
      mustChangePasswordAtFirstLogin: payload.mustChangePasswordAtFirstLogin,
      isActive: payload.isActive,
      updatedAt: new Date()
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

        if (payload.isActive === false || payload.password) {
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
    avatarUrl: string | null;
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
      avatarUrl: payload.avatarUrl,
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
    avatarUrl: string | null;
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
      avatarUrl: payload.avatarUrl,
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
      avatarUrl?: string;
      establishmentId?: string;
    }
  ): Promise<{
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
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
          photoUrl: true,
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
        avatarUrl: teacher.photoUrl,
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
        avatarUrl: null,
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
          photoUrl: true,
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
        avatarUrl: student.photoUrl,
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
      avatarUrl: this.emptyToNull(payload.avatarUrl),
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

  private handleKnownPrismaConflict(error: unknown, message: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(message);
    }
  }
}
