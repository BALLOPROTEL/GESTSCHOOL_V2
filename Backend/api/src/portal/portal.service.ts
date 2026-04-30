import { Injectable } from "@nestjs/common";

import { CreateGradeDto } from "../grades/dto/grades.dto";
import { BulkAttendanceDto } from "../school-life/dto/school-life.dto";
import { PortalParentService } from "./portal-parent.service";
import { PortalTeacherService } from "./portal-teacher.service";

@Injectable()
export class PortalService {
  constructor(
    private readonly portalTeacherService: PortalTeacherService,
    private readonly portalParentService: PortalParentService
  ) {}

  getTeacherOverview(tenantId: string, teacherUserId: string) {
    return this.portalTeacherService.getTeacherOverview(tenantId, teacherUserId);
  }

  listTeacherClasses(tenantId: string, teacherUserId: string) {
    return this.portalTeacherService.listTeacherClasses(tenantId, teacherUserId);
  }

  listTeacherStudents(tenantId: string, teacherUserId: string, classId?: string) {
    return this.portalTeacherService.listTeacherStudents(tenantId, teacherUserId, classId);
  }

  listTeacherGrades(
    tenantId: string,
    teacherUserId: string,
    filters: { classId?: string; subjectId?: string; academicPeriodId?: string; studentId?: string }
  ) {
    return this.portalTeacherService.listTeacherGrades(tenantId, teacherUserId, filters);
  }

  upsertTeacherGrade(tenantId: string, teacherUserId: string, payload: CreateGradeDto) {
    return this.portalTeacherService.upsertTeacherGrade(tenantId, teacherUserId, payload);
  }

  bulkUpsertTeacherAttendance(
    tenantId: string,
    teacherUserId: string,
    payload: BulkAttendanceDto
  ) {
    return this.portalTeacherService.bulkUpsertTeacherAttendance(tenantId, teacherUserId, payload);
  }

  listTeacherTimetable(
    tenantId: string,
    teacherUserId: string,
    filters: { classId?: string; schoolYearId?: string; dayOfWeek?: number }
  ) {
    return this.portalTeacherService.listTeacherTimetable(tenantId, teacherUserId, filters);
  }

  listTeacherNotifications(tenantId: string, teacherUserId: string, classId?: string) {
    return this.portalTeacherService.listTeacherNotifications(tenantId, teacherUserId, classId);
  }

  createTeacherNotification(
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
    return this.portalTeacherService.createTeacherNotification(tenantId, teacherUserId, payload);
  }

  getParentOverview(tenantId: string, parentUserId: string) {
    return this.portalParentService.getParentOverview(tenantId, parentUserId);
  }

  listParentChildren(tenantId: string, parentUserId: string) {
    return this.portalParentService.listParentChildren(tenantId, parentUserId);
  }

  listParentGrades(
    tenantId: string,
    parentUserId: string,
    filters: { studentId?: string; academicPeriodId?: string; classId?: string }
  ) {
    return this.portalParentService.listParentGrades(tenantId, parentUserId, filters);
  }

  listParentReportCards(
    tenantId: string,
    parentUserId: string,
    filters: { studentId?: string; academicPeriodId?: string; classId?: string }
  ) {
    return this.portalParentService.listParentReportCards(tenantId, parentUserId, filters);
  }

  listParentAttendance(
    tenantId: string,
    parentUserId: string,
    filters: { studentId?: string; classId?: string; fromDate?: string; toDate?: string }
  ) {
    return this.portalParentService.listParentAttendance(tenantId, parentUserId, filters);
  }

  listParentInvoices(tenantId: string, parentUserId: string, studentId?: string) {
    return this.portalParentService.listParentInvoices(tenantId, parentUserId, studentId);
  }

  listParentPayments(tenantId: string, parentUserId: string, studentId?: string) {
    return this.portalParentService.listParentPayments(tenantId, parentUserId, studentId);
  }

  listParentTimetable(tenantId: string, parentUserId: string, studentId?: string) {
    return this.portalParentService.listParentTimetable(tenantId, parentUserId, studentId);
  }

  listParentNotifications(tenantId: string, parentUserId: string, studentId?: string) {
    return this.portalParentService.listParentNotifications(tenantId, parentUserId, studentId);
  }
}
