import type { JSX } from "react";

import {
  ATTENDANCE_STATUS_LABELS,
  AUDIENCE_ROLE_LABELS,
  INVOICE_STATUS_LABELS,
  PORTAL_NOTIFICATION_STATUS_LABELS,
  VALIDATION_STATUS_LABELS,
  WEEKDAY_LABELS
} from "../../shared/constants/domain";
import type { AcademicTrack, ReportCard, ReportCardMode } from "../../shared/types/app";
import { usePortalParentData } from "./hooks/use-portal-parent-data";
import type { ParentPortalData, PortalApiClient } from "./types/portal-parent";

type PortalParentScreenProps = {
  api: PortalApiClient;
  initialData: ParentPortalData;
  locale: string;
  defaultCurrency: string;
  remoteEnabled?: boolean;
  onDataChange?: (data: ParentPortalData) => void;
  onError: (message: string | null) => void;
};

const formatLookupLabel = (map: Record<string, string>, value?: string): string => {
  const normalized = (value || "").trim().toUpperCase();
  return map[normalized] || value || "-";
};

const formatAcademicTrackLabel = (value?: AcademicTrack): string =>
  value === "ARABOPHONE" ? "Arabophone" : "Francophone";
const formatAttendanceStatusLabel = (value?: string): string => formatLookupLabel(ATTENDANCE_STATUS_LABELS, value);
const formatValidationStatusLabel = (value?: string): string => formatLookupLabel(VALIDATION_STATUS_LABELS, value);
const formatInvoiceStatusLabel = (value?: string): string => formatLookupLabel(INVOICE_STATUS_LABELS, value);
const formatPortalNotificationStatusLabel = (value?: string): string =>
  formatLookupLabel(PORTAL_NOTIFICATION_STATUS_LABELS, value);
const formatAudienceRoleLabel = (value?: string): string => formatLookupLabel(AUDIENCE_ROLE_LABELS, value);
const formatWeekdayLabel = (day?: number): string => WEEKDAY_LABELS[day || 0] || String(day || "-");
const formatReportCardModeLabel = (value?: ReportCardMode): string =>
  value === "PRIMARY_COMBINED" ? "Bulletin primaire combine" : "Bulletin par cursus";

const formatReportCardAverage = (item: ReportCard): string => {
  if (item.mode === "PRIMARY_COMBINED" && item.sections && item.sections.length > 0) {
    return item.sections
      .map((section) => `${formatAcademicTrackLabel(section.track)} ${section.averageGeneral.toFixed(2)}`)
      .join(" | ");
  }
  return item.averageGeneral.toFixed(2);
};

const formatReportCardContext = (item: ReportCard): string => {
  if (item.mode === "PRIMARY_COMBINED" && item.sections && item.sections.length > 0) {
    return item.sections
      .map((section) =>
        [formatAcademicTrackLabel(section.track), section.classLabel || section.levelLabel]
          .filter(Boolean)
          .join(" / ")
      )
      .join(" | ");
  }
  return item.classLabel || "-";
};

export function PortalParentScreen({
  api,
  initialData,
  locale,
  defaultCurrency,
  remoteEnabled = true,
  onDataChange,
  onError
}: PortalParentScreenProps): JSX.Element {
  const {
    data,
    loadData,
    resetFilters,
    setStudentFilter,
    studentFilter,
    submitFilters
  } = usePortalParentData({
    api,
    initialData,
    remoteEnabled,
    onDataChange,
    onError
  });

  const formatAmount = (value: number): string =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  const formatCurrencyLabel = (currency?: string): string => {
    const normalized = (currency || defaultCurrency).trim().toUpperCase();
    return normalized === "XOF" || normalized === "CFA" ? "F CFA" : normalized;
  };
  const formatMoney = (value: number, currency?: string): string =>
    `${formatAmount(value)} ${formatCurrencyLabel(currency)}`;

  return (
    <>
      <section className="panel table-panel workflow-section">
        <div className="table-header">
          <h2>Portail parent metier</h2>
          <div className="actions">
            <button type="button" className="button-ghost" onClick={() => void loadData(studentFilter)}>
              Recharger
            </button>
          </div>
        </div>
        <div className="metrics-grid">
          <article className="metric-card">
            <span>Enfants lies</span>
            <strong>{data.overview?.childrenCount ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>Factures ouvertes</span>
            <strong>{data.overview?.openInvoicesCount ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>Reste a payer</span>
            <strong>{formatMoney(data.overview?.remainingAmount ?? 0)}</strong>
          </article>
          <article className="metric-card">
            <span>Absences/retards</span>
            <strong>{data.overview?.absencesCount ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>Bulletins</span>
            <strong>{data.overview?.reportCardsCount ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>Notifications</span>
            <strong>{data.overview?.notificationsCount ?? 0}</strong>
          </article>
        </div>
        <form className="filter-grid" onSubmit={(event) => void submitFilters(event)}>
          <label>
            Enfant
            <select value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}>
              <option value="">Tous</option>
              {data.children.map((item) => (
                <option key={item.linkId} value={item.studentId}>
                  {item.matricule} - {item.studentName}
                  {item.primaryTrack ? ` (${formatAcademicTrackLabel(item.primaryTrack)})` : ""}
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Eleve</th>
                <th>Classe principale</th>
                <th>Classe secondaire</th>
                <th>Parcours actifs</th>
              </tr>
            </thead>
            <tbody>
              {data.children.length === 0 ? (
                <tr><td colSpan={4} className="empty-row">Aucun parcours parent-eleve.</td></tr>
              ) : (
                data.children.map((item) => (
                  <tr key={`child-placement-summary-${item.linkId}`}>
                    <td>{item.matricule} - {item.studentName}</td>
                    <td>
                      {[item.primaryPlacement?.classLabel || item.classLabel, item.primaryPlacement?.track ? formatAcademicTrackLabel(item.primaryPlacement.track) : item.primaryTrack ? formatAcademicTrackLabel(item.primaryTrack) : undefined]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </td>
                    <td>
                      {[item.secondaryPlacement?.classLabel || item.secondaryClassLabel, item.secondaryPlacement?.track ? formatAcademicTrackLabel(item.secondaryPlacement.track) : undefined]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </td>
                    <td>
                      {item.placements?.length ? (
                        item.placements
                          .map((placement) => {
                            const placementParts = [
                              formatAcademicTrackLabel(placement.track),
                              placement.levelCode,
                              placement.classLabel,
                              placement.schoolYearCode
                            ].filter(Boolean);
                            return `${placement.isPrimary ? "Principal" : "Secondaire"}: ${placementParts.join(" / ")}`;
                          })
                          .join(" | ")
                      ) : (
                        "Aucun parcours actif"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="split-grid">
        <section className="panel table-panel workflow-section">
          <div className="table-header"><h2>Notes</h2></div>
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
                  <tr><td colSpan={6} className="empty-row">Aucune note.</td></tr>
                ) : (
                  data.grades.map((item) => (
                    <tr key={item.id}>
                      <td>{item.studentName || "-"}</td>
                      <td>{formatAcademicTrackLabel(item.track)}</td>
                      <td>{item.subjectLabel || "-"}</td>
                      <td>{item.periodLabel || "-"}</td>
                      <td>{item.assessmentLabel}</td>
                      <td>{item.score}/{item.scoreMax}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel table-panel workflow-section">
          <div className="table-header"><h2>Bulletins</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Eleve</th>
                  <th>Mode</th>
                  <th>Contexte</th>
                  <th>Periode</th>
                  <th>Moyenne</th>
                  <th>Rang</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.reportCards.length === 0 ? (
                  <tr><td colSpan={7} className="empty-row">Aucun bulletin.</td></tr>
                ) : (
                  data.reportCards.map((item) => (
                    <tr key={item.id}>
                      <td>{item.studentName || "-"}</td>
                      <td>{formatReportCardModeLabel(item.mode)}</td>
                      <td>{formatReportCardContext(item)}</td>
                      <td>{item.periodLabel || "-"}</td>
                      <td>{formatReportCardAverage(item)}</td>
                      <td>{item.classRank || "-"}</td>
                      <td>
                        {item.pdfDataUrl ? (
                          <button
                            type="button"
                            className="button-ghost"
                            onClick={() => window.open(item.pdfDataUrl, "_blank", "noopener,noreferrer")}
                          >
                            Consulter le PDF
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="split-grid">
        <section className="panel table-panel workflow-section">
          <div className="table-header"><h2>Absences</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Eleve</th>
                  <th>Classe</th>
                  <th>Cursus</th>
                  <th>Statut</th>
                  <th>Validation</th>
                </tr>
              </thead>
              <tbody>
                {data.attendance.length === 0 ? (
                  <tr><td colSpan={6} className="empty-row">Aucune absence.</td></tr>
                ) : (
                  data.attendance.map((item) => (
                    <tr key={item.id}>
                      <td>{item.attendanceDate}</td>
                      <td>{item.studentName || "-"}</td>
                      <td>{item.classLabel || "-"}</td>
                      <td>{formatAcademicTrackLabel(item.track)}</td>
                      <td>{formatAttendanceStatusLabel(item.status)}</td>
                      <td>{formatValidationStatusLabel(item.justificationStatus)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel table-panel workflow-section">
          <div className="table-header"><h2>Comptabilite famille</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Facture</th>
                  <th>Eleve</th>
                  <th>Classe principale</th>
                  <th>Classe secondaire</th>
                  <th>Du</th>
                  <th>Paye</th>
                  <th>Reste</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.length === 0 ? (
                  <tr><td colSpan={8} className="empty-row">Aucune facture.</td></tr>
                ) : (
                  data.invoices.map((item) => (
                    <tr key={item.id}>
                      <td>{item.invoiceNo}</td>
                      <td>{item.studentName || "-"}</td>
                      <td>{[item.primaryClassLabel, item.primaryTrack ? formatAcademicTrackLabel(item.primaryTrack) : undefined].filter(Boolean).join(" / ") || "-"}</td>
                      <td>{[item.secondaryClassLabel, item.secondaryTrack ? formatAcademicTrackLabel(item.secondaryTrack) : undefined].filter(Boolean).join(" / ") || "-"}</td>
                      <td>{formatAmount(item.amountDue)}</td>
                      <td>{formatAmount(item.amountPaid)}</td>
                      <td>{formatAmount(item.remainingAmount)}</td>
                      <td>{formatInvoiceStatusLabel(item.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="split-grid">
        <section className="panel table-panel workflow-section">
          <div className="table-header"><h2>Paiements</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Eleve</th>
                  <th>Facture</th>
                  <th>Recu</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.length === 0 ? (
                  <tr><td colSpan={5} className="empty-row">Aucun paiement.</td></tr>
                ) : (
                  data.payments.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.paidAt).toLocaleString(locale)}</td>
                      <td>{item.studentName || "-"}</td>
                      <td>{item.invoiceNo || "-"}</td>
                      <td>{item.receiptNo}</td>
                      <td>{formatAmount(item.paidAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel table-panel workflow-section">
          <div className="table-header"><h2>Emploi du temps</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Eleve</th>
                  <th>Cursus</th>
                  <th>Jour</th>
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
                    <tr key={`${item.slotId}:${item.placementId || item.studentId}`}>
                      <td>{item.studentName}</td>
                      <td>{formatAcademicTrackLabel(item.track)}</td>
                      <td>{formatWeekdayLabel(item.dayOfWeek)}</td>
                      <td>{item.subjectLabel}</td>
                      <td>{item.startTime} - {item.endTime}</td>
                      <td>{item.room || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel table-panel workflow-section">
        <div className="table-header"><h2>Notifications recues</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Titre</th>
                <th>Message</th>
                <th>Cible</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.notifications.length === 0 ? (
                <tr><td colSpan={5} className="empty-row">Aucune notification.</td></tr>
              ) : (
                data.notifications.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString(locale)}</td>
                    <td>{item.title}</td>
                    <td>{item.message}</td>
                    <td>{item.studentName || formatAudienceRoleLabel(item.audienceRole) || "-"}</td>
                    <td>{formatPortalNotificationStatusLabel(item.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
