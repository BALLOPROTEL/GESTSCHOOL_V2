import type {
  Enrollment,
  Invoice,
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
import type { MosqueeDashboard } from "../shared/types/app";

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

  const openInvoices = invoices.filter((item) => item.status !== "PAID").length;
  const pendingReports = Math.max(0, classesCount - reportCards.length);
  const lowRecovery = (recovery?.totals.recoveryRatePercent ?? 0) < 70;

  const priorityTitle = currentRole === "PARENT" ? "Actions utiles" : "Tâches prioritaires";

  let dashboardCards: Array<{ label: string; value: string | number; hint: string }> = [];
  let dashboardTasks: Array<{ id: string; title: string; text: string; screen: ScreenId }> = [];
  let dashboardNotifications: Array<{
    id: string;
    tone: "warning" | "info";
    title: string;
    text: string;
  }> = [];

  if (currentRole === "PARENT") {
    dashboardCards = [
      {
        label: "Enfants",
        value: parentOverview?.childrenCount ?? parentChildren.length,
        hint: "Suivi famille"
      },
      {
        label: "Factures ouvertes",
        value:
          parentOverview?.openInvoicesCount ??
          parentInvoices.filter((item) => item.status !== "PAID").length,
        hint: "À régler"
      },
      {
        label: "Reste à payer",
        value: formatMoney(parentOverview?.remainingAmount ?? 0),
        hint: "Situation famille"
      },
      {
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
            text: parentNotifications[0].message
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
  } else if (currentRole === "ENSEIGNANT") {
    dashboardCards = [
      {
        label: "Classes",
        value: teacherOverview?.classesCount ?? teacherClasses.length,
        hint: "Affectations"
      },
      {
        label: "Élèves suivis",
        value: teacherOverview?.studentsCount ?? teacherStudentsCount,
        hint: "Périmètre"
      },
      {
        label: "Notes",
        value: teacherOverview?.gradesCount ?? teacherGradesCount,
        hint: "Saisies"
      },
      {
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
            text: teacherNotifications[0].message
          }
        : null,
      teacherNotifications[1]
        ? {
            id: `teacher-notification-${teacherNotifications[1].id}`,
            tone: "info",
            title: teacherNotifications[1].title,
            text: teacherNotifications[1].message
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
  } else {
    const backOfficeCards: Array<{ label: string; value: string | number; hint: string } | null> = [
      hasScreenAccess(currentRole, "students")
        ? { label: "Élèves", value: students.length, hint: "Population" }
        : null,
      hasScreenAccess(currentRole, "reference") || hasScreenAccess(currentRole, "enrollments")
        ? { label: "Classes", value: classesCount, hint: "Organisation" }
        : null,
      hasScreenAccess(currentRole, "enrollments")
        ? { label: "Inscriptions", value: enrollments.length, hint: "Actives" }
        : null,
      hasScreenAccess(currentRole, "finance")
        ? {
            label: "Recouvrement",
            value: `${recovery ? recovery.totals.recoveryRatePercent.toFixed(1) : "0.0"}%`,
            hint: "Santé financière"
          }
        : null,
      hasScreenAccess(currentRole, "grades")
        ? { label: "Bulletins", value: reportCards.length, hint: "Publiés" }
        : null,
      hasScreenAccess(currentRole, "mosquee")
        ? {
            label: "Dons mosquée",
            value: formatMoney(MosqueeDashboard?.totals.donationsTotal ?? 0),
            hint: "Total cumulé"
          }
        : null
    ];
    dashboardCards = backOfficeCards.filter(
      (item): item is { label: string; value: string | number; hint: string } => item !== null
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

  return (
    <div className="dashboard-shell-v2">
      <section className="dashboard-kpi-grid dashboard-kpi-grid-flex">
        {overviewCards.map((card, index) => (
          <article key={card.label} className="panel metric-card kpi-card kpi-card-flex">
            <span className="kpi-card-label">{card.label}</span>
            <strong>{card.value}</strong>
            <small className="subtle">{card.hint}</small>
            <div className="kpi-card-progress" aria-hidden="true">
              <span style={{ width: `${58 + ((index + 1) % 4) * 10}%` }} />
            </div>
          </article>
        ))}
      </section>

      <section className="dashboard-main-grid dashboard-main-grid-summary">
        <article className="panel priority-panel dashboard-panel-shell dashboard-priority-panel">
          <div className="priority-panel-head">
            <div className="table-header dashboard-section-head">
              <div>
                <p className="section-kicker">Actions</p>
                <h3>{priorityTitle}</h3>
              </div>
            </div>
            <button
              type="button"
              className="mobile-section-toggle"
              aria-expanded={mobileTasksOpen}
              onClick={onToggleMobileTasks}
            >
              {mobileTasksOpen ? "Masquer" : "Afficher"}
            </button>
          </div>

          <div className={`priority-collapsible ${mobileTasksOpen ? "is-open" : ""}`.trim()}>
            <div className="priority-list">
              {dashboardTasks.length === 0 ? (
                <p className="subtle">Aucune action prioritaire pour ce profil.</p>
              ) : (
                dashboardTasks.map((task, index) => (
                  <button
                    key={task.id}
                    type="button"
                    className="priority-item"
                    onClick={() => onSelectScreen(task.screen)}
                  >
                    <span className="priority-item-index">{String(index + 1).padStart(2, "0")}</span>
                    <strong>{task.title}</strong>
                    <small>{task.text}</small>
                  </button>
                ))
              )}
            </div>
          </div>
        </article>

        <article className="panel priority-panel dashboard-panel-shell dashboard-followup-panel">
          <div className="table-header dashboard-section-head">
            <div>
              <p className="section-kicker">Suivi</p>
              <h3>Alertes & suivi</h3>
            </div>
          </div>

          <div className="notice-list">
            {dashboardNotifications.length === 0 ? (
              <p className="subtle">Aucune alerte à traiter.</p>
            ) : (
              dashboardNotifications.map((item) => (
                <article key={item.id} className={`notice-card notice-${item.tone}`}>
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </article>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
