import type { JSX } from "react";

import { WorkflowGuide } from "../../shared/components/workflow-guide";
import type {
  AnalyticsTrendPoint,
  SchoolYear,
  UserAccount
} from "../../shared/types/app";
import { useReportsData } from "./hooks/use-reports-data";
import type { ReportsApiClient } from "./types/reports";

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
      <article className="panel trend-panel">
        <h4>{title}</h4>
        <div className="trend-list">
          {points.length === 0 ? (
            <p className="subtle">Aucune donnee.</p>
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
      </article>
    );
  };

  return (
    <WorkflowGuide
      title="Rapports avances et conformite"
      steps={reportSteps}
      activeStepId={reportWorkflowStep}
      onStepChange={setReportWorkflowStep}
    >
      <section className="panel table-panel" data-step-id="overview">
        <div className="table-header">
          <h2>Filtrer la fenetre de pilotage</h2>
          <span className="subtle">
            Derniere generation:{" "}
            {analyticsOverview?.generatedAt
              ? new Date(analyticsOverview.generatedAt).toLocaleString(locale)
              : "-"}
          </span>
        </div>
        <form
          className="filter-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void loadAnalytics(analyticsFilters);
          }}
        >
          <label>
            Du
            <input
              type="date"
              value={analyticsFilters.from}
              onChange={(event) =>
                setAnalyticsFilters((prev) => ({ ...prev, from: event.target.value }))
              }
            />
          </label>
          <label>
            Au
            <input
              type="date"
              value={analyticsFilters.to}
              onChange={(event) =>
                setAnalyticsFilters((prev) => ({ ...prev, to: event.target.value }))
              }
            />
          </label>
          <label>
            Annee scolaire
            <select
              value={analyticsFilters.schoolYearId}
              onChange={(event) =>
                setAnalyticsFilters((prev) => ({
                  ...prev,
                  schoolYearId: event.target.value
                }))
              }
            >
              <option value="">Toutes</option>
              {schoolYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.code}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button type="submit">Actualiser KPI</button>
            <button
              type="button"
              className="button-ghost"
              onClick={resetAnalyticsFilters}
            >
              Reinitialiser
            </button>
          </div>
        </form>
        <div className="metrics-grid reports-grid">
          <article className="metric-card">
            <span>Eleves actifs</span>
            <strong>{analyticsOverview?.students.active ?? 0}</strong>
            <small className="subtle">
              +{analyticsOverview?.students.createdInWindow ?? 0} sur la periode
            </small>
          </article>
          <article className="metric-card">
            <span>Inscriptions actives</span>
            <strong>{analyticsOverview?.academics.activeEnrollments ?? 0}</strong>
            <small className="subtle">
              {analyticsOverview?.academics.classes ?? 0} classes surveillees
            </small>
          </article>
          <article className="metric-card">
            <span>Recouvrement</span>
            <strong>
              {(analyticsOverview?.finance.recoveryRatePercent ?? 0).toFixed(1)}%
            </strong>
            <small className="subtle">
              Reste {formatMoney(analyticsOverview?.finance.remainingAmount ?? 0)}
            </small>
          </article>
          <article className="metric-card">
            <span>Absences</span>
            <strong>{analyticsOverview?.schoolLife.absences ?? 0}</strong>
            <small className="subtle">
              {analyticsOverview?.schoolLife.justificationRatePercent?.toFixed(1) ?? "0.0"}% justifiees
            </small>
          </article>
          <article className="metric-card">
            <span>Dons mosquee</span>
            <strong>
              {formatMoney(analyticsOverview?.mosquee.donationsInWindow ?? 0)}
            </strong>
            <small className="subtle">
              {analyticsOverview?.mosquee.donationsCountInWindow ?? 0} transactions
            </small>
          </article>
          <article className="metric-card">
            <span>Alertes notifications</span>
            <strong>{analyticsOverview?.schoolLife.notificationsFailed ?? 0}</strong>
            <small className="subtle">
              {analyticsOverview?.schoolLife.notificationsQueued ?? 0} en attente
            </small>
          </article>
        </div>
        <div className="split-grid">
          {renderTrend("Paiements mensuels", analyticsOverview?.trends.payments || [], "amount")}
          {renderTrend("Dons mensuels", analyticsOverview?.trends.donations || [], "amount")}
          {renderTrend("Absences mensuelles", analyticsOverview?.trends.absences || [], "count")}
        </div>
      </section>

      <section className="panel table-panel" data-step-id="compliance">
        <div className="table-header">
          <h2>Journal de conformite</h2>
          <span className="subtle">
            {auditLogs ? `${auditLogs.total} evenement(s)` : "Aucun chargement"}
          </span>
        </div>
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
            Ressource
            <input
              value={auditFilters.resource}
              onChange={(event) =>
                setAuditFilters((prev) => ({ ...prev, resource: event.target.value }))
              }
              placeholder="users, finance, auth..."
            />
          </label>
          <label>
            Action
            <input
              value={auditFilters.action}
              onChange={(event) =>
                setAuditFilters((prev) => ({ ...prev, action: event.target.value }))
              }
              placeholder="USER_CREATED..."
            />
          </label>
          <label>
            Utilisateur
            <select
              value={auditFilters.userId}
              onChange={(event) =>
                setAuditFilters((prev) => ({ ...prev, userId: event.target.value }))
              }
            >
              <option value="">Tous</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          </label>
          <label>
            Recherche
            <input
              value={auditFilters.q}
              onChange={(event) =>
                setAuditFilters((prev) => ({ ...prev, q: event.target.value }))
              }
              placeholder="ID ressource, identifiant utilisateur..."
            />
          </label>
          <label>
            Du
            <input
              type="date"
              value={auditFilters.from}
              onChange={(event) =>
                setAuditFilters((prev) => ({ ...prev, from: event.target.value }))
              }
            />
          </label>
          <label>
            Au
            <input
              type="date"
              value={auditFilters.to}
              onChange={(event) =>
                setAuditFilters((prev) => ({ ...prev, to: event.target.value }))
              }
            />
          </label>
          <label>
            Taille page
            <select
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
            <button type="submit">Filtrer audit</button>
            <button
              type="button"
              className="button-ghost"
              onClick={resetAuditFilters}
            >
              Reinitialiser
            </button>
          </div>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Ressource</th>
                <th>ID Ressource</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {!auditLogs || auditLogs.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">
                    Aucun log d'audit.
                  </td>
                </tr>
              ) : (
                auditLogs.items.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString(locale)}</td>
                    <td>{item.username || "-"}</td>
                    <td>{item.action}</td>
                    <td>{item.resource}</td>
                    <td>{item.resourceId || "-"}</td>
                    <td>{item.payloadPreview || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination-row">
          <span className="subtle">
            Page {auditLogs?.page || 1} / {auditLogs?.totalPages || 1}
          </span>
          <div className="actions">
            <button
              type="button"
              className="button-ghost"
              disabled={!auditLogs || auditLogs.page <= 1}
              onClick={() => {
                if (!auditLogs) return;
                const next = { ...auditFilters, page: Math.max(1, auditLogs.page - 1) };
                setAuditFilters(next);
                void loadAuditLogs(next);
              }}
            >
              Prec.
            </button>
            <button
              type="button"
              className="button-ghost"
              disabled={!auditLogs || auditLogs.page >= auditLogs.totalPages}
              onClick={() => {
                if (!auditLogs) return;
                const next = {
                  ...auditFilters,
                  page: Math.min(auditLogs.totalPages, auditLogs.page + 1)
                };
                setAuditFilters(next);
                void loadAuditLogs(next);
              }}
            >
              Suiv.
            </button>
          </div>
        </div>
      </section>

      <section className="panel table-panel" data-step-id="export">
        <div className="table-header">
          <h2>Livrables d'export</h2>
          <span className="subtle">Exporter des preuves exploitables pour audit et pilotage.</span>
        </div>
        <div className="split-grid">
          <article className="panel soft-card">
            <h3>Pack audit</h3>
            <p className="subtle">
              Exporte les actions sensibles (auth, permissions, creation/suppression).
            </p>
            <label>
              Format
              <select
                value={auditExportFormat}
                onChange={(event) =>
                  setAuditExportFormat(event.target.value as "PDF" | "EXCEL")
                }
              >
                <option value="PDF">PDF</option>
                <option value="EXCEL">Excel</option>
              </select>
            </label>
            <button type="button" onClick={() => void exportCurrentAuditLogs()}>
              Exporter audit
            </button>
          </article>
          <article className="panel soft-card">
            <h3>Points de controle avant mise en ligne</h3>
            <ul className="plain-list">
              <li>API de production avec sondes de sante et metriques d'exploitation</li>
              <li>Sauvegarde PostgreSQL automatisee</li>
              <li>Notifications externes avec suivi de delivrabilite</li>
              <li>Exports PDF et Excel metier pour la finance, la mosquee et l'audit</li>
            </ul>
          </article>
        </div>
      </section>
    </WorkflowGuide>
  );
}
