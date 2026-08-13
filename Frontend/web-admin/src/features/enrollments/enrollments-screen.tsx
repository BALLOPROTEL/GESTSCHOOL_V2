import { useMemo, useState, type JSX } from "react";

import {
  ACADEMIC_TRACK_OPTIONS,
  ENROLLMENT_STATUS_LABELS
} from "../../shared/constants/domain";
import type {
  AcademicTrack,
  ClassItem,
  Enrollment,
  FieldErrors,
  SchoolYear,
  Student
} from "../../shared/types/app";
import { translateUiString, type UiLanguage } from "../../shared/i18n";
import { ResponsiveForm } from "../../shared/components/responsive-form";
import { ResponsiveDataTable } from "../../shared/components/responsive-data-table";
import { ResponsiveFilterPanel } from "../../shared/components/responsive-filter-panel";
import { RowActionMenu } from "../../shared/components/row-action-menu";
import { WorkflowContextBar } from "../../shared/components/responsive-workflow";
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

const getEnrollmentStatusClassName = (value?: string): string => {
  const normalized = (value || "").trim().toUpperCase();
  if (normalized === "ENROLLED" || normalized === "COMPLETED") return "status-pill is-success";
  if (normalized === "PENDING") return "status-pill is-warning";
  return "status-pill is-muted";
};

const formatAcademicTrackLabel = (value?: string): string =>
  value === "ARABOPHONE" ? "Arabophone" : "Francophone";

const formatPlacementTypeLabel = (isPrimary: boolean): string =>
  isPrimary ? "Placement principal" : "Placement secondaire";

const fieldError = (
  errors: FieldErrors,
  key: string,
  translate: (source: string) => string
): JSX.Element | null =>
  errors[key] ? (
    <span className="field-error" role="alert">
      {translate(errors[key])}
    </span>
  ) : null;

const renderRequiredLabel = (label: string): JSX.Element => (
  <span className="field-label-required">
    {label} <span className="required-indicator">*</span>
  </span>
);

const formatDate = (value: string, locale: string): string => {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale).format(date);
};

const getStudentDisplayName = (student?: Student): string =>
  student?.fullName || `${student?.firstName || ""} ${student?.lastName || ""}`.trim();

const getEnrollmentStudentName = (
  enrollment: Enrollment,
  student?: Student,
  fallback = "Élève à vérifier"
): string => enrollment.studentName || getStudentDisplayName(student) || fallback;

const getEnrollmentInitials = (enrollment: Enrollment, student?: Student, fallback?: string): string => {
  const source = getEnrollmentStudentName(enrollment, student, fallback);
  const parts = source.trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return "IN";
  return `${parts[0]?.charAt(0) || ""}${parts[1]?.charAt(0) || parts[0]?.charAt(1) || ""}`.toUpperCase();
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
  const t = (source: string): string => translateUiString(language, source);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);
  const [enrollmentSearch, setEnrollmentSearch] = useState("");
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const {
    deleteEnrollment,
    editingEnrollmentId,
    enrollmentErrors,
    enrollmentFilters,
    enrollmentForm,
    enrollments,
    enrollmentWorkflowStep,
    resetEnrollmentFilters,
    resetEnrollmentForm,
    setEnrollmentFilters,
    setEnrollmentForm,
    setEnrollmentWorkflowStep,
    startEnrollmentEdit,
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

  const schoolYearById = useMemo(() => new Map(schoolYears.map((item) => [item.id, item])), [schoolYears]);
  const classById = useMemo(() => new Map(classes.map((item) => [item.id, item])), [classes]);
  const studentById = useMemo(() => new Map(students.map((item) => [item.id, item])), [students]);

  const displayedEnrollments = useMemo(
    () =>
      enrollments.filter((item) => {
        const localClass = classById.get(item.classId);
        const localStudent = studentById.get(item.studentId);
        const schoolYear = item.schoolYearCode || schoolYearById.get(item.schoolYearId)?.code || "";
        const studentName = getEnrollmentStudentName(item, localStudent, t("Élève à vérifier"));
        const matricule = localStudent?.matricule || "";
        const classLabel = item.classLabel || localClass?.label || localClass?.code || "";
        const searchPayload = [
          schoolYear,
          studentName,
          matricule,
          classLabel,
          formatAcademicTrackLabel(item.track),
          formatEnrollmentStatusLabel(item.enrollmentStatus)
        ]
          .join(" ")
          .toLowerCase();
        const query = enrollmentSearch.trim().toLowerCase();

        if (query && !searchPayload.includes(query)) return false;
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
    [classById, enrollmentFilters, enrollmentSearch, enrollments, schoolYearById, studentById]
  );

  const activeEnrollments = enrollments.filter((item) => item.enrollmentStatus.trim().toUpperCase() === "ENROLLED");
  const activeStudentCount = new Set(activeEnrollments.map((item) => item.studentId)).size;
  const hasListFilters =
    enrollmentSearch.trim().length > 0 ||
    enrollmentFilters.schoolYearId.length > 0 ||
    enrollmentFilters.classId.length > 0 ||
    enrollmentFilters.studentId.length > 0 ||
    enrollmentFilters.track.length > 0 ||
    enrollmentFilters.enrollmentStatus.length > 0;

  const openEnrollmentForm = (): void => {
    setSelectedEnrollmentId(null);
    resetEnrollmentForm();
    setEnrollmentWorkflowStep("create");
  };

  const showEnrollmentList = (): void => {
    resetEnrollmentForm();
    setEnrollmentWorkflowStep("list");
  };

  const resetListFilters = (): void => {
    setEnrollmentSearch("");
    void resetEnrollmentFilters();
  };

  const closeActionMenu = (): void => setOpenActionMenuId(null);

  const toggleActionMenu = (enrollmentId: string): void => {
    setOpenActionMenuId((current) => (current === enrollmentId ? null : enrollmentId));
  };

  const selectedEnrollment = selectedEnrollmentId
    ? enrollments.find((enrollment) => enrollment.id === selectedEnrollmentId) || null
    : null;
  const editingEnrollment = editingEnrollmentId
    ? enrollments.find((enrollment) => enrollment.id === editingEnrollmentId) || null
    : null;

  return (
    <div className="enrollments-v3-shell">
      <header className="enrollments-v3-page-header">
        <div>
          <h1>{t("Inscriptions")}</h1>
          <p>{t("Gérez les admissions, placements et rattachements académiques des élèves.")}</p>
        </div>
        {enrollmentWorkflowStep === "create" ? (
          <button type="button" className="button-ghost" onClick={showEnrollmentList}>
            {t("Liste des inscriptions")}
          </button>
        ) : (
          <button type="button" onClick={openEnrollmentForm}>
            {t("Nouvelle inscription")}
          </button>
        )}
      </header>

      {enrollmentWorkflowStep === "create" ? (
        <section
          id="enrollments-create"
          data-step-id="create"
          data-active-step="true"
          className="panel editor-panel module-modern enrollments-v3-form-card"
        >
          <div className="enrollments-v3-table-head">
            <div>
              <h2>{t(editingEnrollment ? "Modifier inscription" : "Nouvelle inscription")}</h2>
              <p>
                {t(editingEnrollment
                  ? "Ajustez le placement, la date et le statut de l'inscription sélectionnée."
                  : "Rattachez un élève à une année scolaire, un cursus et une classe.")}
              </p>
            </div>
            <span className="students-overview-status">{t("Placement académique")}</span>
          </div>
          <WorkflowContextBar
            title="Contexte actif"
            items={[
              {
                label: "Élève",
                value: getStudentDisplayName(studentById.get(enrollmentForm.studentId)) || t("À sélectionner")
              },
              {
                label: "Année scolaire",
                value: schoolYearById.get(enrollmentForm.schoolYearId)?.code || t("À sélectionner")
              },
              {
                label: "Classe",
                value: classById.get(enrollmentForm.classId)?.label || t("À sélectionner")
              },
              { label: "Statut", value: t(formatEnrollmentStatusLabel(enrollmentForm.enrollmentStatus)) }
            ]}
            actionLabel="Voir la liste"
            onAction={showEnrollmentList}
          />
          <ResponsiveForm
            className="form-grid module-form enrollments-v3-form-grid"
            formTitle={t(editingEnrollment ? "Modifier inscription" : "Nouvelle inscription")}
            openOnMount
            triggerLabel={t(editingEnrollment ? "Modifier inscription" : "Nouvelle inscription")}
            onSubmit={(event) => void submitEnrollment(event)}
          >
            <label>
              {renderRequiredLabel(t("Année scolaire"))}
              <select
                value={enrollmentForm.schoolYearId}
                onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}
                required
              >
                <option value="" disabled>
                  {t(schoolYears.length > 0 ? "Choisir une année" : "Aucune année disponible")}
                </option>
                {schoolYears.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
              {fieldError(enrollmentErrors, "schoolYearId", t)}
            </label>
            <label>
              {renderRequiredLabel(t("Classe"))}
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
                  {t(classes.length > 0 ? "Choisir une classe" : "Aucune classe disponible")}
                </option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label} ({t(formatAcademicTrackLabel(item.track))})
                  </option>
                ))}
              </select>
              {fieldError(enrollmentErrors, "classId", t)}
            </label>
            <label>
              {renderRequiredLabel(t("Cursus"))}
              <select
                value={enrollmentForm.track}
                onChange={(event) =>
                  setEnrollmentForm((prev) => ({ ...prev, track: event.target.value as AcademicTrack }))
                }
                required
              >
                {ACADEMIC_TRACK_OPTIONS.map((track) => (
                  <option key={track} value={track}>
                    {t(formatAcademicTrackLabel(track))}
                  </option>
                ))}
              </select>
              {fieldError(enrollmentErrors, "track", t)}
            </label>
            <label>
              {renderRequiredLabel(t("Élève"))}
              <select
                value={enrollmentForm.studentId}
                onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, studentId: event.target.value }))}
                required
              >
                <option value="" disabled>
                  {t(students.length > 0 ? "Choisir un élève" : "Aucun élève disponible")}
                </option>
                {students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.matricule} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
              {fieldError(enrollmentErrors, "studentId", t)}
            </label>
            <label>
              {renderRequiredLabel(t("Date d'inscription"))}
              <input
                type="date"
                value={enrollmentForm.enrollmentDate}
                onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, enrollmentDate: event.target.value }))}
                required
              />
              {fieldError(enrollmentErrors, "enrollmentDate", t)}
            </label>
            <label>
              {renderRequiredLabel(t("Statut"))}
              <select
                value={enrollmentForm.enrollmentStatus}
                onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, enrollmentStatus: event.target.value }))}
                required
              >
                {ENROLLMENT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {t(formatEnrollmentStatusLabel(status))}
                  </option>
                ))}
              </select>
              {fieldError(enrollmentErrors, "enrollmentStatus", t)}
            </label>
            <div className="notice-card notice-info enrollments-v3-form-note">
              <strong>{t("Placement académique")}</strong>
              <p>{t("Le placement principal est déterminé automatiquement selon le contexte scolaire de l'élève.")}</p>
            </div>
            <div className="actions span-2">
              <button type="submit">{t(editingEnrollment ? "Mettre à jour" : "Créer inscription")}</button>
              <button type="button" className="button-ghost" onClick={showEnrollmentList}>
                {t("Voir la liste")}
              </button>
            </div>
          </ResponsiveForm>
        </section>
      ) : (
        <>
          <ResponsiveFilterPanel
            className="panel enrollments-v3-filter-card"
            title={t("Filtres inscriptions")}
            activeCount={[enrollmentSearch, enrollmentFilters.schoolYearId, enrollmentFilters.classId, enrollmentFilters.enrollmentStatus].filter(Boolean).length}
          >
            <label className="enrollments-v3-search-field">
              <span>{t("Recherche rapide")}</span>
              <input
                className="search-input"
                placeholder={t("Nom, matricule, classe ou année...")}
                value={enrollmentSearch}
                onChange={(event) => setEnrollmentSearch(event.target.value)}
              />
            </label>
            <label className="enrollments-v3-filter-field">
              <span>{t("Année scolaire")}</span>
              <select
                value={enrollmentFilters.schoolYearId}
                onChange={(event) =>
                  setEnrollmentFilters((prev) => ({ ...prev, schoolYearId: event.target.value }))
                }
              >
                <option value="">{t("Toutes les années")}</option>
                {schoolYears.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="enrollments-v3-filter-field">
              <span>{t("Classe")}</span>
              <select
                value={enrollmentFilters.classId}
                onChange={(event) =>
                  setEnrollmentFilters((prev) => ({ ...prev, classId: event.target.value }))
                }
              >
                <option value="">{t("Toutes les classes")}</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="enrollments-v3-filter-field">
              <span>{t("Statut")}</span>
              <select
                value={enrollmentFilters.enrollmentStatus}
                onChange={(event) =>
                  setEnrollmentFilters((prev) => ({ ...prev, enrollmentStatus: event.target.value }))
                }
              >
                <option value="">{t("Tous les statuts")}</option>
                {ENROLLMENT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {t(formatEnrollmentStatusLabel(status))}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="button-ghost" onClick={resetListFilters} disabled={!hasListFilters}>
              {t("Réinitialiser")}
            </button>
          </ResponsiveFilterPanel>

          <section
            id="enrollments-list"
            data-step-id="list"
            data-active-step="true"
            className="panel table-panel module-modern enrollments-v3-table-card"
          >
            <div className="enrollments-v3-table-head">
              <div>
                <h2>
                  {t("Liste des inscriptions")} ({displayedEnrollments.length})
                </h2>
                <p>
                  {activeStudentCount} {t("élève(s) actif(s), placements issus des dossiers validés.")}
                </p>
              </div>
              <span className="students-overview-status">
                {t(`${enrollments.length} dossier(s)`)}
              </span>
            </div>
            <ResponsiveDataTable label={t("Liste des inscriptions")}>
              <table className="enrollments-v3-table" data-responsive-table="true">
                <thead>
                  <tr>
                    <th>{t("Élève")}</th>
                    <th>{t("Année")}</th>
                    <th>{t("Classe / cursus")}</th>
                    <th>{t("Placement")}</th>
                    <th>{t("Date")}</th>
                    <th>{t("Statut")}</th>
                    <th className="enrollments-v3-actions-heading" aria-label={t("Actions")}></th>
                  </tr>
                </thead>
                <tbody>
                  {displayedEnrollments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-row">
                        {t("Aucune inscription trouvée.")}
                      </td>
                    </tr>
                  ) : (
                    displayedEnrollments.map((item) => {
                      const localClass = classById.get(item.classId);
                      const localStudent = studentById.get(item.studentId);
                      const studentName = getEnrollmentStudentName(item, localStudent, t("Élève à vérifier"));
                      const schoolYear = item.schoolYearCode || schoolYearById.get(item.schoolYearId)?.code || "-";
                      const classLabel = item.classLabel || localClass?.label || localClass?.code || "-";

                      return (
                        <tr key={item.id}>
                          <td data-label={t("Élève")}>
                            <div className="enrollments-v3-student-cell">
                              <span className="enrollments-v3-avatar">
                                {getEnrollmentInitials(item, localStudent, t("Élève à vérifier"))}
                              </span>
                              <div>
                                <strong>{studentName}</strong>
                                <small>{localStudent?.matricule || t("Matricule à compléter")}</small>
                              </div>
                            </div>
                          </td>
                          <td data-label={t("Année")} className="enrollments-v3-muted-cell">
                            {schoolYear}
                          </td>
                          <td data-label={t("Classe / cursus")}>
                            <div className="enrollments-v3-class-cell">
                              <strong>{classLabel}</strong>
                              <span className="enrollments-v3-class-badge">
                                {t(formatAcademicTrackLabel(item.track))}
                              </span>
                            </div>
                          </td>
                          <td data-label={t("Placement")} className="enrollments-v3-muted-cell">
                            {t(formatPlacementTypeLabel(Boolean(item.isPrimary)))}
                          </td>
                          <td data-label={t("Date")} className="enrollments-v3-muted-cell">
                            {formatDate(item.enrollmentDate, locale)}
                          </td>
                          <td data-label={t("Statut")}>
                            <span className={getEnrollmentStatusClassName(item.enrollmentStatus)}>
                              {t(formatEnrollmentStatusLabel(item.enrollmentStatus))}
                            </span>
                          </td>
                          <td data-label={t("Actions")}>
                            <RowActionMenu
                              label={`${t("Actions inscription")} ${studentName}`}
                              open={openActionMenuId === item.id}
                              onOpenChange={(open) => (open ? toggleActionMenu(item.id) : closeActionMenu())}
                              triggerClassName="enrollments-v3-more-button"
                              menuClassName="enrollments-v3-action-menu"
                            >
                                  <button
                                    type="button"
                                    role="menuitem"
                                  onClick={() => {
                                    closeActionMenu();
                                    setSelectedEnrollmentId(item.id);
                                  }}
                                >
                                    {t("Voir")}
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                  onClick={() => {
                                    closeActionMenu();
                                    setSelectedEnrollmentId(null);
                                    startEnrollmentEdit(item);
                                  }}
                                >
                                    {t("Modifier")}
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="is-danger"
                                  onClick={() => {
                                    closeActionMenu();
                                    void deleteEnrollment(item.id);
                                  }}
                                >
                                    {t("Supprimer")}
                                  </button>
                            </RowActionMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </ResponsiveDataTable>
            {selectedEnrollment ? (
              <aside className="enrollments-v3-detail-panel" aria-label={t("Inscription consultée")}>
                <div className="table-header">
                  <div>
                    <p className="section-kicker">{t("Inscription consultée")}</p>
                    <h3>
                      {getEnrollmentStudentName(
                        selectedEnrollment,
                        studentById.get(selectedEnrollment.studentId),
                        t("Élève à vérifier")
                      )}
                    </h3>
                  </div>
                  <span className={getEnrollmentStatusClassName(selectedEnrollment.enrollmentStatus)}>
                    {t(formatEnrollmentStatusLabel(selectedEnrollment.enrollmentStatus))}
                  </span>
                </div>
                <div className="students-detail-grid">
                  <div>
                    <span>{t("Année")}</span>
                    <strong>
                      {selectedEnrollment.schoolYearCode ||
                        schoolYearById.get(selectedEnrollment.schoolYearId)?.code ||
                        "-"}
                    </strong>
                  </div>
                  <div>
                    <span>{t("Classe")}</span>
                    <strong>
                      {selectedEnrollment.classLabel ||
                        classById.get(selectedEnrollment.classId)?.label ||
                        "-"}
                    </strong>
                  </div>
                  <div>
                    <span>{t("Cursus")}</span>
                    <strong>{t(formatAcademicTrackLabel(selectedEnrollment.track))}</strong>
                  </div>
                  <div>
                    <span>{t("Placement")}</span>
                    <strong>{t(formatPlacementTypeLabel(Boolean(selectedEnrollment.isPrimary)))}</strong>
                  </div>
                </div>
              </aside>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
