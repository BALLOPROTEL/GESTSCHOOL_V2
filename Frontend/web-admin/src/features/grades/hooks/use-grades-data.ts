import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { translateUiString, UI_MESSAGES } from "../../../shared/i18n";
import { useI18n } from "../../../shared/i18n-context";
import { toUiErrorMessage } from "../../../shared/services/api-errors";
import type {
  AcademicTrack,
  ClassItem,
  ClassSummary,
  FieldErrors,
  GradeEntry,
  Period,
  ReportCard,
  SchoolYear,
  Student,
  Subject
} from "../../../shared/types/app";
import {
  createGradesBulk,
  deleteGrade,
  fetchClassSummary,
  fetchGrades,
  fetchReportCardPdf,
  fetchReportCards,
  generateReportCard,
  generateReportCardsBulk
} from "../services/grades-service";
import type {
  GradeFilters,
  GradeForm,
  GradeGridRow,
  GradesApiClient,
  ReportForm
} from "../types/grades";

type UseGradesDataOptions = {
  api: GradesApiClient;
  initialReportCards: ReportCard[];
  classes: ClassItem[];
  students: Student[];
  subjects: Subject[];
  periods: Period[];
  schoolYears: SchoolYear[];
  remoteEnabled?: boolean;
  onReportCardsChange?: (reportCards: ReportCard[]) => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
};

const hasFieldErrors = (errors: FieldErrors): boolean => Object.keys(errors).length > 0;

const today = (): string => new Date().toISOString().slice(0, 10);

const focusFirstInlineErrorField = (stepId?: string): void => {
  window.setTimeout(() => {
    const scope = stepId
      ? document.querySelector(`[data-step-id="${stepId}"][data-active-step="true"]`)
      : document;

    if (!scope) return;
    const errorNode = scope.querySelector(".field-error");
    if (!errorNode) return;

    const label = errorNode.closest("label");
    const input = label?.querySelector<HTMLElement>("input, select, textarea");
    if (!input) return;

    input.focus();
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 0);
};

const buildGradeFilters = (): GradeFilters => ({
  schoolYearId: "",
  classId: "",
  subjectId: "",
  academicPeriodId: "",
  track: "MIXED",
  studentId: ""
});

const buildGradeForm = (): GradeForm => ({
  classId: "",
  subjectId: "",
  academicPeriodId: "",
  track: "MIXED",
  assessmentLabel: "Devoir 1",
  assessmentType: "DEVOIR",
  assessmentDate: today(),
  scoreMax: "20",
  coefficient: "1",
  comment: ""
});

const buildReportForm = (): ReportForm => ({
  schoolYearId: "",
  studentId: "",
  classId: "",
  academicPeriodId: "",
  track: "MIXED",
  mode: "student",
  regenerateExisting: false,
  publish: true
});

const formatStudentName = (student: Student): string =>
  student.fullName || `${student.firstName} ${student.lastName}`.trim();

const resolvePlacement = (
  student: Student,
  classId: string,
  track?: AcademicTrack | "MIXED"
) =>
  student.placements?.find(
    (placement) =>
      placement.classId === classId &&
      (track === "MIXED" || !track || placement.track === track)
  );

const studentsForClass = (
  students: Student[],
  classId: string,
  track?: AcademicTrack | "MIXED"
): Student[] => {
  if (!classId) return students;
  const matched = students.filter((student) => resolvePlacement(student, classId, track));
  return matched.length > 0 ? matched : students;
};

const buildGridRows = (
  students: Student[],
  classId: string,
  track?: AcademicTrack | "MIXED"
): GradeGridRow[] =>
  studentsForClass(students, classId, track).map((student) => ({
    studentId: student.id,
    placementId: resolvePlacement(student, classId, track)?.placementId,
    score: "",
    absent: false,
    exempted: false,
    comment: ""
  }));

const appendLocalGrades = (
  current: GradeEntry[],
  payload: {
    classId: string;
    subjectId: string;
    academicPeriodId: string;
    assessmentLabel: string;
    assessmentType: string;
    assessmentDate: string;
    scoreMax: number;
    coefficient: number;
    grades: Array<{
      studentId: string;
      placementId?: string;
      score?: number;
      absent: boolean;
      exempted: boolean;
      comment?: string;
    }>;
    track?: AcademicTrack;
  },
  students: Student[],
  subjects: Subject[]
): GradeEntry[] => {
  const subject = subjects.find((item) => item.id === payload.subjectId);
  const nextRows = payload.grades.map((row) => {
    const student = students.find((item) => item.id === row.studentId);
    const placement = student ? resolvePlacement(student, payload.classId, payload.track) : undefined;
    return {
      id: `local-grade-${payload.classId}-${payload.subjectId}-${payload.academicPeriodId}-${row.studentId}`,
      studentId: row.studentId,
      studentName: student ? formatStudentName(student) : undefined,
      classId: payload.classId,
      placementId: row.placementId,
      track: payload.track || placement?.track || "FRANCOPHONE",
      subjectId: payload.subjectId,
      subjectLabel: subject?.label,
      academicPeriodId: payload.academicPeriodId,
      assessmentLabel: payload.assessmentLabel,
      assessmentType: payload.assessmentType,
      assessmentDate: payload.assessmentDate,
      score: row.score ?? 0,
      scoreMax: payload.scoreMax,
      coefficient: payload.coefficient,
      absent: row.absent,
      exempted: row.exempted,
      comment: row.comment
    } satisfies GradeEntry;
  });
  return [...nextRows, ...current];
};

const buildLocalClassSummary = (
  grades: GradeEntry[],
  students: Student[],
  classId: string,
  academicPeriodId: string
): ClassSummary => {
  const rows = studentsForClass(students, classId).map((student) => {
    const studentGrades = grades.filter(
      (grade) =>
        grade.studentId === student.id &&
        grade.classId === classId &&
        grade.academicPeriodId === academicPeriodId &&
        !grade.exempted
    );

    const subjectMap = new Map<
      string,
      { subjectLabel: string; weightedSum: number; coefficientSum: number; coefficient: number }
    >();
    for (const grade of studentGrades) {
      const coefficient = grade.coefficient ?? 1;
      const normalized = grade.absent ? 0 : (grade.score / grade.scoreMax) * 20;
      const current = subjectMap.get(grade.subjectId) || {
        subjectLabel: grade.subjectLabel || grade.subjectId,
        weightedSum: 0,
        coefficientSum: 0,
        coefficient
      };
      current.weightedSum += normalized * coefficient;
      current.coefficientSum += coefficient;
      current.coefficient = coefficient;
      subjectMap.set(grade.subjectId, current);
    }

    const subjectAverages = Array.from(subjectMap.entries()).map(([subjectId, item]) => ({
      subjectId,
      subjectLabel: item.subjectLabel,
      average: item.coefficientSum > 0 ? item.weightedSum / item.coefficientSum : 0,
      coefficient: item.coefficient
    }));
    const coefficientTotal = subjectAverages.reduce((sum, item) => sum + (item.coefficient ?? 1), 0);
    const averageGeneral =
      subjectAverages.length > 0 && coefficientTotal > 0
        ? subjectAverages.reduce((sum, item) => sum + item.average * (item.coefficient ?? 1), 0) / coefficientTotal
        : 0;

    return {
      studentId: student.id,
      placementId: resolvePlacement(student, classId)?.placementId,
      track: resolvePlacement(student, classId)?.track || "FRANCOPHONE",
      matricule: student.matricule,
      studentName: formatStudentName(student),
      averageGeneral: Math.round(averageGeneral * 100) / 100,
      classRank: 0,
      noteCount: subjectAverages.length,
      missingGrades: Math.max(0, 1 - subjectAverages.length),
      appreciation:
        averageGeneral >= 16 ? "Excellent" : averageGeneral >= 14 ? "Très bien" : averageGeneral >= 10 ? "Passable" : "À renforcer",
      subjectAverages
    };
  });

  const ranked = [...rows].sort((left, right) => right.averageGeneral - left.averageGeneral);
  ranked.forEach((row, index) => {
    row.classRank = index + 1;
  });

  const rankByStudentId = new Map(ranked.map((row) => [row.studentId, row.classRank]));
  const completedRows = rows.map((row) => ({ ...row, classRank: rankByStudentId.get(row.studentId) || 0 }));
  const notedRows = completedRows.filter((row) => row.noteCount > 0);

  return {
    classId,
    academicPeriodId,
    track: "FRANCOPHONE",
    classAverage:
      notedRows.length > 0
        ? Math.round((notedRows.reduce((sum, row) => sum + row.averageGeneral, 0) / notedRows.length) * 100) / 100
        : 0,
    students: completedRows
  };
};

export const useGradesData = ({
  api,
  initialReportCards,
  classes,
  students,
  subjects,
  periods,
  schoolYears,
  remoteEnabled = true,
  onReportCardsChange,
  onError,
  onNotice
}: UseGradesDataOptions) => {
  const { language } = useI18n();
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [gradeFilters, setGradeFilters] = useState<GradeFilters>(() => buildGradeFilters());
  const [gradeForm, setGradeForm] = useState<GradeForm>(() => buildGradeForm());
  const [gradeRows, setGradeRows] = useState<GradeGridRow[]>(() => buildGridRows(students, ""));
  const [classSummary, setClassSummary] = useState<ClassSummary | null>(null);
  const [reportCards, setReportCards] = useState<ReportCard[]>(initialReportCards);
  const [reportForm, setReportForm] = useState<ReportForm>(() => buildReportForm());
  const [reportPdfUrl, setReportPdfUrl] = useState("");
  const [gradesWorkflowStep, setGradesWorkflowStep] = useState("filters");
  const [gradeErrors, setGradeErrors] = useState<FieldErrors>({});
  const [gradeRowErrors, setGradeRowErrors] = useState<FieldErrors>({});
  const [reportErrors, setReportErrors] = useState<FieldErrors>({});
  const [summaryComputedAt, setSummaryComputedAt] = useState<string | null>(null);
  const [reportsGeneratedAt, setReportsGeneratedAt] = useState<string | null>(null);
  const [selectedSummaryStudentId, setSelectedSummaryStudentId] = useState("");

  const setReportCardsAndNotify = useCallback(
    (nextReportCards: ReportCard[]) => {
      setReportCards(nextReportCards);
      onReportCardsChange?.(nextReportCards);
    },
    [onReportCardsChange]
  );

  useEffect(() => {
    setReportCards(initialReportCards);
  }, [initialReportCards]);

  useEffect(() => {
    if (!remoteEnabled) return;
    let isMounted = true;
    fetchGrades(api, buildGradeFilters())
      .then((rows) => {
        if (isMounted) setGrades(rows);
      })
      .catch((error) => {
        if (isMounted) onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
      });
    return () => {
      isMounted = false;
    };
  }, [api, onError, remoteEnabled]);

  useEffect(() => {
    const firstYear = schoolYears.find((item) => item.isActive || item.isDefault) || schoolYears[0];
    const firstClass = classes.find((item) => !firstYear || item.schoolYearId === firstYear.id) || classes[0];
    const firstSubject = subjects[0];
    const firstPeriod = firstClass
      ? periods.find((item) => item.schoolYearId === firstClass.schoolYearId) || periods[0]
      : periods[0];

    if (!gradeForm.classId && firstClass) setGradeForm((previous) => ({ ...previous, classId: firstClass.id }));
    if (!gradeForm.subjectId && firstSubject) setGradeForm((previous) => ({ ...previous, subjectId: firstSubject.id }));
    if (!gradeForm.academicPeriodId && firstPeriod) {
      setGradeForm((previous) => ({ ...previous, academicPeriodId: firstPeriod.id }));
    }

    if (!reportForm.schoolYearId && (firstYear || firstClass)) {
      setReportForm((previous) => ({
        ...previous,
        schoolYearId: firstYear?.id || firstClass?.schoolYearId || previous.schoolYearId
      }));
    }
    if (!reportForm.classId && firstClass) {
      setReportForm((previous) => ({
        ...previous,
        classId: firstClass.id,
        schoolYearId: previous.schoolYearId || firstClass.schoolYearId,
        track: firstClass.track || previous.track
      }));
    }
    if (!reportForm.academicPeriodId && firstPeriod) {
      setReportForm((previous) => ({ ...previous, academicPeriodId: firstPeriod.id }));
    }
    if (!reportForm.studentId && students[0]) {
      setReportForm((previous) => ({ ...previous, studentId: students[0].id }));
    }
  }, [
    classes,
    gradeForm.academicPeriodId,
    gradeForm.classId,
    gradeForm.subjectId,
    periods,
    reportForm.academicPeriodId,
    reportForm.classId,
    reportForm.schoolYearId,
    reportForm.studentId,
    schoolYears,
    students,
    subjects
  ]);

  useEffect(() => {
    setGradeRows(buildGridRows(students, gradeForm.classId, gradeForm.track));
  }, [gradeForm.classId, gradeForm.track, students]);

  const hasCompatibleClassPeriod = useCallback(
    (classId: string, academicPeriodId: string): boolean => {
      const classroom = classes.find((item) => item.id === classId);
      const period = periods.find((item) => item.id === academicPeriodId);
      if (!classroom || !period) return false;
      return classroom.schoolYearId === period.schoolYearId;
    },
    [classes, periods]
  );

  const loadGrades = useCallback(
    async (filters: GradeFilters = gradeFilters): Promise<void> => {
      if (!remoteEnabled) return;
      try {
        setGrades(await fetchGrades(api, filters));
      } catch (error) {
        onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
      }
    },
    [api, gradeFilters, onError, remoteEnabled]
  );

  const loadReportCards = useCallback(async (): Promise<void> => {
    if (!remoteEnabled) {
      setReportCards(initialReportCards);
      return;
    }
    try {
      setReportCardsAndNotify(await fetchReportCards(api));
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
    }
  }, [api, initialReportCards, onError, remoteEnabled, setReportCardsAndNotify]);

  const resetGradeEntry = (): void => {
    setGradeForm((previous) => ({
      ...previous,
      assessmentLabel: "Devoir 1",
      assessmentType: "DEVOIR",
      assessmentDate: today(),
      scoreMax: "20",
      coefficient: "1",
      comment: ""
    }));
    setGradeRows(buildGridRows(students, gradeForm.classId, gradeForm.track));
    setGradeErrors({});
    setGradeRowErrors({});
  };

  const submitGradesBulk = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);

    const errors: FieldErrors = {};
    const rowErrors: FieldErrors = {};
    if (!gradeForm.classId) errors.classId = UI_MESSAGES.validationError;
    if (!gradeForm.subjectId) errors.subjectId = UI_MESSAGES.validationError;
    if (!gradeForm.academicPeriodId) errors.academicPeriodId = UI_MESSAGES.validationError;
    if (!gradeForm.assessmentLabel.trim()) errors.assessmentLabel = UI_MESSAGES.validationError;
    if (!gradeForm.assessmentDate) errors.assessmentDate = UI_MESSAGES.validationError;

    const scoreMax = Number(gradeForm.scoreMax || "20");
    const coefficient = Number(gradeForm.coefficient || "1");
    if (!Number.isFinite(scoreMax) || scoreMax <= 0) errors.scoreMax = UI_MESSAGES.validationError;
    if (!Number.isFinite(coefficient) || coefficient <= 0) errors.coefficient = UI_MESSAGES.validationError;
    if (!hasCompatibleClassPeriod(gradeForm.classId, gradeForm.academicPeriodId)) {
      errors.academicPeriodId = UI_MESSAGES.gradeContextMismatch;
    }

    const payloadRows = gradeRows
      .map((row) => {
        const score = Number(row.score);
        const isNeutralized = row.absent || row.exempted;
        if (!isNeutralized && row.score.trim() === "") {
          rowErrors[`score-${row.studentId}`] = UI_MESSAGES.validationError;
        } else if (!isNeutralized && (!Number.isFinite(score) || score < 0)) {
          rowErrors[`score-${row.studentId}`] = UI_MESSAGES.validationError;
        } else if (!isNeutralized && Number.isFinite(score) && score > scoreMax) {
          rowErrors[`score-${row.studentId}`] = UI_MESSAGES.validationError;
        }
        return {
          studentId: row.studentId,
          placementId: row.placementId,
          score: isNeutralized ? undefined : score,
          absent: row.absent,
          exempted: row.exempted,
          comment: row.comment.trim() || undefined
        };
      })
      .filter((row) => row.absent || row.exempted || Number.isFinite(row.score));

    if (payloadRows.length === 0) {
      errors.grades = UI_MESSAGES.validationError;
    }

    setGradeErrors(errors);
    setGradeRowErrors(rowErrors);
    if (hasFieldErrors(errors) || hasFieldErrors(rowErrors)) {
      focusFirstInlineErrorField("entry");
      return;
    }

    const payload = {
      classId: gradeForm.classId,
      subjectId: gradeForm.subjectId,
      academicPeriodId: gradeForm.academicPeriodId,
      track: gradeForm.track === "MIXED" ? undefined : gradeForm.track,
      assessmentLabel: gradeForm.assessmentLabel.trim(),
      assessmentType: gradeForm.assessmentType,
      assessmentDate: gradeForm.assessmentDate,
      scoreMax,
      coefficient,
      grades: payloadRows
    };

    if (!remoteEnabled) {
      setGrades((current) => appendLocalGrades(current, payload, students, subjects));
      setGradeErrors({});
      setGradeRowErrors({});
      setGradesWorkflowStep("entry");
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }

    try {
      const result = await createGradesBulk(api, payload);
      setGradeErrors({});
      setGradeRowErrors({});
      setGradesWorkflowStep("entry");
      onNotice(UI_MESSAGES.saved);
      setGradeRows(buildGridRows(students, gradeForm.classId, gradeForm.track));
      await loadGrades(gradeFilters);
      await loadReportCards();
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
    }
  };

  const updateGradeRow = (studentId: string, patch: Partial<GradeGridRow>): void => {
    setGradeRows((current) =>
      current.map((row) => (row.studentId === studentId ? { ...row, ...patch } : row))
    );
  };

  const removeGrade = async (gradeId: string): Promise<void> => {
    const confirmed = window.confirm(translateUiString(language, UI_MESSAGES.gradeDeleteConfirm));
    if (!confirmed) return;
    if (!remoteEnabled || gradeId.startsWith("local-grade-")) {
      setGrades((current) => current.filter((grade) => grade.id !== gradeId));
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }
    try {
      await deleteGrade(api, gradeId);
      onNotice(UI_MESSAGES.deleted);
      await loadGrades(gradeFilters);
      await loadReportCards();
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.deleteError));
    }
  };

  const applyGradeFilters = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (!gradeFilters.schoolYearId || !gradeFilters.classId || !gradeFilters.academicPeriodId) {
      onError(UI_MESSAGES.gradeContextRequired);
      return;
    }
    const selectedClass = classes.find((item) => item.id === gradeFilters.classId);
    const selectedPeriod = periods.find((item) => item.id === gradeFilters.academicPeriodId);
    if (selectedClass?.schoolYearId !== gradeFilters.schoolYearId || selectedPeriod?.schoolYearId !== gradeFilters.schoolYearId) {
      onError(UI_MESSAGES.gradeContextMismatch);
      return;
    }
    if (!hasCompatibleClassPeriod(gradeFilters.classId, gradeFilters.academicPeriodId)) {
      onError(UI_MESSAGES.gradeContextMismatch);
      return;
    }
    await loadGrades(gradeFilters);
    if (
      classSummary &&
      (classSummary.classId !== gradeFilters.classId || classSummary.academicPeriodId !== gradeFilters.academicPeriodId)
    ) {
      setClassSummary(null);
      setSummaryComputedAt(null);
      setSelectedSummaryStudentId("");
    }
    onNotice(UI_MESSAGES.updated);
  };

  const resetGradeFilters = async (): Promise<void> => {
    const next = buildGradeFilters();
    setGradeFilters(next);
    setClassSummary(null);
    setSummaryComputedAt(null);
    await loadGrades(next);
  };

  const computeClassSummary = async (): Promise<void> => {
    if (!gradeFilters.classId || !gradeFilters.academicPeriodId) {
      onError(UI_MESSAGES.gradeContextRequired);
      return;
    }
    if (!hasCompatibleClassPeriod(gradeFilters.classId, gradeFilters.academicPeriodId)) {
      onError(UI_MESSAGES.gradeContextMismatch);
      return;
    }
    if (!remoteEnabled) {
      const summary = buildLocalClassSummary(grades, students, gradeFilters.classId, gradeFilters.academicPeriodId);
      if (summary.students.every((student) => student.noteCount === 0)) {
        onError(UI_MESSAGES.noGrades);
        return;
      }
      setClassSummary(summary);
      setSummaryComputedAt(new Date().toISOString());
      setSelectedSummaryStudentId(summary.students[0]?.studentId || "");
      onNotice(UI_MESSAGES.averagesCalculated);
      return;
    }

    try {
      const summary = await fetchClassSummary(api, gradeFilters.classId, gradeFilters.academicPeriodId);
      if (summary.students.every((student) => student.noteCount === 0)) {
        onError(UI_MESSAGES.noGrades);
        return;
      }
      setClassSummary(summary);
      setSummaryComputedAt(new Date().toISOString());
      setSelectedSummaryStudentId(summary.students[0]?.studentId || "");
      onNotice(UI_MESSAGES.averagesCalculated);
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
    }
  };

  const generateReport = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);

    const errors: FieldErrors = {};
    if (!reportForm.schoolYearId) errors.schoolYearId = UI_MESSAGES.validationError;
    if (!reportForm.classId) errors.classId = UI_MESSAGES.validationError;
    if (!reportForm.academicPeriodId) errors.academicPeriodId = UI_MESSAGES.validationError;
    if (reportForm.mode === "student" && !reportForm.studentId) errors.studentId = UI_MESSAGES.validationError;
    const selectedClass = classes.find((item) => item.id === reportForm.classId);
    const selectedPeriod = periods.find((item) => item.id === reportForm.academicPeriodId);
    if (
      reportForm.schoolYearId &&
      (selectedClass?.schoolYearId !== reportForm.schoolYearId || selectedPeriod?.schoolYearId !== reportForm.schoolYearId)
    ) {
      errors.schoolYearId = UI_MESSAGES.gradeContextMismatch;
    }
    if (!hasCompatibleClassPeriod(reportForm.classId, reportForm.academicPeriodId)) {
      errors.academicPeriodId = UI_MESSAGES.gradeContextMismatch;
    }
    if (!classSummary || classSummary.classId !== reportForm.classId || classSummary.academicPeriodId !== reportForm.academicPeriodId) {
      errors.academicPeriodId = UI_MESSAGES.validationError;
    }

    setReportErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("reports");
      return;
    }
    const missingGrades = classSummary?.students.reduce((sum, student) => sum + (student.missingGrades ?? 0), 0) || 0;
    if (
      missingGrades > 0 &&
      !window.confirm(translateUiString(language, UI_MESSAGES.confirmContinueWarning))
    ) {
      return;
    }
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }

    try {
      if (reportForm.mode === "class") {
        const nextCards = await generateReportCardsBulk(api, {
          classId: reportForm.classId,
          academicPeriodId: reportForm.academicPeriodId,
          track: reportForm.track === "MIXED" ? undefined : reportForm.track,
          regenerateExisting: reportForm.regenerateExisting,
          publish: reportForm.publish
        });
        setReportErrors({});
        setReportsGeneratedAt(new Date().toISOString());
        setReportCardsAndNotify(nextCards);
        onNotice(UI_MESSAGES.reportGenerated);
        return;
      }

      const reportCard = await generateReportCard(api, {
        studentId: reportForm.studentId,
        classId: reportForm.classId,
        academicPeriodId: reportForm.academicPeriodId,
        track: reportForm.track === "MIXED" ? undefined : reportForm.track,
        regenerateExisting: reportForm.regenerateExisting,
        publish: reportForm.publish
      });
      setReportErrors({});
      setReportPdfUrl(reportCard.pdfDataUrl || "");
      if (reportCard.pdfDataUrl) {
        window.open(reportCard.pdfDataUrl, "_blank", "noopener,noreferrer");
      }
      setReportsGeneratedAt(new Date().toISOString());
      onNotice(UI_MESSAGES.reportGenerated);
      await loadReportCards();
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
    }
  };

  const openReportCardPdf = async (reportCardId: string): Promise<void> => {
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.receiptUnavailable);
      return;
    }

    try {
      const pdfDataUrl = await fetchReportCardPdf(api, reportCardId);
      setReportPdfUrl(pdfDataUrl);
      window.open(pdfDataUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.downloadError));
    }
  };

  const downloadReportCardPdf = async (reportCardId: string): Promise<void> => {
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.receiptUnavailable);
      return;
    }

    try {
      const pdfDataUrl = await fetchReportCardPdf(api, reportCardId);
      setReportPdfUrl(pdfDataUrl);
      const link = document.createElement("a");
      link.href = pdfDataUrl;
      link.download = `bulletin-${reportCardId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.downloadError));
    }
  };

  const gradeSteps = useMemo(
    () => [
      { id: "filters", title: "Vue d’ensemble", hint: "Choisir l’année, la classe et la période." },
      { id: "entry", title: "Saisie des notes", hint: "Saisir une évaluation en grille.", done: grades.length > 0 },
      { id: "summary", title: "Moyennes & rangs", hint: "Calculer les moyennes et les rangs.", done: !!classSummary },
      { id: "reports", title: "Bulletins", hint: "Générer et ouvrir les bulletins PDF.", done: reportCards.length > 0 }
    ],
    [classSummary, grades.length, reportCards.length]
  );

  return {
    applyGradeFilters,
    classSummary,
    computeClassSummary,
    downloadReportCardPdf,
    generateReport,
    gradeErrors,
    gradeFilters,
    gradeForm,
    gradeRowErrors,
    gradeRows,
    grades,
    gradeSteps,
    gradesWorkflowStep,
    loadGrades,
    loadReportCards,
    openReportCardPdf,
    reportCards,
    reportErrors,
    reportForm,
    reportPdfUrl,
    reportsGeneratedAt,
    resetGradeEntry,
    resetGradeFilters,
    removeGrade,
    selectedSummaryStudentId,
    setGradeFilters,
    setGradeForm,
    setGradesWorkflowStep,
    setReportForm,
    setSelectedSummaryStudentId,
    submitGradesBulk,
    summaryComputedAt,
    updateGradeRow
  };
};
