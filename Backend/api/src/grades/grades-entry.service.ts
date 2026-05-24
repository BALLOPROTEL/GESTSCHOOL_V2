import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AcademicPlacementStatus,
  AcademicTrack,
  type AcademicPeriod,
  type Classroom,
  type GradeEntry,
  type Student,
  type Subject
} from "@prisma/client";

import { AcademicStructureService } from "../academic-structure/academic-structure.service";
import { PrismaService } from "../database/prisma.service";
import { ReferenceService } from "../reference/reference.service";
import {
  BulkCreateGradesDto,
  CreateGradeDto
} from "./dto/grades.dto";
import { GradesReportCardsService } from "./grades-report-cards.service";
import { type GradeView } from "./grades.types";
import { decimalToNumber } from "./grades.utils";

@Injectable()
export class GradesEntryService {
  constructor(
    private readonly academicStructureService: AcademicStructureService,
    private readonly prisma: PrismaService,
    private readonly referenceService: ReferenceService,
    private readonly gradesReportCardsService: GradesReportCardsService
  ) {}

  async listGrades(
    tenantId: string,
    filters: {
      classId?: string;
      subjectId?: string;
      academicPeriodId?: string;
      studentId?: string;
      placementId?: string;
      track?: AcademicTrack;
    }
  ): Promise<GradeView[]> {
    const rows = await this.prisma.gradeEntry.findMany({
      where: {
        tenantId,
        classId: filters.classId,
        subjectId: filters.subjectId,
        academicPeriodId: filters.academicPeriodId,
        studentId: filters.studentId,
        placementId: filters.placementId,
        track: filters.track
      },
      include: {
        student: true,
        subject: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return rows.map((row) => this.gradeView(row));
  }

  async upsertGrade(
    tenantId: string,
    payload: CreateGradeDto
  ): Promise<GradeView> {
    const { classroom, placement } = await this.validateGradeContext(tenantId, {
      classId: payload.classId,
      subjectId: payload.subjectId,
      academicPeriodId: payload.academicPeriodId,
      studentId: payload.studentId,
      track: payload.track,
      placementId: payload.placementId
    });

    const scoreMax = payload.scoreMax ?? 20;
    const isNeutralized = payload.absent === true || payload.exempted === true;
    const score = this.resolveScore(payload.score, scoreMax, isNeutralized);
    const coefficient = this.resolveCoefficient(payload.coefficient);
    const assessmentDate = this.resolveAssessmentDate(payload.assessmentDate);

    if (score > scoreMax) {
      throw new ConflictException("score cannot exceed scoreMax.");
    }

    const saved = await this.prisma.gradeEntry.upsert({
      where: {
        tenantId_placementId_subjectId_academicPeriodId_assessmentLabel: {
          tenantId,
          placementId: placement.id,
          subjectId: payload.subjectId,
          academicPeriodId: payload.academicPeriodId,
          assessmentLabel: payload.assessmentLabel.trim()
        }
      },
      create: {
        tenantId,
        studentId: payload.studentId,
        classId: classroom.id,
        placementId: placement.id,
        track: placement.track,
        subjectId: payload.subjectId,
        academicPeriodId: payload.academicPeriodId,
        assessmentLabel: payload.assessmentLabel.trim(),
        assessmentType: payload.assessmentType || "DEVOIR",
        assessmentDate,
        score,
        scoreMax,
        coefficient,
        absent: payload.absent ?? false,
        exempted: payload.exempted ?? false,
        comment: payload.comment,
        updatedAt: new Date()
      },
      update: {
        assessmentType: payload.assessmentType || "DEVOIR",
        assessmentDate,
        score,
        scoreMax,
        coefficient,
        absent: payload.absent ?? false,
        exempted: payload.exempted ?? false,
        placementId: placement.id,
        track: placement.track,
        comment: payload.comment,
        updatedAt: new Date()
      },
      include: {
        student: true,
        subject: true
      }
    });

    await this.gradesReportCardsService.syncReportCardsForClassPeriod(
      tenantId,
      classroom.id,
      payload.academicPeriodId
    );

    return this.gradeView(saved);
  }

  async bulkUpsertGrades(
    tenantId: string,
    payload: BulkCreateGradesDto
  ): Promise<{ upsertedCount: number }> {
    if (payload.grades.length === 0) {
      return { upsertedCount: 0 };
    }

    const { classroom } = await this.validateGradeContext(tenantId, {
      classId: payload.classId,
      subjectId: payload.subjectId,
      academicPeriodId: payload.academicPeriodId,
      studentId: payload.grades[0].studentId,
      track: payload.track
    });

    const placementByStudentId = new Map<
      string,
      { id: string; track: AcademicTrack }
    >();
    for (const grade of payload.grades) {
      const context = await this.validateGradeContext(tenantId, {
        classId: payload.classId,
        subjectId: payload.subjectId,
        academicPeriodId: payload.academicPeriodId,
        studentId: grade.studentId,
        track: payload.track,
        placementId: grade.placementId
      });
      placementByStudentId.set(grade.studentId, {
        id: context.placement.id,
        track: context.placement.track
      });
    }

    const scoreMax = payload.scoreMax ?? 20;
    const coefficient = this.resolveCoefficient(payload.coefficient);
    const assessmentDate = this.resolveAssessmentDate(payload.assessmentDate);
    await Promise.all(
      payload.grades.map((item) => {
        const isNeutralized = item.absent === true || item.exempted === true;
        const score = this.resolveScore(item.score, scoreMax, isNeutralized);
        if (score > scoreMax) {
          throw new ConflictException("score cannot exceed scoreMax.");
        }
        const placement = placementByStudentId.get(item.studentId);
        if (!placement) {
          throw new ConflictException("Student has no academic placement for this grade.");
        }
        return this.prisma.gradeEntry.upsert({
          where: {
            tenantId_placementId_subjectId_academicPeriodId_assessmentLabel: {
              tenantId,
              placementId: placement.id,
              subjectId: payload.subjectId,
              academicPeriodId: payload.academicPeriodId,
              assessmentLabel: payload.assessmentLabel.trim()
            }
          },
          create: {
            tenantId,
            studentId: item.studentId,
            classId: classroom.id,
            placementId: placement.id,
            track: placement.track,
            subjectId: payload.subjectId,
            academicPeriodId: payload.academicPeriodId,
            assessmentLabel: payload.assessmentLabel.trim(),
            assessmentType: payload.assessmentType || "DEVOIR",
            assessmentDate,
            score,
            scoreMax,
            coefficient,
            absent: item.absent ?? false,
            exempted: item.exempted ?? false,
            comment: item.comment,
            updatedAt: new Date()
          },
          update: {
            assessmentType: payload.assessmentType || "DEVOIR",
            assessmentDate,
            score,
            scoreMax,
            coefficient,
            absent: item.absent ?? false,
            exempted: item.exempted ?? false,
            placementId: placement.id,
            track: placement.track,
            comment: item.comment,
            updatedAt: new Date()
          }
        });
      })
    );

    await this.gradesReportCardsService.syncReportCardsForClassPeriod(
      tenantId,
      classroom.id,
      payload.academicPeriodId
    );

    return { upsertedCount: payload.grades.length };
  }

  async deleteGrade(tenantId: string, gradeId: string): Promise<{ deleted: true }> {
    const row = await this.prisma.gradeEntry.findFirst({
      where: {
        id: gradeId,
        tenantId
      },
      select: {
        id: true,
        classId: true,
        academicPeriodId: true
      }
    });

    if (!row) {
      throw new NotFoundException("Grade not found.");
    }

    await this.prisma.gradeEntry.delete({
      where: {
        id: row.id
      }
    });

    await this.gradesReportCardsService.syncReportCardsForClassPeriod(
      tenantId,
      row.classId,
      row.academicPeriodId
    );

    return { deleted: true };
  }

  private async validateGradeContext(
    tenantId: string,
    context: {
      classId: string;
      subjectId: string;
      academicPeriodId: string;
      studentId: string;
      track?: AcademicTrack;
      placementId?: string;
    }
  ): Promise<{
    classroom: Classroom;
    subject: Subject;
    period: AcademicPeriod;
    student: Student;
    placement: {
      id: string;
      track: AcademicTrack;
      classId: string | null;
      schoolYearId: string;
      studentId: string;
      placementStatus?: AcademicPlacementStatus;
    };
  }> {
    const [classroom, subject, period] = await Promise.all([
      this.referenceService.requireClassroom(tenantId, context.classId),
      this.referenceService.requireSubject(tenantId, context.subjectId),
      this.referenceService.requireAcademicPeriod(tenantId, context.academicPeriodId)
    ]);

    if (classroom.schoolYearId !== period.schoolYearId) {
      throw new ConflictException("Classroom and period must belong to the same school year.");
    }

    const student = await this.prisma.student.findFirst({
      where: {
        id: context.studentId,
        tenantId,
        deletedAt: null
      }
    });

    if (!student) {
      throw new NotFoundException("Student not found.");
    }

    const placement = context.placementId
      ? await this.prisma.studentTrackPlacement.findFirst({
          where: {
            id: context.placementId,
            tenantId,
            studentId: student.id
          },
          select: {
            id: true,
            track: true,
            classId: true,
            schoolYearId: true,
            studentId: true,
            placementStatus: true
          }
        })
      : await this.academicStructureService.requirePlacementForStudentClass(
          tenantId,
          student.id,
          classroom.id,
          classroom.schoolYearId,
          context.track
        );

    if (!placement) {
      throw new ConflictException("Student has no academic placement in this class for the school year.");
    }

    if (placement.classId !== classroom.id || placement.schoolYearId !== classroom.schoolYearId) {
      throw new ConflictException("Placement must belong to the same class and school year.");
    }

    if (
      placement.placementStatus &&
      placement.placementStatus !== AcademicPlacementStatus.ACTIVE &&
      placement.placementStatus !== AcademicPlacementStatus.COMPLETED
    ) {
      throw new ConflictException("Placement must be active or completed for grade entry.");
    }

    return {
      classroom,
      subject,
      period,
      student,
      placement
    };
  }

  private gradeView(
    row: GradeEntry & {
      student?: { firstName: string; lastName: string } | null;
      subject?: { label: string } | null;
    }
  ): GradeView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      studentId: row.studentId,
      placementId: row.placementId || undefined,
      track: row.track,
      studentName: row.student
        ? `${row.student.firstName} ${row.student.lastName}`.trim()
        : undefined,
      classId: row.classId,
      subjectId: row.subjectId,
      subjectLabel: row.subject?.label,
      academicPeriodId: row.academicPeriodId,
      assessmentLabel: row.assessmentLabel,
      assessmentType: row.assessmentType,
      assessmentDate: row.assessmentDate?.toISOString().slice(0, 10),
      score: decimalToNumber(row.score),
      scoreMax: decimalToNumber(row.scoreMax),
      coefficient: decimalToNumber(row.coefficient),
      absent: row.absent,
      exempted: row.exempted,
      comment: row.comment || undefined
    };
  }

  private resolveScore(
    score: number | undefined,
    scoreMax: number,
    isNeutralized: boolean
  ): number {
    if (isNeutralized) {
      if (score !== undefined && score !== null) {
        throw new ConflictException("score must be empty when the student is absent or exempted.");
      }
      return 0;
    }
    if (score === undefined || score === null || !Number.isFinite(score)) {
      throw new ConflictException("score is required unless the student is absent or exempted.");
    }
    if (score < 0) {
      throw new ConflictException("score must be greater than or equal to 0.");
    }
    if (scoreMax <= 0) {
      throw new ConflictException("scoreMax must be greater than 0.");
    }
    return score;
  }

  private resolveCoefficient(value?: number): number {
    const coefficient = value ?? 1;
    if (!Number.isFinite(coefficient) || coefficient <= 0) {
      throw new ConflictException("coefficient must be greater than 0.");
    }
    return coefficient;
  }

  private resolveAssessmentDate(value?: string): Date | null {
    if (!value) {
      return null;
    }
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }
}
