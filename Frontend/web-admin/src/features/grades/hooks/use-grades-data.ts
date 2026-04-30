import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type {
  ClassSummary,
  ClassItem,
  FieldErrors,
  GradeEntry,
  Period,
  ReportCard,
  Student,
  Subject
} from "../../../shared/types/app";
import {
  createGrade,
  fetchClassSummary,
  fetchGrades,
  fetchReportCardPdf,
  fetchReportCards,
  generateReportCard
} from "../services/grades-service";
import type {
  GradeFilters,
  GradeForm,
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
  remoteEnabled?: boolean;
  onReportCardsChange?: (reportCards: ReportCard[]) => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
};

const hasFieldErrors = (errors: FieldErrors): boolean => Object.keys(errors).length > 0;

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
  classId: "",
  subjectId: "",
  academicPeriodId: "",
  studentId: ""
});

const buildGradeForm = (): GradeForm => ({
  studentId: "",
  classId: "",
  subjectId: "",
  academicPeriodId: "",
  assessmentLabel: "Devoir 1",
  assessmentType: "DEVOIR",
  score: "",
  scoreMax: "20"
});

const buildReportForm = (): ReportForm => ({
  studentId: "",
  classId: "",
  academicPeriodId: ""
});

export const useGradesData = ({
  api,
  initialReportCards,
  classes,
  students,
  subjects,
  periods,
  remoteEnabled = true,
  onReportCardsChange,
  onError,
  onNotice
}: UseGradesDataOptions) => {
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [gradeFilters, setGradeFilters] = useState<GradeFilters>(() => buildGradeFilters());
  const [gradeForm, setGradeForm] = useState<GradeForm>(() => buildGradeForm());
  const [classSummary, setClassSummary] = useState<ClassSummary | null>(null);
  const [reportCards, setReportCards] = useState<ReportCard[]>(initialReportCards);
  const [reportForm, setReportForm] = useState<ReportForm>(() => buildReportForm());
  const [reportPdfUrl, setReportPdfUrl] = useState("");
  const [gradesWorkflowStep, setGradesWorkflowStep] = useState("filters");
  const [gradeErrors, setGradeErrors] = useState<FieldErrors>({});
  const [reportErrors, setReportErrors] = useState<FieldErrors>({});

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
        if (isMounted) onError(error instanceof Error ? error.message : "Erreur de chargement des notes.");
      });
    return () => {
      isMounted = false;
    };
  }, [api, onError, remoteEnabled]);

  useEffect(() => {
    if (!gradeForm.studentId && students[0]) setGradeForm((previous) => ({ ...previous, studentId: students[0].id }));
    if (!gradeForm.classId && classes[0]) setGradeForm((previous) => ({ ...previous, classId: classes[0].id }));
    if (!gradeForm.subjectId && subjects[0]) setGradeForm((previous) => ({ ...previous, subjectId: subjects[0].id }));
    const gradeFormSchoolYearId = classes.find((item) => item.id === gradeForm.classId)?.schoolYearId;
    const compatiblePeriodsForGradeForm = gradeFormSchoolYearId
      ? periods.filter((item) => item.schoolYearId === gradeFormSchoolYearId)
      : periods;
    if (!gradeForm.academicPeriodId && compatiblePeriodsForGradeForm[0]) {
      setGradeForm((previous) => ({ ...previous, academicPeriodId: compatiblePeriodsForGradeForm[0].id }));
    }

    if (!reportForm.studentId && students[0]) setReportForm((previous) => ({ ...previous, studentId: students[0].id }));
    if (!reportForm.classId && classes[0]) setReportForm((previous) => ({ ...previous, classId: classes[0].id }));
    const reportFormSchoolYearId = classes.find((item) => item.id === reportForm.classId)?.schoolYearId;
    const compatiblePeriodsForReportForm = reportFormSchoolYearId
      ? periods.filter((item) => item.schoolYearId === reportFormSchoolYearId)
      : periods;
    if (!reportForm.academicPeriodId && compatiblePeriodsForReportForm[0]) {
      setReportForm((previous) => ({ ...previous, academicPeriodId: compatiblePeriodsForReportForm[0].id }));
    }
  }, [
    classes,
    gradeForm.academicPeriodId,
    gradeForm.classId,
    gradeForm.studentId,
    gradeForm.subjectId,
    periods,
    reportForm.academicPeriodId,
    reportForm.classId,
    reportForm.studentId,
    students,
    subjects
  ]);

  useEffect(() => {
    const ensureCompatiblePeriod = (
      classId: string,
      academicPeriodId: string,
      setNextPeriodId: (periodId: string) => void
    ): void => {
      if (!classId || !academicPeriodId) return;
      const classroom = classes.find((item) => item.id === classId);
      const period = periods.find((item) => item.id === academicPeriodId);
      if (!classroom || !period || classroom.schoolYearId === period.schoolYearId) return;
      const fallback = periods.find((item) => item.schoolYearId === classroom.schoolYearId);
      setNextPeriodId(fallback?.id || "");
    };

    ensureCompatiblePeriod(gradeForm.classId, gradeForm.academicPeriodId, (nextPeriodId) => {
      if (nextPeriodId !== gradeForm.academicPeriodId) {
        setGradeForm((previous) => ({ ...previous, academicPeriodId: nextPeriodId }));
      }
    });

    ensureCompatiblePeriod(reportForm.classId, reportForm.academicPeriodId, (nextPeriodId) => {
      if (nextPeriodId !== reportForm.academicPeriodId) {
        setReportForm((previous) => ({ ...previous, academicPeriodId: nextPeriodId }));
      }
    });

    if (gradeFilters.classId && gradeFilters.academicPeriodId) {
      const classroom = classes.find((item) => item.id === gradeFilters.classId);
      const period = periods.find((item) => item.id === gradeFilters.academicPeriodId);
      if (classroom && period && classroom.schoolYearId !== period.schoolYearId) {
        setGradeFilters((previous) => ({ ...previous, academicPeriodId: "" }));
      }
    }
  }, [
    classes,
    gradeFilters.academicPeriodId,
    gradeFilters.classId,
    gradeForm.academicPeriodId,
    gradeForm.classId,
    periods,
    reportForm.academicPeriodId,
    reportForm.classId
  ]);

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
        onError(error instanceof Error ? error.message : "Erreur de chargement des notes.");
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
      onError(error instanceof Error ? error.message : "Erreur de chargement des bulletins.");
    }
  }, [api, initialReportCards, onError, remoteEnabled, setReportCardsAndNotify]);

  const submitGrade = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);

    const errors: FieldErrors = {};
    if (!gradeForm.studentId) errors.studentId = "Eleve requis.";
    if (!gradeForm.classId) errors.classId = "Classe requise.";
    if (!gradeForm.subjectId) errors.subjectId = "Matiere requise.";
    if (!gradeForm.academicPeriodId) errors.academicPeriodId = "Periode requise.";
    if (!gradeForm.assessmentLabel.trim()) errors.assessmentLabel = "Evaluation requise.";

    const score = Number(gradeForm.score);
    const scoreMax = Number(gradeForm.scoreMax || "20");

    if (!Number.isFinite(score) || score < 0) errors.score = "La note doit etre >= 0.";
    if (!Number.isFinite(scoreMax) || scoreMax <= 0) errors.scoreMax = "Le bareme doit etre > 0.";
    if (Number.isFinite(score) && Number.isFinite(scoreMax) && score > scoreMax) {
      errors.score = "La note ne peut pas depasser le bareme.";
    }
    if (!hasCompatibleClassPeriod(gradeForm.classId, gradeForm.academicPeriodId)) {
      errors.academicPeriodId = "La periode doit appartenir a la meme annee scolaire.";
    }

    setGradeErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("entry");
      return;
    }
    if (!remoteEnabled) {
      onNotice("Mode apercu local : note non persistee.");
      return;
    }

    try {
      await createGrade(api, {
        studentId: gradeForm.studentId,
        classId: gradeForm.classId,
        subjectId: gradeForm.subjectId,
        academicPeriodId: gradeForm.academicPeriodId,
        assessmentLabel: gradeForm.assessmentLabel.trim(),
        assessmentType: gradeForm.assessmentType,
        score,
        scoreMax
      });
      setGradeErrors({});
      onNotice("Note enregistree.");
      setGradesWorkflowStep("entry");
      setGradeForm((previous) => ({ ...previous, score: "" }));
      await loadGrades(gradeFilters);
      await loadReportCards();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur d'enregistrement de la note.");
    }
  };

  const applyGradeFilters = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);
    if (
      gradeFilters.classId &&
      gradeFilters.academicPeriodId &&
      !hasCompatibleClassPeriod(gradeFilters.classId, gradeFilters.academicPeriodId)
    ) {
      onError("La periode filtree doit appartenir a la meme annee scolaire que la classe.");
      return;
    }
    await loadGrades(gradeFilters);
  };

  const resetGradeFilters = async (): Promise<void> => {
    const next = buildGradeFilters();
    setGradeFilters(next);
    setClassSummary(null);
    await loadGrades(next);
  };

  const computeClassSummary = async (): Promise<void> => {
    if (!gradeFilters.classId || !gradeFilters.academicPeriodId) {
      onError("Selectionne d'abord une classe et une periode.");
      return;
    }
    if (!hasCompatibleClassPeriod(gradeFilters.classId, gradeFilters.academicPeriodId)) {
      onError("La periode doit appartenir a la meme annee scolaire que la classe selectionnee.");
      return;
    }
    if (!remoteEnabled) {
      onNotice("Mode apercu local : calcul non persiste.");
      return;
    }

    try {
      setClassSummary(await fetchClassSummary(api, gradeFilters.classId, gradeFilters.academicPeriodId));
      setGradesWorkflowStep("summary");
      onNotice("Synthese de classe calculee.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur de calcul de synthese.");
    }
  };

  const generateReport = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);

    const errors: FieldErrors = {};
    if (!reportForm.studentId) errors.studentId = "Eleve requis.";
    if (!reportForm.classId) errors.classId = "Classe requise.";
    if (!reportForm.academicPeriodId) errors.academicPeriodId = "Periode requise.";
    if (!hasCompatibleClassPeriod(reportForm.classId, reportForm.academicPeriodId)) {
      errors.academicPeriodId = "Classe et periode doivent etre dans la meme annee scolaire.";
    }

    setReportErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("reports");
      return;
    }
    if (!remoteEnabled) {
      onNotice("Mode apercu local : bulletin non persiste.");
      return;
    }

    try {
      const reportCard = await generateReportCard(api, {
        studentId: reportForm.studentId,
        classId: reportForm.classId,
        academicPeriodId: reportForm.academicPeriodId,
        publish: true
      });
      setReportErrors({});
      setReportPdfUrl(reportCard.pdfDataUrl || "");
      if (reportCard.pdfDataUrl) {
        window.open(reportCard.pdfDataUrl, "_blank", "noopener,noreferrer");
      }
      onNotice("Bulletin(s) genere(s).");
      setGradesWorkflowStep("reports");
      await loadReportCards();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur de generation du bulletin.");
    }
  };

  const openReportCardPdf = async (reportCardId: string): Promise<void> => {
    if (!remoteEnabled) {
      onNotice("Mode apercu local : PDF indisponible.");
      return;
    }

    try {
      const pdfDataUrl = await fetchReportCardPdf(api, reportCardId);
      setReportPdfUrl(pdfDataUrl);
      window.open(pdfDataUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur d'ouverture du bulletin.");
    }
  };

  const gradeSteps = useMemo(
    () => [
      { id: "filters", title: "Filtres", hint: "Cibler classe, matiere et periode." },
      { id: "entry", title: "Saisie", hint: "Enregistrer les notes de l'evaluation.", done: grades.length > 0 },
      { id: "summary", title: "Moyennes", hint: "Calculer moyenne generale et rangs.", done: !!classSummary },
      { id: "reports", title: "Bulletins", hint: "Generer les bulletins PDF.", done: reportCards.length > 0 }
    ],
    [classSummary, grades.length, reportCards.length]
  );

  return {
    applyGradeFilters,
    classSummary,
    computeClassSummary,
    generateReport,
    gradeErrors,
    gradeFilters,
    gradeForm,
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
    resetGradeFilters,
    setGradeFilters,
    setGradeForm,
    setGradesWorkflowStep,
    setReportForm,
    submitGrade
  };
};
