import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AcademicTrack,
  Prisma
} from "@prisma/client";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { UserRole } from "../security/roles.enum";
import {
  CreateTeacherAssignmentDto,
  CreateTeacherDto,
  CreateTeacherSkillDto
} from "./dto/teachers.dto";
import {
  type AssignmentWithRelations,
  type DocumentWithRelations,
  type SkillWithRelations,
  type TeacherAssignmentEntity,
  type TeacherAssignmentView,
  type TeacherDocumentEntity,
  type TeacherDocumentView,
  type TeacherEntity,
  type TeacherScopedUser,
  type TeacherSkillEntity,
  type TeacherSkillView,
  type TeacherView,
  type TeacherWithUser,
  type TeacherWorkloadTotals
} from "./teachers.types";

@Injectable()
export class TeachersSupportService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async assertTeacherPayload(
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

  async assertSkillPayload(
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

  async assertAssignmentPayload(
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

  async assertSubjectCompatibleWithClass(
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

  async assertTeacherHasSkill(
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

  assertSubjectMatchesTrack(
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

  async requireTeacher(tenantId: string, id: string): Promise<TeacherEntity> {
    const row = await this.prisma.teacher.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Teacher not found.");
    return row;
  }

  async requireSkill(tenantId: string, id: string): Promise<TeacherSkillEntity> {
    const row = await this.prisma.teacherSkill.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Teacher skill not found.");
    return row;
  }

  async requireAssignment(tenantId: string, id: string): Promise<TeacherAssignmentEntity> {
    const row = await this.prisma.teacherAssignment.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Teacher assignment not found.");
    return row;
  }

  async requireDocument(tenantId: string, id: string): Promise<TeacherDocumentEntity> {
    const row = await this.prisma.teacherDocument.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Teacher document not found.");
    return row;
  }

  async requireSchoolYear(tenantId: string, id: string) {
    const row = await this.prisma.schoolYear.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("School year not found.");
    return row;
  }

  async requireCycle(tenantId: string, id: string) {
    const row = await this.prisma.cycle.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Cycle not found.");
    return row;
  }

  async requireLevel(tenantId: string, id: string) {
    const row = await this.prisma.level.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Level not found.");
    return row;
  }

  async requireClassroomWithLevel(tenantId: string, id: string) {
    const row = await this.prisma.classroom.findFirst({
      where: { id, tenantId },
      include: { level: { include: { cycle: true } } }
    });
    if (!row) throw new NotFoundException("Class not found.");
    return row;
  }

  async requireSubject(tenantId: string, id: string) {
    const row = await this.prisma.subject.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Subject not found.");
    return row;
  }

  async requirePeriod(tenantId: string, id: string) {
    const row = await this.prisma.academicPeriod.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Academic period not found.");
    return row;
  }

  async getTeacherWorkloadMap(
    tenantId: string,
    teacherIds: string[]
  ): Promise<Map<string, TeacherWorkloadTotals>> {
    if (teacherIds.length === 0) return new Map();
    const rows = await this.prisma.teacherAssignment.groupBy({
      by: ["teacherId", "track"],
      where: { tenantId, teacherId: { in: teacherIds }, status: "ACTIVE" },
      _count: { _all: true },
      _sum: { workloadHours: true }
    });
    const workloads = new Map<string, TeacherWorkloadTotals>();
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

  assignmentInclude() {
    return {
      teacher: true,
      schoolYear: true,
      classroom: { include: { level: { include: { cycle: true } } } },
      subject: true,
      academicPeriod: true
    } satisfies Prisma.TeacherAssignmentInclude;
  }

  teacherView(
    row: TeacherWithUser,
    workload?: TeacherWorkloadTotals
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

  skillView(row: SkillWithRelations): TeacherSkillView {
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

  assignmentView(row: AssignmentWithRelations): TeacherAssignmentView {
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

  documentView(row: DocumentWithRelations): TeacherDocumentView {
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

  teacherName(row: TeacherScopedUser): string {
    return `${row.firstName} ${row.lastName}`.trim();
  }

  toDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  formatDate(value?: Date | null): string | undefined {
    return value ? value.toISOString().slice(0, 10) : undefined;
  }

  optionalTrim(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  async logAudit(
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

  handleKnownPrismaConflict(error: unknown, message: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(message);
    }
  }
}
