import type { Dispatch, SetStateAction } from "react";

import type { Subject, TeacherRecord, TeacherSkillRecord, TeacherWorkloadRecord } from "../../../shared/types/app";
import {
  SCHOOL_NAME,
  TEACHER_STATUSES,
  TEACHER_TYPES,
  TRACKS,
  type TeacherFilters,
  defaultTeacherFilters,
  trackLabel
} from "../teachers-screen-model";

export function TeachersListSection(props: {
  filters: TeacherFilters;
  loading: boolean;
  onAddTeacher: () => void;
  onArchiveTeacher: (teacherId: string) => void;
  onEditTeacher: (teacher: TeacherRecord) => void;
  onFilter: () => void;
  onOpenDetail: (teacherId: string) => void;
  onReload: () => void;
  setFilters: Dispatch<SetStateAction<TeacherFilters>>;
  subjects: Subject[];
  teachers: TeacherRecord[];
}): JSX.Element {
  const {
    filters,
    loading,
    onAddTeacher,
    onArchiveTeacher,
    onEditTeacher,
    onFilter,
    onOpenDetail,
    onReload,
    setFilters,
    subjects,
    teachers
  } = props;

  return (
    <section className="panel table-panel workflow-section module-modern teachers-panel">
      <div className="table-header">
        <div>
          <p className="section-kicker">Registre enseignants</p>
          <h2>Liste enseignants</h2>
        </div>
        <button type="button" onClick={onAddTeacher}>Ajouter un enseignant</button>
      </div>
      <div className="filter-grid module-filter teachers-filter-grid">
        <label>
          Recherche
          <input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Nom, prenom, matricule, email"
          />
        </label>
        <label>
          Statut
          <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="">Tous</option>
            {TEACHER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label>
          Type
          <select value={filters.teacherType} onChange={(event) => setFilters((prev) => ({ ...prev, teacherType: event.target.value }))}>
            <option value="">Tous</option>
            {TEACHER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label>
          Matiere
          <select value={filters.subjectId} onChange={(event) => setFilters((prev) => ({ ...prev, subjectId: event.target.value }))}>
            <option value="">Toutes</option>
            {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}
          </select>
        </label>
        <label>
          Cursus
          <select value={filters.track} onChange={(event) => setFilters((prev) => ({ ...prev, track: event.target.value }))}>
            <option value="">Tous</option>
            {TRACKS.map((track) => <option key={track} value={track}>{trackLabel(track)}</option>)}
          </select>
        </label>
        <div className="actions">
          <button type="button" onClick={onFilter}>Filtrer</button>
          <button
            type="button"
            className="button-ghost"
            onClick={() => {
              setFilters(defaultTeacherFilters());
              onReload();
            }}
          >
            Reinitialiser
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Matricule</th>
              <th>Nom complet</th>
              <th>Telephone</th>
              <th>Email</th>
              <th>Type</th>
              <th>Etablissement</th>
              <th>Statut</th>
              <th>Affect.</th>
              <th>Charge</th>
              <th>FR/AR</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.length === 0 ? (
              <tr><td colSpan={11} className="empty-row">{loading ? "Chargement..." : "Aucun enseignant."}</td></tr>
            ) : teachers.map((teacher) => (
              <tr key={teacher.id}>
                <td>{teacher.matricule}</td>
                <td>{teacher.fullName}</td>
                <td>{teacher.primaryPhone || "-"}</td>
                <td>{teacher.email || "-"}</td>
                <td>{teacher.teacherType}</td>
                <td>{SCHOOL_NAME}</td>
                <td><span className="status-pill">{teacher.status}</span></td>
                <td>{teacher.activeAssignmentsCount}</td>
                <td>{teacher.workloadHoursTotal} h</td>
                <td>{teacher.francophoneWorkloadHoursTotal} h / {teacher.arabophoneWorkloadHoursTotal} h</td>
                <td>
                  <div className="table-actions">
                    <button type="button" className="button-ghost" onClick={() => onOpenDetail(teacher.id)}>Detail</button>
                    <button type="button" className="button-ghost" onClick={() => onEditTeacher(teacher)}>Modifier</button>
                    <button type="button" className="button-ghost" onClick={() => onArchiveTeacher(teacher.id)}>Archiver</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TeachersSummarySection(props: {
  assignments: { status: string }[];
  loading: boolean;
  skills: TeacherSkillRecord[];
  teachers: TeacherRecord[];
  workloads: TeacherWorkloadRecord[];
}): JSX.Element {
  const { assignments, loading, skills, teachers, workloads } = props;

  return (
    <section className="panel table-panel workflow-section module-modern teachers-hero">
      <div className="table-header">
        <div>
          <p className="section-kicker">Gestion pedagogique</p>
          <h2>Module enseignants</h2>
        </div>
        <span className="module-header-badge">{loading ? "Synchronisation..." : `${teachers.length} enseignant(s)`}</span>
      </div>
      <p className="section-lead">
        Fiche enseignant, competences, affectations reelles, charge de travail et documents. L'ancien lien
        portail reste dans IAM, mais la verite metier vit ici.
      </p>
      <div className="module-overview-grid">
        <article className="module-overview-card">
          <span>Actifs</span>
          <strong>{teachers.filter((item) => item.status === "ACTIVE").length}</strong>
          <small>Enseignants affectables</small>
        </article>
        <article className="module-overview-card">
          <span>Competences</span>
          <strong>{skills.length}</strong>
          <small>Matiere et perimetre autorises</small>
        </article>
        <article className="module-overview-card">
          <span>Affectations</span>
          <strong>{assignments.filter((item) => item.status === "ACTIVE").length}</strong>
          <small>Classe + matiere + annee</small>
        </article>
        <article className="module-overview-card">
          <span>Charge hebdo</span>
          <strong>{workloads.reduce((sum, item) => sum + item.workloadHoursTotal, 0)}</strong>
          <small>Heures declarees</small>
        </article>
      </div>
    </section>
  );
}
