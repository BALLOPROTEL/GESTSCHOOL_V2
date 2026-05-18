import { type FormEvent } from "react";

import { WorkflowGuide } from "../../../shared/components/workflow-guide";
import type { AcademicTrack, FieldErrors, Student, WorkflowStepDef } from "../../../shared/types/app";
import { fieldError } from "../../../shared/utils/form-ui";
import { DEFAULT_ESTABLISHMENT_VALUE, type StudentForm } from "../types/students";

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

const formatStudentTracks = (student: Student): string => {
  const placementTracks = (student.placements || []).map((placement) => placement.track);
  const tracks = (student.tracks && student.tracks.length > 0 ? student.tracks : placementTracks).filter(
    (track, index, allTracks) => allTracks.indexOf(track) === index
  );
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

const formatParentSummary = (student: Student): string => {
  const parents = student.parents || [];
  if (parents.length === 0) return "Aucun responsable";
  const primary = parents.find((parent) => parent.isPrimaryContact) || parents[0];
  return parents.length > 1 ? `${parents.length} responsables` : primary.parentName;
};

export function StudentsPanel(props: StudentsPanelProps): JSX.Element {
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
  const activeStudents = students.filter((student) => (student.status || "ACTIVE").toUpperCase() === "ACTIVE").length;
  const bicursusCount = students.filter((student) => (student.tracks || []).length > 1).length;
  const studentsWithParents = students.filter((student) => (student.parents || []).length > 0).length;

  const studentSteps: WorkflowStepDef[] = [
    {
      id: "entry",
      title: editingStudentId ? "Modifier le dossier" : "Ajouter un élève",
      hint: "Dossier administratif, statut et informations utiles."
    },
    {
      id: "list",
      title: "Base élèves",
      hint: "Lire les dossiers, responsables et placements issus des inscriptions.",
      done: students.length > 0
    }
  ];

  return (
    <WorkflowGuide
      title="Élèves"
      steps={studentSteps}
      activeStepId={studentWorkflowStep}
      onStepChange={onStudentWorkflowStepChange}
    >
      <div className="students-screen-shell">
        <section data-step-id="list" className="panel table-panel workflow-section module-modern students-overview">
          <div className="table-header">
            <div>
              <p className="section-kicker">Dossier administratif</p>
              <h2>Base élèves</h2>
            </div>
            <span className="students-overview-status">
              {studentsLoading ? "Synchronisation en cours" : `${students.length} dossier(s)`}
            </span>
          </div>
          <p className="section-lead">
            Les classes et cursus affichés ici proviennent des inscriptions validées.
          </p>
          <div className="students-overview-grid">
            <article className="students-overview-card">
              <span>Dossiers actifs</span>
              <strong>{activeStudents}</strong>
              <small>dossiers de la base élèves</small>
            </article>
            <article className="students-overview-card">
              <span>Élèves bi-cursus</span>
              <strong>{bicursusCount}</strong>
              <small>parcours multiples</small>
            </article>
            <article className="students-overview-card">
              <span>Responsables liés</span>
              <strong>{studentsWithParents}</strong>
              <small>responsables rattachés</small>
            </article>
            <article className="students-overview-card">
              <span>Dossiers affichés</span>
              <strong>{shownStudents.length}</strong>
              <small>dossiers affichés</small>
            </article>
          </div>
        </section>

        {studentWorkflowStep === "entry" ? (
          <section data-step-id="entry" className="panel editor-panel workflow-section module-modern">
            <div className="table-header">
              <div>
                <p className="section-kicker">Dossier administratif</p>
                <h2>{editingStudentId ? "Modifier le dossier" : "Ajouter un élève"}</h2>
              </div>
              <span className="students-overview-status">
                {editingStudentId ? "Mode édition" : "Nouveau dossier"}
              </span>
            </div>
            <p className="section-lead">
              Ce formulaire crée le dossier administratif de l’élève. Les classes et cursus sont gérés ensuite depuis les inscriptions.
            </p>
            <form className="form-grid module-form students-form-grid" onSubmit={onSubmitStudent}>
              <fieldset className="students-form-section">
                <legend>Identité</legend>
                <label>
                  Matricule *
                  <input
                    value={studentForm.matricule}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, matricule: event.target.value }))
                    }
                    required
                  />
                  <small>Matricule obligatoire pour enregistrer le dossier.</small>
                  {fieldError(studentErrors, "matricule")}
                </label>
                <label>
                  Prénom *
                  <input
                    value={studentForm.firstName}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, firstName: event.target.value }))
                    }
                    required
                  />
                  {fieldError(studentErrors, "firstName")}
                </label>
                <label>
                  Nom *
                  <input
                    value={studentForm.lastName}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, lastName: event.target.value }))
                    }
                    required
                  />
                  {fieldError(studentErrors, "lastName")}
                </label>
                <label>
                  Sexe *
                  <select
                    value={studentForm.sex}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({
                        ...prev,
                        sex: event.target.value as "M" | "F"
                      }))
                    }
                    required
                  >
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                  {fieldError(studentErrors, "sex")}
                </label>
                <label>
                  Date de naissance *
                  <input
                    type="date"
                    value={studentForm.birthDate}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, birthDate: event.target.value }))
                    }
                    required
                  />
                  {fieldError(studentErrors, "birthDate")}
                </label>
                <label>
                  Lieu de naissance
                  <input
                    value={studentForm.birthPlace}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, birthPlace: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Nationalité
                  <input
                    value={studentForm.nationality}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, nationality: event.target.value }))
                    }
                  />
                </label>
              </fieldset>

              <fieldset className="students-form-section">
                <legend>Coordonnées utiles</legend>
                <label>
                  Téléphone principal du responsable
                  <input
                    value={studentForm.phone}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, phone: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={studentForm.email}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, email: event.target.value }))
                    }
                  />
                  {fieldError(studentErrors, "email")}
                </label>
                <label className="span-2">
                  Adresse
                  <input
                    value={studentForm.address}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, address: event.target.value }))
                    }
                  />
                </label>
              </fieldset>

              <fieldset className="students-form-section">
                <legend>Scolarité administrative</legend>
                <label>
                  Établissement *
                  <select
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
                  {fieldError(studentErrors, "establishmentId")}
                </label>
                <label>
                  Date d’admission
                  <input
                    type="date"
                    value={studentForm.admissionDate}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, admissionDate: event.target.value }))
                    }
                  />
                  {fieldError(studentErrors, "admissionDate")}
                </label>
                <label>
                  Statut *
                  <select
                    value={studentForm.status}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, status: event.target.value }))
                    }
                    required
                  >
                    <option value="ACTIVE">Actif</option>
                    <option value="INACTIVE">Inactif</option>
                    <option value="PENDING">En attente</option>
                    <option value="DRAFT">Brouillon</option>
                    <option value="SUSPENDED">Suspendu</option>
                    <option value="ARCHIVED">Archivé</option>
                  </select>
                  {fieldError(studentErrors, "status")}
                </label>
                <label>
                  Langue principale
                  <input
                    value={studentForm.primaryLanguage}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, primaryLanguage: event.target.value }))
                    }
                  />
                </label>
              </fieldset>

              <fieldset className="students-form-section">
                <legend>Informations complémentaires</legend>
                <label className="span-2">
                  Besoins particuliers
                  <textarea
                    value={studentForm.specialNeeds}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, specialNeeds: event.target.value }))
                    }
                    rows={3}
                  />
                </label>
                <label className="span-2">
                  Notes administratives
                  <textarea
                    value={studentForm.administrativeNotes}
                    onChange={(event) =>
                      onStudentFormChange((prev) => ({ ...prev, administrativeNotes: event.target.value }))
                    }
                    rows={3}
                  />
                </label>
              </fieldset>

              <div className="actions span-2">
                <button type="submit">{editingStudentId ? "Enregistrer le dossier" : "Créer le dossier"}</button>
                <button type="button" className="button-ghost" onClick={onResetStudentForm}>
                  Réinitialiser
                </button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => onStudentWorkflowStepChange("list")}
                >
                  Voir la base élèves
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {studentWorkflowStep === "list" ? (
          <section data-step-id="list" className="panel table-panel workflow-section module-modern students-list-panel">
            <div className="table-header">
              <div>
                <p className="section-kicker">Base élèves</p>
                <h2>Base élèves</h2>
              </div>
              <div className="students-table-toolbar">
                <label className="students-search-field">
                  <span>Recherche rapide</span>
                  <input
                    className="search-input"
                    placeholder="Matricule, nom, parent, cursus"
                    value={studentSearch}
                    onChange={(event) => onSearchChange(event.target.value)}
                  />
                </label>
              </div>
            </div>
            <p className="section-lead">
              Lecture métier : statut du dossier, responsables et placements issus des inscriptions validées.
            </p>
            <div className="table-wrap">
              <table data-responsive-table="true">
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Nom complet</th>
                    <th>Date de naissance</th>
                    <th>Statut</th>
                    <th>Cursus</th>
                    <th>Classe principale</th>
                    <th>Responsables</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsLoading ? (
                    <tr>
                      <td colSpan={8} className="empty-row">
                        Chargement...
                      </td>
                    </tr>
                  ) : shownStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty-row">
                        Aucun élève enregistré.
                      </td>
                    </tr>
                  ) : (
                    shownStudents.map((item) => (
                      <tr key={item.id}>
                        <td data-label="Matricule">{item.matricule}</td>
                        <td data-label="Nom complet">{getStudentDisplayName(item)}</td>
                        <td data-label="Date de naissance">{item.birthDate || "-"}</td>
                        <td data-label="Statut">
                          <span className={getStudentStatusClassName(item.status)}>
                            {formatStudentStatus(item.status)}
                          </span>
                        </td>
                        <td data-label="Cursus">{formatStudentTracks(item)}</td>
                        <td data-label="Classe principale">{formatPrimaryClass(item)}</td>
                        <td data-label="Responsables">{formatParentSummary(item)}</td>
                        <td data-label="Actions">
                          <div className="row-actions">
                            <button
                              type="button"
                              className="button-ghost"
                              onClick={() => onViewStudent(item)}
                            >
                              Voir
                            </button>
                            <button
                              type="button"
                              className="button-ghost"
                              onClick={() => onEditStudent(item)}
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              className="button-danger"
                              onClick={() => onDeleteStudent(item.id)}
                            >
                              Archiver
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {selectedStudent ? (
              <aside className="students-detail-panel" aria-label="Dossier consulté">
                <div className="table-header">
                  <div>
                    <p className="section-kicker">Dossier consulté</p>
                    <h3>{getStudentDisplayName(selectedStudent)}</h3>
                  </div>
                  <span className={getStudentStatusClassName(selectedStudent.status)}>
                    {formatStudentStatus(selectedStudent.status)}
                  </span>
                </div>
                <div className="students-detail-grid">
                  <div>
                    <span>Matricule</span>
                    <strong>{selectedStudent.matricule}</strong>
                  </div>
                  <div>
                    <span>Date de naissance</span>
                    <strong>{selectedStudent.birthDate || "-"}</strong>
                  </div>
                  <div>
                    <span>Cursus</span>
                    <strong>{formatStudentTracks(selectedStudent)}</strong>
                  </div>
                  <div>
                    <span>Classe principale</span>
                    <strong>{formatPrimaryClass(selectedStudent)}</strong>
                  </div>
                  <div>
                    <span>Responsables</span>
                    <strong>{formatParentSummary(selectedStudent)}</strong>
                  </div>
                </div>
              </aside>
            ) : null}
          </section>
        ) : null}
      </div>
    </WorkflowGuide>
  );
}
