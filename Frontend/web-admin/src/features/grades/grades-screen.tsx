import type { JSX } from "react";

import { WorkflowGuide } from "../../shared/components/workflow-guide";
import type {
  AcademicTrack,
  ClassItem,
  FieldErrors,
  GradeEntry,
  Period,
  ReportCard,
  ReportCardMode,
  SchoolYear,
  Student,
  Subject
} from "../../shared/types/app";
import { useGradesData } from "./hooks/use-grades-data";
import type { GradesApiClient } from "./types/grades";
import { useI18n } from "../../shared/i18n-context";
import { ResponsiveForm } from "../../shared/components/responsive-form";

type GradesScreenProps = {
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

const renderFieldError = (errors: FieldErrors, key: string): JSX.Element | null =>
  errors[key] ? (
    <span className="field-error" role="alert">
      {errors[key]}
    </span>
  ) : null;

const formatStudentName = (student?: Student): string =>
  student ? student.fullName || `${student.firstName} ${student.lastName}`.trim() : "-";

const pluralize = (count: number, singular: string, plural: string): string =>
  `${count} ${count > 1 ? plural : singular}`;

const formatTrackLabel = (value?: AcademicTrack | "MIXED"): string => {
  if (value === "ARABOPHONE") return "Arabophone";
  if (value === "MIXED") return "Mixte";
  return "Francophone";
};

const formatAssessmentTypeLabel = (value?: string): string => {
  const labels: Record<string, string> = {
    DEVOIR: "Devoir",
    INTERROGATION: "Interrogation",
    COMPOSITION: "Composition",
    EXAMEN: "Examen",
    PROJET: "Projet",
    PARTICIPATION: "Participation",
    ORAL: "Oral",
    TP: "Travaux pratiques"
  };
  return labels[value || ""] || value || "-";
};

const formatReportCardModeLabel = (value?: ReportCardMode): string =>
  value === "PRIMARY_COMBINED" ? "Bulletin global primaire" : "Bulletin par cursus";

const formatDate = (value?: string): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR").format(date);
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
};

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

export function GradesScreen({
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
}: GradesScreenProps): JSX.Element {
  const { t: tr } = useI18n();
  const {
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
  } = useGradesData({
    api,
    initialReportCards,
    classes,
    students,
    subjects,
    periods,
    schoolYears,
    remoteEnabled,
    onReportCardsChange,
    onError,
    onNotice
  });

  const classById = new Map(classes.map((item) => [item.id, item]));
  const studentById = new Map(students.map((item) => [item.id, item]));
  const subjectById = new Map(subjects.map((item) => [item.id, item]));
  const periodById = new Map(periods.map((item) => [item.id, item]));
  const schoolYearById = new Map(schoolYears.map((item) => [item.id, item]));
  const filterClass = classById.get(gradeFilters.classId);
  const gradeFormClass = classById.get(gradeForm.classId);
  const reportFormClass = classById.get(reportForm.classId);
  const selectedSchoolYearId = gradeFilters.schoolYearId || filterClass?.schoolYearId || "";
  const reportSchoolYearId = reportForm.schoolYearId || reportFormClass?.schoolYearId || "";
  const filterClasses = selectedSchoolYearId
    ? classes.filter((item) => item.schoolYearId === selectedSchoolYearId)
    : classes;
  const filterPeriods = selectedSchoolYearId
    ? periods.filter((item) => item.schoolYearId === selectedSchoolYearId)
    : periods;
  const gradeFormPeriods = gradeFormClass
    ? periods.filter((item) => item.schoolYearId === gradeFormClass.schoolYearId)
    : periods;
  const reportFormClasses = reportSchoolYearId
    ? classes.filter((item) => item.schoolYearId === reportSchoolYearId)
    : classes;
  const reportFormPeriods = reportSchoolYearId
    ? periods.filter((item) => item.schoolYearId === reportSchoolYearId)
    : periods;
  const gridStudents = studentsForClass(students, gradeForm.classId, gradeForm.track);
  const filterStudents = studentsForClass(students, gradeFilters.classId, gradeFilters.track);
  const reportStudents = studentsForClass(students, reportForm.classId, reportForm.track);
  const selectedSummaryStudent = classSummary?.students.find(
    (student) => student.studentId === selectedSummaryStudentId
  );
  const hasMatchingSummary =
    Boolean(classSummary) &&
    classSummary?.classId === reportForm.classId &&
    classSummary?.academicPeriodId === reportForm.academicPeriodId;
  const contextGrades = grades.filter(
    (item) =>
      (!gradeFilters.classId || item.classId === gradeFilters.classId) &&
      (!gradeFilters.subjectId || item.subjectId === gradeFilters.subjectId) &&
      (!gradeFilters.academicPeriodId || item.academicPeriodId === gradeFilters.academicPeriodId) &&
      (!gradeFilters.studentId || item.studentId === gradeFilters.studentId) &&
      (gradeFilters.track === "MIXED" || item.track === gradeFilters.track)
  );
  const contextReportCards = reportCards.filter(
    (item) =>
      (!gradeFilters.classId || item.classId === gradeFilters.classId) &&
      (!gradeFilters.academicPeriodId || item.academicPeriodId === gradeFilters.academicPeriodId) &&
      (!gradeFilters.studentId || item.studentId === gradeFilters.studentId) &&
      (gradeFilters.track === "MIXED" || item.track === gradeFilters.track)
  );
  const contextSubjectCount = new Set(contextGrades.map((item) => item.subjectId)).size;
  const contextMissingGrades =
    classSummary && classSummary.classId === gradeFilters.classId && classSummary.academicPeriodId === gradeFilters.academicPeriodId
      ? classSummary.students.reduce((sum, item) => sum + (item.missingGrades ?? 0), 0)
      : 0;
  const reportMissingGrades =
    hasMatchingSummary && classSummary
      ? classSummary.students.reduce((sum, item) => sum + (item.missingGrades ?? 0), 0)
      : 0;
  const selectedSummarySubjectRows =
    selectedSummaryStudent?.subjectAverages?.map((subject) => {
      const subjectGrades = grades.filter(
        (grade) =>
          grade.studentId === selectedSummaryStudent.studentId &&
          grade.classId === classSummary?.classId &&
          grade.academicPeriodId === classSummary?.academicPeriodId &&
          grade.subjectId === subject.subjectId
      );
      return {
        ...subject,
        noteCount: subjectGrades.length,
        missingGrades: subjectGrades.length > 0 ? 0 : 1
      };
    }) || [];
  const isOverviewContextReady = Boolean(
    gradeFilters.schoolYearId && gradeFilters.classId && gradeFilters.academicPeriodId
  );
  const hasOverviewSummary =
    Boolean(classSummary) &&
    classSummary?.classId === gradeFilters.classId &&
    classSummary?.academicPeriodId === gradeFilters.academicPeriodId;

  const formatSchoolYearLabel = (schoolYearId?: string): string => {
    const schoolYear = schoolYearById.get(schoolYearId || "");
    return schoolYear?.label || schoolYear?.code || "-";
  };

  const formatReportCardAverage = (item: ReportCard): string => {
    if (item.mode === "PRIMARY_COMBINED" && item.sections && item.sections.length > 0) {
      return item.sections
        .map((section) => `${formatTrackLabel(section.track)} ${section.averageGeneral.toFixed(2)}`)
        .join(" | ");
    }
    return item.averageGeneral.toFixed(2);
  };

  const formatReportCardContext = (item: ReportCard): string => {
    if (item.mode === "PRIMARY_COMBINED" && item.sections && item.sections.length > 0) {
      return item.sections
        .map((section) =>
          [formatTrackLabel(section.track), section.classLabel || section.levelLabel].filter(Boolean).join(" / ")
        )
        .join(" | ");
    }
    return item.classLabel || classById.get(item.classId)?.label || "-";
  };

  const scrollToGrades = (stepId: string): void => {
    setGradesWorkflowStep(stepId);
    const targetByStep: Record<string, string> = {
      filters: "grades-filters",
      entry: "grades-entry",
      summary: "grades-summary",
      reports: "grades-reports"
    };
    const target = targetByStep[stepId];
    if (!target) return;
    window.setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const setClassOnGradeForm = (classId: string): void => {
    const classroom = classById.get(classId);
    const nextPeriodId =
      periods.find((period) => period.schoolYearId === classroom?.schoolYearId)?.id || gradeForm.academicPeriodId;
    setGradeForm((previous) => ({
      ...previous,
      classId,
      academicPeriodId: nextPeriodId,
      track: classroom?.track || previous.track
    }));
  };

  const setClassOnReportForm = (classId: string): void => {
    const classroom = classById.get(classId);
    const nextPeriodId =
      periods.find((period) => period.schoolYearId === classroom?.schoolYearId)?.id || reportForm.academicPeriodId;
    const nextStudents = studentsForClass(students, classId, classroom?.track);
    setReportForm((previous) => ({
      ...previous,
      schoolYearId: classroom?.schoolYearId || previous.schoolYearId,
      classId,
      academicPeriodId: nextPeriodId,
      track: classroom?.track || previous.track,
      studentId: nextStudents[0]?.id || previous.studentId
    }));
  };

  const editGrade = (item: GradeEntry): void => {
    setGradeForm((previous) => ({
      ...previous,
      classId: item.classId,
      subjectId: item.subjectId,
      academicPeriodId: item.academicPeriodId,
      track: item.track,
      assessmentLabel: item.assessmentLabel,
      assessmentType: item.assessmentType as typeof previous.assessmentType,
      assessmentDate: item.assessmentDate || previous.assessmentDate,
      scoreMax: String(item.scoreMax),
      coefficient: String(item.coefficient ?? 1),
      comment: item.comment || ""
    }));
    setGradesWorkflowStep("entry");
    window.setTimeout(() => {
      updateGradeRow(item.studentId, {
        placementId: item.placementId,
        score: item.absent || item.exempted ? "" : String(item.score),
        absent: item.absent,
        exempted: Boolean(item.exempted),
        comment: item.comment || ""
      });
    }, 0);
  };

  return (
    <WorkflowGuide
      title={tr("Notes & bulletins")}
      steps={gradeSteps}
      activeStepId={gradesWorkflowStep}
      onStepChange={scrollToGrades}
    >
      <section
        id="grades-filters"
        data-step-id="filters"
        className="panel table-panel workflow-section module-modern module-overview-shell"
      >
        <div className="table-header">
          <div>
            <p className="section-kicker">{tr("Contexte de travail")}</p>
            <h2>{tr("Vue d’ensemble")}</h2>
          </div>
          <span className="module-header-badge">{isOverviewContextReady ? tr("Contexte appliqué") : tr("À définir")}</span>
        </div>
        <p className="section-lead">
          {tr("Choisissez l’année scolaire, la classe et la période avant de saisir, calculer ou générer les bulletins.")}</p>
        <form className="filter-grid module-filter" onSubmit={(event) => void applyGradeFilters(event)}>
          <label>
            {tr("Année scolaire *")}<select
              value={gradeFilters.schoolYearId}
              onChange={(event) =>
                setGradeFilters((previous) => ({
                  ...previous,
                  schoolYearId: event.target.value,
                  classId: "",
                  academicPeriodId: "",
                  studentId: ""
                }))
              }
              required
            >
              <option value="">{tr("Choisir...")}</option>
              {schoolYears.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label || item.code}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("Classe *")}<select
              value={gradeFilters.classId}
              onChange={(event) => {
                const classId = event.target.value;
                const classroom = classById.get(classId);
                const nextPeriodId =
                  periods.find((period) => period.schoolYearId === classroom?.schoolYearId)?.id || "";
                setGradeFilters((previous) => ({
                  ...previous,
                  schoolYearId: classroom?.schoolYearId || previous.schoolYearId,
                  classId,
                  academicPeriodId: nextPeriodId,
                  track: classroom?.track || previous.track,
                  studentId: ""
                }));
              }}
              required
            >
              <option value="">{tr("Choisir...")}</option>
              {filterClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("Période *")}<select
              value={gradeFilters.academicPeriodId}
              onChange={(event) =>
                setGradeFilters((previous) => ({ ...previous, academicPeriodId: event.target.value }))
              }
              required
            >
              <option value="">{tr("Choisir...")}</option>
              {filterPeriods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("Cursus")}<select
              value={gradeFilters.track}
              onChange={(event) =>
                setGradeFilters((previous) => ({
                  ...previous,
                  track: event.target.value as typeof previous.track,
                  studentId: ""
                }))
              }
            >
              <option value="MIXED">{tr("Tous les cursus")}</option>
              <option value="FRANCOPHONE">{tr("Francophone")}</option>
              <option value="ARABOPHONE">{tr("Arabophone")}</option>
            </select>
          </label>
          <label>
            {tr("Élève")}<select
              value={gradeFilters.studentId}
              onChange={(event) => setGradeFilters((previous) => ({ ...previous, studentId: event.target.value }))}
            >
              <option value="">{tr("Tous")}</option>
              {filterStudents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.matricule} - {formatStudentName(item)}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button type="submit">{tr("Afficher les données")}</button>
            <button type="button" className="button-ghost" onClick={() => void resetGradeFilters()}>
              {tr("Réinitialiser les filtres")}</button>
          </div>
        </form>
        <div className="module-overview-grid">
          <article className="module-overview-card">
            <span>{tr("Notes saisies")}</span>
            <strong>{contextGrades.length}</strong>
            <small>{isOverviewContextReady ? tr("Dans le contexte choisi") : tr("Tous contextes")}</small>
          </article>
          <article className="module-overview-card">
            <span>{tr("Élèves concernés")}</span>
            <strong>{isOverviewContextReady ? filterStudents.length : students.length}</strong>
            <small>{gradeFilters.studentId ? tr("Lecture ciblée") : tr("Dossiers concernés")}</small>
          </article>
          <article className="module-overview-card">
            <span>{tr("Matières évaluées")}</span>
            <strong>{contextSubjectCount}</strong>
            <small>{contextSubjectCount > 0 ? tr("Matières avec notes") : tr("Aucune matière évaluée")}</small>
          </article>
          <article className="module-overview-card">
            <span>{tr("Bulletins générés")}</span>
            <strong>{contextReportCards.length}</strong>
            <small>{tr("Bulletins PDF disponibles")}</small>
          </article>
          <article className="module-overview-card">
            <span>{tr("Moyennes calculées")}</span>
            <strong>{hasOverviewSummary ? classSummary?.students.length || 0 : 0}</strong>
            <small>{hasOverviewSummary && summaryComputedAt ? <>{tr("Calculées le")} {formatDateTime(summaryComputedAt)}</> : tr("Moyennes non calculées")}</small>
          </article>
          <article className="module-overview-card">
            <span>{tr("Notes manquantes")}</span>
            <strong>{hasOverviewSummary ? contextMissingGrades : "-"}</strong>
            <small>{hasOverviewSummary ? tr("Après calcul") : tr("À vérifier après calcul")}</small>
          </article>
        </div>
        <div className="module-inline-strip">
          <span className="module-inline-pill">{tr("Année : ")}{formatSchoolYearLabel(gradeFilters.schoolYearId)}</span>
          <span className="module-inline-pill">{tr("Classe : ")}{filterClass?.label || "-"}</span>
          <span className="module-inline-pill">{tr("Période : ")}{periodById.get(gradeFilters.academicPeriodId)?.label || "-"}</span>
          <span className="module-inline-pill">{tr("Cursus : ")}{tr(formatTrackLabel(gradeFilters.track))}</span>
          <span className="module-inline-pill">
            {reportsGeneratedAt ? <>{tr("Bulletins générés le")} {formatDateTime(reportsGeneratedAt)}</> : tr("Bulletins non régénérés")}
          </span>
        </div>
        {!isOverviewContextReady ? (
          <p className="empty-row">{tr("Sélectionnez un contexte pour afficher les indicateurs de travail.")}</p>
        ) : contextGrades.length === 0 ? (
          <p className="empty-row">{tr("Aucune note enregistrée pour ce contexte. Saisissez d’abord une évaluation.")}</p>
        ) : !hasOverviewSummary ? (
          <p className="empty-row">{tr("Des notes existent pour ce contexte. Calculez les moyennes depuis l’onglet Moyennes & rangs.")}</p>
        ) : null}
      </section>

      <section id="grades-entry" data-step-id="entry" className="panel editor-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">{tr("Saisie")}</p>
            <h2>{tr("Saisie des notes par évaluation")}</h2>
          </div>
          <span className="module-header-badge">{tr("Validation par ligne")}</span>
        </div>
        <p className="section-lead">
          {tr("Créez une évaluation, puis saisissez les notes des élèves dans une grille unique.")}</p>
        <ResponsiveForm className="module-form" formTitle={tr("Saisie des notes par évaluation")} onSubmit={(event) => void submitGradesBulk(event)}>
          <div className="form-grid">
            <label>
              {tr("Classe *")}<select value={gradeForm.classId} onChange={(event) => setClassOnGradeForm(event.target.value)} required>
                <option value="">{tr("Choisir...")}</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {renderFieldError(gradeErrors, "classId")}
            </label>
            <label>
              {tr("Matière *")}<select
                value={gradeForm.subjectId}
                onChange={(event) => setGradeForm((previous) => ({ ...previous, subjectId: event.target.value }))}
                required
              >
                <option value="">{tr("Choisir...")}</option>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {renderFieldError(gradeErrors, "subjectId")}
            </label>
            <label>
              {tr("Période *")}<select
                value={gradeForm.academicPeriodId}
                onChange={(event) =>
                  setGradeForm((previous) => ({ ...previous, academicPeriodId: event.target.value }))
                }
                required
              >
                <option value="">{tr("Choisir...")}</option>
                {gradeFormPeriods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {renderFieldError(gradeErrors, "academicPeriodId")}
            </label>
            <label>
              {tr("Type d’évaluation *")}<select
                value={gradeForm.assessmentType}
                onChange={(event) =>
                  setGradeForm((previous) => ({
                    ...previous,
                    assessmentType: event.target.value as typeof previous.assessmentType
                  }))
                }
                required
              >
                <option value="DEVOIR">{tr("Devoir")}</option>
                <option value="INTERROGATION">{tr("Interrogation")}</option>
                <option value="COMPOSITION">{tr("Composition")}</option>
                <option value="EXAMEN">{tr("Examen")}</option>
                <option value="PROJET">{tr("Projet")}</option>
                <option value="PARTICIPATION">{tr("Participation")}</option>
              </select>
            </label>
            <label>
              {tr("Libellé de l’évaluation *")}<input
                value={gradeForm.assessmentLabel}
                onChange={(event) => setGradeForm((previous) => ({ ...previous, assessmentLabel: event.target.value }))}
                required
              />
              {renderFieldError(gradeErrors, "assessmentLabel")}
            </label>
            <label>
              {tr("Date d’évaluation *")}<input
                type="date"
                value={gradeForm.assessmentDate}
                onChange={(event) => setGradeForm((previous) => ({ ...previous, assessmentDate: event.target.value }))}
                required
              />
              {renderFieldError(gradeErrors, "assessmentDate")}
            </label>
            <label>
              {tr("Barème *")}<input
                type="number"
                min={1}
                step="0.01"
                value={gradeForm.scoreMax}
                onChange={(event) => setGradeForm((previous) => ({ ...previous, scoreMax: event.target.value }))}
                required
              />
              {renderFieldError(gradeErrors, "scoreMax")}
            </label>
            <label>
              {tr("Coefficient *")}<input
                type="number"
                min={0.01}
                step="0.01"
                value={gradeForm.coefficient}
                onChange={(event) => setGradeForm((previous) => ({ ...previous, coefficient: event.target.value }))}
                required
              />
              {renderFieldError(gradeErrors, "coefficient")}
            </label>
            <label>
              {tr("Cursus *")}<select
                value={gradeForm.track}
                onChange={(event) =>
                  setGradeForm((previous) => ({
                    ...previous,
                    track: event.target.value as typeof previous.track
                  }))
                }
                required
              >
                <option value="MIXED">{tr("Mixte")}</option>
                <option value="FRANCOPHONE">{tr("Francophone")}</option>
                <option value="ARABOPHONE">{tr("Arabophone")}</option>
              </select>
            </label>
            <label>
              {tr("Commentaire")}<input
                value={gradeForm.comment}
                onChange={(event) => setGradeForm((previous) => ({ ...previous, comment: event.target.value }))}
              />
            </label>
          </div>
          <div className="table-wrap">
            <table data-responsive-table="true">
              <thead>
                <tr>
                  <th>{tr("Élève")}</th>
                  <th>{tr("Matricule")}</th>
                  <th>{tr("Note")}</th>
                  <th>{tr("Absent")}</th>
                  <th>{tr("Dispensé")}</th>
                  <th>{tr("Commentaire")}</th>
                  <th>{tr("Statut")}</th>
                </tr>
              </thead>
              <tbody>
                {gridStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-row">
                      {tr("Aucun élève disponible pour cette classe.")}</td>
                  </tr>
                ) : (
                  gridStudents.map((student) => {
                    const row = gradeRows.find((item) => item.studentId === student.id);
                    const scoreError = gradeRowErrors[`score-${student.id}`];
                    return (
                      <tr key={student.id}>
                        <td data-label={tr("Élève")}>{formatStudentName(student)}</td>
                        <td data-label={tr("Matricule")}>{student.matricule}</td>
                        <td data-label={tr("Note")}>
                          <label className="inline-field">
                            <span className="sr-only">{tr("Note de ")}{formatStudentName(student)}</span>
                            <input
                              type="number"
                              min={0}
                              max={Number(gradeForm.scoreMax) || undefined}
                              step="0.01"
                              value={row?.score || ""}
                              disabled={row?.absent || row?.exempted}
                              onChange={(event) => updateGradeRow(student.id, { score: event.target.value })}
                            />
                            {scoreError ? <span className="field-error" role="alert">{scoreError}</span> : null}
                          </label>
                        </td>
                        <td data-label={tr("Absent")}>
                          <input
                            type="checkbox"
                            checked={Boolean(row?.absent)}
                            onChange={(event) =>
                              updateGradeRow(student.id, {
                                absent: event.target.checked,
                                exempted: event.target.checked ? false : Boolean(row?.exempted),
                                score: event.target.checked ? "" : row?.score || ""
                              })
                            }
                            aria-label={`Absent ${formatStudentName(student)}`}
                          />
                        </td>
                        <td data-label={tr("Dispensé")}>
                          <input
                            type="checkbox"
                            checked={Boolean(row?.exempted)}
                            onChange={(event) =>
                              updateGradeRow(student.id, {
                                exempted: event.target.checked,
                                absent: event.target.checked ? false : Boolean(row?.absent),
                                score: event.target.checked ? "" : row?.score || ""
                              })
                            }
                            aria-label={`Dispensé ${formatStudentName(student)}`}
                          />
                        </td>
                        <td data-label={tr("Commentaire")}>
                          <input
                            value={row?.comment || ""}
                            onChange={(event) => updateGradeRow(student.id, { comment: event.target.value })}
                            aria-label={`Commentaire ${formatStudentName(student)}`}
                          />
                        </td>
                        <td data-label={tr("Statut")}>{row?.absent ? tr("Absent") : row?.exempted ? tr("Dispensé") : row?.score ? tr("Prêt") : tr("À saisir")}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {renderFieldError(gradeErrors, "grades")}
          <div className="actions">
            <button type="submit">{tr("Enregistrer les notes")}</button>
            <button type="button" className="button-ghost" onClick={resetGradeEntry}>
              {tr("Réinitialiser la saisie")}</button>
            <button type="button" className="button-ghost" onClick={() => scrollToGrades("filters")}>
              {tr("Retour à la vue d’ensemble")}</button>
          </div>
        </ResponsiveForm>
      </section>

      <section data-step-id="entry" className="panel table-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">{tr("Registre")}</p>
            <h2>{tr("Notes enregistrées")}</h2>
          </div>
          <span className="module-header-badge">{pluralize(grades.length, "ligne", "lignes")}</span>
        </div>
        <div className="table-wrap">
          <table data-responsive-table="true">
            <thead>
              <tr>
                <th>{tr("Élève")}</th>
                <th>{tr("Classe")}</th>
                <th>{tr("Matière")}</th>
                <th>{tr("Période")}</th>
                <th>{tr("Évaluation")}</th>
                <th>{tr("Type")}</th>
                <th>{tr("Note")}</th>
                <th>{tr("Barème")}</th>
                <th>{tr("Coefficient")}</th>
                <th>{tr("Date")}</th>
                <th>{tr("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {grades.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty-row">
                    {tr("Aucune note enregistrée.")}</td>
                </tr>
              ) : (
                grades.map((item) => (
                  <tr key={item.id}>
                    <td data-label={tr("Élève")}>{item.studentName || formatStudentName(studentById.get(item.studentId))}</td>
                    <td data-label={tr("Classe")}>{classById.get(item.classId)?.label || "-"}</td>
                    <td data-label={tr("Matière")}>{item.subjectLabel || subjectById.get(item.subjectId)?.label || "-"}</td>
                    <td data-label={tr("Période")}>{periodById.get(item.academicPeriodId)?.label || "-"}</td>
                    <td data-label={tr("Évaluation")}>{item.assessmentLabel}</td>
                    <td data-label={tr("Type")}>{tr(formatAssessmentTypeLabel(item.assessmentType))}</td>
                    <td data-label={tr("Note")}>{item.absent ? tr("Absent") : item.exempted ? tr("Dispensé") : item.score.toFixed(2)}</td>
                    <td data-label={tr("Barème")}>{item.scoreMax}</td>
                    <td data-label={tr("Coefficient")}>{item.coefficient ?? 1}</td>
                    <td data-label={tr("Date")}>{formatDate(item.assessmentDate)}</td>
                    <td data-label={tr("Actions")}>
                      <div className="actions">
                        <button type="button" className="button-ghost" onClick={() => editGrade(item)}>
                          {tr("Modifier")}</button>
                        <button type="button" className="button-danger" onClick={() => void removeGrade(item.id)}>
                          {tr("Supprimer")}</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="grades-summary" data-step-id="summary" className="panel table-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">{tr("Synthèse")}</p>
            <h2>{tr("Moyennes & rangs")}</h2>
          </div>
          <span className="module-header-badge">{pluralize(classSummary?.students.length || 0, "ligne", "lignes")}</span>
        </div>
        <p className="section-lead">
          {summaryComputedAt
            ? <>{tr("Moyennes et rangs calculés le")} {formatDateTime(summaryComputedAt)}.</>
            : tr("Calculez les moyennes à partir du contexte choisi dans la vue d’ensemble.")}
        </p>
        {classSummary && classSummary.students.length > 0 ? (
          <div className="actions">
            <button type="button" onClick={() => void computeClassSummary()}>
              {tr("Recalculer les moyennes/rangs")}</button>
            <button type="button" className="button-ghost" onClick={() => void computeClassSummary()}>
              {tr("Actualiser les résultats")}</button>
          </div>
        ) : null}
        {classSummary && classSummary.students.length > 0 ? (
          <>
            <div className="table-wrap">
              <table data-responsive-table="true">
                <thead>
                  <tr>
                    <th>{tr("Rang")}</th>
                    <th>{tr("Élève")}</th>
                    <th>{tr("Matricule")}</th>
                    <th>{tr("Moyenne générale")}</th>
                    <th>{tr("Nombre de matières")}</th>
                    <th>{tr("Notes manquantes")}</th>
                    <th>{tr("Appréciation")}</th>
                    <th>{tr("Statut")}</th>
                    <th>{tr("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {classSummary.students
                    .slice()
                    .sort((left, right) => left.classRank - right.classRank)
                    .map((item) => {
                      const isDetailOpen = selectedSummaryStudentId === item.studentId;
                      return (
                        <tr key={item.studentId} className={isDetailOpen ? "is-selected-row" : undefined}>
                          <td data-label={tr("Rang")}>{item.classRank}</td>
                          <td data-label={tr("Élève")}>{item.studentName}</td>
                          <td data-label={tr("Matricule")}>{item.matricule}</td>
                          <td data-label={tr("Moyenne générale")}>{item.averageGeneral.toFixed(2)}</td>
                          <td data-label={tr("Nombre de matières")}>{item.noteCount}</td>
                          <td data-label={tr("Notes manquantes")}>{item.missingGrades ?? 0}</td>
                          <td data-label={tr("Appréciation")}>{item.appreciation}</td>
                          <td data-label={tr("Statut")}>{item.noteCount > 0 ? tr("Calculé") : tr("Incomplet")}</td>
                          <td data-label={tr("Actions")}>
                            <button
                              type="button"
                              className={`button-ghost${isDetailOpen ? " is-active" : ""}`}
                              aria-expanded={isDetailOpen}
                              onClick={() => setSelectedSummaryStudentId(item.studentId)}
                            >
                              {isDetailOpen ? tr("Détail ouvert") : tr("Voir détail")}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {selectedSummaryStudent ? (
              <div className="panel nested-panel">
                <div className="table-header">
                  <div>
                    <p className="section-kicker">{tr("Détail élève")}</p>
                    <h3>{selectedSummaryStudent.studentName}</h3>
                  </div>
                  <span className="module-header-badge">{tr(formatTrackLabel(selectedSummaryStudent.track))}</span>
                </div>
                <div className="table-wrap">
                  <table data-responsive-table="true">
                    <thead>
                      <tr>
                        <th>{tr("Matière")}</th>
                        <th>{tr("Moyenne matière")}</th>
                        <th>{tr("Coefficient")}</th>
                        <th>{tr("Nombre de notes")}</th>
                        <th>{tr("Notes manquantes")}</th>
                        <th>{tr("Appréciation")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSummarySubjectRows.length > 0 ? (
                        selectedSummarySubjectRows.map((subject) => (
                          <tr key={subject.subjectId}>
                            <td data-label={tr("Matière")}>{subject.subjectLabel}</td>
                            <td data-label={tr("Moyenne matière")}>{subject.average.toFixed(2)}</td>
                            <td data-label={tr("Coefficient")}>{subject.coefficient ?? 1}</td>
                            <td data-label={tr("Nombre de notes")}>{subject.noteCount}</td>
                            <td data-label={tr("Notes manquantes")}>{subject.missingGrades}</td>
                            <td data-label={tr("Appréciation")}>{subject.average >= 14 ? tr("Très bien") : subject.average >= 10 ? tr("Satisfaisant") : tr("À renforcer")}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="empty-row">
                            {tr("Aucun détail de matière disponible.")}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="empty-state-block">
            <p className="subtle">{tr("Aucune moyenne calculée pour l’instant.")}</p>
            <button type="button" onClick={() => void computeClassSummary()}>
              {tr("Calculer les moyennes/rangs")}</button>
          </div>
        )}
      </section>

      <section id="grades-reports" data-step-id="reports" className="panel editor-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">{tr("Publication")}</p>
            <h2>{tr("Génération des bulletins")}</h2>
          </div>
          <span className="module-header-badge">{pluralize(reportCards.length, "bulletin", "bulletins")}</span>
        </div>
        <p className="section-lead">
          {tr("Générez un bulletin individuel ou les bulletins de toute une classe après calcul des moyennes.")}</p>
        <ResponsiveForm className="module-form" formTitle={tr("Génération des bulletins")} onSubmit={(event) => void generateReport(event)}>
          <div className="form-grid">
            <label>
              {tr("Année scolaire *")}<select
                value={reportForm.schoolYearId}
                onChange={(event) =>
                  setReportForm((previous) => ({
                    ...previous,
                    schoolYearId: event.target.value,
                    classId: "",
                    academicPeriodId: "",
                    studentId: ""
                  }))
                }
                required
              >
                <option value="">{tr("Choisir...")}</option>
                {schoolYears.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label || item.code}
                  </option>
                ))}
              </select>
              {renderFieldError(reportErrors, "schoolYearId")}
            </label>
            <label>
              {tr("Classe *")}<select value={reportForm.classId} onChange={(event) => setClassOnReportForm(event.target.value)} required>
                <option value="">{tr("Choisir...")}</option>
                {reportFormClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {renderFieldError(reportErrors, "classId")}
            </label>
            <label>
              {tr("Période *")}<select
                value={reportForm.academicPeriodId}
                onChange={(event) =>
                  setReportForm((previous) => ({ ...previous, academicPeriodId: event.target.value }))
                }
                required
              >
                <option value="">{tr("Choisir...")}</option>
                {reportFormPeriods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {renderFieldError(reportErrors, "academicPeriodId")}
            </label>
            <label>
              {tr("Cursus *")}<select
                value={reportForm.track}
                onChange={(event) =>
                  setReportForm((previous) => ({ ...previous, track: event.target.value as typeof previous.track }))
                }
                required
              >
                <option value="MIXED">{tr("Mixte")}</option>
                <option value="FRANCOPHONE">{tr("Francophone")}</option>
                <option value="ARABOPHONE">{tr("Arabophone")}</option>
              </select>
            </label>
            <label>
              {tr("Mode *")}<select
                value={reportForm.mode}
                onChange={(event) =>
                  setReportForm((previous) => ({ ...previous, mode: event.target.value as typeof previous.mode }))
                }
                required
              >
                <option value="student">{tr("Générer pour un élève")}</option>
                <option value="class">{tr("Générer pour toute la classe")}</option>
              </select>
            </label>
            <label>
              {tr("Élève ")}{reportForm.mode === "student" ? "*" : ""}
              <select
                value={reportForm.studentId}
                onChange={(event) => setReportForm((previous) => ({ ...previous, studentId: event.target.value }))}
                disabled={reportForm.mode === "class"}
                required={reportForm.mode === "student"}
              >
                <option value="">{tr("Choisir...")}</option>
                {reportStudents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.matricule} - {formatStudentName(item)}
                  </option>
                ))}
              </select>
              {renderFieldError(reportErrors, "studentId")}
            </label>
          </div>
          <div className="module-inline-strip">
            <label className="module-inline-pill">
              <input
                type="checkbox"
                checked={reportForm.regenerateExisting}
                onChange={(event) =>
                  setReportForm((previous) => ({ ...previous, regenerateExisting: event.target.checked }))
                }
              />
              {tr("Régénérer les PDF existants")}</label>
            <label className="module-inline-pill">
              <input
                type="checkbox"
                checked={reportForm.publish}
                onChange={(event) => setReportForm((previous) => ({ ...previous, publish: event.target.checked }))}
              />
              {tr("Publier dans le portail")}</label>
          </div>
          {!hasMatchingSummary ? (
            <p className="empty-row">{tr("Calculez d’abord les moyennes et rangs avant de générer les bulletins.")}</p>
          ) : reportMissingGrades > 0 ? (
            <p className="empty-row">
              {tr("Attention : ")}{reportMissingGrades} {tr("note")}{reportMissingGrades > 1 ? "s" : ""} {tr("manquante")}{reportMissingGrades > 1 ? "s" : ""}
              {tr(". Une confirmation sera demandée avant génération.")}</p>
          ) : null}
          <div className="actions">
            <button type="submit" disabled={!hasMatchingSummary}>
              {reportForm.mode === "class" ? tr("Générer les bulletins de la classe") : tr("Générer le bulletin")}
            </button>
            <button type="button" className="button-ghost" onClick={() => void loadReportCards()}>
              {tr("Actualiser les bulletins")}</button>
            {reportPdfUrl ? (
              <button
                type="button"
                className="button-ghost"
                onClick={() => window.open(reportPdfUrl, "_blank", "noopener,noreferrer")}
              >
                {tr("Voir le dernier PDF")}</button>
            ) : null}
          </div>
        </ResponsiveForm>
      </section>

      <section data-step-id="reports" className="panel table-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">{tr("Bibliothèque")}</p>
            <h2>{tr("Bulletins générés")}</h2>
          </div>
          <span className="module-header-badge">{pluralize(reportCards.length, "fichier", "fichiers")}</span>
        </div>
        <div className="table-wrap">
          <table data-responsive-table="true">
            <thead>
              <tr>
                <th>{tr("Élève")}</th>
                <th>{tr("Classe")}</th>
                <th>{tr("Type de bulletin")}</th>
                <th>{tr("Cursus")}</th>
                <th>{tr("Période")}</th>
                <th>{tr("Moyenne")}</th>
                <th>{tr("Rang")}</th>
                <th>{tr("Appréciation")}</th>
                <th>{tr("Statut")}</th>
                <th>{tr("Généré le")}</th>
                <th>{tr("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {reportCards.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty-row">
                    {tr("Aucun bulletin généré.")}</td>
                </tr>
              ) : (
                reportCards.map((item) => (
                  <tr key={item.id}>
                    <td data-label={tr("Élève")}>{item.studentName || formatStudentName(studentById.get(item.studentId))}</td>
                    <td data-label={tr("Classe")}>{formatReportCardContext(item)}</td>
                    <td data-label={tr("Type de bulletin")}>{tr(formatReportCardModeLabel(item.mode))}</td>
                    <td data-label={tr("Cursus")}>{tr(formatTrackLabel(item.track))}</td>
                    <td data-label={tr("Période")}>{item.periodLabel || periodById.get(item.academicPeriodId)?.label || "-"}</td>
                    <td data-label={tr("Moyenne")}>{formatReportCardAverage(item)}</td>
                    <td data-label={tr("Rang")}>{item.classRank || "-"}</td>
                    <td data-label={tr("Appréciation")}>{item.appreciation || "-"}</td>
                    <td data-label={tr("Statut")}>{item.publishedAt ? tr("Publié") : tr("Généré")}</td>
                    <td data-label={tr("Généré le")}>
                      {item.generatedAt || item.publishedAt || reportsGeneratedAt
                        ? formatDateTime(item.generatedAt || item.publishedAt || reportsGeneratedAt)
                        : "-"}
                    </td>
                    <td data-label={tr("Actions")}>
                      <div className="actions">
                        <button type="button" className="button-ghost" onClick={() => void openReportCardPdf(item.id)}>
                          {tr("Ouvrir PDF")}</button>
                        <button type="button" className="button-ghost" onClick={() => void downloadReportCardPdf(item.id)}>
                          {tr("Télécharger PDF")}</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </WorkflowGuide>
  );
}
