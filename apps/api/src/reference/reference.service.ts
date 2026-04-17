import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AcademicStage,
  AcademicTrack,
  Prisma,
  RotationGroup,
  type AcademicPeriod,
  type Classroom,
  type Cycle,
  type Level,
  type SchoolYear,
  type Subject
} from "@prisma/client";

import { AcademicStructureService } from "../academic-structure/academic-structure.service";
import { PrismaService } from "../database/prisma.service";
import {
  CreateAcademicPeriodDto,
  CreateClassroomDto,
  CreateCycleDto,
  CreateLevelDto,
  CreatePedagogicalRuleDto,
  CreateSchoolYearDto,
  CreateSubjectDto,
  UpdateAcademicPeriodDto,
  UpdateClassroomDto,
  UpdateCycleDto,
  UpdateLevelDto,
  UpdateSchoolYearDto,
  UpdateSubjectDto
} from "./dto/reference.dto";

type SubjectWithLevelScopes = Prisma.SubjectGetPayload<{
  include: { levelScopes: true };
}>;

type SchoolYearView = {
  id: string;
  tenantId: string;
  code: string;
  label: string;
  startDate: string;
  endDate: string;
  status: string;
  previousYearId?: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder?: number;
  comment?: string;
};

type CycleView = {
  id: string;
  tenantId: string;
  schoolYearId: string;
  code: string;
  label: string;
  academicStage: AcademicStage;
  sortOrder: number;
  description?: string;
  theoreticalAgeMin?: number;
  theoreticalAgeMax?: number;
  status: string;
};

type LevelView = {
  id: string;
  tenantId: string;
  cycleId: string;
  track: AcademicTrack;
  code: string;
  label: string;
  alias?: string;
  sortOrder: number;
  status: string;
  theoreticalAge?: number;
  description?: string;
  defaultSection?: string;
  rotationGroup?: RotationGroup;
};

type ClassroomView = {
  id: string;
  tenantId: string;
  schoolYearId: string;
  levelId: string;
  track: AcademicTrack;
  code: string;
  label: string;
  capacity?: number;
  status: string;
  homeroomTeacherName?: string;
  mainRoom?: string;
  actualCapacity?: number;
  filiere?: string;
  series?: string;
  speciality?: string;
  description?: string;
  teachingMode?: string;
  rotationGroup?: RotationGroup;
};

type SubjectView = {
  id: string;
  tenantId: string;
  code: string;
  label: string;
  status: string;
  nature: string;
  isArabic: boolean;
  shortLabel?: string;
  defaultCoefficient?: number;
  category?: string;
  description?: string;
  color?: string;
  weeklyHours?: number;
  isGraded: boolean;
  isOptional: boolean;
  levelIds: string[];
};

type AcademicPeriodView = {
  id: string;
  tenantId: string;
  schoolYearId: string;
  code: string;
  label: string;
  startDate: string;
  endDate: string;
  periodType: string;
  sortOrder: number;
  status: string;
  parentPeriodId?: string;
  isGradeEntryOpen: boolean;
  gradeEntryDeadline?: string;
  lockDate?: string;
  comment?: string;
};

@Injectable()
export class ReferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly academicStructureService: AcademicStructureService
  ) {}

  async listSchoolYears(tenantId: string): Promise<SchoolYearView[]> {
    const rows = await this.prisma.schoolYear.findMany({
      where: { tenantId },
      orderBy: [{ startDate: "desc" }, { code: "desc" }]
    });
    return rows.map((row) => this.schoolYearView(row));
  }

  async createSchoolYear(
    tenantId: string,
    payload: CreateSchoolYearDto
  ): Promise<SchoolYearView> {
    const normalizedCode = this.resolveSchoolYearCode(payload);
    const normalizedStatus = this.resolveSchoolYearStatus(payload.status, payload.isActive);
    await this.assertSchoolYearRules(tenantId, {
      code: normalizedCode,
      label: payload.label,
      startDate: payload.startDate,
      endDate: payload.endDate,
      status: normalizedStatus,
      previousYearId: payload.previousYearId
    });

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        if (normalizedStatus === "ACTIVE") {
          await tx.schoolYear.updateMany({
            where: { tenantId, status: "ACTIVE" },
            data: { isActive: false, status: "DRAFT", updatedAt: new Date() }
          });
        }

        return tx.schoolYear.create({
          data: {
            tenantId,
            code: normalizedCode,
            label: payload.label.trim(),
            startDate: new Date(payload.startDate),
            endDate: new Date(payload.endDate),
            status: normalizedStatus,
            previousYearId: payload.previousYearId,
            isActive: normalizedStatus === "ACTIVE",
            isDefault: payload.isDefault ?? false,
            sortOrder: payload.sortOrder ?? this.resolveSchoolYearSortOrder(payload),
            comment: payload.comment?.trim() || null,
            updatedAt: new Date()
          }
        });
      });

      return this.schoolYearView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "School year code already exists.");
      throw error;
    }
  }

  async updateSchoolYear(
    tenantId: string,
    id: string,
    payload: UpdateSchoolYearDto
  ): Promise<SchoolYearView> {
    const existing = await this.requireSchoolYear(tenantId, id);
    const normalizedCode = payload.code?.trim() || existing.code;
    const normalizedStatus = payload.status
      ? this.resolveSchoolYearStatus(payload.status, payload.isActive)
      : payload.isActive === true
        ? "ACTIVE"
        : payload.isActive === false && existing.status === "ACTIVE"
          ? "DRAFT"
          : existing.status;
    await this.assertSchoolYearRules(
      tenantId,
      {
        code: normalizedCode,
        label: payload.label ?? existing.label,
        startDate: payload.startDate ?? existing.startDate.toISOString().slice(0, 10),
        endDate: payload.endDate ?? existing.endDate.toISOString().slice(0, 10),
        status: normalizedStatus,
        previousYearId: payload.previousYearId ?? existing.previousYearId ?? undefined
      },
      existing.id
    );

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (normalizedStatus === "ACTIVE") {
          await tx.schoolYear.updateMany({
            where: { tenantId, id: { not: existing.id } },
            data: { isActive: false, status: "DRAFT", updatedAt: new Date() }
          });
        }

        return tx.schoolYear.update({
          where: { id: existing.id },
          data: {
            code: payload.code?.trim(),
            label: payload.label?.trim(),
            startDate: payload.startDate ? new Date(payload.startDate) : undefined,
            endDate: payload.endDate ? new Date(payload.endDate) : undefined,
            status: normalizedStatus,
            previousYearId: payload.previousYearId,
            isActive: normalizedStatus === "ACTIVE",
            isDefault: payload.isDefault,
            sortOrder: payload.sortOrder,
            comment: payload.comment?.trim(),
            updatedAt: new Date()
          }
        });
      });

      return this.schoolYearView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "School year code already exists.");
      throw error;
    }
  }

  async deleteSchoolYear(tenantId: string, id: string): Promise<void> {
    await this.requireSchoolYear(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.schoolYear.delete({ where: { id } }),
      "School year cannot be deleted because it is still used."
    );
  }

  async listCycles(tenantId: string): Promise<CycleView[]> {
    const rows = await this.prisma.cycle.findMany({
      where: { tenantId },
      orderBy: [{ schoolYearId: "desc" }, { sortOrder: "asc" }, { label: "asc" }]
    });
    return rows.map((row) => this.cycleView(row));
  }

  async createCycle(tenantId: string, payload: CreateCycleDto): Promise<CycleView> {
    await this.requireSchoolYear(tenantId, payload.schoolYearId);
    await this.assertCycleRules(tenantId, payload);
    try {
      const created = await this.prisma.cycle.create({
        data: {
          tenantId,
          schoolYearId: payload.schoolYearId,
          code: payload.code.trim(),
          label: payload.label.trim(),
          academicStage: payload.academicStage,
          sortOrder: payload.sortOrder,
          description: payload.description?.trim() || null,
          theoreticalAgeMin: payload.theoreticalAgeMin,
          theoreticalAgeMax: payload.theoreticalAgeMax,
          status: payload.status || "ACTIVE",
          updatedAt: new Date()
        }
      });
      return this.cycleView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "Cycle code already exists.");
      throw error;
    }
  }

  async updateCycle(
    tenantId: string,
    id: string,
    payload: UpdateCycleDto
  ): Promise<CycleView> {
    const existing = await this.requireCycle(tenantId, id);
    if (payload.schoolYearId) {
      await this.requireSchoolYear(tenantId, payload.schoolYearId);
    }
    await this.assertCycleRules(
      tenantId,
      {
        schoolYearId: payload.schoolYearId ?? existing.schoolYearId,
        code: payload.code ?? existing.code,
        label: payload.label ?? existing.label,
        academicStage: payload.academicStage ?? existing.academicStage,
        sortOrder: payload.sortOrder ?? existing.sortOrder,
        description: payload.description ?? existing.description ?? undefined,
        theoreticalAgeMin: payload.theoreticalAgeMin ?? existing.theoreticalAgeMin ?? undefined,
        theoreticalAgeMax: payload.theoreticalAgeMax ?? existing.theoreticalAgeMax ?? undefined,
        status: payload.status ?? existing.status
      },
      existing.id
    );
    try {
      const updated = await this.prisma.cycle.update({
        where: { id },
        data: {
          schoolYearId: payload.schoolYearId,
          code: payload.code?.trim(),
          label: payload.label?.trim(),
          academicStage: payload.academicStage,
          sortOrder: payload.sortOrder,
          description: payload.description?.trim(),
          theoreticalAgeMin: payload.theoreticalAgeMin,
          theoreticalAgeMax: payload.theoreticalAgeMax,
          status: payload.status,
          updatedAt: new Date()
        }
      });
      return this.cycleView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "Cycle code already exists.");
      throw error;
    }
  }

  async deleteCycle(tenantId: string, id: string): Promise<void> {
    await this.requireCycle(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.cycle.delete({ where: { id } }),
      "Cycle cannot be deleted because it is still used."
    );
  }

  async listLevels(
    tenantId: string,
    cycleId?: string,
    track?: string
  ): Promise<LevelView[]> {
    const rows = await this.prisma.level.findMany({
      where: {
        tenantId,
        cycleId,
        track: track
          ? this.academicStructureService.normalizeTrack(track)
          : undefined
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
    });
    return rows.map((row) => this.levelView(row));
  }

  async createLevel(tenantId: string, payload: CreateLevelDto): Promise<LevelView> {
    await this.requireCycle(tenantId, payload.cycleId);
    await this.assertLevelRules(tenantId, payload);

    try {
      const created = await this.prisma.level.create({
        data: {
          tenantId,
          cycleId: payload.cycleId,
          track: payload.track,
          code: payload.code.trim(),
          label: payload.label.trim(),
          alias: payload.alias?.trim() || null,
          sortOrder: payload.sortOrder,
          status: payload.status,
          theoreticalAge: payload.theoreticalAge,
          description: payload.description?.trim() || null,
          defaultSection: payload.defaultSection?.trim() || null,
          rotationGroup: payload.rotationGroup || null,
          updatedAt: new Date()
        }
      });
      return this.levelView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "Level code already exists.");
      throw error;
    }
  }

  async updateLevel(
    tenantId: string,
    id: string,
    payload: UpdateLevelDto
  ): Promise<LevelView> {
    const existing = await this.requireLevel(tenantId, id);
    if (payload.cycleId) {
      await this.requireCycle(tenantId, payload.cycleId);
    }
    await this.assertLevelRules(
      tenantId,
      {
        cycleId: payload.cycleId ?? existing.cycleId,
        track: payload.track ?? existing.track,
        code: payload.code ?? existing.code,
        label: payload.label ?? existing.label,
        alias: payload.alias ?? existing.alias ?? undefined,
        sortOrder: payload.sortOrder ?? existing.sortOrder,
        status: payload.status ?? existing.status,
        theoreticalAge: payload.theoreticalAge ?? existing.theoreticalAge ?? undefined,
        description: payload.description ?? existing.description ?? undefined,
        defaultSection: payload.defaultSection ?? existing.defaultSection ?? undefined,
        rotationGroup: payload.rotationGroup ?? existing.rotationGroup ?? undefined
      },
      existing.id
    );

    try {
      const updated = await this.prisma.level.update({
        where: { id },
        data: {
          cycleId: payload.cycleId,
          track: payload.track,
          code: payload.code?.trim(),
          label: payload.label?.trim(),
          alias: payload.alias?.trim(),
          sortOrder: payload.sortOrder,
          status: payload.status,
          theoreticalAge: payload.theoreticalAge,
          description: payload.description?.trim(),
          defaultSection: payload.defaultSection?.trim(),
          rotationGroup: payload.rotationGroup ?? undefined,
          updatedAt: new Date()
        }
      });
      return this.levelView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "Level code already exists.");
      throw error;
    }
  }

  async deleteLevel(tenantId: string, id: string): Promise<void> {
    await this.requireLevel(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.level.delete({ where: { id } }),
      "Level cannot be deleted because it is still used."
    );
  }

  async listClassrooms(
    tenantId: string,
    filters: { schoolYearId?: string; levelId?: string; track?: string }
  ): Promise<ClassroomView[]> {
    const rows = await this.prisma.classroom.findMany({
      where: {
        tenantId,
        schoolYearId: filters.schoolYearId,
        levelId: filters.levelId,
        track: filters.track
          ? this.academicStructureService.normalizeTrack(filters.track)
          : undefined
      },
      orderBy: [{ label: "asc" }]
    });
    return rows.map((row) => this.classroomView(row));
  }

  async createClassroom(
    tenantId: string,
    payload: CreateClassroomDto
  ): Promise<ClassroomView> {
    await this.requireSchoolYear(tenantId, payload.schoolYearId);
    const level = await this.requireLevel(tenantId, payload.levelId);
    await this.assertClassroomRules(tenantId, payload);
    const track = payload.track;
    if (track !== level.track) {
      throw new ConflictException("Class track must match level track.");
    }

    try {
      const created = await this.prisma.classroom.create({
        data: {
          tenantId,
          schoolYearId: payload.schoolYearId,
          levelId: payload.levelId,
          track,
          code: payload.code.trim(),
          label: payload.label.trim(),
          capacity: payload.capacity,
          status: payload.status,
          homeroomTeacherName: payload.homeroomTeacherName?.trim() || null,
          mainRoom: payload.mainRoom?.trim() || null,
          actualCapacity: payload.actualCapacity,
          filiere: payload.filiere?.trim() || null,
          series: payload.series?.trim() || null,
          speciality: payload.speciality?.trim() || null,
          description: payload.description?.trim() || null,
          teachingMode: payload.teachingMode || null,
          rotationGroup: payload.rotationGroup ?? level.rotationGroup ?? null,
          updatedAt: new Date()
        }
      });
      return this.classroomView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaError(
        error,
        "Class code already exists for this school year."
      );
      throw error;
    }
  }

  async updateClassroom(
    tenantId: string,
    id: string,
    payload: UpdateClassroomDto
  ): Promise<ClassroomView> {
    const existing = await this.requireClassroom(tenantId, id);
    if (payload.schoolYearId) {
      await this.requireSchoolYear(tenantId, payload.schoolYearId);
    }
    const level = payload.levelId
      ? await this.requireLevel(tenantId, payload.levelId)
      : undefined;
    await this.assertClassroomRules(
      tenantId,
      {
        schoolYearId: payload.schoolYearId ?? existing.schoolYearId,
        levelId: payload.levelId ?? existing.levelId,
        track: payload.track ?? existing.track,
        code: payload.code ?? existing.code,
        label: payload.label ?? existing.label,
        capacity: payload.capacity ?? existing.capacity ?? 0,
        status: payload.status ?? existing.status,
        homeroomTeacherName: payload.homeroomTeacherName ?? existing.homeroomTeacherName ?? undefined,
        mainRoom: payload.mainRoom ?? existing.mainRoom ?? undefined,
        actualCapacity: payload.actualCapacity ?? existing.actualCapacity ?? undefined,
        filiere: payload.filiere ?? existing.filiere ?? undefined,
        series: payload.series ?? existing.series ?? undefined,
        speciality: payload.speciality ?? existing.speciality ?? undefined,
        description: payload.description ?? existing.description ?? undefined,
        teachingMode: payload.teachingMode ?? existing.teachingMode ?? undefined,
        rotationGroup: payload.rotationGroup ?? existing.rotationGroup ?? undefined
      },
      existing.id
    );
    const nextTrack = payload.track || level?.track;
    if (level && nextTrack && nextTrack !== level.track) {
      throw new ConflictException("Class track must match level track.");
    }

    try {
      const updated = await this.prisma.classroom.update({
        where: { id },
        data: {
          schoolYearId: payload.schoolYearId,
          levelId: payload.levelId,
          track: payload.track,
          code: payload.code?.trim(),
          label: payload.label?.trim(),
          capacity: payload.capacity,
          status: payload.status,
          homeroomTeacherName: payload.homeroomTeacherName?.trim(),
          mainRoom: payload.mainRoom?.trim(),
          actualCapacity: payload.actualCapacity,
          filiere: payload.filiere?.trim(),
          series: payload.series?.trim(),
          speciality: payload.speciality?.trim(),
          description: payload.description?.trim(),
          teachingMode: payload.teachingMode,
          rotationGroup: payload.rotationGroup ?? undefined,
          updatedAt: new Date()
        }
      });
      return this.classroomView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaError(
        error,
        "Class code already exists for this school year."
      );
      throw error;
    }
  }

  async deleteClassroom(tenantId: string, id: string): Promise<void> {
    await this.requireClassroom(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.classroom.delete({ where: { id } }),
      "Class cannot be deleted because it is still used."
    );
  }

  async listSubjects(tenantId: string): Promise<SubjectView[]> {
    const rows = await this.prisma.subject.findMany({
      where: { tenantId },
      include: { levelScopes: true },
      orderBy: [{ label: "asc" }]
    });
    return rows.map((row) => this.subjectView(row));
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
              payload.defaultCoefficient === undefined ? null : new Prisma.Decimal(payload.defaultCoefficient),
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
      return this.subjectView(created);
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
      return this.subjectView(updated);
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
    return rows.map((row) => this.academicPeriodView(row));
  }

  async createAcademicPeriod(
    tenantId: string,
    payload: CreateAcademicPeriodDto
  ): Promise<AcademicPeriodView> {
    await this.requireSchoolYear(tenantId, payload.schoolYearId);
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
      return this.academicPeriodView(created);
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
      await this.requireSchoolYear(tenantId, payload.schoolYearId);
    }
    if (existing.status === "CLOSED" && this.isClosedPeriodStructuralChange(payload)) {
      throw new ConflictException("Closed academic period cannot be modified on structural fields.");
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
      return this.academicPeriodView(updated);
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

  listAcademicTracks(): Array<{ code: AcademicTrack; label: string }> {
    return [
      { code: AcademicTrack.FRANCOPHONE, label: "Francophone" },
      { code: AcademicTrack.ARABOPHONE, label: "Arabophone" }
    ];
  }

  async listPedagogicalRules(
    tenantId: string,
    filters: {
      schoolYearId?: string;
      cycleId?: string;
      levelId?: string;
      classId?: string;
      ruleType?: string;
      track?: string;
    }
  ) {
    return this.academicStructureService.listPedagogicalRules(tenantId, filters);
  }

  async createPedagogicalRule(
    tenantId: string,
    payload: CreatePedagogicalRuleDto
  ) {
    return this.academicStructureService.createPedagogicalRule(tenantId, {
      ...payload,
      config: payload.config as Prisma.InputJsonValue
    });
  }

  async deletePedagogicalRule(tenantId: string, id: string): Promise<void> {
    await this.academicStructureService.deletePedagogicalRule(tenantId, id);
  }

  private resolveSchoolYearCode(payload: CreateSchoolYearDto): string {
    const explicitCode = payload.code?.trim();
    if (explicitCode) return explicitCode;

    return `AS-${payload.label.trim().replace(/\s+/g, "-").toUpperCase()}`;
  }

  private resolveSchoolYearStatus(status: string, isActive?: boolean): string {
    if (isActive) return "ACTIVE";
    return status;
  }

  private resolveSchoolYearSortOrder(payload: { sortOrder?: number; startDate: string }): number {
    return payload.sortOrder ?? new Date(payload.startDate).getUTCFullYear();
  }

  private toDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private datesOverlap(
    startA: string,
    endA: string,
    startB: string,
    endB: string
  ): boolean {
    return this.toDateOnly(startA) <= this.toDateOnly(endB) && this.toDateOnly(startB) <= this.toDateOnly(endA);
  }

  private async assertSchoolYearRules(
    tenantId: string,
    payload: {
      code: string;
      label: string;
      startDate: string;
      endDate: string;
      status: string;
      previousYearId?: string;
    },
    ignoreId?: string
  ): Promise<void> {
    if (this.toDateOnly(payload.endDate) <= this.toDateOnly(payload.startDate)) {
      throw new BadRequestException("School year end date must be after start date.");
    }

    if (payload.status === "ACTIVE") {
      const overlappingActiveYear = await this.prisma.schoolYear.findFirst({
        where: {
          tenantId,
          id: ignoreId ? { not: ignoreId } : undefined,
          status: "ACTIVE",
          startDate: { lte: new Date(payload.endDate) },
          endDate: { gte: new Date(payload.startDate) }
        }
      });
      if (overlappingActiveYear) {
        throw new ConflictException("Another active school year overlaps this date range.");
      }
    }

    const duplicateLabel = await this.prisma.schoolYear.findFirst({
      where: {
        tenantId,
        id: ignoreId ? { not: ignoreId } : undefined,
        label: payload.label.trim()
      }
    });
    if (duplicateLabel) {
      throw new ConflictException("School year label already exists.");
    }

    if (payload.previousYearId) {
      const previousYear = await this.requireSchoolYear(tenantId, payload.previousYearId);
      if (ignoreId && previousYear.id === ignoreId) {
        throw new BadRequestException("School year cannot reference itself as previous year.");
      }
      if (previousYear.endDate >= this.toDateOnly(payload.startDate)) {
        throw new ConflictException("Previous school year should end before the current one starts.");
      }
    }
  }

  private async assertCycleRules(
    tenantId: string,
    payload: {
      schoolYearId: string;
      code: string;
      label: string;
      academicStage: AcademicStage;
      sortOrder: number;
      description?: string;
      theoreticalAgeMin?: number;
      theoreticalAgeMax?: number;
      status?: string;
    },
    ignoreId?: string
  ): Promise<void> {
    if (
      payload.theoreticalAgeMin !== undefined &&
      payload.theoreticalAgeMax !== undefined &&
      payload.theoreticalAgeMax < payload.theoreticalAgeMin
    ) {
      throw new BadRequestException("Cycle theoretical age max must be greater than or equal to min.");
    }

    const sameOrder = await this.prisma.cycle.findFirst({
      where: {
        tenantId,
        id: ignoreId ? { not: ignoreId } : undefined,
        schoolYearId: payload.schoolYearId,
        sortOrder: payload.sortOrder
      }
    });
    if (sameOrder) {
      throw new ConflictException("Cycle sort order already exists for this school year.");
    }
  }

  private async assertLevelRules(
    tenantId: string,
    payload: {
      cycleId: string;
      track: AcademicTrack;
      code: string;
      label: string;
      alias?: string;
      sortOrder: number;
      status: string;
      theoreticalAge?: number;
      description?: string;
      defaultSection?: string;
      rotationGroup?: RotationGroup;
    },
    ignoreId?: string
  ): Promise<void> {
    const duplicateCode = await this.prisma.level.findFirst({
      where: {
        tenantId,
        id: ignoreId ? { not: ignoreId } : undefined,
        cycleId: payload.cycleId,
        code: payload.code.trim()
      }
    });
    if (duplicateCode) {
      throw new ConflictException("Level code already exists in this cycle.");
    }

    const sameOrder = await this.prisma.level.findFirst({
      where: {
        tenantId,
        id: ignoreId ? { not: ignoreId } : undefined,
        cycleId: payload.cycleId,
        sortOrder: payload.sortOrder
      }
    });
    if (sameOrder) {
      throw new ConflictException("Level sort order already exists in this cycle.");
    }
  }

  private async assertClassroomRules(
    tenantId: string,
    payload: {
      schoolYearId: string;
      levelId: string;
      track: AcademicTrack;
      code: string;
      label: string;
      capacity: number;
      status: string;
      homeroomTeacherName?: string;
      mainRoom?: string;
      actualCapacity?: number;
      filiere?: string;
      series?: string;
      speciality?: string;
      description?: string;
      teachingMode?: string;
      rotationGroup?: RotationGroup;
    },
    ignoreId?: string
  ): Promise<void> {
    if (payload.capacity <= 0) {
      throw new BadRequestException("Class maximum capacity must be greater than zero.");
    }
    if (payload.actualCapacity !== undefined && payload.actualCapacity > payload.capacity) {
      throw new ConflictException("Actual class capacity cannot exceed maximum capacity.");
    }

    const duplicateCode = await this.prisma.classroom.findFirst({
      where: {
        tenantId,
        id: ignoreId ? { not: ignoreId } : undefined,
        schoolYearId: payload.schoolYearId,
        code: payload.code.trim()
      }
    });
    if (duplicateCode) {
      throw new ConflictException("Class code already exists for this school year.");
    }
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

    const schoolYear = await this.requireSchoolYear(tenantId, payload.schoolYearId);
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
      throw new ConflictException("Another academic period of the same type overlaps this date range.");
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

  async requireSchoolYear(tenantId: string, id: string): Promise<SchoolYear> {
    const row = await this.prisma.schoolYear.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("School year not found.");
    }
    return row;
  }

  async requireCycle(tenantId: string, id: string): Promise<Cycle> {
    const row = await this.prisma.cycle.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("Cycle not found.");
    }
    return row;
  }

  async requireLevel(tenantId: string, id: string): Promise<Level> {
    const row = await this.prisma.level.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("Level not found.");
    }
    return row;
  }

  async requireClassroom(tenantId: string, id: string): Promise<Classroom> {
    const row = await this.prisma.classroom.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("Class not found.");
    }
    return row;
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

  async requireAcademicPeriod(
    tenantId: string,
    id: string
  ): Promise<AcademicPeriod> {
    const row = await this.prisma.academicPeriod.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("Academic period not found.");
    }
    return row;
  }

  private schoolYearView(row: SchoolYear): SchoolYearView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      label: row.label,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      status: row.status,
      previousYearId: row.previousYearId || undefined,
      isActive: row.isActive,
      isDefault: row.isDefault,
      sortOrder: row.sortOrder === null ? undefined : row.sortOrder,
      comment: row.comment || undefined
    };
  }

  private cycleView(row: Cycle): CycleView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      schoolYearId: row.schoolYearId,
      code: row.code,
      label: row.label,
      academicStage: row.academicStage,
      sortOrder: row.sortOrder,
      description: row.description || undefined,
      theoreticalAgeMin: row.theoreticalAgeMin === null ? undefined : row.theoreticalAgeMin,
      theoreticalAgeMax: row.theoreticalAgeMax === null ? undefined : row.theoreticalAgeMax,
      status: row.status
    };
  }

  private levelView(row: Level): LevelView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      cycleId: row.cycleId,
      track: row.track,
      code: row.code,
      label: row.label,
      alias: row.alias || undefined,
      sortOrder: row.sortOrder,
      status: row.status,
      theoreticalAge: row.theoreticalAge === null ? undefined : row.theoreticalAge,
      description: row.description || undefined,
      defaultSection: row.defaultSection || undefined,
      rotationGroup: row.rotationGroup || undefined
    };
  }

  private classroomView(row: Classroom): ClassroomView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      schoolYearId: row.schoolYearId,
      levelId: row.levelId,
      track: row.track,
      code: row.code,
      label: row.label,
      capacity: row.capacity === null ? undefined : row.capacity,
      status: row.status,
      homeroomTeacherName: row.homeroomTeacherName || undefined,
      mainRoom: row.mainRoom || undefined,
      actualCapacity: row.actualCapacity === null ? undefined : row.actualCapacity,
      filiere: row.filiere || undefined,
      series: row.series || undefined,
      speciality: row.speciality || undefined,
      description: row.description || undefined,
      teachingMode: row.teachingMode || undefined,
      rotationGroup: row.rotationGroup || undefined
    };
  }

  private subjectView(row: SubjectWithLevelScopes): SubjectView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      label: row.label,
      status: row.status,
      nature: row.nature,
      isArabic: row.isArabic,
      shortLabel: row.shortLabel || undefined,
      defaultCoefficient:
        row.defaultCoefficient === null ? undefined : Number(row.defaultCoefficient),
      category: row.category || undefined,
      description: row.description || undefined,
      color: row.color || undefined,
      weeklyHours: row.weeklyHours === null ? undefined : Number(row.weeklyHours),
      isGraded: row.isGraded,
      isOptional: row.isOptional,
      levelIds: row.levelScopes.map((item) => item.levelId)
    };
  }

  private academicPeriodView(row: AcademicPeriod): AcademicPeriodView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      schoolYearId: row.schoolYearId,
      code: row.code,
      label: row.label,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      periodType: row.periodType,
      sortOrder: row.sortOrder,
      status: row.status,
      parentPeriodId: row.parentPeriodId || undefined,
      isGradeEntryOpen: row.isGradeEntryOpen,
      gradeEntryDeadline: row.gradeEntryDeadline
        ? row.gradeEntryDeadline.toISOString().slice(0, 10)
        : undefined,
      lockDate: row.lockDate ? row.lockDate.toISOString().slice(0, 10) : undefined,
      comment: row.comment || undefined
    };
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
