import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import {
  AcademicPlacementStatus,
  type AcademicTrack,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import {
  ADMISSION_ACADEMIC_OPTIONS_CONTRACT_VERSION,
  type AdmissionAcademicCatalog,
  type AdmissionAcademicClass,
  type AdmissionAcademicErrorCode,
  type AdmissionAcademicLevel,
  type AdmissionAcademicOptionsResponse,
  type AdmissionAcademicSchoolYear,
  type AdmissionAcademicSelection,
  type CompleteAdmissionAcademicSelection,
  type ValidatedAdmissionAcademicContext,
} from "./admission-academic-policy.types";

type PrismaClientLike = PrismaService | Prisma.TransactionClient;
type ValidationPhase = "DRAFT" | "FINALIZE";

const ACTIVE_PLACEMENT_STATUSES = [AcademicPlacementStatus.ACTIVE];

@Injectable()
export class AdmissionAcademicPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getOptions(
    tenantId: string,
    selected: AdmissionAcademicSelection,
  ): Promise<AdmissionAcademicOptionsResponse> {
    const schoolYears = await this.listActiveSchoolYears(tenantId, this.prisma);
    const response = this.buildOptionsResponse(selected, schoolYears);
    if (!selected.schoolYearId) {
      if (selected.track || selected.levelId || selected.cycleId) {
        throw this.failure("ACADEMIC_CONTEXT_INVALID", "DRAFT");
      }
      return response;
    }

    this.assertSingleSelectedSchoolYear(
      schoolYears,
      selected.schoolYearId,
      "DRAFT",
    );
    const levels = await this.listActiveLevels(
      tenantId,
      selected.schoolYearId,
      this.prisma,
    );
    response.tracks = this.uniqueTracks(levels);
    if (!selected.track) {
      if (selected.levelId || selected.cycleId) {
        throw this.failure("ACADEMIC_CONTEXT_INVALID", "DRAFT");
      }
      return response;
    }
    if (!response.tracks.includes(selected.track)) {
      throw this.failure("TRACK_NOT_AVAILABLE", "DRAFT");
    }

    response.levels = levels.filter((level) => level.track === selected.track);
    if (!selected.levelId) {
      if (selected.cycleId) {
        throw this.failure("ACADEMIC_CONTEXT_INVALID", "DRAFT");
      }
      return response;
    }
    const selectedLevel = response.levels.find(
      (level) => level.id === selected.levelId,
    );
    if (!selectedLevel) throw this.failure("LEVEL_NOT_AVAILABLE", "DRAFT");
    if (selected.cycleId && selected.cycleId !== selectedLevel.cycleId) {
      throw this.failure("ACADEMIC_CONTEXT_INVALID", "DRAFT");
    }

    response.classes = await this.listActiveClasses(
      tenantId,
      selected.schoolYearId,
      selectedLevel,
      this.prisma,
    );
    return response;
  }

  async getPrerequisiteCatalog(
    tenantId: string,
  ): Promise<AdmissionAcademicCatalog> {
    const schoolYears = await this.listActiveSchoolYears(tenantId, this.prisma);
    const schoolYear = schoolYears.length === 1 ? schoolYears[0] : null;
    if (!schoolYear) {
      return {
        schoolYears,
        schoolYear: null,
        tracks: [],
        levels: [],
        classes: [],
        invalidClassCount: 0,
      };
    }

    const levels = await this.listActiveLevels(
      tenantId,
      schoolYear.id,
      this.prisma,
    );
    const levelById = new Map(levels.map((level) => [level.id, level]));
    const classRows = await this.listClassRows(
      tenantId,
      schoolYear.id,
      levels.map((level) => level.id),
      this.prisma,
    );
    const invalidClassCount = classRows.filter((classroom) => {
      const level = levelById.get(classroom.levelId);
      return !level || level.track !== classroom.track;
    }).length;
    const classes = classRows.flatMap((classroom) => {
      const level = levelById.get(classroom.levelId);
      return level && level.track === classroom.track
        ? [this.toClassOption(classroom, level.cycleId)]
        : [];
    });

    return {
      schoolYears,
      schoolYear,
      tracks: this.uniqueTracks(levels),
      levels,
      classes,
      invalidClassCount,
    };
  }

  async assertDraftSelection(
    tenantId: string,
    selection: AdmissionAcademicSelection,
  ): Promise<void> {
    const hasDependentSelection = Boolean(
      selection.cycleId ||
      selection.track ||
      selection.levelId ||
      selection.classId,
    );
    if (!selection.schoolYearId) {
      if (hasDependentSelection) {
        throw this.failure("ACADEMIC_CONTEXT_INVALID", "DRAFT");
      }
      return;
    }

    const schoolYears = await this.listActiveSchoolYears(tenantId, this.prisma);
    this.assertSingleSelectedSchoolYear(
      schoolYears,
      selection.schoolYearId,
      "DRAFT",
    );
    if (!selection.track) {
      if (selection.cycleId || selection.levelId || selection.classId) {
        throw this.failure("ACADEMIC_CONTEXT_INVALID", "DRAFT");
      }
      return;
    }

    const levels = await this.listActiveLevels(
      tenantId,
      selection.schoolYearId,
      this.prisma,
    );
    if (!selection.levelId) {
      if (!levels.some((level) => level.track === selection.track)) {
        throw this.failure("TRACK_NOT_AVAILABLE", "DRAFT");
      }
      if (selection.cycleId || selection.classId) {
        throw this.failure("ACADEMIC_CONTEXT_INVALID", "DRAFT");
      }
      return;
    }
    const level = levels.find(
      (item) => item.id === selection.levelId && item.track === selection.track,
    );
    if (!level) throw this.failure("LEVEL_NOT_AVAILABLE", "DRAFT");
    if (!selection.cycleId || selection.cycleId !== level.cycleId) {
      throw this.failure("ACADEMIC_CONTEXT_INVALID", "DRAFT");
    }
    if (!selection.classId) return;

    const classroom = await this.findActiveClassroom(
      tenantId,
      selection as CompleteAdmissionAcademicSelection,
      this.prisma,
    );
    if (!classroom) throw this.failure("CLASS_NOT_AVAILABLE", "DRAFT");
  }

  async assertCompleteSelection(
    tenantId: string,
    selection: CompleteAdmissionAcademicSelection,
    transaction: Prisma.TransactionClient,
  ): Promise<ValidatedAdmissionAcademicContext> {
    const schoolYears = await this.listActiveSchoolYears(tenantId, transaction);
    const selectedYear = this.assertSingleSelectedSchoolYear(
      schoolYears,
      selection.schoolYearId,
      "FINALIZE",
    );
    const levels = await this.listActiveLevels(
      tenantId,
      selection.schoolYearId,
      transaction,
    );
    const level = levels.find(
      (item) =>
        item.id === selection.levelId &&
        item.cycleId === selection.cycleId &&
        item.track === selection.track,
    );
    if (!level) throw this.failure("LEVEL_NOT_AVAILABLE", "FINALIZE");

    const classroom = await this.findActiveClassroom(
      tenantId,
      selection,
      transaction,
    );
    if (!classroom) throw this.failure("CLASS_NOT_AVAILABLE", "FINALIZE");

    return {
      selection,
      schoolYear: {
        id: selectedYear.id,
        startDate: new Date(`${selectedYear.startDate}T00:00:00.000Z`),
        endDate: new Date(`${selectedYear.endDate}T00:00:00.000Z`),
      },
      level: {
        id: level.id,
        cycleId: level.cycleId,
        track: level.track,
      },
      classroom,
    };
  }

  isCompleteSelectionAvailable(
    selection: AdmissionAcademicSelection | undefined,
    catalog: Pick<
      AdmissionAcademicCatalog,
      "schoolYear" | "levels" | "classes"
    >,
  ): boolean {
    if (
      !selection?.schoolYearId ||
      !selection.cycleId ||
      !selection.track ||
      !selection.levelId ||
      !selection.classId
    ) {
      return false;
    }
    const level = catalog.levels.find(
      (item) =>
        item.id === selection.levelId &&
        item.cycleId === selection.cycleId &&
        item.track === selection.track,
    );
    const classroom = catalog.classes.find(
      (item) =>
        item.id === selection.classId &&
        item.schoolYearId === selection.schoolYearId &&
        item.cycleId === selection.cycleId &&
        item.levelId === selection.levelId &&
        item.track === selection.track,
    );
    return Boolean(
      catalog.schoolYear?.id === selection.schoolYearId && level && classroom,
    );
  }

  private async listActiveSchoolYears(
    tenantId: string,
    client: PrismaClientLike,
  ): Promise<AdmissionAcademicSchoolYear[]> {
    const rows = await client.schoolYear.findMany({
      where: { tenantId, status: "ACTIVE", isActive: true },
      orderBy: [{ isDefault: "desc" }, { startDate: "desc" }],
      select: {
        id: true,
        code: true,
        label: true,
        startDate: true,
        endDate: true,
      },
    });
    return rows.map((row) => ({
      ...row,
      startDate: this.toDateOnly(row.startDate),
      endDate: this.toDateOnly(row.endDate),
    }));
  }

  private async listActiveLevels(
    tenantId: string,
    schoolYearId: string,
    client: PrismaClientLike,
  ): Promise<AdmissionAcademicLevel[]> {
    const rows = await client.level.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        cycle: {
          is: { tenantId, schoolYearId, status: "ACTIVE" },
        },
      },
      orderBy: [{ cycle: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      select: {
        id: true,
        cycleId: true,
        code: true,
        label: true,
        track: true,
        sortOrder: true,
        cycle: { select: { code: true, label: true } },
      },
    });
    return rows.map((level) => ({
      id: level.id,
      cycleId: level.cycleId,
      cycleCode: level.cycle.code,
      cycleLabel: level.cycle.label,
      code: level.code,
      label: level.label,
      track: level.track,
      sortOrder: level.sortOrder,
    }));
  }

  private async listActiveClasses(
    tenantId: string,
    schoolYearId: string,
    level: AdmissionAcademicLevel,
    client: PrismaClientLike,
  ): Promise<AdmissionAcademicClass[]> {
    const rows = await this.listClassRows(
      tenantId,
      schoolYearId,
      [level.id],
      client,
    );
    return rows
      .filter(
        (classroom) =>
          classroom.levelId === level.id && classroom.track === level.track,
      )
      .map((classroom) => this.toClassOption(classroom, level.cycleId));
  }

  private async listClassRows(
    tenantId: string,
    schoolYearId: string,
    levelIds: string[],
    client: PrismaClientLike,
  ) {
    if (levelIds.length === 0) return [];
    return client.classroom.findMany({
      where: {
        tenantId,
        schoolYearId,
        status: "ACTIVE",
        levelId: { in: levelIds },
      },
      orderBy: [{ label: "asc" }],
      select: {
        id: true,
        schoolYearId: true,
        levelId: true,
        code: true,
        label: true,
        track: true,
        capacity: true,
        actualCapacity: true,
        _count: {
          select: {
            trackPlacements: {
              where: { placementStatus: { in: ACTIVE_PLACEMENT_STATUSES } },
            },
          },
        },
      },
    });
  }

  private async findActiveClassroom(
    tenantId: string,
    selection: CompleteAdmissionAcademicSelection,
    client: PrismaClientLike,
  ) {
    return client.classroom.findFirst({
      where: {
        id: selection.classId,
        tenantId,
        schoolYearId: selection.schoolYearId,
        levelId: selection.levelId,
        track: selection.track,
        status: "ACTIVE",
        schoolYear: {
          is: { tenantId, status: "ACTIVE", isActive: true },
        },
        level: {
          is: {
            tenantId,
            cycleId: selection.cycleId,
            track: selection.track,
            status: "ACTIVE",
            cycle: {
              is: {
                tenantId,
                schoolYearId: selection.schoolYearId,
                status: "ACTIVE",
              },
            },
          },
        },
      },
      select: { id: true, schoolYearId: true, levelId: true, track: true },
    });
  }

  private toClassOption(
    classroom: Awaited<ReturnType<typeof this.listClassRows>>[number],
    cycleId: string,
  ): AdmissionAcademicClass {
    const currentEnrollmentCount = classroom._count.trackPlacements;
    const placesRemaining =
      classroom.capacity === null
        ? undefined
        : Math.max(0, classroom.capacity - currentEnrollmentCount);
    return {
      id: classroom.id,
      schoolYearId: classroom.schoolYearId,
      cycleId,
      levelId: classroom.levelId,
      code: classroom.code,
      label: classroom.label,
      track: classroom.track,
      capacity: classroom.capacity ?? undefined,
      actualCapacity: classroom.actualCapacity ?? undefined,
      currentEnrollmentCount,
      placesRemaining,
      capacityStatus:
        classroom.capacity === null
          ? "UNBOUNDED"
          : currentEnrollmentCount >= classroom.capacity
            ? "FULL"
            : "AVAILABLE",
    };
  }

  private assertSingleSelectedSchoolYear(
    schoolYears: AdmissionAcademicSchoolYear[],
    selectedId: string,
    phase: ValidationPhase,
  ): AdmissionAcademicSchoolYear {
    const selected = schoolYears.find((item) => item.id === selectedId);
    if (schoolYears.length !== 1 || !selected) {
      throw this.failure("SCHOOL_YEAR_NOT_AVAILABLE", phase);
    }
    return selected;
  }

  private buildOptionsResponse(
    selected: AdmissionAcademicSelection,
    schoolYears: AdmissionAcademicSchoolYear[],
  ): AdmissionAcademicOptionsResponse {
    return {
      contractVersion: ADMISSION_ACADEMIC_OPTIONS_CONTRACT_VERSION,
      selectionPolicy: {
        schoolYear: "SINGLE_ACTIVE",
        classCapacity: "INFORMATIONAL",
        automaticClassSelection: false,
        automaticStudentSelection: false,
      },
      selected,
      schoolYears,
      tracks: [],
      levels: [],
      classes: [],
    };
  }

  private uniqueTracks(levels: AdmissionAcademicLevel[]): AcademicTrack[] {
    return [...new Set(levels.map((level) => level.track))].sort();
  }

  private failure(
    code: AdmissionAcademicErrorCode,
    phase: ValidationPhase,
  ): BadRequestException | ConflictException {
    const payload = {
      code,
      message: "Academic selection is not available for this tenant.",
    };
    return phase === "FINALIZE"
      ? new ConflictException(payload)
      : new BadRequestException(payload);
  }

  private toDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
