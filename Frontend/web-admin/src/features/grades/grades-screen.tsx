import type { JSX } from "react";

import { WorkflowGuide } from "../../shared/components/workflow-guide";
import type {
  AcademicTrack,
  ClassItem,
  FieldErrors,
  Period,
  ReportCard,
  ReportCardMode,
  Student,
  Subject
} from "../../shared/types/app";
import { useGradesData } from "./hooks/use-grades-data";
import type { GradesApiClient } from "./types/grades";

type GradesScreenProps = {
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

const renderFieldError = (errors: FieldErrors, key: string): JSX.Element | null =>
  errors[key] ? (
    <span className="field-error" role="alert">
      {errors[key]}
    </span>
  ) : null;

const formatAcademicTrackLabel = (value?: AcademicTrack): string =>
  value === "ARABOPHONE" ? "Arabophone" : "Francophone";

const formatReportCardModeLabel = (value?: ReportCardMode): string =>
  value === "PRIMARY_COMBINED" ? "Bulletin primaire combine" : "Bulletin par cursus";

export function GradesScreen({
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
}: GradesScreenProps): JSX.Element {
  const {
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
  } = useGradesData({
    api,
    initialReportCards,
    classes,
    students,
    subjects,
    periods,
    remoteEnabled,
    onReportCardsChange,
    onError,
    onNotice
  });

  const classById = new Map(classes.map((item) => [item.id, item]));
  const studentById = new Map(students.map((item) => [item.id, item]));
  const gradeFilterClass = classById.get(gradeFilters.classId);
  const gradeFormClass = classById.get(gradeForm.classId);
  const reportFormClass = classById.get(reportForm.classId);
  const gradeFilterPeriods = gradeFilterClass
    ? periods.filter((item) => item.schoolYearId === gradeFilterClass.schoolYearId)
    : periods;
  const gradeFormPeriods = gradeFormClass
    ? periods.filter((item) => item.schoolYearId === gradeFormClass.schoolYearId)
    : periods;
  const reportFormPeriods = reportFormClass
    ? periods.filter((item) => item.schoolYearId === reportFormClass.schoolYearId)
    : periods;

  const formatReportCardAverage = (item: ReportCard): string => {
    if (item.mode === "PRIMARY_COMBINED" && item.sections && item.sections.length > 0) {
      return item.sections
        .map((section) => `${formatAcademicTrackLabel(section.track)} ${section.averageGeneral.toFixed(2)}`)
        .join(" | ");
    }
    return item.averageGeneral.toFixed(2);
  };

  const formatReportCardContext = (item: ReportCard): string => {
    if (item.mode === "PRIMARY_COMBINED" && item.sections && item.sections.length > 0) {
      return item.sections
        .map((section) =>
          [formatAcademicTrackLabel(section.track), section.classLabel || section.levelLabel]
            .filter(Boolean)
            .join(" / ")
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

  const classSummaryCount = classSummary?.students.length || 0;

  return (
    <WorkflowGuide
      title="Notes & bulletins"
      steps={gradeSteps}
      activeStepId={gradesWorkflowStep}
      onStepChange={scrollToGrades}
    >
      <section data-step-id="filters" className="panel table-panel workflow-section module-modern module-overview-shell">
        <div className="table-header">
          <div>
            <p className="section-kicker">Evaluation</p>
            <h2>Console notes & bulletins</h2>
          </div>
          <span className="module-header-badge">{grades.length} note(s)</span>
        </div>
        <p className="section-lead">
          Passe finale plus stricte: filtres, saisie, resume et PDF dans le meme langage visuel,
          avec des cartes internes plus denses et mieux cadencees.
        </p>
        <div className="module-overview-grid">
          <article className="module-overview-card">
            <span>Notes</span>
            <strong>{grades.length}</strong>
            <small>Evaluations enregistrees</small>
          </article>
          <article className="module-overview-card">
            <span>Bulletins</span>
            <strong>{reportCards.length}</strong>
            <small>PDF disponibles</small>
          </article>
          <article className="module-overview-card">
            <span>Matieres</span>
            <strong>{subjects.length}</strong>
            <small>Catalogue actif</small>
          </article>
          <article className="module-overview-card">
            <span>Resume</span>
            <strong>{classSummaryCount}</strong>
            <small>Lignes de moyennes calculees</small>
          </article>
        </div>
        <div className="module-inline-strip">
          <span className="module-inline-pill">{classes.length} classe(s)</span>
          <span className="module-inline-pill">{periods.length} periode(s)</span>
          <span className="module-inline-pill">{students.length} eleve(s)</span>
        </div>
      </section>

      <section id="grades-filters" data-step-id="filters" className="panel table-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">Perimetre</p>
            <h2>Filtres notes</h2>
          </div>
          <span className="module-header-badge">Lecture rapide</span>
        </div>
        <p className="section-lead">Ciblez une classe, une matiere et une periode pour travailler sans surcharge.</p>
        <form className="filter-grid module-filter" onSubmit={(event) => void applyGradeFilters(event)}>
          <label>
            Classe
            <select
              value={gradeFilters.classId}
              onChange={(event) => setGradeFilters((previous) => ({ ...previous, classId: event.target.value }))}
            >
              <option value="">Toutes</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Matiere
            <select
              value={gradeFilters.subjectId}
              onChange={(event) => setGradeFilters((previous) => ({ ...previous, subjectId: event.target.value }))}
            >
              <option value="">Toutes</option>
              {subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Periode
            <select
              value={gradeFilters.academicPeriodId}
              onChange={(event) =>
                setGradeFilters((previous) => ({ ...previous, academicPeriodId: event.target.value }))
              }
            >
              <option value="">Toutes</option>
              {gradeFilterPeriods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Eleve
            <select
              value={gradeFilters.studentId}
              onChange={(event) => setGradeFilters((previous) => ({ ...previous, studentId: event.target.value }))}
            >
              <option value="">Tous</option>
              {students.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.matricule} - {item.firstName} {item.lastName}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button type="submit">Filtrer</button>
            <button type="button" className="button-ghost" onClick={() => void resetGradeFilters()}>
              Reinitialiser
            </button>
            <button type="button" className="button-ghost" onClick={() => void computeClassSummary()}>
              Calculer moyennes/rangs
            </button>
          </div>
        </form>
      </section>

      <section id="grades-entry" data-step-id="entry" className="panel editor-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">Saisie</p>
            <h2>Saisie note</h2>
          </div>
          <span className="module-header-badge">Validation inline</span>
        </div>
        <p className="section-lead">Saisissez une evaluation a la fois avec validations inline.</p>
        <form className="form-grid module-form" onSubmit={(event) => void submitGrade(event)}>
          <label>
            Eleve
            <select
              value={gradeForm.studentId}
              onChange={(event) => setGradeForm((previous) => ({ ...previous, studentId: event.target.value }))}
              required
            >
              <option value="">Choisir...</option>
              {students.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.matricule} - {item.firstName} {item.lastName}
                </option>
              ))}
            </select>
            {renderFieldError(gradeErrors, "studentId")}
          </label>
          <label>
            Classe
            <select
              value={gradeForm.classId}
              onChange={(event) => setGradeForm((previous) => ({ ...previous, classId: event.target.value }))}
              required
            >
              <option value="">Choisir...</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.label}
                </option>
              ))}
            </select>
            {renderFieldError(gradeErrors, "classId")}
          </label>
          <label>
            Matiere
            <select
              value={gradeForm.subjectId}
              onChange={(event) => setGradeForm((previous) => ({ ...previous, subjectId: event.target.value }))}
              required
            >
              <option value="">Choisir...</option>
              {subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.label}
                </option>
              ))}
            </select>
            {renderFieldError(gradeErrors, "subjectId")}
          </label>
          <label>
            Periode
            <select
              value={gradeForm.academicPeriodId}
              onChange={(event) =>
                setGradeForm((previous) => ({ ...previous, academicPeriodId: event.target.value }))
              }
              required
            >
              <option value="">Choisir...</option>
              {gradeFormPeriods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.label}
                </option>
              ))}
            </select>
            {renderFieldError(gradeErrors, "academicPeriodId")}
          </label>
          <label>
            Evaluation
            <input
              value={gradeForm.assessmentLabel}
              onChange={(event) => setGradeForm((previous) => ({ ...previous, assessmentLabel: event.target.value }))}
              required
            />
            {renderFieldError(gradeErrors, "assessmentLabel")}
          </label>
          <label>
            Type
            <select
              value={gradeForm.assessmentType}
              onChange={(event) =>
                setGradeForm((previous) => ({
                  ...previous,
                  assessmentType: event.target.value as "DEVOIR" | "COMPOSITION" | "ORAL" | "TP"
                }))
              }
            >
              <option value="DEVOIR">DEVOIR</option>
              <option value="COMPOSITION">COMPOSITION</option>
              <option value="ORAL">ORAL</option>
              <option value="TP">TP</option>
            </select>
          </label>
          <label>
            Note
            <input
              type="number"
              min={0}
              step="0.01"
              value={gradeForm.score}
              onChange={(event) => setGradeForm((previous) => ({ ...previous, score: event.target.value }))}
              required
            />
            {renderFieldError(gradeErrors, "score")}
          </label>
          <label>
            Bareme
            <input
              type="number"
              min={1}
              step="0.01"
              value={gradeForm.scoreMax}
              onChange={(event) => setGradeForm((previous) => ({ ...previous, scoreMax: event.target.value }))}
              required
            />
            {renderFieldError(gradeErrors, "scoreMax")}
          </label>
          <button type="submit">Enregistrer note</button>
        </form>
      </section>

      <section data-step-id="entry" className="panel table-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">Registre</p>
            <h2>Notes enregistrees</h2>
          </div>
          <span className="module-header-badge">{grades.length} ligne(s)</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Eleve</th>
                <th>Classe</th>
                <th>Matiere</th>
                <th>Periode</th>
                <th>Evaluation</th>
                <th>Type</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {grades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-row">
                    Aucune note.
                  </td>
                </tr>
              ) : (
                grades.map((item) => (
                  <tr key={item.id}>
                    <td>{item.studentName || studentById.get(item.studentId)?.matricule || "-"}</td>
                    <td>{classById.get(item.classId)?.label || "-"}</td>
                    <td>{item.subjectLabel || subjects.find((subject) => subject.id === item.subjectId)?.label || "-"}</td>
                    <td>{periods.find((period) => period.id === item.academicPeriodId)?.label || "-"}</td>
                    <td>{item.assessmentLabel}</td>
                    <td>{item.assessmentType}</td>
                    <td>
                      {item.score}/{item.scoreMax}
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
            <p className="section-kicker">Synthese</p>
            <h2>Moyennes et rangs</h2>
          </div>
          <span className="module-header-badge">{classSummaryCount} ligne(s)</span>
        </div>
        {classSummary && classSummary.students.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Eleve</th>
                  <th>Moyenne</th>
                  <th>Rang</th>
                  <th>Notes</th>
                  <th>Appreciation</th>
                </tr>
              </thead>
              <tbody>
                {classSummary.students
                  .slice()
                  .sort((left, right) => left.classRank - right.classRank)
                  .map((item) => (
                    <tr key={item.studentId}>
                      <td>{item.matricule}</td>
                      <td>{item.studentName}</td>
                      <td>{item.averageGeneral.toFixed(2)}</td>
                      <td>{item.classRank}</td>
                      <td>{item.noteCount}</td>
                      <td>{item.appreciation}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="subtle">Aucun resume calcule pour l'instant.</p>
        )}
      </section>

      <section id="grades-reports" data-step-id="reports" className="panel editor-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">Publication</p>
            <h2>Generation bulletin PDF</h2>
          </div>
          <span className="module-header-badge">{reportCards.length} bulletin(s)</span>
        </div>
        <p className="section-lead">Generez un bulletin par eleve/periode et ouvrez le PDF en un clic.</p>
        <form className="form-grid module-form" onSubmit={(event) => void generateReport(event)}>
          <label>
            Eleve
            <select
              value={reportForm.studentId}
              onChange={(event) => setReportForm((previous) => ({ ...previous, studentId: event.target.value }))}
              required
            >
              <option value="">Choisir...</option>
              {students.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.matricule} - {item.firstName} {item.lastName}
                </option>
              ))}
            </select>
            {renderFieldError(reportErrors, "studentId")}
          </label>
          <label>
            Classe
            <select
              value={reportForm.classId}
              onChange={(event) => setReportForm((previous) => ({ ...previous, classId: event.target.value }))}
              required
            >
              <option value="">Choisir...</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.label}
                </option>
              ))}
            </select>
            {renderFieldError(reportErrors, "classId")}
          </label>
          <label>
            Periode
            <select
              value={reportForm.academicPeriodId}
              onChange={(event) =>
                setReportForm((previous) => ({ ...previous, academicPeriodId: event.target.value }))
              }
              required
            >
              <option value="">Choisir...</option>
              {reportFormPeriods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.label}
                </option>
              ))}
            </select>
            {renderFieldError(reportErrors, "academicPeriodId")}
          </label>
          <button type="submit">Generer bulletin</button>
        </form>
        <div className="actions">
          <button type="button" className="button-ghost" onClick={() => void loadReportCards()}>
            Recharger bulletins
          </button>
          {reportPdfUrl ? (
            <button
              type="button"
              className="button-ghost"
              onClick={() => window.open(reportPdfUrl, "_blank", "noopener,noreferrer")}
            >
              Ouvrir dernier bulletin
            </button>
          ) : null}
        </div>
      </section>

      <section data-step-id="reports" className="panel table-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">Bibliotheque</p>
            <h2>Bulletins generes</h2>
          </div>
          <span className="module-header-badge">{reportCards.length} fichier(s)</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Eleve</th>
                <th>Mode</th>
                <th>Contexte</th>
                <th>Periode</th>
                <th>Moyenne</th>
                <th>Rang</th>
                <th>Appreciation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reportCards.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-row">
                    Aucun bulletin.
                  </td>
                </tr>
              ) : (
                reportCards.map((item) => (
                  <tr key={item.id}>
                    <td>{item.studentName || studentById.get(item.studentId)?.matricule || "-"}</td>
                    <td>{formatReportCardModeLabel(item.mode)}</td>
                    <td>{formatReportCardContext(item)}</td>
                    <td>{item.periodLabel || periods.find((period) => period.id === item.academicPeriodId)?.label || "-"}</td>
                    <td>{formatReportCardAverage(item)}</td>
                    <td>{item.classRank || "-"}</td>
                    <td>{item.appreciation || "-"}</td>
                    <td>
                      <button type="button" className="button-ghost" onClick={() => void openReportCardPdf(item.id)}>
                        PDF
                      </button>
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
