import {
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import {
  AcademicPlacementStatus,
  Prisma
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";

@Injectable()
export class PortalAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getTeacherClassIds(tenantId: string, teacherUserId: string): Promise<string[]> {
    const rows = await this.prisma.teacherAssignment.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        teacher: { userId: teacherUserId, archivedAt: null, status: "ACTIVE" }
      },
      select: { classId: true }
    });
    return [...new Set(rows.map((row) => row.classId))];
  }

  async assertTeacherCanAccessClass(
    tenantId: string,
    teacherUserId: string,
    classId: string
  ): Promise<void> {
    const assignment = await this.prisma.teacherAssignment.findFirst({
      where: {
        tenantId,
        classId,
        status: "ACTIVE",
        teacher: { userId: teacherUserId, archivedAt: null, status: "ACTIVE" }
      },
      select: { id: true }
    });
    if (!assignment) {
      throw new ForbiddenException("Teacher is not assigned to this class.");
    }
  }

  async assertTeacherCanAccessSubject(
    tenantId: string,
    teacherUserId: string,
    classId: string,
    subjectId: string
  ): Promise<void> {
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: {
        tenantId,
        classId,
        status: "ACTIVE",
        teacher: { userId: teacherUserId, archivedAt: null, status: "ACTIVE" }
      },
      select: { subjectId: true }
    });
    if (assignments.length === 0) {
      throw new ForbiddenException("Teacher is not assigned to this class.");
    }
    const scopedSubjects = assignments
      .map((item) => item.subjectId)
      .filter((item): item is string => Boolean(item));
    if (scopedSubjects.length > 0 && !scopedSubjects.includes(subjectId)) {
      throw new ForbiddenException("Teacher is not assigned to this subject for the class.");
    }
  }

  resolveTeacherScopedClassIds(assignedClassIds: string[], classId?: string): string[] {
    if (!classId) return assignedClassIds;
    if (!assignedClassIds.includes(classId)) {
      throw new ForbiddenException("Teacher is not assigned to selected class.");
    }
    return [classId];
  }

  async getParentIdForPortalUser(tenantId: string, parentUserId: string): Promise<string | null> {
    const parent = await this.prisma.parent.findFirst({
      where: {
        tenantId,
        userId: parentUserId,
        status: "ACTIVE",
        archivedAt: null
      },
      select: { id: true }
    });
    return parent?.id || null;
  }

  async getParentStudentIds(tenantId: string, parentId: string): Promise<string[]> {
    const rows = await this.prisma.parentStudentLink.findMany({
      where: { tenantId, parentId, status: "ACTIVE", archivedAt: null },
      select: { studentId: true }
    });
    return [...new Set(rows.map((row) => row.studentId))];
  }

  async resolveParentScopedStudentIds(
    tenantId: string,
    parentUserId: string,
    studentId?: string
  ): Promise<string[]> {
    const parentId = await this.getParentIdForPortalUser(tenantId, parentUserId);
    const studentIds = parentId ? await this.getParentStudentIds(tenantId, parentId) : [];
    if (!studentId) return studentIds;
    if (!studentIds.includes(studentId)) {
      throw new ForbiddenException("Student is not linked to current parent.");
    }
    return [studentId];
  }

  activeOrCompletedPlacementWhere(): Prisma.EnumAcademicPlacementStatusFilter<"StudentTrackPlacement"> {
    return {
      in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
    };
  }

  decimalToNumber(value: Prisma.Decimal | number | null): number {
    if (value === null) return 0;
    if (typeof value === "number") return value;
    return Number(value.toString());
  }

  roundAmount(value: number): number {
    return Math.round(value * 100) / 100;
  }

  notificationView(
    row: Prisma.NotificationGetPayload<{ include: { student: true } }>
  ) {
    return {
      id: row.id,
      studentId: row.studentId || undefined,
      studentName: row.student
        ? `${row.student.firstName} ${row.student.lastName}`.trim()
        : undefined,
      audienceRole: row.audienceRole || undefined,
      title: row.title,
      message: row.message,
      channel: row.channel,
      status: row.status,
      targetAddress: row.targetAddress || undefined,
      provider: row.provider || undefined,
      providerMessageId: row.providerMessageId || undefined,
      deliveryStatus: row.deliveryStatus,
      attempts: row.attempts,
      lastError: row.lastError || undefined,
      nextAttemptAt: row.nextAttemptAt?.toISOString(),
      deliveredAt: row.deliveredAt?.toISOString(),
      scheduledAt: row.scheduledAt?.toISOString(),
      sentAt: row.sentAt?.toISOString(),
      createdAt: row.createdAt.toISOString()
    };
  }
}
