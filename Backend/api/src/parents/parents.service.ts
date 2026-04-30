import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AcademicPlacementStatus, Prisma } from "@prisma/client";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { UserRole } from "../security/roles.enum";
import {
  CreateParentDto,
  CreateParentStudentLinkDto,
  UpdateParentDto,
  UpdateParentStudentLinkDto
} from "./dto/parents.dto";

type ParentFilters = {
  search?: string;
  status?: string;
  parentalRole?: string;
  studentId?: string;
  includeArchived?: string;
};

type LinkFilters = {
  parentId?: string;
  studentId?: string;
  relationType?: string;
  isPrimaryContact?: string;
  legalGuardian?: string;
  financialResponsible?: string;
  emergencyContact?: string;
  status?: string;
  includeArchived?: string;
};

type ParentWithRelations = Prisma.ParentGetPayload<{
  include: {
    user: true;
    studentLinks: {
      include: {
        student: true;
      };
    };
  };
}>;

type LinkWithRelations = Prisma.ParentStudentLinkGetPayload<{
  include: {
    parentProfile: {
      include: {
        user: true;
      };
    };
    parent: true;
    student: {
      include: {
        trackPlacements: {
          include: {
            schoolYear: true;
            level: true;
            classroom: true;
          };
        };
      };
    };
  };
}>;

export type ParentView = {
  id: string;
  tenantId: string;
  parentalRole: string;
  firstName: string;
  lastName: string;
  fullName: string;
  sex?: string;
  primaryPhone: string;
  secondaryPhone?: string;
  email?: string;
  address?: string;
  profession?: string;
  identityDocumentType?: string;
  identityDocumentNumber?: string;
  status: string;
  establishmentId?: string;
  userId?: string;
  userUsername?: string;
  notes?: string;
  childrenCount: number;
  primaryChildrenCount: number;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ParentStudentRelationView = {
  id: string;
  tenantId: string;
  parentId?: string;
  parentUserId?: string;
  studentId: string;
  relationType: string;
  relationship?: string;
  isPrimary: boolean;
  isPrimaryContact: boolean;
  livesWithStudent?: boolean;
  pickupAuthorized?: boolean;
  legalGuardian: boolean;
  financialResponsible: boolean;
  emergencyContact: boolean;
  status: string;
  comment?: string;
  parentName?: string;
  parentUsername?: string;
  studentMatricule: string;
  studentName: string;
  studentTracks: Array<"FRANCOPHONE" | "ARABOPHONE">;
  studentPlacements: Array<{
    placementId: string;
    track: "FRANCOPHONE" | "ARABOPHONE";
    placementStatus: string;
    isPrimary: boolean;
    schoolYearId: string;
    schoolYearCode?: string;
    levelId: string;
    levelLabel?: string;
    classId?: string;
    classLabel?: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class ParentsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listParents(tenantId: string, filters: ParentFilters = {}): Promise<ParentView[]> {
    const where = this.buildParentWhere(tenantId, filters);
    const rows = await this.prisma.parent.findMany({
      where,
      include: this.parentInclude(),
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });

    return rows.map((row) => this.parentView(row));
  }

  async getParent(tenantId: string, id: string): Promise<ParentView> {
    const row = await this.prisma.parent.findFirst({
      where: { id, tenantId },
      include: this.parentInclude()
    });

    if (!row) {
      throw new NotFoundException("Parent not found.");
    }

    return this.parentView(row);
  }

  async createParent(
    tenantId: string,
    actorUserId: string,
    payload: CreateParentDto
  ): Promise<ParentView> {
    if (payload.userId) {
      await this.requirePortalUser(tenantId, payload.userId);
    }

    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        const row = await transaction.parent.create({
          data: {
            tenantId,
            parentalRole: payload.parentalRole,
            firstName: payload.firstName.trim(),
            lastName: payload.lastName.trim(),
            sex: payload.sex,
            primaryPhone: payload.primaryPhone.trim(),
            secondaryPhone: this.emptyToNull(payload.secondaryPhone),
            email: this.emptyToNull(payload.email),
            address: this.emptyToNull(payload.address),
            profession: this.emptyToNull(payload.profession),
            identityDocumentType: this.emptyToNull(payload.identityDocumentType),
            identityDocumentNumber: this.emptyToNull(payload.identityDocumentNumber),
            status: payload.status || "ACTIVE",
            establishmentId: payload.establishmentId,
            userId: payload.userId,
            notes: this.emptyToNull(payload.notes),
            archivedAt: payload.status === "ARCHIVED" ? new Date() : null,
            updatedAt: new Date()
          },
          include: this.parentInclude()
        });

        await this.auditService.enqueueLog(
          {
            tenantId,
            userId: actorUserId,
            action: "PARENT_CREATED",
            resource: "parents",
            resourceId: row.id,
            payload: {
              parentalRole: row.parentalRole,
              userId: row.userId,
              status: row.status
            }
          },
          transaction
        );

        return row;
      });

      return this.parentView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Parent portal account is already linked.");
      throw error;
    }
  }

  async updateParent(
    tenantId: string,
    actorUserId: string,
    id: string,
    payload: UpdateParentDto
  ): Promise<ParentView> {
    const existing = await this.prisma.parent.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException("Parent not found.");
    }
    if (payload.userId) {
      await this.requirePortalUser(tenantId, payload.userId);
    }

    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        const row = await transaction.parent.update({
          where: { id: existing.id },
          data: {
            parentalRole: payload.parentalRole,
            firstName: payload.firstName?.trim(),
            lastName: payload.lastName?.trim(),
            sex: payload.sex,
            primaryPhone: payload.primaryPhone?.trim(),
            secondaryPhone: this.optionalEmptyToNull(payload.secondaryPhone),
            email: this.optionalEmptyToNull(payload.email),
            address: this.optionalEmptyToNull(payload.address),
            profession: this.optionalEmptyToNull(payload.profession),
            identityDocumentType: this.optionalEmptyToNull(payload.identityDocumentType),
            identityDocumentNumber: this.optionalEmptyToNull(payload.identityDocumentNumber),
            status: payload.status,
            establishmentId: payload.establishmentId,
            userId: payload.userId,
            notes: this.optionalEmptyToNull(payload.notes),
            archivedAt:
              payload.status === undefined
                ? undefined
                : payload.status === "ARCHIVED"
                  ? existing.archivedAt || new Date()
                  : null,
            updatedAt: new Date()
          },
          include: this.parentInclude()
        });

        await this.auditService.enqueueLog(
          {
            tenantId,
            userId: actorUserId,
            action: "PARENT_UPDATED",
            resource: "parents",
            resourceId: row.id,
            payload: {
              status: row.status,
              userId: row.userId
            }
          },
          transaction
        );

        return row;
      });

      return this.parentView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Parent portal account is already linked.");
      throw error;
    }
  }

  async archiveParent(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.prisma.parent.findFirst({
      where: { id, tenantId, archivedAt: null }
    });
    if (!existing) {
      throw new NotFoundException("Parent not found.");
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.parent.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          updatedAt: new Date()
        }
      });
      await transaction.parentStudentLink.updateMany({
        where: { tenantId, parentId: existing.id, archivedAt: null },
        data: {
          status: "INACTIVE",
          updatedAt: new Date()
        }
      });
      await this.auditService.enqueueLog(
        {
          tenantId,
          userId: actorUserId,
          action: "PARENT_ARCHIVED",
          resource: "parents",
          resourceId: existing.id
        },
        transaction
      );
    });
  }

  async listLinks(tenantId: string, filters: LinkFilters = {}): Promise<ParentStudentRelationView[]> {
    const rows = await this.prisma.parentStudentLink.findMany({
      where: this.buildLinkWhere(tenantId, filters),
      include: this.linkInclude(),
      orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "desc" }]
    });

    return rows.map((row) => this.linkView(row));
  }

  async listStudentParents(tenantId: string, studentId: string): Promise<ParentStudentRelationView[]> {
    await this.requireStudent(tenantId, studentId);
    return this.listLinks(tenantId, { studentId });
  }

  async listParentChildren(tenantId: string, parentId: string): Promise<ParentStudentRelationView[]> {
    await this.requireParent(tenantId, parentId);
    return this.listLinks(tenantId, { parentId });
  }

  async createLink(
    tenantId: string,
    actorUserId: string,
    payload: CreateParentStudentLinkDto
  ): Promise<ParentStudentRelationView> {
    const parent = await this.requireParent(tenantId, payload.parentId);
    const student = await this.requireStudent(tenantId, payload.studentId);
    this.assertParentSelectable(parent);
    this.assertStudentSelectable(student);
    await this.assertNoDuplicateLink(
      tenantId,
      payload.parentId,
      payload.studentId,
      payload.relationType
    );

    const created = await this.prisma.$transaction(async (transaction) => {
      if (payload.isPrimaryContact) {
        await transaction.parentStudentLink.updateMany({
          where: { tenantId, studentId: payload.studentId, archivedAt: null },
          data: {
            isPrimary: false,
            isPrimaryContact: false,
            updatedAt: new Date()
          }
        });
      }

      const row = await transaction.parentStudentLink.create({
        data: {
          tenantId,
          parentId: parent.id,
          parentUserId: parent.userId,
          studentId: student.id,
          relationship: payload.relationType,
          relationType: payload.relationType,
          isPrimary: payload.isPrimaryContact ?? false,
          isPrimaryContact: payload.isPrimaryContact ?? false,
          livesWithStudent: payload.livesWithStudent,
          pickupAuthorized: payload.pickupAuthorized,
          legalGuardian: payload.legalGuardian ?? false,
          financialResponsible: payload.financialResponsible ?? false,
          emergencyContact: payload.emergencyContact ?? false,
          status: payload.status || "ACTIVE",
          comment: this.emptyToNull(payload.comment),
          updatedAt: new Date()
        },
        include: this.linkInclude()
      });

      await this.auditService.enqueueLog(
        {
          tenantId,
          userId: actorUserId,
          action: "PARENT_STUDENT_LINK_CREATED",
          resource: "parent_student_links",
          resourceId: row.id,
          payload: {
            parentId: row.parentId,
            parentUserId: row.parentUserId,
            studentId: row.studentId,
            relationType: row.relationType,
            isPrimaryContact: row.isPrimaryContact
          }
        },
        transaction
      );

      return row;
    });

    return this.linkView(created);
  }

  async updateLink(
    tenantId: string,
    actorUserId: string,
    id: string,
    payload: UpdateParentStudentLinkDto
  ): Promise<ParentStudentRelationView> {
    const existing = await this.prisma.parentStudentLink.findFirst({
      where: { id, tenantId, archivedAt: null }
    });
    if (!existing) {
      throw new NotFoundException("Parent/student link not found.");
    }

    const parentId = payload.parentId || existing.parentId;
    const studentId = payload.studentId || existing.studentId;
    const relationType = payload.relationType || existing.relationType || existing.relationship || "AUTRE";
    if (!parentId) {
      throw new BadRequestException("Parent business profile is required.");
    }

    const parent = await this.requireParent(tenantId, parentId);
    const student = await this.requireStudent(tenantId, studentId);
    this.assertParentSelectable(parent);
    this.assertStudentSelectable(student);
    await this.assertNoDuplicateLink(tenantId, parentId, studentId, relationType, existing.id);

    const updated = await this.prisma.$transaction(async (transaction) => {
      if (payload.isPrimaryContact) {
        await transaction.parentStudentLink.updateMany({
          where: {
            tenantId,
            studentId,
            archivedAt: null,
            NOT: { id: existing.id }
          },
          data: {
            isPrimary: false,
            isPrimaryContact: false,
            updatedAt: new Date()
          }
        });
      }

      const row = await transaction.parentStudentLink.update({
        where: { id: existing.id },
        data: {
          parentId: parent.id,
          parentUserId: parent.userId,
          studentId: student.id,
          relationship: relationType,
          relationType,
          isPrimary:
            payload.isPrimaryContact !== undefined
              ? payload.isPrimaryContact
              : existing.isPrimary,
          isPrimaryContact:
            payload.isPrimaryContact !== undefined
              ? payload.isPrimaryContact
              : existing.isPrimaryContact,
          livesWithStudent: payload.livesWithStudent,
          pickupAuthorized: payload.pickupAuthorized,
          legalGuardian: payload.legalGuardian,
          financialResponsible: payload.financialResponsible,
          emergencyContact: payload.emergencyContact,
          status: payload.status,
          comment: this.optionalEmptyToNull(payload.comment),
          updatedAt: new Date()
        },
        include: this.linkInclude()
      });

      await this.auditService.enqueueLog(
        {
          tenantId,
          userId: actorUserId,
          action: "PARENT_STUDENT_LINK_UPDATED",
          resource: "parent_student_links",
          resourceId: row.id,
          payload: {
            parentId: row.parentId,
            studentId: row.studentId,
            relationType: row.relationType,
            status: row.status
          }
        },
        transaction
      );

      return row;
    });

    return this.linkView(updated);
  }

  async archiveLink(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.prisma.parentStudentLink.findFirst({
      where: { id, tenantId, archivedAt: null }
    });
    if (!existing) {
      throw new NotFoundException("Parent/student link not found.");
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.parentStudentLink.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          updatedAt: new Date()
        }
      });

      await this.auditService.enqueueLog(
        {
          tenantId,
          userId: actorUserId,
          action: "PARENT_STUDENT_LINK_ARCHIVED",
          resource: "parent_student_links",
          resourceId: existing.id
        },
        transaction
      );
    });
  }

  private buildParentWhere(tenantId: string, filters: ParentFilters): Prisma.ParentWhereInput {
    const includeArchived = filters.includeArchived === "true";
    const where: Prisma.ParentWhereInput = {
      tenantId,
      ...(includeArchived ? {} : { archivedAt: null })
    };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.parentalRole) {
      where.parentalRole = filters.parentalRole;
    }
    if (filters.studentId) {
      where.studentLinks = {
        some: {
          studentId: filters.studentId,
          archivedAt: null
        }
      };
    }
    if (filters.search?.trim()) {
      const search = filters.search.trim();
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { primaryPhone: { contains: search, mode: "insensitive" } },
        { secondaryPhone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ];
    }

    return where;
  }

  private buildLinkWhere(tenantId: string, filters: LinkFilters): Prisma.ParentStudentLinkWhereInput {
    const includeArchived = filters.includeArchived === "true";
    const where: Prisma.ParentStudentLinkWhereInput = {
      tenantId,
      ...(includeArchived ? {} : { archivedAt: null })
    };

    if (filters.parentId) where.parentId = filters.parentId;
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.relationType) where.relationType = filters.relationType;
    if (filters.status) where.status = filters.status;
    if (filters.isPrimaryContact !== undefined) where.isPrimaryContact = filters.isPrimaryContact === "true";
    if (filters.legalGuardian !== undefined) where.legalGuardian = filters.legalGuardian === "true";
    if (filters.financialResponsible !== undefined) where.financialResponsible = filters.financialResponsible === "true";
    if (filters.emergencyContact !== undefined) where.emergencyContact = filters.emergencyContact === "true";

    return where;
  }

  private parentInclude() {
    return {
      user: true,
      studentLinks: {
        where: { archivedAt: null },
        include: { student: true },
        orderBy: [{ isPrimaryContact: "desc" as const }, { createdAt: "asc" as const }]
      }
    };
  }

  private linkInclude() {
    return {
      parentProfile: {
        include: {
          user: true
        }
      },
      parent: true,
      student: {
        include: {
          trackPlacements: {
            where: {
              placementStatus: {
                in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
              }
            },
            include: {
              schoolYear: true,
              level: true,
              classroom: true
            },
            orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }]
          }
        }
      }
    };
  }

  private async requireParent(tenantId: string, id: string) {
    const parent = await this.prisma.parent.findFirst({
      where: { id, tenantId }
    });
    if (!parent) {
      throw new NotFoundException("Parent not found.");
    }
    return parent;
  }

  private async requireStudent(tenantId: string, id: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId, deletedAt: null }
    });
    if (!student) {
      throw new NotFoundException("Student not found.");
    }
    return student;
  }

  private async requirePortalUser(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null }
    });
    if (!user || user.role !== UserRole.PARENT) {
      throw new ConflictException("Parent portal user not found.");
    }
    return user;
  }

  private assertParentSelectable(parent: { archivedAt: Date | null; status: string }): void {
    if (parent.archivedAt || parent.status !== "ACTIVE") {
      throw new ConflictException("Archived or inactive parent cannot be linked.");
    }
  }

  private assertStudentSelectable(student: { archivedAt: Date | null; deletedAt: Date | null; status: string }): void {
    if (student.archivedAt || student.deletedAt || student.status === "ARCHIVED") {
      throw new ConflictException("Archived student cannot be linked.");
    }
  }

  private async assertNoDuplicateLink(
    tenantId: string,
    parentId: string,
    studentId: string,
    relationType: string,
    excludeId?: string
  ): Promise<void> {
    const existing = await this.prisma.parentStudentLink.findFirst({
      where: {
        tenantId,
        parentId,
        studentId,
        relationType,
        archivedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {})
      }
    });

    if (existing) {
      throw new ConflictException("Parent/student relation already exists.");
    }
  }

  private parentView(row: ParentWithRelations): ParentView {
    const activeLinks = row.studentLinks.filter((link) => link.status === "ACTIVE");
    return {
      id: row.id,
      tenantId: row.tenantId,
      parentalRole: row.parentalRole,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: `${row.firstName} ${row.lastName}`.trim(),
      sex: row.sex || undefined,
      primaryPhone: row.primaryPhone,
      secondaryPhone: row.secondaryPhone || undefined,
      email: row.email || undefined,
      address: row.address || undefined,
      profession: row.profession || undefined,
      identityDocumentType: row.identityDocumentType || undefined,
      identityDocumentNumber: row.identityDocumentNumber || undefined,
      status: row.status,
      establishmentId: row.establishmentId || undefined,
      userId: row.userId || undefined,
      userUsername: row.user?.username,
      notes: row.notes || undefined,
      childrenCount: activeLinks.length,
      primaryChildrenCount: activeLinks.filter((link) => link.isPrimaryContact || link.isPrimary).length,
      archivedAt: row.archivedAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private linkView(row: LinkWithRelations): ParentStudentRelationView {
    const placements = row.student.trackPlacements.map((placement) => ({
      placementId: placement.id,
      track: placement.track as "FRANCOPHONE" | "ARABOPHONE",
      placementStatus: placement.placementStatus,
      isPrimary: placement.isPrimary,
      schoolYearId: placement.schoolYearId,
      schoolYearCode: placement.schoolYear.code,
      levelId: placement.levelId,
      levelLabel: placement.level.label,
      classId: placement.classId || undefined,
      classLabel: placement.classroom?.label
    }));
    const parentName = row.parentProfile
      ? `${row.parentProfile.firstName} ${row.parentProfile.lastName}`.trim()
      : row.parent?.username || undefined;

    return {
      id: row.id,
      tenantId: row.tenantId,
      parentId: row.parentId || undefined,
      parentUserId: row.parentUserId || undefined,
      studentId: row.studentId,
      relationType: row.relationType || row.relationship || "AUTRE",
      relationship: row.relationship || undefined,
      isPrimary: row.isPrimary,
      isPrimaryContact: row.isPrimaryContact || row.isPrimary,
      livesWithStudent: row.livesWithStudent ?? undefined,
      pickupAuthorized: row.pickupAuthorized ?? undefined,
      legalGuardian: row.legalGuardian,
      financialResponsible: row.financialResponsible,
      emergencyContact: row.emergencyContact,
      status: row.status,
      comment: row.comment || undefined,
      parentName,
      parentUsername: row.parentProfile?.user?.username || row.parent?.username,
      studentMatricule: row.student.matricule,
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      studentTracks: [...new Set(placements.map((placement) => placement.track))],
      studentPlacements: placements,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private emptyToNull(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private optionalEmptyToNull(value?: string): string | null | undefined {
    return value === undefined ? undefined : this.emptyToNull(value);
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
