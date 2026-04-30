import { type FormEvent } from "react";

import { WorkflowGuide } from "../../../shared/components/workflow-guide";
import type { AcademicTrack, FieldErrors, Student, WorkflowStepDef } from "../../../shared/types/app";
import { fieldError } from "../../../shared/utils/form-ui";
import type { StudentForm } from "../types/students";

type StudentsPanelProps = {
  editingStudentId: string | null;
  studentErrors: FieldErrors;
  studentForm: StudentForm;
  studentSearch: string;
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
};

const SCHOOL_NAME = "Al Manarat Islamiyat";

const formatTrackLabel = (track?: AcademicTrack): string =>
  track === "ARABOPHONE" ? "Arabophone" : "Francophone";

const formatStudentTracks = (student: Student): string => {
  const tracks = student.tracks || [];
  if (tracks.length === 0) return "A regulariser via inscription";
  if (tracks.length > 1) return "Francophone + Arabophone";
  return formatTrackLabel(tracks[0]);
};

const formatPrimaryClass = (student: Student): string => {
  const placements = student.placements || [];
  const primary = placements.find((placement) => placement.isPrimary) || placements[0];
  if (!primary) return "-";
  return [primary.classLabel || primary.levelLabel, formatTrackLabel(primary.track)]
    .filter(Boolean)
    .join(" / ");
};

const formatParentSummary = (student: Student): string => {
  const parents = student.parents || [];
  if (parents.length === 0) return "Aucun responsable";
  const primary = parents.find((parent) => parent.isPrimaryContact) || parents[0];
  return parents.length > 1 ? `${primary.parentName} +${parents.length - 1}` : primary.parentName;
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
    shownStudents,
    studentErrors,
    studentForm,
    studentSearch,
    studentWorkflowStep,
    students,
    studentsLoading
  } = props;
  const activeStudents = students.filter((student) => (student.status || "ACTIVE") === "ACTIVE").length;
  const bicursusCount = students.filter((student) => (student.tracks || []).length > 1).length;
  const studentsWithParents = students.filter((student) => (student.parents || []).length > 0).length;
  const latestStudents = shownStudents.slice(0, 3);

  const studentSteps: WorkflowStepDef[] = [
    {
      id: "entry",
      title: editingStudentId ? "Edition du dossier" : "Nouveau dossier",
      hint: "Identite, administratif leger et statut du dossier eleve."
    },
    {
      id: "list",
      title: "Base eleves",
      hint: "Suivre les dossiers, cursus et responsables rattaches.",
      done: students.length > 0
    }
  ];

  return (
    <WorkflowGuide
      title="Eleves"
      steps={studentSteps}
      activeStepId={studentWorkflowStep}
      onStepChange={onStudentWorkflowStepChange}
    >
      <div className="students-screen-shell">
        <section data-step-id="list" className="panel table-panel workflow-section module-modern students-overview">
          <div className="table-header">
            <div>
              <p className="section-kicker">Dossier eleve</p>
              <h2>Base eleves</h2>
            </div>
            <span className="students-overview-status">
              {studentsLoading ? "Synchronisation en cours" : `${students.length} dossier(s)`}
            </span>
          </div>
          <p className="section-lead">
            Le cursus n'est pas un champ decoratif du dossier: la source de verite reste l'inscription par
            placement francophone/arabophone, affichee ici pour lecture rapide.
          </p>
          <div className="students-overview-grid">
            <article className="students-overview-card">
              <span>Actifs</span>
              <strong>{activeStudents}</strong>
              <small>Dossiers exploitables</small>
            </article>
            <article className="students-overview-card">
              <span>Bi-cursus</span>
              <strong>{bicursusCount}</strong>
              <small>Francophone + arabophone</small>
            </article>
            <article className="students-overview-card">
              <span>Responsables</span>
              <strong>{studentsWithParents}</strong>
              <small>Eleves avec parent lie</small>
            </article>
            <article className="students-overview-card">
              <span>Resultat filtre</span>
              <strong>{shownStudents.length}</strong>
              <small>Liste actuellement affichee</small>
            </article>
          </div>
          {latestStudents.length > 0 ? (
            <div className="students-overview-foot">
              <span>Derniers dossiers visibles</span>
              <div className="students-overview-chips">
                {latestStudents.map((student) => (
                  <span key={student.id}>
                    {student.matricule} - {student.firstName} {student.lastName}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {studentWorkflowStep === "entry" ? (
          <section data-step-id="entry" className="panel editor-panel workflow-section module-modern">
            <div className="table-header">
              <div>
                <p className="section-kicker">Formulaire eleve</p>
                <h2>{editingStudentId ? "Modifier un eleve" : "Ajouter un eleve"}</h2>
              </div>
              <span className="students-overview-status">
                {editingStudentId ? "Mode edition" : "Nouvelle creation"}
              </span>
            </div>
            <p className="section-lead">
              Le formulaire gere le dossier administratif. Les classes/cursus sont consolides via les inscriptions.
            </p>
            <form className="form-grid module-form students-form-grid" onSubmit={onSubmitStudent}>
              <label>
                Matricule
                <input
                  value={studentForm.matricule}
                  onChange={(event) =>
                    onStudentFormChange((prev) => ({ ...prev, matricule: event.target.value }))
                  }
                  required
                />
                {fieldError(studentErrors, "matricule")}
              </label>
              <label>
                Prenom
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
                Nom
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
                Sexe
                <select
                  value={studentForm.sex}
                  onChange={(event) =>
                    onStudentFormChange((prev) => ({
                      ...prev,
                      sex: event.target.value as "M" | "F"
                    }))
                  }
                >
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
                {fieldError(studentErrors, "sex")}
              </label>
              <label>
                Date de naissance
                <input
                  type="date"
                  value={studentForm.birthDate}
                  onChange={(event) =>
                    onStudentFormChange((prev) => ({ ...prev, birthDate: event.target.value }))
                  }
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
                Nationalite
                <input
                  value={studentForm.nationality}
                  onChange={(event) =>
                    onStudentFormChange((prev) => ({ ...prev, nationality: event.target.value }))
                  }
                />
              </label>
              <label>
                Etablissement
                <select
                  value={studentForm.establishmentId}
                  onChange={(event) =>
                    onStudentFormChange((prev) => ({ ...prev, establishmentId: event.target.value }))
                  }
                >
                  <option value="">{SCHOOL_NAME}</option>
                </select>
              </label>
              <label>
                Telephone famille
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
              <label>
                Date admission
                <input
                  type="date"
                  value={studentForm.admissionDate}
                  onChange={(event) =>
                    onStudentFormChange((prev) => ({ ...prev, admissionDate: event.target.value }))
                  }
                />
              </label>
              <label>
                Statut
                <select
                  value={studentForm.status}
                  onChange={(event) =>
                    onStudentFormChange((prev) => ({ ...prev, status: event.target.value }))
                  }
                >
                  <option value="ACTIVE">Actif</option>
                  <option value="INACTIVE">Inactif</option>
                  <option value="SUSPENDED">Suspendu</option>
                  <option value="ARCHIVED">Archive</option>
                </select>
              </label>
              <label>
                Identifiant interne
                <input
                  value={studentForm.internalId}
                  onChange={(event) =>
                    onStudentFormChange((prev) => ({ ...prev, internalId: event.target.value }))
                  }
                />
              </label>
              <label>
                Acte de naissance
                <input
                  value={studentForm.birthCertificateNo}
                  onChange={(event) =>
                    onStudentFormChange((prev) => ({ ...prev, birthCertificateNo: event.target.value }))
                  }
                />
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
              <label className="span-2">
                Adresse
                <input
                  value={studentForm.address}
                  onChange={(event) =>
                    onStudentFormChange((prev) => ({ ...prev, address: event.target.value }))
                  }
                />
              </label>
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
              <div className="actions span-2">
                <button type="submit">{editingStudentId ? "Mettre a jour" : "Ajouter"}</button>
                <button type="button" className="button-ghost" onClick={onResetStudentForm}>
                  Reinitialiser
                </button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => onStudentWorkflowStepChange("list")}
                >
                  Aller a la liste
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {studentWorkflowStep === "list" ? (
          <section data-step-id="list" className="panel table-panel workflow-section module-modern students-list-panel">
            <div className="table-header">
              <div>
                <p className="section-kicker">Registre eleves</p>
                <h2>Liste des eleves</h2>
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
              Lecture metier: statut du dossier, cursus actifs via placements et responsables rattaches.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Nom</th>
                    <th>Sexe</th>
                    <th>Naissance</th>
                    <th>Statut</th>
                    <th>Cursus</th>
                    <th>Classe</th>
                    <th>Parents</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsLoading ? (
                    <tr>
                      <td colSpan={9} className="empty-row">
                        Chargement...
                      </td>
                    </tr>
                  ) : shownStudents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="empty-row">
                        Aucun eleve.
                      </td>
                    </tr>
                  ) : (
                    shownStudents.map((item) => (
                      <tr key={item.id}>
                        <td>{item.matricule}</td>
                        <td>{item.fullName || `${item.firstName} ${item.lastName}`}</td>
                        <td>{item.sex}</td>
                        <td>{item.birthDate || "-"}</td>
                        <td>{item.status || "ACTIVE"}</td>
                        <td>{formatStudentTracks(item)}</td>
                        <td>{formatPrimaryClass(item)}</td>
                        <td>{formatParentSummary(item)}</td>
                        <td>
                          <div className="row-actions">
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
          </section>
        ) : null}
      </div>
    </WorkflowGuide>
  );
}
