import { Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import {
  CreateTeacherSkillDto,
  UpdateTeacherSkillDto
} from "./dto/teachers.dto";
import { TeachersSupportService } from "./teachers-support.service";
import { type TeacherSkillView } from "./teachers.types";

@Injectable()
export class TeachersSkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teachersSupportService: TeachersSupportService
  ) {}

  async listSkills(tenantId: string, teacherId?: string): Promise<TeacherSkillView[]> {
    const rows = await this.prisma.teacherSkill.findMany({
      where: { tenantId, teacherId },
      include: { teacher: true, subject: true, cycle: true, level: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }]
    });
    return rows.map((row) => this.teachersSupportService.skillView(row));
  }

  async createSkill(tenantId: string, actorUserId: string, payload: CreateTeacherSkillDto): Promise<TeacherSkillView> {
    await this.teachersSupportService.assertSkillPayload(tenantId, payload);
    try {
      const created = await this.prisma.teacherSkill.create({
        data: {
          tenantId,
          teacherId: payload.teacherId,
          subjectId: payload.subjectId,
          track: payload.track,
          cycleId: payload.cycleId || null,
          levelId: payload.levelId || null,
          qualification: this.teachersSupportService.optionalTrim(payload.qualification),
          yearsExperience: payload.yearsExperience,
          priority: payload.priority,
          status: payload.status || "ACTIVE",
          comment: this.teachersSupportService.optionalTrim(payload.comment),
          updatedAt: new Date()
        },
        include: { teacher: true, subject: true, cycle: true, level: true }
      });
      await this.teachersSupportService.logAudit(tenantId, actorUserId, "TEACHER_SKILL_CREATED", "teacher_skills", created.id, {
        teacherId: created.teacherId,
        subjectId: created.subjectId,
        track: created.track
      });
      return this.teachersSupportService.skillView(created);
    } catch (error: unknown) {
      this.teachersSupportService.handleKnownPrismaConflict(error, "Teacher skill already exists for this scope.");
      throw error;
    }
  }

  async updateSkill(tenantId: string, actorUserId: string, id: string, payload: UpdateTeacherSkillDto): Promise<TeacherSkillView> {
    const existing = await this.teachersSupportService.requireSkill(tenantId, id);
    await this.teachersSupportService.assertSkillPayload(
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
          qualification: payload.qualification !== undefined ? this.teachersSupportService.optionalTrim(payload.qualification) : undefined,
          yearsExperience: payload.yearsExperience,
          priority: payload.priority,
          status: payload.status,
          comment: payload.comment !== undefined ? this.teachersSupportService.optionalTrim(payload.comment) : undefined,
          updatedAt: new Date()
        },
        include: { teacher: true, subject: true, cycle: true, level: true }
      });
      await this.teachersSupportService.logAudit(tenantId, actorUserId, "TEACHER_SKILL_UPDATED", "teacher_skills", updated.id);
      return this.teachersSupportService.skillView(updated);
    } catch (error: unknown) {
      this.teachersSupportService.handleKnownPrismaConflict(error, "Teacher skill already exists for this scope.");
      throw error;
    }
  }

  async deleteSkill(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.teachersSupportService.requireSkill(tenantId, id);
    await this.prisma.teacherSkill.delete({ where: { id: existing.id } });
    await this.teachersSupportService.logAudit(tenantId, actorUserId, "TEACHER_SKILL_DELETED", "teacher_skills", existing.id);
  }
}
