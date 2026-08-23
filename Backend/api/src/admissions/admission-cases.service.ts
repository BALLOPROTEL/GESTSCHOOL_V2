import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { AdmissionCaseMode, AdmissionCaseStatus, Prisma } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { AuditService } from "../audit/audit.service";
import { AdmissionAcademicPolicyService } from "../academic-structure/admission-academic-policy.service";
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
import { AdmissionFinancePolicyService } from "./admission-finance-policy.service";
import { type AdmissionFinanceOptionsResponse } from "./admission-finance-policy.types";
import {
  AdmissionAcademicsSectionDto,
  AdmissionCaseListQueryDto,
  AdmissionFinanceSectionDto,
  AdmissionGuardiansSectionDto,
  LegacyAdmissionFinanceSectionDto,
  AdmissionStudentSectionDto,
  CancelAdmissionCaseDto,
  CreateAdmissionCaseDto,
  ReopenAdmissionCaseDto,
  UpdateAdmissionCaseSectionDto,
} from "./dto/admission-cases.dto";

const EDITABLE_ADMISSION_FAILURE_CODES = new Set([
  "ADMISSION_CASE_NOT_READY",
  "ACADEMIC_CONTEXT_INVALID",
  "SCHOOL_YEAR_NOT_AVAILABLE",
  "TRACK_NOT_AVAILABLE",
  "LEVEL_NOT_AVAILABLE",
  "CLASS_NOT_AVAILABLE",
  "PLACEMENT_CONFLICT",
  "STUDENT_DUPLICATE_SUSPECTED",
  "MATRICULE_CONFLICT",
  "GUARDIAN_DUPLICATE_SUSPECTED",
  "GUARDIAN_REQUIRED",
  "PRIMARY_GUARDIAN_CONFLICT",
  "FINANCE_ACADEMIC_CONTEXT_REQUIRED",
  "FEE_PLAN_NOT_AVAILABLE",
  "FEE_PLAN_NOT_COMPATIBLE",
]);

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
    private readonly academicPolicy: AdmissionAcademicPolicyService,
    private readonly financePolicy: AdmissionFinancePolicyService,
    private readonly auditService: AuditService,
  ) {}

  async getFinanceOptions(
    tenantId: string,
    role: UserRole,
    id: string,
  ): Promise<AdmissionFinanceOptionsResponse> {
    const [row, prerequisites] = await Promise.all([
      this.requireCase(tenantId, id),
      this.prerequisitesService.getPrerequisites(tenantId, role),
    ]);
    const draft = this.parseStoredDraftData(row.draftData);
    return this.financePolicy.getOptions({
      tenantId,
      admissionCaseId: row.id,
      academics: draft.ACADEMICS,
      finance: draft.FINANCE,
      capabilities: {
        canReadFeePlans: prerequisites.permissions.canReadFeePlans,
        canSelectFeePlan: prerequisites.permissions.canReadFeePlans,
        canDefer: prerequisites.permissions.modes[row.mode].allowed,
        canCreateInvoice: prerequisites.permissions.canCreateInvoice,
        automaticInvoiceCreation: false,
      },
    });
  }

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
      actor.role,
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

  async reopenFailed(
    tenantId: string,
    actor: AdmissionActor,
    id: string,
    payload: ReopenAdmissionCaseDto,
  ): Promise<AdmissionCaseView> {
    const [current, prerequisites] = await Promise.all([
      this.requireCase(tenantId, id),
      this.prerequisitesService.getPrerequisites(tenantId, actor.role),
    ]);
    if (current.status !== AdmissionCaseStatus.FAILED) {
      throw new ConflictException({
        code: "ADMISSION_INVALID_TRANSITION",
        message: "Only a failed admission case can be reopened.",
      });
    }
    if (current.version !== payload.expectedVersion) {
      throw this.versionConflict();
    }
    if (
      !current.failureCode ||
      !EDITABLE_ADMISSION_FAILURE_CODES.has(current.failureCode)
    ) {
      throw new ConflictException({
        code: "ADMISSION_RETRY_REQUIRED",
        message:
          "This admission must be retried with the existing idempotency key.",
      });
    }

    const draft = this.parseStoredDraftData(current.draftData);
    const readiness = this.evaluateReadiness(current, draft, prerequisites);
    const nextStatus = readiness.ready
      ? AdmissionCaseStatus.READY
      : AdmissionCaseStatus.DRAFT;
    const reopenedAt = new Date();
    const changed = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.admissionCase.updateMany({
        where: {
          id,
          tenantId,
          status: AdmissionCaseStatus.FAILED,
          version: payload.expectedVersion,
        },
        data: {
          status: nextStatus,
          finalizationIdempotencyKey: null,
          finalizationPayloadHash: null,
          reservedMatricule: null,
          finalizationResult: Prisma.DbNull,
          finalizationStartedAt: null,
          finalizationLeaseToken: null,
          finalizationLeaseExpiresAt: null,
          failedAt: null,
          failureCode: null,
          failureMessage: null,
          version: { increment: 1 },
          updatedByUserId: actor.id,
          updatedAt: reopenedAt,
        },
      });
      if (result.count !== 1) return false;
      await this.auditService.recordLog(
        {
          tenantId,
          userId: actor.id,
          action: "ADMISSION_CASE_REOPENED",
          resource: "admission_cases",
          resourceId: id,
          payload: { previousFailureCode: current.failureCode, nextStatus },
        },
        transaction,
      );
      return true;
    });
    if (!changed) throw this.versionConflict();
    return this.toView(await this.requireCase(tenantId, id), prerequisites);
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
          STUDENT: this.normalizeStudentDraft(
            this.validateDto(AdmissionStudentSectionDto, raw),
          ),
        };
      case "GUARDIANS":
        return {
          ...current,
          GUARDIANS: this.normalizeGuardiansDraft(
            this.validateDto(AdmissionGuardiansSectionDto, raw),
          ),
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
      result.FINANCE = this.parseStoredFinance(raw.FINANCE);
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

  private parseStoredFinance(value: unknown): AdmissionFinanceDraft {
    if (!value || Array.isArray(value) || typeof value !== "object") {
      throw new InternalServerErrorException({
        code: "ADMISSION_DRAFT_CORRUPTED",
        message: "Stored admission finance section is invalid.",
      });
    }
    const raw = value as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(raw, "mode")) {
      return this.validateDto(AdmissionFinanceSectionDto, raw, true);
    }

    const legacy = this.validateDto(
      LegacyAdmissionFinanceSectionDto,
      raw,
      true,
    );
    if (!legacy.disposition) return {};
    if (legacy.disposition === "IMMEDIATE") {
      return {
        mode: "FEE_PLAN",
        feePlanId: legacy.feePlanId,
        note: legacy.note,
      };
    }
    return { mode: "DEFERRED", note: legacy.note };
  }

  private async validateSectionReferences(
    tenantId: string,
    mode: AdmissionCaseMode,
    section: AdmissionCaseMutableSection,
    draft: AdmissionDraftData,
    prerequisites: AdmissionPrerequisitesResponse,
    actorRole: UserRole,
  ): Promise<void> {
    if (section === "GUARDIANS" && draft.GUARDIANS) {
      if (
        mode === AdmissionCaseMode.RE_ENROLLMENT &&
        (draft.GUARDIANS.guardians?.length ?? 0) > 0
      ) {
        throw this.badRequest(
          "ADMISSION_MODE_INVALID",
          "Re-enrollment reuses existing guardian relations.",
        );
      }
      await this.validateGuardians(tenantId, draft.GUARDIANS);
    }
    if (section === "ACADEMICS" && draft.ACADEMICS) {
      await this.academicPolicy.assertDraftSelection(tenantId, draft.ACADEMICS);
    }
    if (
      section === "FINANCE" &&
      draft.FINANCE?.mode === "FEE_PLAN" &&
      !prerequisites.permissions.canReadFeePlans
    ) {
      throw new ForbiddenException({
        code: "FINANCE_PERMISSION_DENIED",
        message: "Fee plan selection is not permitted for this account.",
      });
    }
    if ((section === "FINANCE" || section === "ACADEMICS") && draft.FINANCE) {
      await this.financePolicy.assertDraftIntent(
        tenantId,
        draft.FINANCE,
        draft.ACADEMICS,
      );
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
    if (section === "STUDENT" && mode === AdmissionCaseMode.NEW_ADMISSION) {
      const student = draft.STUDENT;
      const matriculeMode = this.resolveMatriculeMode(student);
      if (matriculeMode === "AUTO" && this.hasText(student?.matricule)) {
        throw this.badRequest(
          "ADMISSION_SECTION_INVALID",
          "Automatic matricule mode cannot include a manual matricule.",
        );
      }
      if (matriculeMode === "MANUAL") {
        if (!this.hasText(student?.matricule)) {
          throw this.badRequest(
            "ADMISSION_SECTION_INVALID",
            "Manual matricule mode requires a matricule.",
          );
        }
        if (actorRole !== UserRole.ADMIN) {
          throw new ForbiddenException({
            code: "MATRICULE_OVERRIDE_FORBIDDEN",
            message:
              "Manual matricule override is restricted to administrators.",
          });
        }
      }
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
    const guardiansComplete =
      row.mode === AdmissionCaseMode.RE_ENROLLMENT
        ? true
        : this.areGuardiansComplete(draft.GUARDIANS);
    if (row.mode === AdmissionCaseMode.NEW_ADMISSION && !guardiansComplete) {
      const guardians = draft.GUARDIANS?.guardians ?? [];
      blockingIssues.push({
        code:
          guardians.length === 0
            ? "GUARDIAN_REQUIRED"
            : guardians.filter((guardian) => guardian.isPrimaryContact).length >
                1
              ? "PRIMARY_GUARDIAN_CONFLICT"
              : "PRIMARY_GUARDIAN_REQUIRED",
        scope: "GUARDIANS",
      });
    }
    if (!academicsComplete) {
      blockingIssues.push({
        code: "ADMISSION_ACADEMICS_SECTION_INCOMPLETE",
        scope: "ACADEMIC",
      });
    }

    const financeReadiness = this.financePolicy.evaluateReadiness(
      draft.FINANCE,
      draft.ACADEMICS,
      prerequisites.feePlans,
    );
    if (financeReadiness.blockingIssue) {
      blockingIssues.push(financeReadiness.blockingIssue);
    }

    const completion: AdmissionCaseCompletion = {
      STUDENT: studentComplete,
      GUARDIANS: guardiansComplete,
      ACADEMICS: academicsComplete,
      FINANCE: financeReadiness.complete,
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
    const matriculeMode = this.resolveMatriculeMode(section);
    return Boolean(
      (matriculeMode === "AUTO" || this.hasText(section?.matricule)) &&
      this.hasText(section?.firstName) &&
      this.hasText(section?.lastName) &&
      section?.sex &&
      section.birthDate,
    );
  }

  private isAcademicsComplete(
    section: AdmissionAcademicsDraft | undefined,
    prerequisites: AdmissionPrerequisitesResponse,
  ): boolean {
    return this.academicPolicy.isCompleteSelectionAvailable(section, {
      schoolYear: prerequisites.schoolYear,
      levels: prerequisites.levels,
      classes: prerequisites.classes,
    });
  }

  private areGuardiansComplete(section?: AdmissionGuardiansDraft): boolean {
    const guardians = section?.guardians;
    return Boolean(
      guardians?.length &&
      guardians.every((guardian) => this.isGuardianComplete(guardian)) &&
      guardians.filter((guardian) => guardian.isPrimaryContact).length === 1,
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

  private hasText(value?: string): boolean {
    return Boolean(value?.trim());
  }

  private resolveMatriculeMode(
    section?: AdmissionStudentDraft,
  ): "AUTO" | "MANUAL" {
    return (
      section?.matriculeMode ??
      (this.hasText(section?.matricule) ? "MANUAL" : "AUTO")
    );
  }

  private normalizeStudentDraft(
    section: AdmissionStudentDraft,
  ): AdmissionStudentDraft {
    const mode = this.resolveMatriculeMode(section);
    return {
      ...section,
      matriculeMode: mode,
      matricule:
        mode === "MANUAL" && section.matricule
          ? section.matricule.trim().toUpperCase()
          : undefined,
    };
  }

  private normalizeGuardiansDraft(
    section: AdmissionGuardiansDraft,
  ): AdmissionGuardiansDraft {
    const guardians = section.guardians ?? [];
    if (guardians.length !== 1 || guardians[0].isPrimaryContact !== undefined) {
      return section;
    }
    return {
      guardians: [{ ...guardians[0], isPrimaryContact: true }],
    };
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
      ready: row.status !== AdmissionCaseStatus.CANCELLED && readiness.ready,
      blockingIssues: readiness.blockingIssues,
      warnings: readiness.warnings,
      finalizationResult: this.parseFinalizationResult(row.finalizationResult),
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      failedAt: row.failedAt?.toISOString() ?? null,
      failureCode: row.failureCode,
      recoveryAction: this.recoveryAction(row),
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private recoveryAction(
    row: Pick<AdmissionCaseRow, "status" | "failureCode">,
  ): AdmissionCaseView["recoveryAction"] {
    if (row.status !== AdmissionCaseStatus.FAILED || !row.failureCode)
      return null;
    return EDITABLE_ADMISSION_FAILURE_CODES.has(row.failureCode)
      ? "EDIT_AND_REVALIDATE"
      : "RETRY";
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
