import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AcademicPlacementStatus,
  AcademicStage,
  AcademicTrack,
  Prisma,
  ReportCardMode,
  type ReportCard
} from "@prisma/client";

import { AcademicStructureService } from "../academic-structure/academic-structure.service";
import { buildSimplePdf, toPdfDataUrl } from "../common/pdf.util";
import { PrismaService } from "../database/prisma.service";
import { ReferenceService } from "../reference/reference.service";
import {
  GenerateBulkReportCardsDto,
  GenerateReportCardDto
} from "./dto/grades.dto";
import {
  type ClassSummaryView,
  type ReportCardDraft,
  type ReportCardSectionView,
  type ReportCardView,
  type StudentClassSummaryView
} from "./grades.types";
import {
  decimalToNumber,
  resolveAppreciation,
  round3
} from "./grades.utils";

@Injectable()
export class GradesReportCardsService {
  constructor(
    private readonly academicStructureService: AcademicStructureService,
    private readonly prisma: PrismaService,
    private readonly referenceService: ReferenceService
  ) {}

  async classSummary(
    tenantId: string,
    classId: string,
    academicPeriodId: string
  ): Promise<ClassSummaryView> {
    return this.buildClassSummary(tenantId, classId, academicPeriodId);
  }

  async generateReportCard(
    tenantId: string,
    payload: GenerateReportCardDto
  ): Promise<ReportCardView> {
    const classroom = await this.referenceService.requireClassroom(tenantId, payload.classId);
    const period = await this.referenceService.requireAcademicPeriod(
      tenantId,
      payload.academicPeriodId
    );

    if (classroom.schoolYearId !== period.schoolYearId) {
      throw new ConflictException("Classroom and period must belong to the same school year.");
    }

    if (payload.placementId) {
      const requestedPlacement = await this.prisma.studentTrackPlacement.findFirst({
        where: {
          id: payload.placementId,
          tenantId,
          studentId: payload.studentId,
          schoolYearId: classroom.schoolYearId,
          classId: classroom.id,
          placementStatus: {
            in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
          }
        },
        select: {
          id: true
        }
      });

      if (!requestedPlacement) {
        throw new ConflictException(
          "Report card placement must match the student, class and school year."
        );
      }
    }

    const cards = await this.syncStudentReportCardsForPeriod(
      tenantId,
      payload.studentId,
      classroom.schoolYearId,
      payload.academicPeriodId,
      payload.publish ?? true
    );

    const preferred =
      cards.find(
        (card) =>
          card.classId === payload.classId ||
          card.sections?.some((section) => section.classId === payload.classId) ||
          (payload.placementId &&
            (card.placementId === payload.placementId ||
              card.secondaryPlacementId === payload.placementId)) ||
          (payload.track &&
            card.sections?.some((section) => section.track === payload.track))
      ) || cards[0];

    if (!preferred) {
      throw new NotFoundException("Student has no report card context for this period.");
    }

    return preferred;
  }

  async generateBulkReportCards(
    tenantId: string,
    payload: GenerateBulkReportCardsDto
  ): Promise<ReportCardView[]> {
    const classroom = await this.referenceService.requireClassroom(tenantId, payload.classId);
    const period = await this.referenceService.requireAcademicPeriod(
      tenantId,
      payload.academicPeriodId
    );

    if (classroom.schoolYearId !== period.schoolYearId) {
      throw new ConflictException("Classroom and period must belong to the same school year.");
    }

    const placements = await this.prisma.studentTrackPlacement.findMany({
      where: {
        tenantId,
        classId: classroom.id,
        schoolYearId: classroom.schoolYearId,
        track: payload.track,
        placementStatus: {
          in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
        }
      },
      select: {
        studentId: true
      },
      distinct: ["studentId"]
    });

    if (placements.length === 0) {
      throw new ConflictException("No students are available for this class and period.");
    }

    const generated = await Promise.all(
      placements.map((placement) =>
        this.syncStudentReportCardsForPeriod(
          tenantId,
          placement.studentId,
          classroom.schoolYearId,
          payload.academicPeriodId,
          payload.publish ?? true
        )
      )
    );

    return generated.flat().filter((card) => card.classId === classroom.id);
  }

  async listReportCards(
    tenantId: string,
    filters: {
      classId?: string;
      academicPeriodId?: string;
      studentId?: string;
      placementId?: string;
      track?: AcademicTrack;
    }
  ): Promise<ReportCardView[]> {
    const rows = await this.prisma.reportCard.findMany({
      where: {
        tenantId,
        academicPeriodId: filters.academicPeriodId,
        studentId: filters.studentId,
        placementId: filters.placementId
      },
      include: {
        student: true,
        classroom: true,
        academicPeriod: true,
        placement: {
          include: {
            classroom: true,
            level: true
          }
        },
        secondaryPlacement: {
          include: {
            classroom: true,
            level: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return rows
      .map((row) => this.reportCardView(row))
      .filter((row) => {
        if (
          filters.classId &&
          row.classId !== filters.classId &&
          !row.sections?.some((section) => section.classId === filters.classId)
        ) {
          return false;
        }
        if (
          filters.track &&
          !row.sections?.some((section) => section.track === filters.track)
        ) {
          return false;
        }
        return true;
      });
  }

  async getReportCardPdf(
    tenantId: string,
    reportCardId: string
  ): Promise<{ reportCardId: string; pdfDataUrl: string }> {
    const row = await this.prisma.reportCard.findFirst({
      where: {
        id: reportCardId,
        tenantId
      }
    });

    if (!row) {
      throw new NotFoundException("Report card not found.");
    }

    if (!row.pdfDataUrl) {
      throw new NotFoundException("Report card PDF not generated yet.");
    }

    return {
      reportCardId: row.id,
      pdfDataUrl: row.pdfDataUrl
    };
  }

  async syncReportCardsForClassPeriod(
    tenantId: string,
    classId: string,
    academicPeriodId: string
  ): Promise<void> {
    const classroom = await this.referenceService.requireClassroom(tenantId, classId);
    const impactedPlacements = await this.prisma.studentTrackPlacement.findMany({
      where: {
        tenantId,
        classId,
        schoolYearId: classroom.schoolYearId,
        placementStatus: {
          in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
        }
      },
      select: {
        studentId: true
      },
      distinct: ["studentId"]
    });

    for (const placement of impactedPlacements) {
      try {
        await this.syncStudentReportCardsForPeriod(
          tenantId,
          placement.studentId,
          classroom.schoolYearId,
          academicPeriodId,
          false
        );
      } catch (error) {
        if (!this.isSkippableAutoSyncError(error)) {
          throw error;
        }

        await this.prisma.reportCard.deleteMany({
          where: {
            tenantId,
            studentId: placement.studentId,
            academicPeriodId
          }
        });
      }
    }
  }

  async syncStudentReportCardsForPeriod(
    tenantId: string,
    studentId: string,
    schoolYearId: string,
    academicPeriodId: string,
    publish: boolean
  ): Promise<ReportCardView[]> {
    const drafts = await this.buildStudentReportCardDrafts(
      tenantId,
      studentId,
      schoolYearId,
      academicPeriodId
    );

    const existingRows = await this.prisma.reportCard.findMany({
      where: {
        tenantId,
        studentId,
        academicPeriodId
      }
    });

    const expectedPlacementIds = new Set(drafts.map((draft) => draft.placementId));
    const expectedClassIds = new Set(drafts.map((draft) => draft.classId));
    const obsoleteIds = existingRows
      .filter((row) =>
        row.placementId
          ? !expectedPlacementIds.has(row.placementId)
          : !expectedClassIds.has(row.classId)
      )
      .map((row) => row.id);

    const savedRows = await this.prisma.$transaction(async (transaction) => {
      const saved = await Promise.all(
        drafts.map((draft) =>
          transaction.reportCard.upsert({
            where: {
              tenantId_placementId_academicPeriodId: {
                tenantId,
                placementId: draft.placementId,
                academicPeriodId
              }
            },
            create: {
              tenantId,
              studentId,
              classId: draft.classId,
              placementId: draft.placementId,
              secondaryPlacementId: draft.secondaryPlacementId,
              track: draft.track,
              mode: draft.mode,
              academicPeriodId,
              averageGeneral: draft.averageGeneral,
              classRank: draft.classRank ?? null,
              appreciation: draft.appreciation,
              summaryData: draft.summaryData as Prisma.InputJsonValue,
              pdfDataUrl: draft.pdfDataUrl,
              publishedAt: publish ? new Date() : null,
              updatedAt: new Date()
            },
            update: {
              placementId: draft.placementId,
              secondaryPlacementId: draft.secondaryPlacementId,
              track: draft.track,
              mode: draft.mode,
              averageGeneral: draft.averageGeneral,
              classRank: draft.classRank ?? null,
              appreciation: draft.appreciation,
              summaryData: draft.summaryData as Prisma.InputJsonValue,
              pdfDataUrl: draft.pdfDataUrl,
              publishedAt: publish ? new Date() : undefined,
              updatedAt: new Date()
            },
            include: {
              student: true,
              classroom: true,
              academicPeriod: true,
              placement: {
                include: {
                  classroom: true,
                  level: true
                }
              },
              secondaryPlacement: {
                include: {
                  classroom: true,
                  level: true
                }
              }
            }
          })
        )
      );

      if (obsoleteIds.length > 0) {
        await transaction.reportCard.deleteMany({
          where: {
            id: { in: obsoleteIds }
          }
        });
      }

      return saved;
    });

    return savedRows.map((row) => this.reportCardView(row));
  }

  private async buildClassSummary(
    tenantId: string,
    classId: string,
    academicPeriodId: string
  ): Promise<ClassSummaryView> {
    const classroom = await this.referenceService.requireClassroom(tenantId, classId);
    const period = await this.referenceService.requireAcademicPeriod(tenantId, academicPeriodId);

    if (classroom.schoolYearId !== period.schoolYearId) {
      throw new ConflictException("Classroom and period must belong to the same school year.");
    }

    const placements = await this.prisma.studentTrackPlacement.findMany({
      where: {
        tenantId,
        classId,
        schoolYearId: classroom.schoolYearId,
        track: classroom.track,
        placementStatus: {
          in: [AcademicPlacementStatus.ACTIVE, AcademicPlacementStatus.COMPLETED]
        }
      },
      include: {
        student: true
      },
      orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }]
    });

    const placementIds = placements.map((placement) => placement.id);
    const gradeOr: Prisma.GradeEntryWhereInput[] = [
      {
        placementId: null,
        classId,
        track: classroom.track
      }
    ];
    if (placementIds.length > 0) {
      gradeOr.unshift({
        placementId: {
          in: placementIds
        }
      });
    }

    const gradeRows = await this.prisma.gradeEntry.findMany({
      where: {
        tenantId,
        academicPeriodId,
        OR: gradeOr
      },
      include: {
        subject: true
      }
    });

    const gradeByStudent = new Map<
      string,
      Map<string, { subjectLabel: string; weightedSum: number; coefficientSum: number; coefficient: number }>
    >();

    for (const grade of gradeRows) {
      if (grade.exempted) {
        continue;
      }

      const normalized = grade.absent
        ? 0
        : (decimalToNumber(grade.score) / decimalToNumber(grade.scoreMax)) * 20;
      const coefficient = decimalToNumber(grade.coefficient);

      const studentSubjects =
        gradeByStudent.get(grade.studentId) ||
        new Map<string, { subjectLabel: string; weightedSum: number; coefficientSum: number; coefficient: number }>();

      const current = studentSubjects.get(grade.subjectId) || {
        subjectLabel: grade.subject.label,
        weightedSum: 0,
        coefficientSum: 0,
        coefficient
      };

      current.weightedSum += normalized * coefficient;
      current.coefficientSum += coefficient;
      current.coefficient = coefficient;
      studentSubjects.set(grade.subjectId, current);
      gradeByStudent.set(grade.studentId, studentSubjects);
    }

    const summaryRows: Array<
      Omit<StudentClassSummaryView, "classRank"> & { classRank?: number }
    > = placements.map((placement) => {
      const studentMap = gradeByStudent.get(placement.studentId) || new Map();
      const subjectAverages = Array.from(studentMap.entries()).map(([subjectId, value]) => ({
        subjectId,
        subjectLabel: value.subjectLabel,
        average: round3(value.weightedSum / value.coefficientSum),
        coefficient: value.coefficient
      }));

      const coefficientTotal = subjectAverages.reduce(
        (sum, value) => sum + (value.coefficient ?? 1),
        0
      );
      const averageGeneral =
        subjectAverages.length > 0 && coefficientTotal > 0
          ? round3(
              subjectAverages.reduce(
                (sum, value) => sum + value.average * (value.coefficient ?? 1),
                0
              ) / coefficientTotal
            )
          : 0;

      const studentName = `${placement.student.firstName} ${placement.student.lastName}`.trim();

      return {
        studentId: placement.studentId,
        placementId: placement.id,
        track: placement.track,
        matricule: placement.student.matricule,
        studentName,
        averageGeneral,
        noteCount: subjectAverages.length,
        missingGrades: 0,
        appreciation: resolveAppreciation(averageGeneral),
        subjectAverages
      };
    });

    const sorted = [...summaryRows].sort((left, right) => {
      if (right.averageGeneral !== left.averageGeneral) {
        return right.averageGeneral - left.averageGeneral;
      }
      return left.studentName.localeCompare(right.studentName);
    });

    let previousAverage: number | null = null;
    let previousRank = 0;

    for (let index = 0; index < sorted.length; index += 1) {
      const row = sorted[index];
      const rank =
        previousAverage !== null && Math.abs(previousAverage - row.averageGeneral) < 0.0001
          ? previousRank
          : index + 1;

      row.classRank = rank;
      previousAverage = row.averageGeneral;
      previousRank = rank;
    }

    const ranks = new Map(sorted.map((row) => [row.studentId, row.classRank || 0]));

    const students = summaryRows.map((row) => ({
      ...row,
      classRank: ranks.get(row.studentId) || 0
    }));

    const notedStudents = students.filter((student) => student.noteCount > 0);
    const classAverage =
      notedStudents.length > 0
        ? round3(
            notedStudents.reduce((sum, student) => sum + student.averageGeneral, 0) /
              notedStudents.length
          )
        : 0;

    return {
      classId,
      academicPeriodId,
      track: classroom.track,
      classAverage,
      students
    };
  }

  private async buildStudentReportCardDrafts(
    tenantId: string,
    studentId: string,
    schoolYearId: string,
    academicPeriodId: string
  ): Promise<ReportCardDraft[]> {
    const strategy = await this.academicStructureService.resolveReportCardStrategy(
      tenantId,
      studentId,
      schoolYearId
    );

    if (strategy.placements.length === 0) {
      throw new NotFoundException("Student has no active academic placement for this school year.");
    }

    const reportablePlacements = strategy.placements.filter((placement) =>
      Boolean(placement.classId)
    );
    if (reportablePlacements.length === 0) {
      throw new ConflictException("No classroom-bound placement is available for report card generation.");
    }

    if (strategy.mode === ReportCardMode.PRIMARY_COMBINED) {
      const sections = await Promise.all(
        reportablePlacements.map((placement) =>
          this.buildPlacementReportSection(tenantId, placement, academicPeriodId)
        )
      );

      const leadSection = sections[0];
      const secondarySection = sections[1];
      if (!leadSection.placementId) {
        throw new ConflictException("Report card generation requires a canonical placement.");
      }
      const averageGeneral =
        sections.reduce((total, section) => total + section.averageGeneral, 0) /
        sections.length;
      const appreciation = resolveAppreciation(averageGeneral);
      const pdf = buildSimplePdf([
        "Al Manarat Islamiyat",
        "Bulletin global primaire",
        `Eleve: ${leadSection.studentName}`,
        `Periode: ${leadSection.periodLabel}`,
        "Sections francophone et arabophone",
        ...sections.flatMap((section) => [
          `${section.track} - ${section.classLabel || section.levelLabel || section.classId}`,
          `Moyenne: ${section.averageGeneral.toFixed(2)}/20`,
          `Rang: ${section.classRank ?? "-"}`,
          `Appreciation: ${section.appreciation}`,
          ...section.subjectAverages.map(
            (subject) => `${subject.subjectLabel}: ${subject.average.toFixed(2)}/20`
          )
        ]),
        `Date de generation: ${new Date().toISOString().slice(0, 10)}`,
        "Signature / cachet"
      ]);

      return [
        {
          studentId,
          classId: leadSection.classId,
          placementId: leadSection.placementId,
          secondaryPlacementId: secondarySection?.placementId,
          track: leadSection.track,
          mode: ReportCardMode.PRIMARY_COMBINED,
          academicPeriodId,
          averageGeneral,
          classRank: undefined,
          appreciation,
          pdfDataUrl: toPdfDataUrl(pdf),
          summaryData: {
            mode: ReportCardMode.PRIMARY_COMBINED,
            sections: sections.map((section) => this.toReportCardSectionPayload(section))
          }
        }
      ];
    }

    const drafts = await Promise.all(
      reportablePlacements.map(async (placement) => {
        const section = await this.buildPlacementReportSection(
          tenantId,
          placement,
          academicPeriodId
        );
        if (!section.placementId) {
          throw new ConflictException("Report card generation requires a canonical placement.");
        }
        const pdf = buildSimplePdf([
          "Al Manarat Islamiyat",
          "Bulletin scolaire",
          `Classe: ${section.classLabel || section.classId}`,
          `Periode: ${section.periodLabel}`,
          `Eleve: ${section.studentName}`,
          `Cursus: ${section.track}`,
          `Moyenne generale: ${section.averageGeneral.toFixed(2)}/20`,
          `Rang: ${section.classRank ?? "-"}`,
          `Appreciation generale: ${section.appreciation}`,
          ...section.subjectAverages.map(
            (subject) => `${subject.subjectLabel}: ${subject.average.toFixed(2)}/20`
          ),
          `Date de generation: ${new Date().toISOString().slice(0, 10)}`,
          "Signature / cachet"
        ]);

        return {
          studentId,
          classId: section.classId,
          placementId: section.placementId,
          track: section.track,
          mode: ReportCardMode.TRACK_SINGLE,
          academicPeriodId,
          averageGeneral: section.averageGeneral,
          classRank: section.classRank,
          appreciation: section.appreciation,
          pdfDataUrl: toPdfDataUrl(pdf),
          summaryData: {
            mode: ReportCardMode.TRACK_SINGLE,
            sections: [this.toReportCardSectionPayload(section)]
          }
        } satisfies ReportCardDraft;
      })
    );

    return drafts;
  }

  private async buildPlacementReportSection(
    tenantId: string,
    placement: {
      id: string;
      track: AcademicTrack;
      classId?: string;
      classLabel?: string;
      levelCode?: string;
      levelLabel?: string;
      academicStage?: AcademicStage;
      studentId: string;
    },
    academicPeriodId: string
  ): Promise<
    ReportCardSectionView & {
      studentName: string;
      periodLabel: string;
    }
  > {
    if (!placement.classId) {
      throw new ConflictException("Report card generation requires a classroom placement.");
    }

    const summary = await this.buildClassSummary(
      tenantId,
      placement.classId,
      academicPeriodId
    );
    const target =
      summary.students.find((item) => item.placementId === placement.id) ||
      summary.students.find((item) => item.studentId === placement.studentId);

      if (!target) {
      throw new NotFoundException("Student has no track placement in this class.");
    }

    if (target.noteCount === 0) {
      throw new ConflictException("Report card generation requires at least one grade for this period.");
    }

    const period = await this.referenceService.requireAcademicPeriod(
      tenantId,
      academicPeriodId
    );

    return {
      placementId: target.placementId,
      track: target.track,
      classId: summary.classId,
      classLabel: placement.classLabel,
      levelCode: placement.levelCode,
      levelLabel: placement.levelLabel,
      academicStage: placement.academicStage || AcademicStage.SECONDARY,
      averageGeneral: target.averageGeneral,
      classRank: target.classRank,
      appreciation: target.appreciation,
      subjectAverages: target.subjectAverages,
      studentName: target.studentName,
      periodLabel: period.label
    };
  }

  private toReportCardSectionPayload(
    section: ReportCardSectionView
  ): ReportCardSectionView {
    return {
      placementId: section.placementId,
      track: section.track,
      classId: section.classId,
      classLabel: section.classLabel,
      levelCode: section.levelCode,
      levelLabel: section.levelLabel,
      academicStage: section.academicStage,
      averageGeneral: section.averageGeneral,
      classRank: section.classRank,
      appreciation: section.appreciation,
      subjectAverages: section.subjectAverages.map((subject) => ({
        subjectId: subject.subjectId,
        subjectLabel: subject.subjectLabel,
        average: subject.average
      }))
    };
  }

  private isSkippableAutoSyncError(error: unknown): boolean {
    if (
      !(error instanceof ConflictException) &&
      !(error instanceof NotFoundException)
    ) {
      return false;
    }

    const message = error instanceof Error ? error.message : "";
    return [
      "Report card generation requires at least one grade for this period.",
      "Student has no active academic placement for this school year.",
      "No classroom-bound placement is available for report card generation.",
      "Student has no track placement in this class."
    ].includes(message);
  }

  private reportCardView(
    row: ReportCard & {
      student?: { firstName: string; lastName: string } | null;
      classroom?: { label: string } | null;
      academicPeriod?: { label: string } | null;
      placement?: {
        track: AcademicTrack;
        classId: string | null;
        classroom?: { label: string } | null;
        level?: { code: string; label: string } | null;
      } | null;
      secondaryPlacement?: {
        track: AcademicTrack;
        classId: string | null;
        classroom?: { label: string } | null;
        level?: { code: string; label: string } | null;
      } | null;
    }
  ): ReportCardView {
    const summary =
      row.summaryData && typeof row.summaryData === "object" && !Array.isArray(row.summaryData)
        ? (row.summaryData as { sections?: ReportCardSectionView[] })
        : undefined;
    const sections =
      summary?.sections?.map((section) => ({
        placementId: section.placementId,
        track: section.track,
        classId: section.classId,
        classLabel: section.classLabel,
        levelCode: section.levelCode,
        levelLabel: section.levelLabel,
        academicStage: section.academicStage,
        averageGeneral: section.averageGeneral,
        classRank: section.classRank,
        appreciation: section.appreciation,
        subjectAverages: section.subjectAverages || []
      })) ||
      [
        {
          placementId: row.placementId || undefined,
          track: row.track,
          classId: row.classId,
          classLabel: row.classroom?.label || row.placement?.classroom?.label || undefined,
          levelCode: row.placement?.level?.code,
          levelLabel: row.placement?.level?.label,
          academicStage: AcademicStage.SECONDARY,
          averageGeneral: decimalToNumber(row.averageGeneral),
          classRank: row.classRank === null ? undefined : row.classRank,
          appreciation: row.appreciation || resolveAppreciation(decimalToNumber(row.averageGeneral)),
          subjectAverages: []
        }
      ];

    return {
      id: row.id,
      tenantId: row.tenantId,
      studentId: row.studentId,
      classId: row.classId,
      placementId: row.placementId || undefined,
      secondaryPlacementId: row.secondaryPlacementId || undefined,
      track: row.track,
      mode: row.mode,
      academicPeriodId: row.academicPeriodId,
      averageGeneral: decimalToNumber(row.averageGeneral),
      classRank: row.classRank === null ? undefined : row.classRank,
      appreciation: row.appreciation || undefined,
      generatedAt: row.updatedAt.toISOString(),
      publishedAt: row.publishedAt?.toISOString(),
      pdfDataUrl: row.pdfDataUrl || undefined,
      studentName: row.student
        ? `${row.student.firstName} ${row.student.lastName}`.trim()
        : undefined,
      classLabel: row.classroom?.label,
      periodLabel: row.academicPeriod?.label,
      secondaryClassLabel:
        row.secondaryPlacement?.classroom?.label || undefined,
      sections
    };
  }
}
