import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AcademicTrack,
  Prisma,
  type Teacher,
  type TeacherAssignment,
  type TeacherDocument,
  type TeacherSkill
} from "@prisma/client";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { UserRole } from "../security/roles.enum";
import {
  CreateTeacherAssignmentDto,
  CreateTeacherDocumentDto,
  CreateTeacherDto,
  CreateTeacherSkillDto,
  UpdateTeacherAssignmentDto,
  UpdateTeacherDocumentDto,
  UpdateTeacherDto,
  UpdateTeacherSkillDto
} from "./dto/teachers.dto";

type TeacherFilters = {
  search?: string;
  status?: string;
  teacherType?: string;
  subjectId?: string;
  classId?: string;
  schoolYearId?: string;
  track?: AcademicTrack;
  includeArchived?: string;
};

type AssignmentFilters = {
  teacherId?: string;
  schoolYearId?: string;
  classId?: string;
  subjectId?: string;
  track?: AcademicTrack;
  status?: string;
};

type TeacherWithUser = Prisma.TeacherGetPayload<{ include: { user: true } }>;
type SkillWithRelations = Prisma.TeacherSkillGetPayload<{
  include: { teacher: true; subject: true; cycle: true; level: true };
}>;
type AssignmentWithRelations = Prisma.TeacherAssignmentGetPayload<{
  include: {
    teacher: true;
    schoolYear: true;
    classroom: { include: { level: { include: { cycle: true } } } };
    subject: true;
    academicPeriod: true;
  };
}>;
type DocumentWithRelations = Prisma.TeacherDocumentGetPayload<{
  include: { teacher: true; uploadedByUser: true };
}>;

export type TeacherView = {
  id: string;
  tenantId: string;
  matricule: string;
  firstName: string;
  lastName: string;
  fullName: string;
  sex?: string;
  birthDate?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  email?: string;
  address?: string;
  photoUrl?: string;
  nationality?: string;
  identityDocumentType?: string;
  identityDocumentNumber?: string;
  hireDate?: string;
  teacherType: string;
  speciality?: string;
  mainDiploma?: string;
  teachingLanguage?: string;
  status: string;
  establishmentId?: string;
  userId?: string;
  userUsername?: string;
  internalNotes?: string;
  archivedAt?: string;
  activeAssignmentsCount: number;
  workloadHoursTotal: number;
  francophoneWorkloadHoursTotal: number;
  arabophoneWorkloadHoursTotal: number;
  createdAt: string;
  updatedAt: string;
};

export type TeacherSkillView = {
  id: string;
  teacherId: string;
  teacherName?: string;
  subjectId: string;
  subjectLabel?: string;
  track: AcademicTrack;
  cycleId?: string;
  cycleLabel?: string;
  levelId?: string;
  levelLabel?: string;
  qualification?: string;
  yearsExperience?: number;
  priority?: number;
  status: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};

export type TeacherAssignmentView = {
  id: string;
  teacherId: string;
  teacherName?: string;
  schoolYearId: string;
  schoolYearCode?: string;
  classId: string;
  classLabel?: string;
  levelId?: string;
  levelLabel?: string;
  subjectId: string;
  subjectLabel?: string;
  track: AcademicTrack;
  periodId?: string;
  periodLabel?: string;
  workloadHours?: number;
  coefficient?: number;
  isHomeroomTeacher: boolean;
  role?: string;
  startDate: string;
  endDate?: string;
  status: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};

export type TeacherDocumentView = {
  id: string;
  teacherId: string;
  teacherName?: string;
  documentType: string;
  fileUrl: string;
  originalName: string;
  mimeType?: string;
  size?: number;
  uploadedAt: string;
  uploadedBy?: string;
  uploadedByUsername?: string;
  status: string;
  archivedAt?: string;
};

export type TeacherDetailView = TeacherView & {
  skills: TeacherSkillView[];
  assignments: TeacherAssignmentView[];
  documents: TeacherDocumentView[];
};

export type TeacherWorkloadView = {
  teacherId: string;
  teacherName: string;
  matricule: string;
  status: string;
  assignmentsCount: number;
  workloadHoursTotal: number;
  francophoneHoursTotal: number;
  arabophoneHoursTotal: number;
  francophoneAssignmentsCount: number;
  arabophoneAssignmentsCount: number;
  classesCount: number;
  subjectsCount: number;
  classes: string[];
  subjects: string[];
};

@Injectable()
export class TeachersService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
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
    const workloads = await this.getTeacherWorkloadMap(tenantId, rows.map((row) => row.id));
    return rows.map((row) => this.teacherView(row, workloads.get(row.id)));
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
          include: this.assignmentInclude(),
          orderBy: [{ schoolYear: { code: "desc" } }, { createdAt: "desc" }]
        },
        documents: {
          include: { teacher: true, uploadedByUser: true },
          orderBy: [{ uploadedAt: "desc" }]
        }
      }
    });
    if (!teacher) throw new NotFoundException("Teacher not found.");

    const workloads = await this.getTeacherWorkloadMap(tenantId, [teacher.id]);
    return {
      ...this.teacherView(teacher, workloads.get(teacher.id)),
      skills: teacher.skills.map((row) => this.skillView(row)),
      assignments: teacher.assignments.map((row) => this.assignmentView(row)),
      documents: teacher.documents.map((row) => this.documentView(row))
    };
  }

  async createTeacher(tenantId: string, actorUserId: string, payload: CreateTeacherDto): Promise<TeacherView> {
    await this.assertTeacherPayload(tenantId, payload);
    try {
      const created = await this.prisma.teacher.create({
        data: {
          tenantId,
          matricule: payload.matricule.trim(),
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          sex: payload.sex,
          birthDate: payload.birthDate ? this.toDateOnly(payload.birthDate) : null,
          primaryPhone: this.optionalTrim(payload.primaryPhone),
          secondaryPhone: this.optionalTrim(payload.secondaryPhone),
          email: this.optionalTrim(payload.email),
          address: this.optionalTrim(payload.address),
          photoUrl: this.optionalTrim(payload.photoUrl),
          nationality: this.optionalTrim(payload.nationality),
          identityDocumentType: this.optionalTrim(payload.identityDocumentType),
          identityDocumentNumber: this.optionalTrim(payload.identityDocumentNumber),
          hireDate: payload.hireDate ? this.toDateOnly(payload.hireDate) : null,
          teacherType: payload.teacherType,
          speciality: this.optionalTrim(payload.speciality),
          mainDiploma: this.optionalTrim(payload.mainDiploma),
          teachingLanguage: this.optionalTrim(payload.teachingLanguage),
          status: payload.status,
          establishmentId: payload.establishmentId,
          userId: payload.userId,
          internalNotes: this.optionalTrim(payload.internalNotes),
          archivedAt: payload.status === "ARCHIVED" ? new Date() : null,
          updatedAt: new Date()
        },
        include: { user: true }
      });
      await this.logAudit(tenantId, actorUserId, "TEACHER_CREATED", "teachers", created.id, {
        matricule: created.matricule,
        status: created.status
      });
      return this.teacherView(created, {
        assignmentsCount: 0,
        workloadHoursTotal: 0,
        francophoneWorkloadHoursTotal: 0,
        arabophoneWorkloadHoursTotal: 0
      });
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Teacher matricule, email or linked user already exists.");
      throw error;
    }
  }

  async updateTeacher(tenantId: string, actorUserId: string, id: string, payload: UpdateTeacherDto): Promise<TeacherView> {
    const existing = await this.requireTeacher(tenantId, id);
    await this.assertTeacherPayload(tenantId, payload, existing.id);
    try {
      const updated = await this.prisma.teacher.update({
        where: { id: existing.id },
        data: {
          matricule: payload.matricule?.trim(),
          firstName: payload.firstName?.trim(),
          lastName: payload.lastName?.trim(),
          sex: payload.sex,
          birthDate: payload.birthDate ? this.toDateOnly(payload.birthDate) : undefined,
          primaryPhone: payload.primaryPhone !== undefined ? this.optionalTrim(payload.primaryPhone) : undefined,
          secondaryPhone: payload.secondaryPhone !== undefined ? this.optionalTrim(payload.secondaryPhone) : undefined,
          email: payload.email !== undefined ? this.optionalTrim(payload.email) : undefined,
          address: payload.address !== undefined ? this.optionalTrim(payload.address) : undefined,
          photoUrl: payload.photoUrl !== undefined ? this.optionalTrim(payload.photoUrl) : undefined,
          nationality: payload.nationality !== undefined ? this.optionalTrim(payload.nationality) : undefined,
          identityDocumentType:
            payload.identityDocumentType !== undefined ? this.optionalTrim(payload.identityDocumentType) : undefined,
          identityDocumentNumber:
            payload.identityDocumentNumber !== undefined ? this.optionalTrim(payload.identityDocumentNumber) : undefined,
          hireDate: payload.hireDate ? this.toDateOnly(payload.hireDate) : undefined,
          teacherType: payload.teacherType,
          speciality: payload.speciality !== undefined ? this.optionalTrim(payload.speciality) : undefined,
          mainDiploma: payload.mainDiploma !== undefined ? this.optionalTrim(payload.mainDiploma) : undefined,
          teachingLanguage: payload.teachingLanguage !== undefined ? this.optionalTrim(payload.teachingLanguage) : undefined,
          status: payload.status,
          establishmentId: payload.establishmentId,
          userId: payload.userId,
          internalNotes: payload.internalNotes !== undefined ? this.optionalTrim(payload.internalNotes) : undefined,
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
      await this.logAudit(tenantId, actorUserId, "TEACHER_UPDATED", "teachers", updated.id, {
        matricule: updated.matricule,
        status: updated.status
      });
      const workloads = await this.getTeacherWorkloadMap(tenantId, [updated.id]);
      return this.teacherView(updated, workloads.get(updated.id));
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Teacher matricule, email or linked user already exists.");
      throw error;
    }
  }

  async archiveTeacher(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.requireTeacher(tenantId, id);
    await this.prisma.teacher.update({
      where: { id: existing.id },
      data: { status: "ARCHIVED", archivedAt: existing.archivedAt ?? new Date(), updatedAt: new Date() }
    });
    await this.logAudit(tenantId, actorUserId, "TEACHER_ARCHIVED", "teachers", existing.id, {
      matricule: existing.matricule
    });
  }

  async listSkills(tenantId: string, teacherId?: string): Promise<TeacherSkillView[]> {
    const rows = await this.prisma.teacherSkill.findMany({
      where: { tenantId, teacherId },
      include: { teacher: true, subject: true, cycle: true, level: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }]
    });
    return rows.map((row) => this.skillView(row));
  }

  async createSkill(tenantId: string, actorUserId: string, payload: CreateTeacherSkillDto): Promise<TeacherSkillView> {
    await this.assertSkillPayload(tenantId, payload);
    try {
      const created = await this.prisma.teacherSkill.create({
        data: {
          tenantId,
          teacherId: payload.teacherId,
          subjectId: payload.subjectId,
          track: payload.track,
          cycleId: payload.cycleId || null,
          levelId: payload.levelId || null,
          qualification: this.optionalTrim(payload.qualification),
          yearsExperience: payload.yearsExperience,
          priority: payload.priority,
          status: payload.status || "ACTIVE",
          comment: this.optionalTrim(payload.comment),
          updatedAt: new Date()
        },
        include: { teacher: true, subject: true, cycle: true, level: true }
      });
      await this.logAudit(tenantId, actorUserId, "TEACHER_SKILL_CREATED", "teacher_skills", created.id, {
        teacherId: created.teacherId,
        subjectId: created.subjectId,
        track: created.track
      });
      return this.skillView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Teacher skill already exists for this scope.");
      throw error;
    }
  }

  async updateSkill(tenantId: string, actorUserId: string, id: string, payload: UpdateTeacherSkillDto): Promise<TeacherSkillView> {
    const existing = await this.requireSkill(tenantId, id);
    await this.assertSkillPayload(
      tenantId,
      {
        teacherId: payload.teacherId ?? existing.teacherId,
        subjectId: payload.subjectId ?? existing.subjectId,
        track: payload.track ?? existing.track,
        cycleId: payload.cycleId ?? existing.cycleId ?? undefined,
        levelId: payload.levelId ?? existing.levelId ?? undefined,
        qualification: payload.qualification ?? existing.qualification ?? undefined,
        yearsExperience: payload.yearsExperience ?? existing.yearsExperience ?? undefined,
        priority: payload.priority ?? existing.priority ?? undefined,
        status: (payload.status ?? existing.status) as CreateTeacherSkillDto["status"],
        comment: payload.comment ?? existing.comment ?? undefined
      },
      existing.id
    );
    try {
      const updated = await this.prisma.teacherSkill.update({
        where: { id: existing.id },
        data: {
          teacherId: payload.teacherId,
          subjectId: payload.subjectId,
          track: payload.track,
          cycleId: payload.cycleId,
          levelId: payload.levelId,
          qualification: payload.qualification !== undefined ? this.optionalTrim(payload.qualification) : undefined,
          yearsExperience: payload.yearsExperience,
          priority: payload.priority,
          status: payload.status,
          comment: payload.comment !== undefined ? this.optionalTrim(payload.comment) : undefined,
          updatedAt: new Date()
        },
        include: { teacher: true, subject: true, cycle: true, level: true }
      });
      await this.logAudit(tenantId, actorUserId, "TEACHER_SKILL_UPDATED", "teacher_skills", updated.id);
      return this.skillView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Teacher skill already exists for this scope.");
      throw error;
    }
  }

  async deleteSkill(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.requireSkill(tenantId, id);
    await this.prisma.teacherSkill.delete({ where: { id: existing.id } });
    await this.logAudit(tenantId, actorUserId, "TEACHER_SKILL_DELETED", "teacher_skills", existing.id);
  }

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
      include: this.assignmentInclude(),
      orderBy: [{ schoolYear: { code: "desc" } }, { classroom: { label: "asc" } }, { subject: { label: "asc" } }]
    });
    return rows.map((row) => this.assignmentView(row));
  }

  async createAssignment(
    tenantId: string,
    actorUserId: string,
    payload: CreateTeacherAssignmentDto
  ): Promise<TeacherAssignmentView> {
    await this.assertAssignmentPayload(tenantId, payload);
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
          role: this.optionalTrim(payload.role),
          startDate: this.toDateOnly(payload.startDate),
          endDate: payload.endDate ? this.toDateOnly(payload.endDate) : null,
          status: payload.status || "ACTIVE",
          comment: this.optionalTrim(payload.comment),
          updatedAt: new Date()
        },
        include: this.assignmentInclude()
      });
      await this.logAudit(tenantId, actorUserId, "TEACHER_ASSIGNMENT_CREATED", "teacher_assignments", created.id, {
        teacherId: created.teacherId,
        classId: created.classId,
        subjectId: created.subjectId,
        track: created.track
      });
      return this.assignmentView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Teacher assignment already exists for this class, subject, school year and curriculum.");
      throw error;
    }
  }

  async updateAssignment(
    tenantId: string,
    actorUserId: string,
    id: string,
    payload: UpdateTeacherAssignmentDto
  ): Promise<TeacherAssignmentView> {
    const existing = await this.requireAssignment(tenantId, id);
    await this.assertAssignmentPayload(
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
          role: payload.role !== undefined ? this.optionalTrim(payload.role) : undefined,
          startDate: payload.startDate ? this.toDateOnly(payload.startDate) : undefined,
          endDate: payload.endDate ? this.toDateOnly(payload.endDate) : undefined,
          status: payload.status,
          comment: payload.comment !== undefined ? this.optionalTrim(payload.comment) : undefined,
          updatedAt: new Date()
        },
        include: this.assignmentInclude()
      });
      await this.logAudit(tenantId, actorUserId, "TEACHER_ASSIGNMENT_UPDATED", "teacher_assignments", updated.id);
      return this.assignmentView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Teacher assignment already exists for this class, subject, school year and curriculum.");
      throw error;
    }
  }

  async archiveAssignment(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.requireAssignment(tenantId, id);
    await this.prisma.teacherAssignment.update({
      where: { id: existing.id },
      data: { status: "ARCHIVED", updatedAt: new Date() }
    });
    await this.logAudit(tenantId, actorUserId, "TEACHER_ASSIGNMENT_ARCHIVED", "teacher_assignments", existing.id);
  }

  async listDocuments(tenantId: string, teacherId?: string): Promise<TeacherDocumentView[]> {
    const rows = await this.prisma.teacherDocument.findMany({
      where: { tenantId, teacherId, status: { not: "ARCHIVED" } },
      include: { teacher: true, uploadedByUser: true },
      orderBy: [{ uploadedAt: "desc" }]
    });
    return rows.map((row) => this.documentView(row));
  }

  async createDocument(
    tenantId: string,
    actorUserId: string,
    payload: CreateTeacherDocumentDto
  ): Promise<TeacherDocumentView> {
    await this.requireTeacher(tenantId, payload.teacherId);
    const created = await this.prisma.teacherDocument.create({
      data: {
        tenantId,
        teacherId: payload.teacherId,
        documentType: payload.documentType,
        fileUrl: payload.fileUrl.trim(),
        originalName: payload.originalName.trim(),
        mimeType: this.optionalTrim(payload.mimeType),
        size: payload.size,
        uploadedBy: actorUserId,
        status: payload.status || "ACTIVE"
      },
      include: { teacher: true, uploadedByUser: true }
    });
    await this.logAudit(tenantId, actorUserId, "TEACHER_DOCUMENT_CREATED", "teacher_documents", created.id, {
      teacherId: created.teacherId,
      documentType: created.documentType
    });
    return this.documentView(created);
  }

  async updateDocument(
    tenantId: string,
    actorUserId: string,
    id: string,
    payload: UpdateTeacherDocumentDto
  ): Promise<TeacherDocumentView> {
    const existing = await this.requireDocument(tenantId, id);
    if (payload.teacherId) await this.requireTeacher(tenantId, payload.teacherId);
    const updated = await this.prisma.teacherDocument.update({
      where: { id: existing.id },
      data: {
        teacherId: payload.teacherId,
        documentType: payload.documentType,
        fileUrl: payload.fileUrl?.trim(),
        originalName: payload.originalName?.trim(),
        mimeType: payload.mimeType !== undefined ? this.optionalTrim(payload.mimeType) : undefined,
        size: payload.size,
        status: payload.status,
        archivedAt:
          payload.status === "ARCHIVED"
            ? existing.archivedAt ?? new Date()
            : payload.status
              ? null
              : undefined
      },
      include: { teacher: true, uploadedByUser: true }
    });
    await this.logAudit(tenantId, actorUserId, "TEACHER_DOCUMENT_UPDATED", "teacher_documents", updated.id);
    return this.documentView(updated);
  }

  async archiveDocument(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.requireDocument(tenantId, id);
    await this.prisma.teacherDocument.update({
      where: { id: existing.id },
      data: { status: "ARCHIVED", archivedAt: existing.archivedAt ?? new Date() }
    });
    await this.logAudit(tenantId, actorUserId, "TEACHER_DOCUMENT_ARCHIVED", "teacher_documents", existing.id);
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
        teacherName: this.teacherName(teacher),
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

  private async assertTeacherPayload(
    tenantId: string,
    payload: Partial<CreateTeacherDto>,
    ignoreId?: string
  ): Promise<void> {
    if (payload.userId) {
      const user = await this.prisma.user.findFirst({
        where: { id: payload.userId, tenantId, deletedAt: null }
      });
      if (!user || user.role !== UserRole.ENSEIGNANT) {
        throw new ConflictException("Linked user must exist and have ENSEIGNANT role.");
      }
    }

    if (payload.email?.trim()) {
      const duplicate = await this.prisma.teacher.findFirst({
        where: {
          tenantId,
          id: ignoreId ? { not: ignoreId } : undefined,
          email: payload.email.trim()
        }
      });
      if (duplicate) throw new ConflictException("Teacher email already exists for this establishment.");
    }

    if (payload.matricule?.trim()) {
      const duplicate = await this.prisma.teacher.findFirst({
        where: {
          tenantId,
          id: ignoreId ? { not: ignoreId } : undefined,
          matricule: payload.matricule.trim()
        }
      });
      if (duplicate) throw new ConflictException("Teacher matricule already exists for this establishment.");
    }
  }

  private async assertSkillPayload(
    tenantId: string,
    payload: CreateTeacherSkillDto,
    ignoreId?: string
  ): Promise<void> {
    await this.requireTeacher(tenantId, payload.teacherId);
    const subject = await this.requireSubject(tenantId, payload.subjectId);
    const cycle = payload.cycleId ? await this.requireCycle(tenantId, payload.cycleId) : undefined;
    const level = payload.levelId ? await this.requireLevel(tenantId, payload.levelId) : undefined;

    if (cycle && level && level.cycleId !== cycle.id) {
      throw new ConflictException("Teacher skill level must belong to the selected cycle.");
    }
    if (level && level.track !== payload.track) {
      throw new ConflictException("Teacher skill level must match the selected curriculum.");
    }
    this.assertSubjectMatchesTrack(subject, payload.track, "Teacher skill subject must match the selected curriculum.");

    const duplicate = await this.prisma.teacherSkill.findFirst({
      where: {
        tenantId,
        id: ignoreId ? { not: ignoreId } : undefined,
        teacherId: payload.teacherId,
        subjectId: payload.subjectId,
        track: payload.track,
        cycleId: payload.cycleId || null,
        levelId: payload.levelId || null
      }
    });
    if (duplicate) throw new ConflictException("Teacher skill already exists for this subject and scope.");
  }

  private async assertAssignmentPayload(
    tenantId: string,
    payload: CreateTeacherAssignmentDto,
    ignoreId?: string
  ): Promise<void> {
    const teacher = await this.requireTeacher(tenantId, payload.teacherId);
    if (teacher.status !== "ACTIVE" || teacher.archivedAt) {
      throw new ConflictException("Teacher must be active before being assigned.");
    }

    const [schoolYear, classroom, subject] = await Promise.all([
      this.requireSchoolYear(tenantId, payload.schoolYearId),
      this.requireClassroomWithLevel(tenantId, payload.classId),
      this.requireSubject(tenantId, payload.subjectId)
    ]);

    if (classroom.schoolYearId !== schoolYear.id) {
      throw new ConflictException("Class must belong to the selected school year.");
    }
    this.assertSubjectMatchesTrack(subject, payload.track, "Teacher assignment subject must match the selected curriculum.");

    if (payload.periodId) {
      const period = await this.requirePeriod(tenantId, payload.periodId);
      if (period.schoolYearId !== schoolYear.id) {
        throw new ConflictException("Academic period must belong to the selected school year.");
      }
    }

    const startDate = this.toDateOnly(payload.startDate);
    const endDate = payload.endDate ? this.toDateOnly(payload.endDate) : undefined;
    if (endDate && endDate <= startDate) {
      throw new BadRequestException("Teacher assignment end date must be after start date.");
    }
    if (startDate < schoolYear.startDate || startDate > schoolYear.endDate) {
      throw new ConflictException("Teacher assignment start date must stay within the school year.");
    }
    if (endDate && (endDate < schoolYear.startDate || endDate > schoolYear.endDate)) {
      throw new ConflictException("Teacher assignment end date must stay within the school year.");
    }

    await this.assertSubjectCompatibleWithClass(tenantId, subject.id, classroom.levelId);
    await this.assertTeacherHasSkill(tenantId, teacher.id, subject.id, payload.track, classroom.levelId, classroom.level.cycleId);

    if ((payload.isHomeroomTeacher ?? false) && (payload.status ?? "ACTIVE") === "ACTIVE") {
      const existingHomeroom = await this.prisma.teacherAssignment.findFirst({
        where: {
          tenantId,
          id: ignoreId ? { not: ignoreId } : undefined,
          schoolYearId: schoolYear.id,
          classId: classroom.id,
          track: payload.track,
          isHomeroomTeacher: true,
          status: "ACTIVE"
        }
      });
      if (existingHomeroom) {
        throw new ConflictException("This class already has an active homeroom teacher for the school year.");
      }
    }
  }

  private async assertSubjectCompatibleWithClass(
    tenantId: string,
    subjectId: string,
    classLevelId: string
  ): Promise<void> {
    const scopes = await this.prisma.subjectLevelScope.findMany({
      where: { tenantId, subjectId },
      select: { levelId: true }
    });
    if (scopes.length > 0 && !scopes.some((scope) => scope.levelId === classLevelId)) {
      throw new ConflictException("Subject is not configured for the class level.");
    }
  }

  private async assertTeacherHasSkill(
    tenantId: string,
    teacherId: string,
    subjectId: string,
    track: AcademicTrack,
    levelId: string,
    cycleId: string
  ): Promise<void> {
    const skill = await this.prisma.teacherSkill.findFirst({
      where: {
        tenantId,
        teacherId,
        subjectId,
        track,
        status: "ACTIVE",
        OR: [{ levelId }, { levelId: null, cycleId }, { levelId: null, cycleId: null }]
      }
    });
    if (!skill) {
      throw new ConflictException("Teacher must have an active skill for this subject and class scope before assignment.");
    }
  }

  private assertSubjectMatchesTrack(
    subject: { nature: string },
    track: AcademicTrack,
    message: string
  ): void {
    if (
      (subject.nature === AcademicTrack.FRANCOPHONE || subject.nature === AcademicTrack.ARABOPHONE) &&
      subject.nature !== track
    ) {
      throw new ConflictException(message);
    }
  }

  private async requireTeacher(tenantId: string, id: string): Promise<Teacher> {
    const row = await this.prisma.teacher.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Teacher not found.");
    return row;
  }

  private async requireSkill(tenantId: string, id: string): Promise<TeacherSkill> {
    const row = await this.prisma.teacherSkill.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Teacher skill not found.");
    return row;
  }

  private async requireAssignment(tenantId: string, id: string): Promise<TeacherAssignment> {
    const row = await this.prisma.teacherAssignment.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Teacher assignment not found.");
    return row;
  }

  private async requireDocument(tenantId: string, id: string): Promise<TeacherDocument> {
    const row = await this.prisma.teacherDocument.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Teacher document not found.");
    return row;
  }

  private async requireSchoolYear(tenantId: string, id: string) {
    const row = await this.prisma.schoolYear.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("School year not found.");
    return row;
  }

  private async requireCycle(tenantId: string, id: string) {
    const row = await this.prisma.cycle.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Cycle not found.");
    return row;
  }

  private async requireLevel(tenantId: string, id: string) {
    const row = await this.prisma.level.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Level not found.");
    return row;
  }

  private async requireClassroomWithLevel(tenantId: string, id: string) {
    const row = await this.prisma.classroom.findFirst({
      where: { id, tenantId },
      include: { level: { include: { cycle: true } } }
    });
    if (!row) throw new NotFoundException("Class not found.");
    return row;
  }

  private async requireSubject(tenantId: string, id: string) {
    const row = await this.prisma.subject.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Subject not found.");
    return row;
  }

  private async requirePeriod(tenantId: string, id: string) {
    const row = await this.prisma.academicPeriod.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Academic period not found.");
    return row;
  }

  private async getTeacherWorkloadMap(
    tenantId: string,
    teacherIds: string[]
  ): Promise<Map<string, {
    assignmentsCount: number;
    workloadHoursTotal: number;
    francophoneWorkloadHoursTotal: number;
    arabophoneWorkloadHoursTotal: number;
  }>> {
    if (teacherIds.length === 0) return new Map();
    const rows = await this.prisma.teacherAssignment.groupBy({
      by: ["teacherId", "track"],
      where: { tenantId, teacherId: { in: teacherIds }, status: "ACTIVE" },
      _count: { _all: true },
      _sum: { workloadHours: true }
    });
    const workloads = new Map<string, {
      assignmentsCount: number;
      workloadHoursTotal: number;
      francophoneWorkloadHoursTotal: number;
      arabophoneWorkloadHoursTotal: number;
    }>();
    for (const row of rows) {
      const current = workloads.get(row.teacherId) ?? {
        assignmentsCount: 0,
        workloadHoursTotal: 0,
        francophoneWorkloadHoursTotal: 0,
        arabophoneWorkloadHoursTotal: 0
      };
      const hours = row._sum.workloadHours === null ? 0 : Number(row._sum.workloadHours);
      current.assignmentsCount += row._count._all;
      current.workloadHoursTotal += hours;
      if (row.track === AcademicTrack.ARABOPHONE) {
        current.arabophoneWorkloadHoursTotal += hours;
      } else {
        current.francophoneWorkloadHoursTotal += hours;
      }
      workloads.set(row.teacherId, current);
    }
    return workloads;
  }

  private assignmentInclude() {
    return {
      teacher: true,
      schoolYear: true,
      classroom: { include: { level: { include: { cycle: true } } } },
      subject: true,
      academicPeriod: true
    } satisfies Prisma.TeacherAssignmentInclude;
  }

  private teacherView(
    row: TeacherWithUser,
    workload?: {
      assignmentsCount: number;
      workloadHoursTotal: number;
      francophoneWorkloadHoursTotal: number;
      arabophoneWorkloadHoursTotal: number;
    }
  ): TeacherView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      matricule: row.matricule,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: this.teacherName(row),
      sex: row.sex || undefined,
      birthDate: this.formatDate(row.birthDate),
      primaryPhone: row.primaryPhone || undefined,
      secondaryPhone: row.secondaryPhone || undefined,
      email: row.email || undefined,
      address: row.address || undefined,
      photoUrl: row.photoUrl || undefined,
      nationality: row.nationality || undefined,
      identityDocumentType: row.identityDocumentType || undefined,
      identityDocumentNumber: row.identityDocumentNumber || undefined,
      hireDate: this.formatDate(row.hireDate),
      teacherType: row.teacherType,
      speciality: row.speciality || undefined,
      mainDiploma: row.mainDiploma || undefined,
      teachingLanguage: row.teachingLanguage || undefined,
      status: row.status,
      establishmentId: row.establishmentId || undefined,
      userId: row.userId || undefined,
      userUsername: row.user?.username,
      internalNotes: row.internalNotes || undefined,
      archivedAt: row.archivedAt?.toISOString(),
      activeAssignmentsCount: workload?.assignmentsCount ?? 0,
      workloadHoursTotal: workload?.workloadHoursTotal ?? 0,
      francophoneWorkloadHoursTotal: workload?.francophoneWorkloadHoursTotal ?? 0,
      arabophoneWorkloadHoursTotal: workload?.arabophoneWorkloadHoursTotal ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private skillView(row: SkillWithRelations): TeacherSkillView {
    return {
      id: row.id,
      teacherId: row.teacherId,
      teacherName: this.teacherName(row.teacher),
      subjectId: row.subjectId,
      subjectLabel: row.subject.label,
      track: row.track,
      cycleId: row.cycleId || undefined,
      cycleLabel: row.cycle?.label,
      levelId: row.levelId || undefined,
      levelLabel: row.level?.label,
      qualification: row.qualification || undefined,
      yearsExperience: row.yearsExperience ?? undefined,
      priority: row.priority ?? undefined,
      status: row.status,
      comment: row.comment || undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private assignmentView(row: AssignmentWithRelations): TeacherAssignmentView {
    return {
      id: row.id,
      teacherId: row.teacherId,
      teacherName: this.teacherName(row.teacher),
      schoolYearId: row.schoolYearId,
      schoolYearCode: row.schoolYear.code,
      classId: row.classId,
      classLabel: row.classroom.label,
      levelId: row.classroom.levelId,
      levelLabel: row.classroom.level.label,
      subjectId: row.subjectId,
      subjectLabel: row.subject.label,
      track: row.track,
      periodId: row.periodId || undefined,
      periodLabel: row.academicPeriod?.label,
      workloadHours: row.workloadHours === null ? undefined : Number(row.workloadHours),
      coefficient: row.coefficient === null ? undefined : Number(row.coefficient),
      isHomeroomTeacher: row.isHomeroomTeacher,
      role: row.role || undefined,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: this.formatDate(row.endDate),
      status: row.status,
      comment: row.comment || undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private documentView(row: DocumentWithRelations): TeacherDocumentView {
    return {
      id: row.id,
      teacherId: row.teacherId,
      teacherName: this.teacherName(row.teacher),
      documentType: row.documentType,
      fileUrl: row.fileUrl,
      originalName: row.originalName,
      mimeType: row.mimeType || undefined,
      size: row.size ?? undefined,
      uploadedAt: row.uploadedAt.toISOString(),
      uploadedBy: row.uploadedBy || undefined,
      uploadedByUsername: row.uploadedByUser?.username,
      status: row.status,
      archivedAt: row.archivedAt?.toISOString()
    };
  }

  private teacherName(row: Pick<Teacher, "firstName" | "lastName">): string {
    return `${row.firstName} ${row.lastName}`.trim();
  }

  private toDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private formatDate(value?: Date | null): string | undefined {
    return value ? value.toISOString().slice(0, 10) : undefined;
  }

  private optionalTrim(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private async logAudit(
    tenantId: string,
    actorUserId: string,
    action: string,
    resource: string,
    resourceId?: string,
    payload?: Prisma.InputJsonValue
  ): Promise<void> {
    await this.auditService.enqueueLog({
      tenantId,
      userId: actorUserId,
      action,
      resource,
      resourceId,
      payload
    });
  }

  private handleKnownPrismaConflict(error: unknown, message: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(message);
    }
  }
}
