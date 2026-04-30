import type {
  AnalyticsOverview,
  AuditLogExportResponse,
  AuditLogPage
} from "../../../shared/types/app";
import type {
  AnalyticsFilters,
  AuditExportFormat,
  AuditFilters,
  ReportsApiClient
} from "../types/reports";

export const parseReportsError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(payload.message)) return payload.message.join(", ");
    if (typeof payload.message === "string") return payload.message;
    if (typeof payload.error === "string") return payload.error;
  } catch {
    // Keep a predictable message for empty or non-JSON API errors.
  }
  return `Erreur HTTP ${response.status}`;
};

export const fetchAnalyticsOverview = async (
  api: ReportsApiClient,
  filters: AnalyticsFilters
): Promise<AnalyticsOverview> => {
  const query = new URLSearchParams();
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.schoolYearId) query.set("schoolYearId", filters.schoolYearId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await api(`/analytics/overview${suffix}`);
  if (!response.ok) {
    throw new Error(await parseReportsError(response));
  }
  return (await response.json()) as AnalyticsOverview;
};

export const fetchAuditLogs = async (
  api: ReportsApiClient,
  filters: AuditFilters
): Promise<AuditLogPage> => {
  const query = new URLSearchParams();
  if (filters.resource) query.set("resource", filters.resource);
  if (filters.action) query.set("action", filters.action);
  if (filters.userId) query.set("userId", filters.userId);
  if (filters.q.trim()) query.set("q", filters.q.trim());
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  query.set("page", String(filters.page || 1));
  query.set("pageSize", String(filters.pageSize || 20));
  const response = await api(`/analytics/compliance/audit-logs?${query.toString()}`);
  if (!response.ok) {
    throw new Error(await parseReportsError(response));
  }
  return (await response.json()) as AuditLogPage;
};

export const exportAuditLogs = async (
  api: ReportsApiClient,
  format: AuditExportFormat,
  filters: AuditFilters
): Promise<AuditLogExportResponse> => {
  const query = new URLSearchParams();
  query.set("format", format);
  if (filters.resource) query.set("resource", filters.resource);
  if (filters.action) query.set("action", filters.action);
  if (filters.userId) query.set("userId", filters.userId);
  if (filters.q.trim()) query.set("q", filters.q.trim());
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  query.set("limit", "1000");
  const response = await api(`/analytics/compliance/audit-logs/export?${query.toString()}`);
  if (!response.ok) {
    throw new Error(await parseReportsError(response));
  }
  return (await response.json()) as AuditLogExportResponse;
};
