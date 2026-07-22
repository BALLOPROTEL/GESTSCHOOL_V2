import { useEffect, useMemo, useState } from "react";

import "../../styles/pilotage.css";
import type {
  AcademicTrack,
  ClassItem,
  Enrollment,
  GradeEntry,
  Invoice,
  Level,
  Period,
  RecoveryDashboard,
  ReportCard,
  SchoolYear,
  ScreenId,
  Student,
  StudentPlacement
} from "../../shared/types/app";
import type { AttendanceSummary, NotificationItem } from "../school-life/types/school-life";
import { fetchGrades } from "../grades/services/grades-service";
import { fetchAttendanceSummary, fetchNotifications } from "../school-life/services/school-life-service";
import { useI18n } from "../../shared/i18n-context";


type PilotageScreenProps = {
  api: (path: string, init?: RequestInit) => Promise<Response>;
  students: Student[];
  enrollments: Enrollment[];
  classes: ClassItem[];
  levels: Level[];
  schoolYears: SchoolYear[];
  periods: Period[];
  invoices: Invoice[];
  recovery: RecoveryDashboard | null;
  reportCards: ReportCard[];
  locale: string;
  remoteEnabled?: boolean;
  formatMoney: (value: number, currency?: string) => string;
  onSelectScreen: (screen: ScreenId) => void;
};

type PilotageFilters = {
  schoolYearId: string;
  track: "" | AcademicTrack;
  levelId: string;
  classId: string;
  periodId: string;
};

type RemoteState<T> = {
  status: "idle" | "loading" | "available" | "unavailable";
  data: T | null;
};

type KpiItem = {
  label: string;
  value: string | number | null;
  hint: string;
  tone?: "teal" | "blue" | "amber" | "green" | "red";
};

type AlertItem = {
  id: string;
  label: string;
  value: string | number;
  hint: string;
  screen: ScreenId;
  actionLabel: string;
  tone: "warning" | "danger" | "info";
};

type QuickAction = {
  label: string;
  hint: string;
  screen: ScreenId;
};

const TRACK_LABELS: Record<AcademicTrack, string> = {
  FRANCOPHONE: "Francophone",
  ARABOPHONE: "Arabophone"
};

const COMPLETE_ENROLLMENT_STATUSES = new Set(["ACTIVE", "ENROLLED", "VALIDATED", "COMPLETED"]);
const CLOSED_INVOICE_STATUSES = new Set(["PAID", "VOID", "CANCELED", "CANCELLED"]);

const normalizeStatus = (value?: string): string => (value || "").trim().toUpperCase();

const isActiveStudent = (student: Student): boolean => {
  const status = normalizeStatus(student.status);
  return !student.archivedAt && status !== "ARCHIVED" && status !== "INACTIVE";
};

const isActivePlacement = (placement: StudentPlacement): boolean => {
  const status = normalizeStatus(placement.placementStatus);
  return status === "" || status === "ACTIVE" || status === "ENROLLED";
};

const formatNumber = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);

const formatRate = (value: number, locale: string): string =>
  `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;

const sum = (items: number[]): number => items.reduce((total, value) => total + value, 0);

const hasFilterValue = (filters: PilotageFilters): boolean =>
  Boolean(filters.track || filters.levelId || filters.classId);

const getActiveSchoolYear = (schoolYears: SchoolYear[]): SchoolYear | undefined =>
  schoolYears.find((item) => item.isActive) ??
  schoolYears.find((item) => normalizeStatus(item.status) === "ACTIVE") ??
  schoolYears[0];

const metricValue = (
  value: string | number | null,
  status?: RemoteState<unknown>["status"]
): string | number => {
  if (status === "loading") return "Chargement";
  if (value === null || value === undefined || value === "") return "Non disponible";
  return value;
};

function PilotageKpiCard({ item }: { item: KpiItem }): JSX.Element {
  return (
    <article
      className={`pilotage-kpi pilotage-kpi--${item.tone ?? "teal"}`}
      aria-label={`${item.label} : ${metricValue(item.value)}`}
    >
      <span className="pilotage-kpi__label">{item.label}</span>
      <strong>{metricValue(item.value)}</strong>
      <span className="pilotage-kpi__hint">{item.hint}</span>
    </article>
  );
}

function PilotageDomainCard({
  title,
  eyebrow,
  description,
  kpis,
  actionLabel,
  onAction
}: {
  title: string;
  eyebrow: string;
  description: string;
  kpis: KpiItem[];
  actionLabel: string;
  onAction: () => void;
}): JSX.Element {
  return (
    <section className="pilotage-card" aria-labelledby={`pilotage-${eyebrow}`}>
      <div className="pilotage-card__header">
        <div>
          <span id={`pilotage-${eyebrow}`} className="pilotage-eyebrow">
            {eyebrow}
          </span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <button type="button" className="button-ghost pilotage-card__action" onClick={onAction}>
          {actionLabel}
        </button>
      </div>
      <div className="pilotage-kpi-grid">
        {kpis.map((item) => (
          <PilotageKpiCard key={item.label} item={item} />
        ))}
      </div>
    </section>
  );
}

function PilotageAlertList({
  alerts,
  onSelectScreen
}: {
  alerts: AlertItem[];
  onSelectScreen: (screen: ScreenId) => void;
}): JSX.Element {
  const { t: tr } = useI18n();
  return (
    <section className="pilotage-card pilotage-alerts" aria-labelledby="pilotage-alerts-title">
      <div className="pilotage-card__header">
        <div>
          <span className="pilotage-eyebrow">{tr("Alertes")}</span>
          <h3 id="pilotage-alerts-title">{tr("À traiter en priorité")}</h3>
          <p>{tr("Chaque alerte renvoie vers le module qui permet de corriger la situation.")}</p>
        </div>
      </div>
      <div className="pilotage-alert-list">
        {alerts.map((alert) => (
          <article key={alert.id} className={`pilotage-alert pilotage-alert--${alert.tone}`}>
            <div className="pilotage-alert__count" aria-label={`${alert.label} : ${alert.value}`}>
              {alert.value}
            </div>
            <div className="pilotage-alert__body">
              <strong>{alert.label}</strong>
              <span>{alert.hint}</span>
            </div>
            <button type="button" className="button-ghost" onClick={() => onSelectScreen(alert.screen)}>
              {alert.actionLabel}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function PilotageQuickActions({
  actions,
  onSelectScreen
}: {
  actions: QuickAction[];
  onSelectScreen: (screen: ScreenId) => void;
}): JSX.Element {
  const { t: tr } = useI18n();
  return (
    <section className="pilotage-quick-actions" aria-label={tr("Actions rapides de pilotage")}>
      {actions.map((action) => (
        <button
          key={action.screen}
          type="button"
          className="pilotage-quick-action"
          onClick={() => onSelectScreen(action.screen)}
        >
          <strong>{action.label}</strong>
          <span>{action.hint}</span>
        </button>
      ))}
    </section>
  );
}

export function PilotageScreen(props: PilotageScreenProps): JSX.Element {
  const { t: tr } = useI18n();
  const {
    api,
    classes,
    enrollments,
    formatMoney,
    invoices,
    levels,
    locale,
    onSelectScreen,
    periods,
    recovery,
    remoteEnabled = true,
    reportCards,
    schoolYears,
    students
  } = props;
  const activeSchoolYear = useMemo(() => getActiveSchoolYear(schoolYears), [schoolYears]);
  const [filters, setFilters] = useState<PilotageFilters>({
    schoolYearId: activeSchoolYear?.id ?? "",
    track: "",
    levelId: "",
    classId: "",
    periodId: ""
  });
  const [gradesState, setGradesState] = useState<RemoteState<GradeEntry[]>>({
    status: "idle",
    data: null
  });
  const [attendanceState, setAttendanceState] = useState<RemoteState<AttendanceSummary>>({
    status: "idle",
    data: null
  });
  const [notificationsState, setNotificationsState] = useState<RemoteState<NotificationItem[]>>({
    status: "idle",
    data: null
  });

  useEffect(() => {
    if (!filters.schoolYearId && activeSchoolYear?.id) {
      setFilters((current) => ({ ...current, schoolYearId: activeSchoolYear.id }));
    }
  }, [activeSchoolYear?.id, filters.schoolYearId]);

  const levelById = useMemo(() => new Map(levels.map((item) => [item.id, item])), [levels]);

  const classOptions = useMemo(
    () =>
      classes.filter((item) => {
        if (filters.schoolYearId && item.schoolYearId !== filters.schoolYearId) return false;
        if (filters.track && item.track !== filters.track) return false;
        if (filters.levelId && item.levelId !== filters.levelId) return false;
        return true;
      }),
    [classes, filters.levelId, filters.schoolYearId, filters.track]
  );

  const classIdsInScope = useMemo(() => new Set(classOptions.map((item) => item.id)), [classOptions]);

  useEffect(() => {
    if (filters.classId && !classIdsInScope.has(filters.classId)) {
      setFilters((current) => ({ ...current, classId: "" }));
    }
  }, [classIdsInScope, filters.classId]);

  const periodOptions = useMemo(
    () => periods.filter((item) => !filters.schoolYearId || item.schoolYearId === filters.schoolYearId),
    [periods, filters.schoolYearId]
  );
  const selectedPeriod = useMemo(
    () => periodOptions.find((item) => item.id === filters.periodId),
    [filters.periodId, periodOptions]
  );

  const placementMatches = (placement: StudentPlacement): boolean => {
    if (!isActivePlacement(placement)) return false;
    if (filters.schoolYearId && placement.schoolYearId !== filters.schoolYearId) return false;
    if (filters.track && placement.track !== filters.track) return false;
    if (filters.levelId && placement.levelId !== filters.levelId) return false;
    if (filters.classId && placement.classId !== filters.classId) return false;
    return true;
  };

  const activeStudents = useMemo(
    () =>
      students.filter((student) => {
        if (!isActiveStudent(student)) return false;
        if ((student.placements ?? []).some(placementMatches)) return true;
        return !hasFilterValue(filters);
      }),
    [students, filters]
  );

  const scopedPlacements = useMemo(
    () =>
      activeStudents.flatMap((student) =>
        (student.placements ?? [])
          .filter(placementMatches)
          .map((placement) => ({
            studentId: student.id,
            placement
          }))
      ),
    [activeStudents, filters]
  );

  const trackStudentCounts = useMemo(() => {
    const francophone = new Set<string>();
    const arabophone = new Set<string>();
    scopedPlacements.forEach(({ studentId, placement }) => {
      if (placement.track === "FRANCOPHONE") francophone.add(studentId);
      if (placement.track === "ARABOPHONE") arabophone.add(studentId);
    });
    return {
      francophone: francophone.size,
      arabophone: arabophone.size
    };
  }, [scopedPlacements]);

  const filteredEnrollments = useMemo(
    () =>
      enrollments.filter((item) => {
        if (filters.schoolYearId && item.schoolYearId !== filters.schoolYearId) return false;
        if (filters.track && item.track !== filters.track && item.primaryTrack !== filters.track && item.secondaryTrack !== filters.track) {
          return false;
        }
        if (filters.classId && item.classId !== filters.classId) return false;
        if (filters.levelId && !classIdsInScope.has(item.classId)) return false;
        return true;
      }),
    [classIdsInScope, enrollments, filters]
  );

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((item) => {
        if (filters.schoolYearId && item.schoolYearId !== filters.schoolYearId) return false;
        if (filters.track && item.primaryTrack !== filters.track && item.secondaryTrack !== filters.track) return false;
        if (filters.classId && item.primaryClassId !== filters.classId && item.secondaryClassId !== filters.classId) {
          return false;
        }
        if (filters.levelId && item.primaryLevelId !== filters.levelId && item.secondaryLevelId !== filters.levelId) {
          return false;
        }
        return true;
      }),
    [filters, invoices]
  );

  const filteredReportCards = useMemo(
    () =>
      reportCards.filter((item) => {
        if (filters.periodId && item.academicPeriodId !== filters.periodId) return false;
        if (filters.track && item.track !== filters.track) return false;
        if (filters.classId && item.classId !== filters.classId) return false;
        if ((filters.levelId || filters.schoolYearId) && !classIdsInScope.has(item.classId)) return false;
        return true;
      }),
    [classIdsInScope, filters, reportCards]
  );

  useEffect(() => {
    if (!remoteEnabled) {
      setGradesState({ status: "unavailable", data: null });
      setAttendanceState({ status: "unavailable", data: null });
      setNotificationsState({ status: "unavailable", data: null });
      return;
    }

    let cancelled = false;
    setGradesState((current) => ({ status: "loading", data: current.data }));
    setAttendanceState((current) => ({ status: "loading", data: current.data }));
    setNotificationsState((current) => ({ status: "loading", data: current.data }));

    fetchGrades(api, {
      schoolYearId: filters.schoolYearId,
      classId: filters.classId,
      subjectId: "",
      academicPeriodId: filters.periodId,
      track: filters.track || "MIXED",
      studentId: ""
    })
      .then((data) => {
        if (!cancelled) setGradesState({ status: "available", data });
      })
      .catch(() => {
        if (!cancelled) setGradesState({ status: "unavailable", data: null });
      });

    fetchAttendanceSummary(api, {
      classId: filters.classId,
      studentId: "",
      status: "",
      fromDate: selectedPeriod?.startDate ?? "",
      toDate: selectedPeriod?.endDate ?? ""
    })
      .then((data) => {
        if (!cancelled) setAttendanceState({ status: "available", data });
      })
      .catch(() => {
        if (!cancelled) setAttendanceState({ status: "unavailable", data: null });
      });

    fetchNotifications(api, {
      status: "",
      channel: "",
      deliveryStatus: ""
    })
      .then((data) => {
        if (!cancelled) setNotificationsState({ status: "available", data });
      })
      .catch(() => {
        if (!cancelled) setNotificationsState({ status: "unavailable", data: null });
      });

    return () => {
      cancelled = true;
    };
  }, [api, filters.classId, filters.periodId, remoteEnabled, selectedPeriod?.endDate, selectedPeriod?.startDate]);

  const gradesInScope = useMemo(() => {
    if (!gradesState.data) return [];
    return gradesState.data.filter((item) => {
      if (filters.periodId && item.academicPeriodId !== filters.periodId) return false;
      if (filters.track && item.track !== filters.track) return false;
      if (filters.classId && item.classId !== filters.classId) return false;
      if ((filters.levelId || filters.schoolYearId) && !classIdsInScope.has(item.classId)) return false;
      return true;
    });
  }, [classIdsInScope, filters, gradesState.data]);

  const openInvoices = useMemo(
    () =>
      filteredInvoices.filter(
        (item) => item.remainingAmount > 0 && !CLOSED_INVOICE_STATUSES.has(normalizeStatus(item.status))
      ),
    [filteredInvoices]
  );

  const invoiceTotals = useMemo(() => {
    const amountDue = sum(filteredInvoices.map((item) => item.amountDue));
    const amountPaid = sum(filteredInvoices.map((item) => item.amountPaid));
    const remainingAmount = sum(filteredInvoices.map((item) => item.remainingAmount));
    const hasNoFinanceFilter = !filters.schoolYearId && !filters.track && !filters.levelId && !filters.classId;
    const fallbackTotals = hasNoFinanceFilter ? recovery?.totals : null;
    const due = amountDue || fallbackTotals?.amountDue || 0;
    const paid = amountPaid || fallbackTotals?.amountPaid || 0;
    const remaining = remainingAmount || fallbackTotals?.remainingAmount || 0;
    return {
      amountDue: due,
      amountPaid: paid,
      remainingAmount: remaining,
      recoveryRatePercent: due > 0 ? (paid / due) * 100 : fallbackTotals?.recoveryRatePercent ?? 0
    };
  }, [filteredInvoices, filters, recovery]);

  const studentsWithoutClass = useMemo(() => {
    if (filters.classId) return [];
    return activeStudents.filter((student) => {
      const placements = (student.placements ?? []).filter((placement) => {
        if (!isActivePlacement(placement)) return false;
        if (filters.schoolYearId && placement.schoolYearId !== filters.schoolYearId) return false;
        if (filters.track && placement.track !== filters.track) return false;
        if (filters.levelId && placement.levelId !== filters.levelId) return false;
        return true;
      });
      return placements.length === 0 || placements.some((placement) => !placement.classId);
    });
  }, [activeStudents, filters]);

  const incompleteEnrollments = useMemo(
    () =>
      filteredEnrollments.filter(
        (item) => !COMPLETE_ENROLLMENT_STATUSES.has(normalizeStatus(item.enrollmentStatus))
      ),
    [filteredEnrollments]
  );

  const missingReportCardsCount = useMemo(() => {
    if (!filters.periodId) return null;
    const expected = new Set(
      scopedPlacements
        .filter(({ placement }) => placement.classId)
        .map(({ studentId, placement }) => `${studentId}:${placement.classId}:${placement.track}:${filters.periodId}`)
    );
    const generated = new Set(
      filteredReportCards.map(
        (item) => `${item.studentId}:${item.classId}:${item.track}:${item.academicPeriodId}`
      )
    );
    let missing = 0;
    expected.forEach((key) => {
      if (!generated.has(key)) missing += 1;
    });
    return missing;
  }, [filteredReportCards, filters.periodId, scopedPlacements]);

  const schoolKpis: KpiItem[] = [
    {
      label: "Élèves actifs",
      value: activeStudents.length,
      hint: "Dossiers actifs dans le périmètre",
      tone: "teal"
    },
    {
      label: "Inscriptions",
      value: filteredEnrollments.length,
      hint: "Inscriptions liées aux filtres",
      tone: "blue"
    },
    {
      label: "Classes",
      value: classOptions.length,
      hint: "Classes ouvertes ou référencées",
      tone: "green"
    },
    {
      label: "Cursus FR / AR",
      value: `${trackStudentCounts.francophone} / ${trackStudentCounts.arabophone}`,
      hint: "Répartition élèves par cursus",
      tone: "amber"
    }
  ];

  const schoolLifeKpis: KpiItem[] = [
    {
      label: "Notes saisies",
      value: gradesState.status === "available" ? gradesInScope.length : null,
      hint: gradesState.status === "loading" ? "Chargement des notes" : "Entrées de notes existantes",
      tone: "blue"
    },
    {
      label: "Bulletins générés",
      value: filteredReportCards.length,
      hint: "Bulletins présents dans la base",
      tone: "green"
    },
    {
      label: "Absences",
      value: attendanceState.status === "available" ? attendanceState.data?.byStatus.ABSENT ?? 0 : null,
      hint: attendanceState.status === "loading" ? "Chargement des absences" : "Synthèse vie scolaire",
      tone: "amber"
    },
    {
      label: "Notifications",
      value: notificationsState.status === "available" ? notificationsState.data?.length ?? 0 : null,
      hint: notificationsState.status === "loading" ? "Chargement des notifications" : "Messages suivis",
      tone: "teal"
    }
  ];

  const financeKpis: KpiItem[] = [
    {
      label: "Total dû",
      value: formatMoney(invoiceTotals.amountDue),
      hint: "Montant facturé",
      tone: "blue"
    },
    {
      label: "Encaissé",
      value: formatMoney(invoiceTotals.amountPaid),
      hint: "Paiements enregistrés",
      tone: "green"
    },
    {
      label: "À recouvrer",
      value: formatMoney(invoiceTotals.remainingAmount),
      hint: "Solde restant",
      tone: openInvoices.length > 0 ? "amber" : "teal"
    },
    {
      label: "Recouvrement",
      value: formatRate(invoiceTotals.recoveryRatePercent, locale),
      hint: "Taux calculé sur les factures",
      tone: invoiceTotals.recoveryRatePercent >= 80 ? "green" : "amber"
    }
  ];

  const alertItems: AlertItem[] = [
    {
      id: "incomplete-enrollments",
      label: "Inscriptions incomplètes",
      value: incompleteEnrollments.length,
      hint: "Dossiers à finaliser avant validation administrative.",
      screen: "enrollments",
      actionLabel: "Traiter",
      tone: incompleteEnrollments.length > 0 ? "warning" : "info"
    },
    {
      id: "students-without-class",
      label: "Élèves sans classe",
      value: studentsWithoutClass.length,
      hint: "Élèves actifs sans affectation exploitable.",
      screen: "students",
      actionLabel: "Affecter",
      tone: studentsWithoutClass.length > 0 ? "danger" : "info"
    },
    {
      id: "open-invoices",
      label: "Factures impayées",
      value: openInvoices.length,
      hint: "Factures avec un solde restant à recouvrer.",
      screen: "finance",
      actionLabel: "Relancer",
      tone: openInvoices.length > 0 ? "warning" : "info"
    },
    {
      id: "missing-report-cards",
      label: "Bulletins non générés",
      value: missingReportCardsCount === null ? "À calculer" : missingReportCardsCount,
      hint:
        missingReportCardsCount === null
          ? "Sélectionnez une période pour calculer précisément."
          : "Bulletins attendus pour la période sélectionnée.",
      screen: "grades",
      actionLabel: "Générer",
      tone: missingReportCardsCount && missingReportCardsCount > 0 ? "warning" : "info"
    }
  ];
  const quickActions: QuickAction[] = [
    {
      label: "Inscriptions",
      hint: `${incompleteEnrollments.length} dossier(s) à vérifier`,
      screen: "enrollments"
    },
    {
      label: "Élèves",
      hint: `${studentsWithoutClass.length} sans classe`,
      screen: "students"
    },
    {
      label: "Comptabilité",
      hint: `${openInvoices.length} facture(s) à suivre`,
      screen: "finance"
    },
    {
      label: "Notes & bulletins",
      hint: missingReportCardsCount === null ? "Choisir une période" : `${missingReportCardsCount} bulletin(s) manquant(s)`,
      screen: "grades"
    },
    {
      label: "Absences",
      hint: attendanceState.status === "available" ? `${attendanceState.data?.byStatus.ABSENT ?? 0} absence(s)` : "Synthèse à charger",
      screen: "schoolLifeAttendance"
    }
  ];

  return (
    <section className="pilotage-screen" aria-labelledby="pilotage-title">
      <div className="pilotage-hero">
        <div>
          <span className="pilotage-eyebrow">{tr("Console opérationnelle")}</span>
          <h2 id="pilotage-title">{tr("Pilotage")}</h2>
          <p>
            {tr("Analysez la situation de l’établissement, repérez les alertes et ouvrez directement\n            les modules d’action.")}</p>
        </div>
        <div className="pilotage-hero__summary" aria-label={tr("Résumé du périmètre")}>
          <strong>{formatNumber(activeStudents.length, locale)}</strong>
          <span>{tr("élèves actifs suivis")}</span>
        </div>
      </div>

      <section className="pilotage-filters" aria-label={tr("Filtres du pilotage")}>
        <label>
          <span>{tr("Année scolaire")}</span>
          <select
            value={filters.schoolYearId}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                schoolYearId: event.target.value,
                classId: "",
                periodId: ""
              }))
            }
          >
            <option value="">{tr("Toutes les années")}</option>
            {schoolYears.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label || item.code}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{tr("Cursus")}</span>
          <select
            value={filters.track}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                track: event.target.value as PilotageFilters["track"],
                classId: ""
              }))
            }
          >
            <option value="">{tr("Tous les cursus")}</option>
            <option value="FRANCOPHONE">{TRACK_LABELS.FRANCOPHONE}</option>
            <option value="ARABOPHONE">{TRACK_LABELS.ARABOPHONE}</option>
          </select>
        </label>
        <label>
          <span>{tr("Niveau")}</span>
          <select
            value={filters.levelId}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                levelId: event.target.value,
                classId: ""
              }))
            }
          >
            <option value="">{tr("Tous les niveaux")}</option>
            {levels
              .filter((item) => !filters.track || item.track === filters.track)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>{tr("Classe")}</span>
          <select
            value={filters.classId}
            onChange={(event) => setFilters((current) => ({ ...current, classId: event.target.value }))}
          >
            <option value="">{tr("Toutes les classes")}</option>
            {classOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} {levelById.get(item.levelId)?.label ? `- ${levelById.get(item.levelId)?.label}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{tr("Période")}</span>
          <select
            value={filters.periodId}
            onChange={(event) => setFilters((current) => ({ ...current, periodId: event.target.value }))}
          >
            <option value="">{tr("Toutes les périodes")}</option>
            {periodOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <PilotageQuickActions actions={quickActions} onSelectScreen={onSelectScreen} />

      <div className="pilotage-grid">
        <PilotageDomainCard
          title={tr("Scolarité")}
          eyebrow="scolarite"
          description="Suivi des effectifs, inscriptions, classes et cursus actifs."
          kpis={schoolKpis}
          actionLabel="Ouvrir inscriptions"
          onAction={() => onSelectScreen("enrollments")}
        />
        <PilotageDomainCard
          title={tr("Vie scolaire")}
          eyebrow="vie-scolaire"
          description="Lecture opérationnelle des notes, bulletins, absences et notifications."
          kpis={schoolLifeKpis}
          actionLabel="Ouvrir absences"
          onAction={() => onSelectScreen("schoolLifeAttendance")}
        />
        <PilotageDomainCard
          title={tr("Finance")}
          eyebrow="finance"
          description="Situation de recouvrement et niveau des impayés."
          kpis={financeKpis}
          actionLabel="Ouvrir comptabilité"
          onAction={() => onSelectScreen("finance")}
        />
        <PilotageAlertList alerts={alertItems} onSelectScreen={onSelectScreen} />
      </div>
    </section>
  );
}
