import type { JSX } from "react";

import {
  ATTENDANCE_STATUS_LABELS,
  AUDIENCE_ROLE_LABELS,
  PORTAL_NOTIFICATION_STATUS_LABELS,
  WEEKDAY_LABELS
} from "../../shared/constants/domain";
import type { AcademicTrack, FieldErrors, Period, Subject } from "../../shared/types/app";
import type { UiMessageToken } from "../../shared/i18n";
import { usePortalTeacherData } from "./hooks/use-portal-teacher-data";
import type { PortalApiClient, TeacherPortalData } from "./types/portal-teacher";
import { useI18n } from "../../shared/i18n-context";
import { ResponsiveForm } from "../../shared/components/responsive-form";


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

const renderTranslatedFieldError = (
  errors: FieldErrors,
  key: string,
  translate: (message: string | UiMessageToken) => string
): JSX.Element | null =>
  errors[key] ? (
    <span className="field-error" role="alert">
      {translate(errors[key])}
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
  const { t: tr } = useI18n();
  const renderFieldError = (fieldErrors: FieldErrors, key: string) =>
    renderTranslatedFieldError(fieldErrors, key, tr);
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
          <h2>{tr("Portail enseignant metier")}</h2>
          <div className="actions">
            <button type="button" className="button-ghost" onClick={() => void loadData(filters)}>
              {tr("Recharger")}</button>
          </div>
        </div>
        <div className="metrics-grid">
          <article className="metric-card">
            <span>{tr("Classes")}</span>
            <strong>{data.overview?.classesCount ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>{tr("Eleves suivis")}</span>
            <strong>{data.overview?.studentsCount ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>{tr("Notes saisies")}</span>
            <strong>{data.overview?.gradesCount ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>{tr("Justifs en attente")}</span>
            <strong>{data.overview?.pendingJustifications ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>{tr("Creneaux EDT")}</span>
            <strong>{data.overview?.timetableSlotsCount ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>{tr("Notifications")}</span>
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
            {tr("Classe")}<select
              value={filters.classId}
              onChange={(event) => setFilters((previous) => ({ ...previous, classId: event.target.value }))}
            >
              <option value="">{tr("Toutes")}</option>
              {data.classes.map((item) => (
                <option key={item.assignmentId} value={item.classId}>
                  {item.classLabel} ({tr(formatAcademicTrackLabel(item.track))}) - {item.schoolYearCode}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("Matiere")}<select
              value={filters.subjectId}
              onChange={(event) => setFilters((previous) => ({ ...previous, subjectId: event.target.value }))}
            >
              <option value="">{tr("Toutes")}</option>
              {subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("Periode")}<select
              value={filters.academicPeriodId}
              onChange={(event) => setFilters((previous) => ({ ...previous, academicPeriodId: event.target.value }))}
            >
              <option value="">{tr("Toutes")}</option>
              {teacherPeriods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("Eleve")}<select
              value={filters.studentId}
              onChange={(event) => setFilters((previous) => ({ ...previous, studentId: event.target.value }))}
            >
              <option value="">{tr("Tous")}</option>
              {teacherStudentsForClass.map((item) => (
                <option key={item.enrollmentId} value={item.studentId}>
                  {item.matricule} - {item.studentName} ({tr(formatAcademicTrackLabel(item.track))})
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button type="submit">{tr("Filtrer")}</button>
            <button type="button" className="button-ghost" onClick={() => void resetFilters()}>
              {tr("Reinitialiser")}</button>
          </div>
        </form>
      </section>

      <section className="panel table-panel workflow-section">
        <div className="table-header">
          <h2>{tr("Actions metier")}</h2>
        </div>
        <div className="split-grid">
          <ResponsiveForm data-step-id="teacher-grade" className="form-grid compact-form" formTitle={tr("Enregistrer note")} onSubmit={(event) => void submitGrade(event)}>
            <h3>{tr("Saisir une note")}</h3>
            <label>
              {tr("Classe")}<select value={gradeForm.classId} onChange={(event) => setGradeForm((previous) => ({ ...previous, classId: event.target.value }))}>
                {data.classes.map((item) => (
                  <option key={item.assignmentId} value={item.classId}>
                    {item.classLabel} ({tr(formatAcademicTrackLabel(item.track))})
                  </option>
                ))}
              </select>
              {renderFieldError(errors, "classId")}
            </label>
            <label>
              {tr("Eleve")}<select value={gradeForm.studentId} onChange={(event) => setGradeForm((previous) => ({ ...previous, studentId: event.target.value }))}>
                {teacherStudentsForClass.map((item) => (
                  <option key={item.enrollmentId} value={item.studentId}>
                    {item.matricule} - {item.studentName} ({tr(formatAcademicTrackLabel(item.track))})
                  </option>
                ))}
              </select>
              {renderFieldError(errors, "studentId")}
            </label>
            <label>
              {tr("Matiere")}<select value={gradeForm.subjectId} onChange={(event) => setGradeForm((previous) => ({ ...previous, subjectId: event.target.value }))}>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
              {renderFieldError(errors, "subjectId")}
            </label>
            <label>
              {tr("Periode")}<select
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
              {tr("Evaluation")}<input
                value={gradeForm.assessmentLabel}
                onChange={(event) => setGradeForm((previous) => ({ ...previous, assessmentLabel: event.target.value }))}
              />
              {renderFieldError(errors, "assessmentLabel")}
            </label>
            <label>
              {tr("Note")}<input
                type="number"
                min={0}
                step="0.01"
                value={gradeForm.score}
                onChange={(event) => setGradeForm((previous) => ({ ...previous, score: event.target.value }))}
              />
              {renderFieldError(errors, "score")}
            </label>
            <label>
              {tr("Bareme")}<input
                type="number"
                min={1}
                step="0.01"
                value={gradeForm.scoreMax}
                onChange={(event) => setGradeForm((previous) => ({ ...previous, scoreMax: event.target.value }))}
              />
              {renderFieldError(errors, "scoreMax")}
            </label>
            <button type="submit">{tr("Enregistrer note")}</button>
          </ResponsiveForm>

          <ResponsiveForm data-step-id="teacher-attendance" className="form-grid compact-form" formTitle={tr("Enregistrer pointage")} onSubmit={(event) => void submitAttendanceBulk(event)}>
            <h3>{tr("Pointage en masse")}</h3>
            <label>
              {tr("Classe")}<select value={attendanceForm.classId} onChange={(event) => setAttendanceForm((previous) => ({ ...previous, classId: event.target.value }))}>
                {data.classes.map((item) => (
                  <option key={item.assignmentId} value={item.classId}>
                    {item.classLabel} ({tr(formatAcademicTrackLabel(item.track))})
                  </option>
                ))}
              </select>
              {renderFieldError(errors, "classId")}
            </label>
            <label>
              {tr("Date")}<input
                type="date"
                value={attendanceForm.attendanceDate}
                onChange={(event) => setAttendanceForm((previous) => ({ ...previous, attendanceDate: event.target.value }))}
              />
              {renderFieldError(errors, "attendanceDate")}
            </label>
            <label>
              {tr("Statut")}<select
                value={attendanceForm.defaultStatus}
                onChange={(event) => setAttendanceForm((previous) => ({ ...previous, defaultStatus: event.target.value }))}
              >
                <option value="PRESENT">{tr(formatAttendanceStatusLabel("PRESENT"))}</option>
                <option value="ABSENT">{tr(formatAttendanceStatusLabel("ABSENT"))}</option>
                <option value="LATE">{tr(formatAttendanceStatusLabel("LATE"))}</option>
                <option value="EXCUSED">{tr(formatAttendanceStatusLabel("EXCUSED"))}</option>
              </select>
            </label>
            <label>
              {tr("Eleves (multi-select)")}<select
                multiple
                value={attendanceStudents}
                onChange={(event) =>
                  setAttendanceStudents(Array.from(event.target.selectedOptions).map((item) => item.value))
                }
              >
                {teacherStudentsForClass.map((item) => (
                  <option key={item.enrollmentId} value={item.studentId}>
                    {item.matricule} - {item.studentName} ({tr(formatAcademicTrackLabel(item.track))})
                  </option>
                ))}
              </select>
              {renderFieldError(errors, "students")}
            </label>
            <button type="submit">{tr("Enregistrer pointage")}</button>
          </ResponsiveForm>

          <ResponsiveForm data-step-id="teacher-notifications" className="form-grid compact-form" formTitle={tr("Programmer une notification")} onSubmit={(event) => void submitNotification(event)}>
            <h3>{tr("Notifier les parents")}</h3>
            <label>
              {tr("Classe")}<select value={notificationForm.classId} onChange={(event) => setNotificationForm((previous) => ({ ...previous, classId: event.target.value }))}>
                {data.classes.map((item) => (
                  <option key={item.assignmentId} value={item.classId}>
                    {item.classLabel} ({tr(formatAcademicTrackLabel(item.track))})
                  </option>
                ))}
              </select>
              {renderFieldError(errors, "classId")}
            </label>
            <label>
              {tr("Eleve cible (optionnel)")}<select
                value={notificationForm.studentId}
                onChange={(event) => setNotificationForm((previous) => ({ ...previous, studentId: event.target.value }))}
              >
                <option value="">{tr("Tous les parents de la classe")}</option>
                {teacherStudentsForClass.map((item) => (
                  <option key={item.enrollmentId} value={item.studentId}>
                    {item.studentName} ({tr(formatAcademicTrackLabel(item.track))})
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr("Titre")}<input
                value={notificationForm.title}
                onChange={(event) => setNotificationForm((previous) => ({ ...previous, title: event.target.value }))}
              />
              {renderFieldError(errors, "title")}
            </label>
            <label>
              {tr("Message")}<textarea
                rows={3}
                value={notificationForm.message}
                onChange={(event) => setNotificationForm((previous) => ({ ...previous, message: event.target.value }))}
              />
              {renderFieldError(errors, "message")}
            </label>
            <button type="submit">{tr("Envoyer notification")}</button>
          </ResponsiveForm>
        </div>
      </section>

      <section className="panel table-panel workflow-section">
        <div className="table-header">
          <h2>{tr("Notes recentes")}</h2>
        </div>
        <div className="table-wrap">
          <table data-responsive-table="true">
            <thead>
              <tr>
                <th>{tr("Eleve")}</th>
                <th>{tr("Cursus")}</th>
                <th>{tr("Matiere")}</th>
                <th>{tr("Periode")}</th>
                <th>{tr("Evaluation")}</th>
                <th>{tr("Note")}</th>
              </tr>
            </thead>
            <tbody>
              {data.grades.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">{tr("Aucune note.")}</td>
                </tr>
              ) : (
                data.grades.map((item) => (
                  <tr key={item.id}>
                    <td data-label={tr("Eleve")}>{item.studentName || "-"}</td>
                    <td data-label={tr("Cursus")}>{tr(formatAcademicTrackLabel(item.track))}</td>
                    <td data-label={tr("Matiere")}>{item.subjectLabel || "-"}</td>
                    <td data-label={tr("Periode")}>{periods.find((period) => period.id === item.academicPeriodId)?.label || "-"}</td>
                    <td data-label={tr("Evaluation")}>{item.assessmentLabel}</td>
                    <td data-label={tr("Note")}>{item.score}/{item.scoreMax}</td>
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
            <h2>{tr("Emploi du temps")}</h2>
          </div>
          <div className="table-wrap">
            <table data-responsive-table="true">
              <thead>
                <tr>
                  <th>{tr("Jour")}</th>
                  <th>{tr("Classe")}</th>
                  <th>{tr("Cursus")}</th>
                  <th>{tr("Matiere")}</th>
                  <th>{tr("Horaire")}</th>
                  <th>{tr("Salle")}</th>
                </tr>
              </thead>
              <tbody>
                {data.timetable.length === 0 ? (
                  <tr><td colSpan={6} className="empty-row">{tr("Aucun creneau.")}</td></tr>
                ) : (
                  data.timetable.map((item) => (
                    <tr key={item.id}>
                      <td data-label={tr("Jour")}>{tr(formatWeekdayLabel(item.dayOfWeek))}</td>
                      <td data-label={tr("Classe")}>{item.classLabel || "-"}</td>
                      <td data-label={tr("Cursus")}>{tr(formatAcademicTrackLabel(item.track))}</td>
                      <td data-label={tr("Matiere")}>{item.subjectLabel || "-"}</td>
                      <td data-label={tr("Horaire")}>{item.startTime} - {item.endTime}</td>
                      <td data-label={tr("Salle")}>{item.room || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel table-panel workflow-section">
          <div className="table-header">
            <h2>{tr("Notifications")}</h2>
          </div>
          <div className="table-wrap">
            <table data-responsive-table="true">
              <thead>
                <tr>
                  <th>{tr("Date")}</th>
                  <th>{tr("Titre")}</th>
                  <th>{tr("Cible")}</th>
                  <th>{tr("Statut")}</th>
                </tr>
              </thead>
              <tbody>
                {data.notifications.length === 0 ? (
                  <tr><td colSpan={4} className="empty-row">{tr("Aucune notification.")}</td></tr>
                ) : (
                  data.notifications.map((item) => (
                    <tr key={item.id}>
                      <td data-label={tr("Date")}>{new Date(item.createdAt).toLocaleString(locale)}</td>
                      <td data-label={tr("Titre")}>{item.title}</td>
                      <td data-label={tr("Cible")}>{item.studentName || tr(formatAudienceRoleLabel(item.audienceRole)) || "-"}</td>
                      <td data-label={tr("Statut")}>{tr(formatPortalNotificationStatusLabel(item.status))}</td>
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
