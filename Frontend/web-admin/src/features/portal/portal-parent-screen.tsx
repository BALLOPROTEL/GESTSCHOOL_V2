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
import { useI18n } from "../../shared/i18n-context";


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
  const { t: tr } = useI18n();
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
          <h2>{tr("Portail parent metier")}</h2>
          <div className="actions">
            <button type="button" className="button-ghost" onClick={() => void loadData(studentFilter)}>
              {tr("Recharger")}</button>
          </div>
        </div>
        <div className="metrics-grid">
          <article className="metric-card">
            <span>{tr("Enfants lies")}</span>
            <strong>{data.overview?.childrenCount ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>{tr("Factures ouvertes")}</span>
            <strong>{data.overview?.openInvoicesCount ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>{tr("Reste a payer")}</span>
            <strong>{formatMoney(data.overview?.remainingAmount ?? 0)}</strong>
          </article>
          <article className="metric-card">
            <span>{tr("Absences/retards")}</span>
            <strong>{data.overview?.absencesCount ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>{tr("Bulletins")}</span>
            <strong>{data.overview?.reportCardsCount ?? 0}</strong>
          </article>
          <article className="metric-card">
            <span>{tr("Notifications")}</span>
            <strong>{data.overview?.notificationsCount ?? 0}</strong>
          </article>
        </div>
        <form className="filter-grid" onSubmit={(event) => void submitFilters(event)}>
          <label>
            {tr("Enfant")}<select value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}>
              <option value="">{tr("Tous")}</option>
              {data.children.map((item) => (
                <option key={item.linkId} value={item.studentId}>
                  {item.matricule} - {item.studentName}
                  {item.primaryTrack ? ` (${tr(formatAcademicTrackLabel(item.primaryTrack))})` : ""}
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
        <div className="table-wrap">
          <table data-responsive-table="true">
            <thead>
              <tr>
                <th>{tr("Eleve")}</th>
                <th>{tr("Classe principale")}</th>
                <th>{tr("Classe secondaire")}</th>
                <th>{tr("Parcours actifs")}</th>
              </tr>
            </thead>
            <tbody>
              {data.children.length === 0 ? (
                <tr><td colSpan={4} className="empty-row">{tr("Aucun parcours parent-eleve.")}</td></tr>
              ) : (
                data.children.map((item) => (
                  <tr key={`child-placement-summary-${item.linkId}`}>
                    <td data-label={tr("Eleve")}>{item.matricule} - {item.studentName}</td>
                    <td data-label={tr("Classe principale")}>
                      {[item.primaryPlacement?.classLabel || item.classLabel, item.primaryPlacement?.track ? tr(formatAcademicTrackLabel(item.primaryPlacement.track)) : item.primaryTrack ? tr(formatAcademicTrackLabel(item.primaryTrack)) : undefined]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </td>
                    <td data-label={tr("Classe secondaire")}>
                      {[item.secondaryPlacement?.classLabel || item.secondaryClassLabel, item.secondaryPlacement?.track ? tr(formatAcademicTrackLabel(item.secondaryPlacement.track)) : undefined]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </td>
                    <td data-label={tr("Parcours actifs")}>
                      {item.placements?.length ? (
                        item.placements
                          .map((placement) => {
                            const placementParts = [
                              tr(formatAcademicTrackLabel(placement.track)),
                              placement.levelCode,
                              placement.classLabel,
                              placement.schoolYearCode
                            ].filter(Boolean);
                            return `${placement.isPrimary ? "Principal" : "Secondaire"}: ${placementParts.join(" / ")}`;
                          })
                          .join(" | ")
                      ) : (
                        tr("Aucun parcours actif")
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
          <div className="table-header"><h2>{tr("Notes")}</h2></div>
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
                  <tr><td colSpan={6} className="empty-row">{tr("Aucune note.")}</td></tr>
                ) : (
                  data.grades.map((item) => (
                    <tr key={item.id}>
                      <td data-label={tr("Eleve")}>{item.studentName || "-"}</td>
                      <td data-label={tr("Cursus")}>{tr(formatAcademicTrackLabel(item.track))}</td>
                      <td data-label={tr("Matiere")}>{item.subjectLabel || "-"}</td>
                      <td data-label={tr("Periode")}>{item.periodLabel || "-"}</td>
                      <td data-label={tr("Evaluation")}>{item.assessmentLabel}</td>
                      <td data-label={tr("Note")}>{item.score}/{item.scoreMax}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel table-panel workflow-section">
          <div className="table-header"><h2>{tr("Bulletins")}</h2></div>
          <div className="table-wrap">
            <table data-responsive-table="true">
              <thead>
                <tr>
                  <th>{tr("Eleve")}</th>
                  <th>{tr("Mode")}</th>
                  <th>{tr("Contexte")}</th>
                  <th>{tr("Periode")}</th>
                  <th>{tr("Moyenne")}</th>
                  <th>{tr("Rang")}</th>
                  <th>{tr("Action")}</th>
                </tr>
              </thead>
              <tbody>
                {data.reportCards.length === 0 ? (
                  <tr><td colSpan={7} className="empty-row">{tr("Aucun bulletin.")}</td></tr>
                ) : (
                  data.reportCards.map((item) => (
                    <tr key={item.id}>
                      <td data-label={tr("Eleve")}>{item.studentName || "-"}</td>
                      <td data-label={tr("Mode")}>{tr(formatReportCardModeLabel(item.mode))}</td>
                      <td data-label={tr("Contexte")}>{formatReportCardContext(item)}</td>
                      <td data-label={tr("Periode")}>{item.periodLabel || "-"}</td>
                      <td data-label={tr("Moyenne")}>{formatReportCardAverage(item)}</td>
                      <td data-label={tr("Rang")}>{item.classRank || "-"}</td>
                      <td data-label={tr("Action")}>
                        {item.pdfDataUrl ? (
                          <button
                            type="button"
                            className="button-ghost"
                            onClick={() => window.open(item.pdfDataUrl, "_blank", "noopener,noreferrer")}
                          >
                            {tr("Consulter le PDF")}</button>
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
          <div className="table-header"><h2>{tr("Absences")}</h2></div>
          <div className="table-wrap">
            <table data-responsive-table="true">
              <thead>
                <tr>
                  <th>{tr("Date")}</th>
                  <th>{tr("Eleve")}</th>
                  <th>{tr("Classe")}</th>
                  <th>{tr("Cursus")}</th>
                  <th>{tr("Statut")}</th>
                  <th>{tr("Validation")}</th>
                </tr>
              </thead>
              <tbody>
                {data.attendance.length === 0 ? (
                  <tr><td colSpan={6} className="empty-row">{tr("Aucune absence.")}</td></tr>
                ) : (
                  data.attendance.map((item) => (
                    <tr key={item.id}>
                      <td data-label={tr("Date")}>{item.attendanceDate}</td>
                      <td data-label={tr("Eleve")}>{item.studentName || "-"}</td>
                      <td data-label={tr("Classe")}>{item.classLabel || "-"}</td>
                      <td data-label={tr("Cursus")}>{tr(formatAcademicTrackLabel(item.track))}</td>
                      <td data-label={tr("Statut")}>{tr(formatAttendanceStatusLabel(item.status))}</td>
                      <td data-label={tr("Validation")}>{tr(formatValidationStatusLabel(item.justificationStatus))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel table-panel workflow-section">
          <div className="table-header"><h2>{tr("Comptabilite famille")}</h2></div>
          <div className="table-wrap">
            <table data-responsive-table="true">
              <thead>
                <tr>
                  <th>{tr("Facture")}</th>
                  <th>{tr("Eleve")}</th>
                  <th>{tr("Classe principale")}</th>
                  <th>{tr("Classe secondaire")}</th>
                  <th>{tr("Du")}</th>
                  <th>{tr("Paye")}</th>
                  <th>{tr("Reste")}</th>
                  <th>{tr("Statut")}</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.length === 0 ? (
                  <tr><td colSpan={8} className="empty-row">{tr("Aucune facture.")}</td></tr>
                ) : (
                  data.invoices.map((item) => (
                    <tr key={item.id}>
                      <td data-label={tr("Facture")}>{item.invoiceNo}</td>
                      <td data-label={tr("Eleve")}>{item.studentName || "-"}</td>
                      <td data-label={tr("Classe principale")}>{[item.primaryClassLabel, item.primaryTrack ? tr(formatAcademicTrackLabel(item.primaryTrack)) : undefined].filter(Boolean).join(" / ") || "-"}</td>
                      <td data-label={tr("Classe secondaire")}>{[item.secondaryClassLabel, item.secondaryTrack ? tr(formatAcademicTrackLabel(item.secondaryTrack)) : undefined].filter(Boolean).join(" / ") || "-"}</td>
                      <td data-label={tr("Du")}>{formatAmount(item.amountDue)}</td>
                      <td data-label={tr("Paye")}>{formatAmount(item.amountPaid)}</td>
                      <td data-label={tr("Reste")}>{formatAmount(item.remainingAmount)}</td>
                      <td data-label={tr("Statut")}>{tr(formatInvoiceStatusLabel(item.status))}</td>
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
          <div className="table-header"><h2>{tr("Paiements")}</h2></div>
          <div className="table-wrap">
            <table data-responsive-table="true">
              <thead>
                <tr>
                  <th>{tr("Date")}</th>
                  <th>{tr("Eleve")}</th>
                  <th>{tr("Facture")}</th>
                  <th>{tr("Recu")}</th>
                  <th>{tr("Montant")}</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.length === 0 ? (
                  <tr><td colSpan={5} className="empty-row">{tr("Aucun paiement.")}</td></tr>
                ) : (
                  data.payments.map((item) => (
                    <tr key={item.id}>
                      <td data-label={tr("Date")}>{new Date(item.paidAt).toLocaleString(locale)}</td>
                      <td data-label={tr("Eleve")}>{item.studentName || "-"}</td>
                      <td data-label={tr("Facture")}>{item.invoiceNo || "-"}</td>
                      <td data-label={tr("Recu")}>{item.receiptNo}</td>
                      <td data-label={tr("Montant")}>{formatAmount(item.paidAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel table-panel workflow-section">
          <div className="table-header"><h2>{tr("Emploi du temps")}</h2></div>
          <div className="table-wrap">
            <table data-responsive-table="true">
              <thead>
                <tr>
                  <th>{tr("Eleve")}</th>
                  <th>{tr("Cursus")}</th>
                  <th>{tr("Jour")}</th>
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
                    <tr key={`${item.slotId}:${item.placementId || item.studentId}`}>
                      <td data-label={tr("Eleve")}>{item.studentName}</td>
                      <td data-label={tr("Cursus")}>{tr(formatAcademicTrackLabel(item.track))}</td>
                      <td data-label={tr("Jour")}>{tr(formatWeekdayLabel(item.dayOfWeek))}</td>
                      <td data-label={tr("Matiere")}>{item.subjectLabel}</td>
                      <td data-label={tr("Horaire")}>{item.startTime} - {item.endTime}</td>
                      <td data-label={tr("Salle")}>{item.room || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel table-panel workflow-section">
        <div className="table-header"><h2>{tr("Notifications recues")}</h2></div>
        <div className="table-wrap">
          <table data-responsive-table="true">
            <thead>
              <tr>
                <th>{tr("Date")}</th>
                <th>{tr("Titre")}</th>
                <th>{tr("Message")}</th>
                <th>{tr("Cible")}</th>
                <th>{tr("Statut")}</th>
              </tr>
            </thead>
            <tbody>
              {data.notifications.length === 0 ? (
                <tr><td colSpan={5} className="empty-row">{tr("Aucune notification.")}</td></tr>
              ) : (
                data.notifications.map((item) => (
                  <tr key={item.id}>
                    <td data-label={tr("Date")}>{new Date(item.createdAt).toLocaleString(locale)}</td>
                    <td data-label={tr("Titre")}>{item.title}</td>
                    <td data-label={tr("Message")}>{item.message}</td>
                    <td data-label={tr("Cible")}>{item.studentName || tr(formatAudienceRoleLabel(item.audienceRole)) || "-"}</td>
                    <td data-label={tr("Statut")}>{tr(formatPortalNotificationStatusLabel(item.status))}</td>
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
