import { Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import {
  CreateTeacherAssignmentDto,
  UpdateTeacherAssignmentDto
} from "./dto/teachers.dto";
import { TeachersSupportService } from "./teachers-support.service";
import {
  type AssignmentFilters,
  type TeacherAssignmentView
} from "./teachers.types";

@Injectable()
export class TeachersAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teachersSupportService: TeachersSupportService
  ) {}

  async listAssignments(tenantId: string, filters: AssignmentFilters = {}): Promise<TeacherAssignmentView[]> {
    const rows = await this.prisma.teacherAssignment.findMany({
      where: {
        tenantId,
        teacherId: filters.teacherId,
        schoolYearId: filters.schoolYearId,
        classId: filters.classId,
        subjectId: filters.subjectId,
        track: filters.track,
        status: filters.status
      },
      include: this.teachersSupportService.assignmentInclude(),
      orderBy: [{ schoolYear: { code: "desc" } }, { classroom: { label: "asc" } }, { subject: { label: "asc" } }]
    });
    return rows.map((row) => this.teachersSupportService.assignmentView(row));
  }

  async createAssignment(
    tenantId: string,
    actorUserId: string,
    payload: CreateTeacherAssignmentDto
  ): Promise<TeacherAssignmentView> {
    await this.teachersSupportService.assertAssignmentPayload(tenantId, payload);
    try {
      const created = await this.prisma.teacherAssignment.create({
        data: {
          tenantId,
          teacherId: payload.teacherId,
          schoolYearId: payload.schoolYearId,
          classId: payload.classId,
          subjectId: payload.subjectId,
          track: payload.track,
          periodId: payload.periodId || null,
          workloadHours: payload.workloadHours,
          coefficient: payload.coefficient,
          isHomeroomTeacher: payload.isHomeroomTeacher ?? false,
          role: this.teachersSupportService.optionalTrim(payload.role),
          startDate: this.teachersSupportService.toDateOnly(payload.startDate),
          endDate: payload.endDate ? this.teachersSupportService.toDateOnly(payload.endDate) : null,
          status: payload.status || "ACTIVE",
          comment: this.teachersSupportService.optionalTrim(payload.comment),
          updatedAt: new Date()
        },
        include: this.teachersSupportService.assignmentInclude()
      });
      await this.teachersSupportService.logAudit(tenantId, actorUserId, "TEACHER_ASSIGNMENT_CREATED", "teacher_assignments", created.id, {
        teacherId: created.teacherId,
        classId: created.classId,
        subjectId: created.subjectId,
        track: created.track
      });
      return this.teachersSupportService.assignmentView(created);
    } catch (error: unknown) {
      this.teachersSupportService.handleKnownPrismaConflict(error, "Teacher assignment already exists for this class, subject, school year and curriculum.");
      throw error;
    }
  }

  async updateAssignment(
    tenantId: string,
    actorUserId: string,
    id: string,
    payload: UpdateTeacherAssignmentDto
  ): Promise<TeacherAssignmentView> {
    const existing = await this.teachersSupportService.requireAssignment(tenantId, id);
    await this.teachersSupportService.assertAssignmentPayload(
      tenantId,
      {
        teacherId: payload.teacherId ?? existing.teacherId,
        schoolYearId: payload.schoolYearId ?? existing.schoolYearId,
        classId: payload.classId ?? existing.classId,
        subjectId: payload.subjectId ?? existing.subjectId,
        track: payload.track ?? existing.track,
        periodId: payload.periodId ?? existing.periodId ?? undefined,
        workloadHours: payload.workloadHours ?? (existing.workloadHours === null ? undefined : Number(existing.workloadHours)),
        coefficient: payload.coefficient ?? (existing.coefficient === null ? undefined : Number(existing.coefficient)),
        isHomeroomTeacher: payload.isHomeroomTeacher ?? existing.isHomeroomTeacher,
        role: payload.role ?? existing.role ?? undefined,
        startDate: payload.startDate ?? existing.startDate.toISOString().slice(0, 10),
        endDate: payload.endDate ?? (existing.endDate ? existing.endDate.toISOString().slice(0, 10) : undefined),
        status: (payload.status ?? existing.status) as CreateTeacherAssignmentDto["status"],
        comment: payload.comment ?? existing.comment ?? undefined
      },
      existing.id
    );
    try {
      const updated = await this.prisma.teacherAssignment.update({
        where: { id: existing.id },
        data: {
          teacherId: payload.teacherId,
          schoolYearId: payload.schoolYearId,
          classId: payload.classId,
          subjectId: payload.subjectId,
          track: payload.track,
          periodId: payload.periodId,
          workloadHours: payload.workloadHours,
          coefficient: payload.coefficient,
          isHomeroomTeacher: payload.isHomeroomTeacher,
          role: payload.role !== undefined ? this.teachersSupportService.optionalTrim(payload.role) : undefined,
          startDate: payload.startDate ? this.teachersSupportService.toDateOnly(payload.startDate) : undefined,
          endDate: payload.endDate ? this.teachersSupportService.toDateOnly(payload.endDate) : undefined,
          status: payload.status,
          comment: payload.comment !== undefined ? this.teachersSupportService.optionalTrim(payload.comment) : undefined,
          updatedAt: new Date()
        },
        include: this.teachersSupportService.assignmentInclude()
      });
      await this.teachersSupportService.logAudit(tenantId, actorUserId, "TEACHER_ASSIGNMENT_UPDATED", "teacher_assignments", updated.id);
      return this.teachersSupportService.assignmentView(updated);
    } catch (error: unknown) {
      this.teachersSupportService.handleKnownPrismaConflict(error, "Teacher assignment already exists for this class, subject, school year and curriculum.");
      throw error;
    }
  }

  async archiveAssignment(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.teachersSupportService.requireAssignment(tenantId, id);
    await this.prisma.teacherAssignment.update({
      where: { id: existing.id },
      data: { status: "ARCHIVED", updatedAt: new Date() }
    });
    await this.teachersSupportService.logAudit(tenantId, actorUserId, "TEACHER_ASSIGNMENT_ARCHIVED", "teacher_assignments", existing.id);
  }
}
