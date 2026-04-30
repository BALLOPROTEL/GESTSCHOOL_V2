import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { NotificationRequestBusService } from "../notifications/notification-request-bus.service";
import {
  type AttendanceStatus,
  type AttendanceWithRelations,
  type PaymentReceivedNotificationInput
} from "./school-life.types";

@Injectable()
export class SchoolLifeNotificationOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationRequestBus: NotificationRequestBusService
  ) {}

  async ensureAttendanceAlertNotification(tenantId: string, attendanceId: string): Promise<void> {
    if (!tenantId) {
      return;
    }

    const attendance = await this.prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        tenantId
      },
      include: {
        student: true,
        classroom: true,
        schoolYear: true
      }
    });

    if (!attendance || !this.isAttendanceAlertStatus(attendance.status)) {
      return;
    }

    await this.maybeCreateAttendanceNotification(attendance);
  }

  async ensurePaymentReceivedNotification(
    input: PaymentReceivedNotificationInput
  ): Promise<void> {
    if (!input.tenantId || !input.studentId) {
      return;
    }

    const title = "Paiement recu";
    const studentLabel = input.studentName?.trim() || "Votre enfant";
    const paidDate = input.paidAt.slice(0, 10);
    const amountLabel = input.paidAmount.toFixed(2);
    const message =
      `${studentLabel}: paiement ${input.receiptNo} de ${amountLabel} ` +
      `enregistre pour la facture ${input.invoiceNo} le ${paidDate}.`;

    const existing = await this.prisma.notification.findFirst({
      where: {
        tenantId: input.tenantId,
        studentId: input.studentId,
        audienceRole: "PARENT",
        channel: "IN_APP",
        title,
        message
      }
    });

    if (existing) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        studentId: input.studentId,
        audienceRole: "PARENT",
        title,
        message,
        channel: "IN_APP",
        status: "PENDING",
        provider: "IN_APP",
        providerMessageId: null,
        deliveryStatus: "QUEUED",
        attempts: 0,
        lastError: null,
        nextAttemptAt: null,
        deliveredAt: null,
        updatedAt: new Date()
      }
    });
  }

  async enqueueAttendanceAlertRequested(
    transaction: Prisma.TransactionClient,
    attendance: Pick<
      AttendanceWithRelations,
      "attendanceDate" | "classroom" | "id" | "status" | "student" | "studentId" | "tenantId"
    >
  ): Promise<void> {
    if (!this.isAttendanceAlertStatus(attendance.status)) {
      return;
    }

    const normalizedStatus = this.normalizeAttendanceStatus(attendance.status);
    const studentName = `${attendance.student.firstName} ${attendance.student.lastName}`.trim();
    const dateLabel = attendance.attendanceDate.toISOString().slice(0, 10);
    const isLate = normalizedStatus === "LATE";

    await this.notificationRequestBus.publish(
      {
        tenantId: attendance.tenantId,
        kind: "ATTENDANCE_ALERT",
        channel: "IN_APP",
        recipient: {
          audienceRole: "PARENT",
          studentId: attendance.studentId
        },
        content: {
          templateKey: "attendance-alert",
          title: isLate ? "Alerte retard" : "Alerte absence",
          message: isLate
            ? `${studentName} est en retard le ${dateLabel} (${attendance.classroom.label}).`
            : `${studentName} est absent le ${dateLabel} (${attendance.classroom.label}).`,
          variables: {
            attendanceId: attendance.id,
            attendanceDate: dateLabel,
            classLabel: attendance.classroom.label,
            status: normalizedStatus,
            studentId: attendance.studentId,
            studentName
          }
        },
        source: {
          domain: "school-life",
          action: "attendance.alert.requested",
          referenceType: "attendance",
          referenceId: attendance.id
        },
        correlationId: attendance.id,
        idempotencyKey: `notification-request:school-life:attendance:${attendance.id}:${normalizedStatus}`
      },
      transaction
    );
  }

  private async maybeCreateAttendanceNotification(
    attendance: Prisma.AttendanceGetPayload<{
      include: {
        student: true;
        classroom: true;
        schoolYear: true;
      };
    }>
  ): Promise<void> {
    if (!this.isAttendanceAlertStatus(attendance.status)) {
      return;
    }

    const studentName = `${attendance.student.firstName} ${attendance.student.lastName}`.trim();
    const dateLabel = attendance.attendanceDate.toISOString().slice(0, 10);
    const isLate = this.normalizeAttendanceStatus(attendance.status) === "LATE";

    const title = isLate ? "Alerte retard" : "Alerte absence";
    const message = isLate
      ? `${studentName} est en retard le ${dateLabel} (${attendance.classroom.label}).`
      : `${studentName} est absent le ${dateLabel} (${attendance.classroom.label}).`;

    const existing = await this.prisma.notification.findFirst({
      where: {
        tenantId: attendance.tenantId,
        studentId: attendance.studentId,
        title,
        message,
        audienceRole: "PARENT",
        channel: "IN_APP"
      }
    });

    if (existing) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        tenantId: attendance.tenantId,
        studentId: attendance.studentId,
        audienceRole: "PARENT",
        title,
        message,
        channel: "IN_APP",
        status: "PENDING",
        provider: "IN_APP",
        providerMessageId: null,
        deliveryStatus: "QUEUED",
        attempts: 0,
        lastError: null,
        nextAttemptAt: null,
        deliveredAt: null,
        updatedAt: new Date()
      }
    });
  }

  private normalizeAttendanceStatus(status: string): AttendanceStatus {
    const normalized = status.trim().toUpperCase();
    if (normalized === "ABSENT") return "ABSENT";
    if (normalized === "LATE") return "LATE";
    if (normalized === "EXCUSED") return "EXCUSED";
    return "PRESENT";
  }

  private isAttendanceAlertStatus(status: string): boolean {
    const normalized = this.normalizeAttendanceStatus(status);
    return normalized === "ABSENT" || normalized === "LATE";
  }
}
