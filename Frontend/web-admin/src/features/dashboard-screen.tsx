import type { CSSProperties } from "react";
import type {
  Enrollment,
  Invoice,
  ModuleIconName,
  MosqueeDashboard,
  ParentChild,
  ParentOverview,
  PortalNotification,
  RecoveryDashboard,
  ReportCard,
  Role,
  ScreenId,
  Student,
  TeacherClass,
  TeacherOverview
} from "../shared/types/app";
import { ModuleIcon } from "../shared/components/module-icon";
import { translateUiString, type UiLanguage } from "../shared/i18n";

type DashboardScreenProps = {
  currentRole: Role | null;
  invoices: Invoice[];
  classesCount: number;
  reportCards: ReportCard[];
  recovery: RecoveryDashboard | null;
  students: Student[];
  enrollments: Enrollment[];
  MosqueeDashboard: MosqueeDashboard | null;
  parentOverview: ParentOverview | null;
  parentChildren: ParentChild[];
  parentInvoices: Array<{ status: string }>;
  parentNotifications: PortalNotification[];
  teacherOverview: TeacherOverview | null;
  teacherClasses: TeacherClass[];
  teacherStudentsCount: number;
  teacherGradesCount: number;
  teacherNotifications: PortalNotification[];
  language?: UiLanguage;
  mobileTasksOpen: boolean;
  onSelectScreen: (screen: ScreenId) => void;
  onToggleMobileTasks: () => void;
  formatMoney: (value: number, currency?: string) => string;
  hasScreenAccess: (role: Role, screen: ScreenId) => boolean;
};

export function DashboardScreen(props: DashboardScreenProps): JSX.Element {
  const {
    classesCount,
    currentRole,
    enrollments,
    formatMoney,
    hasScreenAccess,
    invoices,
    language = "fr",
    mobileTasksOpen,
    MosqueeDashboard,
    onSelectScreen,
    onToggleMobileTasks,
    parentChildren,
    parentInvoices,
    parentNotifications,
    parentOverview,
    recovery,
    reportCards,
    students,
    teacherClasses,
    teacherGradesCount,
    teacherNotifications,
    teacherOverview,
    teacherStudentsCount
  } = props;

  if (!currentRole) {
    return <></>;
  }

  const t = (source: string): string => translateUiString(language, source);

  const openInvoices = invoices.filter((item) => item.status !== "PAID").length;
  const pendingReports = Math.max(0, classesCount - reportCards.length);
  const lowRecovery = (recovery?.totals.recoveryRatePercent ?? 0) < 70;

  const priorityTitle = currentRole === "PARENT" ? "Actions utiles" : "Tâches prioritaires";

  let dashboardCards: Array<{ icon: ModuleIconName; label: string; value: string | number; hint: string }> = [];
  let dashboardTasks: Array<{ id: string; title: string; text: string; screen: ScreenId }> = [];
  let dashboardNotifications: Array<{
    id: string;
    tone: "warning" | "info";
    title: string;
    text: string;
    translatable?: boolean;
  }> = [];

  if (currentRole === "PARENT") {
    dashboardCards = [
      {
        icon: "users",
        label: "Enfants",
        value: parentOverview?.childrenCount ?? parentChildren.length,
        hint: "Suivi famille"
      },
      {
        icon: "wallet",
        label: "Factures ouvertes",
        value:
          parentOverview?.openInvoicesCount ??
          parentInvoices.filter((item) => item.status !== "PAID").length,
        hint: "À régler"
      },
      {
        icon: "wallet",
        label: "Reste à payer",
        value: formatMoney(parentOverview?.remainingAmount ?? 0),
        hint: "Situation famille"
      },
      {
        icon: "bell",
        label: "Notifications",
        value: parentOverview?.notificationsCount ?? parentNotifications.length,
        hint: "Messages reçus"
      }
    ];
    dashboardTasks = [
      {
        id: "parent-portal",
        title: "Ouvrir le portail parent",
        text: "Retrouver les notes, absences et bulletins de vos enfants.",
        screen: "parentPortal"
      },
      {
        id: "family-payments",
        title: "Vérifier les paiements",
        text: "Consulter les factures ouvertes et les règlements déjà reçus.",
        screen: "parentPortal"
      },
      {
        id: "family-timetable",
        title: "Consulter l'emploi du temps",
        text: "Voir les horaires utiles directement depuis l'espace famille.",
        screen: "parentPortal"
      }
    ];
    dashboardNotifications = [
      (parentOverview?.remainingAmount ?? 0) > 0
        ? {
            id: "parent-remaining",
            tone: "warning",
            title: "Paiements à suivre",
            text: `Reste à payer : ${formatMoney(parentOverview?.remainingAmount ?? 0)}`
          }
        : null,
      parentNotifications[0]
        ? {
            id: `parent-notification-${parentNotifications[0].id}`,
            tone: "info",
            title: parentNotifications[0].title,
            text: parentNotifications[0].message,
            translatable: false
          }
        : null
    ].filter(
      (
        item
      ): item is {
        id: string;
        tone: "warning" | "info";
        title: string;
        text: string;
        translatable?: boolean;
      } => item !== null
    );
  } else if (currentRole === "ENSEIGNANT") {
    dashboardCards = [
      {
        icon: "room",
        label: "Classes",
        value: teacherOverview?.classesCount ?? teacherClasses.length,
        hint: "Affectations"
      },
      {
        icon: "users",
        label: "Élèves suivis",
        value: teacherOverview?.studentsCount ?? teacherStudentsCount,
        hint: "Périmètre"
      },
      {
        icon: "book",
        label: "Notes",
        value: teacherOverview?.gradesCount ?? teacherGradesCount,
        hint: "Saisies"
      },
      {
        icon: "bell",
        label: "Notifications",
        value: teacherOverview?.notificationsCount ?? teacherNotifications.length,
        hint: "Messages utiles"
      }
    ];
    dashboardTasks = [
      {
        id: "teacher-portal",
        title: "Ouvrir le portail enseignant",
        text: "Accéder aux classes, élèves et notes sous votre responsabilité.",
        screen: "teacherPortal"
      },
      {
        id: "teacher-grades",
        title: "Saisir les notes",
        text: "Renseigner les évaluations de vos classes affectées.",
        screen: "teacherPortal"
      },
      {
        id: "teacher-timetable",
        title: "Consulter l'emploi du temps",
        text: "Vérifier rapidement vos créneaux hebdomadaires.",
        screen: "teacherPortal"
      }
    ];
    dashboardNotifications = [
      (teacherOverview?.pendingJustifications ?? 0) > 0
        ? {
            id: "teacher-justifications",
            tone: "warning",
            title: "Justificatifs en attente",
            text: `${teacherOverview?.pendingJustifications ?? 0} justificatif(s) restent à suivre.`
          }
        : null,
      teacherNotifications[0]
        ? {
            id: `teacher-notification-${teacherNotifications[0].id}`,
            tone: "info",
            title: teacherNotifications[0].title,
            text: teacherNotifications[0].message,
            translatable: false
          }
        : null,
      teacherNotifications[1]
        ? {
            id: `teacher-notification-${teacherNotifications[1].id}`,
            tone: "info",
            title: teacherNotifications[1].title,
            text: teacherNotifications[1].message,
            translatable: false
          }
        : null
    ].filter(
      (
        item
      ): item is {
        id: string;
        tone: "warning" | "info";
        title: string;
        text: string;
        translatable?: boolean;
      } => item !== null
    );
  } else {
    const backOfficeCards: Array<{ icon: ModuleIconName; label: string; value: string | number; hint: string } | null> = [
      hasScreenAccess(currentRole, "students")
        ? { icon: "users", label: "Élèves", value: students.length, hint: "Population" }
        : null,
      hasScreenAccess(currentRole, "reference") || hasScreenAccess(currentRole, "enrollments")
        ? { icon: "room", label: "Classes", value: classesCount, hint: "Organisation" }
        : null,
      hasScreenAccess(currentRole, "enrollments")
        ? { icon: "clipboard", label: "Inscriptions", value: enrollments.length, hint: "Actives" }
        : null,
      hasScreenAccess(currentRole, "finance")
        ? {
            icon: "wallet",
            label: "Recouvrement",
            value: `${recovery ? recovery.totals.recoveryRatePercent.toFixed(1) : "0.0"}%`,
            hint: "Santé financière"
          }
        : null,
      hasScreenAccess(currentRole, "grades")
        ? { icon: "book", label: "Bulletins", value: reportCards.length, hint: "Publiés" }
        : null,
      hasScreenAccess(currentRole, "mosquee")
        ? {
            icon: "wallet",
            label: "Dons mosquée",
            value: formatMoney(MosqueeDashboard?.totals.donationsTotal ?? 0),
            hint: "Total cumulé"
          }
        : null
    ];
    dashboardCards = backOfficeCards.filter(
      (item): item is { icon: ModuleIconName; label: string; value: string | number; hint: string } => item !== null
    );

    dashboardTasks = [
      hasScreenAccess(currentRole, "students")
        ? {
            id: "students",
            title: "Créer un élève",
            text: "Commencer un nouveau dossier élève.",
            screen: "students" as ScreenId
          }
        : null,
      hasScreenAccess(currentRole, "enrollments")
        ? {
            id: "enrollments",
            title: "Valider les inscriptions",
            text: "Relier élèves, classes et année scolaire.",
            screen: "enrollments" as ScreenId
          }
        : null,
      hasScreenAccess(currentRole, "finance")
        ? {
            id: "finance",
            title: "Suivre les paiements",
            text: "Vérifier factures ouvertes et recouvrement.",
            screen: "finance" as ScreenId
          }
        : null,
      hasScreenAccess(currentRole, "grades")
        ? {
            id: "grades",
            title: "Publier les bulletins",
            text: "Générer les bulletins PDF de période.",
            screen: "grades" as ScreenId
          }
        : null,
      hasScreenAccess(currentRole, "reports")
        ? {
            id: "reports",
            title: "Consulter les rapports",
            text: "Suivre les indicateurs et les journaux de conformité.",
            screen: "reports" as ScreenId
          }
        : null
    ].filter(
      (
        item
      ): item is {
        id: string;
        title: string;
        text: string;
        translatable?: boolean;
        screen: ScreenId;
      } => item !== null
    );

    dashboardNotifications = [
      hasScreenAccess(currentRole, "finance") && lowRecovery
        ? {
            id: "recovery",
            tone: "warning",
            title: "Recouvrement à surveiller",
            text: `Taux actuel : ${(recovery?.totals.recoveryRatePercent ?? 0).toFixed(1)}%`
          }
        : null,
      hasScreenAccess(currentRole, "finance") && openInvoices > 0
        ? {
            id: "invoices",
            tone: "info",
            title: "Factures en attente",
            text: `${openInvoices} facture(s) restent à suivre.`
          }
        : null,
      hasScreenAccess(currentRole, "grades") && pendingReports > 0
        ? {
            id: "reports",
            tone: "info",
            title: "Bulletins à publier",
            text: `${pendingReports} classe(s) sans bulletin généré.`
          }
        : null
    ].filter(
      (
        item
      ): item is {
        id: string;
        tone: "warning" | "info";
        title: string;
        text: string;
      } => item !== null
    );
  }

  const overviewCards = dashboardCards.slice(0, 4);
  const financeBars = recovery
    ? [
        {
          label: "Dû",
          value: recovery.totals.amountDue,
          formatted: formatMoney(recovery.totals.amountDue),
          tone: "primary"
        },
        {
          label: "Encaissé",
          value: recovery.totals.amountPaid,
          formatted: formatMoney(recovery.totals.amountPaid),
          tone: "success"
        },
        {
          label: "Reste",
          value: recovery.totals.remainingAmount,
          formatted: formatMoney(recovery.totals.remainingAmount),
          tone: "warning"
        }
      ]
    : [];
  const maxFinanceBarValue = Math.max(1, ...financeBars.map((item) => item.value));
  const operationalSignals = overviewCards.map((card) => {
    const numericValue = typeof card.value === "number" ? card.value : null;

    return {
      label: card.label,
      displayValue: String(card.value),
      numericValue
    };
  });
  const maxOperationalSignal = Math.max(1, ...operationalSignals.map((item) => item.numericValue ?? 0));
  const dashboardSubtitle =
    currentRole === "PARENT"
      ? "Vue rapide du suivi familial et des notifications utiles."
      : currentRole === "ENSEIGNANT"
        ? "Vue rapide de vos classes, élèves et actions pédagogiques."
        : t("Bienvenue, voici l'état opérationnel de l'établissement aujourd'hui.");

  return (
    <div className="dashboard-shell-v2">
      <header className="dashboard-page-header">
        <div>
          <h1>{t("Tableau de bord")}</h1>
          <p>{t(dashboardSubtitle)}</p>
        </div>
      </header>

      <section className="dashboard-kpi-grid dashboard-kpi-grid-flex">
        {overviewCards.map((card) => (
          <article key={card.label} className="panel metric-card kpi-card kpi-card-flex">
            <div className="kpi-card-head">
              <span className="kpi-card-label">{t(card.label)}</span>
              <span className="kpi-card-icon" aria-hidden="true">
                <ModuleIcon name={card.icon} />
              </span>
            </div>
            <strong>{card.value}</strong>
            <small className="subtle">{t(card.hint)}</small>
          </article>
        ))}
      </section>

      <section className="dashboard-template-grid">
        <article className="panel dashboard-panel-shell dashboard-visual-panel">
          <div className="dashboard-visual-head">
            <div>
              <h3>{t("Recouvrement & encaissements")}</h3>
              <p>{t("Lecture rapide issue des factures disponibles.")}</p>
            </div>
          </div>

          {financeBars.length > 0 ? (
            <div className="dashboard-bar-chart" aria-label={t("Synthèse du recouvrement")}>
              {financeBars.map((item) => {
                const barHeight = Math.max(8, Math.round((item.value / maxFinanceBarValue) * 100));

                return (
                  <div key={item.label} className="dashboard-bar-column">
                    <span className="dashboard-bar-value">{item.formatted}</span>
                    <span
                      className={`dashboard-bar-track is-${item.tone}`}
                      style={{ "--bar-height": `${barHeight}%` } as CSSProperties}
                    >
                      <span />
                    </span>
                    <strong>{t(item.label)}</strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="dashboard-empty-chart">
              <strong>{t("À calculer")}</strong>
              <p>{t("Le backend ne fournit pas encore de synthèse financière exploitable pour ce profil.")}</p>
            </div>
          )}
        </article>

        <article className="panel dashboard-panel-shell dashboard-visual-panel">
          <div className="dashboard-visual-head">
            <div>
              <h3>{t("Suivi opérationnel")}</h3>
              <p>{t("Indicateurs clés du périmètre visible.")}</p>
            </div>
          </div>

          <div className="dashboard-signal-list">
            {operationalSignals.map((item) => {
              const barWidth =
                item.numericValue === null ? 0 : Math.max(8, Math.round((item.numericValue / maxOperationalSignal) * 100));

              return (
                <div key={item.label} className="dashboard-signal-row">
                  <div>
                    <span>{t(item.label)}</span>
                    <strong>{item.displayValue}</strong>
                  </div>
                  <span
                    className={`dashboard-signal-track ${item.numericValue === null ? "is-unavailable" : ""}`.trim()}
                    style={{ "--signal-width": `${barWidth}%` } as CSSProperties}
                  >
                    <span />
                  </span>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="dashboard-main-grid dashboard-main-grid-summary">
        <article className="panel priority-panel dashboard-panel-shell dashboard-priority-panel">
          <div className="priority-panel-head">
            <div className="table-header dashboard-section-head">
              <div>
                <p className="section-kicker">{t("Actions")}</p>
                <h3>{t(priorityTitle)}</h3>
              </div>
            </div>
            <button
              type="button"
              className="mobile-section-toggle"
              aria-expanded={mobileTasksOpen}
              onClick={onToggleMobileTasks}
            >
              {t(mobileTasksOpen ? "Masquer" : "Afficher")}
            </button>
          </div>

          <div className={`priority-collapsible ${mobileTasksOpen ? "is-open" : ""}`.trim()}>
            <div className="priority-list">
              {dashboardTasks.length === 0 ? (
                <p className="subtle">{t("Aucune action prioritaire pour ce profil.")}</p>
              ) : (
                dashboardTasks.map((task, index) => (
                  <button
                    key={task.id}
                    type="button"
                    className="priority-item"
                    onClick={() => onSelectScreen(task.screen)}
                  >
                    <span className="priority-item-index">{String(index + 1).padStart(2, "0")}</span>
                    <strong>{t(task.title)}</strong>
                    <small>{t(task.text)}</small>
                  </button>
                ))
              )}
            </div>
          </div>
        </article>

        <article className="panel priority-panel dashboard-panel-shell dashboard-followup-panel">
          <div className="table-header dashboard-section-head">
            <div>
              <p className="section-kicker">{t("Suivi")}</p>
              <h3>{t("Alertes & suivi")}</h3>
            </div>
          </div>

          <div className="notice-list">
            {dashboardNotifications.length === 0 ? (
              <p className="subtle">{t("Aucune alerte à traiter.")}</p>
            ) : (
              dashboardNotifications.map((item) => (
                <article key={item.id} className={`notice-card notice-${item.tone}`}>
                  <strong>{item.translatable === false ? item.title : t(item.title)}</strong>
                  <p>{item.translatable === false ? item.text : t(item.text)}</p>
                </article>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
