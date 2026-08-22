import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  AdmissionCaseMode,
  AdmissionCaseStatus,
  Prisma,
} from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { UserRole } from "../security/roles.enum";
import {
  ADMISSION_CASE_CONTRACT_VERSION,
  ADMISSION_DRAFT_PAYLOAD_VERSION,
  type AdmissionAcademicsDraft,
  type AdmissionCaseCompletion,
  type AdmissionCaseIssue,
  type AdmissionCaseMutableSection,
  type AdmissionCasePage,
  type AdmissionCaseView,
  type AdmissionDraftData,
  type AdmissionFinanceDraft,
  type AdmissionGuardianDraft,
  type AdmissionGuardiansDraft,
  type AdmissionStudentDraft,
} from "./admission-cases.types";
import { AdmissionPrerequisitesService } from "./admission-prerequisites.service";
import { type AdmissionPrerequisitesResponse } from "./admission-prerequisites.types";
import {
  AdmissionAcademicsSectionDto,
  AdmissionCaseListQueryDto,
  AdmissionFinanceSectionDto,
  AdmissionGuardiansSectionDto,
  AdmissionStudentSectionDto,
  CancelAdmissionCaseDto,
  CreateAdmissionCaseDto,
  UpdateAdmissionCaseSectionDto,
} from "./dto/admission-cases.dto";

const admissionCaseSelect = {
  id: true,
  tenantId: true,
  mode: true,
  status: true,
  version: true,
  payloadVersion: true,
  draftData: true,
  studentId: true,
  schoolYearId: true,
  finalizationResult: true,
  confirmedAt: true,
  failedAt: true,
  failureCode: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  student: {
    select: {
      status: true,
      deletedAt: true,
      archivedAt: true,
    },
  },
} satisfies Prisma.AdmissionCaseSelect;

type AdmissionCaseRow = Prisma.AdmissionCaseGetPayload<{
  select: typeof admissionCaseSelect;
}>;

type AdmissionActor = {
  id: string;
  role: UserRole;
};

type DtoConstructor<T extends object> = new () => T;

@Injectable()
export class AdmissionCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prerequisitesService: AdmissionPrerequisitesService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    tenantId: string,
    actor: AdmissionActor,
    payload: CreateAdmissionCaseDto,
  ): Promise<AdmissionCaseView> {
    const prerequisites = await this.prerequisitesService.getPrerequisites(
      tenantId,
      actor.role,
    );
    this.assertModeAllowed(prerequisites, payload.mode);

    let studentId: string | null = null;
    if (payload.mode === AdmissionCaseMode.NEW_ADMISSION) {
      if (payload.studentId) {
        throw this.badRequest(
          "ADMISSION_MODE_INVALID",
          "A new admission cannot reference an existing student.",
        );
      }
    } else {
      if (!payload.studentId) {
        throw this.badRequest(
          "ADMISSION_MODE_INVALID",
          "A re-enrollment requires an existing student.",
        );
      }
      await this.requireSelectableStudent(tenantId, payload.studentId);
      studentId = payload.studentId;
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const admissionCase = await tx.admissionCase.create({
        data: {
          tenantId,
          mode: payload.mode,
          studentId,
          createdByUserId: actor.id,
          updatedByUserId: actor.id,
        },
        select: admissionCaseSelect,
      });
      await this.auditService.recordLog(
        {
          tenantId,
          userId: actor.id,
          action: "ADMISSION_CASE_CREATED",
          resource: "admission_cases",
          resourceId: admissionCase.id,
          payload: { mode: payload.mode },
        },
        tx,
      );
      return admissionCase;
    });

    return this.toView(created, prerequisites);
  }

  async list(
    tenantId: string,
    role: UserRole,
    query: AdmissionCaseListQueryDto,
  ): Promise<AdmissionCasePage> {
    const where: Prisma.AdmissionCaseWhereInput = {
      tenantId,
      ...(query.mode ? { mode: query.mode } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [[rows, total], prerequisites] = await Promise.all([
      this.prisma.$transaction([
        this.prisma.admissionCase.findMany({
          where,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          skip,
          take: query.limit,
          select: admissionCaseSelect,
        }),
        this.prisma.admissionCase.count({ where }),
      ]),
      this.prerequisitesService.getPrerequisites(tenantId, role),
    ]);

    return {
      contractVersion: ADMISSION_CASE_CONTRACT_VERSION,
      items: rows.map((row) => this.toView(row, prerequisites)),
      page: query.page,
      pageSize: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }

  async get(
    tenantId: string,
    role: UserRole,
    id: string,
  ): Promise<AdmissionCaseView> {
    const [row, prerequisites] = await Promise.all([
      this.requireCase(tenantId, id),
      this.prerequisitesService.getPrerequisites(tenantId, role),
    ]);
    return this.toView(row, prerequisites);
  }

  async saveSection(
    tenantId: string,
    actor: AdmissionActor,
    id: string,
    section: AdmissionCaseMutableSection,
    payload: UpdateAdmissionCaseSectionDto,
  ): Promise<AdmissionCaseView> {
    const [current, prerequisites] = await Promise.all([
      this.requireCase(tenantId, id),
      this.prerequisitesService.getPrerequisites(tenantId, actor.role),
    ]);
    this.assertMutable(current.status);
    if (current.version !== payload.expectedVersion) {
      throw this.versionConflict();
    }

    const nextDraft = this.replaceSection(
      this.parseStoredDraftData(current.draftData),
      section,
      payload.data,
    );
    await this.validateSectionReferences(
      tenantId,
      current.mode,
      section,
      nextDraft,
      prerequisites,
    );
    const readiness = this.evaluateReadiness(current, nextDraft, prerequisites);
    const nextStatus = readiness.ready
      ? AdmissionCaseStatus.READY
      : AdmissionCaseStatus.DRAFT;

    const result = await this.prisma.admissionCase.updateMany({
      where: {
        id,
        tenantId,
        version: payload.expectedVersion,
        status: {
          in: [AdmissionCaseStatus.DRAFT, AdmissionCaseStatus.READY],
        },
      },
      data: {
        draftData: nextDraft as Prisma.InputJsonObject,
        schoolYearId: nextDraft.ACADEMICS?.schoolYearId ?? null,
        status: nextStatus,
        version: { increment: 1 },
        updatedByUserId: actor.id,
        updatedAt: new Date(),
      },
    });

    if (result.count !== 1) {
      await this.throwMutationConflict(tenantId, id, payload.expectedVersion);
    }

    const updated = await this.requireCase(tenantId, id);
    return this.toView(updated, prerequisites);
  }

  async cancel(
    tenantId: string,
    actor: AdmissionActor,
    id: string,
    payload: CancelAdmissionCaseDto,
  ): Promise<AdmissionCaseView> {
    const current = await this.requireCase(tenantId, id);
    this.assertMutable(current.status);
    if (current.version !== payload.expectedVersion) {
      throw this.versionConflict();
    }

    const cancelledAt = new Date();
    const changed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.admissionCase.updateMany({
        where: {
          id,
          tenantId,
          version: payload.expectedVersion,
          status: {
            in: [AdmissionCaseStatus.DRAFT, AdmissionCaseStatus.READY],
          },
        },
        data: {
          status: AdmissionCaseStatus.CANCELLED,
          cancelledAt,
          version: { increment: 1 },
          updatedByUserId: actor.id,
          updatedAt: cancelledAt,
        },
      });
      if (result.count !== 1) return false;

      await this.auditService.recordLog(
        {
          tenantId,
          userId: actor.id,
          action: "ADMISSION_CASE_CANCELLED",
          resource: "admission_cases",
          resourceId: id,
          payload: { previousStatus: current.status },
        },
        tx,
      );
      return true;
    });

    if (!changed) {
      await this.throwMutationConflict(tenantId, id, payload.expectedVersion);
    }

    const [updated, prerequisites] = await Promise.all([
      this.requireCase(tenantId, id),
      this.prerequisitesService.getPrerequisites(tenantId, actor.role),
    ]);
    return this.toView(updated, prerequisites);
  }

  private async requireCase(
    tenantId: string,
    id: string,
  ): Promise<AdmissionCaseRow> {
    const row = await this.prisma.admissionCase.findFirst({
      where: { id, tenantId },
      select: admissionCaseSelect,
    });
    if (!row) {
      throw new NotFoundException({
        code: "ADMISSION_CASE_NOT_FOUND",
        message: "Admission case not found.",
      });
    }
    return row;
  }

  private async requireSelectableStudent(
    tenantId: string,
    studentId: string,
  ): Promise<void> {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId,
        deletedAt: null,
        archivedAt: null,
        status: { not: "ARCHIVED" },
      },
      select: { id: true },
    });
    if (!student) {
      throw this.badRequest(
        "ADMISSION_EXISTING_STUDENT_UNAVAILABLE",
        "Existing student is not available for re-enrollment.",
      );
    }
  }

  private assertModeAllowed(
    prerequisites: AdmissionPrerequisitesResponse,
    mode: AdmissionCaseMode,
  ): void {
    if (!prerequisites.permissions.modes[mode].allowed) {
      throw new ForbiddenException({
        code: "ADMISSION_PERMISSION_DENIED",
        message: "Admission mode is not permitted.",
      });
    }
  }

  private assertMutable(status: AdmissionCaseStatus): void {
    if (status === AdmissionCaseStatus.CANCELLED) {
      throw new ConflictException({
        code: "ADMISSION_CASE_CANCELLED",
        message: "Cancelled admission cases cannot be modified.",
      });
    }
    if (
      status !== AdmissionCaseStatus.DRAFT &&
      status !== AdmissionCaseStatus.READY
    ) {
      throw new ConflictException({
        code: "ADMISSION_INVALID_TRANSITION",
        message: "Admission case status does not allow this transition.",
      });
    }
  }

  private async throwMutationConflict(
    tenantId: string,
    id: string,
    expectedVersion: number,
  ): Promise<never> {
    const current = await this.prisma.admissionCase.findFirst({
      where: { id, tenantId },
      select: { status: true, version: true },
    });
    if (!current) {
      throw new NotFoundException({
        code: "ADMISSION_CASE_NOT_FOUND",
        message: "Admission case not found.",
      });
    }
    if (current.version !== expectedVersion) throw this.versionConflict();
    this.assertMutable(current.status);
    throw new ConflictException({
      code: "ADMISSION_INVALID_TRANSITION",
      message: "Admission case could not be updated.",
    });
  }

  private versionConflict(): ConflictException {
    return new ConflictException({
      code: "ADMISSION_VERSION_CONFLICT",
      message: "Admission case was modified by another request.",
    });
  }

  private badRequest(code: string, message: string): BadRequestException {
    return new BadRequestException({ code, message });
  }

  private replaceSection(
    current: AdmissionDraftData,
    section: AdmissionCaseMutableSection,
    raw: Record<string, unknown>,
  ): AdmissionDraftData {
    switch (section) {
      case "STUDENT":
        return {
          ...current,
          STUDENT: this.validateDto(AdmissionStudentSectionDto, raw),
        };
      case "GUARDIANS":
        return {
          ...current,
          GUARDIANS: this.validateDto(AdmissionGuardiansSectionDto, raw),
        };
      case "ACADEMICS":
        return {
          ...current,
          ACADEMICS: this.validateDto(AdmissionAcademicsSectionDto, raw),
        };
      case "FINANCE":
        return {
          ...current,
          FINANCE: this.validateDto(AdmissionFinanceSectionDto, raw),
        };
    }
  }

  private validateDto<T extends object>(
    constructor: DtoConstructor<T>,
    raw: Record<string, unknown>,
    stored = false,
  ): T {
    const value = plainToInstance(constructor, raw);
    const errors = validateSync(value, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      if (stored) {
        throw new InternalServerErrorException({
          code: "ADMISSION_DRAFT_CORRUPTED",
          message: "Stored admission draft is invalid.",
        });
      }
      throw this.badRequest(
        "ADMISSION_SECTION_INVALID",
        "Admission section data is invalid.",
      );
    }
    return value;
  }

  parseStoredDraftData(value: Prisma.JsonValue): AdmissionDraftData {
    if (!value || Array.isArray(value) || typeof value !== "object") {
      throw new InternalServerErrorException({
        code: "ADMISSION_DRAFT_CORRUPTED",
        message: "Stored admission draft is invalid.",
      });
    }
    const raw = value as Record<string, unknown>;
    const allowedKeys = new Set([
      "STUDENT",
      "GUARDIANS",
      "ACADEMICS",
      "FINANCE",
    ]);
    if (Object.keys(raw).some((key) => !allowedKeys.has(key))) {
      throw new InternalServerErrorException({
        code: "ADMISSION_DRAFT_CORRUPTED",
        message: "Stored admission draft contains an unknown section.",
      });
    }

    const result: AdmissionDraftData = {};
    if (raw.STUDENT !== undefined) {
      result.STUDENT = this.validateStoredSection(
        AdmissionStudentSectionDto,
        raw.STUDENT,
      );
    }
    if (raw.GUARDIANS !== undefined) {
      result.GUARDIANS = this.validateStoredSection(
        AdmissionGuardiansSectionDto,
        raw.GUARDIANS,
      );
    }
    if (raw.ACADEMICS !== undefined) {
      result.ACADEMICS = this.validateStoredSection(
        AdmissionAcademicsSectionDto,
        raw.ACADEMICS,
      );
    }
    if (raw.FINANCE !== undefined) {
      result.FINANCE = this.validateStoredSection(
        AdmissionFinanceSectionDto,
        raw.FINANCE,
      );
    }
    return result;
  }

  private validateStoredSection<T extends object>(
    constructor: DtoConstructor<T>,
    value: unknown,
  ): T {
    if (!value || Array.isArray(value) || typeof value !== "object") {
      throw new InternalServerErrorException({
        code: "ADMISSION_DRAFT_CORRUPTED",
        message: "Stored admission section is invalid.",
      });
    }
    return this.validateDto(
      constructor,
      value as Record<string, unknown>,
      true,
    );
  }

  private async validateSectionReferences(
    tenantId: string,
    mode: AdmissionCaseMode,
    section: AdmissionCaseMutableSection,
    draft: AdmissionDraftData,
    prerequisites: AdmissionPrerequisitesResponse,
  ): Promise<void> {
    if (section === "GUARDIANS" && draft.GUARDIANS) {
      await this.validateGuardians(tenantId, draft.GUARDIANS);
    }
    if (section === "ACADEMICS" && draft.ACADEMICS) {
      this.validateAcademics(draft.ACADEMICS, prerequisites);
    }
    if (section === "FINANCE" && draft.FINANCE) {
      this.validateFinance(draft.FINANCE, prerequisites);
    }
    if (
      section === "STUDENT" &&
      mode === AdmissionCaseMode.RE_ENROLLMENT &&
      draft.STUDENT &&
      Object.keys(draft.STUDENT).length > 0
    ) {
      throw this.badRequest(
        "ADMISSION_MODE_INVALID",
        "Re-enrollment reuses the existing student identity.",
      );
    }
  }

  private async validateGuardians(
    tenantId: string,
    section: AdmissionGuardiansDraft,
  ): Promise<void> {
    const guardians = section.guardians ?? [];
    const existingIds: string[] = [];
    for (const guardian of guardians) {
      if (
        guardian.source === "NEW_GUARDIAN" &&
        guardian.parentId !== undefined
      ) {
        throw this.badRequest(
          "ADMISSION_SECTION_INVALID",
          "A new guardian cannot reference an existing parent.",
        );
      }
      if (guardian.source === "EXISTING_GUARDIAN" && guardian.parentId) {
        existingIds.push(guardian.parentId);
      }
    }
    if (new Set(existingIds).size !== existingIds.length) {
      throw this.badRequest(
        "ADMISSION_SECTION_INVALID",
        "A guardian cannot be selected twice.",
      );
    }
    if (existingIds.length === 0) return;

    const count = await this.prisma.parent.count({
      where: {
        id: { in: existingIds },
        tenantId,
        status: "ACTIVE",
        archivedAt: null,
      },
    });
    if (count !== existingIds.length) {
      throw this.badRequest(
        "ADMISSION_SECTION_INVALID",
        "One or more guardians are unavailable.",
      );
    }
  }

  private validateAcademics(
    section: AdmissionAcademicsDraft,
    prerequisites: AdmissionPrerequisitesResponse,
  ): void {
    if (
      section.schoolYearId &&
      section.schoolYearId !== prerequisites.schoolYear?.id
    ) {
      throw this.invalidAcademicSelection();
    }
    const level = section.levelId
      ? prerequisites.levels.find((item) => item.id === section.levelId)
      : undefined;
    if (section.levelId && !level) throw this.invalidAcademicSelection();
    if (section.cycleId && level && section.cycleId !== level.cycleId) {
      throw this.invalidAcademicSelection();
    }
    const classroom = section.classId
      ? prerequisites.classes.find((item) => item.id === section.classId)
      : undefined;
    if (section.classId && !classroom) throw this.invalidAcademicSelection();
    if (
      classroom &&
      ((section.schoolYearId &&
        classroom.schoolYearId !== section.schoolYearId) ||
        (section.levelId && classroom.levelId !== section.levelId) ||
        (section.track && classroom.track !== section.track))
    ) {
      throw this.invalidAcademicSelection();
    }
    if (level && section.track && level.track !== section.track) {
      throw this.invalidAcademicSelection();
    }
  }

  private invalidAcademicSelection(): BadRequestException {
    return this.badRequest(
      "ADMISSION_ACADEMIC_SELECTION_INVALID",
      "Academic selection is not available for this tenant.",
    );
  }

  private validateFinance(
    section: AdmissionFinanceDraft,
    prerequisites: AdmissionPrerequisitesResponse,
  ): void {
    if (
      section.feePlanId &&
      !prerequisites.feePlans.some((item) => item.id === section.feePlanId)
    ) {
      throw this.badRequest(
        "FEE_PLAN_NOT_AVAILABLE",
        "Fee plan is not available for this tenant.",
      );
    }
    if (section.feePlanId && section.disposition !== "IMMEDIATE") {
      throw this.badRequest(
        "ADMISSION_SECTION_INVALID",
        "A fee plan can only be selected for immediate finance.",
      );
    }
  }

  private evaluateReadiness(
    row: AdmissionCaseRow,
    draft: AdmissionDraftData,
    prerequisites: AdmissionPrerequisitesResponse,
  ): {
    ready: boolean;
    completion: AdmissionCaseCompletion;
    blockingIssues: AdmissionCaseIssue[];
    warnings: AdmissionCaseIssue[];
  } {
    const studentComplete =
      row.mode === AdmissionCaseMode.RE_ENROLLMENT
        ? Boolean(
            row.studentId &&
              row.student &&
              !row.student.deletedAt &&
              !row.student.archivedAt &&
              row.student.status !== "ARCHIVED",
          )
        : this.isNewStudentComplete(draft.STUDENT);
    const academicsComplete = this.isAcademicsComplete(
      draft.ACADEMICS,
      prerequisites,
    );
    const blockingIssues: AdmissionCaseIssue[] = [
      ...prerequisites.blockingIssues,
    ];

    if (!prerequisites.permissions.modes[row.mode].allowed) {
      blockingIssues.push({
        code: "ADMISSION_MODE_PERMISSION_DENIED",
        scope: "PERMISSIONS",
      });
    }
    if (!studentComplete) {
      blockingIssues.push({
        code:
          row.mode === AdmissionCaseMode.RE_ENROLLMENT
            ? "ADMISSION_EXISTING_STUDENT_UNAVAILABLE"
            : "ADMISSION_STUDENT_SECTION_INCOMPLETE",
        scope: "STUDENT",
      });
    }
    if (!academicsComplete) {
      blockingIssues.push({
        code: "ADMISSION_ACADEMICS_SECTION_INCOMPLETE",
        scope: "ACADEMIC",
      });
    }

    const completion: AdmissionCaseCompletion = {
      STUDENT: studentComplete,
      GUARDIANS: this.areGuardiansComplete(draft.GUARDIANS),
      ACADEMICS: academicsComplete,
      FINANCE: this.isFinanceComplete(draft.FINANCE, prerequisites),
      DOCUMENTS: false,
    };
    const uniqueBlockingIssues = this.uniqueIssues(blockingIssues);
    return {
      ready: uniqueBlockingIssues.length === 0,
      completion,
      blockingIssues: uniqueBlockingIssues,
      warnings: this.uniqueIssues(prerequisites.warnings),
    };
  }

  private isNewStudentComplete(section?: AdmissionStudentDraft): boolean {
    return Boolean(
      this.hasText(section?.matricule) &&
        this.hasText(section?.firstName) &&
        this.hasText(section?.lastName) &&
        section?.sex,
    );
  }

  private isAcademicsComplete(
    section: AdmissionAcademicsDraft | undefined,
    prerequisites: AdmissionPrerequisitesResponse,
  ): boolean {
    if (
      !section?.schoolYearId ||
      !section.cycleId ||
      !section.levelId ||
      !section.classId ||
      !section.track
    ) {
      return false;
    }
    const level = prerequisites.levels.find(
      (item) => item.id === section.levelId,
    );
    const classroom = prerequisites.classes.find(
      (item) => item.id === section.classId,
    );
    return Boolean(
      prerequisites.schoolYear?.id === section.schoolYearId &&
        level?.cycleId === section.cycleId &&
        level.track === section.track &&
        classroom?.schoolYearId === section.schoolYearId &&
        classroom.levelId === section.levelId &&
        classroom.track === section.track,
    );
  }

  private areGuardiansComplete(section?: AdmissionGuardiansDraft): boolean {
    const guardians = section?.guardians;
    return Boolean(
      guardians?.length &&
        guardians.every((guardian) => this.isGuardianComplete(guardian)),
    );
  }

  private isGuardianComplete(guardian: AdmissionGuardianDraft): boolean {
    if (!guardian.source || !guardian.relationType) return false;
    if (guardian.source === "EXISTING_GUARDIAN") {
      return Boolean(guardian.parentId);
    }
    return Boolean(
      guardian.parentalRole &&
        this.hasText(guardian.firstName) &&
        this.hasText(guardian.lastName) &&
        this.hasText(guardian.primaryPhone),
    );
  }

  private isFinanceComplete(
    section: AdmissionFinanceDraft | undefined,
    prerequisites: AdmissionPrerequisitesResponse,
  ): boolean {
    if (!section?.disposition) return false;
    if (section.disposition !== "IMMEDIATE") return true;
    return Boolean(
      section.feePlanId &&
        prerequisites.feePlans.some((item) => item.id === section.feePlanId),
    );
  }

  private hasText(value?: string): boolean {
    return Boolean(value?.trim());
  }

  private uniqueIssues(issues: AdmissionCaseIssue[]): AdmissionCaseIssue[] {
    return [
      ...new Map(
        issues.map((issue) => [`${issue.scope}:${issue.code}`, issue]),
      ).values(),
    ];
  }

  private toView(
    row: AdmissionCaseRow,
    prerequisites: AdmissionPrerequisitesResponse,
  ): AdmissionCaseView {
    if (row.payloadVersion !== ADMISSION_DRAFT_PAYLOAD_VERSION) {
      throw new InternalServerErrorException({
        code: "ADMISSION_DRAFT_VERSION_UNSUPPORTED",
        message: "Stored admission draft version is unsupported.",
      });
    }
    const draft = this.parseStoredDraftData(row.draftData);
    const readiness = this.evaluateReadiness(row, draft, prerequisites);
    return {
      contractVersion: ADMISSION_CASE_CONTRACT_VERSION,
      payloadVersion: ADMISSION_DRAFT_PAYLOAD_VERSION,
      id: row.id,
      mode: row.mode,
      status: row.status,
      version: row.version,
      studentId: row.studentId,
      schoolYearId: row.schoolYearId,
      sections: { ...draft, DOCUMENTS: null },
      completion: readiness.completion,
      ready:
        row.status !== AdmissionCaseStatus.CANCELLED && readiness.ready,
      blockingIssues: readiness.blockingIssues,
      warnings: readiness.warnings,
      finalizationResult: this.parseFinalizationResult(
        row.finalizationResult,
      ),
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      failedAt: row.failedAt?.toISOString() ?? null,
      failureCode: row.failureCode,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private parseFinalizationResult(
    value: Prisma.JsonValue | null | undefined,
  ): AdmissionCaseView["finalizationResult"] {
    if (value == null) return null;
    if (Array.isArray(value) || typeof value !== "object") {
      throw new InternalServerErrorException({
        code: "ADMISSION_FINALIZATION_RESULT_CORRUPTED",
        message: "Stored admission finalization result is invalid.",
      });
    }
    return value as AdmissionCaseView["finalizationResult"];
  }
}
