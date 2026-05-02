import { Injectable } from "@nestjs/common";
import { AcademicTrack } from "@prisma/client";

import { NotificationsService } from "../notifications/notifications.service";
import {
  CreateAttendanceAttachmentDto,
  CreateAttendanceDto,
  CreateNotificationDto,
  CreateTimetableSlotDto,
  NotificationDeliveryEventDto,
  UpdateAttendanceDto,
  UpdateAttendanceValidationDto,
  UpdateNotificationStatusDto,
  UpdateTimetableSlotDto
} from "./dto/school-life.dto";
import { SchoolLifeAttendanceService } from "./school-life-attendance.service";
import { SchoolLifeNotificationOrchestratorService } from "./school-life-notification-orchestrator.service";
import { SchoolLifeTimetableService } from "./school-life-timetable.service";
import {
  type AttendanceAttachmentView,
  type AttendanceSummaryView,
  type AttendanceView,
  type BulkAttendanceResult,
  type NotificationView,
  type PaymentReceivedNotificationInput,
  type TimetableGridView,
  type TimetableSlotView
} from "./school-life.types";

@Injectable()
export class SchoolLifeService {
  constructor(
    private readonly attendanceService: SchoolLifeAttendanceService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationOrchestrator: SchoolLifeNotificationOrchestratorService,
    private readonly timetableService: SchoolLifeTimetableService
  ) {}

  getAttendanceSummary(
    tenantId: string,
    filters: {
      classId?: string;
      placementId?: string;
      fromDate?: string;
      toDate?: string;
    }
  ): Promise<AttendanceSummaryView> {
    return this.attendanceService.getAttendanceSummary(tenantId, filters);
  }

  listAttendance(
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
    return this.attendanceService.listAttendance(tenantId, filters);
  }

  createAttendance(tenantId: string, payload: CreateAttendanceDto): Promise<AttendanceView> {
    return this.attendanceService.createAttendance(tenantId, payload);
  }

  upsertAttendanceBulk(
    tenantId: string,
    payload: Parameters<SchoolLifeAttendanceService["upsertAttendanceBulk"]>[1]
  ): Promise<BulkAttendanceResult> {
    return this.attendanceService.upsertAttendanceBulk(tenantId, payload);
  }

  updateAttendance(
    tenantId: string,
    id: string,
    payload: UpdateAttendanceDto
  ): Promise<AttendanceView> {
    return this.attendanceService.updateAttendance(tenantId, id, payload);
  }

  deleteAttendance(tenantId: string, id: string): Promise<void> {
    return this.attendanceService.deleteAttendance(tenantId, id);
  }

  listAttendanceAttachments(
    tenantId: string,
    attendanceId: string
  ): Promise<AttendanceAttachmentView[]> {
    return this.attendanceService.listAttendanceAttachments(tenantId, attendanceId);
  }

  addAttendanceAttachment(
    tenantId: string,
    attendanceId: string,
    payload: CreateAttendanceAttachmentDto,
    uploadedByUserId?: string
  ): Promise<AttendanceAttachmentView> {
    return this.attendanceService.addAttendanceAttachment(
      tenantId,
      attendanceId,
      payload,
      uploadedByUserId
    );
  }

  deleteAttendanceAttachment(
    tenantId: string,
    attendanceId: string,
    attachmentId: string
  ): Promise<void> {
    return this.attendanceService.deleteAttendanceAttachment(tenantId, attendanceId, attachmentId);
  }

  updateAttendanceValidation(
    tenantId: string,
    attendanceId: string,
    payload: UpdateAttendanceValidationDto,
    validatedByUserId?: string
  ): Promise<AttendanceView> {
    return this.attendanceService.updateAttendanceValidation(
      tenantId,
      attendanceId,
      payload,
      validatedByUserId
    );
  }

  listTimetableSlots(
    tenantId: string,
    filters: {
      classId?: string;
      schoolYearId?: string;
      dayOfWeek?: number;
      track?: AcademicTrack;
    }
  ): Promise<TimetableSlotView[]> {
    return this.timetableService.listTimetableSlots(tenantId, filters);
  }

  getTimetableGrid(
    tenantId: string,
    filters: { classId?: string; schoolYearId?: string; track?: AcademicTrack }
  ): Promise<TimetableGridView> {
    return this.timetableService.getTimetableGrid(tenantId, filters);
  }

  createTimetableSlot(
    tenantId: string,
    payload: CreateTimetableSlotDto
  ): Promise<TimetableSlotView> {
    return this.timetableService.createTimetableSlot(tenantId, payload);
  }

  updateTimetableSlot(
    tenantId: string,
    id: string,
    payload: UpdateTimetableSlotDto
  ): Promise<TimetableSlotView> {
    return this.timetableService.updateTimetableSlot(tenantId, id, payload);
  }

  deleteTimetableSlot(tenantId: string, id: string): Promise<void> {
    return this.timetableService.deleteTimetableSlot(tenantId, id);
  }

  listNotifications(
    tenantId: string,
    filters: {
      status?: string;
      channel?: string;
      audienceRole?: string;
      studentId?: string;
      deliveryStatus?: string;
      provider?: string;
    }
  ): Promise<NotificationView[]> {
    return this.notificationsService.listNotifications(tenantId, filters);
  }

  createNotification(
    tenantId: string,
    payload: CreateNotificationDto
  ): Promise<NotificationView> {
    return this.notificationsService.createNotification(tenantId, payload);
  }

  dispatchPendingNotifications(
    tenantId: string,
    limit?: number
  ): Promise<{ dispatchedCount: number; notifications: NotificationView[] }> {
    return this.notificationsService.dispatchPendingNotifications(tenantId, limit);
  }

  dispatchPendingNotificationsGlobal(
    limit?: number
  ): Promise<{ dispatchedCount: number; notifications: NotificationView[] }> {
    return this.notificationsService.dispatchPendingNotificationsGlobal(limit);
  }

  recordDeliveryEvent(payload: NotificationDeliveryEventDto): Promise<NotificationView> {
    return this.notificationsService.recordDeliveryEvent(payload);
  }

  ensureAttendanceAlertNotification(tenantId: string, attendanceId: string): Promise<void> {
    return this.notificationOrchestrator.ensureAttendanceAlertNotification(tenantId, attendanceId);
  }

  ensurePaymentReceivedNotification(input: PaymentReceivedNotificationInput): Promise<void> {
    return this.notificationOrchestrator.ensurePaymentReceivedNotification(input);
  }

  updateNotificationStatus(
    tenantId: string,
    id: string,
    payload: UpdateNotificationStatusDto
  ): Promise<NotificationView> {
    return this.notificationsService.updateNotificationStatus(tenantId, id, payload);
  }
}
