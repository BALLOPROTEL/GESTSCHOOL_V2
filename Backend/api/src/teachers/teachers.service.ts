import { Injectable } from "@nestjs/common";
import { AcademicTrack } from "@prisma/client";

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
import { TeachersAssignmentsService } from "./teachers-assignments.service";
import { TeachersDirectoryService } from "./teachers-directory.service";
import { TeachersDocumentsService } from "./teachers-documents.service";
import { TeachersSkillsService } from "./teachers-skills.service";
import { type AssignmentFilters, type TeacherFilters } from "./teachers.types";

@Injectable()
export class TeachersService {
  constructor(
    private readonly teachersDirectoryService: TeachersDirectoryService,
    private readonly teachersSkillsService: TeachersSkillsService,
    private readonly teachersAssignmentsService: TeachersAssignmentsService,
    private readonly teachersDocumentsService: TeachersDocumentsService
  ) {}

  listTeachers(tenantId: string, filters: TeacherFilters = {}) {
    return this.teachersDirectoryService.listTeachers(tenantId, filters);
  }

  getTeacherDetail(tenantId: string, id: string) {
    return this.teachersDirectoryService.getTeacherDetail(tenantId, id);
  }

  createTeacher(tenantId: string, actorUserId: string, payload: CreateTeacherDto) {
    return this.teachersDirectoryService.createTeacher(tenantId, actorUserId, payload);
  }

  updateTeacher(tenantId: string, actorUserId: string, id: string, payload: UpdateTeacherDto) {
    return this.teachersDirectoryService.updateTeacher(tenantId, actorUserId, id, payload);
  }

  archiveTeacher(tenantId: string, actorUserId: string, id: string) {
    return this.teachersDirectoryService.archiveTeacher(tenantId, actorUserId, id);
  }

  listSkills(tenantId: string, teacherId?: string) {
    return this.teachersSkillsService.listSkills(tenantId, teacherId);
  }

  createSkill(tenantId: string, actorUserId: string, payload: CreateTeacherSkillDto) {
    return this.teachersSkillsService.createSkill(tenantId, actorUserId, payload);
  }

  updateSkill(tenantId: string, actorUserId: string, id: string, payload: UpdateTeacherSkillDto) {
    return this.teachersSkillsService.updateSkill(tenantId, actorUserId, id, payload);
  }

  deleteSkill(tenantId: string, actorUserId: string, id: string) {
    return this.teachersSkillsService.deleteSkill(tenantId, actorUserId, id);
  }

  listAssignments(tenantId: string, filters: AssignmentFilters = {}) {
    return this.teachersAssignmentsService.listAssignments(tenantId, filters);
  }

  createAssignment(tenantId: string, actorUserId: string, payload: CreateTeacherAssignmentDto) {
    return this.teachersAssignmentsService.createAssignment(tenantId, actorUserId, payload);
  }

  updateAssignment(tenantId: string, actorUserId: string, id: string, payload: UpdateTeacherAssignmentDto) {
    return this.teachersAssignmentsService.updateAssignment(tenantId, actorUserId, id, payload);
  }

  archiveAssignment(tenantId: string, actorUserId: string, id: string) {
    return this.teachersAssignmentsService.archiveAssignment(tenantId, actorUserId, id);
  }

  listDocuments(tenantId: string, teacherId?: string) {
    return this.teachersDocumentsService.listDocuments(tenantId, teacherId);
  }

  createDocument(tenantId: string, actorUserId: string, payload: CreateTeacherDocumentDto) {
    return this.teachersDocumentsService.createDocument(tenantId, actorUserId, payload);
  }

  updateDocument(tenantId: string, actorUserId: string, id: string, payload: UpdateTeacherDocumentDto) {
    return this.teachersDocumentsService.updateDocument(tenantId, actorUserId, id, payload);
  }

  archiveDocument(tenantId: string, actorUserId: string, id: string) {
    return this.teachersDocumentsService.archiveDocument(tenantId, actorUserId, id);
  }

  listWorkloads(tenantId: string, schoolYearId?: string, track?: AcademicTrack) {
    return this.teachersDirectoryService.listWorkloads(tenantId, schoolYearId, track);
  }
}
