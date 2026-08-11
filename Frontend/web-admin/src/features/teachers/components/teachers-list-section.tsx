import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { translateUiString, type UiLanguage } from "../../../shared/i18n";
import type { Subject, TeacherRecord, TeacherSkillRecord, TeacherWorkloadRecord } from "../../../shared/types/app";
import {
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
import { useI18n } from "../../../shared/i18n-context";
import { ResponsiveDataTable } from "../../../shared/components/responsive-data-table";
import { ResponsiveFilterPanel } from "../../../shared/components/responsive-filter-panel";
import { RowActionMenu } from "../../../shared/components/row-action-menu";


const teacherInitials = (teacher: TeacherRecord): string => {
  const source = teacher.fullName || `${teacher.firstName} ${teacher.lastName}`;
  const parts = source.trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return "EN";
  return `${parts[0]?.charAt(0) || ""}${parts[1]?.charAt(0) || parts[0]?.charAt(1) || ""}`.toUpperCase();
};

const pluralize = (count: number, singular: string, plural: string): string =>
  `${count} ${count > 1 ? plural : singular}`;

export function TeachersListSection(props: {
  filters: TeacherFilters;
  loading: boolean;
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
  const { t: tr } = useI18n();
  const {
    filters,
    loading,
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
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const t = (value: string): string => translateUiString(language, value);

  const hasFilters = Object.values(filters).some((value) => value.trim().length > 0);

  const closeActionMenu = (): void => setOpenActionMenuId(null);
  const toggleActionMenu = (teacherId: string): void => {
    setOpenActionMenuId((current) => (current === teacherId ? null : teacherId));
  };

  return (
    <>
      <ResponsiveFilterPanel
        className="panel teachers-v3-filter-card"
        title={t("Filtres enseignants")}
        activeCount={Object.values(filters).filter((value) => value.trim().length > 0).length}
      >
        <label className="teachers-v3-search-field">
          <span>{t("Recherche rapide")}</span>
          <input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder={t("Nom, matricule, email ou téléphone...")}
          />
        </label>
        <label className="teachers-v3-filter-field">
          <span>{t("Statut")}</span>
          <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="">{t("Tous les statuts")}</option>
            {TEACHER_STATUSES.map((status) => (
              <option key={status} value={status}>{t(teacherStatusLabel(status))}</option>
            ))}
          </select>
        </label>
        <label className="teachers-v3-filter-field">
          <span>{t("Type")}</span>
          <select
            value={filters.teacherType}
            onChange={(event) => setFilters((prev) => ({ ...prev, teacherType: event.target.value }))}
          >
            <option value="">{t("Tous les types")}</option>
            {TEACHER_TYPES.map((type) => (
              <option key={type} value={type}>{t(teacherTypeLabel(type))}</option>
            ))}
          </select>
        </label>
        <label className="teachers-v3-filter-field">
          <span>{t("Matière")}</span>
          <select
            value={filters.subjectId}
            onChange={(event) => setFilters((prev) => ({ ...prev, subjectId: event.target.value }))}
          >
            <option value="">{t("Toutes les matières")}</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.label}</option>
            ))}
          </select>
        </label>
        <label className="teachers-v3-filter-field">
          <span>{t("Cursus")}</span>
          <select value={filters.track} onChange={(event) => setFilters((prev) => ({ ...prev, track: event.target.value }))}>
            <option value="">{t("Tous les cursus")}</option>
            {TRACKS.map((track) => (
              <option key={track} value={track}>{t(trackLabel(track))}</option>
            ))}
          </select>
        </label>
        <div className="teachers-v3-filter-actions">
          <button type="button" onClick={onFilter}>{t("Appliquer")}</button>
          <button
            type="button"
            className="button-ghost"
            disabled={!hasFilters}
            onClick={() => {
              setFilters(defaultTeacherFilters());
              onReload();
            }}
          >
            {t("Réinitialiser")}
          </button>
        </div>
      </ResponsiveFilterPanel>

      <section className="panel table-panel module-modern teachers-v3-table-card">
        <div className="teachers-v3-table-head">
          <div>
            <h2>{t("Base enseignants")} ({teachers.length})</h2>
            <p>{loading ? t("Synchronisation en cours...") : t("Fiches, affectations et charges pédagogiques réelles.")}</p>
          </div>
          <span className="students-overview-status">{pluralize(teachers.length, "enseignant", "enseignants")}</span>
        </div>
        <ResponsiveDataTable label={t("Base enseignants")}>
          <table className="teachers-v3-table" data-responsive-table="true">
            <thead>
              <tr>
                <th>{t("Enseignant")}</th>
                <th>{t("Matricule")}</th>
                <th>{t("Type")}</th>
                <th>{t("Charge")}</th>
                <th>{t("Cursus")}</th>
                <th>{t("Statut")}</th>
                <th className="teachers-v3-actions-heading" aria-label={t("Actions")}></th>
              </tr>
            </thead>
            <tbody>
              {teachers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-row">
                    {loading ? t("Chargement...") : t("Aucun enseignant trouvé.")}
                  </td>
                </tr>
              ) : teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td data-label={t("Enseignant")}>
                    <div className="teachers-v3-teacher-cell">
                      <span className="teachers-v3-avatar">
                        {teacher.photoUrl ? <img src={teacher.photoUrl} alt="" /> : teacherInitials(teacher)}
                      </span>
                      <div>
                        <strong>{teacher.fullName}</strong>
                        <small>{teacher.email || teacher.primaryPhone || t("Contact à compléter")}</small>
                      </div>
                    </div>
                  </td>
                  <td data-label={t("Matricule")} className="teachers-v3-muted-cell">{teacher.matricule}</td>
                  <td data-label={t("Type")} className="teachers-v3-muted-cell">{t(teacherTypeLabel(teacher.teacherType))}</td>
                  <td data-label={t("Charge")}>
                    <div className="teachers-v3-stack-cell">
                      <strong>{teacher.workloadHoursTotal} {tr("h")}</strong>
                      <small>{pluralize(teacher.activeAssignmentsCount, "affectation", "affectations")}</small>
                    </div>
                  </td>
                  <td data-label={t("Cursus")}>
                    <div className="teachers-v3-track-cell">
                      <span>{teacher.francophoneWorkloadHoursTotal} {tr("h FR")}</span>
                      <span>{teacher.arabophoneWorkloadHoursTotal} {tr("h AR")}</span>
                    </div>
                  </td>
                  <td data-label={t("Statut")}>
                    <span className={statusPillClass(teacher.status)}>{t(teacherStatusLabel(teacher.status))}</span>
                  </td>
                  <td data-label={t("Actions")}>
                    <RowActionMenu
                      label={`${t("Actions enseignant")} ${teacher.fullName}`}
                      open={openActionMenuId === teacher.id}
                      onOpenChange={(open) => (open ? toggleActionMenu(teacher.id) : closeActionMenu())}
                      triggerClassName="teachers-v3-more-button"
                      menuClassName="teachers-v3-action-menu"
                    >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              closeActionMenu();
                              onOpenDetail(teacher.id);
                            }}
                          >
                            {t("Voir")}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              closeActionMenu();
                              onEditTeacher(teacher);
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
                              onArchiveTeacher(teacher.id);
                            }}
                          >
                            {t("Archiver")}
                          </button>
                    </RowActionMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveDataTable>
      </section>
    </>
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

  const summary = useMemo(
    () => ({
      activeTeachers: teachers.filter((item) => item.status === "ACTIVE").length,
      activeAssignments: assignments.filter((item) => item.status === "ACTIVE").length,
      totalWorkload: workloads.reduce((sum, item) => sum + item.workloadHoursTotal, 0)
    }),
    [assignments, teachers, workloads]
  );

  return (
    <section className="teachers-v3-kpi-grid" aria-label={t("Synthèse enseignants")}>
      <article className="teachers-v3-kpi-card">
        <span>{t("Actifs")}</span>
        <strong>{loading ? "..." : summary.activeTeachers}</strong>
        <small>{t("Enseignants affectables")}</small>
      </article>
      <article className="teachers-v3-kpi-card">
        <span>{t("Compétences")}</span>
        <strong>{loading ? "..." : skills.length}</strong>
        <small>{t("Matières et périmètres")}</small>
      </article>
      <article className="teachers-v3-kpi-card">
        <span>{t("Affectations")}</span>
        <strong>{loading ? "..." : summary.activeAssignments}</strong>
        <small>{t("Classes et années")}</small>
      </article>
      <article className="teachers-v3-kpi-card">
        <span>{t("Charge hebdo")}</span>
        <strong>{loading ? "..." : summary.totalWorkload}</strong>
        <small>{t("Heures déclarées")}</small>
      </article>
    </section>
  );
}
