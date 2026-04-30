import {
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AcademicTrack,
  Prisma
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import {
  CreateTeacherDto,
  UpdateTeacherDto
} from "./dto/teachers.dto";
import { TeachersSupportService } from "./teachers-support.service";
import {
  type TeacherDetailView,
  type TeacherFilters,
  type TeacherView,
  type TeacherWorkloadView
} from "./teachers.types";

@Injectable()
export class TeachersDirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teachersSupportService: TeachersSupportService
  ) {}

  async listTeachers(tenantId: string, filters: TeacherFilters = {}): Promise<TeacherView[]> {
    const where: Prisma.TeacherWhereInput = {
      tenantId,
      status: filters.status || undefined,
      teacherType: filters.teacherType || undefined,
      archivedAt: filters.includeArchived === "true" || filters.status === "ARCHIVED" ? undefined : null,
      assignments:
        filters.subjectId || filters.classId || filters.schoolYearId || filters.track
          ? {
              some: {
                subjectId: filters.subjectId,
                classId: filters.classId,
                schoolYearId: filters.schoolYearId,
                track: filters.track,
                status: { not: "ARCHIVED" }
              }
            }
          : undefined
    };

    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { matricule: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ];
    }

    const rows = await this.prisma.teacher.findMany({
      where,
      include: { user: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { matricule: "asc" }]
    });
    const workloads = await this.teachersSupportService.getTeacherWorkloadMap(tenantId, rows.map((row) => row.id));
    return rows.map((row) => this.teachersSupportService.teacherView(row, workloads.get(row.id)));
  }

  async getTeacherDetail(tenantId: string, id: string): Promise<TeacherDetailView> {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, tenantId },
      include: {
        user: true,
        skills: {
          include: { teacher: true, subject: true, cycle: true, level: true },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }]
        },
        assignments: {
          include: this.teachersSupportService.assignmentInclude(),
          orderBy: [{ schoolYear: { code: "desc" } }, { createdAt: "desc" }]
        },
        documents: {
          include: { teacher: true, uploadedByUser: true },
          orderBy: [{ uploadedAt: "desc" }]
        }
      }
    });
    if (!teacher) throw new NotFoundException("Teacher not found.");

    const workloads = await this.teachersSupportService.getTeacherWorkloadMap(tenantId, [teacher.id]);
    return {
      ...this.teachersSupportService.teacherView(teacher, workloads.get(teacher.id)),
      skills: teacher.skills.map((row) => this.teachersSupportService.skillView(row)),
      assignments: teacher.assignments.map((row) => this.teachersSupportService.assignmentView(row)),
      documents: teacher.documents.map((row) => this.teachersSupportService.documentView(row))
    };
  }

  async createTeacher(tenantId: string, actorUserId: string, payload: CreateTeacherDto): Promise<TeacherView> {
    await this.teachersSupportService.assertTeacherPayload(tenantId, payload);
    try {
      const created = await this.prisma.teacher.create({
        data: {
          tenantId,
          matricule: payload.matricule.trim(),
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          sex: payload.sex,
          birthDate: payload.birthDate ? this.teachersSupportService.toDateOnly(payload.birthDate) : null,
          primaryPhone: this.teachersSupportService.optionalTrim(payload.primaryPhone),
          secondaryPhone: this.teachersSupportService.optionalTrim(payload.secondaryPhone),
          email: this.teachersSupportService.optionalTrim(payload.email),
          address: this.teachersSupportService.optionalTrim(payload.address),
          photoUrl: this.teachersSupportService.optionalTrim(payload.photoUrl),
          nationality: this.teachersSupportService.optionalTrim(payload.nationality),
          identityDocumentType: this.teachersSupportService.optionalTrim(payload.identityDocumentType),
          identityDocumentNumber: this.teachersSupportService.optionalTrim(payload.identityDocumentNumber),
          hireDate: payload.hireDate ? this.teachersSupportService.toDateOnly(payload.hireDate) : null,
          teacherType: payload.teacherType,
          speciality: this.teachersSupportService.optionalTrim(payload.speciality),
          mainDiploma: this.teachersSupportService.optionalTrim(payload.mainDiploma),
          teachingLanguage: this.teachersSupportService.optionalTrim(payload.teachingLanguage),
          status: payload.status,
          establishmentId: payload.establishmentId,
          userId: payload.userId,
          internalNotes: this.teachersSupportService.optionalTrim(payload.internalNotes),
          archivedAt: payload.status === "ARCHIVED" ? new Date() : null,
          updatedAt: new Date()
        },
        include: { user: true }
      });
      await this.teachersSupportService.logAudit(tenantId, actorUserId, "TEACHER_CREATED", "teachers", created.id, {
        matricule: created.matricule,
        status: created.status
      });
      return this.teachersSupportService.teacherView(created, {
        assignmentsCount: 0,
        workloadHoursTotal: 0,
        francophoneWorkloadHoursTotal: 0,
        arabophoneWorkloadHoursTotal: 0
      });
    } catch (error: unknown) {
      this.teachersSupportService.handleKnownPrismaConflict(error, "Teacher matricule, email or linked user already exists.");
      throw error;
    }
  }

  async updateTeacher(tenantId: string, actorUserId: string, id: string, payload: UpdateTeacherDto): Promise<TeacherView> {
    const existing = await this.teachersSupportService.requireTeacher(tenantId, id);
    await this.teachersSupportService.assertTeacherPayload(tenantId, payload, existing.id);
    try {
      const updated = await this.prisma.teacher.update({
        where: { id: existing.id },
        data: {
          matricule: payload.matricule?.trim(),
          firstName: payload.firstName?.trim(),
          lastName: payload.lastName?.trim(),
          sex: payload.sex,
          birthDate: payload.birthDate ? this.teachersSupportService.toDateOnly(payload.birthDate) : undefined,
          primaryPhone: payload.primaryPhone !== undefined ? this.teachersSupportService.optionalTrim(payload.primaryPhone) : undefined,
          secondaryPhone: payload.secondaryPhone !== undefined ? this.teachersSupportService.optionalTrim(payload.secondaryPhone) : undefined,
          email: payload.email !== undefined ? this.teachersSupportService.optionalTrim(payload.email) : undefined,
          address: payload.address !== undefined ? this.teachersSupportService.optionalTrim(payload.address) : undefined,
          photoUrl: payload.photoUrl !== undefined ? this.teachersSupportService.optionalTrim(payload.photoUrl) : undefined,
          nationality: payload.nationality !== undefined ? this.teachersSupportService.optionalTrim(payload.nationality) : undefined,
          identityDocumentType:
            payload.identityDocumentType !== undefined ? this.teachersSupportService.optionalTrim(payload.identityDocumentType) : undefined,
          identityDocumentNumber:
            payload.identityDocumentNumber !== undefined ? this.teachersSupportService.optionalTrim(payload.identityDocumentNumber) : undefined,
          hireDate: payload.hireDate ? this.teachersSupportService.toDateOnly(payload.hireDate) : undefined,
          teacherType: payload.teacherType,
          speciality: payload.speciality !== undefined ? this.teachersSupportService.optionalTrim(payload.speciality) : undefined,
          mainDiploma: payload.mainDiploma !== undefined ? this.teachersSupportService.optionalTrim(payload.mainDiploma) : undefined,
          teachingLanguage: payload.teachingLanguage !== undefined ? this.teachersSupportService.optionalTrim(payload.teachingLanguage) : undefined,
          status: payload.status,
          establishmentId: payload.establishmentId,
          userId: payload.userId,
          internalNotes: payload.internalNotes !== undefined ? this.teachersSupportService.optionalTrim(payload.internalNotes) : undefined,
          archivedAt:
            payload.status === "ARCHIVED"
              ? existing.archivedAt ?? new Date()
              : payload.status
                ? null
                : undefined,
          updatedAt: new Date()
        },
        include: { user: true }
      });
      await this.teachersSupportService.logAudit(tenantId, actorUserId, "TEACHER_UPDATED", "teachers", updated.id, {
        matricule: updated.matricule,
        status: updated.status
      });
      const workloads = await this.teachersSupportService.getTeacherWorkloadMap(tenantId, [updated.id]);
      return this.teachersSupportService.teacherView(updated, workloads.get(updated.id));
    } catch (error: unknown) {
      this.teachersSupportService.handleKnownPrismaConflict(error, "Teacher matricule, email or linked user already exists.");
      throw error;
    }
  }

  async archiveTeacher(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.teachersSupportService.requireTeacher(tenantId, id);
    await this.prisma.teacher.update({
      where: { id: existing.id },
      data: { status: "ARCHIVED", archivedAt: existing.archivedAt ?? new Date(), updatedAt: new Date() }
    });
    await this.teachersSupportService.logAudit(tenantId, actorUserId, "TEACHER_ARCHIVED", "teachers", existing.id, {
      matricule: existing.matricule
    });
  }

  async listWorkloads(tenantId: string, schoolYearId?: string, track?: AcademicTrack): Promise<TeacherWorkloadView[]> {
    const teachers = await this.prisma.teacher.findMany({
      where: {
        tenantId,
        archivedAt: null,
        assignments:
          schoolYearId || track
            ? {
                some: {
                  schoolYearId,
                  track
                }
              }
            : undefined
      },
      include: {
        assignments: {
          where: { status: { not: "ARCHIVED" }, schoolYearId, track },
          include: { classroom: true, subject: true }
        }
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });

    return teachers.map((teacher) => {
      const classes = Array.from(new Set(teacher.assignments.map((item) => item.classroom.label)));
      const subjects = Array.from(new Set(teacher.assignments.map((item) => item.subject.label)));
      const francophoneAssignments = teacher.assignments.filter((item) => item.track === AcademicTrack.FRANCOPHONE);
      const arabophoneAssignments = teacher.assignments.filter((item) => item.track === AcademicTrack.ARABOPHONE);
      return {
        teacherId: teacher.id,
        teacherName: this.teachersSupportService.teacherName(teacher),
        matricule: teacher.matricule,
        status: teacher.status,
        assignmentsCount: teacher.assignments.length,
        workloadHoursTotal: teacher.assignments.reduce(
          (sum, item) => sum + (item.workloadHours === null ? 0 : Number(item.workloadHours)),
          0
        ),
        francophoneHoursTotal: francophoneAssignments.reduce(
          (sum, item) => sum + (item.workloadHours === null ? 0 : Number(item.workloadHours)),
          0
        ),
        arabophoneHoursTotal: arabophoneAssignments.reduce(
          (sum, item) => sum + (item.workloadHours === null ? 0 : Number(item.workloadHours)),
          0
        ),
        francophoneAssignmentsCount: francophoneAssignments.length,
        arabophoneAssignmentsCount: arabophoneAssignments.length,
        classesCount: classes.length,
        subjectsCount: subjects.length,
        classes,
        subjects
      };
    });
  }
}
