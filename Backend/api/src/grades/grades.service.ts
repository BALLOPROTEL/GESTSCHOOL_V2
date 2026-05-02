import { Injectable } from "@nestjs/common";
import { AcademicTrack } from "@prisma/client";

import {
  BulkCreateGradesDto,
  CreateGradeDto,
  GenerateReportCardDto
} from "./dto/grades.dto";
import { GradesEntryService } from "./grades-entry.service";
import { GradesReportCardsService } from "./grades-report-cards.service";

@Injectable()
export class GradesService {
  constructor(
    private readonly gradesEntryService: GradesEntryService,
    private readonly gradesReportCardsService: GradesReportCardsService
  ) {}

  listGrades(
    tenantId: string,
    filters: {
      classId?: string;
      subjectId?: string;
      academicPeriodId?: string;
      studentId?: string;
      placementId?: string;
      track?: AcademicTrack;
    }
  ) {
    return this.gradesEntryService.listGrades(tenantId, filters);
  }

  upsertGrade(tenantId: string, payload: CreateGradeDto) {
    return this.gradesEntryService.upsertGrade(tenantId, payload);
  }

  bulkUpsertGrades(tenantId: string, payload: BulkCreateGradesDto) {
    return this.gradesEntryService.bulkUpsertGrades(tenantId, payload);
  }

  classSummary(tenantId: string, classId: string, academicPeriodId: string) {
    return this.gradesReportCardsService.classSummary(tenantId, classId, academicPeriodId);
  }

  generateReportCard(tenantId: string, payload: GenerateReportCardDto) {
    return this.gradesReportCardsService.generateReportCard(tenantId, payload);
  }

  listReportCards(
    tenantId: string,
    filters: {
      classId?: string;
      academicPeriodId?: string;
      studentId?: string;
      placementId?: string;
      track?: AcademicTrack;
    }
  ) {
    return this.gradesReportCardsService.listReportCards(tenantId, filters);
  }

  getReportCardPdf(tenantId: string, reportCardId: string) {
    return this.gradesReportCardsService.getReportCardPdf(tenantId, reportCardId);
  }
}
