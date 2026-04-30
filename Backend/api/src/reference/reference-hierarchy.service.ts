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
  type Classroom,
  type Cycle,
  type Level
} from "@prisma/client";

import { AcademicStructureService } from "../academic-structure/academic-structure.service";
import { PrismaService } from "../database/prisma.service";
import {
  CreateClassroomDto,
  CreateCycleDto,
  CreateLevelDto,
  UpdateClassroomDto,
  UpdateCycleDto,
  UpdateLevelDto
} from "./dto/reference.dto";
import {
  type ClassroomView,
  classroomView,
  type CycleView,
  cycleView,
  type LevelView,
  levelView
} from "./reference.types";
import { ReferenceSchoolYearsService } from "./reference-school-years.service";

@Injectable()
export class ReferenceHierarchyService {
  constructor(
    private readonly academicStructureService: AcademicStructureService,
    private readonly prisma: PrismaService,
    private readonly schoolYearsService: ReferenceSchoolYearsService
  ) {}

  async listCycles(tenantId: string): Promise<CycleView[]> {
    const rows = await this.prisma.cycle.findMany({
      where: { tenantId },
      orderBy: [{ schoolYearId: "desc" }, { sortOrder: "asc" }, { label: "asc" }]
    });
    return rows.map((row) => cycleView(row));
  }

  async createCycle(tenantId: string, payload: CreateCycleDto): Promise<CycleView> {
    await this.schoolYearsService.requireSchoolYear(tenantId, payload.schoolYearId);
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
      return cycleView(created);
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
      await this.schoolYearsService.requireSchoolYear(tenantId, payload.schoolYearId);
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
      return cycleView(updated);
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
        track: track ? this.academicStructureService.normalizeTrack(track) : undefined
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
    });
    return rows.map((row) => levelView(row));
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
      return levelView(created);
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
      return levelView(updated);
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
        track: filters.track ? this.academicStructureService.normalizeTrack(filters.track) : undefined
      },
      orderBy: [{ label: "asc" }]
    });
    return rows.map((row) => classroomView(row));
  }

  async createClassroom(
    tenantId: string,
    payload: CreateClassroomDto
  ): Promise<ClassroomView> {
    await this.schoolYearsService.requireSchoolYear(tenantId, payload.schoolYearId);
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
      return classroomView(created);
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
      await this.schoolYearsService.requireSchoolYear(tenantId, payload.schoolYearId);
    }
    const level = payload.levelId ? await this.requireLevel(tenantId, payload.levelId) : undefined;
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
      return classroomView(updated);
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
      throw new BadRequestException(
        "Cycle theoretical age max must be greater than or equal to min."
      );
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
