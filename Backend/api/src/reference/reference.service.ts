import { Injectable } from "@nestjs/common";
import { AcademicTrack, Prisma } from "@prisma/client";

import { AcademicStructureService } from "../academic-structure/academic-structure.service";
import {
  CreateAcademicPeriodDto,
  CreateClassroomDto,
  CreateCycleDto,
  CreateLevelDto,
  CreatePedagogicalRuleDto,
  CreateSchoolYearDto,
  CreateSubjectDto,
  UpdateAcademicPeriodDto,
  UpdateClassroomDto,
  UpdateCycleDto,
  UpdateLevelDto,
  UpdateSchoolYearDto,
  UpdateSubjectDto
} from "./dto/reference.dto";
import { ReferenceCatalogService } from "./reference-catalog.service";
import { ReferenceHierarchyService } from "./reference-hierarchy.service";
import { ReferenceSchoolYearsService } from "./reference-school-years.service";

@Injectable()
export class ReferenceService {
  constructor(
    private readonly academicStructureService: AcademicStructureService,
    private readonly catalogService: ReferenceCatalogService,
    private readonly hierarchyService: ReferenceHierarchyService,
    private readonly schoolYearsService: ReferenceSchoolYearsService
  ) {}

  listSchoolYears(tenantId: string) {
    return this.schoolYearsService.listSchoolYears(tenantId);
  }

  createSchoolYear(tenantId: string, payload: CreateSchoolYearDto) {
    return this.schoolYearsService.createSchoolYear(tenantId, payload);
  }

  updateSchoolYear(tenantId: string, id: string, payload: UpdateSchoolYearDto) {
    return this.schoolYearsService.updateSchoolYear(tenantId, id, payload);
  }

  deleteSchoolYear(tenantId: string, id: string): Promise<void> {
    return this.schoolYearsService.deleteSchoolYear(tenantId, id);
  }

  listCycles(tenantId: string) {
    return this.hierarchyService.listCycles(tenantId);
  }

  createCycle(tenantId: string, payload: CreateCycleDto) {
    return this.hierarchyService.createCycle(tenantId, payload);
  }

  updateCycle(tenantId: string, id: string, payload: UpdateCycleDto) {
    return this.hierarchyService.updateCycle(tenantId, id, payload);
  }

  deleteCycle(tenantId: string, id: string): Promise<void> {
    return this.hierarchyService.deleteCycle(tenantId, id);
  }

  listLevels(tenantId: string, cycleId?: string, track?: string) {
    return this.hierarchyService.listLevels(tenantId, cycleId, track);
  }

  createLevel(tenantId: string, payload: CreateLevelDto) {
    return this.hierarchyService.createLevel(tenantId, payload);
  }

  updateLevel(tenantId: string, id: string, payload: UpdateLevelDto) {
    return this.hierarchyService.updateLevel(tenantId, id, payload);
  }

  deleteLevel(tenantId: string, id: string): Promise<void> {
    return this.hierarchyService.deleteLevel(tenantId, id);
  }

  listClassrooms(
    tenantId: string,
    filters: { schoolYearId?: string; levelId?: string; track?: string }
  ) {
    return this.hierarchyService.listClassrooms(tenantId, filters);
  }

  createClassroom(tenantId: string, payload: CreateClassroomDto) {
    return this.hierarchyService.createClassroom(tenantId, payload);
  }

  updateClassroom(tenantId: string, id: string, payload: UpdateClassroomDto) {
    return this.hierarchyService.updateClassroom(tenantId, id, payload);
  }

  deleteClassroom(tenantId: string, id: string): Promise<void> {
    return this.hierarchyService.deleteClassroom(tenantId, id);
  }

  listSubjects(tenantId: string) {
    return this.catalogService.listSubjects(tenantId);
  }

  createSubject(tenantId: string, payload: CreateSubjectDto) {
    return this.catalogService.createSubject(tenantId, payload);
  }

  updateSubject(tenantId: string, id: string, payload: UpdateSubjectDto) {
    return this.catalogService.updateSubject(tenantId, id, payload);
  }

  deleteSubject(tenantId: string, id: string): Promise<void> {
    return this.catalogService.deleteSubject(tenantId, id);
  }

  listAcademicPeriods(tenantId: string, schoolYearId?: string) {
    return this.catalogService.listAcademicPeriods(tenantId, schoolYearId);
  }

  createAcademicPeriod(tenantId: string, payload: CreateAcademicPeriodDto) {
    return this.catalogService.createAcademicPeriod(tenantId, payload);
  }

  updateAcademicPeriod(
    tenantId: string,
    id: string,
    payload: UpdateAcademicPeriodDto
  ) {
    return this.catalogService.updateAcademicPeriod(tenantId, id, payload);
  }

  deleteAcademicPeriod(tenantId: string, id: string): Promise<void> {
    return this.catalogService.deleteAcademicPeriod(tenantId, id);
  }

  listAcademicTracks(): Array<{ code: AcademicTrack; label: string }> {
    return [
      { code: AcademicTrack.FRANCOPHONE, label: "Francophone" },
      { code: AcademicTrack.ARABOPHONE, label: "Arabophone" }
    ];
  }

  listPedagogicalRules(
    tenantId: string,
    filters: {
      schoolYearId?: string;
      cycleId?: string;
      levelId?: string;
      classId?: string;
      ruleType?: string;
      track?: string;
    }
  ) {
    return this.academicStructureService.listPedagogicalRules(tenantId, filters);
  }

  createPedagogicalRule(tenantId: string, payload: CreatePedagogicalRuleDto) {
    return this.academicStructureService.createPedagogicalRule(tenantId, {
      ...payload,
      config: payload.config as Prisma.InputJsonValue
    });
  }

  deletePedagogicalRule(tenantId: string, id: string): Promise<void> {
    return this.academicStructureService.deletePedagogicalRule(tenantId, id);
  }

  requireSchoolYear(tenantId: string, id: string) {
    return this.schoolYearsService.requireSchoolYear(tenantId, id);
  }

  requireCycle(tenantId: string, id: string) {
    return this.hierarchyService.requireCycle(tenantId, id);
  }

  requireLevel(tenantId: string, id: string) {
    return this.hierarchyService.requireLevel(tenantId, id);
  }

  requireClassroom(tenantId: string, id: string) {
    return this.hierarchyService.requireClassroom(tenantId, id);
  }

  requireSubject(tenantId: string, id: string) {
    return this.catalogService.requireSubject(tenantId, id);
  }

  requireAcademicPeriod(tenantId: string, id: string) {
    return this.catalogService.requireAcademicPeriod(tenantId, id);
  }
}
