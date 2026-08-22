import { createHash, randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  AcademicPlacementStatus,
  AdmissionCaseMode,
  AdmissionCaseStatus,
  Prisma,
} from "@prisma/client";

import { AcademicStructureService } from "../academic-structure/academic-structure.service";
import { AdmissionAcademicPolicyService } from "../academic-structure/admission-academic-policy.service";
import { type CompleteAdmissionAcademicSelection } from "../academic-structure/admission-academic-policy.types";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { OutboxService } from "../outbox/outbox.service";
import { ADMISSION_CONFIRMED } from "../outbox/outbox.types";
import {
  CreateParentDto,
  CreateParentStudentLinkDto,
} from "../parents/dto/parents.dto";
import { ParentsService } from "../parents/parents.service";
import { UserRole } from "../security/roles.enum";
import { CreateStudentDto } from "../students/dto/create-student.dto";
import { StudentsService } from "../students/students.service";
import { AdmissionCasesService } from "./admission-cases.service";
import {
  ADMISSION_FINALIZATION_RESULT_VERSION,
  type AdmissionAcademicsDraft,
  type AdmissionDraftData,
  type AdmissionFinalizationResult,
  type AdmissionGuardianDraft,
} from "./admission-cases.types";
import { AdmissionPrerequisitesService } from "./admission-prerequisites.service";
import { FinalizeAdmissionCaseDto } from "./dto/admission-cases.dto";
import { normalizeMatricule } from "../common/identity-normalization";

const FINALIZATION_LEASE_MS = 2 * 60 * 1000;
const SERIALIZATION_RETRY_LIMIT = 8;

const finalizationCaseSelect = {
  id: true,
  tenantId: true,
  mode: true,
  status: true,
  version: true,
  payloadVersion: true,
  draftData: true,
  studentId: true,
  finalizationIdempotencyKey: true,
  finalizationPayloadHash: true,
  reservedMatricule: true,
  finalizationResult: true,
  finalizationLeaseToken: true,
  finalizationLeaseExpiresAt: true,
} satisfies Prisma.AdmissionCaseSelect;

type FinalizationCaseRow = Prisma.AdmissionCaseGetPayload<{
  select: typeof finalizationCaseSelect;
}>;

type AdmissionActor = { id: string; role: UserRole };

export type AdmissionFinalizationCheckpoint =
  | "AFTER_STUDENT"
  | "AFTER_GUARDIAN"
  | "AFTER_PARENT_STUDENT_LINK"
  | "AFTER_PLACEMENT"
  | "AFTER_ENROLLMENT"
  | "BEFORE_AUDIT_OUTBOX"
  | "BEFORE_COMMIT";

type Reservation = {
  row: FinalizationCaseRow;
  leaseToken: string;
  payloadHash: string;
};

@Injectable()
export class AdmissionFinalizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admissionCasesService: AdmissionCasesService,
    private readonly prerequisitesService: AdmissionPrerequisitesService,
    private readonly studentsService: StudentsService,
    private readonly parentsService: ParentsService,
    private readonly academicPolicy: AdmissionAcademicPolicyService,
    private readonly academicStructureService: AcademicStructureService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
  ) {}

  async finalize(
    tenantId: string,
    actor: AdmissionActor,
    admissionCaseId: string,
    payload: FinalizeAdmissionCaseDto,
  ): Promise<AdmissionFinalizationResult> {
    const idempotencyKey = payload.idempotencyKey.trim();
    if (idempotencyKey.length < 8) {
      throw new BadRequestException({
        code: "ADMISSION_IDEMPOTENCY_KEY_INVALID",
        message: "Idempotency key is invalid.",
      });
    }

    const prerequisites = await this.prerequisitesService.getPrerequisites(
      tenantId,
      actor.role,
    );
    const authorizationCase = await this.prisma.admissionCase.findFirst({
      where: { id: admissionCaseId, tenantId },
      select: { mode: true },
    });
    if (!authorizationCase) throw this.notFound();
    if (!prerequisites.permissions.modes[authorizationCase.mode].allowed) {
      throw new ForbiddenException({
        code: "ADMISSION_PERMISSION_DENIED",
        message: "Admission mode is not permitted.",
      });
    }
    const reservation = await this.reserve(
      tenantId,
      admissionCaseId,
      payload.expectedVersion,
      idempotencyKey,
    );
    if ("result" in reservation) return reservation.result;

    try {
      await this.reserveAutomaticMatricule(tenantId, reservation);
      return await this.executeFinalizationWithRetry(
        tenantId,
        actor,
        reservation,
      );
    } catch (error: unknown) {
      const normalized = this.normalizeError(error);
      await this.markFailed(reservation, normalized.code);
      throw normalized.error;
    }
  }

  private async executeFinalizationWithRetry(
    tenantId: string,
    actor: AdmissionActor,
    reservation: Reservation,
  ): Promise<AdmissionFinalizationResult> {
    for (let attempt = 1; attempt <= SERIALIZATION_RETRY_LIMIT; attempt += 1) {
      try {
        return await this.executeFinalization(tenantId, actor, reservation);
      } catch (error: unknown) {
        if (!this.isSerializationFailure(error)) throw error;
        if (attempt === SERIALIZATION_RETRY_LIMIT) {
          throw new ConflictException({
            code: "ADMISSION_RETRY_REQUIRED",
            message: "Admission finalization must be retried.",
          });
        }
        await this.serializationBackoff(attempt);
      }
    }
    throw new ConflictException({
      code: "ADMISSION_RETRY_REQUIRED",
      message: "Admission finalization must be retried.",
    });
  }

  private async reserve(
    tenantId: string,
    admissionCaseId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<Reservation | { result: AdmissionFinalizationResult }> {
    for (let attempt = 1; attempt <= SERIALIZATION_RETRY_LIMIT; attempt += 1) {
      try {
        return await this.reserveOnce(
          tenantId,
          admissionCaseId,
          expectedVersion,
          idempotencyKey,
        );
      } catch (error: unknown) {
        if (!this.isSerializationFailure(error)) throw error;
        if (attempt === SERIALIZATION_RETRY_LIMIT) {
          throw new ConflictException({
            code: "ADMISSION_RETRY_REQUIRED",
            message: "Admission finalization must be retried.",
          });
        }
        await this.serializationBackoff(attempt);
      }
    }
    throw new ConflictException({
      code: "ADMISSION_RETRY_REQUIRED",
      message: "Admission finalization must be retried.",
    });
  }

  private async reserveOnce(
    tenantId: string,
    admissionCaseId: string,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<Reservation | { result: AdmissionFinalizationResult }> {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const row = await transaction.admissionCase.findFirst({
            where: { id: admissionCaseId, tenantId },
            select: finalizationCaseSelect,
          });
          if (!row) throw this.notFound();

          const payloadHash = this.hashLogicalPayload(row);
          if (row.status === AdmissionCaseStatus.CONFIRMED) {
            this.assertSameIdempotency(row, idempotencyKey, payloadHash);
            return { result: this.parseResult(row.finalizationResult) };
          }
          if (row.status === AdmissionCaseStatus.CANCELLED) {
            throw new ConflictException({
              code: "ADMISSION_INVALID_TRANSITION",
              message: "Cancelled admission cannot be finalized.",
            });
          }
          if (row.status === AdmissionCaseStatus.DRAFT) {
            throw new ConflictException({
              code: "ADMISSION_CASE_NOT_READY",
              message: "Admission case is not ready for finalization.",
            });
          }

          const now = new Date();
          if (row.status === AdmissionCaseStatus.FINALIZING) {
            this.assertSameIdempotency(row, idempotencyKey, payloadHash);
            if (
              row.finalizationLeaseExpiresAt &&
              row.finalizationLeaseExpiresAt > now
            ) {
              throw new ConflictException({
                code: "ADMISSION_FINALIZATION_IN_PROGRESS",
                message: "Admission finalization is already in progress.",
              });
            }
          }
          if (row.status === AdmissionCaseStatus.FAILED) {
            this.assertSameIdempotency(row, idempotencyKey, payloadHash);
          }
          if (row.version !== expectedVersion) throw this.versionConflict();

          const leaseToken = randomUUID();
          const leaseExpiresAt = new Date(
            now.getTime() + FINALIZATION_LEASE_MS,
          );
          const changed = await transaction.admissionCase.updateMany({
            where: {
              id: row.id,
              tenantId,
              version: expectedVersion,
              status: row.status,
              ...(row.status === AdmissionCaseStatus.FINALIZING
                ? { finalizationLeaseExpiresAt: { lte: now } }
                : {}),
            },
            data: {
              status: AdmissionCaseStatus.FINALIZING,
              finalizationIdempotencyKey: idempotencyKey,
              finalizationPayloadHash: payloadHash,
              finalizationStartedAt: now,
              finalizationLeaseToken: leaseToken,
              finalizationLeaseExpiresAt: leaseExpiresAt,
              finalizationResult: Prisma.DbNull,
              failedAt: null,
              failureCode: null,
              failureMessage: null,
              version: { increment: 1 },
              updatedAt: now,
            },
          });
          if (changed.count !== 1) throw this.versionConflict();

          const reserved = await transaction.admissionCase.findFirstOrThrow({
            where: { id: row.id, tenantId, finalizationLeaseToken: leaseToken },
            select: finalizationCaseSelect,
          });
          return { row: reserved, leaseToken, payloadHash };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException({
          code: "ADMISSION_IDEMPOTENCY_CONFLICT",
          message: "Idempotency key is already used by another admission.",
        });
      }
      throw error;
    }
  }

  private async executeFinalization(
    tenantId: string,
    actor: AdmissionActor,
    reservation: Reservation,
  ): Promise<AdmissionFinalizationResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const admissionCase = await transaction.admissionCase.findFirst({
          where: {
            id: reservation.row.id,
            tenantId,
            status: AdmissionCaseStatus.FINALIZING,
            finalizationLeaseToken: reservation.leaseToken,
            finalizationPayloadHash: reservation.payloadHash,
          },
          select: finalizationCaseSelect,
        });
        if (!admissionCase) {
          throw new ConflictException({
            code: "ADMISSION_FINALIZATION_LEASE_LOST",
            message: "Admission finalization lease is no longer owned.",
          });
        }

        const draft = this.admissionCasesService.parseStoredDraftData(
          admissionCase.draftData,
        );
        const academics = this.requireAcademics(draft.ACADEMICS);
        await this.academicPolicy.assertCompleteSelection(
          tenantId,
          academics,
          transaction,
        );

        const student =
          admissionCase.mode === AdmissionCaseMode.NEW_ADMISSION
            ? await this.createStudent(
                tenantId,
                actor,
                draft,
                admissionCase.reservedMatricule,
                transaction,
              )
            : await this.requireExistingStudent(
                tenantId,
                admissionCase.studentId,
                draft,
                transaction,
              );
        const studentId = student.id;
        this.checkpoint("AFTER_STUDENT");

        const guardianIds: string[] = [];
        const parentStudentLinkIds: string[] = [];
        const guardians = this.resolveGuardiansForMode(
          admissionCase.mode,
          draft,
        );
        for (const guardian of guardians) {
          const parent = await this.resolveGuardian(
            tenantId,
            guardian,
            transaction,
          );
          guardianIds.push(parent.id);
          this.checkpoint("AFTER_GUARDIAN");
          const link = await this.parentsService.createLinkForAdmission(
            tenantId,
            this.toLinkPayload(parent.id, studentId, guardian),
            transaction,
          );
          parentStudentLinkIds.push(link.id);
          this.checkpoint("AFTER_PARENT_STUDENT_LINK");
        }

        const placement =
          await this.academicStructureService.createTrackPlacementForAdmission(
            tenantId,
            {
              studentId,
              schoolYearId: academics.schoolYearId,
              cycleId: academics.cycleId,
              levelId: academics.levelId,
              classId: academics.classId,
              track: academics.track,
              placementStatus: AcademicPlacementStatus.ACTIVE,
              startDate:
                draft.STUDENT?.admissionDate ??
                (
                  await transaction.schoolYear.findUniqueOrThrow({
                    where: { id: academics.schoolYearId },
                    select: { startDate: true },
                  })
                ).startDate
                  .toISOString()
                  .slice(0, 10),
            },
            transaction,
            {
              afterPlacement: () => this.checkpoint("AFTER_PLACEMENT"),
              afterEnrollment: () => this.checkpoint("AFTER_ENROLLMENT"),
            },
          );

        this.checkpoint("BEFORE_AUDIT_OUTBOX");
        const confirmedAt = new Date();
        const result: AdmissionFinalizationResult = {
          contractVersion: ADMISSION_FINALIZATION_RESULT_VERSION,
          admissionCaseId: admissionCase.id,
          status: "CONFIRMED",
          studentId,
          studentMatricule: student.matricule,
          placementId: placement.placementId,
          enrollmentId: placement.enrollmentId,
          guardianIds,
          parentStudentLinkIds,
          invoiceIds: [],
          confirmedAt: confirmedAt.toISOString(),
          version: admissionCase.version + 1,
        };

        await this.auditService.recordLog(
          {
            tenantId,
            userId: actor.id,
            action: "ADMISSION_CONFIRMED",
            resource: "admission_cases",
            resourceId: admissionCase.id,
            payload: {
              studentId,
              placementId: placement.placementId,
              enrollmentId: placement.enrollmentId,
              guardianIds,
              parentStudentLinkIds,
            },
          },
          transaction,
        );
        await this.outboxService.publish(
          {
            tenantId,
            aggregateType: "AdmissionCase",
            aggregateId: admissionCase.id,
            eventType: ADMISSION_CONFIRMED,
            dedupeKey: `admission-confirmed:${admissionCase.id}`,
            payload: {
              admissionCaseId: admissionCase.id,
              studentId,
              placementId: placement.placementId,
              enrollmentId: placement.enrollmentId,
            },
          },
          transaction,
        );

        const changed = await transaction.admissionCase.updateMany({
          where: {
            id: admissionCase.id,
            tenantId,
            status: AdmissionCaseStatus.FINALIZING,
            finalizationLeaseToken: reservation.leaseToken,
            version: admissionCase.version,
          },
          data: {
            status: AdmissionCaseStatus.CONFIRMED,
            finalizationResult: result as unknown as Prisma.InputJsonObject,
            confirmedAt,
            failedAt: null,
            failureCode: null,
            failureMessage: null,
            finalizationLeaseToken: null,
            finalizationLeaseExpiresAt: null,
            version: { increment: 1 },
            updatedByUserId: actor.id,
            updatedAt: confirmedAt,
          },
        });
        if (changed.count !== 1) {
          throw new ConflictException({
            code: "ADMISSION_FINALIZATION_LEASE_LOST",
            message: "Admission finalization lease is no longer owned.",
          });
        }
        this.checkpoint("BEFORE_COMMIT");
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async createStudent(
    tenantId: string,
    actor: AdmissionActor,
    draft: AdmissionDraftData,
    reservedMatricule: string | null,
    transaction: Prisma.TransactionClient,
  ): Promise<{ id: string; matricule: string }> {
    const student = draft.STUDENT;
    if (
      !student ||
      !student.firstName?.trim() ||
      !student.lastName?.trim() ||
      !student.sex ||
      !student.birthDate
    ) {
      throw new ConflictException({
        code: "ADMISSION_CASE_NOT_READY",
        message: "Student section is incomplete.",
      });
    }
    const matriculeMode =
      student.matriculeMode ?? (student.matricule?.trim() ? "MANUAL" : "AUTO");
    if (matriculeMode === "MANUAL" && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: "MATRICULE_OVERRIDE_FORBIDDEN",
        message: "Manual matricule override is restricted to administrators.",
      });
    }
    const matricule =
      matriculeMode === "AUTO"
        ? normalizeMatricule(reservedMatricule ?? undefined)
        : normalizeMatricule(student.matricule);
    if (!matricule) {
      if (matriculeMode === "AUTO") {
        throw new InternalServerErrorException({
          code: "ADMISSION_MATRICULE_RESERVATION_MISSING",
          message: "Admission matricule reservation is unavailable.",
        });
      }
      throw new BadRequestException({
        code: "ADMISSION_SECTION_INVALID",
        message: "Manual matricule is required.",
      });
    }
    const payload: CreateStudentDto = {
      matricule,
      firstName: student.firstName,
      lastName: student.lastName,
      sex: student.sex,
      birthDate: student.birthDate,
      birthPlace: student.birthPlace,
      nationality: student.nationality,
      address: student.address,
      phone: student.phone,
      email: student.email,
      admissionDate: student.admissionDate,
      administrativeNotes: student.administrativeNotes,
      internalId: student.internalId,
      birthCertificateNo: student.birthCertificateNo,
      specialNeeds: student.specialNeeds,
      primaryLanguage: student.primaryLanguage,
      status: "ACTIVE",
    };
    const created = await this.studentsService.createForAdmission(
      tenantId,
      payload,
      transaction,
    );
    return { id: created.id, matricule };
  }

  private async requireExistingStudent(
    tenantId: string,
    studentId: string | null,
    draft: AdmissionDraftData,
    transaction: Prisma.TransactionClient,
  ): Promise<{ id: string; matricule: string }> {
    if (!studentId) {
      throw new ConflictException({
        code: "ADMISSION_EXISTING_STUDENT_UNAVAILABLE",
        message: "Existing student is unavailable.",
      });
    }
    if (draft.STUDENT && Object.keys(draft.STUDENT).length > 0) {
      throw new BadRequestException({
        code: "ADMISSION_MODE_INVALID",
        message: "Re-enrollment cannot modify the existing student identity.",
      });
    }
    const student = await transaction.student.findFirst({
      where: {
        id: studentId,
        tenantId,
        deletedAt: null,
        archivedAt: null,
        status: { not: "ARCHIVED" },
      },
      select: { id: true, matricule: true },
    });
    if (!student) {
      throw new ConflictException({
        code: "ADMISSION_EXISTING_STUDENT_UNAVAILABLE",
        message: "Existing student is unavailable.",
      });
    }
    return student;
  }

  private resolveGuardiansForMode(
    mode: AdmissionCaseMode,
    draft: AdmissionDraftData,
  ): AdmissionGuardianDraft[] {
    const guardians = draft.GUARDIANS?.guardians ?? [];
    if (mode === AdmissionCaseMode.RE_ENROLLMENT) {
      if (guardians.length > 0) {
        throw new BadRequestException({
          code: "ADMISSION_MODE_INVALID",
          message: "Re-enrollment reuses existing guardian relations.",
        });
      }
      return [];
    }
    if (guardians.length === 0) {
      throw new BadRequestException({
        code: "GUARDIAN_REQUIRED",
        message: "At least one guardian is required for a new admission.",
      });
    }
    if (
      guardians.filter((guardian) => guardian.isPrimaryContact).length !== 1
    ) {
      throw new ConflictException({
        code: "PRIMARY_GUARDIAN_CONFLICT",
        message: "Exactly one primary guardian is required.",
      });
    }
    return guardians;
  }

  private async resolveGuardian(
    tenantId: string,
    guardian: AdmissionGuardianDraft,
    transaction: Prisma.TransactionClient,
  ): Promise<{ id: string; userId: string | null }> {
    if (guardian.source === "EXISTING_GUARDIAN" && guardian.parentId) {
      return this.parentsService.requireParentForAdmission(
        tenantId,
        guardian.parentId,
        transaction,
      );
    }
    if (
      guardian.source !== "NEW_GUARDIAN" ||
      !guardian.parentalRole ||
      !guardian.firstName?.trim() ||
      !guardian.lastName?.trim() ||
      !guardian.primaryPhone?.trim()
    ) {
      throw new BadRequestException({
        code: "ADMISSION_SECTION_INVALID",
        message: "Guardian section is incomplete.",
      });
    }
    const payload: CreateParentDto = {
      parentalRole: guardian.parentalRole,
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      sex: guardian.sex,
      primaryPhone: guardian.primaryPhone,
      secondaryPhone: guardian.secondaryPhone,
      email: guardian.email,
      address: guardian.address,
      profession: guardian.profession,
      identityDocumentType: guardian.identityDocumentType,
      identityDocumentNumber: guardian.identityDocumentNumber,
      notes: guardian.comment,
      status: "ACTIVE",
    };
    return this.parentsService.createParentForAdmission(
      tenantId,
      payload,
      transaction,
    );
  }

  private toLinkPayload(
    parentId: string,
    studentId: string,
    guardian: AdmissionGuardianDraft,
  ): CreateParentStudentLinkDto {
    const relationType = guardian.relationType ?? guardian.parentalRole;
    if (!relationType) {
      throw new BadRequestException({
        code: "ADMISSION_SECTION_INVALID",
        message: "Guardian relation type is required.",
      });
    }
    return {
      parentId,
      studentId,
      relationType,
      isPrimaryContact: guardian.isPrimaryContact,
      livesWithStudent: guardian.livesWithStudent,
      pickupAuthorized: guardian.pickupAuthorized,
      legalGuardian: guardian.legalGuardian,
      financialResponsible: guardian.financialResponsible,
      emergencyContact: guardian.emergencyContact,
      status: "ACTIVE",
      comment: guardian.comment,
    };
  }

  private requireAcademics(
    academics?: AdmissionAcademicsDraft,
  ): CompleteAdmissionAcademicSelection {
    if (
      !academics?.schoolYearId ||
      !academics.cycleId ||
      !academics.levelId ||
      !academics.classId ||
      !academics.track
    ) {
      throw new ConflictException({
        code: "ADMISSION_CASE_NOT_READY",
        message: "Academic section is incomplete.",
      });
    }
    return academics as CompleteAdmissionAcademicSelection;
  }

  private async markFailed(
    reservation: Reservation,
    failureCode: string,
  ): Promise<void> {
    await this.prisma.admissionCase.updateMany({
      where: {
        id: reservation.row.id,
        tenantId: reservation.row.tenantId,
        status: AdmissionCaseStatus.FINALIZING,
        finalizationLeaseToken: reservation.leaseToken,
      },
      data: {
        status: AdmissionCaseStatus.FAILED,
        failedAt: new Date(),
        failureCode: failureCode.slice(0, 80),
        failureMessage: "Admission finalization failed without partial writes.",
        finalizationLeaseToken: null,
        finalizationLeaseExpiresAt: null,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  private async reserveAutomaticMatricule(
    tenantId: string,
    reservation: Reservation,
  ): Promise<void> {
    if (reservation.row.mode !== AdmissionCaseMode.NEW_ADMISSION) return;
    const draft = this.admissionCasesService.parseStoredDraftData(
      reservation.row.draftData,
    );
    const student = draft.STUDENT;
    const matriculeMode =
      student?.matriculeMode ??
      (student?.matricule?.trim() ? "MANUAL" : "AUTO");
    if (matriculeMode !== "AUTO") return;
    const academics = this.requireAcademics(draft.ACADEMICS);

    await this.prisma.$transaction(
      async (transaction) => {
        const current = await transaction.admissionCase.findFirst({
          where: {
            id: reservation.row.id,
            tenantId,
            status: AdmissionCaseStatus.FINALIZING,
            finalizationLeaseToken: reservation.leaseToken,
            finalizationPayloadHash: reservation.payloadHash,
          },
          select: { reservedMatricule: true },
        });
        if (!current) {
          throw new ConflictException({
            code: "ADMISSION_FINALIZATION_LEASE_LOST",
            message: "Admission finalization lease is no longer owned.",
          });
        }
        if (current.reservedMatricule) return;

        const matricule = await this.studentsService.allocateAdmissionMatricule(
          tenantId,
          academics.schoolYearId,
          transaction,
        );
        const changed = await transaction.admissionCase.updateMany({
          where: {
            id: reservation.row.id,
            tenantId,
            status: AdmissionCaseStatus.FINALIZING,
            finalizationLeaseToken: reservation.leaseToken,
            reservedMatricule: null,
          },
          data: { reservedMatricule: matricule, updatedAt: new Date() },
        });
        if (changed.count !== 1) {
          throw new ConflictException({
            code: "ADMISSION_FINALIZATION_LEASE_LOST",
            message: "Admission finalization lease is no longer owned.",
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  private assertSameIdempotency(
    row: FinalizationCaseRow,
    idempotencyKey: string,
    payloadHash: string,
  ): void {
    if (
      row.finalizationIdempotencyKey !== idempotencyKey ||
      row.finalizationPayloadHash !== payloadHash
    ) {
      throw new ConflictException({
        code: "ADMISSION_IDEMPOTENCY_CONFLICT",
        message: "Idempotency key conflicts with another finalization payload.",
      });
    }
  }

  private hashLogicalPayload(row: FinalizationCaseRow): string {
    return createHash("sha256")
      .update(
        this.canonicalJson({
          mode: row.mode,
          payloadVersion: row.payloadVersion,
          studentId: row.studentId,
          draftData: row.draftData,
        }),
      )
      .digest("hex");
  }

  private canonicalJson(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.canonicalJson(item)).join(",")}]`;
    }
    if (value && typeof value === "object") {
      const object = value as Record<string, unknown>;
      return `{${Object.keys(object)
        .sort()
        .map(
          (key) => `${JSON.stringify(key)}:${this.canonicalJson(object[key])}`,
        )
        .join(",")}}`;
    }
    return JSON.stringify(value) ?? "null";
  }

  private parseResult(
    value: Prisma.JsonValue | null,
  ): AdmissionFinalizationResult {
    if (!value || Array.isArray(value) || typeof value !== "object") {
      throw new InternalServerErrorException({
        code: "ADMISSION_FINALIZATION_RESULT_CORRUPTED",
        message: "Stored finalization result is invalid.",
      });
    }
    const result = value as Record<string, unknown>;
    if (
      result.contractVersion !== ADMISSION_FINALIZATION_RESULT_VERSION ||
      result.status !== "CONFIRMED" ||
      typeof result.admissionCaseId !== "string" ||
      typeof result.studentId !== "string" ||
      typeof result.placementId !== "string" ||
      typeof result.enrollmentId !== "string"
    ) {
      throw new InternalServerErrorException({
        code: "ADMISSION_FINALIZATION_RESULT_CORRUPTED",
        message: "Stored finalization result is invalid.",
      });
    }
    return value as unknown as AdmissionFinalizationResult;
  }

  private normalizeError(error: unknown): {
    code: string;
    error: HttpException;
  } {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      const code =
        typeof response === "object" &&
        response !== null &&
        "code" in response &&
        typeof response.code === "string"
          ? response.code
          : "ADMISSION_FINALIZATION_FAILED";
      return { code, error };
    }
    return {
      code: "ADMISSION_FINALIZATION_FAILED",
      error: new InternalServerErrorException({
        code: "ADMISSION_FINALIZATION_FAILED",
        message: "Admission finalization failed.",
      }),
    };
  }

  private isSerializationFailure(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    );
  }

  private async serializationBackoff(attempt: number): Promise<void> {
    const delayMs =
      Math.min(100, attempt * 10) + Math.floor(Math.random() * 10);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: "ADMISSION_CASE_NOT_FOUND",
      message: "Admission case not found.",
    });
  }

  private versionConflict(): ConflictException {
    return new ConflictException({
      code: "ADMISSION_VERSION_CONFLICT",
      message: "Admission case was modified by another request.",
    });
  }

  private checkpoint(_point: AdmissionFinalizationCheckpoint): void {}
}
