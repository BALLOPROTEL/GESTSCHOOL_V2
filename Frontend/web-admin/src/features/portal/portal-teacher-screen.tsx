import type { JSX } from "react";

import {
  ATTENDANCE_STATUS_LABELS,
  AUDIENCE_ROLE_LABELS,
  PORTAL_NOTIFICATION_STATUS_LABELS,
  WEEKDAY_LABELS
} from "../../shared/constants/domain";
import type { AcademicTrack, FieldErrors, Period, Subject } from "../../shared/types/app";
import { usePortalTeacherData } from "./hooks/use-portal-teacher-data";
import type { PortalApiClient, TeacherPortalData } from "./types/portal-teacher";

type PortalTeacherScreenProps = {
  api: PortalApiClient;
  initialData: TeacherPortalData;
  subjects: Subject[];
  periods: Period[];
  locale: string;
  remoteEnabled?: boolean;
  onDataChange?: (data: TeacherPortalData) => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
};

const renderFieldError = (errors: FieldErrors, key: string): JSX.Element | null =>
  errors[key] ? (
    <span className="field-error" role="alert">
      {errors[key]}
    </span>
  ) : null;

const formatLookupLabel = (map: Record<string, string>, value?: string): string => {
  const normalized = (value || "").trim().toUpperCase();
  return map[normalized] || value || "-";
};

const formatAcademicTrackLabel = (value?: AcademicTrack): string =>
  value === "ARABOPHONE" ? "Arabophone" : "Francophone";
const formatAttendanceStatusLabel = (value?: string): string => formatLookupLabel(ATTENDANCE_STATUS_LABELS, value);
const formatPortalNotificationStatusLabel = (value?: string): string =>
  formatLookupLabel(PORTAL_NOTIFICATION_STATUS_LABELS, value);
const formatAudienceRoleLabel = (value?: string): string => formatLookupLabel(AUDIENCE_ROLE_LABELS, value);
const formatWeekdayLabel = (day?: number): string => WEEKDAY_LABELS[day || 0] || String(day || "-");

export function PortalTeacherScreen({
  api,
  initialData,
  subjects,
  periods,
  locale,
  remoteEnabled = true,
  onDataChange,
  onError,
  onNotice
}: PortalTeacherScreenProps): JSX.Element {
  const {
    attendanceForm,
    attendanceStudents,
    data,
    errors,
    filters,
    gradeForm,
    loadData,
    notificationForm,
    resetFilters,
    setAttendanceForm,
    setAttendanceStudents,
    setFilters,
    setGradeForm,
    setNotificationForm,
    submitAttendanceBulk,
    submitGrade,
    submitNotification
  } = usePortalTeacherData({
    api,
    initialData,
    subjects,
    periods,
    remoteEnabled,
    onDataChange,
    onError,
    onNotice
  });

  const teacherClass = filters.classId
    ? data.classes.find((item) => item.classId === filters.classId)
    : data.classes[0];
  const teacherPeriods = teacherClass
    ? periods.filter((item) => item.schoolYearId === teacherClass.schoolYearId)
    : periods;
  const teacherStudentsForClass = filters.classId
    ? data.students.filter((item) => item.classId === filters.classId)
    : data.students;

  return (
    <>
      <section className="panel table-panel workflow-section">
        <div className="table-header">
          <h2>Portail enseignant metier</h2>
          <div className="actions">
            <button type="button" className="button-ghost" onClick={() => void loadData(filters)}>
              Recharger
            </button>
          </div>
        </div>
        <div className="metrics-grid">
          <article className="metric-card">
            <span>Classes</span>
            <strong>{data.overview?.classesCount ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>Eleves suivis</span>
            <strong>{data.overview?.studentsCount ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>Notes saisies</span>
            <strong>{data.overview?.gradesCount ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>Justifs en attente</span>
            <strong>{data.overview?.pendingJustifications ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>Creneaux EDT</span>
            <strong>{data.overview?.timetableSlotsCount ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>Notifications</span>
            <strong>{data.overview?.notificationsCount ?? 0}</strong>
          </article>
        </div>
        <form
          className="filter-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void loadData(filters);
          }}
        >
          <label>
            Classe
            <select
              value={filters.classId}
              onChange={(event) => setFilters((previous) => ({ ...previous, classId: event.target.value }))}
            >
              <option value="">Toutes</option>
              {data.classes.map((item) => (
                <option key={item.assignmentId} value={item.classId}>
                  {item.classLabel} ({formatAcademicTrackLabel(item.track)}) - {item.schoolYearCode}
                </option>
              ))}
            </select>
          </label>
          <label>
            Matiere
            <select
              value={filters.subjectId}
              onChange={(event) => setFilters((previous) => ({ ...previous, subjectId: event.target.value }))}
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
              value={filters.academicPeriodId}
              onChange={(event) => setFilters((previous) => ({ ...previous, academicPeriodId: event.target.value }))}
            >
              <option value="">Toutes</option>
              {teacherPeriods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Eleve
            <select
              value={filters.studentId}
              onChange={(event) => setFilters((previous) => ({ ...previous, studentId: event.target.value }))}
            >
              <option value="">Tous</option>
              {teacherStudentsForClass.map((item) => (
                <option key={item.enrollmentId} value={item.studentId}>
                  {item.matricule} - {item.studentName} ({formatAcademicTrackLabel(item.track)})
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button type="submit">Filtrer</button>
            <button type="button" className="button-ghost" onClick={() => void resetFilters()}>
              Reinitialiser
            </button>
          </div>
        </form>
      </section>

      <section className="panel table-panel workflow-section">
        <div className="table-header">
          <h2>Actions metier</h2>
        </div>
        <div className="split-grid">
          <form data-step-id="teacher-grade" className="form-grid compact-form" onSubmit={(event) => void submitGrade(event)}>
            <h3>Saisir une note</h3>
            <label>
              Classe
              <select value={gradeForm.classId} onChange={(event) => setGradeForm((previous) => ({ ...previous, classId: event.target.value }))}>
                {data.classes.map((item) => (
                  <option key={item.assignmentId} value={item.classId}>
                    {item.classLabel} ({formatAcademicTrackLabel(item.track)})
                  </option>
                ))}
              </select>
              {renderFieldError(errors, "classId")}
            </label>
            <label>
              Eleve
              <select value={gradeForm.studentId} onChange={(event) => setGradeForm((previous) => ({ ...previous, studentId: event.target.value }))}>
                {teacherStudentsForClass.map((item) => (
                  <option key={item.enrollmentId} value={item.studentId}>
                    {item.matricule} - {item.studentName} ({formatAcademicTrackLabel(item.track)})
                  </option>
                ))}
              </select>
              {renderFieldError(errors, "studentId")}
            </label>
            <label>
              Matiere
              <select value={gradeForm.subjectId} onChange={(event) => setGradeForm((previous) => ({ ...previous, subjectId: event.target.value }))}>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
              {renderFieldError(errors, "subjectId")}
            </label>
            <label>
              Periode
              <select
                value={gradeForm.academicPeriodId}
                onChange={(event) => setGradeForm((previous) => ({ ...previous, academicPeriodId: event.target.value }))}
              >
                {teacherPeriods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
              {renderFieldError(errors, "academicPeriodId")}
            </label>
            <label>
              Evaluation
              <input
                value={gradeForm.assessmentLabel}
                onChange={(event) => setGradeForm((previous) => ({ ...previous, assessmentLabel: event.target.value }))}
              />
              {renderFieldError(errors, "assessmentLabel")}
            </label>
            <label>
              Note
              <input
                type="number"
                min={0}
                step="0.01"
                value={gradeForm.score}
                onChange={(event) => setGradeForm((previous) => ({ ...previous, score: event.target.value }))}
              />
              {renderFieldError(errors, "score")}
            </label>
            <label>
              Bareme
              <input
                type="number"
                min={1}
                step="0.01"
                value={gradeForm.scoreMax}
                onChange={(event) => setGradeForm((previous) => ({ ...previous, scoreMax: event.target.value }))}
              />
              {renderFieldError(errors, "scoreMax")}
            </label>
            <button type="submit">Enregistrer note</button>
          </form>

          <form data-step-id="teacher-attendance" className="form-grid compact-form" onSubmit={(event) => void submitAttendanceBulk(event)}>
            <h3>Pointage en masse</h3>
            <label>
              Classe
              <select value={attendanceForm.classId} onChange={(event) => setAttendanceForm((previous) => ({ ...previous, classId: event.target.value }))}>
                {data.classes.map((item) => (
                  <option key={item.assignmentId} value={item.classId}>
                    {item.classLabel} ({formatAcademicTrackLabel(item.track)})
                  </option>
                ))}
              </select>
              {renderFieldError(errors, "classId")}
            </label>
            <label>
              Date
              <input
                type="date"
                value={attendanceForm.attendanceDate}
                onChange={(event) => setAttendanceForm((previous) => ({ ...previous, attendanceDate: event.target.value }))}
              />
              {renderFieldError(errors, "attendanceDate")}
            </label>
            <label>
              Statut
              <select
                value={attendanceForm.defaultStatus}
                onChange={(event) => setAttendanceForm((previous) => ({ ...previous, defaultStatus: event.target.value }))}
              >
                <option value="PRESENT">{formatAttendanceStatusLabel("PRESENT")}</option>
                <option value="ABSENT">{formatAttendanceStatusLabel("ABSENT")}</option>
                <option value="LATE">{formatAttendanceStatusLabel("LATE")}</option>
                <option value="EXCUSED">{formatAttendanceStatusLabel("EXCUSED")}</option>
              </select>
            </label>
            <label>
              Eleves (multi-select)
              <select
                multiple
                value={attendanceStudents}
                onChange={(event) =>
                  setAttendanceStudents(Array.from(event.target.selectedOptions).map((item) => item.value))
                }
              >
                {teacherStudentsForClass.map((item) => (
                  <option key={item.enrollmentId} value={item.studentId}>
                    {item.matricule} - {item.studentName} ({formatAcademicTrackLabel(item.track)})
                  </option>
                ))}
              </select>
              {renderFieldError(errors, "students")}
            </label>
            <button type="submit">Enregistrer pointage</button>
          </form>

          <form data-step-id="teacher-notifications" className="form-grid compact-form" onSubmit={(event) => void submitNotification(event)}>
            <h3>Notifier les parents</h3>
            <label>
              Classe
              <select value={notificationForm.classId} onChange={(event) => setNotificationForm((previous) => ({ ...previous, classId: event.target.value }))}>
                {data.classes.map((item) => (
                  <option key={item.assignmentId} value={item.classId}>
                    {item.classLabel} ({formatAcademicTrackLabel(item.track)})
                  </option>
                ))}
              </select>
              {renderFieldError(errors, "classId")}
            </label>
            <label>
              Eleve cible (optionnel)
              <select
                value={notificationForm.studentId}
                onChange={(event) => setNotificationForm((previous) => ({ ...previous, studentId: event.target.value }))}
              >
                <option value="">Tous les parents de la classe</option>
                {teacherStudentsForClass.map((item) => (
                  <option key={item.enrollmentId} value={item.studentId}>
                    {item.studentName} ({formatAcademicTrackLabel(item.track)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Titre
              <input
                value={notificationForm.title}
                onChange={(event) => setNotificationForm((previous) => ({ ...previous, title: event.target.value }))}
              />
              {renderFieldError(errors, "title")}
            </label>
            <label>
              Message
              <textarea
                rows={3}
                value={notificationForm.message}
                onChange={(event) => setNotificationForm((previous) => ({ ...previous, message: event.target.value }))}
              />
              {renderFieldError(errors, "message")}
            </label>
            <button type="submit">Envoyer notification</button>
          </form>
        </div>
      </section>

      <section className="panel table-panel workflow-section">
        <div className="table-header">
          <h2>Notes recentes</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Eleve</th>
                <th>Cursus</th>
                <th>Matiere</th>
                <th>Periode</th>
                <th>Evaluation</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {data.grades.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">Aucune note.</td>
                </tr>
              ) : (
                data.grades.map((item) => (
                  <tr key={item.id}>
                    <td>{item.studentName || "-"}</td>
                    <td>{formatAcademicTrackLabel(item.track)}</td>
                    <td>{item.subjectLabel || "-"}</td>
                    <td>{periods.find((period) => period.id === item.academicPeriodId)?.label || "-"}</td>
                    <td>{item.assessmentLabel}</td>
                    <td>{item.score}/{item.scoreMax}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="split-grid">
        <section className="panel table-panel workflow-section">
          <div className="table-header">
            <h2>Emploi du temps</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Jour</th>
                  <th>Classe</th>
                  <th>Cursus</th>
                  <th>Matiere</th>
                  <th>Horaire</th>
                  <th>Salle</th>
                </tr>
              </thead>
              <tbody>
                {data.timetable.length === 0 ? (
                  <tr><td colSpan={6} className="empty-row">Aucun creneau.</td></tr>
                ) : (
                  data.timetable.map((item) => (
                    <tr key={item.id}>
                      <td>{formatWeekdayLabel(item.dayOfWeek)}</td>
                      <td>{item.classLabel || "-"}</td>
                      <td>{formatAcademicTrackLabel(item.track)}</td>
                      <td>{item.subjectLabel || "-"}</td>
                      <td>{item.startTime} - {item.endTime}</td>
                      <td>{item.room || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel table-panel workflow-section">
          <div className="table-header">
            <h2>Notifications</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Titre</th>
                  <th>Cible</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {data.notifications.length === 0 ? (
                  <tr><td colSpan={4} className="empty-row">Aucune notification.</td></tr>
                ) : (
                  data.notifications.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.createdAt).toLocaleString(locale)}</td>
                      <td>{item.title}</td>
                      <td>{item.studentName || formatAudienceRoleLabel(item.audienceRole) || "-"}</td>
                      <td>{formatPortalNotificationStatusLabel(item.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
