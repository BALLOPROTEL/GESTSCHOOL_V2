import { useMemo, useState, type JSX } from "react";

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
import type { UiLanguage } from "../../shared/i18n";
import { useEnrollmentsData } from "./hooks/use-enrollments-data";
import type { EnrollmentsApiClient } from "./types/enrollments";

type EnrollmentsScreenProps = {
  api: EnrollmentsApiClient;
  initialEnrollments: Enrollment[];
  schoolYears: SchoolYear[];
  classes: ClassItem[];
  students: Student[];
  remoteEnabled?: boolean;
  language?: UiLanguage;
  locale?: string;
  onEnrollmentsChange?: (enrollments: Enrollment[]) => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
};

const ENROLLMENT_STATUS_OPTIONS = ["PENDING", "ENROLLED", "COMPLETED", "CANCELLED"] as const;

const ENROLLMENT_STATUS_UI_LABELS: Record<string, string> = {
  PENDING: "Brouillon",
  ENROLLED: "Inscrit",
  COMPLETED: "Finalisée",
  CANCELLED: "Annulée",
  SUSPENDED: "Suspendu"
};

const formatLookupLabel = (map: Record<string, string>, value?: string): string => {
  const normalized = (value || "").trim().toUpperCase();
  return map[normalized] || value || "-";
};

const formatEnrollmentStatusLabel = (value?: string): string => {
  const normalized = (value || "").trim().toUpperCase();
  return ENROLLMENT_STATUS_UI_LABELS[normalized] || formatLookupLabel(ENROLLMENT_STATUS_LABELS, value);
};

const formatAcademicTrackLabel = (value?: string): string =>
  value === "ARABOPHONE" ? "Arabophone" : "Francophone";

const formatPlacementTypeLabel = (isPrimary: boolean): string =>
  isPrimary ? "Placement principal" : "Placement secondaire";

const fieldError = (errors: FieldErrors, key: string): JSX.Element | null =>
  errors[key] ? <span className="field-error">{errors[key]}</span> : null;

const renderRequiredLabel = (label: string): JSX.Element => (
  <span className="field-label-required">
    {label} <span className="required-indicator">*</span>
  </span>
);

const pluralize = (count: number, singular: string, plural: string): string =>
  `${count} ${count > 1 ? plural : singular}`;

const formatDate = (value: string, locale: string): string => {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale).format(date);
};

export function EnrollmentsScreen({
  api,
  initialEnrollments,
  schoolYears,
  classes,
  students,
  remoteEnabled,
  language = "fr",
  locale = "fr-FR",
  onEnrollmentsChange,
  onError,
  onNotice
}: EnrollmentsScreenProps): JSX.Element {
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);
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
    language,
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

  const displayedEnrollments = useMemo(
    () =>
      enrollments.filter((item) => {
        if (enrollmentFilters.schoolYearId && item.schoolYearId !== enrollmentFilters.schoolYearId) return false;
        if (enrollmentFilters.classId && item.classId !== enrollmentFilters.classId) return false;
        if (enrollmentFilters.studentId && item.studentId !== enrollmentFilters.studentId) return false;
        if (enrollmentFilters.track && item.track !== enrollmentFilters.track) return false;
        if (
          enrollmentFilters.enrollmentStatus &&
          item.enrollmentStatus.trim().toUpperCase() !== enrollmentFilters.enrollmentStatus
        ) {
          return false;
        }
        return true;
      }),
    [enrollmentFilters, enrollments]
  );
  const activeEnrollments = enrollments.filter((item) => item.enrollmentStatus.trim().toUpperCase() === "ENROLLED");
  const activeStudentCount = new Set(activeEnrollments.map((item) => item.studentId)).size;
  const configuredTrackCount = new Set(classes.map((item) => item.track)).size || ACADEMIC_TRACK_OPTIONS.length;
  const filteredEnrollmentLabel = enrollmentFilters.schoolYearId
    ? schoolYearById.get(enrollmentFilters.schoolYearId)?.code || "Filtre actif"
    : "Toutes les années";

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
              <h2>Suivi des inscriptions</h2>
            </div>
            <span className="module-header-badge">{filteredEnrollmentLabel}</span>
          </div>
          <p className="section-lead">Gérez les inscriptions et placements académiques des élèves.</p>
          <div className="module-overview-grid">
            <article className="module-overview-card">
              <span>Inscriptions</span>
              <strong>{enrollments.length}</strong>
              <small>Dossiers rattachés aux classes</small>
            </article>
            <article className="module-overview-card">
              <span>Élèves inscrits</span>
              <strong>{activeStudentCount}</strong>
              <small>Élèves actifs</small>
            </article>
            <article className="module-overview-card">
              <span>Cursus</span>
              <strong>{configuredTrackCount}</strong>
              <small>Francophone / Arabophone</small>
            </article>
            <article className="module-overview-card">
              <span>Classes</span>
              <strong>{classes.length}</strong>
              <small>Classes disponibles</small>
            </article>
          </div>
          <div className="module-inline-strip">
            <span className="module-inline-pill">
              {pluralize(schoolYears.length, "année configurée", "années configurées")}
            </span>
            <span className="module-inline-pill">{pluralize(configuredTrackCount, "cursus actif", "cursus actifs")}</span>
          </div>
        </section>

        <section
          id="enrollments-create"
          data-step-id="create"
          data-active-step={enrollmentWorkflowStep === "create" ? "true" : undefined}
          className="panel editor-panel workflow-section module-modern"
        >
          <div className="table-header">
            <div>
              <p className="section-kicker">Création</p>
              <h2>Nouvelle inscription</h2>
            </div>
            <span className="module-header-badge">Placement académique</span>
          </div>
          <p className="section-lead">Rattachez un élève à une année scolaire, un cursus et une classe.</p>
          <form className="form-grid module-form" onSubmit={(event) => void submitEnrollment(event)}>
            <label>
              {renderRequiredLabel("Année scolaire")}
              <select
                value={enrollmentForm.schoolYearId}
                onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}
                required
              >
                <option value="" disabled>
                  {schoolYears.length > 0 ? "Choisir une année" : "Aucune année disponible"}
                </option>
                {schoolYears.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
              {fieldError(enrollmentErrors, "schoolYearId")}
            </label>
            <label>
              {renderRequiredLabel("Classe")}
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
                <option value="" disabled>
                  {classes.length > 0 ? "Choisir une classe" : "Aucune classe disponible"}
                </option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label} ({formatAcademicTrackLabel(item.track)})
                  </option>
                ))}
              </select>
              {fieldError(enrollmentErrors, "classId")}
            </label>
            <label>
              {renderRequiredLabel("Cursus")}
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
              {renderRequiredLabel("Élève")}
              <select
                value={enrollmentForm.studentId}
                onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, studentId: event.target.value }))}
                required
              >
                <option value="" disabled>
                  {students.length > 0 ? "Choisir un élève" : "Aucun élève disponible"}
                </option>
                {students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.matricule} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
              {fieldError(enrollmentErrors, "studentId")}
            </label>
            <label>
              {renderRequiredLabel("Date d'inscription")}
              <input
                type="date"
                value={enrollmentForm.enrollmentDate}
                onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, enrollmentDate: event.target.value }))}
                required
              />
              {fieldError(enrollmentErrors, "enrollmentDate")}
            </label>
            <label>
              {renderRequiredLabel("Statut")}
              <select
                value={enrollmentForm.enrollmentStatus}
                onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, enrollmentStatus: event.target.value }))}
                required
              >
                {ENROLLMENT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {formatEnrollmentStatusLabel(status)}
                  </option>
                ))}
              </select>
              {fieldError(enrollmentErrors, "enrollmentStatus")}
            </label>
            <div className="notice-card notice-info enrollment-placement-help">
              <strong>Type de placement</strong>
              <p>Le placement principal est déterminé automatiquement selon le contexte académique de l'élève.</p>
            </div>
            <button type="submit">Créer inscription</button>
          </form>
        </section>

        <section
          id="enrollments-list"
          data-step-id="list"
          data-active-step={enrollmentWorkflowStep === "list" ? "true" : undefined}
          className="panel table-panel workflow-section module-modern"
        >
          <div className="table-header">
            <div>
              <p className="section-kicker">Suivi</p>
              <h2>Liste des inscriptions</h2>
            </div>
            <span className="module-header-badge">
              {pluralize(displayedEnrollments.length, "inscription", "inscriptions")}
            </span>
          </div>
          <p className="section-lead">Recherchez et gérez les inscriptions par année, classe, élève ou cursus.</p>
          <form
            className="filter-grid module-filter"
            onSubmit={(event) => {
              event.preventDefault();
              void loadEnrollments(enrollmentFilters);
            }}
          >
            <label>
              Année scolaire
              <select
                value={enrollmentFilters.schoolYearId}
                onChange={(event) =>
                  setEnrollmentFilters((prev) => ({ ...prev, schoolYearId: event.target.value }))
                }
              >
                <option value="">Toutes les années</option>
                {schoolYears.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Classe
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
              Élève
              <select
                value={enrollmentFilters.studentId}
                onChange={(event) =>
                  setEnrollmentFilters((prev) => ({ ...prev, studentId: event.target.value }))
                }
              >
                <option value="">Tous</option>
                {students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.matricule} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cursus
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
            <label>
              Statut
              <select
                value={enrollmentFilters.enrollmentStatus}
                onChange={(event) =>
                  setEnrollmentFilters((prev) => ({ ...prev, enrollmentStatus: event.target.value }))
                }
              >
                <option value="">Tous</option>
                {ENROLLMENT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {formatEnrollmentStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              <button type="submit">Filtrer</button>
              <button type="button" className="button-ghost" onClick={() => void resetEnrollmentFilters()}>
                Réinitialiser
              </button>
            </div>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Année</th>
                  <th>Élève</th>
                  <th>Cursus</th>
                  <th>Classe</th>
                  <th>Type de placement</th>
                  <th>Statut</th>
                  <th>Date d'inscription</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedEnrollments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-row">
                      Aucune inscription trouvée.
                    </td>
                  </tr>
                ) : (
                  displayedEnrollments.map((item) => {
                    const localClass = classById.get(item.classId);
                    const localStudent = studentById.get(item.studentId);
                    const fallbackStudent = localStudent
                      ? `${localStudent.firstName} ${localStudent.lastName}`.trim()
                      : "-";
                    return (
                      <tr key={item.id}>
                        <td>{item.schoolYearCode || schoolYearById.get(item.schoolYearId)?.code || "-"}</td>
                        <td>{item.studentName || fallbackStudent}</td>
                        <td>{formatAcademicTrackLabel(item.track)}</td>
                        <td>{item.classLabel || localClass?.label || "-"}</td>
                        <td>{formatPlacementTypeLabel(Boolean(item.isPrimary))}</td>
                        <td>{formatEnrollmentStatusLabel(item.enrollmentStatus)}</td>
                        <td>{formatDate(item.enrollmentDate, locale)}</td>
                        <td>
                          <div className="row-actions enrollment-row-actions">
                            <button type="button" className="button-ghost" onClick={() => setSelectedEnrollmentId(item.id)}>
                              Voir
                            </button>
                            <button
                              type="button"
                              className="button-danger"
                              onClick={() => void deleteEnrollment(item.id)}
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {selectedEnrollmentId ? (
            <div className="notice-card notice-info enrollment-detail-card">
              {(() => {
                const item = enrollments.find((enrollment) => enrollment.id === selectedEnrollmentId);
                if (!item) return <p>Aucune inscription sélectionnée.</p>;
                const localClass = classById.get(item.classId);
                const localStudent = studentById.get(item.studentId);
                return (
                  <>
                    <strong>Détail du placement académique</strong>
                    <p>
                      {(item.studentName || `${localStudent?.firstName || ""} ${localStudent?.lastName || ""}`.trim() || "-")} ·{" "}
                      {formatAcademicTrackLabel(item.track)} · {item.classLabel || localClass?.label || "-"} ·{" "}
                      {formatPlacementTypeLabel(Boolean(item.isPrimary))}
                    </p>
                  </>
                );
              })()}
            </div>
          ) : null}
        </section>
      </>
    </WorkflowGuide>
  );
}
