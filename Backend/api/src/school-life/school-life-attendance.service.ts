import { randomUUID } from "node:crypto";

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import {
  AcademicPlacementStatus,
  AcademicTrack,
  Prisma,
  type AttendanceAttachment,
  type Classroom,
  type Student
} from "@prisma/client";

import { AcademicStructureService } from "../academic-structure/academic-structure.service";
import { AuditService } from "../audit/audit.service";
import {
  DELETION_ERROR_CODES,
  deletionConflict,
  rethrowDeleteConstraint
} from "../common/deletion-conflict";
import { PrismaService } from "../database/prisma.service";
import { ReferenceService } from "../reference/reference.service";
import {
  FileValidationService,
  type UploadedFile as BufferedUpload
} from "../storage/file-validation.service";
import { type StorageDriver, type StoredObjectReference } from "../storage/storage-provider";
import { StorageService } from "../storage/storage.service";
import {
  BulkAttendanceDto,
  CreateAttendanceDto,
  UpdateAttendanceDto,
  UpdateAttendanceValidationDto
} from "./dto/school-life.dto";
import { SchoolLifeNotificationOrchestratorService } from "./school-life-notification-orchestrator.service";
import {
  type AttendanceAttachmentView,
  type AttendanceJustificationStatus,
  type AttendanceStatus,
  type AttendanceSummaryView,
  type AttendanceView,
  type AttendanceWithRelations,
  attendanceAttachmentView,
  type BulkAttendanceResult
} from "./school-life.types";

@Injectable()
export class SchoolLifeAttendanceService {
  private readonly logger = new Logger(SchoolLifeAttendanceService.name);

  constructor(
    private readonly academicStructureService: AcademicStructureService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
    private readonly referenceService: ReferenceService,
    private readonly notificationOrchestrator: SchoolLifeNotificationOrchestratorService,
    private readonly storageService: StorageService,
    private readonly fileValidationService: FileValidationService
  ) {}

  async getAttendanceSummary(
    tenantId: string,
    filters: {
      classId?: string;
      placementId?: string;
      fromDate?: string;
      toDate?: string;
    }
  ): Promise<AttendanceSummaryView> {
    const where: Prisma.AttendanceWhereInput = {
      tenantId,
      classId: filters.classId,
      placementId: filters.placementId
    };

    if (filters.fromDate || filters.toDate) {
      where.attendanceDate = {
        gte: filters.fromDate ? new Date(filters.fromDate) : undefined,
        lte: filters.toDate ? new Date(filters.toDate) : undefined
      };
    }

    const rows = await this.prisma.attendance.findMany({
      where,
      select: {
        status: true,
        studentId: true,
        student: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    const byStatus = {
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0
    };

    const absencesByStudent = new Map<string, { studentName: string; absentCount: number }>();

    for (const row of rows) {
      const status = this.normalizeAttendanceStatus(row.status);
      byStatus[status] += 1;

      if (status === "ABSENT") {
        const current = absencesByStudent.get(row.studentId);
        const studentName = `${row.student.firstName} ${row.student.lastName}`.trim();
        if (current) {
          current.absentCount += 1;
        } else {
          absencesByStudent.set(row.studentId, {
            studentName,
            absentCount: 1
          });
        }
      }
    }

    const total = rows.length;
    const absenceRatePercent =
      total === 0 ? 0 : Number((((byStatus.ABSENT + byStatus.LATE) / total) * 100).toFixed(2));

    const topAbsentees = Array.from(absencesByStudent.entries())
      .map(([studentId, value]) => ({
        studentId,
        studentName: value.studentName,
        absentCount: value.absentCount
      }))
      .sort((left, right) => right.absentCount - left.absentCount)
      .slice(0, 5);

    return {
      total,
      byStatus,
      absenceRatePercent,
      topAbsentees
    };
  }

  async listAttendance(
    tenantId: string,
    filters: {
      classId?: string;
      studentId?: string;
      placementId?: string;
      status?: string;
      fromDate?: string;
      toDate?: string;
    }
  ): Promise<AttendanceView[]> {
    const where: Prisma.AttendanceWhereInput = {
      tenantId,
      classId: filters.classId,
      studentId: filters.studentId,
      placementId: filters.placementId,
      status: filters.status
    };

    if (filters.fromDate || filters.toDate) {
      where.attendanceDate = {
        gte: filters.fromDate ? new Date(filters.fromDate) : undefined,
        lte: filters.toDate ? new Date(filters.toDate) : undefined
      };
    }

    const rows = await this.prisma.attendance.findMany({
      where,
      include: {
        student: true,
        classroom: true,
        schoolYear: true,
        attachments: {
          orderBy: [{ createdAt: "desc" }]
        }
      },
      orderBy: [{ attendanceDate: "desc" }, { createdAt: "desc" }]
    });

    return rows.map((row) => this.attendanceView(row));
  }

  async createAttendance(
    tenantId: string,
    payload: CreateAttendanceDto
  ): Promise<AttendanceView> {
    const { classroom, student, placement } =
      await this.resolveAttendancePlacementContext(tenantId, {
        classId: payload.classId,
        studentId: payload.studentId,
        placementId: payload.placementId
      });

    const status = this.normalizeAttendanceStatus(payload.status || "PRESENT");
    const requiresJustification = this.requiresAttendanceJustification(status);

    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        const createdAttendance = await transaction.attendance.create({
          data: {
            tenantId,
            studentId: student.id,
            classId: classroom.id,
            schoolYearId: classroom.schoolYearId,
            placementId: placement.id,
            track: placement.track,
            attendanceDate: new Date(payload.attendanceDate),
            status,
            reason: payload.reason?.trim(),
            justificationStatus: requiresJustification ? "PENDING" : "APPROVED",
            validationComment: null,
            validatedByUserId: null,
            validatedAt: null,
            updatedAt: new Date()
          },
          include: {
            student: true,
            classroom: true,
            schoolYear: true,
            attachments: {
              orderBy: [{ createdAt: "desc" }]
            }
          }
        });

        await this.notificationOrchestrator.enqueueAttendanceAlertRequested(
          transaction,
          createdAttendance
        );
        return createdAttendance;
      });

      return this.attendanceView(created);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Attendance already exists for this placement and date."
        );
      }
      throw error;
    }
  }

  async upsertAttendanceBulk(
    tenantId: string,
    payload: BulkAttendanceDto
  ): Promise<BulkAttendanceResult> {
    const classroom = await this.referenceService.requireClassroom(tenantId, payload.classId);
    const attendanceDate = new Date(payload.attendanceDate);
    const defaultStatus = this.normalizeAttendanceStatus(payload.defaultStatus || "PRESENT");

    let createdCount = 0;
    let updatedCount = 0;
    const errors: Array<{ studentId: string; message: string }> = [];
    const seenStudentIds = new Set<string>();

    for (const entry of payload.entries) {
      if (seenStudentIds.has(entry.studentId)) {
        errors.push({
          studentId: entry.studentId,
          message: "Duplicate student in entries payload."
        });
        continue;
      }
      seenStudentIds.add(entry.studentId);

      try {
        const { student, placement } = await this.resolveAttendancePlacementContext(
          tenantId,
          {
            classId: classroom.id,
            studentId: entry.studentId,
            placementId: entry.placementId
          }
        );

        const status = this.normalizeAttendanceStatus(entry.status || defaultStatus);
        const requiresJustification = this.requiresAttendanceJustification(status);

        const existing = await this.prisma.attendance.findFirst({
          where: {
            tenantId,
            placementId: placement.id,
            attendanceDate
          }
        });

        if (existing) {
          await this.prisma.$transaction(async (transaction) => {
            const updatedAttendance = await transaction.attendance.update({
              where: { id: existing.id },
              data: {
                status,
                reason: entry.reason?.trim(),
                placementId: placement.id,
                track: placement.track,
                justificationStatus: requiresJustification ? "PENDING" : "APPROVED",
                validationComment: null,
                validatedByUserId: null,
                validatedAt: null,
                updatedAt: new Date()
              },
              include: {
                student: true,
                classroom: true,
                schoolYear: true,
                attachments: {
                  orderBy: [{ createdAt: "desc" }]
                }
              }
            });

            await this.notificationOrchestrator.enqueueAttendanceAlertRequested(
              transaction,
              updatedAttendance
            );
          });
          updatedCount += 1;
        } else {
          await this.prisma.$transaction(async (transaction) => {
            const createdAttendance = await transaction.attendance.create({
              data: {
                tenantId,
                studentId: student.id,
                classId: classroom.id,
                schoolYearId: classroom.schoolYearId,
                placementId: placement.id,
                track: placement.track,
                attendanceDate,
                status,
                reason: entry.reason?.trim(),
                justificationStatus: requiresJustification ? "PENDING" : "APPROVED",
                validationComment: null,
                validatedByUserId: null,
                validatedAt: null,
                updatedAt: new Date()
              },
              include: {
                student: true,
                classroom: true,
                schoolYear: true,
                attachments: {
                  orderBy: [{ createdAt: "desc" }]
                }
              }
            });

            await this.notificationOrchestrator.enqueueAttendanceAlertRequested(
              transaction,
              createdAttendance
            );
          });
          createdCount += 1;
        }
      } catch (error: unknown) {
        errors.push({
          studentId: entry.studentId,
          message: this.extractErrorMessage(error)
        });
      }
    }

    return {
      classId: classroom.id,
      attendanceDate: payload.attendanceDate,
      createdCount,
      updatedCount,
      errorCount: errors.length,
      errors
    };
  }

  async updateAttendance(
    tenantId: string,
    id: string,
    payload: UpdateAttendanceDto
  ): Promise<AttendanceView> {
    const existing = await this.requireAttendance(tenantId, id);

    const classId = payload.classId || existing.classId;
    const studentId = payload.studentId || existing.studentId;
    const preserveExistingPlacement = !payload.classId && !payload.studentId;

    const { classroom, placement } = await this.resolveAttendancePlacementContext(
      tenantId,
      {
        classId,
        studentId,
        placementId:
          payload.placementId ||
          (preserveExistingPlacement ? existing.placementId || undefined : undefined)
      }
    );

    const nextStatus = payload.status
      ? this.normalizeAttendanceStatus(payload.status)
      : this.normalizeAttendanceStatus(existing.status);
    const requiresJustification = this.requiresAttendanceJustification(nextStatus);
    const validationReset = payload.status
      ? {
          justificationStatus: requiresJustification ? "PENDING" : "APPROVED",
          validationComment: null,
          validatedByUserId: null,
          validatedAt: null
        }
      : {};

    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        const updatedAttendance = await transaction.attendance.update({
          where: { id: existing.id },
          data: {
            studentId,
            classId: classroom.id,
            schoolYearId: classroom.schoolYearId,
            placementId: placement.id,
            track: placement.track,
            attendanceDate: payload.attendanceDate
              ? new Date(payload.attendanceDate)
              : undefined,
            status: payload.status ? nextStatus : undefined,
            reason: payload.reason,
            ...validationReset,
            updatedAt: new Date()
          },
          include: {
            student: true,
            classroom: true,
            schoolYear: true,
            attachments: {
              orderBy: [{ createdAt: "desc" }]
            }
          }
        });

        await this.notificationOrchestrator.enqueueAttendanceAlertRequested(
          transaction,
          updatedAttendance
        );
        return updatedAttendance;
      });

      return this.attendanceView(updated);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Attendance already exists for this placement and date."
        );
      }
      throw error;
    }
  }

  async deleteAttendance(tenantId: string, id: string): Promise<void> {
    await this.requireAttendance(tenantId, id);
    const attachmentCount = await this.prisma.attendanceAttachment.count({
      where: { tenantId, attendanceId: id }
    });
    if (attachmentCount > 0) {
      throw deletionConflict(
        DELETION_ERROR_CODES.restricted,
        "The attendance record has attachments that must be removed explicitly."
      );
    }
    try {
      await this.prisma.attendance.delete({ where: { id } });
    } catch (error: unknown) {
      rethrowDeleteConstraint(
        error,
        "The attendance record still has attachments that must be removed explicitly."
      );
      throw error;
    }
  }

  async listAttendanceAttachments(
    tenantId: string,
    attendanceId: string
  ): Promise<AttendanceAttachmentView[]> {
    await this.requireAttendance(tenantId, attendanceId);

    const rows = await this.prisma.attendanceAttachment.findMany({
      where: {
        tenantId,
        attendanceId
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return rows.map((row) => attendanceAttachmentView(row));
  }

  async addAttendanceAttachment(
    tenantId: string,
    attendanceId: string,
    file: BufferedUpload,
    uploadedByUserId?: string
  ): Promise<AttendanceAttachmentView> {
    await this.requireAttendance(tenantId, attendanceId);
    const validated = await this.fileValidationService.validate(file, "attendance-attachment");
    const stored = await this.storageService.storeValidatedFile({
      tenantId,
      bucketKind: "documents",
      scope: ["attendance", attendanceId, "attachments"],
      file: validated
    });
    const id = randomUUID();
    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        const row = await transaction.attendanceAttachment.create({
          data: {
            id,
            tenantId,
            attendanceId,
            fileName: stored.originalName,
            fileUrl: `/api/v1/attendance/${attendanceId}/attachments/${id}/content`,
            mimeType: stored.mimeType,
            size: stored.size,
            storageDriver: stored.driver,
            storageBucket: stored.bucket,
            storageKey: stored.key,
            uploadedByUserId: uploadedByUserId || null,
            updatedAt: new Date()
          }
        });
        await this.auditService.enqueueLog(
          {
            tenantId,
            userId: uploadedByUserId,
            action: "ATTENDANCE_ATTACHMENT_CREATED",
            resource: "attendance_attachments",
            resourceId: row.id,
            payload: { attendanceId, mimeType: row.mimeType, size: row.size }
          },
          transaction
        );
        return row;
      });
      return attendanceAttachmentView(created);
    } catch (error) {
      await this.deleteAfterFailedCreate(stored, error);
      throw error;
    }
  }

  async downloadAttendanceAttachment(
    tenantId: string,
    attendanceId: string,
    attachmentId: string
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    await this.requireAttendance(tenantId, attendanceId);
    const attachment = await this.requireAttendanceAttachment(tenantId, attendanceId, attachmentId);
    const file = await this.storageService.readFile(this.storageReference(tenantId, attachment));
    return {
      buffer: file.buffer,
      mimeType: attachment.mimeType || file.mimeType || "application/octet-stream",
      fileName: attachment.fileName
    };
  }

  async deleteAttendanceAttachment(
    tenantId: string,
    attendanceId: string,
    attachmentId: string,
    actorUserId: string
  ): Promise<void> {
    await this.requireAttendance(tenantId, attendanceId);

    const attachment = await this.requireAttendanceAttachment(tenantId, attendanceId, attachmentId);
    const reference = this.storageReference(tenantId, attachment);
    await this.prisma.attendanceAttachment.delete({ where: { id: attachment.id } });
    try {
      await this.storageService.deleteFile(reference);
    } catch (error) {
      await this.restoreAttendanceAttachment(attachment, error);
      throw new ServiceUnavailableException("Le justificatif n'a pas pu être supprimé du stockage.");
    }
    try {
      await this.auditService.enqueueLog({
        tenantId,
        userId: actorUserId,
        action: "ATTENDANCE_ATTACHMENT_DELETED",
        resource: "attendance_attachments",
        resourceId: attachment.id,
        payload: { attendanceId }
      });
    } catch (error) {
      this.logger.error("Attendance attachment deletion audit could not be enqueued.", error);
    }
  }

  async updateAttendanceValidation(
    tenantId: string,
    attendanceId: string,
    payload: UpdateAttendanceValidationDto,
    validatedByUserId?: string
  ): Promise<AttendanceView> {
    const attendance = await this.requireAttendance(tenantId, attendanceId);

    if (!this.requiresAttendanceJustification(attendance.status)) {
      throw new ConflictException(
        "Only ABSENT or LATE attendance records can be validated."
      );
    }

    const status = this.normalizeJustificationStatus(payload.status);
    const now = new Date();

    const updated = await this.prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        justificationStatus: status,
        validationComment: payload.comment?.trim() || null,
        validatedByUserId: status === "PENDING" ? null : validatedByUserId || null,
        validatedAt: status === "PENDING" ? null : now,
        updatedAt: now
      },
      include: {
        student: true,
        classroom: true,
        schoolYear: true,
        attachments: {
          orderBy: [{ createdAt: "desc" }]
        }
      }
    });

    return this.attendanceView(updated);
  }

  async requireStudent(tenantId: string, id: string) {
    const row = await this.prisma.student.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      }
    });

    if (!row) {
      throw new NotFoundException("Student not found.");
    }

    return row;
  }

  async requireAttendance(tenantId: string, id: string) {
    const row = await this.prisma.attendance.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!row) {
      throw new NotFoundException("Attendance record not found.");
    }

    return row;
  }

  private async resolveAttendancePlacementContext(
    tenantId: string,
    context: {
      classId: string;
      studentId: string;
      placementId?: string;
    }
  ): Promise<{
    classroom: Classroom;
    student: Student;
    placement: {
      id: string;
      track: AcademicTrack;
      classId: string | null;
      schoolYearId: string;
      studentId: string;
      placementStatus?: AcademicPlacementStatus;
    };
  }> {
    const classroom = await this.referenceService.requireClassroom(tenantId, context.classId);
    const student = await this.requireStudent(tenantId, context.studentId);
    const placement = context.placementId
      ? await this.prisma.studentTrackPlacement.findFirst({
          where: {
            id: context.placementId,
            tenantId,
            studentId: student.id,
            placementStatus: {
              in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
            }
          },
          select: {
            id: true,
            track: true,
            classId: true,
            schoolYearId: true,
            studentId: true,
            placementStatus: true
          }
        })
      : await this.academicStructureService.requirePlacementForStudentClass(
          tenantId,
          student.id,
          classroom.id,
          classroom.schoolYearId
        );

    if (!placement) {
      throw new ConflictException("Student has no academic placement in this class.");
    }

    if (placement.classId !== classroom.id || placement.schoolYearId !== classroom.schoolYearId) {
      throw new ConflictException("Attendance placement must match the class and school year.");
    }

    return {
      classroom,
      student,
      placement
    };
  }

  private normalizeAttendanceStatus(status: string): AttendanceStatus {
    const normalized = status.trim().toUpperCase();
    if (normalized === "ABSENT") return "ABSENT";
    if (normalized === "LATE") return "LATE";
    if (normalized === "EXCUSED") return "EXCUSED";
    return "PRESENT";
  }

  private async requireAttendanceAttachment(
    tenantId: string,
    attendanceId: string,
    attachmentId: string
  ): Promise<AttendanceAttachment> {
    const attachment = await this.prisma.attendanceAttachment.findFirst({
      where: { id: attachmentId, tenantId, attendanceId }
    });
    if (!attachment) throw new NotFoundException("Attendance attachment not found.");
    return attachment;
  }

  private storageReference(tenantId: string, row: AttendanceAttachment): StoredObjectReference {
    if (
      (row.storageDriver !== "LOCAL" && row.storageDriver !== "SUPABASE") ||
      !row.storageBucket ||
      !row.storageKey
    ) {
      throw new NotFoundException(
        "Le fichier historique n'est pas disponible dans le stockage sécurisé."
      );
    }
    return {
      tenantId,
      driver: row.storageDriver as StorageDriver,
      bucket: row.storageBucket,
      key: row.storageKey
    };
  }

  private async deleteAfterFailedCreate(
    reference: StoredObjectReference,
    originalError: unknown
  ): Promise<void> {
    try {
      await this.storageService.deleteFile(reference);
    } catch (cleanupError) {
      this.logger.error("Attendance attachment cleanup failed after database error.", cleanupError);
      this.logger.error("Original attendance attachment database error.", originalError);
    }
  }

  private async restoreAttendanceAttachment(
    attachment: AttendanceAttachment,
    providerError: unknown
  ): Promise<void> {
    try {
      await this.prisma.attendanceAttachment.create({
        data: {
          id: attachment.id,
          tenantId: attachment.tenantId,
          attendanceId: attachment.attendanceId,
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl,
          mimeType: attachment.mimeType,
          size: attachment.size,
          storageDriver: attachment.storageDriver,
          storageBucket: attachment.storageBucket,
          storageKey: attachment.storageKey,
          uploadedByUserId: attachment.uploadedByUserId,
          createdAt: attachment.createdAt,
          updatedAt: attachment.updatedAt
        }
      });
    } catch (restoreError) {
      this.logger.error("Attendance attachment rollback failed after storage deletion error.", restoreError);
    }
    this.logger.error("Attendance attachment storage deletion failed.", providerError);
  }

  private normalizeJustificationStatus(status: string): AttendanceJustificationStatus {
    const normalized = status.trim().toUpperCase();
    if (normalized === "APPROVED") return "APPROVED";
    if (normalized === "REJECTED") return "REJECTED";
    return "PENDING";
  }

  private requiresAttendanceJustification(status: string): boolean {
    const normalized = this.normalizeAttendanceStatus(status);
    return normalized === "ABSENT" || normalized === "LATE";
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof NotFoundException || error instanceof ConflictException) {
      return error.message;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return "Duplicate attendance row for this placement/date.";
    }

    return "Unexpected error.";
  }

  private attendanceView(row: AttendanceWithRelations): AttendanceView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      studentId: row.studentId,
      classId: row.classId,
      schoolYearId: row.schoolYearId,
      placementId: row.placementId || undefined,
      track: row.track as AcademicTrack,
      attendanceDate: row.attendanceDate.toISOString().slice(0, 10),
      status: row.status,
      reason: row.reason || undefined,
      justificationStatus: this.normalizeJustificationStatus(row.justificationStatus),
      validationComment: row.validationComment || undefined,
      validatedByUserId: row.validatedByUserId || undefined,
      validatedAt: row.validatedAt?.toISOString(),
      attachments: row.attachments.map((attachment) => attendanceAttachmentView(attachment)),
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      classLabel: row.classroom.label,
      schoolYearCode: row.schoolYear.code
    };
  }
}
