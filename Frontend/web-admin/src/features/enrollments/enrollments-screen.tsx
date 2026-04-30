import type { JSX } from "react";

import {
  ACADEMIC_TRACK_OPTIONS,
  ENROLLMENT_STATUS_LABELS
} from "../../shared/constants/domain";
import { WorkflowGuide } from "../../shared/components/workflow-guide";
import type {
  AcademicTrack,
  ClassItem,
  Enrollment,
  FieldErrors,
  SchoolYear,
  Student
} from "../../shared/types/app";
import { useEnrollmentsData } from "./hooks/use-enrollments-data";
import type { EnrollmentsApiClient } from "./types/enrollments";

type EnrollmentsScreenProps = {
  api: EnrollmentsApiClient;
  initialEnrollments: Enrollment[];
  schoolYears: SchoolYear[];
  classes: ClassItem[];
  students: Student[];
  remoteEnabled?: boolean;
  onEnrollmentsChange?: (enrollments: Enrollment[]) => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
};

const formatLookupLabel = (map: Record<string, string>, value?: string): string => {
  const normalized = (value || "").trim().toUpperCase();
  return map[normalized] || value || "-";
};

const formatEnrollmentStatusLabel = (value?: string): string =>
  formatLookupLabel(ENROLLMENT_STATUS_LABELS, value);

const formatAcademicTrackLabel = (value?: string): string =>
  value === "ARABOPHONE" ? "Arabophone" : "Francophone";

const fieldError = (errors: FieldErrors, key: string): JSX.Element | null =>
  errors[key] ? <span className="field-error">{errors[key]}</span> : null;

export function EnrollmentsScreen({
  api,
  initialEnrollments,
  schoolYears,
  classes,
  students,
  remoteEnabled,
  onEnrollmentsChange,
  onError,
  onNotice
}: EnrollmentsScreenProps): JSX.Element {
  const {
    deleteEnrollment,
    enrollmentErrors,
    enrollmentFilters,
    enrollmentForm,
    enrollments,
    enrollmentSteps,
    enrollmentWorkflowStep,
    loadEnrollments,
    resetEnrollmentFilters,
    setEnrollmentFilters,
    setEnrollmentForm,
    setEnrollmentWorkflowStep,
    submitEnrollment
  } = useEnrollmentsData({
    api,
    initialEnrollments,
    schoolYears,
    classes,
    students,
    remoteEnabled,
    onEnrollmentsChange,
    onError,
    onNotice
  });

  const schoolYearById = new Map(schoolYears.map((item) => [item.id, item]));
  const classById = new Map(classes.map((item) => [item.id, item]));
  const studentById = new Map(students.map((item) => [item.id, item]));

  const scrollToEnrollments = (stepId: string): void => {
    setEnrollmentWorkflowStep(stepId);
    const targetByStep: Record<string, string> = {
      create: "enrollments-create",
      list: "enrollments-list"
    };
    const target = targetByStep[stepId];
    if (!target) return;
    window.setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const primaryEnrollmentsCount = enrollments.filter((item) => item.isPrimary).length;
  const filteredEnrollmentLabel = enrollmentFilters.schoolYearId
    ? schoolYearById.get(enrollmentFilters.schoolYearId)?.code || "Filtre actif"
    : "Toutes les annees";

  return (
    <WorkflowGuide
      title="Inscriptions"
      steps={enrollmentSteps}
      activeStepId={enrollmentWorkflowStep}
      onStepChange={scrollToEnrollments}
    >
      <>
        <section data-step-id="list" className="panel table-panel workflow-section module-modern module-overview-shell">
          <div className="table-header">
            <div>
              <p className="section-kicker">Admissions</p>
              <h2>Pilotage des inscriptions</h2>
            </div>
            <span className="module-header-badge">{filteredEnrollmentLabel}</span>
          </div>
          <p className="section-lead">
            Vue v2 plus stricte: creation, affectation et verification dans une grille plus proche
            du rythme FlexAdmin.
          </p>
          <div className="module-overview-grid">
            <article className="module-overview-card">
              <span>Inscriptions</span>
              <strong>{enrollments.length}</strong>
              <small>Dossiers rattaches aux classes</small>
            </article>
            <article className="module-overview-card">
              <span>Principal</span>
              <strong>{primaryEnrollmentsCount}</strong>
              <small>Classes principales actives</small>
            </article>
            <article className="module-overview-card">
              <span>Eleves</span>
              <strong>{students.length}</strong>
              <small>Viviers disponibles</small>
            </article>
            <article className="module-overview-card">
              <span>Classes</span>
              <strong>{classes.length}</strong>
              <small>Offre ouverte dans la v2</small>
            </article>
          </div>
          <div className="module-inline-strip">
            <span className="module-inline-pill">{schoolYears.length} annee(s) configuree(s)</span>
            <span className="module-inline-pill">{ACADEMIC_TRACK_OPTIONS.length} cursus</span>
            <span className="module-inline-pill">Workflow createur + registre</span>
          </div>
        </section>

        <section id="enrollments-create" data-step-id="create" className="panel editor-panel workflow-section module-modern">
          <div className="table-header">
            <div>
              <p className="section-kicker">Creation</p>
              <h2>Nouvelle inscription</h2>
            </div>
            <span className="module-header-badge">Etape de liaison</span>
          </div>
          <p className="section-lead">Liez l'eleve a sa classe et son annee scolaire en une seule operation.</p>
          <form className="form-grid module-form" onSubmit={(event) => void submitEnrollment(event)}>
            <label>
              Annee scolaire
              <select
                value={enrollmentForm.schoolYearId}
                onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}
                required
              >
                {schoolYears.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
              {fieldError(enrollmentErrors, "schoolYearId")}
            </label>
            <label>
              Classe
              <select
                value={enrollmentForm.classId}
                onChange={(event) => {
                  const nextClassId = event.target.value;
                  const nextClass = classes.find((item) => item.id === nextClassId);
                  setEnrollmentForm((prev) => ({
                    ...prev,
                    classId: nextClassId,
                    track: nextClass?.track || prev.track
                  }));
                }}
                required
              >
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label} ({formatAcademicTrackLabel(item.track)})
                  </option>
                ))}
              </select>
              {fieldError(enrollmentErrors, "classId")}
            </label>
            <label>
              Cursus
              <select
                value={enrollmentForm.track}
                onChange={(event) =>
                  setEnrollmentForm((prev) => ({ ...prev, track: event.target.value as AcademicTrack }))
                }
                required
              >
                {ACADEMIC_TRACK_OPTIONS.map((track) => (
                  <option key={track} value={track}>
                    {formatAcademicTrackLabel(track)}
                  </option>
                ))}
              </select>
              {fieldError(enrollmentErrors, "track")}
            </label>
            <label>
              Eleve
              <select
                value={enrollmentForm.studentId}
                onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, studentId: event.target.value }))}
                required
              >
                {students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.matricule} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
              {fieldError(enrollmentErrors, "studentId")}
            </label>
            <label>
              Date d'inscription
              <input
                type="date"
                value={enrollmentForm.enrollmentDate}
                onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, enrollmentDate: event.target.value }))}
                required
              />
              {fieldError(enrollmentErrors, "enrollmentDate")}
            </label>
            <label>
              Statut
              <input
                value={enrollmentForm.enrollmentStatus}
                onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, enrollmentStatus: event.target.value }))}
              />
              {fieldError(enrollmentErrors, "enrollmentStatus")}
            </label>
            <button type="submit">Creer inscription</button>
          </form>
        </section>

        <section id="enrollments-list" data-step-id="list" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <div>
              <p className="section-kicker">Registre</p>
              <h2>Liste des inscriptions</h2>
            </div>
            <span className="module-header-badge">{enrollments.length} ligne(s)</span>
          </div>
          <p className="section-lead">Filtrez rapidement pour trouver la bonne inscription et agir sans bruit.</p>
          <form
            className="filter-grid module-filter"
            onSubmit={(event) => {
              event.preventDefault();
              void loadEnrollments(enrollmentFilters);
            }}
          >
            <label>
              Filtre annee
              <select
                value={enrollmentFilters.schoolYearId}
                onChange={(event) =>
                  setEnrollmentFilters((prev) => ({ ...prev, schoolYearId: event.target.value }))
                }
              >
                <option value="">Toutes</option>
                {schoolYears.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Filtre classe
              <select
                value={enrollmentFilters.classId}
                onChange={(event) =>
                  setEnrollmentFilters((prev) => ({ ...prev, classId: event.target.value }))
                }
              >
                <option value="">Toutes</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Filtre eleve
              <select
                value={enrollmentFilters.studentId}
                onChange={(event) =>
                  setEnrollmentFilters((prev) => ({ ...prev, studentId: event.target.value }))
                }
              >
                <option value="">Tous</option>
                {students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.matricule}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Filtre cursus
              <select
                value={enrollmentFilters.track}
                onChange={(event) =>
                  setEnrollmentFilters((prev) => ({ ...prev, track: event.target.value }))
                }
              >
                <option value="">Tous</option>
                {ACADEMIC_TRACK_OPTIONS.map((track) => (
                  <option key={track} value={track}>
                    {formatAcademicTrackLabel(track)}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              <button type="submit">Filtrer</button>
              <button type="button" className="button-ghost" onClick={() => void resetEnrollmentFilters()}>
                Reinitialiser
              </button>
            </div>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Annee</th>
                  <th>Classe</th>
                  <th>Eleve</th>
                  <th>Cursus</th>
                  <th>Role</th>
                  <th>Classe principale</th>
                  <th>Classe secondaire</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="empty-row">
                      Aucune inscription.
                    </td>
                  </tr>
                ) : (
                  enrollments.map((item) => {
                    const localClass = classById.get(item.classId);
                    const localStudent = studentById.get(item.studentId);
                    const fallbackStudent = localStudent
                      ? `${localStudent.firstName} ${localStudent.lastName}`.trim()
                      : "-";
                    return (
                      <tr key={item.id}>
                        <td>{item.schoolYearCode || schoolYearById.get(item.schoolYearId)?.code || "-"}</td>
                        <td>{item.classLabel || localClass?.label || "-"}</td>
                        <td>{item.studentName || fallbackStudent}</td>
                        <td>{formatAcademicTrackLabel(item.track)}</td>
                        <td>{item.isPrimary ? "Principal" : "Secondaire"}</td>
                        <td>{item.primaryClassLabel || "-"}</td>
                        <td>{item.secondaryClassLabel || "-"}</td>
                        <td>{item.enrollmentDate}</td>
                        <td>{formatEnrollmentStatusLabel(item.enrollmentStatus)}</td>
                        <td>
                          <button
                            type="button"
                            className="button-danger"
                            onClick={() => void deleteEnrollment(item.id)}
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    </WorkflowGuide>
  );
}
