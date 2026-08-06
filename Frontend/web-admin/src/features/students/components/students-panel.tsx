import { type FormEvent, useMemo, useState } from "react";

import type { AcademicTrack, FieldErrors, Student } from "../../../shared/types/app";
import { fieldError } from "../../../shared/utils/form-ui";
import { DEFAULT_ESTABLISHMENT_VALUE, type StudentForm } from "../types/students";
import { useI18n } from "../../../shared/i18n-context";


type StudentsPanelProps = {
  editingStudentId: string | null;
  studentErrors: FieldErrors;
  studentForm: StudentForm;
  studentSearch: string;
  selectedStudent: Student | null;
  studentWorkflowStep: string;
  students: Student[];
  studentsLoading: boolean;
  shownStudents: Student[];
  onDeleteStudent: (studentId: string) => void;
  onEditStudent: (student: Student) => void;
  onResetStudentForm: () => void;
  onSearchChange: (value: string) => void;
  onStudentFormChange: (updater: (previous: StudentForm) => StudentForm) => void;
  onStudentWorkflowStepChange: (stepId: string) => void;
  onSubmitStudent: (event: FormEvent<HTMLFormElement>) => void;
  onViewStudent: (student: Student) => void;
};

const SCHOOL_NAME = "Al Manarat Islamiyat";

const formatTrackLabel = (track?: AcademicTrack): string =>
  track === "ARABOPHONE" ? "Arabophone" : "Francophone";

const getStudentTrackCodes = (student: Student): AcademicTrack[] => {
  const placementTracks = (student.placements || []).map((placement) => placement.track);
  return (student.tracks && student.tracks.length > 0 ? student.tracks : placementTracks).filter(
    (track, index, allTracks) => allTracks.indexOf(track) === index
  );
};

const formatStudentTracks = (student: Student): string => {
  const tracks = getStudentTrackCodes(student);
  if (tracks.length === 0) return "À régulariser via inscription";
  if (tracks.length > 1) return "Francophone + Arabophone";
  return formatTrackLabel(tracks[0]);
};

const formatPrimaryClass = (student: Student): string => {
  const placements = student.placements || [];
  const primary = placements.find((placement) => placement.isPrimary) || placements[0];
  if (!primary) return "À régulariser via inscription";
  return [primary.classLabel || primary.levelLabel, formatTrackLabel(primary.track)]
    .filter(Boolean)
    .join(" / ");
};

const formatStudentStatus = (status?: string): string => {
  switch ((status || "ACTIVE").toUpperCase()) {
    case "ACTIVE":
      return "Actif";
    case "INACTIVE":
      return "Inactif";
    case "ARCHIVED":
      return "Archivé";
    case "PENDING":
      return "En attente";
    case "DRAFT":
      return "Brouillon";
    case "SUSPENDED":
      return "Suspendu";
    default:
      return "À vérifier";
  }
};

const getStudentStatusClassName = (status?: string): string => {
  const normalized = (status || "ACTIVE").toUpperCase();
  return normalized === "ACTIVE" ? "status-pill is-success" : "status-pill is-muted";
};

const getStudentDisplayName = (student: Student): string =>
  student.fullName || `${student.firstName} ${student.lastName}`.trim();

const getStudentInitials = (student: Student): string => {
  const firstInitial = (student.firstName || student.fullName || "?").trim().charAt(0);
  const lastInitial = (student.lastName || "").trim().charAt(0);
  return `${firstInitial}${lastInitial}`.toUpperCase();
};

export function StudentsPanel(props: StudentsPanelProps): JSX.Element {
  const { t: tr } = useI18n();
  const {
    editingStudentId,
    onDeleteStudent,
    onEditStudent,
    onResetStudentForm,
    onSearchChange,
    onStudentFormChange,
    onStudentWorkflowStepChange,
    onSubmitStudent,
    onViewStudent,
    selectedStudent,
    shownStudents,
    studentErrors,
    studentForm,
    studentSearch,
    studentWorkflowStep,
    students,
    studentsLoading
  } = props;
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [trackFilter, setTrackFilter] = useState("ALL");
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const filteredStudents = useMemo(
    () =>
      shownStudents.filter((student) => {
        const normalizedStatus = (student.status || "ACTIVE").toUpperCase();
        const tracks = getStudentTrackCodes(student);
        const matchesStatus = statusFilter === "ALL" || normalizedStatus === statusFilter;
        const matchesTrack =
          trackFilter === "ALL" ||
          (trackFilter === "BICURSUS" && tracks.length > 1) ||
          (trackFilter === "UNASSIGNED" && tracks.length === 0) ||
          tracks.includes(trackFilter as AcademicTrack);

        return matchesStatus && matchesTrack;
      }),
    [shownStudents, statusFilter, trackFilter]
  );

  const hasListFilters = studentSearch.trim().length > 0 || statusFilter !== "ALL" || trackFilter !== "ALL";
  const openStudentForm = (): void => {
    onResetStudentForm();
    onStudentWorkflowStepChange("entry");
  };
  const resetListFilters = (): void => {
    onSearchChange("");
    setStatusFilter("ALL");
    setTrackFilter("ALL");
  };
  const closeActionMenu = (): void => setOpenActionMenuId(null);
  const toggleActionMenu = (studentId: string): void => {
    setOpenActionMenuId((current) => (current === studentId ? null : studentId));
  };

  return (
    <div className="students-v3-shell students-screen-shell">
      <header className="students-v3-page-header">
        <div>
          <h1>{tr("Élèves")}</h1>
          <p>{tr("Gérez et consultez les dossiers administratifs des élèves.")}</p>
        </div>
        {studentWorkflowStep === "entry" ? (
          <button type="button" className="button-ghost" onClick={() => onStudentWorkflowStepChange("list")}>
            {tr("Base élèves")}</button>
        ) : (
          <button type="button" onClick={openStudentForm}>
            {tr("Ajouter un élève")}</button>
        )}
      </header>

        {studentWorkflowStep === "entry" ? (
          <section className="panel editor-panel module-modern students-v3-form-card">
            <div className="table-header">
              <div>
                <p className="section-kicker">{tr("Dossier administratif")}</p>
                <h2>{editingStudentId ? tr("Modifier le dossier") : tr("Ajouter un élève")}</h2>
              </div>
              <span className="students-overview-status">
                {editingStudentId ? tr("Mode édition") : tr("Nouveau dossier")}
              </span>
            </div>
            <p className="section-lead">
              {tr("Ce formulaire crée le dossier administratif de l’élève. Les classes et cursus sont gérés ensuite depuis les inscriptions.")}</p>
            <form className="form-grid module-form students-form-grid" onSubmit={onSubmitStudent}>
              <fieldset className="students-form-section">
                <legend>{tr("Identité")}</legend>
                <label>
                  {tr("Matricule *")}<input
                    value={studentForm.matricule}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, matricule: event.target.value }))
                    }
                    required
                  />
                  <small>{tr("Matricule obligatoire pour enregistrer le dossier.")}</small>
                  {fieldError(studentErrors, "matricule", tr)}
                </label>
                <label>
                  {tr("Prénom *")}<input
                    value={studentForm.firstName}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, firstName: event.target.value }))
                    }
                    required
                  />
                  {fieldError(studentErrors, "firstName", tr)}
                </label>
                <label>
                  {tr("Nom *")}<input
                    value={studentForm.lastName}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, lastName: event.target.value }))
                    }
                    required
                  />
                  {fieldError(studentErrors, "lastName", tr)}
                </label>
                <label>
                  {tr("Sexe *")}<select
                    value={studentForm.sex}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({
                        ...prev,
                        sex: event.target.value as "M" | "F"
                      }))
                    }
                    required
                  >
                    <option value="M">{tr("M")}</option>
                    <option value="F">{tr("F")}</option>
                  </select>
                  {fieldError(studentErrors, "sex", tr)}
                </label>
                <label>
                  {tr("Date de naissance *")}<input
                    type="date"
                    value={studentForm.birthDate}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, birthDate: event.target.value }))
                    }
                    required
                  />
                  {fieldError(studentErrors, "birthDate", tr)}
                </label>
                <label>
                  {tr("Lieu de naissance")}<input
                    value={studentForm.birthPlace}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, birthPlace: event.target.value }))
                    }
                  />
                </label>
                <label>
                  {tr("Nationalité")}<input
                    value={studentForm.nationality}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, nationality: event.target.value }))
                    }
                  />
                </label>
              </fieldset>

              <fieldset className="students-form-section">
                <legend>{tr("Coordonnées utiles")}</legend>
                <label>
                  {tr("Téléphone principal du responsable")}<input
                    value={studentForm.phone}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, phone: event.target.value }))
                    }
                  />
                </label>
                <label>
                  {tr("Email")}<input
                    type="email"
                    value={studentForm.email}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, email: event.target.value }))
                    }
                  />
                  {fieldError(studentErrors, "email", tr)}
                </label>
                <label className="span-2">
                  {tr("Adresse")}<input
                    value={studentForm.address}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, address: event.target.value }))
                    }
                  />
                </label>
              </fieldset>

              <fieldset className="students-form-section">
                <legend>{tr("Scolarité administrative")}</legend>
                <label>
                  {tr("Établissement *")}<select
                    value={studentForm.establishmentId}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, establishmentId: event.target.value }))
                    }
                    required
                  >
                    <option value={DEFAULT_ESTABLISHMENT_VALUE}>{SCHOOL_NAME}</option>
                    {studentForm.establishmentId &&
                    studentForm.establishmentId !== DEFAULT_ESTABLISHMENT_VALUE ? (
                      <option value={studentForm.establishmentId}>{SCHOOL_NAME}</option>
                    ) : null}
                  </select>
                  {fieldError(studentErrors, "establishmentId", tr)}
                </label>
                <label>
                  {tr("Date d’admission")}<input
                    type="date"
                    value={studentForm.admissionDate}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, admissionDate: event.target.value }))
                    }
                  />
                  {fieldError(studentErrors, "admissionDate", tr)}
                </label>
                <label>
                  {tr("Statut *")}<select
                    value={studentForm.status}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, status: event.target.value }))
                    }
                    required
                  >
                    <option value="ACTIVE">{tr("Actif")}</option>
                    <option value="INACTIVE">{tr("Inactif")}</option>
                    <option value="PENDING">{tr("En attente")}</option>
                    <option value="DRAFT">{tr("Brouillon")}</option>
                    <option value="SUSPENDED">{tr("Suspendu")}</option>
                    <option value="ARCHIVED">{tr("Archivé")}</option>
                  </select>
                  {fieldError(studentErrors, "status", tr)}
                </label>
                <label>
                  {tr("Langue principale")}<input
                    value={studentForm.primaryLanguage}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, primaryLanguage: event.target.value }))
                    }
                  />
                </label>
              </fieldset>

              <fieldset className="students-form-section">
                <legend>{tr("Informations complémentaires")}</legend>
                <label className="span-2">
                  {tr("Besoins particuliers")}<textarea
                    value={studentForm.specialNeeds}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, specialNeeds: event.target.value }))
                    }
                    rows={3}
                  />
                </label>
                <label className="span-2">
                  {tr("Notes administratives")}<textarea
                    value={studentForm.administrativeNotes}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, administrativeNotes: event.target.value }))
                    }
                    rows={3}
                  />
                </label>
              </fieldset>

              <div className="actions span-2">
                <button type="submit">{editingStudentId ? tr("Enregistrer le dossier") : tr("Créer le dossier")}</button>
                <button type="button" className="button-ghost" onClick={onResetStudentForm}>
                  {tr("Réinitialiser")}</button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => onStudentWorkflowStepChange("list")}
                >
                  {tr("Voir la base élèves")}</button>
              </div>
            </form>
          </section>
        ) : null}

      {studentWorkflowStep === "list" ? (
        <>
          <section className="panel students-v3-filter-card" aria-label={tr("Filtres élèves")}>
            <label className="students-v3-search-field">
              <span>{tr("Recherche rapide")}</span>
              <input
                className="search-input"
                placeholder={tr("Nom, matricule ou classe...")}
                value={studentSearch}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </label>
            <label className="students-v3-filter-field">
              <span>{tr("Statut")}</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="ALL">{tr("Tous les statuts")}</option>
                <option value="ACTIVE">{tr("Actifs")}</option>
                <option value="INACTIVE">{tr("Inactifs")}</option>
                <option value="PENDING">{tr("En attente")}</option>
                <option value="DRAFT">{tr("Brouillons")}</option>
                <option value="SUSPENDED">{tr("Suspendus")}</option>
                <option value="ARCHIVED">{tr("Archivés")}</option>
              </select>
            </label>
            <label className="students-v3-filter-field">
              <span>{tr("Cursus")}</span>
              <select value={trackFilter} onChange={(event) => setTrackFilter(event.target.value)}>
                <option value="ALL">{tr("Tous les cursus")}</option>
                <option value="FRANCOPHONE">{tr("Francophone")}</option>
                <option value="ARABOPHONE">{tr("Arabophone")}</option>
                <option value="BICURSUS">{tr("Bi-cursus")}</option>
                <option value="UNASSIGNED">{tr("À régulariser")}</option>
              </select>
            </label>
            <button type="button" className="button-ghost" onClick={resetListFilters} disabled={!hasListFilters}>
              {tr("Réinitialiser")}</button>
          </section>

          <section className="panel table-panel module-modern students-list-panel students-v3-table-card">
            <div className="students-v3-table-head">
              <div>
                <h2>{tr("Base élèves (")}{filteredStudents.length})</h2>
                <p>{tr("Statuts et placements issus des inscriptions validées.")}</p>
              </div>
              <span className="students-overview-status">
                {studentsLoading ? tr("Synchronisation en cours") : `${students.length} dossier(s)`}
              </span>
            </div>
            <div className="table-wrap">
              <table className="students-v3-table" data-responsive-table="true">
                <thead>
                  <tr>
                    <th>{tr("Élève")}</th>
                    <th>{tr("Matricule")}</th>
                    <th>{tr("Classe / cursus")}</th>
                    <th>{tr("Statut")}</th>
                    <th className="students-v3-actions-heading" aria-label={tr("Actions")}></th>
                  </tr>
                </thead>
                <tbody>
                  {studentsLoading ? (
                    <tr>
                      <td colSpan={5} className="empty-row">
                        {tr("Chargement...")}</td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-row">
                        {tr("Aucun élève enregistré.")}</td>
                    </tr>
                  ) : (
                    filteredStudents.map((item) => (
                      <tr key={item.id}>
                        <td data-label={tr("Élève")}>
                          <div className="students-v3-student-cell">
                            <span className="students-v3-avatar">{getStudentInitials(item)}</span>
                            <div>
                              <strong>{getStudentDisplayName(item)}</strong>
                              <small>{item.birthDate || tr("Date de naissance à compléter")}</small>
                            </div>
                          </div>
                        </td>
                        <td data-label={tr("Matricule")} className="students-v3-muted-cell">
                          {item.matricule}
                        </td>
                        <td data-label={tr("Classe / cursus")}>
                          <div className="students-v3-class-cell">
                            <strong>{formatPrimaryClass(item)}</strong>
                            <span className="students-v3-class-badge">{formatStudentTracks(item)}</span>
                          </div>
                        </td>
                        <td data-label={tr("Statut")}>
                          <span className={getStudentStatusClassName(item.status)}>
                            {formatStudentStatus(item.status)}
                          </span>
                        </td>
                        <td data-label={tr("Actions")}>
                          <div className="students-v3-action-cell v3-action-cell">
                            <button
                              type="button"
                              className="students-v3-more-button v3-more-button"
                              aria-label={`Actions pour ${getStudentDisplayName(item)}`}
                              aria-expanded={openActionMenuId === item.id}
                              onClick={() => toggleActionMenu(item.id)}
                            >
                              <span aria-hidden="true">...</span>
                            </button>
                            {openActionMenuId === item.id ? (
                              <div className="students-v3-action-menu v3-action-menu" role="menu">
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    closeActionMenu();
                                    onViewStudent(item);
                                  }}
                                >
                                  {tr("Voir")}</button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    closeActionMenu();
                                    onEditStudent(item);
                                  }}
                                >
                                  {tr("Modifier")}</button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="is-danger"
                                  onClick={() => {
                                    closeActionMenu();
                                    onDeleteStudent(item.id);
                                  }}
                                >
                                  {tr("Archiver")}</button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {selectedStudent ? (
              <aside className="students-detail-panel" aria-label={tr("Dossier consulté")}>
                <div className="table-header">
                  <div>
                    <p className="section-kicker">{tr("Dossier consulté")}</p>
                    <h3>{getStudentDisplayName(selectedStudent)}</h3>
                  </div>
                  <span className={getStudentStatusClassName(selectedStudent.status)}>
                    {formatStudentStatus(selectedStudent.status)}
                  </span>
                </div>
                <div className="students-detail-grid">
                  <div>
                    <span>{tr("Matricule")}</span>
                    <strong>{selectedStudent.matricule}</strong>
                  </div>
                  <div>
                    <span>{tr("Date de naissance")}</span>
                    <strong>{selectedStudent.birthDate || "-"}</strong>
                  </div>
                  <div>
                    <span>{tr("Cursus")}</span>
                    <strong>{formatStudentTracks(selectedStudent)}</strong>
                  </div>
                  <div>
                    <span>{tr("Classe principale")}</span>
                    <strong>{formatPrimaryClass(selectedStudent)}</strong>
                  </div>
                </div>
              </aside>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
