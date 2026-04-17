import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AcademicPlacementStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { CreateStudentDto } from "./dto/create-student.dto";
import { UpdateStudentDto } from "./dto/update-student.dto";

type StudentFilters = {
  search?: string;
  status?: string;
  track?: string;
  classId?: string;
  includeArchived?: string;
};

type StudentWithRelations = Prisma.StudentGetPayload<{
  include: {
    parentLinks: {
      include: {
        parentProfile: true;
        parent: true;
      };
    };
    trackPlacements: {
      include: {
        schoolYear: true;
        level: true;
        classroom: true;
      };
    };
  };
}>;

export type StudentPlacementView = {
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
};

export type StudentParentSummaryView = {
  linkId: string;
  parentId?: string;
  parentUserId?: string;
  parentName: string;
  parentUsername?: string;
  relationType?: string;
  isPrimaryContact: boolean;
  legalGuardian: boolean;
  financialResponsible: boolean;
  emergencyContact: boolean;
  pickupAuthorized?: boolean;
  status: string;
};

export type StudentView = {
  id: string;
  tenantId: string;
  matricule: string;
  firstName: string;
  lastName: string;
  fullName: string;
  sex: "M" | "F";
  birthDate?: string;
  birthPlace?: string;
  nationality?: string;
  address?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  establishmentId?: string;
  admissionDate?: string;
  administrativeNotes?: string;
  internalId?: string;
  birthCertificateNo?: string;
  specialNeeds?: string;
  primaryLanguage?: string;
  userId?: string;
  status: string;
  archivedAt?: string;
  tracks: Array<"FRANCOPHONE" | "ARABOPHONE">;
  placements: StudentPlacementView[];
  parents: StudentParentSummaryView[];
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, filters: StudentFilters = {}): Promise<StudentView[]> {
    const where = this.buildWhere(tenantId, filters);
    const students = await this.prisma.student.findMany({
      where,
      include: this.includeRelations(),
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });

    return students.map((student) => this.toView(student));
  }

  async getById(tenantId: string, id: string): Promise<StudentView> {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      },
      include: this.includeRelations()
    });

    if (!student) {
      throw new NotFoundException("Student not found.");
    }

    return this.toView(student);
  }

  async create(tenantId: string, payload: CreateStudentDto): Promise<StudentView> {
    this.assertDates(payload);

    try {
      const student = await this.prisma.student.create({
        data: {
          tenantId,
          matricule: payload.matricule.trim(),
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          sex: payload.sex,
          birthDate: this.toDateOrNull(payload.birthDate),
          birthPlace: this.emptyToNull(payload.birthPlace),
          nationality: this.emptyToNull(payload.nationality),
          address: this.emptyToNull(payload.address),
          phone: this.emptyToNull(payload.phone),
          email: this.emptyToNull(payload.email),
          photoUrl: this.emptyToNull(payload.photoUrl),
          establishmentId: payload.establishmentId,
          admissionDate: this.toDateOrNull(payload.admissionDate),
          administrativeNotes: this.emptyToNull(payload.administrativeNotes),
          internalId: this.emptyToNull(payload.internalId),
          birthCertificateNo: this.emptyToNull(payload.birthCertificateNo),
          specialNeeds: this.emptyToNull(payload.specialNeeds),
          primaryLanguage: this.emptyToNull(payload.primaryLanguage),
          status: payload.status || "ACTIVE",
          archivedAt: payload.status === "ARCHIVED" ? new Date() : null,
          updatedAt: new Date()
        },
        include: this.includeRelations()
      });

      return this.toView(student);
    } catch (error: unknown) {
      this.handleStudentConflict(error);
      throw error;
    }
  }

  async update(
    tenantId: string,
    id: string,
    payload: UpdateStudentDto
  ): Promise<StudentView> {
    this.assertDates(payload);

    const existing = await this.prisma.student.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      }
    });

    if (!existing) {
      throw new NotFoundException("Student not found.");
    }

    try {
      const updated = await this.prisma.student.update({
        where: { id: existing.id },
        data: {
          matricule: payload.matricule?.trim(),
          firstName: payload.firstName?.trim(),
          lastName: payload.lastName?.trim(),
          sex: payload.sex,
          birthDate:
            payload.birthDate !== undefined ? this.toDateOrNull(payload.birthDate) : undefined,
          birthPlace: this.optionalEmptyToNull(payload.birthPlace),
          nationality: this.optionalEmptyToNull(payload.nationality),
          address: this.optionalEmptyToNull(payload.address),
          phone: this.optionalEmptyToNull(payload.phone),
          email: this.optionalEmptyToNull(payload.email),
          photoUrl: this.optionalEmptyToNull(payload.photoUrl),
          establishmentId: payload.establishmentId,
          admissionDate:
            payload.admissionDate !== undefined ? this.toDateOrNull(payload.admissionDate) : undefined,
          administrativeNotes: this.optionalEmptyToNull(payload.administrativeNotes),
          internalId: this.optionalEmptyToNull(payload.internalId),
          birthCertificateNo: this.optionalEmptyToNull(payload.birthCertificateNo),
          specialNeeds: this.optionalEmptyToNull(payload.specialNeeds),
          primaryLanguage: this.optionalEmptyToNull(payload.primaryLanguage),
          status: payload.status,
          archivedAt:
            payload.status === undefined
              ? undefined
              : payload.status === "ARCHIVED"
                ? existing.archivedAt || new Date()
                : null,
          updatedAt: new Date()
        },
        include: this.includeRelations()
      });

      return this.toView(updated);
    } catch (error: unknown) {
      this.handleStudentConflict(error);
      throw error;
    }
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const result = await this.prisma.student.updateMany({
      where: {
        id,
        tenantId,
        deletedAt: null
      },
      data: {
        status: "ARCHIVED",
        archivedAt: new Date(),
        deletedAt: new Date(),
        updatedAt: new Date()
      }
    });

    if (result.count === 0) {
      throw new NotFoundException("Student not found.");
    }
  }

  private buildWhere(tenantId: string, filters: StudentFilters): Prisma.StudentWhereInput {
    const includeArchived = filters.includeArchived === "true";
    const where: Prisma.StudentWhereInput = {
      tenantId,
      ...(includeArchived ? {} : { deletedAt: null, archivedAt: null })
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search?.trim()) {
      const search = filters.search.trim();
      where.OR = [
        { matricule: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ];
    }

    if (filters.track || filters.classId) {
      where.trackPlacements = {
        some: {
          placementStatus: { in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED] },
          track: filters.track === "FRANCOPHONE" || filters.track === "ARABOPHONE" ? filters.track : undefined,
          classId: filters.classId || undefined
        }
      };
    }

    return where;
  }

  private includeRelations() {
    return {
      parentLinks: {
        where: { status: "ACTIVE", archivedAt: null },
        include: {
          parentProfile: true,
          parent: true
        },
        orderBy: [{ isPrimaryContact: "desc" as const }, { isPrimary: "desc" as const }, { createdAt: "asc" as const }]
      },
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
    };
  }

  private toView(student: StudentWithRelations): StudentView {
    const placements = student.trackPlacements.map((placement) => ({
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

    return {
      id: student.id,
      tenantId: student.tenantId,
      matricule: student.matricule,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`.trim(),
      sex: student.sex as "M" | "F",
      birthDate: this.toDateString(student.birthDate),
      birthPlace: student.birthPlace || undefined,
      nationality: student.nationality || undefined,
      address: student.address || undefined,
      phone: student.phone || undefined,
      email: student.email || undefined,
      photoUrl: student.photoUrl || undefined,
      establishmentId: student.establishmentId || undefined,
      admissionDate: this.toDateString(student.admissionDate),
      administrativeNotes: student.administrativeNotes || undefined,
      internalId: student.internalId || undefined,
      birthCertificateNo: student.birthCertificateNo || undefined,
      specialNeeds: student.specialNeeds || undefined,
      primaryLanguage: student.primaryLanguage || undefined,
      userId: student.userId || undefined,
      status: student.status,
      archivedAt: student.archivedAt?.toISOString(),
      tracks: [...new Set(placements.map((placement) => placement.track))],
      placements,
      parents: student.parentLinks.map((link) => {
        const parentName = link.parentProfile
          ? `${link.parentProfile.firstName} ${link.parentProfile.lastName}`.trim()
          : link.parent?.username || "Parent portail";

        return {
          linkId: link.id,
          parentId: link.parentId || undefined,
          parentUserId: link.parentUserId || undefined,
          parentName,
          parentUsername: link.parent?.username,
          relationType: link.relationType || link.relationship || undefined,
          isPrimaryContact: link.isPrimaryContact || link.isPrimary,
          legalGuardian: link.legalGuardian,
          financialResponsible: link.financialResponsible,
          emergencyContact: link.emergencyContact,
          pickupAuthorized: link.pickupAuthorized ?? undefined,
          status: link.status
        };
      }),
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString()
    };
  }

  private assertDates(payload: CreateStudentDto | UpdateStudentDto): void {
    if (payload.birthDate && new Date(payload.birthDate) > new Date()) {
      throw new BadRequestException("Birth date cannot be in the future.");
    }
    if (payload.admissionDate && new Date(payload.admissionDate) > new Date()) {
      throw new BadRequestException("Admission date cannot be in the future.");
    }
  }

  private toDateString(value: Date | null): string | undefined {
    return value?.toISOString().slice(0, 10);
  }

  private toDateOrNull(value?: string): Date | null {
    return value ? new Date(value) : null;
  }

  private emptyToNull(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private optionalEmptyToNull(value?: string): string | null | undefined {
    return value === undefined ? undefined : this.emptyToNull(value);
  }

  private handleStudentConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("Matricule already exists for this tenant.");
    }
  }

}
