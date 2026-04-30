import {
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { AcademicPlacementStatus } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { CreateGradeDto } from "../grades/dto/grades.dto";
import { GradesService } from "../grades/grades.service";
import { BulkAttendanceDto, CreateNotificationDto } from "../school-life/dto/school-life.dto";
import { SchoolLifeService } from "../school-life/school-life.service";
import { PortalAccessService } from "./portal-access.service";

@Injectable()
export class PortalTeacherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gradesService: GradesService,
    private readonly schoolLifeService: SchoolLifeService,
    private readonly portalAccessService: PortalAccessService
  ) {}

  async getTeacherOverview(tenantId: string, teacherUserId: string) {
    const classIds = await this.portalAccessService.getTeacherClassIds(tenantId, teacherUserId);
    if (classIds.length === 0) {
      return {
        classesCount: 0,
        studentsCount: 0,
        gradesCount: 0,
        pendingJustifications: 0,
        timetableSlotsCount: 0,
        notificationsCount: 0
      };
    }

    const [placementRows, gradesCount, pendingJustifications, timetableSlotsCount, notificationsCount] =
      await Promise.all([
        this.prisma.studentTrackPlacement.findMany({
          where: {
            tenantId,
            classId: { in: classIds },
            placementStatus: this.portalAccessService.activeOrCompletedPlacementWhere()
          },
          select: { studentId: true },
          distinct: ["studentId"]
        }),
        this.prisma.gradeEntry.count({ where: { tenantId, classId: { in: classIds } } }),
        this.prisma.attendance.count({
          where: { tenantId, classId: { in: classIds }, justificationStatus: "PENDING" }
        }),
        this.prisma.timetableSlot.count({ where: { tenantId, classId: { in: classIds } } }),
        this.prisma.notification.count({
          where: {
            tenantId,
            OR: [
              { audienceRole: "ENSEIGNANT" },
              {
                student: {
                  trackPlacements: {
                    some: {
                      tenantId,
                      classId: { in: classIds },
                      placementStatus: this.portalAccessService.activeOrCompletedPlacementWhere()
                    }
                  }
                }
              }
            ]
          }
        })
      ]);

    return {
      classesCount: classIds.length,
      studentsCount: placementRows.length,
      gradesCount,
      pendingJustifications,
      timetableSlotsCount,
      notificationsCount
    };
  }

  async listTeacherClasses(tenantId: string, teacherUserId: string) {
    const rows = await this.prisma.teacherAssignment.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        teacher: { userId: teacherUserId, archivedAt: null, status: "ACTIVE" }
      },
      include: { classroom: true, schoolYear: true, subject: true },
      orderBy: [{ schoolYear: { code: "desc" } }, { classroom: { label: "asc" } }]
    });

    return rows.map((row) => ({
      assignmentId: row.id,
      classId: row.classId,
      classLabel: row.classroom.label,
      schoolYearId: row.schoolYearId,
      schoolYearCode: row.schoolYear.code,
      track: row.track,
      subjectId: row.subjectId,
      subjectLabel: row.subject.label
    }));
  }

  async listTeacherStudents(tenantId: string, teacherUserId: string, classId?: string) {
    const classIds = this.portalAccessService.resolveTeacherScopedClassIds(
      await this.portalAccessService.getTeacherClassIds(tenantId, teacherUserId),
      classId
    );
    if (classIds.length === 0) return [];

    const rows = await this.prisma.studentTrackPlacement.findMany({
      where: {
        tenantId,
        classId: { in: classIds },
        placementStatus: this.portalAccessService.activeOrCompletedPlacementWhere()
      },
      include: { student: true, classroom: true, schoolYear: true },
      orderBy: [{ classroom: { label: "asc" } }, { student: { lastName: "asc" } }]
    });

    return rows.map((row) => ({
      placementId: row.id,
      enrollmentId: row.legacyEnrollmentId || row.id,
      studentId: row.studentId,
      matricule: row.student.matricule,
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      classId: row.classId!,
      classLabel: row.classroom?.label || "-",
      schoolYearId: row.schoolYearId,
      schoolYearCode: row.schoolYear.code,
      track: row.track,
      placementStatus: row.placementStatus,
      isPrimary: row.isPrimary
    }));
  }

  async listTeacherGrades(
    tenantId: string,
    teacherUserId: string,
    filters: { classId?: string; subjectId?: string; academicPeriodId?: string; studentId?: string }
  ) {
    const classIds = this.portalAccessService.resolveTeacherScopedClassIds(
      await this.portalAccessService.getTeacherClassIds(tenantId, teacherUserId),
      filters.classId
    );
    if (classIds.length === 0) return [];

    const rows = await this.prisma.gradeEntry.findMany({
      where: {
        tenantId,
        classId: { in: classIds },
        subjectId: filters.subjectId,
        academicPeriodId: filters.academicPeriodId,
        studentId: filters.studentId
      },
      include: { student: true, subject: true },
      orderBy: [{ updatedAt: "desc" }]
    });

    return rows.map((row) => ({
      id: row.id,
      placementId: row.placementId || undefined,
      track: row.track,
      studentId: row.studentId,
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      classId: row.classId,
      subjectId: row.subjectId,
      subjectLabel: row.subject.label,
      academicPeriodId: row.academicPeriodId,
      assessmentLabel: row.assessmentLabel,
      assessmentType: row.assessmentType,
      score: this.portalAccessService.decimalToNumber(row.score),
      scoreMax: this.portalAccessService.decimalToNumber(row.scoreMax),
      absent: row.absent,
      comment: row.comment || undefined
    }));
  }

  async upsertTeacherGrade(tenantId: string, teacherUserId: string, payload: CreateGradeDto) {
    await this.portalAccessService.assertTeacherCanAccessClass(tenantId, teacherUserId, payload.classId);
    await this.portalAccessService.assertTeacherCanAccessSubject(tenantId, teacherUserId, payload.classId, payload.subjectId);
    return this.gradesService.upsertGrade(tenantId, payload);
  }

  async bulkUpsertTeacherAttendance(
    tenantId: string,
    teacherUserId: string,
    payload: BulkAttendanceDto
  ) {
    await this.portalAccessService.assertTeacherCanAccessClass(tenantId, teacherUserId, payload.classId);
    return this.schoolLifeService.upsertAttendanceBulk(tenantId, payload);
  }

  async listTeacherTimetable(
    tenantId: string,
    teacherUserId: string,
    filters: { classId?: string; schoolYearId?: string; dayOfWeek?: number }
  ) {
    const classIds = this.portalAccessService.resolveTeacherScopedClassIds(
      await this.portalAccessService.getTeacherClassIds(tenantId, teacherUserId),
      filters.classId
    );
    if (classIds.length === 0) return [];

    const rows = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId,
        schoolYearId: filters.schoolYearId,
        dayOfWeek: filters.dayOfWeek,
        OR: [
          {
            teacherAssignment: {
              teacher: { userId: teacherUserId, archivedAt: null, status: "ACTIVE" },
              status: "ACTIVE"
            }
          },
          {
            teacherAssignmentId: null,
            classId: { in: classIds }
          }
        ]
      },
      include: {
        classroom: true,
        schoolYear: true,
        subject: true,
        roomRef: true,
        teacherAssignment: {
          include: {
            teacher: true
          }
        }
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
    });

    return rows.map((row) => ({
      id: row.id,
      classId: row.classId,
      classLabel: row.classroom.label,
      schoolYearId: row.schoolYearId,
      schoolYearCode: row.schoolYear.code,
      track: row.track,
      rotationGroup: row.rotationGroup || undefined,
      subjectId: row.subjectId,
      subjectLabel: row.subject.label,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      roomId: row.roomId || undefined,
      room: row.roomRef ? `${row.roomRef.code} - ${row.roomRef.name}` : row.room || undefined,
      teacherAssignmentId: row.teacherAssignmentId || undefined,
      teacherName: row.teacherAssignment?.teacher
        ? `${row.teacherAssignment.teacher.firstName} ${row.teacherAssignment.teacher.lastName}`.trim()
        : row.teacherName || undefined
    }));
  }

  async listTeacherNotifications(tenantId: string, teacherUserId: string, classId?: string) {
    const classIds = this.portalAccessService.resolveTeacherScopedClassIds(
      await this.portalAccessService.getTeacherClassIds(tenantId, teacherUserId),
      classId
    );
    const studentRows =
      classIds.length === 0
        ? []
        : await this.prisma.studentTrackPlacement.findMany({
            where: {
              tenantId,
              classId: { in: classIds },
              placementStatus: this.portalAccessService.activeOrCompletedPlacementWhere()
            },
            select: { studentId: true }
          });
    const studentIds = [...new Set(studentRows.map((row) => row.studentId))];

    const rows = await this.prisma.notification.findMany({
      where: {
        tenantId,
        OR: [
          { audienceRole: "ENSEIGNANT" },
          ...(studentIds.length > 0 ? [{ studentId: { in: studentIds } }] : [])
        ]
      },
      include: { student: true },
      orderBy: [{ createdAt: "desc" }],
      take: 100
    });

    return rows.map((row) => this.portalAccessService.notificationView(row));
  }

  async createTeacherNotification(
    tenantId: string,
    teacherUserId: string,
    payload: {
      classId: string;
      studentId?: string;
      title: string;
      message: string;
      channel?: "IN_APP" | "EMAIL" | "SMS";
      targetAddress?: string;
      scheduledAt?: string;
    }
  ) {
    await this.portalAccessService.assertTeacherCanAccessClass(tenantId, teacherUserId, payload.classId);
    if (payload.studentId) {
      const placement = await this.prisma.studentTrackPlacement.findFirst({
        where: {
          tenantId,
          classId: payload.classId,
          studentId: payload.studentId,
          placementStatus: {
            in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
          }
        },
        select: { id: true }
      });
      if (!placement) {
        throw new ForbiddenException("Target student is not part of selected class.");
      }
    }

    const body: CreateNotificationDto = {
      studentId: payload.studentId,
      audienceRole: "PARENT",
      title: payload.title,
      message: payload.message,
      channel: payload.channel,
      targetAddress: payload.targetAddress,
      scheduledAt: payload.scheduledAt
    };
    return this.schoolLifeService.createNotification(tenantId, body);
  }
}
