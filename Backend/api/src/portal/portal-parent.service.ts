import { Injectable } from "@nestjs/common";
import {
  AcademicStage,
  ReportCardMode
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { PortalAccessService } from "./portal-access.service";

@Injectable()
export class PortalParentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly portalAccessService: PortalAccessService
  ) {}

  async getParentOverview(tenantId: string, parentUserId: string) {
    const parentId = await this.portalAccessService.getParentIdForPortalUser(tenantId, parentUserId);
    const studentIds = parentId ? await this.portalAccessService.getParentStudentIds(tenantId, parentId) : [];
    if (studentIds.length === 0) {
      return {
        childrenCount: 0,
        openInvoicesCount: 0,
        remainingAmount: 0,
        absencesCount: 0,
        reportCardsCount: 0,
        notificationsCount: 0
      };
    }

    const [childrenCount, openInvoices, absencesCount, reportCardsCount, notificationsCount] =
      await Promise.all([
        this.prisma.parentStudentLink.count({
          where: { tenantId, parentId }
        }),
        this.prisma.invoice.findMany({
          where: {
            tenantId,
            studentId: { in: studentIds },
            status: { in: ["OPEN", "PARTIAL"] }
          },
          select: { amountDue: true, amountPaid: true }
        }),
        this.prisma.attendance.count({
          where: {
            tenantId,
            studentId: { in: studentIds },
            status: { in: ["ABSENT", "LATE"] }
          }
        }),
        this.prisma.reportCard.count({
          where: {
            tenantId,
            studentId: { in: studentIds }
          }
        }),
        this.prisma.notification.count({
          where: {
            tenantId,
            OR: [{ audienceRole: "PARENT" }, { studentId: { in: studentIds } }]
          }
        })
      ]);

    const remainingAmount = openInvoices.reduce((sum, item) => {
      const due = this.portalAccessService.decimalToNumber(item.amountDue);
      const paid = this.portalAccessService.decimalToNumber(item.amountPaid);
      return sum + Math.max(0, due - paid);
    }, 0);

    return {
      childrenCount,
      openInvoicesCount: openInvoices.length,
      remainingAmount: this.portalAccessService.roundAmount(remainingAmount),
      absencesCount,
      reportCardsCount,
      notificationsCount
    };
  }

  async listParentChildren(tenantId: string, parentUserId: string) {
    const parentId = await this.portalAccessService.getParentIdForPortalUser(tenantId, parentUserId);
    if (!parentId) return [];

    const rows = await this.prisma.parentStudentLink.findMany({
      where: { tenantId, parentId },
      include: {
        student: {
          include: {
            trackPlacements: {
              where: {
                placementStatus: this.portalAccessService.activeOrCompletedPlacementWhere()
              },
              include: {
                level: {
                  include: {
                    cycle: true
                  }
                },
                classroom: true,
                schoolYear: true
              },
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
            }
          }
        }
      },
      orderBy: [{ isPrimary: "desc" }, { student: { lastName: "asc" } }]
    });

    return rows.map((row) => {
      const placements = row.student.trackPlacements.map((placement) => ({
        placementId: placement.id,
        enrollmentId: placement.legacyEnrollmentId || undefined,
        track: placement.track,
        placementStatus: placement.placementStatus,
        isPrimary: placement.isPrimary,
        levelId: placement.levelId,
        levelCode: placement.level.code,
        levelLabel: placement.level.label,
        academicStage: placement.level.cycle.academicStage,
        classId: placement.classId || undefined,
        classLabel: placement.classroom?.label,
        schoolYearId: placement.schoolYearId,
        schoolYearCode: placement.schoolYear.code
      }));
      const primaryPlacement =
        placements.find((placement) => placement.isPrimary) || placements[0];
      const secondaryPlacement =
        placements.find((placement) => !placement.isPrimary) ||
        placements.find((placement) => placement.placementId !== primaryPlacement?.placementId);
      return {
        linkId: row.id,
        studentId: row.studentId,
        matricule: row.student.matricule,
        studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
        relationship: row.relationship || undefined,
        isPrimary: row.isPrimary,
        classId: primaryPlacement?.classId,
        classLabel: primaryPlacement?.classLabel,
        schoolYearId: primaryPlacement?.schoolYearId,
        schoolYearCode: primaryPlacement?.schoolYearCode,
        primaryTrack: primaryPlacement?.track,
        primaryPlacement,
        secondaryPlacement,
        secondaryClassId: secondaryPlacement?.classId,
        secondaryClassLabel: secondaryPlacement?.classLabel,
        placements
      };
    });
  }

  async listParentGrades(
    tenantId: string,
    parentUserId: string,
    filters: { studentId?: string; academicPeriodId?: string; classId?: string }
  ) {
    const studentIds = await this.portalAccessService.resolveParentScopedStudentIds(
      tenantId,
      parentUserId,
      filters.studentId
    );
    if (studentIds.length === 0) return [];

    const rows = await this.prisma.gradeEntry.findMany({
      where: {
        tenantId,
        studentId: { in: studentIds },
        academicPeriodId: filters.academicPeriodId,
        classId: filters.classId
      },
      include: {
        student: true,
        classroom: true,
        subject: true,
        academicPeriod: true
      },
      orderBy: [{ updatedAt: "desc" }]
    });

    return rows.map((row) => ({
      id: row.id,
      placementId: row.placementId || undefined,
      track: row.track,
      studentId: row.studentId,
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      classId: row.classId,
      classLabel: row.classroom.label,
      subjectId: row.subjectId,
      subjectLabel: row.subject.label,
      academicPeriodId: row.academicPeriodId,
      periodLabel: row.academicPeriod.label,
      assessmentLabel: row.assessmentLabel,
      assessmentType: row.assessmentType,
      score: this.portalAccessService.decimalToNumber(row.score),
      scoreMax: this.portalAccessService.decimalToNumber(row.scoreMax),
      absent: row.absent,
      comment: row.comment || undefined,
      updatedAt: row.updatedAt.toISOString()
    }));
  }

  async listParentReportCards(
    tenantId: string,
    parentUserId: string,
    filters: { studentId?: string; academicPeriodId?: string; classId?: string }
  ) {
    const studentIds = await this.portalAccessService.resolveParentScopedStudentIds(
      tenantId,
      parentUserId,
      filters.studentId
    );
    if (studentIds.length === 0) return [];

    const rows = await this.prisma.reportCard.findMany({
      where: {
        tenantId,
        studentId: { in: studentIds },
        academicPeriodId: filters.academicPeriodId,
        OR: filters.classId
          ? [
              { classId: filters.classId },
              {
                secondaryPlacement: {
                  is: {
                    classId: filters.classId
                  }
                }
              }
            ]
          : undefined
      },
      include: {
        student: true,
        classroom: true,
        academicPeriod: true,
        placement: {
          include: {
            classroom: true,
            level: true
          }
        },
        secondaryPlacement: {
          include: {
            classroom: true,
            level: true
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }]
    });

    return rows.map((row) => ({
      id: row.id,
      placementId: row.placementId || undefined,
      secondaryPlacementId: row.secondaryPlacementId || undefined,
      track: row.track,
      mode: row.mode as ReportCardMode,
      studentId: row.studentId,
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      classId: row.classId,
      classLabel: row.classroom.label,
      academicPeriodId: row.academicPeriodId,
      periodLabel: row.academicPeriod.label,
      averageGeneral: this.portalAccessService.decimalToNumber(row.averageGeneral),
      classRank: row.classRank || undefined,
      appreciation: row.appreciation || undefined,
      publishedAt: row.publishedAt?.toISOString(),
      pdfDataUrl: row.pdfDataUrl || undefined,
      secondaryClassLabel: row.secondaryPlacement?.classroom?.label || undefined,
      sections:
        row.summaryData && typeof row.summaryData === "object" && !Array.isArray(row.summaryData)
          ? ((row.summaryData as { sections?: unknown }).sections as Array<{
              placementId?: string;
              track: "FRANCOPHONE" | "ARABOPHONE";
              classId: string;
              classLabel?: string;
              levelCode?: string;
              levelLabel?: string;
              academicStage: AcademicStage;
              averageGeneral: number;
              classRank?: number;
              appreciation: string;
              subjectAverages: Array<{
                subjectId: string;
                subjectLabel: string;
                average: number;
              }>;
            }> | undefined)
          : undefined
    }));
  }

  async listParentAttendance(
    tenantId: string,
    parentUserId: string,
    filters: { studentId?: string; classId?: string; fromDate?: string; toDate?: string }
  ) {
    const studentIds = await this.portalAccessService.resolveParentScopedStudentIds(
      tenantId,
      parentUserId,
      filters.studentId
    );
    if (studentIds.length === 0) return [];

    const rows = await this.prisma.attendance.findMany({
      where: {
        tenantId,
        studentId: { in: studentIds },
        classId: filters.classId,
        attendanceDate:
          filters.fromDate || filters.toDate
            ? {
                gte: filters.fromDate ? new Date(filters.fromDate) : undefined,
                lte: filters.toDate ? new Date(filters.toDate) : undefined
              }
            : undefined
      },
      include: { student: true, classroom: true },
      orderBy: [{ attendanceDate: "desc" }, { createdAt: "desc" }]
    });

    return rows.map((row) => ({
      id: row.id,
      placementId: row.placementId || undefined,
      track: row.track,
      studentId: row.studentId,
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      classId: row.classId,
      classLabel: row.classroom.label,
      attendanceDate: row.attendanceDate.toISOString().slice(0, 10),
      status: row.status,
      reason: row.reason || undefined,
      justificationStatus: row.justificationStatus
    }));
  }

  async listParentInvoices(tenantId: string, parentUserId: string, studentId?: string) {
    const studentIds = await this.portalAccessService.resolveParentScopedStudentIds(
      tenantId,
      parentUserId,
      studentId
    );
    if (studentIds.length === 0) return [];

    const rows = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        studentId: { in: studentIds }
      },
      include: {
        student: true,
        schoolYear: true,
        feePlan: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return rows.map((row) => ({
      id: row.id,
      studentId: row.studentId,
      studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
      schoolYearId: row.schoolYearId,
      schoolYearCode: row.schoolYear.code,
      feePlanId: row.feePlanId || undefined,
      feePlanLabel: row.feePlan?.label,
      invoiceNumber: row.invoiceNo,
      amountDue: this.portalAccessService.decimalToNumber(row.amountDue),
      amountPaid: this.portalAccessService.decimalToNumber(row.amountPaid),
      balance: this.portalAccessService.roundAmount(
        Math.max(
          0,
          this.portalAccessService.decimalToNumber(row.amountDue) -
            this.portalAccessService.decimalToNumber(row.amountPaid)
        )
      ),
      currency: row.feePlan?.currency || "CFA",
      status: row.status,
      dueDate: row.dueDate?.toISOString().slice(0, 10),
      issuedAt: row.createdAt.toISOString()
    }));
  }

  async listParentPayments(tenantId: string, parentUserId: string, studentId?: string) {
    const studentIds = await this.portalAccessService.resolveParentScopedStudentIds(
      tenantId,
      parentUserId,
      studentId
    );
    if (studentIds.length === 0) return [];

    const rows = await this.prisma.payment.findMany({
      where: {
        tenantId,
        invoice: {
          studentId: { in: studentIds }
        }
      },
      include: {
        invoice: {
          include: { student: true, feePlan: true }
        }
      },
      orderBy: [{ paidAt: "desc" }]
    });

    return rows.map((row) => ({
      id: row.id,
      invoiceId: row.invoiceId,
      invoiceNumber: row.invoice.invoiceNo,
      studentId: row.invoice.studentId,
      studentName: `${row.invoice.student.firstName} ${row.invoice.student.lastName}`.trim(),
      paidAmount: this.portalAccessService.decimalToNumber(row.paidAmount),
      currency: row.invoice.feePlan?.currency || "CFA",
      paymentMethod: row.paymentMethod,
      reference: row.referenceExternal || undefined,
      receiptNo: row.receiptNo,
      paidAt: row.paidAt.toISOString()
    }));
  }

  async listParentTimetable(tenantId: string, parentUserId: string, studentId?: string) {
    const scopedStudentIds = await this.portalAccessService.resolveParentScopedStudentIds(
      tenantId,
      parentUserId,
      studentId
    );
    if (scopedStudentIds.length === 0) return [];

    const placementRows = await this.prisma.studentTrackPlacement.findMany({
      where: {
        tenantId,
        studentId: { in: scopedStudentIds },
        placementStatus: this.portalAccessService.activeOrCompletedPlacementWhere()
      },
      include: {
        student: true,
        classroom: true,
        schoolYear: true
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
    });

    const placementByClassId = new Map<
      string,
      Array<{
        placementId: string;
        track: "FRANCOPHONE" | "ARABOPHONE";
        studentId: string;
        studentName: string;
      }>
    >();

    for (const placement of placementRows) {
      if (!placement.classId) continue;
      const list = placementByClassId.get(placement.classId) || [];
      list.push({
        placementId: placement.id,
        track: placement.track,
        studentId: placement.studentId,
        studentName: `${placement.student.firstName} ${placement.student.lastName}`.trim()
      });
      placementByClassId.set(placement.classId, list);
    }

    const classIds = Array.from(placementByClassId.keys());
    if (classIds.length === 0) return [];

    const rows = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId,
        classId: { in: classIds }
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

    return rows.flatMap((row) =>
      (placementByClassId.get(row.classId) || []).map((child) => ({
        slotId: row.id,
        placementId: child.placementId,
        track: row.track,
        rotationGroup: row.rotationGroup || undefined,
        studentId: child.studentId,
        studentName: child.studentName,
        classId: row.classId,
        classLabel: row.classroom.label,
        schoolYearId: row.schoolYearId,
        schoolYearCode: row.schoolYear.code,
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
      }))
    );
  }

  async listParentNotifications(tenantId: string, parentUserId: string, studentId?: string) {
    const studentIds = await this.portalAccessService.resolveParentScopedStudentIds(
      tenantId,
      parentUserId,
      studentId
    );
    if (studentIds.length === 0) return [];

    const rows = await this.prisma.notification.findMany({
      where: {
        tenantId,
        OR: [
          { audienceRole: "PARENT" },
          ...(studentIds.length > 0 ? [{ studentId: { in: studentIds } }] : [])
        ]
      },
      include: { student: true },
      orderBy: [{ createdAt: "desc" }],
      take: 120
    });

    return rows.map((row) => this.portalAccessService.notificationView(row));
  }
}
