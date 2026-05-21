import type {
  ModuleTile,
  Role,
  ScreenDef,
  ScreenId
} from "../../shared/types/app";
export const SCREEN_DEFS: ScreenDef[] = [
  { id: "dashboard", label: "Tableau de bord", group: "principal", roles: ["ADMIN", "SCOLARITE", "COMPTABLE"] },
  { id: "profile", label: "Mon profil", group: "principal", roles: ["ADMIN", "SCOLARITE", "ENSEIGNANT", "COMPTABLE", "PARENT", "STUDENT"] },
  { id: "preferences", label: "Préférences", group: "principal", roles: ["ADMIN", "SCOLARITE", "ENSEIGNANT", "COMPTABLE", "PARENT", "STUDENT"] },
  { id: "activity", label: "Journal d’activité", group: "principal", roles: ["ADMIN", "SCOLARITE", "ENSEIGNANT", "COMPTABLE", "PARENT", "STUDENT"] },
  { id: "billing", label: "Facturation", group: "principal", roles: ["ADMIN", "SCOLARITE", "ENSEIGNANT", "COMPTABLE", "PARENT", "STUDENT"] },
  { id: "iam", label: "Utilisateurs & droits", group: "principal", roles: ["ADMIN"] },
  { id: "teachers", label: "Enseignants", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "rooms", label: "Salles", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "students", label: "Élèves", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "parents", label: "Parents", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "messages", label: "Messagerie (aperçu)", group: "principal", roles: ["ADMIN", "SCOLARITE", "COMPTABLE"] },
  { id: "reference", label: "Référentiel", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "enrollments", label: "Inscriptions", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "finance", label: "Comptabilité", group: "principal", roles: ["ADMIN", "SCOLARITE", "COMPTABLE"] },
  { id: "reports", label: "Rapports & conformité", group: "principal", roles: ["ADMIN"] },
  { id: "mosquee", label: "Mosquée", group: "principal", roles: ["ADMIN", "COMPTABLE"] },
  { id: "grades", label: "Notes & bulletins", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "schoolLifeOverview", label: "Pilotage", group: "vie", roles: ["ADMIN", "SCOLARITE"] },
  { id: "schoolLifeAttendance", label: "Absences", group: "vie", roles: ["ADMIN", "SCOLARITE"] },
  { id: "schoolLifeTimetable", label: "Emploi du temps", group: "vie", roles: ["ADMIN", "SCOLARITE"] },
  { id: "schoolLifeNotifications", label: "Notifications", group: "vie", roles: ["ADMIN", "SCOLARITE"] },
  { id: "teacherPortal", label: "Portail enseignant", group: "portail", roles: ["ENSEIGNANT"] },
  { id: "parentPortal", label: "Portail parent", group: "portail", roles: ["PARENT"] },
  { id: "studentPortal", label: "Portail élève", group: "portail", roles: ["STUDENT"] }
];

export const ROLE_HOME_SCREEN: Record<Role, ScreenId> = {
  ADMIN: "dashboard",
  SCOLARITE: "dashboard",
  ENSEIGNANT: "teacherPortal",
  COMPTABLE: "finance",
  PARENT: "parentPortal",
  STUDENT: "studentPortal"
};

export const ROLE_CONTEXT_LABELS: Record<Role, string> = {
  ADMIN: "Administration",
  SCOLARITE: "Scolarité",
  ENSEIGNANT: "Espace enseignant",
  COMPTABLE: "Espace comptable",
  PARENT: "Espace parent",
  STUDENT: "Espace élève"
};

export const hasScreenAccess = (role: Role, screen: ScreenId): boolean =>
  SCREEN_DEFS.some((entry) => entry.id === screen && entry.roles.includes(role));

export const MODULE_TILES: ModuleTile[] = [
  {
    screen: "iam",
    title: "Utilisateurs & droits",
    subtitle: "Gérez les comptes, les rôles et les accès des utilisateurs.",
    icon: "shield",
    tone: "indigo",
    tags: ["users", "roles", "permissions", "iam"]
  },
  {
    screen: "students",
    title: "Élèves",
    subtitle: "Dossiers, cursus et responsables",
    icon: "users",
    tone: "blue",
    tags: ["élèves", "matricule", "profil", "cursus"]
  },
  {
    screen: "parents",
    title: "Parents",
    subtitle: "Responsables et liens élèves",
    icon: "parent",
    tone: "violet",
    tags: ["parents", "tuteurs", "responsables", "famille"]
  },
  {
    screen: "teachers",
    title: "Enseignants",
    subtitle: "Fiches, compétences et affectations",
    icon: "teacher",
    tone: "indigo",
    tags: ["enseignants", "professeurs", "compétences", "affectations", "charge"]
  },
  {
    screen: "rooms",
    title: "Salles",
    subtitle: "Espaces, capacités et occupations",
    icon: "room",
    tone: "teal",
    tags: ["salles", "locaux", "capacité", "occupation", "cursus"]
  },
  {
    screen: "enrollments",
    title: "Inscriptions",
    subtitle: "Affectation classe/année",
    icon: "clipboard",
    tone: "orange",
    tags: ["inscriptions", "admission", "classe"]
  },
  {
    screen: "schoolLifeOverview",
    title: "Vie scolaire",
    subtitle: "Pilotage quotidien",
    icon: "graduation",
    tone: "violet",
    tags: ["vie scolaire", "discipline", "suivi"]
  },
  {
    screen: "schoolLifeAttendance",
    title: "Absences",
    subtitle: "Pointage et justificatifs",
    icon: "calendar",
    tone: "pink",
    tags: ["absence", "retard", "justificatif"]
  },
  {
    screen: "schoolLifeTimetable",
    title: "Emploi du temps",
    subtitle: "Planning hebdomadaire",
    icon: "clock",
    tone: "teal",
    tags: ["planning", "emploi du temps", "cours"]
  },
  {
    screen: "messages",
    title: "Messagerie",
    subtitle: "Conversations internes et priorités",
    icon: "messages",
    tone: "teal",
    tags: ["messagerie", "chat", "conversation", "communication"]
  },
  {
    screen: "schoolLifeNotifications",
    title: "Notifications",
    subtitle: "Centre d'alertes multi-canal",
    icon: "bell",
    tone: "indigo",
    tags: ["communication", "notification", "alertes"]
  },
  {
    screen: "finance",
    title: "Finance",
    subtitle: "Factures, paiements, recouvrement",
    icon: "wallet",
    tone: "green",
    tags: ["finance", "paiement", "facture"]
  },
  {
    screen: "reports",
    title: "Rapports & conformité",
    subtitle: "Indicateurs exécutifs et journal d'audit",
    icon: "chart",
    tone: "orange",
    tags: ["reporting", "audit", "conformité", "kpi"]
  },
  {
    screen: "mosquee",
    title: "Mosquée",
    subtitle: "Membres, activités et dons",
    icon: "moon",
    tone: "teal",
    tags: ["mosquée", "dons", "activités", "membres"]
  },
  {
    screen: "grades",
    title: "Notes & bulletins",
    subtitle: "Évaluations et bulletins PDF",
    icon: "book",
    tone: "blue",
    tags: ["notes", "bulletin", "moyenne"]
  },
  {
    screen: "reference",
    title: "Paramètres",
    subtitle: "Référentiel académique",
    icon: "settings",
    tone: "slate",
    tags: ["paramètres", "référentiel", "configuration"]
  },
  {
    screen: "teacherPortal",
    title: "Portail enseignant",
    subtitle: "Espace pédagogique",
    icon: "teacher",
    tone: "orange",
    tags: ["enseignant", "portail", "pedagogie"]
  },
  {
    screen: "parentPortal",
    title: "Portail parent",
    subtitle: "Suivi famille",
    icon: "parent",
    tone: "violet",
    tags: ["parent", "famille", "suivi"]
  },
  {
    screen: "studentPortal",
    title: "Portail élève",
    subtitle: "Accès élève sécurisé",
    icon: "graduation",
    tone: "blue",
    tags: ["élève", "portail", "scolarité"]
  }
];
