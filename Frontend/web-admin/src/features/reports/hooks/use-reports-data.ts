import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AnalyticsOverview,
  AuditLogPage
} from "../../../shared/types/app";
import {
  exportAuditLogs,
  fetchAnalyticsOverview,
  fetchAuditLogs
} from "../services/reports-service";
import type {
  AnalyticsFilters,
  AuditExportFormat,
  AuditFilters,
  ReportsApiClient
} from "../types/reports";

type UseReportsDataOptions = {
  api: ReportsApiClient;
  remoteEnabled?: boolean;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
};

const buildInitialAnalyticsFilters = (): AnalyticsFilters => ({
  from: "",
  to: "",
  schoolYearId: ""
});

const buildInitialAuditFilters = (): AuditFilters => ({
  resource: "",
  action: "",
  userId: "",
  q: "",
  from: "",
  to: "",
  page: 1,
  pageSize: 20
});

const buildPreviewOverview = (): AnalyticsOverview => {
  const nowIso = new Date().toISOString();
  return {
    generatedAt: nowIso,
    window: { from: "", to: "", days: 0 },
    students: { total: 3, active: 3, createdInWindow: 0 },
    academics: { schoolYears: 1, classes: 2, subjects: 0, activeEnrollments: 2 },
    finance: {
      amountDue: 0,
      amountPaid: 0,
      remainingAmount: 0,
      recoveryRatePercent: 0,
      paymentsInWindow: 0,
      overdueInvoices: 0
    },
    schoolLife: {
      attendanceEntries: 0,
      absences: 0,
      justifiedAbsences: 0,
      justificationRatePercent: 0,
      notificationsQueued: 0,
      notificationsFailed: 0
    },
    mosquee: {
      members: 0,
      activeMembers: 0,
      activitiesInWindow: 0,
      donationsInWindow: 0,
      donationsCountInWindow: 0
    },
    trends: { payments: [], donations: [], absences: [] }
  };
};

const buildPreviewAuditLogs = (): AuditLogPage => ({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
  items: []
});

const triggerFileDownload = (fileName: string, dataUrl: string): void => {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.click();
};

export const useReportsData = ({
  api,
  remoteEnabled = true,
  onError,
  onNotice
}: UseReportsDataOptions) => {
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(
    remoteEnabled ? null : buildPreviewOverview()
  );
  const [analyticsFilters, setAnalyticsFilters] = useState<AnalyticsFilters>(() => buildInitialAnalyticsFilters());
  const [auditLogs, setAuditLogs] = useState<AuditLogPage | null>(
    remoteEnabled ? null : buildPreviewAuditLogs()
  );
  const [auditFilters, setAuditFilters] = useState<AuditFilters>(() => buildInitialAuditFilters());
  const [auditExportFormat, setAuditExportFormat] = useState<AuditExportFormat>("PDF");
  const [reportWorkflowStep, setReportWorkflowStep] = useState("overview");

  const loadAnalytics = useCallback(
    async (filters: AnalyticsFilters = analyticsFilters) => {
      if (!remoteEnabled) {
        setAnalyticsOverview(buildPreviewOverview());
        return;
      }
      try {
        setAnalyticsOverview(await fetchAnalyticsOverview(api, filters));
      } catch (error) {
        onError(error instanceof Error ? error.message : "Erreur de chargement des indicateurs.");
      }
    },
    [analyticsFilters, api, onError, remoteEnabled]
  );

  const loadAuditLogs = useCallback(
    async (filters: AuditFilters = auditFilters) => {
      if (!remoteEnabled) {
        setAuditLogs(buildPreviewAuditLogs());
        return;
      }
      try {
        setAuditLogs(await fetchAuditLogs(api, filters));
      } catch (error) {
        onError(error instanceof Error ? error.message : "Erreur de chargement du journal d'audit.");
      }
    },
    [api, auditFilters, onError, remoteEnabled]
  );

  useEffect(() => {
    void loadAnalytics(buildInitialAnalyticsFilters());
    void loadAuditLogs(buildInitialAuditFilters());
  }, [loadAnalytics, loadAuditLogs]);

  const resetAnalyticsFilters = (): void => {
    const next = buildInitialAnalyticsFilters();
    setAnalyticsFilters(next);
    void loadAnalytics(next);
  };

  const resetAuditFilters = (): void => {
    const next = buildInitialAuditFilters();
    setAuditFilters(next);
    void loadAuditLogs(next);
  };

  const exportCurrentAuditLogs = async (): Promise<void> => {
    onError(null);
    if (!remoteEnabled) {
      onNotice("Mode apercu local : export non persiste.");
      return;
    }
    try {
      const payload = await exportAuditLogs(api, auditExportFormat, auditFilters);
      triggerFileDownload(payload.fileName, payload.dataUrl);
      onNotice(`Export audit ${payload.format} genere (${payload.rowCount} ligne(s)).`);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur d'export audit.");
    }
  };

  const reportSteps = useMemo(
    () => [
      {
        id: "overview",
        title: "Indicateurs executifs",
        hint: "Synthese multi-modules",
        done: !!analyticsOverview
      },
      {
        id: "compliance",
        title: "Journal d'audit",
        hint: "Tracabilite des actions",
        done: (auditLogs?.items.length || 0) > 0
      },
      {
        id: "export",
        title: "Exports metier",
        hint: "Livrables de pilotage"
      }
    ],
    [analyticsOverview, auditLogs]
  );

  return {
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
  };
};
