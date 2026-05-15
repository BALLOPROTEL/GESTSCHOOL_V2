import type { Dispatch, SetStateAction } from "react";

import { translateUiString, type UiLanguage } from "../../../shared/i18n";
import type { Subject, TeacherRecord, TeacherSkillRecord, TeacherWorkloadRecord } from "../../../shared/types/app";
import {
  SCHOOL_NAME,
  TEACHER_STATUSES,
  TEACHER_TYPES,
  TRACKS,
  type TeacherFilters,
  defaultTeacherFilters,
  statusPillClass,
  teacherStatusLabel,
  teacherTypeLabel,
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
  language?: UiLanguage;
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
    teachers,
    language = "fr"
  } = props;
  const t = (value: string): string => translateUiString(language, value);

  return (
    <section className="panel table-panel workflow-section module-modern teachers-panel">
      <div className="table-header">
        <div>
          <p className="section-kicker">{t("Registre enseignants")}</p>
          <h2>{t("Liste des enseignants")}</h2>
        </div>
        <button type="button" onClick={onAddTeacher}>{t("Ajouter un enseignant")}</button>
      </div>
      <div className="filter-grid module-filter teachers-filter-grid">
        <label>
          {t("Recherche")}
          <input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder={t("Nom, prénom, matricule, email")}
          />
        </label>
        <label>
          {t("Statut")}
          <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="">{t("Tous")}</option>
            {TEACHER_STATUSES.map((status) => <option key={status} value={status}>{t(teacherStatusLabel(status))}</option>)}
          </select>
        </label>
        <label>
          {t("Type")}
          <select value={filters.teacherType} onChange={(event) => setFilters((prev) => ({ ...prev, teacherType: event.target.value }))}>
            <option value="">{t("Tous")}</option>
            {TEACHER_TYPES.map((type) => <option key={type} value={type}>{t(teacherTypeLabel(type))}</option>)}
          </select>
        </label>
        <label>
          {t("Matière")}
          <select value={filters.subjectId} onChange={(event) => setFilters((prev) => ({ ...prev, subjectId: event.target.value }))}>
            <option value="">{t("Toutes")}</option>
            {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}</option>)}
          </select>
        </label>
        <label>
          Cursus
          <select value={filters.track} onChange={(event) => setFilters((prev) => ({ ...prev, track: event.target.value }))}>
            <option value="">{t("Tous")}</option>
            {TRACKS.map((track) => <option key={track} value={track}>{t(trackLabel(track))}</option>)}
          </select>
        </label>
        <div className="actions">
          <button type="button" onClick={onFilter}>{t("Filtrer")}</button>
          <button
            type="button"
            className="button-ghost"
            onClick={() => {
              setFilters(defaultTeacherFilters());
              onReload();
            }}
          >
            {t("Réinitialiser")}
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("Matricule")}</th>
              <th>{t("Nom complet")}</th>
              <th>{t("Téléphone")}</th>
              <th>{t("Email")}</th>
              <th>{t("Type")}</th>
              <th>{t("Établissement")}</th>
              <th>{t("Statut")}</th>
              <th>{t("Affectations")}</th>
              <th>{t("Charge")}</th>
              <th>{t("Cursus")}</th>
              <th>{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {teachers.length === 0 ? (
              <tr><td colSpan={11} className="empty-row">{loading ? t("Chargement...") : t("Aucun enseignant trouvé.")}</td></tr>
            ) : teachers.map((teacher) => (
              <tr key={teacher.id}>
                <td>{teacher.matricule}</td>
                <td>{teacher.fullName}</td>
                <td>{teacher.primaryPhone || "-"}</td>
                <td>{teacher.email || "-"}</td>
                <td>{t(teacherTypeLabel(teacher.teacherType))}</td>
                <td>{SCHOOL_NAME}</td>
                <td><span className={statusPillClass(teacher.status)}>{t(teacherStatusLabel(teacher.status))}</span></td>
                <td>{teacher.activeAssignmentsCount}</td>
                <td>{teacher.workloadHoursTotal} h</td>
                <td>{teacher.francophoneWorkloadHoursTotal} h / {teacher.arabophoneWorkloadHoursTotal} h</td>
                <td>
                  <div className="table-actions">
                    <button type="button" className="button-ghost" onClick={() => onOpenDetail(teacher.id)}>{t("Détail")}</button>
                    <button type="button" className="button-edit" onClick={() => onEditTeacher(teacher)}>{t("Modifier")}</button>
                    <button type="button" className="button-ghost" onClick={() => onArchiveTeacher(teacher.id)}>{t("Archiver")}</button>
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
  language?: UiLanguage;
}): JSX.Element {
  const { assignments, loading, skills, teachers, workloads, language = "fr" } = props;
  const t = (value: string): string => translateUiString(language, value);

  return (
    <section className="panel table-panel workflow-section module-modern teachers-hero">
      <div className="table-header">
        <div>
          <p className="section-kicker">{t("Gestion pédagogique")}</p>
          <h2>{t("Module enseignants")}</h2>
        </div>
        <span className="module-header-badge">{loading ? t("Synchronisation...") : t(`${teachers.length} enseignant(s)`)}</span>
      </div>
      <p className="section-lead">
        {t("Gérez les fiches enseignants, leurs compétences, leurs affectations, leur charge horaire et leurs documents administratifs.")}
      </p>
      <div className="module-overview-grid">
        <article className="module-overview-card">
          <span>{t("Actifs")}</span>
          <strong>{teachers.filter((item) => item.status === "ACTIVE").length}</strong>
          <small>{t("Enseignants affectables")}</small>
        </article>
        <article className="module-overview-card">
          <span>{t("Compétences")}</span>
          <strong>{skills.length}</strong>
          <small>{t("Matières et périmètres autorisés")}</small>
        </article>
        <article className="module-overview-card">
          <span>{t("Affectations")}</span>
          <strong>{assignments.filter((item) => item.status === "ACTIVE").length}</strong>
          <small>{t("Classes, matières et années")}</small>
        </article>
        <article className="module-overview-card">
          <span>{t("Charge hebdo")}</span>
          <strong>{workloads.reduce((sum, item) => sum + item.workloadHoursTotal, 0)}</strong>
          <small>{t("Heures déclarées")}</small>
        </article>
      </div>
    </section>
  );
}
