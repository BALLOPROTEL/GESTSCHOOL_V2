export type ReportsApiClient = (path: string, init?: RequestInit) => Promise<Response>;

export type AnalyticsFilters = {
  from: string;
  to: string;
  schoolYearId: string;
};

export type AuditFilters = {
  resource: string;
  action: string;
  userId: string;
  q: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
};

export type AuditExportFormat = "PDF" | "EXCEL";
