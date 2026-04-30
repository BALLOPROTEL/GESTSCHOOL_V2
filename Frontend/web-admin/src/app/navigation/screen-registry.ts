import type {
  HeroSlide,
  ModuleTile,
  Role,
  ScreenDef,
  ScreenId
} from "../../shared/types/app";
export const SCREEN_DEFS: ScreenDef[] = [
  { id: "dashboard", label: "Tableau de bord", group: "principal", roles: ["ADMIN", "SCOLARITE", "COMPTABLE"] },
  { id: "iam", label: "Utilisateurs & droits", group: "principal", roles: ["ADMIN"] },
  { id: "teachers", label: "Enseignants", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "rooms", label: "Salles", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "students", label: "Eleves", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "parents", label: "Parents", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "messages", label: "Messagerie (apercu)", group: "principal", roles: ["ADMIN", "SCOLARITE", "COMPTABLE"] },
  { id: "reference", label: "Referentiel", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "enrollments", label: "Inscriptions", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "finance", label: "Comptabilite", group: "principal", roles: ["ADMIN", "SCOLARITE", "COMPTABLE"] },
  { id: "reports", label: "Rapports & conformite", group: "principal", roles: ["ADMIN"] },
  { id: "mosquee", label: "Mosquee", group: "principal", roles: ["ADMIN", "COMPTABLE"] },
  { id: "grades", label: "Notes & bulletins", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "schoolLifeOverview", label: "Pilotage", group: "vie", roles: ["ADMIN", "SCOLARITE"] },
  { id: "schoolLifeAttendance", label: "Absences", group: "vie", roles: ["ADMIN", "SCOLARITE"] },
  { id: "schoolLifeTimetable", label: "Emploi du temps", group: "vie", roles: ["ADMIN", "SCOLARITE"] },
  { id: "schoolLifeNotifications", label: "Notifications", group: "vie", roles: ["ADMIN", "SCOLARITE"] },
  { id: "teacherPortal", label: "Portail enseignant", group: "portail", roles: ["ENSEIGNANT"] },
  { id: "parentPortal", label: "Portail parent", group: "portail", roles: ["PARENT"] },
  { id: "studentPortal", label: "Portail eleve", group: "portail", roles: ["STUDENT"] }
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
  SCOLARITE: "Scolarite",
  ENSEIGNANT: "Espace enseignant",
  COMPTABLE: "Espace comptable",
  PARENT: "Espace parent",
  STUDENT: "Espace eleve"
};

export const hasScreenAccess = (role: Role, screen: ScreenId): boolean =>
  SCREEN_DEFS.some((entry) => entry.id === screen && entry.roles.includes(role));

export const MODULE_TILES: ModuleTile[] = [
  {
    screen: "iam",
    title: "Utilisateurs & droits",
    subtitle: "Comptes, roles et permissions",
    icon: "shield",
    tone: "indigo",
    tags: ["users", "roles", "permissions", "iam"]
  },
  {
    screen: "students",
    title: "Eleves",
    subtitle: "Dossiers, cursus et responsables",
    icon: "users",
    tone: "blue",
    tags: ["eleves", "matricule", "profil", "cursus"]
  },
  {
    screen: "parents",
    title: "Parents",
    subtitle: "Responsables et liens eleves",
    icon: "parent",
    tone: "violet",
    tags: ["parents", "tuteurs", "responsables", "famille"]
  },
  {
    screen: "teachers",
    title: "Enseignants",
    subtitle: "Fiches, competences et affectations",
    icon: "teacher",
    tone: "indigo",
    tags: ["enseignants", "professeurs", "competences", "affectations", "charge"]
  },
  {
    screen: "rooms",
    title: "Salles",
    subtitle: "Espaces, capacites et occupations",
    icon: "room",
    tone: "teal",
    tags: ["salles", "locaux", "capacite", "occupation", "cursus"]
  },
  {
    screen: "enrollments",
    title: "Inscriptions",
    subtitle: "Affectation classe/annee",
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
    subtitle: "Conversations internes et priorites",
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
    title: "Rapports & conformite",
    subtitle: "Indicateurs executifs et journal d'audit",
    icon: "chart",
    tone: "orange",
    tags: ["reporting", "audit", "conformite", "kpi"]
  },
  {
    screen: "mosquee",
    title: "Mosquee",
    subtitle: "Membres, activites et dons",
    icon: "moon",
    tone: "teal",
    tags: ["mosquee", "dons", "activites", "membres"]
  },
  {
    screen: "grades",
    title: "Notes & bulletins",
    subtitle: "Evaluations et bulletins PDF",
    icon: "book",
    tone: "blue",
    tags: ["notes", "bulletin", "moyenne"]
  },
  {
    screen: "reference",
    title: "Parametres",
    subtitle: "Referentiel academique",
    icon: "settings",
    tone: "slate",
    tags: ["parametres", "referentiel", "configuration"]
  },
  {
    screen: "teacherPortal",
    title: "Portail enseignant",
    subtitle: "Espace pedagogique",
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
    title: "Portail eleve",
    subtitle: "Acces eleve securise",
    icon: "graduation",
    tone: "blue",
    tags: ["eleve", "portail", "scolarite"]
  }
];

export const HERO_SLIDES: HeroSlide[] = [
  {
    quote: "Ouvrez des ecoles, vous fermerez des prisons.",
    author: "Victor Hugo",
    label: "Citation"
  },
  {
    quote: "Bienvenue sur GestSchool: suivi unifie de la vie academique et financiere.",
    author: "Annonce Systeme",
    label: "Annonce"
  },
  {
    quote: "Un ecran clair, des workflows simples, une equipe plus efficace.",
    author: "Equipe Produit",
    label: "Vision"
  }
];
