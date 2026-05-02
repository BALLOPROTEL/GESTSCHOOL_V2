import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AcademicPlacementStatus,
  AcademicTrack,
  Prisma,
  type Classroom,
  type Student
} from "@prisma/client";

import { AcademicStructureService } from "../academic-structure/academic-structure.service";
import { PrismaService } from "../database/prisma.service";
import { ReferenceService } from "../reference/reference.service";
import {
  BulkAttendanceDto,
  CreateAttendanceAttachmentDto,
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
  constructor(
    private readonly academicStructureService: AcademicStructureService,
    private readonly prisma: PrismaService,
    private readonly referenceService: ReferenceService,
    private readonly notificationOrchestrator: SchoolLifeNotificationOrchestratorService
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
    await this.prisma.attendance.delete({ where: { id } });
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
    payload: CreateAttendanceAttachmentDto,
    uploadedByUserId?: string
  ): Promise<AttendanceAttachmentView> {
    await this.requireAttendance(tenantId, attendanceId);

    const created = await this.prisma.attendanceAttachment.create({
      data: {
        tenantId,
        attendanceId,
        fileName: payload.fileName.trim(),
        fileUrl: payload.fileUrl.trim(),
        mimeType: payload.mimeType?.trim(),
        uploadedByUserId: uploadedByUserId || null,
        updatedAt: new Date()
      }
    });

    return attendanceAttachmentView(created);
  }

  async deleteAttendanceAttachment(
    tenantId: string,
    attendanceId: string,
    attachmentId: string
  ): Promise<void> {
    await this.requireAttendance(tenantId, attendanceId);

    const attachment = await this.prisma.attendanceAttachment.findFirst({
      where: {
        id: attachmentId,
        tenantId,
        attendanceId
      }
    });

    if (!attachment) {
      throw new NotFoundException("Attendance attachment not found.");
    }

    await this.prisma.attendanceAttachment.delete({ where: { id: attachment.id } });
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
