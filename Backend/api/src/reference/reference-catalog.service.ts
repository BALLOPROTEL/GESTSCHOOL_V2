import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, type AcademicPeriod, type Subject } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import {
  CreateAcademicPeriodDto,
  CreateSubjectDto,
  UpdateAcademicPeriodDto,
  UpdateSubjectDto
} from "./dto/reference.dto";
import {
  academicPeriodView,
  type AcademicPeriodView,
  type SubjectView,
  subjectView
} from "./reference.types";
import { ReferenceSchoolYearsService } from "./reference-school-years.service";

@Injectable()
export class ReferenceCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolYearsService: ReferenceSchoolYearsService
  ) {}

  async listSubjects(tenantId: string): Promise<SubjectView[]> {
    const rows = await this.prisma.subject.findMany({
      where: { tenantId },
      include: { levelScopes: true },
      orderBy: [{ label: "asc" }]
    });
    return rows.map((row) => subjectView(row));
  }

  async createSubject(
    tenantId: string,
    payload: CreateSubjectDto
  ): Promise<SubjectView> {
    await this.assertSubjectRules(tenantId, payload);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const subject = await tx.subject.create({
          data: {
            tenantId,
            code: payload.code.trim(),
            label: payload.label.trim(),
            status: payload.status,
            nature: payload.nature,
            isArabic: payload.nature === "ARABOPHONE" || payload.isArabic === true,
            shortLabel: payload.shortLabel?.trim() || null,
            defaultCoefficient:
              payload.defaultCoefficient === undefined
                ? null
                : new Prisma.Decimal(payload.defaultCoefficient),
            category: payload.category?.trim() || null,
            description: payload.description?.trim() || null,
            color: payload.color?.trim() || null,
            weeklyHours:
              payload.weeklyHours === undefined ? null : new Prisma.Decimal(payload.weeklyHours),
            isGraded: payload.isGraded ?? true,
            isOptional: payload.isOptional ?? false,
            updatedAt: new Date()
          }
        });

        if (payload.levelIds?.length) {
          await tx.subjectLevelScope.createMany({
            data: payload.levelIds.map((levelId) => ({
              tenantId,
              subjectId: subject.id,
              levelId,
              updatedAt: new Date()
            }))
          });
        }

        return tx.subject.findUniqueOrThrow({
          where: { id: subject.id },
          include: { levelScopes: true }
        });
      });
      return subjectView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "Subject code already exists.");
      throw error;
    }
  }

  async updateSubject(
    tenantId: string,
    id: string,
    payload: UpdateSubjectDto
  ): Promise<SubjectView> {
    const existing = await this.prisma.subject.findFirst({
      where: { id, tenantId },
      include: { levelScopes: true }
    });
    if (!existing) {
      throw new NotFoundException("Subject not found.");
    }
    await this.assertSubjectRules(
      tenantId,
      {
        code: payload.code ?? existing.code,
        label: payload.label ?? existing.label,
        status: payload.status ?? existing.status,
        nature: payload.nature ?? existing.nature,
        shortLabel: payload.shortLabel ?? existing.shortLabel ?? undefined,
        defaultCoefficient:
          payload.defaultCoefficient ??
          (existing.defaultCoefficient === null ? undefined : Number(existing.defaultCoefficient)),
        category: payload.category ?? existing.category ?? undefined,
        description: payload.description ?? existing.description ?? undefined,
        color: payload.color ?? existing.color ?? undefined,
        weeklyHours:
          payload.weeklyHours ??
          (existing.weeklyHours === null ? undefined : Number(existing.weeklyHours)),
        isGraded: payload.isGraded ?? existing.isGraded,
        isOptional: payload.isOptional ?? existing.isOptional,
        levelIds: payload.levelIds ?? existing.levelScopes.map((item) => item.levelId),
        isArabic: payload.isArabic ?? existing.isArabic
      },
      existing.id
    );
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.subject.update({
          where: { id },
          data: {
            code: payload.code?.trim(),
            label: payload.label?.trim(),
            status: payload.status,
            nature: payload.nature,
            isArabic:
              payload.nature === undefined && payload.isArabic === undefined
                ? undefined
                : (payload.nature ?? existing.nature) === "ARABOPHONE" || payload.isArabic === true,
            shortLabel: payload.shortLabel?.trim(),
            defaultCoefficient:
              payload.defaultCoefficient === undefined
                ? undefined
                : new Prisma.Decimal(payload.defaultCoefficient),
            category: payload.category?.trim(),
            description: payload.description?.trim(),
            color: payload.color?.trim(),
            weeklyHours:
              payload.weeklyHours === undefined ? undefined : new Prisma.Decimal(payload.weeklyHours),
            isGraded: payload.isGraded,
            isOptional: payload.isOptional,
            updatedAt: new Date()
          }
        });

        if (payload.levelIds) {
          await tx.subjectLevelScope.deleteMany({ where: { tenantId, subjectId: id } });
          if (payload.levelIds.length > 0) {
            await tx.subjectLevelScope.createMany({
              data: payload.levelIds.map((levelId) => ({
                tenantId,
                subjectId: id,
                levelId,
                updatedAt: new Date()
              }))
            });
          }
        }

        return tx.subject.findUniqueOrThrow({
          where: { id },
          include: { levelScopes: true }
        });
      });
      return subjectView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "Subject code already exists.");
      throw error;
    }
  }

  async deleteSubject(tenantId: string, id: string): Promise<void> {
    await this.requireSubject(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.subject.delete({ where: { id } }),
      "Subject cannot be deleted because it is still used."
    );
  }

  async listAcademicPeriods(
    tenantId: string,
    schoolYearId?: string
  ): Promise<AcademicPeriodView[]> {
    const rows = await this.prisma.academicPeriod.findMany({
      where: {
        tenantId,
        schoolYearId
      },
      orderBy: [{ sortOrder: "asc" }, { startDate: "asc" }]
    });
    return rows.map((row) => academicPeriodView(row));
  }

  async createAcademicPeriod(
    tenantId: string,
    payload: CreateAcademicPeriodDto
  ): Promise<AcademicPeriodView> {
    await this.schoolYearsService.requireSchoolYear(tenantId, payload.schoolYearId);
    await this.assertAcademicPeriodRules(tenantId, payload);
    try {
      const created = await this.prisma.academicPeriod.create({
        data: {
          tenantId,
          schoolYearId: payload.schoolYearId,
          code: payload.code.trim(),
          label: payload.label.trim(),
          startDate: new Date(payload.startDate),
          endDate: new Date(payload.endDate),
          periodType: payload.periodType.trim().toUpperCase(),
          sortOrder: payload.sortOrder,
          status: payload.status,
          parentPeriodId: payload.parentPeriodId,
          isGradeEntryOpen: payload.isGradeEntryOpen ?? false,
          gradeEntryDeadline: payload.gradeEntryDeadline ? new Date(payload.gradeEntryDeadline) : null,
          lockDate: payload.lockDate ? new Date(payload.lockDate) : null,
          comment: payload.comment?.trim() || null,
          updatedAt: new Date()
        }
      });
      return academicPeriodView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaError(
        error,
        "Academic period code already exists for this school year."
      );
      throw error;
    }
  }

  async updateAcademicPeriod(
    tenantId: string,
    id: string,
    payload: UpdateAcademicPeriodDto
  ): Promise<AcademicPeriodView> {
    const existing = await this.requireAcademicPeriod(tenantId, id);
    if (payload.schoolYearId) {
      await this.schoolYearsService.requireSchoolYear(tenantId, payload.schoolYearId);
    }
    if (existing.status === "CLOSED" && this.isClosedPeriodStructuralChange(payload)) {
      throw new ConflictException(
        "Closed academic period cannot be modified on structural fields."
      );
    }
    await this.assertAcademicPeriodRules(
      tenantId,
      {
        schoolYearId: payload.schoolYearId ?? existing.schoolYearId,
        code: payload.code ?? existing.code,
        label: payload.label ?? existing.label,
        startDate: payload.startDate ?? existing.startDate.toISOString().slice(0, 10),
        endDate: payload.endDate ?? existing.endDate.toISOString().slice(0, 10),
        periodType: payload.periodType ?? existing.periodType,
        sortOrder: payload.sortOrder ?? existing.sortOrder,
        status: payload.status ?? existing.status,
        parentPeriodId: payload.parentPeriodId ?? existing.parentPeriodId ?? undefined,
        isGradeEntryOpen: payload.isGradeEntryOpen ?? existing.isGradeEntryOpen,
        gradeEntryDeadline:
          payload.gradeEntryDeadline ??
          (existing.gradeEntryDeadline ? existing.gradeEntryDeadline.toISOString().slice(0, 10) : undefined),
        lockDate:
          payload.lockDate ??
          (existing.lockDate ? existing.lockDate.toISOString().slice(0, 10) : undefined),
        comment: payload.comment ?? existing.comment ?? undefined
      },
      existing.id
    );
    try {
      const updated = await this.prisma.academicPeriod.update({
        where: { id },
        data: {
          schoolYearId: payload.schoolYearId,
          code: payload.code?.trim(),
          label: payload.label?.trim(),
          startDate: payload.startDate ? new Date(payload.startDate) : undefined,
          endDate: payload.endDate ? new Date(payload.endDate) : undefined,
          periodType: payload.periodType?.trim().toUpperCase(),
          sortOrder: payload.sortOrder,
          status: payload.status,
          parentPeriodId: payload.parentPeriodId,
          isGradeEntryOpen: payload.isGradeEntryOpen,
          gradeEntryDeadline: payload.gradeEntryDeadline ? new Date(payload.gradeEntryDeadline) : undefined,
          lockDate: payload.lockDate ? new Date(payload.lockDate) : undefined,
          comment: payload.comment?.trim(),
          updatedAt: new Date()
        }
      });
      return academicPeriodView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaError(
        error,
        "Academic period code already exists for this school year."
      );
      throw error;
    }
  }

  async deleteAcademicPeriod(tenantId: string, id: string): Promise<void> {
    await this.requireAcademicPeriod(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.academicPeriod.delete({ where: { id } }),
      "Academic period cannot be deleted because it is still used."
    );
  }

  async requireSubject(tenantId: string, id: string): Promise<Subject> {
    const row = await this.prisma.subject.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("Subject not found.");
    }
    return row;
  }

  async requireAcademicPeriod(tenantId: string, id: string): Promise<AcademicPeriod> {
    const row = await this.prisma.academicPeriod.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("Academic period not found.");
    }
    return row;
  }

  private toDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private async assertSubjectRules(
    tenantId: string,
    payload: {
      code: string;
      label: string;
      status: string;
      nature: string;
      shortLabel?: string;
      defaultCoefficient?: number;
      category?: string;
      description?: string;
      color?: string;
      weeklyHours?: number;
      isGraded?: boolean;
      isOptional?: boolean;
      levelIds?: string[];
      isArabic?: boolean;
    },
    ignoreId?: string
  ): Promise<void> {
    if (payload.defaultCoefficient !== undefined && payload.defaultCoefficient <= 0) {
      throw new BadRequestException("Subject default coefficient must be greater than zero.");
    }
    if (payload.weeklyHours !== undefined && payload.weeklyHours <= 0) {
      throw new BadRequestException("Subject weekly hours must be greater than zero.");
    }

    const duplicateCode = await this.prisma.subject.findFirst({
      where: {
        tenantId,
        id: ignoreId ? { not: ignoreId } : undefined,
        code: payload.code.trim()
      }
    });
    if (duplicateCode) {
      throw new ConflictException("Subject code already exists.");
    }

    if (payload.levelIds?.length) {
      const levelCount = await this.prisma.level.count({
        where: {
          tenantId,
          id: { in: payload.levelIds }
        }
      });
      if (levelCount !== new Set(payload.levelIds).size) {
        throw new BadRequestException("One or more subject level scopes are invalid.");
      }
    }
  }

  private async assertAcademicPeriodRules(
    tenantId: string,
    payload: {
      schoolYearId: string;
      code: string;
      label: string;
      startDate: string;
      endDate: string;
      periodType: string;
      sortOrder: number;
      status: string;
      parentPeriodId?: string;
      isGradeEntryOpen?: boolean;
      gradeEntryDeadline?: string;
      lockDate?: string;
      comment?: string;
    },
    ignoreId?: string
  ): Promise<void> {
    if (this.toDateOnly(payload.endDate) <= this.toDateOnly(payload.startDate)) {
      throw new BadRequestException("Academic period end date must be after start date.");
    }

    const schoolYear = await this.schoolYearsService.requireSchoolYear(tenantId, payload.schoolYearId);
    if (
      this.toDateOnly(payload.startDate) < schoolYear.startDate ||
      this.toDateOnly(payload.endDate) > schoolYear.endDate
    ) {
      throw new ConflictException("Academic period dates must stay within the school year.");
    }

    if (payload.gradeEntryDeadline) {
      const deadline = this.toDateOnly(payload.gradeEntryDeadline);
      if (deadline < this.toDateOnly(payload.startDate) || deadline > this.toDateOnly(payload.endDate)) {
        throw new ConflictException("Grade entry deadline must stay within the academic period.");
      }
    }

    if (payload.lockDate && this.toDateOnly(payload.lockDate) < this.toDateOnly(payload.startDate)) {
      throw new ConflictException("Academic period lock date cannot be before the period starts.");
    }

    if (payload.parentPeriodId) {
      const parent = await this.requireAcademicPeriod(tenantId, payload.parentPeriodId);
      if (ignoreId && parent.id === ignoreId) {
        throw new BadRequestException("Academic period cannot reference itself as parent.");
      }
      if (parent.schoolYearId !== payload.schoolYearId) {
        throw new ConflictException("Parent academic period must belong to the same school year.");
      }
    }

    const sameOrder = await this.prisma.academicPeriod.findFirst({
      where: {
        tenantId,
        id: ignoreId ? { not: ignoreId } : undefined,
        schoolYearId: payload.schoolYearId,
        sortOrder: payload.sortOrder
      }
    });
    if (sameOrder) {
      throw new ConflictException("Academic period sort order already exists for this school year.");
    }

    const overlappingPeriod = await this.prisma.academicPeriod.findFirst({
      where: {
        tenantId,
        id: ignoreId ? { not: ignoreId } : undefined,
        schoolYearId: payload.schoolYearId,
        periodType: payload.periodType.trim().toUpperCase(),
        startDate: { lte: new Date(payload.endDate) },
        endDate: { gte: new Date(payload.startDate) }
      }
    });
    if (overlappingPeriod) {
      throw new ConflictException(
        "Another academic period of the same type overlaps this date range."
      );
    }
  }

  private isClosedPeriodStructuralChange(payload: UpdateAcademicPeriodDto): boolean {
    return Boolean(
      payload.schoolYearId ||
        payload.code ||
        payload.label ||
        payload.startDate ||
        payload.endDate ||
        payload.periodType ||
        payload.sortOrder ||
        payload.parentPeriodId
    );
  }

  private handleKnownPrismaError(error: unknown, conflictMessage: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(conflictMessage);
    }
  }

  private async deleteEntity(
    callback: () => Promise<unknown>,
    relationErrorMessage: string
  ): Promise<void> {
    try {
      await callback();
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        throw new ConflictException(relationErrorMessage);
      }
      throw error;
    }
  }
}
