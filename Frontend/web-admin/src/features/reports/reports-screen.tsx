import type { JSX } from "react";

import { WorkflowGuide } from "../../shared/components/workflow-guide";
import type {
  AnalyticsTrendPoint,
  SchoolYear,
  UserAccount
} from "../../shared/types/app";
import { useReportsData } from "./hooks/use-reports-data";
import type { ReportsApiClient } from "./types/reports";
import { useI18n } from "../../shared/i18n-context";
import { ResponsiveDataTable } from "../../shared/components/responsive-data-table";
import { ResponsivePagination } from "../../shared/components/responsive-pagination";
import { ResponsiveFilterPanel } from "../../shared/components/responsive-filter-panel";
import {
  ResponsiveChartCard,
  ResponsiveKpiCard,
  ResponsiveKpiGrid
} from "../../shared/components/responsive-dashboard";


type ReportsScreenProps = {
  api: ReportsApiClient;
  schoolYears: SchoolYear[];
  users: UserAccount[];
  locale: string;
  remoteEnabled?: boolean;
  formatMoney: (value: number, currency?: string) => string;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
};

export function ReportsScreen({
  api,
  schoolYears,
  users,
  locale,
  remoteEnabled,
  formatMoney,
  onError,
  onNotice
}: ReportsScreenProps): JSX.Element {
  const { t: tr } = useI18n();
  const {
    analyticsFilters,
    analyticsOverview,
    auditExportFormat,
    auditFilters,
    auditLogs,
    exportCurrentAuditLogs,
    loadAnalytics,
    loadAuditLogs,
    reportSteps,
    reportWorkflowStep,
    resetAnalyticsFilters,
    resetAuditFilters,
    setAnalyticsFilters,
    setAuditExportFormat,
    setAuditFilters,
    setReportWorkflowStep
  } = useReportsData({ api, remoteEnabled, onError, onNotice });

  const renderTrend = (
    title: string,
    points: AnalyticsTrendPoint[],
    unit: "amount" | "count"
  ): JSX.Element => {
    const max = Math.max(...points.map((point) => point.value), 0);
    return (
      <ResponsiveChartCard
        className="panel trend-panel"
        title={title}
        chartLabel={title}
        summary={points.map((point) => ({
          label: point.label,
          value: unit === "amount" ? formatMoney(point.value) : point.value.toLocaleString(locale)
        }))}
      >
        <div className="trend-list">
          {points.length === 0 ? (
            <p className="subtle">{tr("Aucune donnee.")}</p>
          ) : (
            points.map((point) => (
              <div key={`${title}-${point.bucket}`} className="trend-row">
                <span>{point.label}</span>
                <div className="trend-track">
                  <span
                    style={{
                      width: `${max > 0 ? Math.max(8, Math.round((point.value / max) * 100)) : 0}%`
                    }}
                  />
                </div>
                <strong>
                  {unit === "amount"
                    ? formatMoney(point.value)
                    : point.value.toLocaleString(locale)}
                </strong>
              </div>
            ))
          )}
        </div>
      </ResponsiveChartCard>
    );
  };

  return (
    <WorkflowGuide
      className="module-v3-workflow"
      title={tr("Rapports avances et conformite")}
      steps={reportSteps}
      activeStepId={reportWorkflowStep}
      onStepChange={setReportWorkflowStep}
    >
      <section className="panel table-panel" data-step-id="overview">
        <div className="table-header">
          <h2>{tr("Filtrer la fenetre de pilotage")}</h2>
          <span className="subtle">
            {tr("Derniere generation:")}{" "}
            {analyticsOverview?.generatedAt
              ? new Date(analyticsOverview.generatedAt).toLocaleString(locale)
              : "-"}
          </span>
        </div>
        <ResponsiveFilterPanel title={tr("Filtrer la fenetre de pilotage")} activeCount={Object.values(analyticsFilters).filter(Boolean).length}>
          <form
            className="filter-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void loadAnalytics(analyticsFilters);
            }}
          >
          <label>
            {tr("Du")}<input
              type="date"
              value={analyticsFilters.from}
              onChange={(event) =>
                setAnalyticsFilters((prev) => ({ ...prev, from: event.target.value }))
              }
            />
          </label>
          <label>
            {tr("Au")}<input
              type="date"
              value={analyticsFilters.to}
              onChange={(event) =>
                setAnalyticsFilters((prev) => ({ ...prev, to: event.target.value }))
              }
            />
          </label>
          <label>
            {tr("Annee scolaire")}<select
              value={analyticsFilters.schoolYearId}
              onChange={(event) =>
                setAnalyticsFilters((prev) => ({
                  ...prev,
                  schoolYearId: event.target.value
                }))
              }
            >
              <option value="">{tr("Toutes")}</option>
              {schoolYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.code}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button type="submit">{tr("Actualiser KPI")}</button>
            <button
              type="button"
              className="button-ghost"
              onClick={resetAnalyticsFilters}
            >
              {tr("Reinitialiser")}</button>
          </div>
          </form>
        </ResponsiveFilterPanel>
        <ResponsiveKpiGrid className="reports-grid" label={tr("Indicateurs executifs")}>
          <ResponsiveKpiCard className="metric-card" label={tr("Eleves actifs")} value={analyticsOverview?.students.active ?? 0} hint={<>+{analyticsOverview?.students.createdInWindow ?? 0} {tr("sur la periode")}</>} />
          <ResponsiveKpiCard className="metric-card" label={tr("Inscriptions actives")} value={analyticsOverview?.academics.activeEnrollments ?? 0} hint={<>{analyticsOverview?.academics.classes ?? 0} {tr("classes surveillees")}</>} />
          <ResponsiveKpiCard className="metric-card" label={tr("Recouvrement")} value={`${(analyticsOverview?.finance.recoveryRatePercent ?? 0).toFixed(1)}%`} hint={<>{tr("Reste ")}{formatMoney(analyticsOverview?.finance.remainingAmount ?? 0)}</>} />
          <ResponsiveKpiCard className="metric-card" label={tr("Absences")} value={analyticsOverview?.schoolLife.absences ?? 0} hint={<>{analyticsOverview?.schoolLife.justificationRatePercent?.toFixed(1) ?? "0.0"}{tr("% justifiees")}</>} tone={(analyticsOverview?.schoolLife.absences ?? 0) > 0 ? "warning" : "neutral"} />
          <ResponsiveKpiCard className="metric-card" label={tr("Dons mosquee")} value={formatMoney(analyticsOverview?.mosquee.donationsInWindow ?? 0)} hint={<>{analyticsOverview?.mosquee.donationsCountInWindow ?? 0} {tr("transactions")}</>} priority="secondary" />
          <ResponsiveKpiCard className="metric-card" label={tr("Alertes notifications")} value={analyticsOverview?.schoolLife.notificationsFailed ?? 0} hint={<>{analyticsOverview?.schoolLife.notificationsQueued ?? 0} {tr("en attente")}</>} priority="secondary" tone={(analyticsOverview?.schoolLife.notificationsFailed ?? 0) > 0 ? "negative" : "neutral"} />
        </ResponsiveKpiGrid>
        <div className="split-grid">
          {renderTrend(tr("Paiements mensuels"), analyticsOverview?.trends.payments || [], "amount")}
          {renderTrend(tr("Dons mensuels"), analyticsOverview?.trends.donations || [], "amount")}
          {renderTrend(tr("Absences mensuelles"), analyticsOverview?.trends.absences || [], "count")}
        </div>
      </section>

      <section className="panel table-panel" data-step-id="compliance">
        <div className="table-header">
          <h2>{tr("Journal de conformite")}</h2>
          <span className="subtle">
            {auditLogs ? `${auditLogs.total} evenement(s)` : tr("Aucun chargement")}
          </span>
        </div>
        <ResponsiveFilterPanel title={tr("Filtres du journal d'audit")} activeCount={Object.values(auditFilters).filter((value) => value !== "" && value !== 1 && value !== 20).length}>
          <form
            className="filter-grid"
            onSubmit={(event) => {
              event.preventDefault();
              const next = { ...auditFilters, page: 1 };
              setAuditFilters(next);
              void loadAuditLogs(next);
            }}
          >
          <label>
            {tr("Ressource")}<input
              value={auditFilters.resource}
              onChange={(event) =>
                setAuditFilters((prev) => ({ ...prev, resource: event.target.value }))
              }
              placeholder={tr("users, finance, auth...")}
            />
          </label>
          <label>
            {tr("Action")}<input
              value={auditFilters.action}
              onChange={(event) =>
                setAuditFilters((prev) => ({ ...prev, action: event.target.value }))
              }
              placeholder={tr("USER_CREATED...")}
            />
          </label>
          <label>
            {tr("Utilisateur")}<select
              value={auditFilters.userId}
              onChange={(event) =>
                setAuditFilters((prev) => ({ ...prev, userId: event.target.value }))
              }
            >
              <option value="">{tr("Tous")}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("Recherche")}<input
              value={auditFilters.q}
              onChange={(event) =>
                setAuditFilters((prev) => ({ ...prev, q: event.target.value }))
              }
              placeholder={tr("ID ressource, identifiant utilisateur...")}
            />
          </label>
          <label>
            {tr("Du")}<input
              type="date"
              value={auditFilters.from}
              onChange={(event) =>
                setAuditFilters((prev) => ({ ...prev, from: event.target.value }))
              }
            />
          </label>
          <label>
            {tr("Au")}<input
              type="date"
              value={auditFilters.to}
              onChange={(event) =>
                setAuditFilters((prev) => ({ ...prev, to: event.target.value }))
              }
            />
          </label>
          <label>
            {tr("Taille page")}<select
              value={auditFilters.pageSize}
              onChange={(event) =>
                setAuditFilters((prev) => ({
                  ...prev,
                  pageSize: Number(event.target.value) || 20,
                  page: 1
                }))
              }
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <div className="actions">
            <button type="submit">{tr("Filtrer audit")}</button>
            <button
              type="button"
              className="button-ghost"
              onClick={resetAuditFilters}
            >
              {tr("Reinitialiser")}</button>
          </div>
          </form>
        </ResponsiveFilterPanel>
        <ResponsiveDataTable label={tr("Journal d'audit")}>
          <table data-responsive-table="true">
            <thead>
              <tr>
                <th>{tr("Date")}</th>
                <th>{tr("Utilisateur")}</th>
                <th>{tr("Action")}</th>
                <th>{tr("Ressource")}</th>
                <th>{tr("ID Ressource")}</th>
                <th>{tr("Payload")}</th>
              </tr>
            </thead>
            <tbody>
              {!auditLogs || auditLogs.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">
                    {tr("Aucun log d'audit.")}</td>
                </tr>
              ) : (
                auditLogs.items.map((item) => (
                  <tr key={item.id}>
                    <td data-label={tr("Date")}>{new Date(item.createdAt).toLocaleString(locale)}</td>
                    <td data-label={tr("Utilisateur")}>{item.username || "-"}</td>
                    <td data-label={tr("Action")}>{item.action}</td>
                    <td data-label={tr("Ressource")}>{item.resource}</td>
                    <td data-label={tr("ID Ressource")}>{item.resourceId || "-"}</td>
                    <td data-label={tr("Payload")}>{item.payloadPreview || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ResponsiveDataTable>
        <ResponsivePagination
          currentPage={auditLogs?.page || 1}
          totalPages={auditLogs?.totalPages || 1}
          onPrevious={() => {
            if (!auditLogs) return;
            const next = { ...auditFilters, page: Math.max(1, auditLogs.page - 1) };
            setAuditFilters(next);
            void loadAuditLogs(next);
          }}
          onNext={() => {
            if (!auditLogs) return;
            const next = { ...auditFilters, page: Math.min(auditLogs.totalPages, auditLogs.page + 1) };
            setAuditFilters(next);
            void loadAuditLogs(next);
          }}
        />
      </section>

      <section className="panel table-panel" data-step-id="export">
        <div className="table-header">
          <h2>{tr("Livrables d'export")}</h2>
          <span className="subtle">{tr("Exporter des preuves exploitables pour audit et pilotage.")}</span>
        </div>
        <div className="split-grid">
          <article className="panel soft-card">
            <h3>{tr("Pack audit")}</h3>
            <p className="subtle">
              {tr("Exporte les actions sensibles (auth, permissions, creation/suppression).")}</p>
            <label>
              {tr("Format")}<select
                value={auditExportFormat}
                onChange={(event) =>
                  setAuditExportFormat(event.target.value as "PDF" | "EXCEL")
                }
              >
                <option value="PDF">{tr("PDF")}</option>
                <option value="EXCEL">{tr("Excel")}</option>
              </select>
            </label>
            <button type="button" onClick={() => void exportCurrentAuditLogs()}>
              {tr("Exporter audit")}</button>
          </article>
          <article className="panel soft-card">
            <h3>{tr("Points de controle avant mise en ligne")}</h3>
            <ul className="plain-list">
              <li>{tr("API de production avec sondes de sante et metriques d'exploitation")}</li>
              <li>{tr("Sauvegarde PostgreSQL automatisee")}</li>
              <li>{tr("Notifications externes avec suivi de delivrabilite")}</li>
              <li>{tr("Exports PDF et Excel metier pour la finance, la mosquee et l'audit")}</li>
            </ul>
          </article>
        </div>
      </section>
    </WorkflowGuide>
  );
}
