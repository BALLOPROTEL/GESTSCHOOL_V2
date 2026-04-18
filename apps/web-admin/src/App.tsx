import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AcademicStage,
  AcademicTrack,
  AnalyticsOverview,
  AnalyticsTrendPoint,
  AuditLogExportResponse,
  AuditLogPage,
  AuthMessageResponse,
  AccountType,
  ClassItem,
  ClassSummary,
  Cycle,
  Enrollment,
  FeePlan,
  FieldErrors,
  ForgotPasswordResponse,
  GradeEntry,
  HeroSlide,
  Invoice,
  Level,
  ModuleTile,
  MosqueActivity,
  MosqueDashboard,
  MosqueDonation,
  MosqueDonationReceipt,
  MosqueExportResponse,
  MosqueMember,
  ParentChild,
  ParentOverview,
  ParentRecord,
  PeriodStatus,
  PasswordMode,
  PaymentRecord,
  Period,
  PermissionAction,
  PermissionResource,
  PortalNotification,
  RecoveryDashboard,
  RememberedLogin,
  ReportCard,
  ReportCardMode,
  Role,
  RolePermissionView,
  SchoolYearStatus,
  SchoolYear,
  ScreenDef,
  ScreenId,
  Session,
  Student,
  Subject,
  SubjectNature,
  TeacherClass,
  TeacherRecord,
  TeacherOverview,
  TeacherStudent,
  ThemeMode,
  UserAccount,
  WorkflowStepDef
} from "./app-types";
import { AppSidebar } from "./components/app-sidebar";
import { ConstructionPageMosquee } from "./construction-page-mosquee";
import { WorkflowGuide } from "./components/workflow-guide";
import {
  HeaderNavigation,
  type HeaderNavigationAction,
  type HeaderNavigationGroup,
  type HeaderPreferenceAction
} from "./header-navigation";
import { useAuthSession } from "./hooks/use-auth-session-resilient";
import { UI_LANGUAGE_META, UI_LANGUAGE_ORDER, UiLanguage, useDomTranslation } from "./i18n";
import { SchoolLifePanel } from "./school-life-panel";
import { AuthScreen } from "./screens/auth-screen";
import { DashboardScreen } from "./screens/dashboard-screen";
import { MessagesScreen } from "./screens/messages-screen";
import { ParentsScreen } from "./screens/parents-screen";
import { StudentPortalPlaceholderScreen } from "./screens/student-portal-placeholder-screen";
import { StudentsScreen } from "./screens/students-screen";
import { TeachersScreen } from "./screens/teachers-screen";
import { RoomsScreen } from "./screens/rooms-screen";
import {
  readLanguagePreference,
  readRememberedLogin,
  readThemePreference
} from "./services/session-storage";

const hasFieldErrors = (errors: FieldErrors): boolean => Object.keys(errors).length > 0;

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";
const DEFAULT_CURRENCY = "CFA";
const SCHOOL_NAME = "Al Manarat Islamiyat";
const API_PROXY_BASE = "/api/v1";
const LOOPBACK_API_HOSTS = new Set(["127.0.0.1", "0.0.0.0", "localhost"]);

const normalizeApiBaseUrl = (value?: string): string | null => {
  const normalized = value?.trim().replace(/\/+$/, "") || "";
  return normalized.length > 0 ? normalized : null;
};

const isLoopbackApiBaseUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return LOOPBACK_API_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

const resolveApiBaseUrls = (): string[] => {
  if (import.meta.env.DEV) {
    return [API_PROXY_BASE];
  }

  const configured = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
  const candidates = [
    ...(configured && !isLoopbackApiBaseUrl(configured) ? [configured] : []),
    API_PROXY_BASE
  ];

  return Array.from(new Set(candidates));
};

const API_BASE_URLS = resolveApiBaseUrls();
const PREVIEW_ACCESS_TOKEN = "__preview__";
const PREVIEW_MODE_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_PREVIEW === "true";
const CHANNEL_LABELS: Record<string, string> = {
  CASH: "Especes",
  MOBILE_MONEY: "Mobile money",
  BANK: "Banque",
  TRANSFER: "Virement",
  OTHER: "Autre"
};
const THEME_STORAGE_KEY = "gestschool.web-admin.theme";
const LANGUAGE_STORAGE_KEY = "gestschool.web-admin.language";
const LOGIN_HINT_STORAGE_KEY = "gestschool.web-admin.login-hint";
const ICON_TOGGLE_ANIMATION_MS = 460;
const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{12,128}$/;
const STRONG_PASSWORD_HINT =
  "Le mot de passe doit contenir au moins 12 caracteres, avec majuscule, minuscule, chiffre et caractere special.";

const today = (): string => new Date().toISOString().slice(0, 10);
const isStrongPassword = (value: string): boolean => STRONG_PASSWORD_REGEX.test(value);
const getNextThemeMode = (mode: ThemeMode): ThemeMode => (mode === "light" ? "dark" : "light");
const getNextUiLanguage = (language: UiLanguage): UiLanguage => {
  const currentIndex = UI_LANGUAGE_ORDER.indexOf(language);
  return UI_LANGUAGE_ORDER[(currentIndex + 1) % UI_LANGUAGE_ORDER.length] || "fr";
};
const getIconToggleAnimationDuration = (): number =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : ICON_TOGGLE_ANIMATION_MS;
const formatLookupLabel = (map: Record<string, string>, value?: string): string => {
  const normalized = (value || "").trim().toUpperCase();
  return map[normalized] || value || "-";
};
const formatRoleLabel = (value?: string): string => formatLookupLabel(ROLE_LABELS, value);
const formatAccountTypeLabel = (value?: string): string => formatLookupLabel(ACCOUNT_TYPE_LABELS, value);
const formatInvoiceStatusLabel = (value?: string): string => formatLookupLabel(INVOICE_STATUS_LABELS, value);
const formatAttendanceStatusLabel = (value?: string): string =>
  formatLookupLabel(ATTENDANCE_STATUS_LABELS, value);
const formatValidationStatusLabel = (value?: string): string =>
  formatLookupLabel(VALIDATION_STATUS_LABELS, value);
const formatPortalNotificationStatusLabel = (value?: string): string =>
  formatLookupLabel(PORTAL_NOTIFICATION_STATUS_LABELS, value);
const formatAudienceRoleLabel = (value?: string): string =>
  formatLookupLabel(AUDIENCE_ROLE_LABELS, value);
const formatMemberStatusLabel = (value?: string): string => formatLookupLabel(MEMBER_STATUS_LABELS, value);
const formatEnrollmentStatusLabel = (value?: string): string =>
  formatLookupLabel(ENROLLMENT_STATUS_LABELS, value);
const formatAcademicTrackLabel = (value?: string): string =>
  value === "ARABOPHONE" ? "Arabophone" : "Francophone";
const formatAcademicStageLabel = (value?: AcademicStage): string => {
  if (value === "PRIMARY") return "Primaire";
  if (value === "HIGHER") return "Superieur";
  return "Secondaire";
};
const formatReferenceStatusLabel = (value?: string): string =>
  value === "INACTIVE" ? "Inactif" : value === "CLOSED" ? "Cloture" : value === "DRAFT" ? "Brouillon" : "Actif";
const formatSchoolYearStatusLabel = (value?: SchoolYearStatus): string => formatReferenceStatusLabel(value);
const formatPeriodTypeLabel = (value?: string): string => {
  if (value === "SEMESTER") return "Semestre";
  if (value === "BIMESTER") return "Bimestre";
  if (value === "CUSTOM") return "Libre";
  return "Trimestre";
};
const formatSubjectNatureLabel = (value?: SubjectNature): string =>
  value === "ARABOPHONE" ? "Matiere Arabophone" : "Matiere Francophone";
const formatSchoolYearOptionLabel = (item?: SchoolYear): string => {
  if (!item) return "-";
  return item.label && item.label !== item.code ? `${item.label} (${item.code})` : item.label || item.code;
};
const formatReportCardModeLabel = (value?: ReportCardMode): string =>
  value === "PRIMARY_COMBINED" ? "Bulletin primaire combine" : "Bulletin par cursus";
const formatWeekdayLabel = (day?: number): string => WEEKDAY_LABELS[day || 0] || String(day || "-");
const formatPermissionActionLabel = (value: PermissionAction): string =>
  PERMISSION_ACTION_LABELS[value] || value;
const formatPermissionResourceLabel = (value: PermissionResource): string =>
  PERMISSION_RESOURCE_LABELS[value] || value;

const getReferenceFieldErrorTarget = (
  path: string,
  message: string
): { scope: "schoolYear" | "cycle" | "level" | "class" | "subject" | "period"; field: string } | null => {
  const normalized = message.trim().toLowerCase();

  if (path === "/school-years" && normalized.includes("already exists")) {
    return {
      scope: "schoolYear",
      field: normalized.includes("label") ? "label" : normalized.includes("active") ? "status" : "code"
    };
  }
  if (path === "/school-years" && normalized.includes("previous school year")) {
    return { scope: "schoolYear", field: "previousYearId" };
  }
  if (path === "/school-years" && normalized.includes("overlaps")) {
    return { scope: "schoolYear", field: "startDate" };
  }
  if (path === "/cycles" && normalized.includes("already exists")) {
    return { scope: "cycle", field: normalized.includes("order") ? "sortOrder" : "code" };
  }
  if (path === "/cycles" && normalized.includes("age")) {
    return { scope: "cycle", field: "theoreticalAgeMax" };
  }
  if (path === "/levels" && normalized.includes("already exists")) {
    return { scope: "level", field: normalized.includes("order") ? "sortOrder" : "code" };
  }
  if (path === "/classes" && normalized.includes("already exists")) {
    return { scope: "class", field: normalized.includes("capacity") ? "actualCapacity" : "code" };
  }
  if (path === "/classes" && normalized.includes("maximum capacity")) {
    return { scope: "class", field: "capacity" };
  }
  if (path === "/classes" && normalized.includes("actual class capacity")) {
    return { scope: "class", field: "actualCapacity" };
  }
  if (path === "/subjects" && normalized.includes("already exists")) {
    return { scope: "subject", field: normalized.includes("level") ? "levelIds" : "code" };
  }
  if (path === "/subjects" && normalized.includes("coefficient")) {
    return { scope: "subject", field: "defaultCoefficient" };
  }
  if (path === "/subjects" && normalized.includes("weekly hours")) {
    return { scope: "subject", field: "weeklyHours" };
  }
  if (path === "/subjects" && normalized.includes("level scope")) {
    return { scope: "subject", field: "levelIds" };
  }
  if (path === "/academic-periods" && normalized.includes("already exists")) {
    return { scope: "period", field: normalized.includes("order") ? "sortOrder" : "code" };
  }
  if (path === "/academic-periods" && normalized.includes("deadline")) {
    return { scope: "period", field: "gradeEntryDeadline" };
  }
  if (path === "/academic-periods" && normalized.includes("lock date")) {
    return { scope: "period", field: "lockDate" };
  }
  if (path === "/academic-periods" && normalized.includes("parent academic period")) {
    return { scope: "period", field: "parentPeriodId" };
  }
  if (path === "/academic-periods" && normalized.includes("overlaps")) {
    return { scope: "period", field: "startDate" };
  }
  if (normalized.includes("start date") || normalized.includes("date debut")) {
    return path === "/academic-periods"
      ? { scope: "period", field: "startDate" }
      : { scope: "schoolYear", field: "startDate" };
  }
  if (normalized.includes("end date") || normalized.includes("date fin")) {
    return path === "/academic-periods"
      ? { scope: "period", field: "endDate" }
      : { scope: "schoolYear", field: "endDate" };
  }

  return null;
};

const parseError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(payload.message)) return payload.message.join(", ");
    if (typeof payload.message === "string") return payload.message;
    if (typeof payload.error === "string") return payload.error;
  } catch {
    // ignore
  }
  if (response.status >= 500 && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "Erreur API locale. Verifie que `pnpm dev:api` tourne puis redemarre `pnpm dev:web` pour recharger le proxy.";
  }
  return `Erreur HTTP ${response.status}`;
};

const triggerFileDownload = (fileName: string, dataUrl: string): void => {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.click();
};


const SCREEN_DEFS: ScreenDef[] = [
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
  { id: "mosque", label: "Mosquee", group: "principal", roles: ["ADMIN", "COMPTABLE"] },
  { id: "grades", label: "Notes & bulletins", group: "principal", roles: ["ADMIN", "SCOLARITE"] },
  { id: "schoolLifeOverview", label: "Pilotage", group: "vie", roles: ["ADMIN", "SCOLARITE"] },
  { id: "schoolLifeAttendance", label: "Absences", group: "vie", roles: ["ADMIN", "SCOLARITE"] },
  { id: "schoolLifeTimetable", label: "Emploi du temps", group: "vie", roles: ["ADMIN", "SCOLARITE"] },
  { id: "schoolLifeNotifications", label: "Notifications", group: "vie", roles: ["ADMIN", "SCOLARITE"] },
  { id: "teacherPortal", label: "Portail enseignant", group: "portail", roles: ["ENSEIGNANT"] },
  { id: "parentPortal", label: "Portail parent", group: "portail", roles: ["PARENT"] },
  { id: "studentPortal", label: "Portail eleve", group: "portail", roles: ["STUDENT"] }
];

const ACADEMIC_TRACK_OPTIONS: AcademicTrack[] = ["FRANCOPHONE", "ARABOPHONE"];
const SCHOOL_YEAR_STATUS_OPTIONS: SchoolYearStatus[] = ["DRAFT", "ACTIVE", "CLOSED"];
const REFERENCE_STATUS_OPTIONS: Array<"ACTIVE" | "INACTIVE"> = ["ACTIVE", "INACTIVE"];
const PERIOD_STATUS_OPTIONS: PeriodStatus[] = ["DRAFT", "ACTIVE", "CLOSED"];
const PERIOD_TYPE_OPTIONS = [
  { value: "TRIMESTER", label: "Trimestre" },
  { value: "SEMESTER", label: "Semestre" },
  { value: "BIMESTER", label: "Bimestre" },
  { value: "CUSTOM", label: "Decoupage libre" }
] as const;
const SUBJECT_NATURE_OPTIONS: SubjectNature[] = ["FRANCOPHONE", "ARABOPHONE"];
const TEACHING_MODE_OPTIONS = [
  { value: "PRESENTIAL", label: "Presentiel" },
  { value: "HYBRID", label: "Hybride" },
  { value: "REMOTE", label: "Distance" },
  { value: "BLENDED", label: "Mixte" }
] as const;

const ROLE_HOME_SCREEN: Record<Role, ScreenId> = {
  ADMIN: "dashboard",
  SCOLARITE: "dashboard",
  ENSEIGNANT: "teacherPortal",
  COMPTABLE: "finance",
  PARENT: "parentPortal",
  STUDENT: "studentPortal"
};

const ROLE_CONTEXT_LABELS: Record<Role, string> = {
  ADMIN: "Administration",
  SCOLARITE: "Scolarite",
  ENSEIGNANT: "Espace enseignant",
  COMPTABLE: "Espace comptable",
  PARENT: "Espace parent",
  STUDENT: "Espace eleve"
};

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  SCOLARITE: "Scolarite",
  ENSEIGNANT: "Portail enseignant",
  COMPTABLE: "Comptable",
  PARENT: "Portail parent",
  STUDENT: "Portail eleve"
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Ouverte",
  PARTIAL: "Partiellement reglee",
  PAID: "Soldee",
  VOID: "Annulee"
};

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Retard",
  EXCUSED: "Excuse"
};

const VALIDATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Validee",
  REJECTED: "Rejetee"
};

const PORTAL_NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  SCHEDULED: "Planifiee",
  SENT: "Envoyee",
  FAILED: "Echec",
  DELIVERED: "Livree",
  SENT_TO_PROVIDER: "Transmise",
  RETRYING: "Nouvelle tentative",
  UNDELIVERABLE: "Non distribuable"
};

const AUDIENCE_ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administration",
  SCOLARITE: "Scolarite",
  ENSEIGNANT: "Enseignants",
  COMPTABLE: "Comptabilite",
  PARENT: "Parents",
  STUDENT: "Eleves"
};

const MEMBER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif"
};

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  ENROLLED: "Inscrit",
  PENDING: "En attente",
  CANCELLED: "Annulee",
  COMPLETED: "Finalisee"
};

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche"
};

const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  read: "Lecture",
  create: "Creation",
  update: "Modification",
  delete: "Suppression",
  validate: "Validation",
  dispatch: "Envoi"
};

const PERMISSION_RESOURCE_LABELS: Record<PermissionResource, string> = {
  students: "Eleves",
  parents: "Parents",
  teachers: "Enseignants",
  rooms: "Salles",
  users: "Utilisateurs",
  teacherPortal: "Portail enseignant",
  parentPortal: "Portail parent",
  enrollments: "Inscriptions",
  reference: "Referentiel",
  finance: "Finance",
  payments: "Paiements",
  grades: "Notes",
  reportCards: "Bulletins",
  attendance: "Absences",
  attendanceAttachment: "Justificatifs",
  attendanceValidation: "Validation absences",
  timetable: "Emploi du temps",
  notifications: "Notifications",
  mosque: "Mosquee",
  analytics: "Analytique",
  audit: "Audit"
};

const hasScreenAccess = (role: Role, screen: ScreenId): boolean =>
  SCREEN_DEFS.some((entry) => entry.id === screen && entry.roles.includes(role));

const ROLE_VALUES: Role[] = ["ADMIN", "SCOLARITE", "ENSEIGNANT", "COMPTABLE", "PARENT", "STUDENT"];
const ACCOUNT_TYPE_VALUES: AccountType[] = ["STAFF", "TEACHER", "PARENT", "STUDENT"];
const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  STAFF: "Staff interne",
  TEACHER: "Enseignant",
  PARENT: "Parent",
  STUDENT: "Eleve"
};
const ACCOUNT_TYPE_ROLE_OPTIONS: Record<AccountType, Role[]> = {
  STAFF: ["ADMIN", "SCOLARITE", "COMPTABLE"],
  TEACHER: ["ENSEIGNANT"],
  PARENT: ["PARENT"],
  STUDENT: ["STUDENT"]
};
const PASSWORD_MODE_LABELS: Record<PasswordMode, string> = {
  AUTO: "Mot de passe temporaire auto",
  MANUAL: "Saisie manuelle"
};
const PERMISSION_RESOURCE_VALUES: PermissionResource[] = [
  "students",
  "parents",
  "teachers",
  "rooms",
  "users",
  "teacherPortal",
  "parentPortal",
  "enrollments",
  "reference",
  "finance",
  "payments",
  "grades",
  "reportCards",
  "attendance",
  "attendanceAttachment",
  "attendanceValidation",
  "timetable",
  "notifications",
  "mosque",
  "analytics",
  "audit"
];
const PERMISSION_ACTION_VALUES: PermissionAction[] = [
  "read",
  "create",
  "update",
  "delete",
  "validate",
  "dispatch"
];

const MODULE_TILES: ModuleTile[] = [
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
    screen: "mosque",
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

const HERO_SLIDES: HeroSlide[] = [
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

const decorateResponsiveTables = (root: ParentNode): void => {
  const tables = root.querySelectorAll<HTMLTableElement>(".table-wrap table");

  tables.forEach((table) => {
    const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).map((header) =>
      header.textContent?.replace(/\s+/g, " ").trim() || ""
    );

    table.dataset.responsiveTable = "true";

    table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        if (!(cell instanceof HTMLTableCellElement)) return;
        if (cell.colSpan > 1) {
          cell.removeAttribute("data-label");
          return;
        }

        const label = headers[index];
        if (label) {
          cell.dataset.label = label;
        } else {
          cell.removeAttribute("data-label");
        }
      });
    });
  });
};

export function App(): JSX.Element {
  const [tab, setTab] = useState<ScreenId>("dashboard");
  const appRootRef = useRef<HTMLElement | null>(null);
  const rememberedLogin = useMemo(() => readRememberedLogin(DEFAULT_TENANT), []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readThemePreference());
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(() => readLanguagePreference());
  const [themeFlipTarget, setThemeFlipTarget] = useState<ThemeMode | null>(null);
  const [languageFlipTarget, setLanguageFlipTarget] = useState<UiLanguage | null>(null);
  const currentLanguageMeta = UI_LANGUAGE_META[uiLanguage];
  const [mobileTasksOpen, setMobileTasksOpen] = useState(false);
  const [headerNotificationCount, setHeaderNotificationCount] = useState(0);
  const themeFlipTimeoutRef = useRef<number | null>(null);
  const languageFlipTimeoutRef = useRef<number | null>(null);

  useDomTranslation(appRootRef, uiLanguage);

  const [loginForm, setLoginForm] = useState({
    username: rememberedLogin?.username || "",
    password: "",
    tenantId: rememberedLogin?.tenantId || DEFAULT_TENANT
  });
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [rememberMe, setRememberMe] = useState(Boolean(rememberedLogin?.remember));
  const [authAssistMode, setAuthAssistMode] = useState<"none" | "forgot" | "first">("none");
  const [authAssistLoading, setAuthAssistLoading] = useState(false);
  const [forgotPasswordForm, setForgotPasswordForm] = useState({
    username: rememberedLogin?.username || "",
    tenantId: rememberedLogin?.tenantId || DEFAULT_TENANT
  });
  const [resetPasswordForm, setResetPasswordForm] = useState({
    token: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [firstConnectionForm, setFirstConnectionForm] = useState({
    username: rememberedLogin?.username || "",
    tenantId: rememberedLogin?.tenantId || DEFAULT_TENANT,
    temporaryPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState({
    matricule: "",
    firstName: "",
    lastName: "",
    sex: "M" as "M" | "F",
    birthDate: "",
    birthPlace: "",
    nationality: "",
    address: "",
    phone: "",
    email: "",
    establishmentId: "",
    admissionDate: "",
    internalId: "",
    birthCertificateNo: "",
    specialNeeds: "",
    primaryLanguage: "",
    status: "ACTIVE",
    administrativeNotes: ""
  });

  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);

  const [levelCycleFilter, setLevelCycleFilter] = useState("");
  const [classYearFilter, setClassYearFilter] = useState("");
  const [classLevelFilter, setClassLevelFilter] = useState("");
  const [periodYearFilter, setPeriodYearFilter] = useState("");
  const [subjectCycleScope, setSubjectCycleScope] = useState("");

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentFilters, setEnrollmentFilters] = useState({
    schoolYearId: "",
    classId: "",
    studentId: "",
    track: ""
  });
  const [enrollmentForm, setEnrollmentForm] = useState({
    schoolYearId: "",
    classId: "",
    studentId: "",
    track: "FRANCOPHONE" as AcademicTrack,
    enrollmentDate: today(),
    enrollmentStatus: "ENROLLED"
  });

  const [syForm, setSyForm] = useState({
    code: "",
    label: "",
    startDate: "",
    endDate: "",
    status: "DRAFT" as SchoolYearStatus,
    previousYearId: "",
    isDefault: false,
    sortOrder: "",
    comment: ""
  });
  const [cycleForm, setCycleForm] = useState({
    schoolYearId: "",
    code: "",
    label: "",
    academicStage: "PRIMARY" as AcademicStage,
    sortOrder: 1,
    description: "",
    theoreticalAgeMin: "",
    theoreticalAgeMax: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE"
  });
  const [levelForm, setLevelForm] = useState({
    cycleId: "",
    code: "",
    label: "",
    sortOrder: 1,
    track: "FRANCOPHONE" as AcademicTrack,
    alias: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    theoreticalAge: "",
    description: "",
    defaultSection: ""
  });
  const [classForm, setClassForm] = useState({
    schoolYearId: "",
    levelId: "",
    code: "",
    label: "",
    capacity: "",
    track: "FRANCOPHONE" as AcademicTrack,
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    homeroomTeacherName: "",
    mainRoom: "",
    actualCapacity: "",
    filiere: "",
    series: "",
    speciality: "",
    description: "",
    teachingMode: "PRESENTIAL"
  });
  const [subjectForm, setSubjectForm] = useState({
    code: "",
    label: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    nature: "FRANCOPHONE" as SubjectNature,
    shortLabel: "",
    defaultCoefficient: "",
    category: "",
    description: "",
    color: "#16a34a",
    weeklyHours: "",
    isGraded: true,
    isOptional: false,
    levelIds: [] as string[]
  });
  const [periodForm, setPeriodForm] = useState({
    schoolYearId: "",
    code: "",
    label: "",
    startDate: "",
    endDate: "",
    periodType: "TRIMESTER",
    sortOrder: 1,
    status: "ACTIVE" as PeriodStatus,
    parentPeriodId: "",
    isGradeEntryOpen: false,
    gradeEntryDeadline: "",
    lockDate: "",
    comment: ""
  });

  const [feePlans, setFeePlans] = useState<FeePlan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [recovery, setRecovery] = useState<RecoveryDashboard | null>(null);

  const [feePlanForm, setFeePlanForm] = useState({
    schoolYearId: "",
    levelId: "",
    label: "",
    totalAmount: "",
      currency: DEFAULT_CURRENCY
  });
  const [invoiceForm, setInvoiceForm] = useState({
    studentId: "",
    schoolYearId: "",
    feePlanId: "",
    amountDue: "",
    dueDate: ""
  });
  const [paymentForm, setPaymentForm] = useState({
    invoiceId: "",
    paidAmount: "",
    paymentMethod: "CASH",
    referenceExternal: ""
  });

  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [gradeFilters, setGradeFilters] = useState({
    classId: "",
    subjectId: "",
    academicPeriodId: "",
    studentId: ""
  });
  const [gradeForm, setGradeForm] = useState({
    studentId: "",
    classId: "",
    subjectId: "",
    academicPeriodId: "",
    assessmentLabel: "Devoir 1",
    assessmentType: "DEVOIR",
    score: "",
    scoreMax: "20"
  });
  const [classSummary, setClassSummary] = useState<ClassSummary | null>(null);
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [reportForm, setReportForm] = useState({
    studentId: "",
    classId: "",
    academicPeriodId: ""
  });
  const [receiptPdfUrl, setReceiptPdfUrl] = useState("");
  const [reportPdfUrl, setReportPdfUrl] = useState("");
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [accountTeachers, setAccountTeachers] = useState<TeacherRecord[]>([]);
  const [accountParents, setAccountParents] = useState<ParentRecord[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    username: "",
    email: "",
    phone: "",
    passwordMode: "AUTO" as PasswordMode,
    password: "",
    confirmPassword: "",
    accountType: "STAFF" as AccountType,
    roleId: "SCOLARITE" as Role,
    teacherId: "",
    parentId: "",
    studentId: "",
    autoFillIdentity: true,
    staffDisplayName: "",
    staffFunction: "",
    department: "",
    displayName: "",
    avatarUrl: "",
    establishmentId: "",
    notes: "",
    mustChangePasswordAtFirstLogin: true,
    isActive: true
  });
  const [lastTemporaryPassword, setLastTemporaryPassword] = useState("");
  const [rolePermissionTarget, setRolePermissionTarget] = useState<Role>("ADMIN");
  const [rolePermissions, setRolePermissions] = useState<RolePermissionView[]>([]);

  const [teacherOverview, setTeacherOverview] = useState<TeacherOverview | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [teacherStudents, setTeacherStudents] = useState<TeacherStudent[]>([]);
  const [teacherGrades, setTeacherGrades] = useState<GradeEntry[]>([]);
  const [teacherTimetable, setTeacherTimetable] = useState<
    Array<{
      id: string;
      classId: string;
      classLabel?: string;
      schoolYearId: string;
      schoolYearCode?: string;
      track: AcademicTrack;
      rotationGroup?: "GROUP_A" | "GROUP_B";
      subjectId: string;
      subjectLabel?: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      room?: string;
      teacherName?: string;
    }>
  >([]);
  const [teacherNotifications, setTeacherNotifications] = useState<PortalNotification[]>([]);
  const [teacherPortalFilters, setTeacherPortalFilters] = useState({
    classId: "",
    subjectId: "",
    academicPeriodId: "",
    studentId: ""
  });
  const [teacherGradeForm, setTeacherGradeForm] = useState({
    studentId: "",
    classId: "",
    subjectId: "",
    academicPeriodId: "",
    assessmentLabel: "Devoir 1",
    assessmentType: "DEVOIR",
    score: "",
    scoreMax: "20",
    comment: ""
  });
  const [teacherAttendanceForm, setTeacherAttendanceForm] = useState({
    classId: "",
    attendanceDate: today(),
    defaultStatus: "PRESENT",
    reason: ""
  });
  const [teacherAttendanceStudents, setTeacherAttendanceStudents] = useState<string[]>([]);
  const [teacherNotificationForm, setTeacherNotificationForm] = useState({
    classId: "",
    studentId: "",
    title: "",
    message: "",
    channel: "IN_APP"
  });

  const [parentOverview, setParentOverview] = useState<ParentOverview | null>(null);
  const [parentChildren, setParentChildren] = useState<ParentChild[]>([]);
  const [parentGrades, setParentGrades] = useState<
    Array<
      GradeEntry & {
        classLabel?: string;
        periodLabel?: string;
      }
    >
  >([]);
  const [parentReportCards, setParentReportCards] = useState<ReportCard[]>([]);
  const [parentAttendance, setParentAttendance] = useState<
    Array<{
      id: string;
      studentId: string;
      studentName?: string;
      classId: string;
      classLabel?: string;
      placementId?: string;
      track: AcademicTrack;
      attendanceDate: string;
      status: string;
      reason?: string;
      justificationStatus: string;
    }>
  >([]);
  const [parentInvoices, setParentInvoices] = useState<Invoice[]>([]);
  const [parentPayments, setParentPayments] = useState<PaymentRecord[]>([]);
  const [parentTimetable, setParentTimetable] = useState<
    Array<{
      slotId: string;
      studentId: string;
      studentName: string;
      classId: string;
      classLabel: string;
      schoolYearId: string;
      schoolYearCode?: string;
      placementId?: string;
      track: AcademicTrack;
      rotationGroup?: "GROUP_A" | "GROUP_B";
      subjectLabel: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      room?: string;
      teacherName?: string;
    }>
  >([]);
  const [parentNotifications, setParentNotifications] = useState<PortalNotification[]>([]);
  const [parentStudentFilter, setParentStudentFilter] = useState("");

  const [mosqueDashboard, setMosqueDashboard] = useState<MosqueDashboard | null>(null);
  const [mosqueMembers, setMosqueMembers] = useState<MosqueMember[]>([]);
  const [mosqueActivities, setMosqueActivities] = useState<MosqueActivity[]>([]);
  const [mosqueDonations, setMosqueDonations] = useState<MosqueDonation[]>([]);
  const [mosqueMemberFilters, setMosqueMemberFilters] = useState({ status: "", q: "" });
  const [mosqueActivityFilters, setMosqueActivityFilters] = useState({
    category: "",
    from: "",
    to: "",
    q: ""
  });
  const [mosqueDonationFilters, setMosqueDonationFilters] = useState({
    memberId: "",
    channel: "",
    from: "",
    to: ""
  });
  const [mosqueMemberForm, setMosqueMemberForm] = useState({
    memberCode: "",
    fullName: "",
    sex: "",
    phone: "",
    email: "",
    address: "",
    joinedAt: "",
    status: "ACTIVE"
  });
  const [mosqueActivityForm, setMosqueActivityForm] = useState({
    code: "",
    title: "",
    activityDate: today(),
    category: "JUMUAH",
    location: "",
    description: "",
    isSchoolLinked: false
  });
  const [mosqueDonationForm, setMosqueDonationForm] = useState({
    memberId: "",
    amount: "",
    currency: DEFAULT_CURRENCY,
    channel: "CASH",
    donatedAt: `${today()}T08:00`,
    referenceNo: "",
    notes: ""
  });
  const [mosqueExportFormat, setMosqueExportFormat] = useState<"PDF" | "EXCEL">("PDF");
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(null);
  const [analyticsFilters, setAnalyticsFilters] = useState({
    from: "",
    to: "",
    schoolYearId: ""
  });
  const [auditLogs, setAuditLogs] = useState<AuditLogPage | null>(null);
  const [auditFilters, setAuditFilters] = useState({
    resource: "",
    action: "",
    userId: "",
    q: "",
    from: "",
    to: "",
    page: 1,
    pageSize: 20
  });
  const [auditExportFormat, setAuditExportFormat] = useState<"PDF" | "EXCEL">("PDF");
  const analyticsFiltersRef = useRef(analyticsFilters);
  const auditFiltersRef = useRef(auditFilters);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [moduleQueryInput, setModuleQueryInput] = useState("");
  const [moduleQuery, setModuleQuery] = useState("");
  const [studentWorkflowStep, setStudentWorkflowStep] = useState("entry");
  const [referenceWorkflowStep, setReferenceWorkflowStep] = useState("years");
  const [enrollmentWorkflowStep, setEnrollmentWorkflowStep] = useState("create");
  const [financeWorkflowStep, setFinanceWorkflowStep] = useState("overview");
  const [gradesWorkflowStep, setGradesWorkflowStep] = useState("filters");
  const [iamWorkflowStep, setIamWorkflowStep] = useState("accounts");
  const [mosqueWorkflowStep, setMosqueWorkflowStep] = useState("members");
  const [reportWorkflowStep, setReportWorkflowStep] = useState("overview");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const [loginErrors, setLoginErrors] = useState<FieldErrors>({});
  const [studentErrors, setStudentErrors] = useState<FieldErrors>({});
  const [enrollmentErrors, setEnrollmentErrors] = useState<FieldErrors>({});
  const [feePlanErrors, setFeePlanErrors] = useState<FieldErrors>({});
  const [invoiceErrors, setInvoiceErrors] = useState<FieldErrors>({});
  const [paymentErrors, setPaymentErrors] = useState<FieldErrors>({});
  const [gradeErrors, setGradeErrors] = useState<FieldErrors>({});
  const [reportErrors, setReportErrors] = useState<FieldErrors>({});
  const [schoolYearErrors, setSchoolYearErrors] = useState<FieldErrors>({});
  const [cycleErrors, setCycleErrors] = useState<FieldErrors>({});
  const [levelErrors, setLevelErrors] = useState<FieldErrors>({});
  const [classErrors, setClassErrors] = useState<FieldErrors>({});
  const [subjectErrors, setSubjectErrors] = useState<FieldErrors>({});
  const [periodErrors, setPeriodErrors] = useState<FieldErrors>({});
  const [userErrors, setUserErrors] = useState<FieldErrors>({});
  const [teacherPortalErrors, setTeacherPortalErrors] = useState<FieldErrors>({});
  const [mosqueMemberErrors, setMosqueMemberErrors] = useState<FieldErrors>({});
  const [mosqueActivityErrors, setMosqueActivityErrors] = useState<FieldErrors>({});
  const [mosqueDonationErrors, setMosqueDonationErrors] = useState<FieldErrors>({});
  const clearData = useCallback(() => {
    setStudents([]);
    setSchoolYears([]);
    setCycles([]);
    setLevels([]);
    setClasses([]);
    setSubjects([]);
    setPeriods([]);
    setEnrollments([]);
    setFeePlans([]);
    setInvoices([]);
    setPayments([]);
    setRecovery(null);
    setGrades([]);
    setClassSummary(null);
    setReportCards([]);
    setReceiptPdfUrl("");
    setReportPdfUrl("");
    setUsers([]);
    setAccountTeachers([]);
    setAccountParents([]);
    setRolePermissions([]);
    setTeacherOverview(null);
    setTeacherClasses([]);
    setTeacherStudents([]);
    setTeacherGrades([]);
    setTeacherTimetable([]);
    setTeacherNotifications([]);
    setParentOverview(null);
    setParentChildren([]);
    setParentGrades([]);
    setParentReportCards([]);
    setParentAttendance([]);
    setParentInvoices([]);
    setParentPayments([]);
    setParentTimetable([]);
    setParentNotifications([]);
    setMosqueDashboard(null);
    setMosqueMembers([]);
    setMosqueActivities([]);
    setMosqueDonations([]);
    setMosqueExportFormat("PDF");
    setAnalyticsOverview(null);
    setAuditLogs(null);
    setAuditExportFormat("PDF");
    setReportWorkflowStep("overview");
    setHeaderNotificationCount(0);
    setLastSyncAt(null);
    setModuleQueryInput("");
    setModuleQuery("");
  }, []);
  const handleAuthClearData = useCallback(() => {
    clearData();
  }, [clearData]);
  const handleAuthRefreshSuccess = useCallback(() => {
    setLastSyncAt(new Date().toISOString());
  }, []);
  const {
    api,
    apiConnection,
    clearSession,
    ensureApiAvailable,
    markApiAvailable,
    markApiUnavailable,
    resolveApiUrl,
    saveSession,
    session,
    sessionRef
  } = useAuthSession({
    apiBaseUrls: API_BASE_URLS,
    onAuthError: setError,
    onClearData: handleAuthClearData,
    onRefreshNotice: setNotice,
    onRefreshSuccess: handleAuthRefreshSuccess
  });
  const bootstrapSessionKeyRef = useRef<string | null>(null);
  const bootstrapSessionInFlightRef = useRef<string | null>(null);

  useEffect(() => {
    const root = appRootRef.current;
    if (!root) return;

    decorateResponsiveTables(root);

    const observer = new MutationObserver(() => {
      decorateResponsiveTables(root);
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return () => observer.disconnect();
  }, [session, tab, uiLanguage]);

  const enterPreview = useCallback(() => {
    if (!PREVIEW_MODE_ENABLED) {
      setError("Le mode apercu local est desactive en production.");
      return;
    }

    const nowIso = new Date().toISOString();
    const previewSchoolYearId = "preview-sy-2025";
    const previewCyclePrimaryId = "preview-cycle-primary";
    const previewCycleSecondaryId = "preview-cycle-secondary";
    const previewLevelPrimaryId = "preview-level-cm2";
    const previewLevelSecondaryId = "preview-level-6e";
    const previewClassPrimaryId = "preview-class-cm2a";
    const previewClassSecondaryId = "preview-class-6ea";
    const previewPeriodId = "preview-period-t1";
    const previewStudentAId = "preview-student-a";
    const previewStudentBId = "preview-student-b";

    clearData();

    setSchoolYears([
      {
        id: previewSchoolYearId,
        code: "AS-2025-2026",
        label: "2025-2026",
        startDate: "2025-09-01",
        endDate: "2026-06-30",
        status: "ACTIVE",
        isActive: true,
        isDefault: true,
        sortOrder: 2025,
        comment: "Annee de reference v2"
      }
    ]);
    setCycles([
      {
        id: previewCyclePrimaryId,
        schoolYearId: previewSchoolYearId,
        code: "PRIM",
        label: "Cycle primaire",
        academicStage: "PRIMARY",
        sortOrder: 1,
        status: "ACTIVE",
        theoreticalAgeMin: 6,
        theoreticalAgeMax: 11
      },
      {
        id: previewCycleSecondaryId,
        schoolYearId: previewSchoolYearId,
        code: "SEC",
        label: "Cycle secondaire",
        academicStage: "SECONDARY",
        sortOrder: 2,
        status: "ACTIVE",
        theoreticalAgeMin: 12,
        theoreticalAgeMax: 18
      }
    ]);
    setLevels([
      {
        id: previewLevelPrimaryId,
        cycleId: previewCyclePrimaryId,
        code: "CM2",
        label: "CM2",
        alias: "CM2",
        track: "FRANCOPHONE",
        sortOrder: 5,
        status: "ACTIVE",
        theoreticalAge: 10,
        defaultSection: "General"
      },
      {
        id: previewLevelSecondaryId,
        cycleId: previewCycleSecondaryId,
        code: "6E",
        label: "6e",
        alias: "6e",
        track: "FRANCOPHONE",
        sortOrder: 1,
        status: "ACTIVE",
        theoreticalAge: 11,
        defaultSection: "College"
      }
    ]);
    setClasses([
      {
        id: previewClassPrimaryId,
        schoolYearId: previewSchoolYearId,
        levelId: previewLevelPrimaryId,
        code: "CM2-A",
        label: "CM2 A",
        track: "FRANCOPHONE",
        capacity: 32,
        status: "ACTIVE",
        homeroomTeacherName: "Mme Traore",
        mainRoom: "Salle P-02",
        actualCapacity: 30,
        description: "Classe de fin de primaire",
        teachingMode: "PRESENTIAL"
      },
      {
        id: previewClassSecondaryId,
        schoolYearId: previewSchoolYearId,
        levelId: previewLevelSecondaryId,
        code: "6E-A",
        label: "6e A",
        track: "FRANCOPHONE",
        capacity: 35,
        status: "ACTIVE",
        homeroomTeacherName: "M. Bah",
        mainRoom: "Salle C-06",
        actualCapacity: 33,
        description: "Classe d'entree au college",
        teachingMode: "PRESENTIAL"
      }
    ]);
    setSubjects([
      {
        id: "preview-subject-math",
        code: "MATH",
        label: "Mathematiques",
        isArabic: false,
        status: "ACTIVE",
        nature: "FRANCOPHONE",
        shortLabel: "Maths",
        defaultCoefficient: 4,
        category: "Scientifique",
        color: "#0f766e",
        weeklyHours: 5,
        isGraded: true,
        isOptional: false,
        levelIds: [previewLevelPrimaryId, previewLevelSecondaryId]
      },
      {
        id: "preview-subject-fr",
        code: "FR",
        label: "Francais",
        isArabic: false,
        status: "ACTIVE",
        nature: "FRANCOPHONE",
        shortLabel: "Francais",
        defaultCoefficient: 3,
        category: "Langues",
        color: "#2563eb",
        weeklyHours: 4,
        isGraded: true,
        isOptional: false,
        levelIds: [previewLevelPrimaryId, previewLevelSecondaryId]
      },
      {
        id: "preview-subject-ar",
        code: "AR",
        label: "Arabe",
        isArabic: true,
        status: "ACTIVE",
        nature: "ARABOPHONE",
        shortLabel: "Arabe",
        defaultCoefficient: 3,
        category: "Langues",
        color: "#7c3aed",
        weeklyHours: 4,
        isGraded: true,
        isOptional: false,
        levelIds: [previewLevelPrimaryId, previewLevelSecondaryId]
      }
    ]);
    setPeriods([
      {
        id: previewPeriodId,
        schoolYearId: previewSchoolYearId,
        code: "T1",
        label: "Trimestre 1",
        startDate: "2025-09-01",
        endDate: "2025-12-20",
        periodType: "TRIMESTER",
        sortOrder: 1,
        status: "ACTIVE",
        isGradeEntryOpen: true,
        gradeEntryDeadline: "2025-12-15",
        lockDate: "2025-12-20"
      }
    ]);
    setStudents([
      {
        id: previewStudentAId,
        matricule: "GS-2025-001",
        firstName: "Aicha",
        lastName: "Diallo",
        sex: "F",
        birthDate: "2014-05-12"
      },
      {
        id: previewStudentBId,
        matricule: "GS-2025-002",
        firstName: "Moussa",
        lastName: "Traore",
        sex: "M",
        birthDate: "2013-11-03"
      },
      {
        id: "preview-student-c",
        matricule: "GS-2025-003",
        firstName: "Khadija",
        lastName: "Sow",
        sex: "F",
        birthDate: "2015-02-21"
      }
    ]);
    setEnrollments([
      {
        id: "preview-enrollment-a",
        schoolYearId: previewSchoolYearId,
        classId: previewClassPrimaryId,
        studentId: previewStudentAId,
        track: "FRANCOPHONE",
        enrollmentDate: "2025-09-12",
        enrollmentStatus: "ENROLLED",
        studentName: "Aicha Diallo",
        classLabel: "CM2 A",
        schoolYearCode: "2025-2026"
      },
      {
        id: "preview-enrollment-b",
        schoolYearId: previewSchoolYearId,
        classId: previewClassSecondaryId,
        studentId: previewStudentBId,
        track: "FRANCOPHONE",
        enrollmentDate: "2025-09-12",
        enrollmentStatus: "ENROLLED",
        studentName: "Moussa Traore",
        classLabel: "6e A",
        schoolYearCode: "2025-2026"
      }
    ]);
    setFeePlans([
      {
        id: "preview-fee-cm2",
        schoolYearId: previewSchoolYearId,
        levelId: previewLevelPrimaryId,
        label: "Frais CM2",
        totalAmount: 185000,
        currency: DEFAULT_CURRENCY
      },
      {
        id: "preview-fee-6e",
        schoolYearId: previewSchoolYearId,
        levelId: previewLevelSecondaryId,
        label: "Frais 6e",
        totalAmount: 240000,
        currency: DEFAULT_CURRENCY
      }
    ]);
    setInvoices([
      {
        id: "preview-invoice-a",
        studentId: previewStudentAId,
        schoolYearId: previewSchoolYearId,
        feePlanId: "preview-fee-cm2",
        invoiceNo: "FAC-001",
        amountDue: 185000,
        amountPaid: 100000,
        remainingAmount: 85000,
        status: "PARTIAL",
        dueDate: "2025-10-10",
        studentName: "Aicha Diallo",
        schoolYearCode: "2025-2026",
        feePlanLabel: "Frais CM2",
        primaryTrack: "FRANCOPHONE",
        primaryClassId: previewClassPrimaryId,
        primaryClassLabel: "CM2 A",
        primaryLevelId: previewLevelPrimaryId,
        primaryLevelLabel: "CM2"
      },
      {
        id: "preview-invoice-b",
        studentId: previewStudentBId,
        schoolYearId: previewSchoolYearId,
        feePlanId: "preview-fee-6e",
        invoiceNo: "FAC-002",
        amountDue: 240000,
        amountPaid: 240000,
        remainingAmount: 0,
        status: "PAID",
        dueDate: "2025-10-12",
        studentName: "Moussa Traore",
        schoolYearCode: "2025-2026",
        feePlanLabel: "Frais 6e",
        primaryTrack: "FRANCOPHONE",
        primaryClassId: previewClassSecondaryId,
        primaryClassLabel: "6e A",
        primaryLevelId: previewLevelSecondaryId,
        primaryLevelLabel: "6e"
      }
    ]);
    setPayments([
      {
        id: "preview-payment-a",
        invoiceId: "preview-invoice-a",
        invoiceNo: "FAC-001",
        studentId: previewStudentAId,
        studentName: "Aicha Diallo",
        schoolYearId: previewSchoolYearId,
        receiptNo: "REC-001",
        paidAmount: 100000,
        paymentMethod: "MOBILE_MONEY",
        paidAt: nowIso,
        referenceExternal: "OM-9981"
      },
      {
        id: "preview-payment-b",
        invoiceId: "preview-invoice-b",
        invoiceNo: "FAC-002",
        studentId: previewStudentBId,
        studentName: "Moussa Traore",
        schoolYearId: previewSchoolYearId,
        receiptNo: "REC-002",
        paidAmount: 240000,
        paymentMethod: "BANK",
        paidAt: nowIso
      }
    ]);
    setRecovery({
      totals: {
        amountDue: 425000,
        amountPaid: 340000,
        remainingAmount: 85000,
        recoveryRatePercent: 80
      },
      invoices: {
        total: 2,
        open: 0,
        partial: 1,
        paid: 1,
        void: 0
      }
    });
    setGrades([
      {
        id: "preview-grade-a",
        studentId: previewStudentAId,
        studentName: "Aicha Diallo",
        classId: previewClassPrimaryId,
        track: "FRANCOPHONE",
        subjectId: "preview-subject-math",
        subjectLabel: "Mathematiques",
        academicPeriodId: previewPeriodId,
        assessmentLabel: "Devoir 1",
        assessmentType: "DEVOIR",
        score: 16,
        scoreMax: 20,
        absent: false
      },
      {
        id: "preview-grade-b",
        studentId: previewStudentBId,
        studentName: "Moussa Traore",
        classId: previewClassSecondaryId,
        track: "FRANCOPHONE",
        subjectId: "preview-subject-fr",
        subjectLabel: "Francais",
        academicPeriodId: previewPeriodId,
        assessmentLabel: "Composition 1",
        assessmentType: "COMPOSITION",
        score: 14,
        scoreMax: 20,
        absent: false
      }
    ]);
    setReportCards([
      {
        id: "preview-report-a",
        studentId: previewStudentAId,
        classId: previewClassPrimaryId,
        track: "FRANCOPHONE",
        mode: "TRACK_SINGLE",
        academicPeriodId: previewPeriodId,
        averageGeneral: 15.8,
        classRank: 3,
        appreciation: "Bon travail",
        studentName: "Aicha Diallo",
        classLabel: "CM2 A",
        periodLabel: "Trimestre 1"
      },
      {
        id: "preview-report-b",
        studentId: previewStudentBId,
        classId: previewClassSecondaryId,
        track: "FRANCOPHONE",
        mode: "TRACK_SINGLE",
        academicPeriodId: previewPeriodId,
        averageGeneral: 13.9,
        classRank: 7,
        appreciation: "En progression",
        studentName: "Moussa Traore",
        classLabel: "6e A",
        periodLabel: "Trimestre 1"
      }
    ]);
    setUsers([
      {
        id: "preview-user-admin",
        tenantId: DEFAULT_TENANT,
        username: "admin.preview",
        role: "ADMIN",
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: "preview-user-scolarite",
        tenantId: DEFAULT_TENANT,
        username: "scolarite.preview",
        role: "SCOLARITE",
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: "preview-user-comptable",
        tenantId: DEFAULT_TENANT,
        username: "comptable.preview",
        role: "COMPTABLE",
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso
      }
    ]);
    setRolePermissions([
      { role: "ADMIN", resource: "students", action: "read", allowed: true, source: "CUSTOM" },
      { role: "ADMIN", resource: "finance", action: "read", allowed: true, source: "CUSTOM" },
      { role: "ADMIN", resource: "grades", action: "read", allowed: true, source: "CUSTOM" },
      { role: "ADMIN", resource: "audit", action: "read", allowed: true, source: "CUSTOM" }
    ]);
    setMosqueDashboard({
      totals: {
        members: 128,
        activeMembers: 109,
        activitiesThisMonth: 5,
        donationsThisMonth: 425000,
        donationsTotal: 3280000,
        averageDonation: 26500
      },
      donationsByChannel: [
        { channel: "CASH", count: 18, totalAmount: 240000 },
        { channel: "MOBILE_MONEY", count: 7, totalAmount: 185000 }
      ]
    });
    setMosqueMembers([
      {
        id: "preview-member-a",
        tenantId: DEFAULT_TENANT,
        memberCode: "MOSQ-001",
        fullName: "Omar Bah",
        sex: "M",
        phone: "+221770000000",
        status: "ACTIVE"
      }
    ]);
    setMosqueActivities([
      {
        id: "preview-activity-a",
        tenantId: DEFAULT_TENANT,
        code: "ACT-001",
        title: "Cours de memorisation",
        activityDate: "2026-04-03",
        category: "EDUCATION",
        location: "Salle polyvalente",
        description: "Session d'accompagnement hebdomadaire.",
        isSchoolLinked: true
      }
    ]);
    setMosqueDonations([
      {
        id: "preview-donation-a",
        tenantId: DEFAULT_TENANT,
        memberId: "preview-member-a",
        memberCode: "MOSQ-001",
        memberName: "Omar Bah",
        amount: 50000,
        currency: DEFAULT_CURRENCY,
        channel: "CASH",
        donatedAt: nowIso,
        referenceNo: "DON-001"
      }
    ]);
    setAnalyticsOverview({
      generatedAt: nowIso,
      window: { from: "2026-03-01", to: "2026-03-31", days: 31 },
      students: { total: 312, active: 304, createdInWindow: 18 },
      academics: { schoolYears: 1, classes: 12, subjects: 14, activeEnrollments: 298 },
      finance: {
        amountDue: 14800000,
        amountPaid: 11850000,
        remainingAmount: 2950000,
        recoveryRatePercent: 80.1,
        paymentsInWindow: 84,
        overdueInvoices: 11
      },
      schoolLife: {
        attendanceEntries: 640,
        absences: 19,
        justifiedAbsences: 11,
        justificationRatePercent: 57.9,
        notificationsQueued: 6,
        notificationsFailed: 1
      },
      mosque: {
        members: 128,
        activeMembers: 109,
        activitiesInWindow: 5,
        donationsInWindow: 425000,
        donationsCountInWindow: 25
      },
      trends: {
        payments: [
          { bucket: "S1", label: "Semaine 1", value: 2100000 },
          { bucket: "S2", label: "Semaine 2", value: 3400000 },
          { bucket: "S3", label: "Semaine 3", value: 2800000 },
          { bucket: "S4", label: "Semaine 4", value: 3550000 }
        ],
        donations: [
          { bucket: "S1", label: "Semaine 1", value: 70000 },
          { bucket: "S2", label: "Semaine 2", value: 110000 },
          { bucket: "S3", label: "Semaine 3", value: 90000 },
          { bucket: "S4", label: "Semaine 4", value: 155000 }
        ],
        absences: [
          { bucket: "S1", label: "Semaine 1", value: 6 },
          { bucket: "S2", label: "Semaine 2", value: 4 },
          { bucket: "S3", label: "Semaine 3", value: 5 },
          { bucket: "S4", label: "Semaine 4", value: 4 }
        ]
      }
    });
    setAuditLogs({
      page: 1,
      pageSize: 20,
      total: 3,
      totalPages: 1,
      items: [
        {
          id: "preview-audit-1",
          createdAt: nowIso,
          action: "CREATE",
          resource: "students",
          resourceId: previewStudentAId,
          username: "admin.preview",
          payloadPreview: "Creation d'un nouveau dossier eleve"
        },
        {
          id: "preview-audit-2",
          createdAt: nowIso,
          action: "UPDATE",
          resource: "finance",
          resourceId: "preview-invoice-a",
          username: "comptable.preview",
          payloadPreview: "Paiement partiel enregistre"
        },
        {
          id: "preview-audit-3",
          createdAt: nowIso,
          action: "PUBLISH",
          resource: "reportCards",
          resourceId: "preview-report-a",
          username: "scolarite.preview",
          payloadPreview: "Bulletin du trimestre publie"
        }
      ]
    });

    saveSession({
      accessToken: PREVIEW_ACCESS_TOKEN,
      refreshToken: PREVIEW_ACCESS_TOKEN,
      user: {
        username: "preview.admin",
        role: "ADMIN",
        tenantId: DEFAULT_TENANT
      },
      tenantId: DEFAULT_TENANT
    });
    markApiAvailable();
    setHeaderNotificationCount(6);
    setLastSyncAt(nowIso);
    setTab("dashboard");
    setError(null);
    setNotice("Mode apercu local active : donnees de demonstration non persistees.");
  }, [clearData, markApiAvailable, saveSession]);

  const currentRole = (session?.user.role as Role | undefined) || null;
  const isPreviewSession = PREVIEW_MODE_ENABLED && session?.accessToken === PREVIEW_ACCESS_TOKEN;
  const currentRoleLabel = currentRole ? formatRoleLabel(currentRole) : "Visiteur";
  const apiAvailable = apiConnection.status === "online";
  const apiStatusText =
    isPreviewSession
      ? "Mode apercu local - donnees demo non persistees"
      : apiConnection.status === "checking"
      ? "Connexion a l'API..."
      : apiConnection.status === "online"
        ? "API disponible"
        : apiConnection.status === "reconnecting"
          ? "API indisponible. Reconnexion..."
          : "API indisponible";
  const fieldError = (errors: FieldErrors, key: string): JSX.Element | null =>
    errors[key] ? <span className="field-error">{errors[key]}</span> : null;
  const renderFieldLabel = (
    label: string,
    options?: { required?: boolean; note?: string }
  ): JSX.Element => (
    <span className="field-label">
      <span>
        {label}
        {options?.required ? <span className="field-label-required">*</span> : null}
      </span>
    </span>
  );
  const parseOptionalNumber = (value: string): number | undefined => {
    const normalized = value.trim();
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const focusFirstInlineErrorField = (stepId?: string): void => {
    window.setTimeout(() => {
      const scope = stepId
        ? document.querySelector(`[data-step-id="${stepId}"][data-active-step="true"]`)
        : document;

      if (!scope) return;
      const errorNode = scope.querySelector(".field-error");
      if (!errorNode) return;

      const label = errorNode.closest("label");
      const input = label?.querySelector<HTMLElement>("input, select, textarea");
      if (!input) return;

      input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };

  const schoolYearLabel = useMemo(() => {
    if (currentRole === "PARENT") {
      return (
        parentChildren.find((item) => item.schoolYearCode)?.schoolYearCode ||
        parentTimetable.find((item) => item.schoolYearCode)?.schoolYearCode ||
        "2025-2026"
      );
    }

    if (currentRole === "ENSEIGNANT") {
      return teacherClasses.find((item) => item.schoolYearCode)?.schoolYearCode || "2025-2026";
    }

    const activeYear = schoolYears.find((item) => item.isActive) || schoolYears[0];
    return activeYear?.label || activeYear?.code || "2025-2026";
  }, [currentRole, parentChildren, parentTimetable, schoolYears, teacherClasses]);

  const homeTiles = useMemo(() => {
    if (!currentRole) return [] as ModuleTile[];

    return MODULE_TILES.filter((tile) => hasScreenAccess(currentRole, tile.screen));
  }, [currentRole]);

  const filteredTiles = useMemo(() => {
    const query = moduleQuery.trim().toLowerCase();
    if (!query) return homeTiles;

    return homeTiles.filter((tile) => {
      const haystack = [tile.title, tile.subtitle, ...tile.tags].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [homeTiles, moduleQuery]);

  const currentSlide = HERO_SLIDES[2];

  useEffect(() => {
    if (!PREVIEW_MODE_ENABLED || session || window.location.hash !== "#preview-admin") {
      return;
    }

    enterPreview();
  }, [enterPreview, session]);

  useEffect(() => {
    if (isPreviewSession) {
      return;
    }

    void ensureApiAvailable();
  }, [ensureApiAvailable, isPreviewSession]);

  useEffect(() => {
    if (isPreviewSession) {
      return undefined;
    }

    if (!apiConnection.nextRetryAt || apiConnection.status === "online") {
      return undefined;
    }

    const delay = Math.max(250, apiConnection.nextRetryAt - Date.now());
    const timer = window.setTimeout(() => {
      void ensureApiAvailable();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [apiConnection.nextRetryAt, apiConnection.status, ensureApiAvailable, isPreviewSession]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setModuleQuery(moduleQueryInput);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [moduleQueryInput]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) {
      return undefined;
    }

    const timer = window.setTimeout(() => setError(null), 5200);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    return () => {
      if (themeFlipTimeoutRef.current !== null) {
        window.clearTimeout(themeFlipTimeoutRef.current);
      }
      if (languageFlipTimeoutRef.current !== null) {
        window.clearTimeout(languageFlipTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.lang = uiLanguage;
    document.documentElement.dir = currentLanguageMeta.dir;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, uiLanguage);
  }, [currentLanguageMeta.dir, uiLanguage]);

  useEffect(() => {
    analyticsFiltersRef.current = analyticsFilters;
  }, [analyticsFilters]);

  useEffect(() => {
    auditFiltersRef.current = auditFilters;
  }, [auditFilters]);

  useEffect(() => {
    if (session && !lastSyncAt) {
      setLastSyncAt(new Date().toISOString());
    }
  }, [lastSyncAt, session]);

  useEffect(() => {
    if (!currentRole) return;
    if (hasScreenAccess(currentRole, tab)) return;
    setTab(ROLE_HOME_SCREEN[currentRole] || "dashboard");
  }, [currentRole, tab]);

  useEffect(() => {
    setMobileTasksOpen(false);
  }, [session?.user.username, tab]);

  useEffect(() => {
    if (!session) return undefined;

    const frame = window.requestAnimationFrame(() => {
      appRootRef.current?.querySelector<HTMLElement>(".app-shell-main")?.scrollTo({ top: 0, left: 0 });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [session, tab]);

  const loadStudents = useCallback(async () => {
    if (!sessionRef.current) return;
    setStudentsLoading(true);
    const response = await api("/students");
    setStudentsLoading(false);
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setStudents((await response.json()) as Student[]);
  }, [api]);

  const loadUsers = useCallback(async () => {
    if (!sessionRef.current) return;
    const response = await api("/users");
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setUsers((await response.json()) as UserAccount[]);
  }, [api]);

  const loadIamAccountReferences = useCallback(async () => {
    if (!sessionRef.current) return;
    const [teachersResponse, parentsResponse] = await Promise.all([
      api("/teachers"),
      api("/parents")
    ]);
    if (!teachersResponse.ok) {
      setError(await parseError(teachersResponse));
      return;
    }
    if (!parentsResponse.ok) {
      setError(await parseError(parentsResponse));
      return;
    }
    setAccountTeachers((await teachersResponse.json()) as TeacherRecord[]);
    setAccountParents((await parentsResponse.json()) as ParentRecord[]);
  }, [api]);

  const loadRolePermissions = useCallback(
    async (role = rolePermissionTarget) => {
      if (!sessionRef.current) return;
      const response = await api(`/users/roles/${encodeURIComponent(role)}/permissions`);
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }
      setRolePermissions((await response.json()) as RolePermissionView[]);
    },
    [api, rolePermissionTarget]
  );

  const loadTeacherPortalData = useCallback(
    async (filters = teacherPortalFilters) => {
      if (!sessionRef.current) return;
      const query = new URLSearchParams();
      if (filters.classId) query.set("classId", filters.classId);
      if (filters.subjectId) query.set("subjectId", filters.subjectId);
      if (filters.academicPeriodId) query.set("academicPeriodId", filters.academicPeriodId);
      if (filters.studentId) query.set("studentId", filters.studentId);
      const suffix = query.toString() ? `?${query.toString()}` : "";

      const responses = await Promise.all([
        api("/portal/teacher/overview"),
        api("/portal/teacher/classes"),
        api(`/portal/teacher/students${filters.classId ? `?classId=${encodeURIComponent(filters.classId)}` : ""}`),
        api(`/portal/teacher/grades${suffix}`),
        api(`/portal/teacher/timetable${filters.classId ? `?classId=${encodeURIComponent(filters.classId)}` : ""}`),
        api(`/portal/teacher/notifications${filters.classId ? `?classId=${encodeURIComponent(filters.classId)}` : ""}`)
      ]);

      const failed = responses.find((item) => !item.ok);
      if (failed) {
        setError(await parseError(failed));
        return;
      }

      const [overview, classRows, studentRows, gradeRows, timetableRows, notificationRows] = await Promise.all([
        responses[0].json() as Promise<TeacherOverview>,
        responses[1].json() as Promise<TeacherClass[]>,
        responses[2].json() as Promise<TeacherStudent[]>,
        responses[3].json() as Promise<GradeEntry[]>,
        responses[4].json() as Promise<
          Array<{
            id: string;
            classId: string;
            classLabel?: string;
            schoolYearId: string;
            schoolYearCode?: string;
            track: AcademicTrack;
            rotationGroup?: "GROUP_A" | "GROUP_B";
            subjectId: string;
            subjectLabel?: string;
            dayOfWeek: number;
            startTime: string;
            endTime: string;
            room?: string;
            teacherName?: string;
          }>
        >,
        responses[5].json() as Promise<PortalNotification[]>
      ]);

      setTeacherOverview(overview);
      setTeacherClasses(classRows);
      setTeacherStudents(studentRows);
      setTeacherGrades(gradeRows);
      setTeacherTimetable(timetableRows);
      setTeacherNotifications(notificationRows);
    },
    [api, teacherPortalFilters]
  );

  const loadParentPortalData = useCallback(
    async (studentId = parentStudentFilter) => {
      if (!sessionRef.current) return;
      const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";

      const responses = await Promise.all([
        api("/portal/parent/overview"),
        api("/portal/parent/children"),
        api(`/portal/parent/grades${query}`),
        api(`/portal/parent/report-cards${query}`),
        api(`/portal/parent/attendance${query}`),
        api(`/portal/parent/invoices${query}`),
        api(`/portal/parent/payments${query}`),
        api(`/portal/parent/timetable${query}`),
        api(`/portal/parent/notifications${query}`)
      ]);

      const failed = responses.find((item) => !item.ok);
      if (failed) {
        setError(await parseError(failed));
        return;
      }

      const [
        overview,
        childrenRows,
        gradeRows,
        reportRows,
        attendanceRows,
        invoiceRows,
        paymentRows,
        timetableRows,
        notificationRows
      ] = await Promise.all([
        responses[0].json() as Promise<ParentOverview>,
        responses[1].json() as Promise<ParentChild[]>,
        responses[2].json() as Promise<Array<GradeEntry & { classLabel?: string; periodLabel?: string }>>,
        responses[3].json() as Promise<ReportCard[]>,
        responses[4].json() as Promise<
          Array<{
            id: string;
            studentId: string;
            studentName?: string;
            classId: string;
            classLabel?: string;
            placementId?: string;
            track: AcademicTrack;
            attendanceDate: string;
            status: string;
            reason?: string;
            justificationStatus: string;
          }>
        >,
        responses[5].json() as Promise<Invoice[]>,
        responses[6].json() as Promise<PaymentRecord[]>,
        responses[7].json() as Promise<
          Array<{
            slotId: string;
            studentId: string;
            studentName: string;
            classId: string;
            classLabel: string;
            schoolYearId: string;
            schoolYearCode?: string;
            placementId?: string;
            track: AcademicTrack;
            rotationGroup?: "GROUP_A" | "GROUP_B";
            subjectLabel: string;
            dayOfWeek: number;
            startTime: string;
            endTime: string;
            room?: string;
            teacherName?: string;
          }>
        >,
        responses[8].json() as Promise<PortalNotification[]>
      ]);

      setParentOverview(overview);
      setParentChildren(childrenRows);
      setParentGrades(gradeRows);
      setParentReportCards(reportRows);
      setParentAttendance(attendanceRows);
      setParentInvoices(invoiceRows);
      setParentPayments(paymentRows);
      setParentTimetable(timetableRows);
      setParentNotifications(notificationRows);
    },
    [api, parentStudentFilter]
  );

  const loadMosqueData = useCallback(
    async (filters = {
      memberFilters: mosqueMemberFilters,
      activityFilters: mosqueActivityFilters,
      donationFilters: mosqueDonationFilters
    }) => {
      if (!sessionRef.current) return;

      const memberQuery = new URLSearchParams();
      if (filters.memberFilters.status) memberQuery.set("status", filters.memberFilters.status);
      if (filters.memberFilters.q.trim()) memberQuery.set("q", filters.memberFilters.q.trim());
      const memberSuffix = memberQuery.toString() ? `?${memberQuery.toString()}` : "";

      const activityQuery = new URLSearchParams();
      if (filters.activityFilters.category) activityQuery.set("category", filters.activityFilters.category);
      if (filters.activityFilters.from) activityQuery.set("from", filters.activityFilters.from);
      if (filters.activityFilters.to) activityQuery.set("to", filters.activityFilters.to);
      if (filters.activityFilters.q.trim()) activityQuery.set("q", filters.activityFilters.q.trim());
      const activitySuffix = activityQuery.toString() ? `?${activityQuery.toString()}` : "";

      const donationQuery = new URLSearchParams();
      if (filters.donationFilters.memberId) donationQuery.set("memberId", filters.donationFilters.memberId);
      if (filters.donationFilters.channel) donationQuery.set("channel", filters.donationFilters.channel);
      if (filters.donationFilters.from) donationQuery.set("from", filters.donationFilters.from);
      if (filters.donationFilters.to) donationQuery.set("to", filters.donationFilters.to);
      const donationSuffix = donationQuery.toString() ? `?${donationQuery.toString()}` : "";

      const responses = await Promise.all([
        api("/mosque/dashboard"),
        api(`/mosque/members${memberSuffix}`),
        api(`/mosque/activities${activitySuffix}`),
        api(`/mosque/donations${donationSuffix}`)
      ]);

      const failed = responses.find((item) => !item.ok);
      if (failed) {
        setError(await parseError(failed));
        return;
      }

      const [dashboardView, memberRows, activityRows, donationRows] = await Promise.all([
        responses[0].json() as Promise<MosqueDashboard>,
        responses[1].json() as Promise<MosqueMember[]>,
        responses[2].json() as Promise<MosqueActivity[]>,
        responses[3].json() as Promise<MosqueDonation[]>
      ]);

      setMosqueDashboard(dashboardView);
      setMosqueMembers(memberRows);
      setMosqueActivities(activityRows);
      setMosqueDonations(donationRows);
    },
    [api, mosqueActivityFilters, mosqueDonationFilters, mosqueMemberFilters]
  );

  const loadAnalytics = useCallback(
    async (filters: { from: string; to: string; schoolYearId: string }) => {
      if (!sessionRef.current) return;
      const query = new URLSearchParams();
      if (filters.from) query.set("from", filters.from);
      if (filters.to) query.set("to", filters.to);
      if (filters.schoolYearId) query.set("schoolYearId", filters.schoolYearId);
      const suffix = query.toString() ? `?${query.toString()}` : "";
      const response = await api(`/analytics/overview${suffix}`);
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }
      setAnalyticsOverview((await response.json()) as AnalyticsOverview);
    },
    [api]
  );

  const loadAuditLogs = useCallback(
    async (filters: {
      resource: string;
      action: string;
      userId: string;
      q: string;
      from: string;
      to: string;
      page: number;
      pageSize: number;
    }) => {
      if (!sessionRef.current) return;
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
        setError(await parseError(response));
        return;
      }
      setAuditLogs((await response.json()) as AuditLogPage);
    },
    [api]
  );

  const loadReference = useCallback(async () => {
    if (!sessionRef.current) return;
    const [schoolYearsResponse, cyclesResponse, levelsResponse, classesResponse, subjectsResponse, periodsResponse] =
      await Promise.all([
        api("/school-years"),
        api("/cycles"),
        api("/levels"),
        api("/classes"),
        api("/subjects"),
        api("/academic-periods")
      ]);

    const referenceErrors: string[] = [];

    if (schoolYearsResponse.ok) {
      setSchoolYears((await schoolYearsResponse.json()) as SchoolYear[]);
    } else {
      setSchoolYears([]);
      referenceErrors.push(`Annees: ${await parseError(schoolYearsResponse)}`);
    }

    if (cyclesResponse.ok) {
      setCycles((await cyclesResponse.json()) as Cycle[]);
    } else {
      setCycles([]);
      referenceErrors.push(`Cycles: ${await parseError(cyclesResponse)}`);
    }

    if (levelsResponse.ok) {
      setLevels((await levelsResponse.json()) as Level[]);
    } else {
      setLevels([]);
      referenceErrors.push(`Niveaux: ${await parseError(levelsResponse)}`);
    }

    if (classesResponse.ok) {
      setClasses((await classesResponse.json()) as ClassItem[]);
    } else {
      setClasses([]);
      referenceErrors.push(`Classes: ${await parseError(classesResponse)}`);
    }

    if (subjectsResponse.ok) {
      setSubjects((await subjectsResponse.json()) as Subject[]);
    } else {
      setSubjects([]);
      referenceErrors.push(`Matieres: ${await parseError(subjectsResponse)}`);
    }

    if (periodsResponse.ok) {
      setPeriods((await periodsResponse.json()) as Period[]);
    } else {
      setPeriods([]);
      referenceErrors.push(`Periodes: ${await parseError(periodsResponse)}`);
    }

    if (referenceErrors.length > 0) {
      setError(referenceErrors.join(" | "));
    }
  }, [api]);

  const loadEnrollments = useCallback(
    async (filters = enrollmentFilters) => {
      if (!sessionRef.current) return;
      const query = new URLSearchParams();
      if (filters.schoolYearId) query.set("schoolYearId", filters.schoolYearId);
      if (filters.classId) query.set("classId", filters.classId);
      if (filters.studentId) query.set("studentId", filters.studentId);
      if (filters.track) query.set("track", filters.track);
      const suffix = query.toString() ? `?${query.toString()}` : "";
      const response = await api(`/enrollments${suffix}`);
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }
      setEnrollments((await response.json()) as Enrollment[]);
    },
    [api, enrollmentFilters]
  );

  const loadFinance = useCallback(async () => {
    if (!sessionRef.current) return;

    const responses = await Promise.all([
      api("/fee-plans"),
      api("/invoices"),
      api("/payments"),
      api("/finance/recovery")
    ]);

    const failed = responses.find((item) => !item.ok);
    if (failed) {
      setError(await parseError(failed));
      return;
    }

    const [feePlanRows, invoiceRows, paymentRows, recoveryView] = await Promise.all([
      responses[0].json() as Promise<FeePlan[]>,
      responses[1].json() as Promise<Invoice[]>,
      responses[2].json() as Promise<PaymentRecord[]>,
      responses[3].json() as Promise<RecoveryDashboard>
    ]);

    setFeePlans(feePlanRows);
    setInvoices(invoiceRows);
    setPayments(paymentRows);
    setRecovery(recoveryView);
  }, [api]);

  const loadGrades = useCallback(
    async (filters = gradeFilters) => {
      if (!sessionRef.current) return;

      const query = new URLSearchParams();
      if (filters.classId) query.set("classId", filters.classId);
      if (filters.subjectId) query.set("subjectId", filters.subjectId);
      if (filters.academicPeriodId) query.set("academicPeriodId", filters.academicPeriodId);
      if (filters.studentId) query.set("studentId", filters.studentId);
      const suffix = query.toString() ? `?${query.toString()}` : "";

      const response = await api(`/grades${suffix}`);
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      setGrades((await response.json()) as GradeEntry[]);
    },
    [api, gradeFilters]
  );

  const loadReportCards = useCallback(async () => {
    if (!sessionRef.current) return;
    const response = await api("/report-cards");
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setReportCards((await response.json()) as ReportCard[]);
  }, [api]);

  const loadHeaderNotificationCount = useCallback(async () => {
    if (!sessionRef.current || !currentRole) {
      setHeaderNotificationCount(0);
      return;
    }

    if (currentRole === "ENSEIGNANT") {
      setHeaderNotificationCount(teacherOverview?.notificationsCount ?? teacherNotifications.length);
      return;
    }

    if (currentRole === "PARENT") {
      setHeaderNotificationCount(parentOverview?.notificationsCount ?? parentNotifications.length);
      return;
    }

    if (!hasScreenAccess(currentRole, "schoolLifeNotifications")) {
      setHeaderNotificationCount(0);
      return;
    }

    const response = await api("/notifications", {}, false, { background: true });
    if (!response.ok) {
      setHeaderNotificationCount(0);
      return;
    }

    const rows = (await response.json()) as Array<{
      deliveryStatus?: string;
      status?: string;
    }>;

    const liveItems = rows.filter((item) => {
      const status = (item.status || "").toUpperCase();
      const deliveryStatus = (item.deliveryStatus || "").toUpperCase();
      return (
        status === "PENDING" ||
        status === "SCHEDULED" ||
        deliveryStatus === "QUEUED" ||
        deliveryStatus === "RETRYING"
      );
    });

    setHeaderNotificationCount(liveItems.length || rows.length);
  }, [
    api,
    currentRole,
    parentNotifications.length,
    parentOverview?.notificationsCount,
    teacherNotifications.length,
    teacherOverview?.notificationsCount
  ]);

  useEffect(() => {
    if (!session || !currentRole) {
      bootstrapSessionKeyRef.current = null;
      bootstrapSessionInFlightRef.current = null;
      clearData();
      return;
    }

    if (isPreviewSession) {
      return;
    }

    if (!apiAvailable) {
      void ensureApiAvailable();
      return;
    }

    const needStudents = ["iam", "students", "parents", "enrollments", "grades", "schoolLifeAttendance"].some(
      (screen) => hasScreenAccess(currentRole, screen as ScreenId)
    );
    const needReference = ["reference", "teachers", "rooms", "enrollments", "grades", "schoolLifeAttendance", "schoolLifeTimetable", "teacherPortal"].some(
      (screen) => hasScreenAccess(currentRole, screen as ScreenId)
    );

    const sessionKey = `${session.user.username}:${session.tenantId}:${currentRole}`;
    if (
      bootstrapSessionKeyRef.current === sessionKey ||
      bootstrapSessionInFlightRef.current === sessionKey
    ) {
      return;
    }

    bootstrapSessionInFlightRef.current = sessionKey;
    let cancelled = false;

    const bootstrapData = async (): Promise<void> => {
      try {
        if (needReference) await loadReference();
        if (needStudents) await loadStudents();
        if (hasScreenAccess(currentRole, "iam") || hasScreenAccess(currentRole, "parents")) {
          await loadUsers();
        }
        if (hasScreenAccess(currentRole, "iam")) {
          await loadIamAccountReferences();
          await loadRolePermissions(rolePermissionTarget);
        }
        if (hasScreenAccess(currentRole, "enrollments")) await loadEnrollments();
        if (hasScreenAccess(currentRole, "finance")) await loadFinance();
        if (hasScreenAccess(currentRole, "reports")) {
          await loadAnalytics(analyticsFiltersRef.current);
          await loadAuditLogs(auditFiltersRef.current);
        }
        if (hasScreenAccess(currentRole, "grades")) {
          await loadGrades();
          await loadReportCards();
        }
        if (hasScreenAccess(currentRole, "teacherPortal")) {
          await loadTeacherPortalData();
        }
        if (hasScreenAccess(currentRole, "parentPortal")) {
          await loadParentPortalData();
        }

        if (!cancelled) {
          bootstrapSessionKeyRef.current = sessionKey;
        }
      } finally {
        if (bootstrapSessionInFlightRef.current === sessionKey) {
          bootstrapSessionInFlightRef.current = null;
        }
      }
    };

    void bootstrapData();

    return () => {
      cancelled = true;
      if (bootstrapSessionInFlightRef.current === sessionKey) {
        bootstrapSessionInFlightRef.current = null;
      }
    };
  }, [
    apiAvailable,
    clearData,
    currentRole,
    ensureApiAvailable,
    loadAnalytics,
    loadAuditLogs,
    loadEnrollments,
    loadFinance,
    loadGrades,
    loadIamAccountReferences,
    loadReference,
    loadReportCards,
    loadTeacherPortalData,
    loadParentPortalData,
    loadRolePermissions,
    loadStudents,
    loadUsers,
    rolePermissionTarget,
    session,
    isPreviewSession
  ]);

  useEffect(() => {
    if (isPreviewSession) {
      return undefined;
    }

    if (!session || !currentRole || !apiAvailable) {
      setHeaderNotificationCount(0);
      if (session && currentRole && !apiAvailable) {
        void ensureApiAvailable();
      }
      return;
    }

    let isCancelled = false;
    const syncHeaderNotifications = async (): Promise<void> => {
      await loadHeaderNotificationCount();
      if (isCancelled) return;
    };

    void syncHeaderNotifications();
    const timer = window.setInterval(() => {
      void syncHeaderNotifications();
    }, 45_000);

    return () => {
      isCancelled = true;
      window.clearInterval(timer);
    };
  }, [apiAvailable, currentRole, ensureApiAvailable, loadHeaderNotificationCount, session, isPreviewSession]);

  useEffect(() => {
    if (!cycleForm.schoolYearId && schoolYears[0]) setCycleForm((prev) => ({ ...prev, schoolYearId: schoolYears[0].id }));
    if (!levelForm.cycleId && cycles[0]) setLevelForm((prev) => ({ ...prev, cycleId: cycles[0].id }));
    if (!classForm.schoolYearId && schoolYears[0]) setClassForm((prev) => ({ ...prev, schoolYearId: schoolYears[0].id }));
    if (!classForm.levelId && levels[0]) setClassForm((prev) => ({ ...prev, levelId: levels[0].id }));
    if (!periodForm.schoolYearId && schoolYears[0]) setPeriodForm((prev) => ({ ...prev, schoolYearId: schoolYears[0].id }));

    if (!enrollmentForm.schoolYearId && schoolYears[0]) setEnrollmentForm((prev) => ({ ...prev, schoolYearId: schoolYears[0].id }));
    if (!enrollmentForm.classId && classes[0]) setEnrollmentForm((prev) => ({ ...prev, classId: classes[0].id }));
    if (!enrollmentForm.studentId && students[0]) setEnrollmentForm((prev) => ({ ...prev, studentId: students[0].id }));

    if (!feePlanForm.schoolYearId && schoolYears[0]) setFeePlanForm((prev) => ({ ...prev, schoolYearId: schoolYears[0].id }));
    if (!feePlanForm.levelId && levels[0]) setFeePlanForm((prev) => ({ ...prev, levelId: levels[0].id }));

    if (!invoiceForm.studentId && students[0]) setInvoiceForm((prev) => ({ ...prev, studentId: students[0].id }));
    if (!invoiceForm.schoolYearId && schoolYears[0]) setInvoiceForm((prev) => ({ ...prev, schoolYearId: schoolYears[0].id }));

    if (!paymentForm.invoiceId && invoices[0]) setPaymentForm((prev) => ({ ...prev, invoiceId: invoices[0].id }));

    if (!gradeForm.studentId && students[0]) setGradeForm((prev) => ({ ...prev, studentId: students[0].id }));
    if (!gradeForm.classId && classes[0]) setGradeForm((prev) => ({ ...prev, classId: classes[0].id }));
    if (!gradeForm.subjectId && subjects[0]) setGradeForm((prev) => ({ ...prev, subjectId: subjects[0].id }));
    const gradeFormSchoolYearId = classes.find((item) => item.id === gradeForm.classId)?.schoolYearId;
    const compatiblePeriodsForGradeForm = gradeFormSchoolYearId
      ? periods.filter((item) => item.schoolYearId === gradeFormSchoolYearId)
      : periods;
    if (!gradeForm.academicPeriodId && compatiblePeriodsForGradeForm[0])
      setGradeForm((prev) => ({ ...prev, academicPeriodId: compatiblePeriodsForGradeForm[0].id }));

    if (!reportForm.studentId && students[0]) setReportForm((prev) => ({ ...prev, studentId: students[0].id }));
    if (!reportForm.classId && classes[0]) setReportForm((prev) => ({ ...prev, classId: classes[0].id }));
    const reportFormSchoolYearId = classes.find((item) => item.id === reportForm.classId)?.schoolYearId;
    const compatiblePeriodsForReportForm = reportFormSchoolYearId
      ? periods.filter((item) => item.schoolYearId === reportFormSchoolYearId)
      : periods;
    if (!reportForm.academicPeriodId && compatiblePeriodsForReportForm[0])
      setReportForm((prev) => ({ ...prev, academicPeriodId: compatiblePeriodsForReportForm[0].id }));

    if (!mosqueDonationForm.memberId && mosqueMembers[0]) {
      setMosqueDonationForm((prev) => ({ ...prev, memberId: mosqueMembers[0].id }));
    }

    if (!teacherPortalFilters.classId && teacherClasses[0]) {
      setTeacherPortalFilters((prev) => ({ ...prev, classId: teacherClasses[0].classId }));
    }
    if (!teacherGradeForm.classId && teacherClasses[0]) {
      setTeacherGradeForm((prev) => ({ ...prev, classId: teacherClasses[0].classId }));
    }
    if (!teacherAttendanceForm.classId && teacherClasses[0]) {
      setTeacherAttendanceForm((prev) => ({ ...prev, classId: teacherClasses[0].classId }));
    }
    if (!teacherNotificationForm.classId && teacherClasses[0]) {
      setTeacherNotificationForm((prev) => ({ ...prev, classId: teacherClasses[0].classId }));
    }

    if (!teacherGradeForm.studentId && teacherStudents[0]) {
      setTeacherGradeForm((prev) => ({ ...prev, studentId: teacherStudents[0].studentId }));
    }
    if (!teacherGradeForm.subjectId && subjects[0]) {
      setTeacherGradeForm((prev) => ({ ...prev, subjectId: subjects[0].id }));
    }
    const teacherFormSchoolYearId = teacherClasses.find((item) => item.classId === teacherGradeForm.classId)?.schoolYearId;
    const compatiblePeriodsForTeacherGrade = teacherFormSchoolYearId
      ? periods.filter((item) => item.schoolYearId === teacherFormSchoolYearId)
      : periods;
    if (!teacherGradeForm.academicPeriodId && compatiblePeriodsForTeacherGrade[0]) {
      setTeacherGradeForm((prev) => ({ ...prev, academicPeriodId: compatiblePeriodsForTeacherGrade[0].id }));
    }
  }, [
    cycleForm.schoolYearId,
    classForm.levelId,
    classForm.schoolYearId,
    classes,
    cycles,
    enrollmentForm.classId,
    enrollmentForm.schoolYearId,
    enrollmentForm.studentId,
    feePlanForm.levelId,
    feePlanForm.schoolYearId,
    gradeForm.academicPeriodId,
    gradeForm.classId,
    gradeForm.studentId,
    gradeForm.subjectId,
    invoiceForm.schoolYearId,
    invoiceForm.studentId,
    invoices,
    levelForm.cycleId,
    levels,
    paymentForm.invoiceId,
    periodForm.schoolYearId,
    periods,
    reportForm.academicPeriodId,
    reportForm.classId,
    reportForm.studentId,
    schoolYears,
    students,
    subjects,
    teacherAttendanceForm.classId,
    teacherClasses,
    teacherGradeForm.academicPeriodId,
    teacherGradeForm.classId,
    teacherGradeForm.studentId,
    teacherGradeForm.subjectId,
    teacherNotificationForm.classId,
    teacherPortalFilters.classId,
    teacherStudents,
    mosqueDonationForm.memberId,
    mosqueMembers
  ]);

  useEffect(() => {
    const selectedLevel = levels.find((item) => item.id === classForm.levelId);
    if (selectedLevel && classForm.track !== selectedLevel.track) {
      setClassForm((prev) => ({ ...prev, track: selectedLevel.track }));
    }
  }, [classForm.levelId, classForm.track, levels]);

  useEffect(() => {
    const selectedClass = classes.find((item) => item.id === enrollmentForm.classId);
    if (selectedClass && enrollmentForm.track !== selectedClass.track) {
      setEnrollmentForm((prev) => ({ ...prev, track: selectedClass.track }));
    }
  }, [classes, enrollmentForm.classId, enrollmentForm.track]);

  useEffect(() => {
    const ensureCompatiblePeriod = (
      classId: string,
      periodId: string,
      onMismatch: (nextPeriodId: string) => void
    ): void => {
      if (!classId) return;
      const classroom = classes.find((item) => item.id === classId);
      if (!classroom) return;
      const compatiblePeriods = periods.filter((item) => item.schoolYearId === classroom.schoolYearId);
      if (compatiblePeriods.length === 0) return;
      const current = periods.find((item) => item.id === periodId);
      if (!current || current.schoolYearId !== classroom.schoolYearId) {
        onMismatch(compatiblePeriods[0].id);
      }
    };

    ensureCompatiblePeriod(gradeForm.classId, gradeForm.academicPeriodId, (nextPeriodId) => {
      if (nextPeriodId !== gradeForm.academicPeriodId) {
        setGradeForm((prev) => ({ ...prev, academicPeriodId: nextPeriodId }));
      }
    });

    ensureCompatiblePeriod(reportForm.classId, reportForm.academicPeriodId, (nextPeriodId) => {
      if (nextPeriodId !== reportForm.academicPeriodId) {
        setReportForm((prev) => ({ ...prev, academicPeriodId: nextPeriodId }));
      }
    });

    ensureCompatiblePeriod(teacherGradeForm.classId, teacherGradeForm.academicPeriodId, (nextPeriodId) => {
      if (nextPeriodId !== teacherGradeForm.academicPeriodId) {
        setTeacherGradeForm((prev) => ({ ...prev, academicPeriodId: nextPeriodId }));
      }
    });

    ensureCompatiblePeriod(teacherPortalFilters.classId, teacherPortalFilters.academicPeriodId, (nextPeriodId) => {
      if (nextPeriodId !== teacherPortalFilters.academicPeriodId) {
        setTeacherPortalFilters((prev) => ({ ...prev, academicPeriodId: nextPeriodId }));
      }
    });

    if (gradeFilters.classId && gradeFilters.academicPeriodId) {
      const classroom = classes.find((item) => item.id === gradeFilters.classId);
      const period = periods.find((item) => item.id === gradeFilters.academicPeriodId);
      if (classroom && period && classroom.schoolYearId !== period.schoolYearId) {
        setGradeFilters((prev) => ({ ...prev, academicPeriodId: "" }));
      }
    }
  }, [
    classes,
    gradeFilters.academicPeriodId,
    gradeFilters.classId,
    gradeForm.academicPeriodId,
    gradeForm.classId,
    periods,
    reportForm.academicPeriodId,
    reportForm.classId,
    teacherGradeForm.academicPeriodId,
    teacherGradeForm.classId,
    teacherPortalFilters.academicPeriodId,
    teacherPortalFilters.classId
  ]);

  const shownStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((item) =>
      [
        item.matricule,
        item.firstName,
        item.lastName,
        item.phone,
        item.email,
        item.status,
        ...(item.tracks || []),
        ...(item.parents || []).map((parent) => parent.parentName)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [studentSearch, students]);

  const shownLevels = useMemo(
    () => (levelCycleFilter ? levels.filter((item) => item.cycleId === levelCycleFilter) : levels),
    [levelCycleFilter, levels]
  );
  const shownClasses = useMemo(
    () =>
      classes.filter((item) => {
        const byYear = !classYearFilter || item.schoolYearId === classYearFilter;
        const byLevel = !classLevelFilter || item.levelId === classLevelFilter;
        return byYear && byLevel;
      }),
    [classLevelFilter, classYearFilter, classes]
  );
  const shownPeriods = useMemo(
    () => (periodYearFilter ? periods.filter((item) => item.schoolYearId === periodYearFilter) : periods),
    [periodYearFilter, periods]
  );

  const compatibleUserRoles = ACCOUNT_TYPE_ROLE_OPTIONS[userForm.accountType];
  const selectedAccountTeacher = accountTeachers.find((teacher) => teacher.id === userForm.teacherId);
  const selectedAccountParent = accountParents.find((parent) => parent.id === userForm.parentId);
  const selectedAccountStudent = students.find((student) => student.id === userForm.studentId);
  const selectedBusinessIdentity =
    userForm.accountType === "TEACHER"
      ? selectedAccountTeacher
      : userForm.accountType === "PARENT"
        ? selectedAccountParent
        : userForm.accountType === "STUDENT"
          ? selectedAccountStudent
          : null;
  const selectedBusinessDisplayName =
    selectedBusinessIdentity && "fullName" in selectedBusinessIdentity
      ? selectedBusinessIdentity.fullName
      : selectedBusinessIdentity
        ? `${selectedBusinessIdentity.firstName} ${selectedBusinessIdentity.lastName}`.trim()
        : userForm.staffDisplayName || userForm.displayName;
  const selectedBusinessEmail =
    selectedBusinessIdentity && "email" in selectedBusinessIdentity ? selectedBusinessIdentity.email : userForm.email;
  const selectedBusinessPhone =
    selectedBusinessIdentity && "primaryPhone" in selectedBusinessIdentity
      ? selectedBusinessIdentity.primaryPhone
      : selectedBusinessIdentity && "phone" in selectedBusinessIdentity
        ? selectedBusinessIdentity.phone
        : userForm.phone;
  const selectedBusinessStatus =
    selectedBusinessIdentity && "status" in selectedBusinessIdentity ? selectedBusinessIdentity.status : undefined;
  const selectedBusinessUserId =
    selectedBusinessIdentity && "userId" in selectedBusinessIdentity ? selectedBusinessIdentity.userId : undefined;
  const selectedBusinessAlreadyLinked = Boolean(selectedBusinessUserId && selectedBusinessUserId !== editingUserId);
  const selectedBusinessIsInactive =
    Boolean(selectedBusinessStatus && selectedBusinessStatus !== "ACTIVE") ||
    Boolean(selectedBusinessIdentity && "archivedAt" in selectedBusinessIdentity && selectedBusinessIdentity.archivedAt);

  const setUserAccountType = (accountType: AccountType): void => {
    setUserForm((prev) => ({
      ...prev,
      accountType,
      roleId: ACCOUNT_TYPE_ROLE_OPTIONS[accountType][0],
      teacherId: "",
      parentId: "",
      studentId: "",
      autoFillIdentity: true
    }));
    setUserErrors({});
    setLastTemporaryPassword("");
  };

  const resetStudentForm = (): void => {
    setEditingStudentId(null);
    setStudentForm({
      matricule: "",
      firstName: "",
      lastName: "",
      sex: "M",
      birthDate: "",
      birthPlace: "",
      nationality: "",
      address: "",
      phone: "",
      email: "",
      establishmentId: "",
      admissionDate: "",
      internalId: "",
      birthCertificateNo: "",
      specialNeeds: "",
      primaryLanguage: "",
      status: "ACTIVE",
      administrativeNotes: ""
    });
  };

  const resetUserForm = (): void => {
    setEditingUserId(null);
    setUserForm({
      username: "",
      email: "",
      phone: "",
      passwordMode: "AUTO",
      password: "",
      confirmPassword: "",
      accountType: "STAFF",
      roleId: "SCOLARITE",
      teacherId: "",
      parentId: "",
      studentId: "",
      autoFillIdentity: true,
      staffDisplayName: "",
      staffFunction: "",
      department: "",
      displayName: "",
      avatarUrl: "",
      establishmentId: "",
      notes: "",
      mustChangePasswordAtFirstLogin: true,
      isActive: true
    });
    setLastTemporaryPassword("");
  };

  const getEffectivePermission = (
    resource: PermissionResource,
    action: PermissionAction
  ): boolean => {
    const row = rolePermissions.find(
      (item) => item.resource === resource && item.action === action
    );
    return row?.allowed ?? false;
  };

  const toggleRolePermission = (
    resource: PermissionResource,
    action: PermissionAction,
    allowed: boolean
  ): void => {
    setRolePermissions((previous) => {
      const index = previous.findIndex(
        (item) => item.resource === resource && item.action === action
      );

      if (index < 0) {
        return [
          ...previous,
          {
            role: rolePermissionTarget,
            resource,
            action,
            allowed,
            source: "CUSTOM"
          }
        ];
      }

      const next = [...previous];
      next[index] = {
        ...next[index],
        allowed,
        source: "CUSTOM"
      };
      return next;
    });
  };

  const submitUser = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);

    const errors: FieldErrors = {};
    if (!userForm.username.trim()) errors.username = "Nom utilisateur requis.";
    if (!compatibleUserRoles.includes(userForm.roleId)) {
      errors.roleId = "Role incompatible avec la nature du compte.";
    }
    if (userForm.accountType === "STAFF" && !userForm.staffDisplayName.trim()) {
      errors.staffDisplayName = "Nom affiche staff requis.";
    }
    if (userForm.accountType === "TEACHER" && !userForm.teacherId) {
      errors.teacherId = "Fiche enseignant requise.";
    }
    if (userForm.accountType === "PARENT" && !userForm.parentId) {
      errors.parentId = "Fiche parent requise.";
    }
    if (userForm.accountType === "STUDENT" && !userForm.studentId) {
      errors.studentId = "Fiche eleve requise.";
    }
    if (selectedBusinessAlreadyLinked) {
      errors.businessProfile = "Cette fiche metier est deja rattachee a un autre compte.";
    }
    if (selectedBusinessIsInactive) {
      errors.businessProfile = "La fiche metier doit etre active pour creer un compte actif.";
    }
    if (!editingUserId && userForm.passwordMode === "MANUAL" && !isStrongPassword(userForm.password.trim())) {
      errors.password = STRONG_PASSWORD_HINT;
    }
    if (userForm.password.trim() && !isStrongPassword(userForm.password.trim())) {
      errors.password = STRONG_PASSWORD_HINT;
    }
    if (userForm.passwordMode === "MANUAL" && userForm.password !== userForm.confirmPassword) {
      errors.confirmPassword = "La confirmation ne correspond pas.";
    }

    setUserErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("accounts");
      return;
    }

    const payload: Record<string, unknown> = {
      username: userForm.username.trim(),
      email: userForm.email.trim() || undefined,
      phone: userForm.phone.trim() || undefined,
      accountType: userForm.accountType,
      roleId: userForm.roleId,
      teacherId: userForm.accountType === "TEACHER" ? userForm.teacherId : undefined,
      parentId: userForm.accountType === "PARENT" ? userForm.parentId : undefined,
      studentId: userForm.accountType === "STUDENT" ? userForm.studentId : undefined,
      autoFillIdentity: userForm.autoFillIdentity,
      staffDisplayName: userForm.accountType === "STAFF" ? userForm.staffDisplayName.trim() : undefined,
      staffFunction: userForm.staffFunction.trim() || undefined,
      department: userForm.department.trim() || undefined,
      displayName: userForm.displayName.trim() || undefined,
      avatarUrl: userForm.avatarUrl.trim() || undefined,
      establishmentId: userForm.establishmentId || undefined,
      notes: userForm.notes.trim() || undefined,
      mustChangePasswordAtFirstLogin: userForm.mustChangePasswordAtFirstLogin,
      isActive: userForm.isActive
    };
    if (!editingUserId) {
      payload.passwordMode = userForm.passwordMode;
    }
    if (userForm.passwordMode === "MANUAL" && userForm.password.trim()) {
      payload.password = userForm.password.trim();
      payload.confirmPassword = userForm.confirmPassword.trim();
    }

    const response = await api(editingUserId ? `/users/${editingUserId}` : "/users", {
      method: editingUserId ? "PATCH" : "POST",
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    const savedUser = (await response.json()) as UserAccount;
    setUserErrors({});
    setLastTemporaryPassword(savedUser.temporaryPassword || "");
    setNotice(editingUserId ? "Utilisateur mis a jour." : "Utilisateur cree.");
    setIamWorkflowStep("accounts");
    if (!savedUser.temporaryPassword) {
      resetUserForm();
    }
    await loadUsers();
    await loadIamAccountReferences();
  };

  const startEditUser = (item: UserAccount): void => {
    const accountType = item.accountType || (item.role === "ENSEIGNANT" ? "TEACHER" : item.role === "PARENT" ? "PARENT" : item.role === "STUDENT" ? "STUDENT" : "STAFF");
    setEditingUserId(item.id);
    setUserForm({
      username: item.username,
      email: item.email || "",
      phone: item.phone || "",
      passwordMode: "MANUAL",
      password: "",
      confirmPassword: "",
      accountType,
      roleId: item.roleId || item.role,
      teacherId: item.teacherId || "",
      parentId: item.parentId || "",
      studentId: item.studentId || "",
      autoFillIdentity: true,
      staffDisplayName: item.accountType === "STAFF" ? item.displayName || "" : "",
      staffFunction: item.staffFunction || "",
      department: item.department || "",
      displayName: item.displayName || "",
      avatarUrl: item.avatarUrl || "",
      establishmentId: item.establishmentId || "",
      notes: item.notes || "",
      mustChangePasswordAtFirstLogin: item.mustChangePasswordAtFirstLogin ?? false,
      isActive: item.isActive
    });
    setLastTemporaryPassword("");
    setIamWorkflowStep("accounts");
  };

  const deleteUserAccount = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer cet utilisateur ?")) return;
    const response = await api(`/users/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    if (editingUserId === id) {
      resetUserForm();
    }
    setNotice("Utilisateur supprime.");
    await loadUsers();
    await loadIamAccountReferences();
  };

  const saveRolePermissions = async (): Promise<void> => {
    setError(null);

    const permissions = PERMISSION_RESOURCE_VALUES.flatMap((resource) =>
      PERMISSION_ACTION_VALUES.map((action) => ({
        resource,
        action,
        allowed: getEffectivePermission(resource, action)
      }))
    );

    const response = await api(
      `/users/roles/${encodeURIComponent(rolePermissionTarget)}/permissions`,
      {
        method: "PUT",
        body: JSON.stringify({ permissions })
      }
    );

    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setRolePermissions((await response.json()) as RolePermissionView[]);
    setNotice(`Droits ${formatRoleLabel(rolePermissionTarget)} mis a jour.`);
    setIamWorkflowStep("permissions");
  };

  const submitTeacherGrade = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!teacherGradeForm.studentId) errors.studentId = "Eleve requis.";
    if (!teacherGradeForm.classId) errors.classId = "Classe requise.";
    if (!teacherGradeForm.subjectId) errors.subjectId = "Matiere requise.";
    if (!teacherGradeForm.academicPeriodId) errors.academicPeriodId = "Periode requise.";
    if (!teacherGradeForm.assessmentLabel.trim()) errors.assessmentLabel = "Libelle requis.";
    const score = Number(teacherGradeForm.score);
    const scoreMax = Number(teacherGradeForm.scoreMax || 20);
    if (!Number.isFinite(score) || score < 0) errors.score = "Note invalide.";
    if (!Number.isFinite(scoreMax) || scoreMax <= 0) errors.scoreMax = "Bareme invalide.";
    if (!hasFieldErrors(errors) && score > scoreMax) {
      errors.score = "La note ne peut pas depasser le bareme.";
    }
    setTeacherPortalErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("teacher-grade");
      return;
    }

    const response = await api("/portal/teacher/grades", {
      method: "POST",
      body: JSON.stringify({
        studentId: teacherGradeForm.studentId,
        classId: teacherGradeForm.classId,
        subjectId: teacherGradeForm.subjectId,
        academicPeriodId: teacherGradeForm.academicPeriodId,
        assessmentLabel: teacherGradeForm.assessmentLabel.trim(),
        assessmentType: teacherGradeForm.assessmentType,
        score,
        scoreMax,
        comment: teacherGradeForm.comment.trim() || undefined
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setTeacherPortalErrors({});
    setNotice("Note enregistree.");
    await loadTeacherPortalData(teacherPortalFilters);
  };

  const submitTeacherAttendanceBulk = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!teacherAttendanceForm.classId) errors.classId = "Classe requise.";
    if (!teacherAttendanceForm.attendanceDate) errors.attendanceDate = "Date requise.";
    if (teacherAttendanceStudents.length === 0) errors.students = "Selectionner au moins un eleve.";
    setTeacherPortalErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("teacher-attendance");
      return;
    }

    const response = await api("/portal/teacher/attendance/bulk", {
      method: "POST",
      body: JSON.stringify({
        classId: teacherAttendanceForm.classId,
        attendanceDate: teacherAttendanceForm.attendanceDate,
        defaultStatus: teacherAttendanceForm.defaultStatus,
        entries: teacherAttendanceStudents.map((studentId) => ({
          studentId,
          reason: teacherAttendanceForm.reason.trim() || undefined
        }))
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setTeacherPortalErrors({});
    setNotice("Pointage enregistre.");
    await loadTeacherPortalData(teacherPortalFilters);
  };

  const submitTeacherNotification = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!teacherNotificationForm.classId) errors.classId = "Classe requise.";
    if (!teacherNotificationForm.title.trim()) errors.title = "Titre requis.";
    if (!teacherNotificationForm.message.trim()) errors.message = "Message requis.";
    setTeacherPortalErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("teacher-notifications");
      return;
    }

    const response = await api("/portal/teacher/notifications", {
      method: "POST",
      body: JSON.stringify({
        classId: teacherNotificationForm.classId,
        studentId: teacherNotificationForm.studentId || undefined,
        title: teacherNotificationForm.title.trim(),
        message: teacherNotificationForm.message.trim(),
        channel: teacherNotificationForm.channel
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setTeacherPortalErrors({});
    setNotice("Notification parent envoyee.");
    setTeacherNotificationForm((prev) => ({ ...prev, title: "", message: "" }));
    await loadTeacherPortalData(teacherPortalFilters);
  };

  const toggleThemeMode = (): void => {
    const nextThemeMode = getNextThemeMode(themeMode);
    if (themeFlipTarget || nextThemeMode === themeMode) return;
    const animationDuration = getIconToggleAnimationDuration();
    if (animationDuration === 0) {
      setThemeMode(nextThemeMode);
      return;
    }

    if (themeFlipTimeoutRef.current !== null) {
      window.clearTimeout(themeFlipTimeoutRef.current);
    }

    setThemeFlipTarget(nextThemeMode);
    themeFlipTimeoutRef.current = window.setTimeout(() => {
      setThemeMode(nextThemeMode);
      setThemeFlipTarget(null);
      themeFlipTimeoutRef.current = null;
    }, animationDuration);
  };

  const selectThemeMode = (nextThemeMode: ThemeMode): void => {
    if (nextThemeMode === themeMode || themeFlipTarget) return;

    const animationDuration = getIconToggleAnimationDuration();
    if (animationDuration === 0) {
      setThemeMode(nextThemeMode);
      return;
    }

    if (themeFlipTimeoutRef.current !== null) {
      window.clearTimeout(themeFlipTimeoutRef.current);
    }

    setThemeFlipTarget(nextThemeMode);
    themeFlipTimeoutRef.current = window.setTimeout(() => {
      setThemeMode(nextThemeMode);
      setThemeFlipTarget(null);
      themeFlipTimeoutRef.current = null;
    }, animationDuration);
  };

  const cycleLanguage = (): void => {
    const nextLanguage = getNextUiLanguage(uiLanguage);
    if (languageFlipTarget || nextLanguage === uiLanguage) return;
    const animationDuration = getIconToggleAnimationDuration();
    if (animationDuration === 0) {
      setUiLanguage(nextLanguage);
      return;
    }

    if (languageFlipTimeoutRef.current !== null) {
      window.clearTimeout(languageFlipTimeoutRef.current);
    }

    setLanguageFlipTarget(nextLanguage);
    languageFlipTimeoutRef.current = window.setTimeout(() => {
      setUiLanguage(nextLanguage);
      setLanguageFlipTarget(null);
      languageFlipTimeoutRef.current = null;
    }, animationDuration);
  };

  const selectLanguage = (nextLanguage: UiLanguage): void => {
    if (nextLanguage === uiLanguage || languageFlipTarget) return;

    const animationDuration = getIconToggleAnimationDuration();
    if (animationDuration === 0) {
      setUiLanguage(nextLanguage);
      return;
    }

    if (languageFlipTimeoutRef.current !== null) {
      window.clearTimeout(languageFlipTimeoutRef.current);
    }

    setLanguageFlipTarget(nextLanguage);
    languageFlipTimeoutRef.current = window.setTimeout(() => {
      setUiLanguage(nextLanguage);
      setLanguageFlipTarget(null);
      languageFlipTimeoutRef.current = null;
    }, animationDuration);
  };

  const showLoginPanel = (): void => {
    setAuthAssistMode("none");
    setError(null);
    setNotice(null);
  };

  const showForgotPasswordPanel = (): void => {
    setAuthAssistMode("forgot");
    setError(null);
    setNotice(null);
  };

  const showFirstConnectionPanel = (): void => {
    setAuthAssistMode("first");
    setError(null);
    setNotice(null);
  };

  const performPublicRequest = useCallback(
    async (
      path: string,
      init: RequestInit,
      options: { forceProbe?: boolean; suppressError?: boolean } = {}
    ): Promise<Response | null> => {
      const { forceProbe = true, suppressError = false } = options;
      const ready = await ensureApiAvailable(forceProbe);
      if (!ready) {
        if (!suppressError) {
          setError("API indisponible. Reconnexion...");
        }
        return null;
      }

      try {
        const response = await fetch(resolveApiUrl(path), init);
        markApiAvailable();
        return response;
      } catch {
        markApiUnavailable();
        if (!suppressError) {
          setError("API indisponible. Reconnexion...");
        }
        return null;
      }
    },
    [ensureApiAvailable, markApiAvailable, markApiUnavailable, resolveApiUrl]
  );

  const requestForgotPasswordToken = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!forgotPasswordForm.username.trim()) {
      setError("Renseigner votre identifiant pour demander un token de reinitialisation.");
      return;
    }

    setAuthAssistLoading(true);
    try {
      const response = await performPublicRequest("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: forgotPasswordForm.username.trim(),
          tenantId: DEFAULT_TENANT
        })
      });
      if (!response) return;
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      const payload = (await response.json()) as ForgotPasswordResponse;
      setNotice(payload.message || "Demande de reinitialisation enregistree.");
    } finally {
      setAuthAssistLoading(false);
    }
  };

  const submitResetPassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!resetPasswordForm.token.trim()) {
      setError("Token de reinitialisation requis.");
      return;
    }
    if (!isStrongPassword(resetPasswordForm.newPassword)) {
      setError(STRONG_PASSWORD_HINT);
      return;
    }
    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      setError("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setAuthAssistLoading(true);
    try {
      const response = await performPublicRequest("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: resetPasswordForm.token.trim(),
          newPassword: resetPasswordForm.newPassword
        })
      });
      if (!response) return;
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      const payload = (await response.json()) as AuthMessageResponse;
      setNotice(payload.message || "Mot de passe reinitialise.");
      setLoginForm((prev) => ({
        ...prev,
        username: forgotPasswordForm.username.trim() || prev.username,
        tenantId: DEFAULT_TENANT,
        password: ""
      }));
      setResetPasswordForm({ token: "", newPassword: "", confirmPassword: "" });
      setAuthAssistMode("none");
    } finally {
      setAuthAssistLoading(false);
    }
  };

  const submitFirstConnection = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!firstConnectionForm.username.trim()) {
      setError("Identifiant requis.");
      return;
    }
    if (!firstConnectionForm.temporaryPassword || firstConnectionForm.temporaryPassword.length < 8) {
      setError("Mot de passe temporaire invalide.");
      return;
    }
    if (!isStrongPassword(firstConnectionForm.newPassword)) {
      setError(STRONG_PASSWORD_HINT);
      return;
    }
    if (firstConnectionForm.newPassword !== firstConnectionForm.confirmPassword) {
      setError("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setAuthAssistLoading(true);
    try {
      const response = await performPublicRequest("/auth/first-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: firstConnectionForm.username.trim(),
          tenantId: DEFAULT_TENANT,
          temporaryPassword: firstConnectionForm.temporaryPassword,
          newPassword: firstConnectionForm.newPassword
        })
      });
      if (!response) return;
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      const payload = (await response.json()) as AuthMessageResponse;
      setNotice(payload.message || "Premiere connexion finalisee.");
      setLoginForm((prev) => ({
        ...prev,
        username: firstConnectionForm.username.trim(),
        tenantId: DEFAULT_TENANT,
        password: firstConnectionForm.newPassword
      }));
      setFirstConnectionForm((prev) => ({
        ...prev,
        temporaryPassword: "",
        newPassword: "",
        confirmPassword: ""
      }));
      setAuthAssistMode("none");
    } finally {
      setAuthAssistLoading(false);
    }
  };

  const login = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const errors: FieldErrors = {};
    if (!loginForm.username.trim()) errors.username = "Nom utilisateur requis.";
    if (!loginForm.password || loginForm.password.length < 8) errors.password = "Minimum 8 caracteres.";
    setLoginErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField();
      return;
    }
    setLoadingAuth(true);
    try {
      const response = await performPublicRequest("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginForm.username.trim(),
          password: loginForm.password,
          tenantId: DEFAULT_TENANT
        })
      });
      if (!response) return;
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }
      const payload = (await response.json()) as Omit<Session, "tenantId"> & { user: Session["user"] };
      const nextSession = { ...payload, tenantId: payload.user.tenantId || DEFAULT_TENANT };
      const role = (nextSession.user.role as Role) || "ADMIN";
      const cleanUsername = loginForm.username.trim();
      const cleanTenant = payload.user.tenantId || DEFAULT_TENANT;
      setLoginErrors({});
      saveSession(nextSession);
      setLastSyncAt(new Date().toISOString());
      setAuthAssistMode("none");
      if (rememberMe) {
        localStorage.setItem(
          LOGIN_HINT_STORAGE_KEY,
          JSON.stringify({
            username: cleanUsername,
            tenantId: cleanTenant,
            remember: true
          } as RememberedLogin)
        );
      } else {
        localStorage.removeItem(LOGIN_HINT_STORAGE_KEY);
      }
      setNotice("Connexion reussie.");
      setTab(ROLE_HOME_SCREEN[role] || "dashboard");
    } finally {
      setLoadingAuth(false);
    }
  };

  const logout = async (): Promise<void> => {
    const current = sessionRef.current;
    if (current?.refreshToken && (await ensureApiAvailable())) {
      await performPublicRequest("/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken })
      }, { forceProbe: false, suppressError: true });
    }
    clearSession();
    setAuthAssistMode("none");
    setResetPasswordForm({ token: "", newPassword: "", confirmPassword: "" });
    clearData();
    resetStudentForm();
    resetUserForm();
    setTeacherPortalFilters({ classId: "", subjectId: "", academicPeriodId: "", studentId: "" });
    setTeacherGradeForm((prev) => ({
      ...prev,
      studentId: "",
      classId: "",
      subjectId: "",
      academicPeriodId: "",
      score: "",
      scoreMax: "20",
      comment: ""
    }));
    setTeacherAttendanceForm({ classId: "", attendanceDate: today(), defaultStatus: "PRESENT", reason: "" });
    setTeacherAttendanceStudents([]);
    setTeacherNotificationForm({ classId: "", studentId: "", title: "", message: "", channel: "IN_APP" });
    setParentStudentFilter("");
    setMosqueWorkflowStep("members");
    setMosqueMemberFilters({ status: "", q: "" });
    setMosqueActivityFilters({ category: "", from: "", to: "", q: "" });
    setMosqueDonationFilters({ memberId: "", channel: "", from: "", to: "" });
    setMosqueMemberForm({
      memberCode: "",
      fullName: "",
      sex: "",
      phone: "",
      email: "",
      address: "",
      joinedAt: "",
      status: "ACTIVE"
    });
    setMosqueActivityForm({
      code: "",
      title: "",
      activityDate: today(),
      category: "JUMUAH",
      location: "",
      description: "",
      isSchoolLinked: false
    });
    setMosqueDonationForm({
      memberId: "",
      amount: "",
      currency: DEFAULT_CURRENCY,
      channel: "CASH",
      donatedAt: `${today()}T08:00`,
      referenceNo: "",
      notes: ""
    });
    setMosqueExportFormat("PDF");
    setAnalyticsFilters({ from: "", to: "", schoolYearId: "" });
    setAuditFilters({
      resource: "",
      action: "",
      userId: "",
      q: "",
      from: "",
      to: "",
      page: 1,
      pageSize: 20
    });
    setAuditExportFormat("PDF");
    setMosqueMemberErrors({});
    setMosqueActivityErrors({});
    setMosqueDonationErrors({});
    setNotice("Deconnexion reussie.");
    setError(null);
  };

  const submitStudent = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!studentForm.matricule.trim()) errors.matricule = "Matricule requis.";
    if (!studentForm.firstName.trim()) errors.firstName = "Prenom requis.";
    if (!studentForm.lastName.trim()) errors.lastName = "Nom requis.";
    if (!studentForm.sex) errors.sex = "Sexe requis.";
    if (studentForm.birthDate && studentForm.birthDate > today()) {
      errors.birthDate = "Date de naissance invalide.";
    }
    if (studentForm.admissionDate && studentForm.admissionDate > today()) {
      errors.admissionDate = "Date d'admission invalide.";
    }
    if (studentForm.email && !studentForm.email.includes("@")) {
      errors.email = "Email invalide.";
    }
    setStudentErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("entry");
      return;
    }
    const response = await api(editingStudentId ? `/students/${editingStudentId}` : "/students", {
      method: editingStudentId ? "PATCH" : "POST",
      body: JSON.stringify({
        matricule: studentForm.matricule.trim(),
        firstName: studentForm.firstName.trim(),
        lastName: studentForm.lastName.trim(),
        sex: studentForm.sex,
        birthDate: studentForm.birthDate || undefined,
        birthPlace: studentForm.birthPlace.trim() || undefined,
        nationality: studentForm.nationality.trim() || undefined,
        address: studentForm.address.trim() || undefined,
        phone: studentForm.phone.trim() || undefined,
        email: studentForm.email.trim() || undefined,
        establishmentId: studentForm.establishmentId || undefined,
        admissionDate: studentForm.admissionDate || undefined,
        internalId: studentForm.internalId.trim() || undefined,
        birthCertificateNo: studentForm.birthCertificateNo.trim() || undefined,
        specialNeeds: studentForm.specialNeeds.trim() || undefined,
        primaryLanguage: studentForm.primaryLanguage.trim() || undefined,
        status: studentForm.status,
        administrativeNotes: studentForm.administrativeNotes.trim() || undefined
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setStudentErrors({});
    resetStudentForm();
    setNotice(editingStudentId ? "Élève modifié." : "Élève ajouté.");
    setStudentWorkflowStep("list");
    await loadStudents();
    await loadEnrollments();
  };

  const deleteStudent = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer cet élève ?")) return;
    const response = await api(`/students/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    if (editingStudentId === id) resetStudentForm();
    setNotice("Élève supprimé.");
    await loadStudents();
    await loadEnrollments();
  };

  const createRef = async (path: string, payload: unknown, message: string): Promise<boolean> => {
    setError(null);
    const clearReferenceFieldErrors = (): void => {
      if (path === "/school-years") setSchoolYearErrors({});
      if (path === "/cycles") setCycleErrors({});
      if (path === "/levels") setLevelErrors({});
      if (path === "/classes") setClassErrors({});
      if (path === "/subjects") setSubjectErrors({});
      if (path === "/academic-periods") setPeriodErrors({});
    };

    clearReferenceFieldErrors();
    const response = await api(path, { method: "POST", body: JSON.stringify(payload) });
    if (!response.ok) {
      const messageText = await parseError(response);
      const target = getReferenceFieldErrorTarget(path, messageText);
      if (target) {
        const nextErrors = { [target.field]: messageText };
        if (target.scope === "schoolYear") setSchoolYearErrors(nextErrors);
        if (target.scope === "cycle") setCycleErrors(nextErrors);
        if (target.scope === "level") setLevelErrors(nextErrors);
        if (target.scope === "class") setClassErrors(nextErrors);
        if (target.scope === "subject") setSubjectErrors(nextErrors);
        if (target.scope === "period") setPeriodErrors(nextErrors);
      }
      setError(messageText);
      return false;
    }
    setNotice(message);
    await loadReference();
    await loadEnrollments();
    return true;
  };

  const deleteRef = async (path: string, message: string): Promise<void> => {
    const response = await api(path, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setNotice(message);
    await loadReference();
    await loadEnrollments();
  };

  const loadMosqueWithCurrentFilters = async (): Promise<void> => {
    await loadMosqueData({
      memberFilters: mosqueMemberFilters,
      activityFilters: mosqueActivityFilters,
      donationFilters: mosqueDonationFilters
    });
  };

  const exportMosqueData = async (
    scope: "members" | "activities" | "donations"
  ): Promise<void> => {
    setError(null);
    const query = new URLSearchParams();
    query.set("format", mosqueExportFormat);

    if (scope === "members") {
      if (mosqueMemberFilters.status) query.set("status", mosqueMemberFilters.status);
      if (mosqueMemberFilters.q) query.set("q", mosqueMemberFilters.q);
    }
    if (scope === "activities") {
      if (mosqueActivityFilters.category) query.set("category", mosqueActivityFilters.category);
      if (mosqueActivityFilters.from) query.set("from", mosqueActivityFilters.from);
      if (mosqueActivityFilters.to) query.set("to", mosqueActivityFilters.to);
      if (mosqueActivityFilters.q) query.set("q", mosqueActivityFilters.q);
    }
    if (scope === "donations") {
      if (mosqueDonationFilters.memberId) query.set("memberId", mosqueDonationFilters.memberId);
      if (mosqueDonationFilters.channel) query.set("channel", mosqueDonationFilters.channel);
      if (mosqueDonationFilters.from) query.set("from", mosqueDonationFilters.from);
      if (mosqueDonationFilters.to) query.set("to", mosqueDonationFilters.to);
    }

    const response = await api(`/mosque/${scope}/export?${query.toString()}`);
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    const payload = (await response.json()) as MosqueExportResponse;
    triggerFileDownload(payload.fileName, payload.dataUrl);
    setNotice(`Export ${scope} ${payload.format} genere (${payload.rowCount} ligne(s)).`);
  };

  const openMosqueDonationReceipt = async (donationId: string): Promise<void> => {
    setError(null);
    const response = await api(`/mosque/donations/${donationId}/receipt`);
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    const payload = (await response.json()) as MosqueDonationReceipt;
    window.open(payload.pdfDataUrl, "_blank", "noopener,noreferrer");
    setNotice(`Recu ${payload.receiptNo} ouvert.`);
  };

  const exportAuditLogs = async (): Promise<void> => {
    setError(null);
    const query = new URLSearchParams();
    query.set("format", auditExportFormat);
    if (auditFilters.resource) query.set("resource", auditFilters.resource);
    if (auditFilters.action) query.set("action", auditFilters.action);
    if (auditFilters.userId) query.set("userId", auditFilters.userId);
    if (auditFilters.q.trim()) query.set("q", auditFilters.q.trim());
    if (auditFilters.from) query.set("from", auditFilters.from);
    if (auditFilters.to) query.set("to", auditFilters.to);
    query.set("limit", "1000");
    const response = await api(`/analytics/compliance/audit-logs/export?${query.toString()}`);
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    const payload = (await response.json()) as AuditLogExportResponse;
    triggerFileDownload(payload.fileName, payload.dataUrl);
    setNotice(`Export audit ${payload.format} genere (${payload.rowCount} ligne(s)).`);
  };

  const submitMosqueMember = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!mosqueMemberForm.memberCode.trim()) errors.memberCode = "Code membre requis.";
    if (!mosqueMemberForm.fullName.trim()) errors.fullName = "Nom complet requis.";
    if (!mosqueMemberForm.status) errors.status = "Statut requis.";
    setMosqueMemberErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("mosque-members");
      return;
    }

    const response = await api("/mosque/members", {
      method: "POST",
      body: JSON.stringify({
        memberCode: mosqueMemberForm.memberCode.trim(),
        fullName: mosqueMemberForm.fullName.trim(),
        sex: mosqueMemberForm.sex || undefined,
        phone: mosqueMemberForm.phone.trim() || undefined,
        email: mosqueMemberForm.email.trim() || undefined,
        address: mosqueMemberForm.address.trim() || undefined,
        joinedAt: mosqueMemberForm.joinedAt || undefined,
        status: mosqueMemberForm.status
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setMosqueMemberErrors({});
    setNotice("Membre mosquee cree.");
    setMosqueWorkflowStep("members");
    setMosqueMemberForm({
      memberCode: "",
      fullName: "",
      sex: "",
      phone: "",
      email: "",
      address: "",
      joinedAt: "",
      status: "ACTIVE"
    });
    await loadMosqueWithCurrentFilters();
  };

  const deleteMosqueMember = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer ce membre ?")) return;
    const response = await api(`/mosque/members/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setNotice("Membre mosquee supprime.");
    await loadMosqueWithCurrentFilters();
  };

  const submitMosqueActivity = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!mosqueActivityForm.code.trim()) errors.code = "Code activite requis.";
    if (!mosqueActivityForm.title.trim()) errors.title = "Titre activite requis.";
    if (!mosqueActivityForm.activityDate) errors.activityDate = "Date activite requise.";
    if (!mosqueActivityForm.category.trim()) errors.category = "Categorie requise.";
    setMosqueActivityErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("mosque-activities");
      return;
    }

    const response = await api("/mosque/activities", {
      method: "POST",
      body: JSON.stringify({
        code: mosqueActivityForm.code.trim(),
        title: mosqueActivityForm.title.trim(),
        activityDate: mosqueActivityForm.activityDate,
        category: mosqueActivityForm.category.trim(),
        location: mosqueActivityForm.location.trim() || undefined,
        description: mosqueActivityForm.description.trim() || undefined,
        isSchoolLinked: mosqueActivityForm.isSchoolLinked
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setMosqueActivityErrors({});
    setNotice("Activite mosquee creee.");
    setMosqueWorkflowStep("activities");
    setMosqueActivityForm((prev) => ({
      ...prev,
      code: "",
      title: "",
      location: "",
      description: "",
      isSchoolLinked: false
    }));
    await loadMosqueWithCurrentFilters();
  };

  const deleteMosqueActivity = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer cette activite ?")) return;
    const response = await api(`/mosque/activities/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setNotice("Activite mosquee supprimee.");
    await loadMosqueWithCurrentFilters();
  };

  const submitMosqueDonation = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    const amount = Number(mosqueDonationForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.amount = "Montant invalide.";
    }
    if (!mosqueDonationForm.currency.trim()) errors.currency = "Devise requise.";
    if (!mosqueDonationForm.channel) errors.channel = "Canal requis.";
    setMosqueDonationErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("mosque-donations");
      return;
    }

    const response = await api("/mosque/donations", {
      method: "POST",
      body: JSON.stringify({
        memberId: mosqueDonationForm.memberId || undefined,
        amount,
        currency: mosqueDonationForm.currency.trim().toUpperCase(),
        channel: mosqueDonationForm.channel,
        donatedAt: mosqueDonationForm.donatedAt
          ? new Date(mosqueDonationForm.donatedAt).toISOString()
          : undefined,
        referenceNo: mosqueDonationForm.referenceNo.trim() || undefined,
        notes: mosqueDonationForm.notes.trim() || undefined
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setMosqueDonationErrors({});
    setNotice("Don enregistre.");
    setMosqueWorkflowStep("donations");
    setMosqueDonationForm((prev) => ({
      ...prev,
      amount: "",
      referenceNo: "",
      notes: ""
    }));
    await loadMosqueWithCurrentFilters();
  };

  const deleteMosqueDonation = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer ce don ?")) return;
    const response = await api(`/mosque/donations/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setNotice("Don supprime.");
    await loadMosqueWithCurrentFilters();
  };

  const submitEnrollment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!enrollmentForm.schoolYearId) errors.schoolYearId = "Annee scolaire requise.";
    if (!enrollmentForm.classId) errors.classId = "Classe requise.";
    if (!enrollmentForm.studentId) errors.studentId = "Eleve requis.";
    if (!enrollmentForm.track) errors.track = "Cursus requis.";
    if (!enrollmentForm.enrollmentDate) errors.enrollmentDate = "Date d'inscription requise.";
    if (!enrollmentForm.enrollmentStatus.trim()) errors.enrollmentStatus = "Statut requis.";
    const selectedClass = classes.find((item) => item.id === enrollmentForm.classId);
    if (selectedClass && selectedClass.schoolYearId !== enrollmentForm.schoolYearId) {
      errors.classId = "La classe doit appartenir a l'annee selectionnee.";
    }
    if (selectedClass && selectedClass.track !== enrollmentForm.track) {
      errors.track = "Le cursus doit correspondre a la classe selectionnee.";
    }
    setEnrollmentErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("create");
      return;
    }
    const response = await api("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        schoolYearId: enrollmentForm.schoolYearId,
        classId: enrollmentForm.classId,
        studentId: enrollmentForm.studentId,
        track: enrollmentForm.track,
        enrollmentDate: enrollmentForm.enrollmentDate || today(),
        enrollmentStatus: enrollmentForm.enrollmentStatus.trim().toUpperCase() || "ENROLLED"
      })
    });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setEnrollmentErrors({});
    setNotice("Inscription créée.");
    setEnrollmentWorkflowStep("list");
    await loadEnrollments(enrollmentFilters);
  };

  const deleteEnrollment = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer cette inscription ?")) return;
    const response = await api(`/enrollments/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }
    setNotice("Inscription supprimée.");
    await loadEnrollments(enrollmentFilters);
  };

  const resetEnrollmentFilters = async (): Promise<void> => {
    const next = { schoolYearId: "", classId: "", studentId: "", track: "" };
    setEnrollmentFilters(next);
    await loadEnrollments(next);
  };

  const submitFeePlan = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!feePlanForm.schoolYearId) errors.schoolYearId = "Annee scolaire requise.";
    if (!feePlanForm.levelId) errors.levelId = "Niveau requis.";
    if (!feePlanForm.label.trim()) errors.label = "Libelle requis.";
    if (!feePlanForm.currency.trim()) errors.currency = "Devise requise.";
    if (feePlanForm.currency.trim() && feePlanForm.currency.trim().length !== 3) {
      errors.currency = "Code devise sur 3 lettres (ex: CFA, affiche F CFA).";
    }

    const totalAmount = Number(feePlanForm.totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      errors.totalAmount = "Le montant total doit etre > 0.";
    }
    setFeePlanErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("feePlans");
      return;
    }

    const response = await api("/fee-plans", {
      method: "POST",
      body: JSON.stringify({
        schoolYearId: feePlanForm.schoolYearId,
        levelId: feePlanForm.levelId,
        label: feePlanForm.label.trim(),
        totalAmount,
        currency: feePlanForm.currency.trim().toUpperCase()
      })
    });

    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setFeePlanErrors({});
    setNotice("Plan tarifaire cree.");
    setFinanceWorkflowStep("feePlans");
    setFeePlanForm((prev) => ({ ...prev, label: "", totalAmount: "" }));
    await loadFinance();
  };

  const deleteFeePlan = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer ce plan de frais ?")) return;
    const response = await api(`/fee-plans/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setNotice("Plan tarifaire supprime.");
    await loadFinance();
  };

  const submitInvoice = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!invoiceForm.studentId) errors.studentId = "Eleve requis.";
    if (!invoiceForm.schoolYearId) errors.schoolYearId = "Annee scolaire requise.";
    if (!invoiceForm.feePlanId && !invoiceForm.amountDue.trim()) {
      errors.amountDue = "Saisir un montant ou choisir un plan de frais.";
    }

    const payload: Record<string, unknown> = {
      studentId: invoiceForm.studentId,
      schoolYearId: invoiceForm.schoolYearId,
      dueDate: invoiceForm.dueDate || undefined
    };

    if (invoiceForm.feePlanId) {
      payload.feePlanId = invoiceForm.feePlanId;
    }

    if (invoiceForm.amountDue.trim()) {
      const amountDue = Number(invoiceForm.amountDue);
      if (!Number.isFinite(amountDue) || amountDue < 0) {
        errors.amountDue = "Le montant doit etre >= 0.";
      } else {
        payload.amountDue = amountDue;
      }
    }
    setInvoiceErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("invoices");
      return;
    }

    const response = await api("/invoices", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setInvoiceErrors({});
    setNotice("Facture creee.");
    setFinanceWorkflowStep("invoices");
    setInvoiceForm((prev) => ({ ...prev, feePlanId: "", amountDue: "", dueDate: "" }));
    await loadFinance();
  };

  const deleteInvoice = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer cette facture ?")) return;
    const response = await api(`/invoices/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setNotice("Facture supprimee.");
    await loadFinance();
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!paymentForm.invoiceId) errors.invoiceId = "Facture requise.";
    if (!paymentForm.paymentMethod) errors.paymentMethod = "Mode de paiement requis.";

    const paidAmount = Number(paymentForm.paidAmount);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      errors.paidAmount = "Le montant verse doit etre > 0.";
    }
    setPaymentErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("payments");
      return;
    }

    const response = await api("/payments", {
      method: "POST",
      body: JSON.stringify({
        invoiceId: paymentForm.invoiceId,
        paidAmount,
        paymentMethod: paymentForm.paymentMethod,
        referenceExternal: paymentForm.referenceExternal || undefined
      })
    });

    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setPaymentErrors({});
    setNotice("Paiement enregistre.");
    setFinanceWorkflowStep("payments");
    setPaymentForm((prev) => ({ ...prev, paidAmount: "", referenceExternal: "" }));
    await loadFinance();
  };

  const openReceipt = async (paymentId: string): Promise<void> => {
    const response = await api(`/payments/${paymentId}/receipt`);
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    const payload = (await response.json()) as { pdfDataUrl: string };
    setReceiptPdfUrl(payload.pdfDataUrl);
    window.open(payload.pdfDataUrl, "_blank", "noopener,noreferrer");
  };

  const hasCompatibleClassPeriod = (classId: string, academicPeriodId: string): boolean => {
    const classroom = classes.find((item) => item.id === classId);
    const period = periods.find((item) => item.id === academicPeriodId);
    if (!classroom || !period) {
      return false;
    }
    return classroom.schoolYearId === period.schoolYearId;
  };

  const submitGrade = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!gradeForm.studentId) errors.studentId = "Eleve requis.";
    if (!gradeForm.classId) errors.classId = "Classe requise.";
    if (!gradeForm.subjectId) errors.subjectId = "Matiere requise.";
    if (!gradeForm.academicPeriodId) errors.academicPeriodId = "Periode requise.";
    if (!gradeForm.assessmentLabel.trim()) errors.assessmentLabel = "Evaluation requise.";

    const score = Number(gradeForm.score);
    const scoreMax = Number(gradeForm.scoreMax || "20");

    if (!Number.isFinite(score) || score < 0) {
      errors.score = "La note doit etre >= 0.";
    }

    if (!Number.isFinite(scoreMax) || scoreMax <= 0) {
      errors.scoreMax = "Le bareme doit etre > 0.";
    }
    if (Number.isFinite(score) && Number.isFinite(scoreMax) && score > scoreMax) {
      errors.score = "La note ne peut pas depasser le bareme.";
    }

    if (!hasCompatibleClassPeriod(gradeForm.classId, gradeForm.academicPeriodId)) {
      errors.academicPeriodId = "La periode doit appartenir a la meme annee scolaire.";
    }
    setGradeErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("entry");
      return;
    }

    const response = await api("/grades", {
      method: "POST",
      body: JSON.stringify({
        studentId: gradeForm.studentId,
        classId: gradeForm.classId,
        subjectId: gradeForm.subjectId,
        academicPeriodId: gradeForm.academicPeriodId,
        assessmentLabel: gradeForm.assessmentLabel.trim(),
        assessmentType: gradeForm.assessmentType,
        score,
        scoreMax
      })
    });

    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setGradeErrors({});
    setNotice("Note enregistree.");
    setGradesWorkflowStep("entry");
    setGradeForm((prev) => ({ ...prev, score: "" }));
    await loadGrades(gradeFilters);
    await loadReportCards();
  };

  const applyGradeFilters = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    if (
      gradeFilters.classId &&
      gradeFilters.academicPeriodId &&
      !hasCompatibleClassPeriod(gradeFilters.classId, gradeFilters.academicPeriodId)
    ) {
      setError("La periode filtree doit appartenir a la meme annee scolaire que la classe.");
      return;
    }
    await loadGrades(gradeFilters);
  };

  const computeClassSummary = async (): Promise<void> => {
    if (!gradeFilters.classId || !gradeFilters.academicPeriodId) {
      setError("Selectionne d'abord une classe et une periode.");
      return;
    }

    if (!hasCompatibleClassPeriod(gradeFilters.classId, gradeFilters.academicPeriodId)) {
      setError("La periode doit appartenir a la meme annee scolaire que la classe selectionnee.");
      return;
    }

    const response = await api(
      `/grades/class-summary?classId=${encodeURIComponent(gradeFilters.classId)}&academicPeriodId=${encodeURIComponent(gradeFilters.academicPeriodId)}`
    );

    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setClassSummary((await response.json()) as ClassSummary);
    setGradesWorkflowStep("summary");
    setNotice("Synthese de classe calculee.");
  };

  const generateReportCard = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    const errors: FieldErrors = {};
    if (!reportForm.studentId) errors.studentId = "Eleve requis.";
    if (!reportForm.classId) errors.classId = "Classe requise.";
    if (!reportForm.academicPeriodId) errors.academicPeriodId = "Periode requise.";

    if (!hasCompatibleClassPeriod(reportForm.classId, reportForm.academicPeriodId)) {
      errors.academicPeriodId = "Classe et periode doivent etre dans la meme annee scolaire.";
    }
    setReportErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("reports");
      return;
    }

    const response = await api("/report-cards/generate", {
      method: "POST",
      body: JSON.stringify({
        studentId: reportForm.studentId,
        classId: reportForm.classId,
        academicPeriodId: reportForm.academicPeriodId,
        publish: true
      })
    });

    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setReportErrors({});
    const payload = (await response.json()) as ReportCard;
    setReportPdfUrl(payload.pdfDataUrl || "");
    if (payload.pdfDataUrl) {
      window.open(payload.pdfDataUrl, "_blank", "noopener,noreferrer");
    }

    setNotice("Bulletin(s) genere(s).");
    setGradesWorkflowStep("reports");
    await loadReportCards();
  };

  const openReportCardPdf = async (reportCardId: string): Promise<void> => {
    const response = await api(`/report-cards/${reportCardId}/pdf`);
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    const payload = (await response.json()) as { pdfDataUrl: string };
    setReportPdfUrl(payload.pdfDataUrl);
    window.open(payload.pdfDataUrl, "_blank", "noopener,noreferrer");
  };

  const schoolYearById = new Map(schoolYears.map((item) => [item.id, item]));
  const classById = new Map(classes.map((item) => [item.id, item]));
  const studentById = new Map(students.map((item) => [item.id, item]));
  const levelById = new Map(levels.map((item) => [item.id, item]));
  const formatAmount = (value: number): string =>
    new Intl.NumberFormat(currentLanguageMeta.locale, { maximumFractionDigits: 0 }).format(value);
  const formatCurrencyLabel = (currency?: string): string => {
    const normalized = (currency || DEFAULT_CURRENCY).trim().toUpperCase();
    return normalized === "XOF" || normalized === "CFA" ? "F CFA" : normalized;
  };
  const formatChannelLabel = (value?: string): string => {
    const normalized = (value || "").trim().toUpperCase();
    return CHANNEL_LABELS[normalized] || value || "-";
  };
  const formatMoney = (value: number, currency?: string): string =>
    `${formatAmount(value)} ${formatCurrencyLabel(currency)}`;
  const gradeFilterClass = classById.get(gradeFilters.classId);
  const gradeFormClass = classById.get(gradeForm.classId);
  const reportFormClass = classById.get(reportForm.classId);

  const gradeFilterPeriods = gradeFilterClass
    ? periods.filter((item) => item.schoolYearId === gradeFilterClass.schoolYearId)
    : periods;
  const gradeFormPeriods = gradeFormClass
    ? periods.filter((item) => item.schoolYearId === gradeFormClass.schoolYearId)
    : periods;
  const reportFormPeriods = reportFormClass
    ? periods.filter((item) => item.schoolYearId === reportFormClass.schoolYearId)
    : periods;
  const formatReportCardAverage = (item: ReportCard): string => {
    if (item.mode === "PRIMARY_COMBINED" && item.sections && item.sections.length > 0) {
      return item.sections
        .map((section) => `${formatAcademicTrackLabel(section.track)} ${section.averageGeneral.toFixed(2)}`)
        .join(" | ");
    }

    return item.averageGeneral.toFixed(2);
  };
  const formatReportCardContext = (item: ReportCard): string => {
    if (item.mode === "PRIMARY_COMBINED" && item.sections && item.sections.length > 0) {
      return item.sections
        .map((section) =>
          [formatAcademicTrackLabel(section.track), section.classLabel || section.levelLabel]
            .filter(Boolean)
            .join(" / ")
        )
        .join(" | ");
    }

    return item.classLabel || classById.get(item.classId)?.label || "-";
  };

  const renderStudents = (): JSX.Element => {
    return (
      <StudentsScreen
        editingStudentId={editingStudentId}
        studentErrors={studentErrors}
        studentForm={studentForm}
        studentSearch={studentSearch}
        studentWorkflowStep={studentWorkflowStep}
        students={students}
        studentsLoading={studentsLoading}
        shownStudents={shownStudents}
        onDeleteStudent={(studentId) => void deleteStudent(studentId)}
        onEditStudent={(student) => {
          setEditingStudentId(student.id);
          setStudentForm({
            matricule: student.matricule,
            firstName: student.firstName,
            lastName: student.lastName,
            sex: student.sex,
            birthDate: student.birthDate || "",
            birthPlace: student.birthPlace || "",
            nationality: student.nationality || "",
            address: student.address || "",
            phone: student.phone || "",
            email: student.email || "",
            establishmentId: student.establishmentId || "",
            admissionDate: student.admissionDate || "",
            internalId: student.internalId || "",
            birthCertificateNo: student.birthCertificateNo || "",
            specialNeeds: student.specialNeeds || "",
            primaryLanguage: student.primaryLanguage || "",
            status: student.status || "ACTIVE",
            administrativeNotes: student.administrativeNotes || ""
          });
          setStudentWorkflowStep("entry");
        }}
        onResetStudentForm={resetStudentForm}
        onSearchChange={setStudentSearch}
        onStudentFormChange={setStudentForm}
        onStudentWorkflowStepChange={setStudentWorkflowStep}
        onSubmitStudent={(event) => void submitStudent(event)}
        renderFieldError={fieldError}
      />
    );
  };
  const renderFinance = (): JSX.Element => {
    const financeSteps: WorkflowStepDef[] = [
      { id: "overview", title: "Pilotage", hint: "Suivre recouvrement et caisses.", done: !!recovery },
      { id: "feePlans", title: "Plans de frais", hint: "Definir les plans de frais.", done: feePlans.length > 0 },
      { id: "invoices", title: "Factures", hint: "Generer les factures eleves.", done: invoices.length > 0 },
      { id: "payments", title: "Paiements", hint: "Enregistrer les encaissements.", done: payments.length > 0 }
    ];

    const scrollToFinance = (stepId: string): void => {
      setFinanceWorkflowStep(stepId);
      const targetByStep: Record<string, string> = {
        overview: "finance-overview",
        feePlans: "finance-fee-plans",
        invoices: "finance-invoices",
        payments: "finance-payments"
      };
      const target = targetByStep[stepId];
      if (!target) return;
      window.setTimeout(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    };
    const openInvoicesCount = invoices.filter((item) => item.status !== "PAID").length;
    const paidInvoicesCount = invoices.filter((item) => item.status === "PAID").length;

    return (
      <WorkflowGuide
        title="Comptabilite"
        steps={financeSteps}
        activeStepId={financeWorkflowStep}
        onStepChange={scrollToFinance}
      >
        {financeWorkflowStep === "overview" ? (
        <section className="panel table-panel workflow-section module-modern module-overview-shell">
          <div className="table-header">
            <div>
              <p className="section-kicker">Finance v2</p>
              <h2>Console de recouvrement</h2>
            </div>
            <span className="module-header-badge">
              {(recovery?.totals.recoveryRatePercent || 0).toFixed(1)}% recouvrement
            </span>
          </div>
          <p className="section-lead">
            Meme logique visuelle que FlexAdmin: synthese en tete, formulaires plus nets et tableaux
            de caisse resserres pour la lecture quotidienne.
          </p>
          <div className="module-overview-grid">
            <article className="module-overview-card">
              <span>Plans</span>
              <strong>{feePlans.length}</strong>
              <small>Grilles tarifaires actives</small>
            </article>
            <article className="module-overview-card">
              <span>Factures ouvertes</span>
              <strong>{openInvoicesCount}</strong>
              <small>Suivi des impayes</small>
            </article>
            <article className="module-overview-card">
              <span>Factures reglees</span>
              <strong>{paidInvoicesCount}</strong>
              <small>Dossiers finalises</small>
            </article>
            <article className="module-overview-card">
              <span>Paiements</span>
              <strong>{payments.length}</strong>
              <small>Encaissements saisis</small>
            </article>
          </div>
          <div className="module-inline-strip">
            <span className="module-inline-pill">
              Du: {formatMoney(recovery?.totals.amountDue || 0)}
            </span>
            <span className="module-inline-pill">
              Encaisse: {formatMoney(recovery?.totals.amountPaid || 0)}
            </span>
            <span className="module-inline-pill">
              Reste: {formatMoney(recovery?.totals.remainingAmount || 0)}
            </span>
          </div>
        </section>
        ) : null}

        <section id="finance-overview" data-step-id="overview" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <div>
              <p className="section-kicker">Synthese</p>
              <h2>Synthese du recouvrement</h2>
            </div>
            <span className="module-header-badge">Pilotage journalier</span>
          </div>
          <p className="section-lead">Suivez la sante financiere avant de passer aux operations de saisie.</p>
          <div className="metrics-grid">
            <article className="metric-card">
              <span>Total du</span>
              <strong>{formatMoney(recovery?.totals.amountDue || 0)}</strong>
            </article>
            <article className="metric-card">
              <span>Montant encaisse</span>
              <strong>{formatMoney(recovery?.totals.amountPaid || 0)}</strong>
            </article>
            <article className="metric-card">
              <span>Reste a recouvrer</span>
              <strong>{formatMoney(recovery?.totals.remainingAmount || 0)}</strong>
            </article>
            <article className="metric-card">
              <span>Taux recouvrement</span>
              <strong>{(recovery?.totals.recoveryRatePercent || 0).toFixed(2)}%</strong>
            </article>
          </div>
          <div className="actions">
            <button type="button" className="button-ghost" onClick={() => void loadFinance()}>
              Recharger comptabilite
            </button>
            {receiptPdfUrl ? (
              <button
                type="button"
                className="button-ghost"
                onClick={() => window.open(receiptPdfUrl, "_blank", "noopener,noreferrer")}
              >
                Ouvrir le dernier recu
              </button>
            ) : null}
          </div>
        </section>

        <section id="finance-fee-plans" data-step-id="feePlans" className="panel editor-panel workflow-section module-modern">
          <div className="table-header">
            <div>
              <p className="section-kicker">Tarification</p>
              <h2>Plans de frais</h2>
            </div>
            <span className="module-header-badge">{feePlans.length} plan(s)</span>
          </div>
          <p className="section-lead">Definissez les frais par annee et niveau, puis reutilisez-les pour la facturation.</p>
          <form className="form-grid module-form" onSubmit={(event) => void submitFeePlan(event)}>
            <label>
              Annee scolaire
              <select
                value={feePlanForm.schoolYearId}
                onChange={(event) => setFeePlanForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {schoolYears.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
              {fieldError(feePlanErrors, "schoolYearId")}
            </label>
            <label>
              Niveau
              <select
                value={feePlanForm.levelId}
                onChange={(event) => setFeePlanForm((prev) => ({ ...prev, levelId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {levels.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {fieldError(feePlanErrors, "levelId")}
            </label>
            <label>
              Libelle
              <input
                value={feePlanForm.label}
                onChange={(event) => setFeePlanForm((prev) => ({ ...prev, label: event.target.value }))}
                required
              />
              {fieldError(feePlanErrors, "label")}
            </label>
            <label>
              Montant total
              <input
                type="number"
                min={0}
                value={feePlanForm.totalAmount}
                onChange={(event) => setFeePlanForm((prev) => ({ ...prev, totalAmount: event.target.value }))}
                required
              />
              {fieldError(feePlanErrors, "totalAmount")}
            </label>
            <label>
              Devise
              <input
                maxLength={3}
                value={feePlanForm.currency}
                onChange={(event) => setFeePlanForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
              />
              {fieldError(feePlanErrors, "currency")}
            </label>
            <button type="submit">Creer le plan de frais</button>
          </form>
        </section>

        <section data-step-id="feePlans" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <div>
              <p className="section-kicker">Catalogue</p>
              <h2>Liste des plans de frais</h2>
            </div>
            <span className="module-header-badge">{feePlans.length} plan(s)</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Libelle</th>
                  <th>Annee</th>
                  <th>Niveau</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {feePlans.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-row">
                      Aucun plan de frais.
                    </td>
                  </tr>
                ) : (
                  feePlans.map((item) => (
                    <tr key={item.id}>
                      <td>{item.label}</td>
                      <td>{schoolYearById.get(item.schoolYearId)?.code || "-"}</td>
                      <td>{levelById.get(item.levelId)?.label || "-"}</td>
                      <td>{formatMoney(item.totalAmount, item.currency)}</td>
                      <td>
                        <button type="button" className="button-danger" onClick={() => void deleteFeePlan(item.id)}>
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="finance-invoices" data-step-id="invoices" className="panel editor-panel workflow-section module-modern">
          <div className="table-header">
            <div>
              <p className="section-kicker">Facturation</p>
              <h2>Factures</h2>
            </div>
            <span className="module-header-badge">{invoices.length} facture(s)</span>
          </div>
          <p className="section-lead">Associez un eleve, une annee et un montant du pour generer une facture claire.</p>
          <form className="form-grid module-form" onSubmit={(event) => void submitInvoice(event)}>
            <label>
              Eleve
              <select
                value={invoiceForm.studentId}
                onChange={(event) => setInvoiceForm((prev) => ({ ...prev, studentId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.matricule} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
              {fieldError(invoiceErrors, "studentId")}
            </label>
            <label>
              Annee scolaire
              <select
                value={invoiceForm.schoolYearId}
                onChange={(event) => setInvoiceForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {schoolYears.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code}
                  </option>
                ))}
              </select>
              {fieldError(invoiceErrors, "schoolYearId")}
            </label>
            <label>
              Plan de frais (optionnel)
              <select
                value={invoiceForm.feePlanId}
                onChange={(event) => setInvoiceForm((prev) => ({ ...prev, feePlanId: event.target.value }))}
              >
                <option value="">Aucun (montant manuel)</option>
                {feePlans.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              {fieldError(invoiceErrors, "feePlanId")}
            </label>
            <label>
              Montant du (optionnel)
              <input
                type="number"
                min={0}
                value={invoiceForm.amountDue}
                onChange={(event) => setInvoiceForm((prev) => ({ ...prev, amountDue: event.target.value }))}
                placeholder="Requis si aucun plan de frais"
              />
              {fieldError(invoiceErrors, "amountDue")}
            </label>
            <label>
              Date echeance
              <input
                type="date"
                value={invoiceForm.dueDate}
                onChange={(event) => setInvoiceForm((prev) => ({ ...prev, dueDate: event.target.value }))}
              />
            </label>
            <button type="submit">Creer facture</button>
          </form>
        </section>

        <section data-step-id="invoices" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <div>
              <p className="section-kicker">Registre</p>
              <h2>Liste factures</h2>
            </div>
            <span className="module-header-badge">{invoices.length} facture(s)</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Eleve</th>
                  <th>Classe principale</th>
                  <th>Classe secondaire</th>
                  <th>Du</th>
                  <th>Paye</th>
                  <th>Reste</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty-row">
                      Aucune facture.
                    </td>
                  </tr>
                ) : (
                  invoices.map((item) => (
                    <tr key={item.id}>
                      <td>{item.invoiceNo}</td>
                      <td>{item.studentName || studentById.get(item.studentId)?.matricule || "-"}</td>
                      <td>
                        {[item.primaryClassLabel, item.primaryTrack ? formatAcademicTrackLabel(item.primaryTrack) : undefined]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </td>
                      <td>
                        {[item.secondaryClassLabel, item.secondaryTrack ? formatAcademicTrackLabel(item.secondaryTrack) : undefined]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </td>
                      <td>{formatAmount(item.amountDue)}</td>
                      <td>{formatAmount(item.amountPaid)}</td>
                      <td>{formatAmount(item.remainingAmount)}</td>
                      <td>{formatInvoiceStatusLabel(item.status)}</td>
                      <td>
                        <button type="button" className="button-danger" onClick={() => void deleteInvoice(item.id)}>
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="finance-payments" data-step-id="payments" className="panel editor-panel workflow-section module-modern">
          <div className="table-header">
            <div>
              <p className="section-kicker">Encaissements</p>
              <h2>Paiements</h2>
            </div>
            <span className="module-header-badge">{payments.length} recu(s)</span>
          </div>
          <p className="section-lead">Enregistrez chaque encaissement et rattachez-le a la facture correspondante.</p>
          <form className="form-grid module-form" onSubmit={(event) => void submitPayment(event)}>
            <label>
              Facture
              <select
                value={paymentForm.invoiceId}
                onChange={(event) => setPaymentForm((prev) => ({ ...prev, invoiceId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {invoices.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.invoiceNo} - reste {formatAmount(item.remainingAmount)}
                  </option>
                ))}
              </select>
              {fieldError(paymentErrors, "invoiceId")}
            </label>
            <label>
              Montant verse
              <input
                type="number"
                min={0}
                value={paymentForm.paidAmount}
                onChange={(event) => setPaymentForm((prev) => ({ ...prev, paidAmount: event.target.value }))}
                required
              />
              {fieldError(paymentErrors, "paidAmount")}
            </label>
            <label>
              Mode paiement
              <select
                value={paymentForm.paymentMethod}
                onChange={(event) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    paymentMethod: event.target.value as "CASH" | "MOBILE_MONEY" | "BANK"
                  }))
                }
              >
                <option value="CASH">{formatChannelLabel("CASH")}</option>
                <option value="MOBILE_MONEY">{formatChannelLabel("MOBILE_MONEY")}</option>
                <option value="BANK">{formatChannelLabel("BANK")}</option>
              </select>
              {fieldError(paymentErrors, "paymentMethod")}
            </label>
            <label>
              Reference externe
              <input
                value={paymentForm.referenceExternal}
                onChange={(event) => setPaymentForm((prev) => ({ ...prev, referenceExternal: event.target.value }))}
              />
            </label>
            <button type="submit">Enregistrer paiement</button>
          </form>
        </section>

        <section data-step-id="payments" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <div>
              <p className="section-kicker">Historique</p>
              <h2>Historique paiements</h2>
            </div>
            <span className="module-header-badge">{payments.length} operation(s)</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Recu</th>
                  <th>Facture</th>
                  <th>Eleve</th>
                  <th>Montant</th>
                  <th>Mode</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-row">
                      Aucun paiement.
                    </td>
                  </tr>
                ) : (
                  payments.map((item) => (
                    <tr key={item.id}>
                      <td>{item.receiptNo}</td>
                      <td>{item.invoiceNo || "-"}</td>
                      <td>{item.studentName || "-"}</td>
                      <td>{formatAmount(item.paidAmount)}</td>
                      <td>{formatChannelLabel(item.paymentMethod)}</td>
                      <td>{new Date(item.paidAt).toLocaleString(currentLanguageMeta.locale)}</td>
                      <td>
                        <button type="button" className="button-ghost" onClick={() => void openReceipt(item.id)}>
                          Recu en PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </WorkflowGuide>
    );
  };

  const renderMosque = (): JSX.Element => {
    return <ConstructionPageMosquee />;

    const mosqueSteps: WorkflowStepDef[] = [
      { id: "members", title: "Membres", hint: "Gerer le registre des fideles.", done: mosqueMembers.length > 0 },
      { id: "activities", title: "Activites", hint: "Planifier les activites de la mosquee.", done: mosqueActivities.length > 0 },
      { id: "donations", title: "Dons", hint: "Saisir et suivre les donations.", done: mosqueDonations.length > 0 },
      { id: "overview", title: "Pilotage", hint: "Suivre les indicateurs clefs du module.", done: !!mosqueDashboard }
    ];

    const scrollToMosque = (stepId: string): void => {
      setMosqueWorkflowStep(stepId);
      const targetByStep: Record<string, string> = {
        members: "mosque-members",
        activities: "mosque-activities",
        donations: "mosque-donations",
        overview: "mosque-overview"
      };
      const target = targetByStep[stepId];
      if (!target) return;
      window.setTimeout(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    };

    return (
      <WorkflowGuide
        title="Module mosquee"
        steps={mosqueSteps}
        activeStepId={mosqueWorkflowStep}
        onStepChange={scrollToMosque}
      >
        <>
          <section id="mosque-members" data-step-id="members" className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Registre des membres</h2>
              <div className="inline-actions">
                <label>
                  Format
                  <select
                    value={mosqueExportFormat}
                    onChange={(event) =>
                      setMosqueExportFormat(event.target.value as "PDF" | "EXCEL")
                    }
                  >
                    <option value="PDF">PDF</option>
                    <option value="EXCEL">Excel</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => void exportMosqueData("members")}
                >
                  Exporter membres
                </button>
              </div>
            </div>
            <form data-step-id="mosque-members" className="form-grid compact-form" onSubmit={(event) => void submitMosqueMember(event)}>
              <label>
                Code membre
                <input value={mosqueMemberForm.memberCode} onChange={(event) => setMosqueMemberForm((prev) => ({ ...prev, memberCode: event.target.value }))} required />
                {fieldError(mosqueMemberErrors, "memberCode")}
              </label>
              <label>
                Nom complet
                <input value={mosqueMemberForm.fullName} onChange={(event) => setMosqueMemberForm((prev) => ({ ...prev, fullName: event.target.value }))} required />
                {fieldError(mosqueMemberErrors, "fullName")}
              </label>
              <label>
                Sexe
                <select value={mosqueMemberForm.sex} onChange={(event) => setMosqueMemberForm((prev) => ({ ...prev, sex: event.target.value }))}>
                  <option value="">Non precise</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </label>
              <label>
                Statut
                <select value={mosqueMemberForm.status} onChange={(event) => setMosqueMemberForm((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="ACTIVE">{formatMemberStatusLabel("ACTIVE")}</option>
                  <option value="INACTIVE">{formatMemberStatusLabel("INACTIVE")}</option>
                </select>
                {fieldError(mosqueMemberErrors, "status")}
              </label>
              <label>
                Telephone
                <input value={mosqueMemberForm.phone} onChange={(event) => setMosqueMemberForm((prev) => ({ ...prev, phone: event.target.value }))} />
              </label>
              <label>
                Email
                <input type="email" value={mosqueMemberForm.email} onChange={(event) => setMosqueMemberForm((prev) => ({ ...prev, email: event.target.value }))} />
              </label>
              <label>
                Date adhesion
                <input type="date" value={mosqueMemberForm.joinedAt} onChange={(event) => setMosqueMemberForm((prev) => ({ ...prev, joinedAt: event.target.value }))} />
              </label>
              <label>
                Adresse
                <input value={mosqueMemberForm.address} onChange={(event) => setMosqueMemberForm((prev) => ({ ...prev, address: event.target.value }))} />
              </label>
              <button type="submit">Creer membre</button>
            </form>

            <form
              className="filter-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void loadMosqueWithCurrentFilters();
              }}
            >
              <label>
                Statut
                <select value={mosqueMemberFilters.status} onChange={(event) => setMosqueMemberFilters((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="">Tous</option>
                  <option value="ACTIVE">{formatMemberStatusLabel("ACTIVE")}</option>
                  <option value="INACTIVE">{formatMemberStatusLabel("INACTIVE")}</option>
                </select>
              </label>
              <label>
                Recherche
                <input value={mosqueMemberFilters.q} onChange={(event) => setMosqueMemberFilters((prev) => ({ ...prev, q: event.target.value }))} placeholder="Nom, code ou telephone" />
              </label>
              <div className="actions">
                <button type="submit">Filtrer</button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => {
                    const next = { status: "", q: "" };
                    setMosqueMemberFilters(next);
                    void loadMosqueData({
                      memberFilters: next,
                      activityFilters: mosqueActivityFilters,
                      donationFilters: mosqueDonationFilters
                    });
                  }}
                >
                  Reinitialiser
                </button>
              </div>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Nom</th>
                    <th>Statut</th>
                    <th>Contact</th>
                    <th>Adhesion</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mosqueMembers.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucun membre.</td></tr>
                  ) : (
                    mosqueMembers.map((item) => (
                      <tr key={item.id}>
                        <td>{item.memberCode}</td>
                        <td>{item.fullName}</td>
                        <td>{formatMemberStatusLabel(item.status)}</td>
                        <td>{item.phone || item.email || "-"}</td>
                        <td>{item.joinedAt || "-"}</td>
                        <td>
                          <button type="button" className="button-danger" onClick={() => void deleteMosqueMember(item.id)}>
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section id="mosque-activities" data-step-id="activities" className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Activites mosquee</h2>
              <div className="inline-actions">
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => void exportMosqueData("activities")}
                >
                  Exporter activites
                </button>
              </div>
            </div>
            <form data-step-id="mosque-activities" className="form-grid compact-form" onSubmit={(event) => void submitMosqueActivity(event)}>
              <label>
                Code
                <input value={mosqueActivityForm.code} onChange={(event) => setMosqueActivityForm((prev) => ({ ...prev, code: event.target.value }))} required />
                {fieldError(mosqueActivityErrors, "code")}
              </label>
              <label>
                Titre
                <input value={mosqueActivityForm.title} onChange={(event) => setMosqueActivityForm((prev) => ({ ...prev, title: event.target.value }))} required />
                {fieldError(mosqueActivityErrors, "title")}
              </label>
              <label>
                Date
                <input type="date" value={mosqueActivityForm.activityDate} onChange={(event) => setMosqueActivityForm((prev) => ({ ...prev, activityDate: event.target.value }))} required />
                {fieldError(mosqueActivityErrors, "activityDate")}
              </label>
              <label>
                Categorie
                <input value={mosqueActivityForm.category} onChange={(event) => setMosqueActivityForm((prev) => ({ ...prev, category: event.target.value }))} required />
                {fieldError(mosqueActivityErrors, "category")}
              </label>
              <label>
                Lieu
                <input value={mosqueActivityForm.location} onChange={(event) => setMosqueActivityForm((prev) => ({ ...prev, location: event.target.value }))} />
              </label>
              <label className="check-row">
                <input type="checkbox" checked={mosqueActivityForm.isSchoolLinked} onChange={(event) => setMosqueActivityForm((prev) => ({ ...prev, isSchoolLinked: event.target.checked }))} />
                Liee a la vie scolaire
              </label>
              <label>
                Description
                <input value={mosqueActivityForm.description} onChange={(event) => setMosqueActivityForm((prev) => ({ ...prev, description: event.target.value }))} />
              </label>
              <button type="submit">Creer activite</button>
            </form>

            <form
              className="filter-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void loadMosqueWithCurrentFilters();
              }}
            >
              <label>
                Categorie
                <input value={mosqueActivityFilters.category} onChange={(event) => setMosqueActivityFilters((prev) => ({ ...prev, category: event.target.value }))} />
              </label>
              <label>
                Du
                <input type="date" value={mosqueActivityFilters.from} onChange={(event) => setMosqueActivityFilters((prev) => ({ ...prev, from: event.target.value }))} />
              </label>
              <label>
                Au
                <input type="date" value={mosqueActivityFilters.to} onChange={(event) => setMosqueActivityFilters((prev) => ({ ...prev, to: event.target.value }))} />
              </label>
              <label>
                Recherche
                <input value={mosqueActivityFilters.q} onChange={(event) => setMosqueActivityFilters((prev) => ({ ...prev, q: event.target.value }))} />
              </label>
              <div className="actions">
                <button type="submit">Filtrer</button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => {
                    const next = { category: "", from: "", to: "", q: "" };
                    setMosqueActivityFilters(next);
                    void loadMosqueData({
                      memberFilters: mosqueMemberFilters,
                      activityFilters: next,
                      donationFilters: mosqueDonationFilters
                    });
                  }}
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
                    <th>Code</th>
                    <th>Titre</th>
                    <th>Categorie</th>
                    <th>Lieu</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mosqueActivities.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucune activite.</td></tr>
                  ) : (
                    mosqueActivities.map((item) => (
                      <tr key={item.id}>
                        <td>{item.activityDate}</td>
                        <td>{item.code}</td>
                        <td>{item.title}</td>
                        <td>{item.category}</td>
                        <td>{item.location || "-"}</td>
                        <td>
                          <button type="button" className="button-danger" onClick={() => void deleteMosqueActivity(item.id)}>
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section id="mosque-donations" data-step-id="donations" className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Dons & recettes</h2>
              <div className="inline-actions">
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => void exportMosqueData("donations")}
                >
                  Exporter dons
                </button>
              </div>
            </div>
            <form data-step-id="mosque-donations" className="form-grid compact-form" onSubmit={(event) => void submitMosqueDonation(event)}>
              <label>
                Membre (optionnel)
                <select value={mosqueDonationForm.memberId} onChange={(event) => setMosqueDonationForm((prev) => ({ ...prev, memberId: event.target.value }))}>
                  <option value="">Aucun</option>
                  {mosqueMembers.map((item) => (
                    <option key={item.id} value={item.id}>{item.memberCode} - {item.fullName}</option>
                  ))}
                </select>
              </label>
              <label>
                Montant
                <input type="number" min={0} value={mosqueDonationForm.amount} onChange={(event) => setMosqueDonationForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                {fieldError(mosqueDonationErrors, "amount")}
              </label>
              <label>
                Devise
                <input value={mosqueDonationForm.currency} onChange={(event) => setMosqueDonationForm((prev) => ({ ...prev, currency: event.target.value }))} />
                {fieldError(mosqueDonationErrors, "currency")}
              </label>
              <label>
                Canal
                <select value={mosqueDonationForm.channel} onChange={(event) => setMosqueDonationForm((prev) => ({ ...prev, channel: event.target.value }))}>
                  <option value="CASH">{formatChannelLabel("CASH")}</option>
                  <option value="MOBILE_MONEY">{formatChannelLabel("MOBILE_MONEY")}</option>
                  <option value="BANK">{formatChannelLabel("BANK")}</option>
                  <option value="TRANSFER">{formatChannelLabel("TRANSFER")}</option>
                  <option value="OTHER">{formatChannelLabel("OTHER")}</option>
                </select>
                {fieldError(mosqueDonationErrors, "channel")}
              </label>
              <label>
                Date/heure don
                <input type="datetime-local" value={mosqueDonationForm.donatedAt} onChange={(event) => setMosqueDonationForm((prev) => ({ ...prev, donatedAt: event.target.value }))} />
              </label>
              <label>
                Reference
                <input value={mosqueDonationForm.referenceNo} onChange={(event) => setMosqueDonationForm((prev) => ({ ...prev, referenceNo: event.target.value }))} />
              </label>
              <label>
                Notes
                <input value={mosqueDonationForm.notes} onChange={(event) => setMosqueDonationForm((prev) => ({ ...prev, notes: event.target.value }))} />
              </label>
              <button type="submit">Enregistrer don</button>
            </form>

            <form
              className="filter-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void loadMosqueWithCurrentFilters();
              }}
            >
              <label>
                Membre
                <select value={mosqueDonationFilters.memberId} onChange={(event) => setMosqueDonationFilters((prev) => ({ ...prev, memberId: event.target.value }))}>
                  <option value="">Tous</option>
                  {mosqueMembers.map((item) => (
                    <option key={item.id} value={item.id}>{item.memberCode}</option>
                  ))}
                </select>
              </label>
              <label>
                Canal
                <select value={mosqueDonationFilters.channel} onChange={(event) => setMosqueDonationFilters((prev) => ({ ...prev, channel: event.target.value }))}>
                  <option value="">Tous</option>
                  <option value="CASH">{formatChannelLabel("CASH")}</option>
                  <option value="MOBILE_MONEY">{formatChannelLabel("MOBILE_MONEY")}</option>
                  <option value="BANK">{formatChannelLabel("BANK")}</option>
                  <option value="TRANSFER">{formatChannelLabel("TRANSFER")}</option>
                  <option value="OTHER">{formatChannelLabel("OTHER")}</option>
                </select>
              </label>
              <label>
                Du
                <input type="date" value={mosqueDonationFilters.from} onChange={(event) => setMosqueDonationFilters((prev) => ({ ...prev, from: event.target.value }))} />
              </label>
              <label>
                Au
                <input type="date" value={mosqueDonationFilters.to} onChange={(event) => setMosqueDonationFilters((prev) => ({ ...prev, to: event.target.value }))} />
              </label>
              <div className="actions">
                <button type="submit">Filtrer</button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => {
                    const next = { memberId: "", channel: "", from: "", to: "" };
                    setMosqueDonationFilters(next);
                    void loadMosqueData({
                      memberFilters: mosqueMemberFilters,
                      activityFilters: mosqueActivityFilters,
                      donationFilters: next
                    });
                  }}
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
                    <th>Membre</th>
                    <th>Canal</th>
                    <th>Montant</th>
                    <th>Reference</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mosqueDonations.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucun don.</td></tr>
                  ) : (
                    mosqueDonations.map((item) => (
                      <tr key={item.id}>
                        <td>{new Date(item.donatedAt).toLocaleString(currentLanguageMeta.locale)}</td>
                        <td>{item.memberName || item.memberCode || "-"}</td>
                        <td>{formatChannelLabel(item.channel)}</td>
                        <td>{formatMoney(item.amount, item.currency)}</td>
                        <td>{item.referenceNo || "-"}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="button-ghost"
                              onClick={() => void openMosqueDonationReceipt(item.id)}
                            >
                              Recu en PDF
                            </button>
                            <button type="button" className="button-danger" onClick={() => void deleteMosqueDonation(item.id)}>
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section id="mosque-overview" data-step-id="overview" className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Synthese du module mosquee</h2>
              <button type="button" className="button-ghost" onClick={() => void loadMosqueWithCurrentFilters()}>
                Actualiser
              </button>
            </div>
            <div className="metrics-grid">
              <article className="metric-card">
                <span>Membres</span>
                <strong>{mosqueDashboard?.totals.members ?? 0}</strong>
                <small className="subtle">Actifs: {mosqueDashboard?.totals.activeMembers ?? 0}</small>
              </article>
              <article className="metric-card">
                <span>Activites ce mois</span>
                <strong>{mosqueDashboard?.totals.activitiesThisMonth ?? 0}</strong>
                <small className="subtle">Calendrier communautaire</small>
              </article>
              <article className="metric-card">
                <span>Dons ce mois</span>
                <strong>{formatMoney(mosqueDashboard?.totals.donationsThisMonth ?? 0)}</strong>
                <small className="subtle">Moyenne: {formatMoney(mosqueDashboard?.totals.averageDonation ?? 0)}</small>
              </article>
              <article className="metric-card">
                <span>Total dons</span>
                <strong>{formatMoney(mosqueDashboard?.totals.donationsTotal ?? 0)}</strong>
                <small className="subtle">Cumule historique</small>
              </article>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Canal</th>
                    <th>Transactions</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(mosqueDashboard?.donationsByChannel ?? []).length ? (
                    (mosqueDashboard?.donationsByChannel ?? []).map((item) => (
                      <tr key={item.channel}>
                        <td>{formatChannelLabel(item.channel)}</td>
                        <td>{item.count}</td>
                        <td>{formatMoney(item.totalAmount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={3} className="empty-row">Aucune donnee.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      </WorkflowGuide>
    );
  };

  const renderGrades = (): JSX.Element => {
    const gradeSteps: WorkflowStepDef[] = [
      { id: "filters", title: "Filtres", hint: "Cibler classe, matiere et periode." },
      { id: "entry", title: "Saisie", hint: "Enregistrer les notes de l'evaluation.", done: grades.length > 0 },
      { id: "summary", title: "Moyennes", hint: "Calculer moyenne generale et rangs.", done: !!classSummary },
      { id: "reports", title: "Bulletins", hint: "Generer les bulletins PDF.", done: reportCards.length > 0 }
    ];

    const scrollToGrades = (stepId: string): void => {
      setGradesWorkflowStep(stepId);
      const targetByStep: Record<string, string> = {
        filters: "grades-filters",
        entry: "grades-entry",
        summary: "grades-summary",
        reports: "grades-reports"
      };
      const target = targetByStep[stepId];
      if (!target) return;
      window.setTimeout(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    };
    const classSummaryCount = classSummary?.students.length || 0;

    return (
      <WorkflowGuide
        title="Notes & bulletins"
        steps={gradeSteps}
        activeStepId={gradesWorkflowStep}
        onStepChange={scrollToGrades}
      >
        <section data-step-id="filters" className="panel table-panel workflow-section module-modern module-overview-shell">
          <div className="table-header">
            <div>
              <p className="section-kicker">Evaluation</p>
              <h2>Console notes & bulletins</h2>
            </div>
            <span className="module-header-badge">{grades.length} note(s)</span>
          </div>
          <p className="section-lead">
            Passe finale plus stricte: filtres, saisie, resume et PDF dans le meme langage visuel,
            avec des cartes internes plus denses et mieux cadencees.
          </p>
          <div className="module-overview-grid">
            <article className="module-overview-card">
              <span>Notes</span>
              <strong>{grades.length}</strong>
              <small>Evaluations enregistrees</small>
            </article>
            <article className="module-overview-card">
              <span>Bulletins</span>
              <strong>{reportCards.length}</strong>
              <small>PDF disponibles</small>
            </article>
            <article className="module-overview-card">
              <span>Matieres</span>
              <strong>{subjects.length}</strong>
              <small>Catalogue actif</small>
            </article>
            <article className="module-overview-card">
              <span>Resume</span>
              <strong>{classSummaryCount}</strong>
              <small>Lignes de moyennes calculees</small>
            </article>
          </div>
          <div className="module-inline-strip">
            <span className="module-inline-pill">{classes.length} classe(s)</span>
            <span className="module-inline-pill">{periods.length} periode(s)</span>
            <span className="module-inline-pill">{students.length} eleve(s)</span>
          </div>
        </section>

        <section id="grades-filters" data-step-id="filters" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <div>
              <p className="section-kicker">Perimetre</p>
              <h2>Filtres notes</h2>
            </div>
            <span className="module-header-badge">Lecture rapide</span>
          </div>
          <p className="section-lead">Ciblez une classe, une matiere et une periode pour travailler sans surcharge.</p>
          <form className="filter-grid module-filter" onSubmit={(event) => void applyGradeFilters(event)}>
            <label>
              Classe
              <select
                value={gradeFilters.classId}
                onChange={(event) => setGradeFilters((prev) => ({ ...prev, classId: event.target.value }))}
              >
                <option value="">Toutes</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Matiere
              <select
                value={gradeFilters.subjectId}
                onChange={(event) => setGradeFilters((prev) => ({ ...prev, subjectId: event.target.value }))}
              >
                <option value="">Toutes</option>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Periode
              <select
                value={gradeFilters.academicPeriodId}
                onChange={(event) =>
                  setGradeFilters((prev) => ({ ...prev, academicPeriodId: event.target.value }))
                }
              >
                <option value="">Toutes</option>
                {gradeFilterPeriods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Eleve
              <select
                value={gradeFilters.studentId}
                onChange={(event) => setGradeFilters((prev) => ({ ...prev, studentId: event.target.value }))}
              >
                <option value="">Tous</option>
                {students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.matricule} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              <button type="submit">Filtrer</button>
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  const next = { classId: "", subjectId: "", academicPeriodId: "", studentId: "" };
                  setGradeFilters(next);
                  setClassSummary(null);
                  void loadGrades(next);
                }}
              >
                Reinitialiser
              </button>
              <button type="button" className="button-ghost" onClick={() => void computeClassSummary()}>
                Calculer moyennes/rangs
              </button>
            </div>
          </form>
        </section>

        <section id="grades-entry" data-step-id="entry" className="panel editor-panel workflow-section module-modern">
          <div className="table-header">
            <div>
              <p className="section-kicker">Saisie</p>
              <h2>Saisie note</h2>
            </div>
            <span className="module-header-badge">Validation inline</span>
          </div>
          <p className="section-lead">Saisissez une evaluation a la fois avec validations inline.</p>
          <form className="form-grid module-form" onSubmit={(event) => void submitGrade(event)}>
            <label>
              Eleve
              <select
                value={gradeForm.studentId}
                onChange={(event) => setGradeForm((prev) => ({ ...prev, studentId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.matricule} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
              {fieldError(gradeErrors, "studentId")}
            </label>
            <label>
              Classe
              <select
                value={gradeForm.classId}
                onChange={(event) => setGradeForm((prev) => ({ ...prev, classId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {fieldError(gradeErrors, "classId")}
            </label>
            <label>
              Matiere
              <select
                value={gradeForm.subjectId}
                onChange={(event) => setGradeForm((prev) => ({ ...prev, subjectId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {fieldError(gradeErrors, "subjectId")}
            </label>
            <label>
              Periode
              <select
                value={gradeForm.academicPeriodId}
                onChange={(event) =>
                  setGradeForm((prev) => ({ ...prev, academicPeriodId: event.target.value }))
                }
                required
              >
                <option value="">Choisir...</option>
                {gradeFormPeriods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {fieldError(gradeErrors, "academicPeriodId")}
            </label>
            <label>
              Evaluation
              <input
                value={gradeForm.assessmentLabel}
                onChange={(event) => setGradeForm((prev) => ({ ...prev, assessmentLabel: event.target.value }))}
                required
              />
              {fieldError(gradeErrors, "assessmentLabel")}
            </label>
            <label>
              Type
              <select
                value={gradeForm.assessmentType}
                onChange={(event) =>
                  setGradeForm((prev) => ({
                    ...prev,
                    assessmentType: event.target.value as "DEVOIR" | "COMPOSITION" | "ORAL" | "TP"
                  }))
                }
              >
                <option value="DEVOIR">DEVOIR</option>
                <option value="COMPOSITION">COMPOSITION</option>
                <option value="ORAL">ORAL</option>
                <option value="TP">TP</option>
              </select>
            </label>
            <label>
              Note
              <input
                type="number"
                min={0}
                step="0.01"
                value={gradeForm.score}
                onChange={(event) => setGradeForm((prev) => ({ ...prev, score: event.target.value }))}
                required
              />
              {fieldError(gradeErrors, "score")}
            </label>
            <label>
              Bareme
              <input
                type="number"
                min={1}
                step="0.01"
                value={gradeForm.scoreMax}
                onChange={(event) => setGradeForm((prev) => ({ ...prev, scoreMax: event.target.value }))}
                required
              />
              {fieldError(gradeErrors, "scoreMax")}
            </label>
            <button type="submit">Enregistrer note</button>
          </form>
        </section>

        <section data-step-id="entry" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <div>
              <p className="section-kicker">Registre</p>
              <h2>Notes enregistrees</h2>
            </div>
            <span className="module-header-badge">{grades.length} ligne(s)</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Eleve</th>
                  <th>Classe</th>
                  <th>Matiere</th>
                  <th>Periode</th>
                  <th>Evaluation</th>
                  <th>Type</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {grades.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-row">
                      Aucune note.
                    </td>
                  </tr>
                ) : (
                  grades.map((item) => (
                    <tr key={item.id}>
                      <td>{item.studentName || studentById.get(item.studentId)?.matricule || "-"}</td>
                      <td>{classById.get(item.classId)?.label || "-"}</td>
                      <td>{item.subjectLabel || subjects.find((subject) => subject.id === item.subjectId)?.label || "-"}</td>
                      <td>{periods.find((period) => period.id === item.academicPeriodId)?.label || "-"}</td>
                      <td>{item.assessmentLabel}</td>
                      <td>{item.assessmentType}</td>
                      <td>
                        {item.score}/{item.scoreMax}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="grades-summary" data-step-id="summary" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <div>
              <p className="section-kicker">Synthese</p>
              <h2>Moyennes et rangs</h2>
            </div>
            <span className="module-header-badge">{classSummaryCount} ligne(s)</span>
          </div>
          {classSummary && classSummary.students.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Eleve</th>
                    <th>Moyenne</th>
                    <th>Rang</th>
                    <th>Notes</th>
                    <th>Appreciation</th>
                  </tr>
                </thead>
                <tbody>
                  {classSummary.students
                    .slice()
                    .sort((left, right) => left.classRank - right.classRank)
                    .map((item) => (
                      <tr key={item.studentId}>
                        <td>{item.matricule}</td>
                        <td>{item.studentName}</td>
                        <td>{item.averageGeneral.toFixed(2)}</td>
                        <td>{item.classRank}</td>
                        <td>{item.noteCount}</td>
                        <td>{item.appreciation}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="subtle">Aucun resume calcule pour l'instant.</p>
          )}
        </section>

        <section id="grades-reports" data-step-id="reports" className="panel editor-panel workflow-section module-modern">
          <div className="table-header">
            <div>
              <p className="section-kicker">Publication</p>
              <h2>Generation bulletin PDF</h2>
            </div>
            <span className="module-header-badge">{reportCards.length} bulletin(s)</span>
          </div>
          <p className="section-lead">Generez un bulletin par eleve/periode et ouvrez le PDF en un clic.</p>
          <form className="form-grid module-form" onSubmit={(event) => void generateReportCard(event)}>
            <label>
              Eleve
              <select
                value={reportForm.studentId}
                onChange={(event) => setReportForm((prev) => ({ ...prev, studentId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.matricule} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
              {fieldError(reportErrors, "studentId")}
            </label>
            <label>
              Classe
              <select
                value={reportForm.classId}
                onChange={(event) => setReportForm((prev) => ({ ...prev, classId: event.target.value }))}
                required
              >
                <option value="">Choisir...</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {fieldError(reportErrors, "classId")}
            </label>
            <label>
              Periode
              <select
                value={reportForm.academicPeriodId}
                onChange={(event) =>
                  setReportForm((prev) => ({ ...prev, academicPeriodId: event.target.value }))
                }
                required
              >
                <option value="">Choisir...</option>
                {reportFormPeriods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
              {fieldError(reportErrors, "academicPeriodId")}
            </label>
            <button type="submit">Generer bulletin</button>
          </form>
          <div className="actions">
            <button type="button" className="button-ghost" onClick={() => void loadReportCards()}>
              Recharger bulletins
            </button>
            {reportPdfUrl ? (
              <button
                type="button"
                className="button-ghost"
                onClick={() => window.open(reportPdfUrl, "_blank", "noopener,noreferrer")}
              >
                Ouvrir dernier bulletin
              </button>
            ) : null}
          </div>
        </section>

        <section data-step-id="reports" className="panel table-panel workflow-section module-modern">
          <div className="table-header">
            <div>
              <p className="section-kicker">Bibliotheque</p>
              <h2>Bulletins generes</h2>
            </div>
            <span className="module-header-badge">{reportCards.length} fichier(s)</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Eleve</th>
                  <th>Mode</th>
                  <th>Contexte</th>
                  <th>Periode</th>
                  <th>Moyenne</th>
                  <th>Rang</th>
                  <th>Appreciation</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reportCards.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-row">
                      Aucun bulletin.
                    </td>
                  </tr>
                ) : (
                  reportCards.map((item) => (
                    <tr key={item.id}>
                      <td>{item.studentName || studentById.get(item.studentId)?.matricule || "-"}</td>
                      <td>{formatReportCardModeLabel(item.mode)}</td>
                      <td>{formatReportCardContext(item)}</td>
                      <td>{item.periodLabel || periods.find((period) => period.id === item.academicPeriodId)?.label || "-"}</td>
                      <td>{formatReportCardAverage(item)}</td>
                      <td>{item.classRank || "-"}</td>
                      <td>{item.appreciation || "-"}</td>
                      <td>
                        <button type="button" className="button-ghost" onClick={() => void openReportCardPdf(item.id)}>
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </WorkflowGuide>
    );
  };

  const renderReports = (): JSX.Element => {
    const reportSteps: WorkflowStepDef[] = [
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
    ];

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
                      : point.value.toLocaleString(currentLanguageMeta.locale)}
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
                ? new Date(analyticsOverview.generatedAt).toLocaleString(currentLanguageMeta.locale)
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
                onClick={() => {
                  const next = { from: "", to: "", schoolYearId: "" };
                  setAnalyticsFilters(next);
                  void loadAnalytics(next);
                }}
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
                {formatMoney(analyticsOverview?.mosque.donationsInWindow ?? 0)}
              </strong>
              <small className="subtle">
                {analyticsOverview?.mosque.donationsCountInWindow ?? 0} transactions
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
                onClick={() => {
                  const next = {
                    resource: "",
                    action: "",
                    userId: "",
                    q: "",
                    from: "",
                    to: "",
                    page: 1,
                    pageSize: 20
                  };
                  setAuditFilters(next);
                  void loadAuditLogs(next);
                }}
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
                      <td>{new Date(item.createdAt).toLocaleString(currentLanguageMeta.locale)}</td>
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
              <button type="button" onClick={() => void exportAuditLogs()}>
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
  };

  const renderDashboard = (): JSX.Element => {
    return (
      <DashboardScreen
        currentRole={currentRole}
        currentSlide={currentSlide}
        defaultActionScreen={ROLE_HOME_SCREEN[currentRole || "ADMIN"] || "dashboard"}
        filteredTiles={filteredTiles}
        invoices={invoices}
        classesCount={classes.length}
        reportCards={reportCards}
        recovery={recovery}
        students={students}
        enrollments={enrollments}
        mosqueDashboard={mosqueDashboard}
        parentOverview={parentOverview}
        parentChildren={parentChildren}
        parentInvoices={parentInvoices}
        parentNotifications={parentNotifications}
        teacherOverview={teacherOverview}
        teacherClasses={teacherClasses}
        teacherStudentsCount={teacherStudents.length}
        teacherGradesCount={teacherGrades.length}
        teacherNotifications={teacherNotifications}
        moduleQuery={moduleQuery}
        mobileTasksOpen={mobileTasksOpen}
        onClearModuleFilter={() => {
          setModuleQueryInput("");
          setModuleQuery("");
        }}
        onSelectScreen={setTab}
        onToggleMobileTasks={() => setMobileTasksOpen((prev) => !prev)}
        formatMoney={formatMoney}
        hasScreenAccess={hasScreenAccess}
        currentRoleLabel={currentRoleLabel}
      />
    );
  };

  const renderMessages = (): JSX.Element => {
    return <MessagesScreen currentRoleLabel={currentRoleLabel} onSelectScreen={setTab} />;
  };

  const renderStudentPortal = (): JSX.Element => <StudentPortalPlaceholderScreen />;

  const renderTeacherPortal = (): JSX.Element => {
    const teacherClass = teacherPortalFilters.classId
      ? teacherClasses.find((item) => item.classId === teacherPortalFilters.classId)
      : teacherClasses[0];
    const teacherPeriods = teacherClass
      ? periods.filter((item) => item.schoolYearId === teacherClass.schoolYearId)
      : periods;
    const teacherStudentsForClass = teacherPortalFilters.classId
      ? teacherStudents.filter((item) => item.classId === teacherPortalFilters.classId)
      : teacherStudents;

    return (
      <>
        <section className="panel table-panel workflow-section">
          <div className="table-header">
            <h2>Portail enseignant metier</h2>
            <div className="actions">
              <button
                type="button"
                className="button-ghost"
                onClick={() => void loadTeacherPortalData(teacherPortalFilters)}
              >
                Recharger
              </button>
            </div>
          </div>
          <div className="metrics-grid">
            <article className="metric-card">
              <span>Classes</span>
              <strong>{teacherOverview?.classesCount ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Eleves suivis</span>
              <strong>{teacherOverview?.studentsCount ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Notes saisies</span>
              <strong>{teacherOverview?.gradesCount ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Justifs en attente</span>
              <strong>{teacherOverview?.pendingJustifications ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Creneaux EDT</span>
              <strong>{teacherOverview?.timetableSlotsCount ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Notifications</span>
              <strong>{teacherOverview?.notificationsCount ?? 0}</strong>
            </article>
          </div>
          <form
            className="filter-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void loadTeacherPortalData(teacherPortalFilters);
            }}
          >
            <label>
              Classe
              <select
                value={teacherPortalFilters.classId}
                onChange={(event) =>
                  setTeacherPortalFilters((prev) => ({
                    ...prev,
                    classId: event.target.value
                  }))
                }
              >
                <option value="">Toutes</option>
                {teacherClasses.map((item) => (
                  <option key={item.assignmentId} value={item.classId}>
                    {item.classLabel} ({formatAcademicTrackLabel(item.track)}) - {item.schoolYearCode}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Matiere
              <select
                value={teacherPortalFilters.subjectId}
                onChange={(event) =>
                  setTeacherPortalFilters((prev) => ({ ...prev, subjectId: event.target.value }))
                }
              >
                <option value="">Toutes</option>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Periode
              <select
                value={teacherPortalFilters.academicPeriodId}
                onChange={(event) =>
                  setTeacherPortalFilters((prev) => ({
                    ...prev,
                    academicPeriodId: event.target.value
                  }))
                }
              >
                <option value="">Toutes</option>
                {teacherPeriods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Eleve
              <select
                value={teacherPortalFilters.studentId}
                onChange={(event) =>
                  setTeacherPortalFilters((prev) => ({ ...prev, studentId: event.target.value }))
                }
              >
                <option value="">Tous</option>
                {teacherStudentsForClass.map((item) => (
                  <option key={item.enrollmentId} value={item.studentId}>
                    {item.matricule} - {item.studentName} ({formatAcademicTrackLabel(item.track)})
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              <button type="submit">Filtrer</button>
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  const reset = { classId: "", subjectId: "", academicPeriodId: "", studentId: "" };
                  setTeacherPortalFilters(reset);
                  void loadTeacherPortalData(reset);
                }}
              >
                Reinitialiser
              </button>
            </div>
          </form>
        </section>

        <section className="panel table-panel workflow-section">
          <div className="table-header">
            <h2>Actions metier</h2>
          </div>
          <div className="split-grid">
            <form data-step-id="teacher-grade" className="form-grid compact-form" onSubmit={(event) => void submitTeacherGrade(event)}>
              <h3>Saisir une note</h3>
              <label>
                Classe
                <select
                  value={teacherGradeForm.classId}
                  onChange={(event) => setTeacherGradeForm((prev) => ({ ...prev, classId: event.target.value }))}
                >
                  {teacherClasses.map((item) => (
                    <option key={item.assignmentId} value={item.classId}>
                      {item.classLabel} ({formatAcademicTrackLabel(item.track)})
                    </option>
                  ))}
                </select>
                {fieldError(teacherPortalErrors, "classId")}
              </label>
              <label>
                Eleve
                <select
                  value={teacherGradeForm.studentId}
                  onChange={(event) => setTeacherGradeForm((prev) => ({ ...prev, studentId: event.target.value }))}
                >
                  {teacherStudentsForClass.map((item) => (
                    <option key={item.enrollmentId} value={item.studentId}>
                      {item.matricule} - {item.studentName} ({formatAcademicTrackLabel(item.track)})
                    </option>
                  ))}
                </select>
                {fieldError(teacherPortalErrors, "studentId")}
              </label>
              <label>
                Matiere
                <select
                  value={teacherGradeForm.subjectId}
                  onChange={(event) => setTeacherGradeForm((prev) => ({ ...prev, subjectId: event.target.value }))}
                >
                  {subjects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code}
                    </option>
                  ))}
                </select>
                {fieldError(teacherPortalErrors, "subjectId")}
              </label>
              <label>
                Periode
                <select
                  value={teacherGradeForm.academicPeriodId}
                  onChange={(event) =>
                    setTeacherGradeForm((prev) => ({ ...prev, academicPeriodId: event.target.value }))
                  }
                >
                  {teacherPeriods.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code}
                    </option>
                  ))}
                </select>
                {fieldError(teacherPortalErrors, "academicPeriodId")}
              </label>
              <label>
                Evaluation
                <input
                  value={teacherGradeForm.assessmentLabel}
                  onChange={(event) => setTeacherGradeForm((prev) => ({ ...prev, assessmentLabel: event.target.value }))}
                />
                {fieldError(teacherPortalErrors, "assessmentLabel")}
              </label>
              <label>
                Note
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={teacherGradeForm.score}
                  onChange={(event) => setTeacherGradeForm((prev) => ({ ...prev, score: event.target.value }))}
                />
                {fieldError(teacherPortalErrors, "score")}
              </label>
              <label>
                Bareme
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  value={teacherGradeForm.scoreMax}
                  onChange={(event) => setTeacherGradeForm((prev) => ({ ...prev, scoreMax: event.target.value }))}
                />
                {fieldError(teacherPortalErrors, "scoreMax")}
              </label>
              <button type="submit">Enregistrer note</button>
            </form>

            <form data-step-id="teacher-attendance" className="form-grid compact-form" onSubmit={(event) => void submitTeacherAttendanceBulk(event)}>
              <h3>Pointage en masse</h3>
              <label>
                Classe
                <select
                  value={teacherAttendanceForm.classId}
                  onChange={(event) => setTeacherAttendanceForm((prev) => ({ ...prev, classId: event.target.value }))}
                >
                  {teacherClasses.map((item) => (
                    <option key={item.assignmentId} value={item.classId}>
                      {item.classLabel} ({formatAcademicTrackLabel(item.track)})
                    </option>
                  ))}
                </select>
                {fieldError(teacherPortalErrors, "classId")}
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={teacherAttendanceForm.attendanceDate}
                  onChange={(event) => setTeacherAttendanceForm((prev) => ({ ...prev, attendanceDate: event.target.value }))}
                />
                {fieldError(teacherPortalErrors, "attendanceDate")}
              </label>
              <label>
                Statut
                <select
                  value={teacherAttendanceForm.defaultStatus}
                  onChange={(event) =>
                    setTeacherAttendanceForm((prev) => ({ ...prev, defaultStatus: event.target.value }))
                  }
                >
                  <option value="PRESENT">{formatAttendanceStatusLabel("PRESENT")}</option>
                  <option value="ABSENT">{formatAttendanceStatusLabel("ABSENT")}</option>
                  <option value="LATE">{formatAttendanceStatusLabel("LATE")}</option>
                  <option value="EXCUSED">{formatAttendanceStatusLabel("EXCUSED")}</option>
                </select>
              </label>
              <label>
                Eleves (multi-select)
                <select
                  multiple
                  value={teacherAttendanceStudents}
                  onChange={(event) =>
                    setTeacherAttendanceStudents(
                      Array.from(event.target.selectedOptions).map((item) => item.value)
                    )
                  }
                >
                  {teacherStudentsForClass.map((item) => (
                    <option key={item.enrollmentId} value={item.studentId}>
                      {item.matricule} - {item.studentName} ({formatAcademicTrackLabel(item.track)})
                    </option>
                  ))}
                </select>
                {fieldError(teacherPortalErrors, "students")}
              </label>
              <button type="submit">Enregistrer pointage</button>
            </form>

            <form data-step-id="teacher-notifications" className="form-grid compact-form" onSubmit={(event) => void submitTeacherNotification(event)}>
              <h3>Notifier les parents</h3>
              <label>
                Classe
                <select
                  value={teacherNotificationForm.classId}
                  onChange={(event) => setTeacherNotificationForm((prev) => ({ ...prev, classId: event.target.value }))}
                >
                  {teacherClasses.map((item) => (
                    <option key={item.assignmentId} value={item.classId}>
                      {item.classLabel} ({formatAcademicTrackLabel(item.track)})
                    </option>
                  ))}
                </select>
                {fieldError(teacherPortalErrors, "classId")}
              </label>
              <label>
                Eleve cible (optionnel)
                <select
                  value={teacherNotificationForm.studentId}
                  onChange={(event) => setTeacherNotificationForm((prev) => ({ ...prev, studentId: event.target.value }))}
                >
                  <option value="">Tous les parents de la classe</option>
                  {teacherStudentsForClass.map((item) => (
                    <option key={item.enrollmentId} value={item.studentId}>
                      {item.studentName} ({formatAcademicTrackLabel(item.track)})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Titre
                <input
                  value={teacherNotificationForm.title}
                  onChange={(event) => setTeacherNotificationForm((prev) => ({ ...prev, title: event.target.value }))}
                />
                {fieldError(teacherPortalErrors, "title")}
              </label>
              <label>
                Message
                <textarea
                  rows={3}
                  value={teacherNotificationForm.message}
                  onChange={(event) => setTeacherNotificationForm((prev) => ({ ...prev, message: event.target.value }))}
                />
                {fieldError(teacherPortalErrors, "message")}
              </label>
              <button type="submit">Envoyer notification</button>
            </form>
          </div>
        </section>

        <section className="panel table-panel workflow-section">
          <div className="table-header">
            <h2>Notes recentes</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Eleve</th>
                  <th>Cursus</th>
                  <th>Matiere</th>
                  <th>Periode</th>
                  <th>Evaluation</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {teacherGrades.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-row">Aucune note.</td>
                  </tr>
                ) : (
                  teacherGrades.map((item) => (
                    <tr key={item.id}>
                      <td>{item.studentName || "-"}</td>
                      <td>{formatAcademicTrackLabel(item.track)}</td>
                      <td>{item.subjectLabel || "-"}</td>
                        <td>{periods.find((period) => period.id === item.academicPeriodId)?.label || "-"}</td>
                      <td>{item.assessmentLabel}</td>
                      <td>{item.score}/{item.scoreMax}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="split-grid">
          <section className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Emploi du temps</h2>
            </div>
            <div className="table-wrap">
              <table>
              <thead>
                <tr>
                  <th>Jour</th>
                  <th>Classe</th>
                  <th>Cursus</th>
                  <th>Matiere</th>
                  <th>Horaire</th>
                  <th>Salle</th>
                </tr>
              </thead>
              <tbody>
                {teacherTimetable.length === 0 ? (
                  <tr><td colSpan={6} className="empty-row">Aucun creneau.</td></tr>
                ) : (
                  teacherTimetable.map((item) => (
                    <tr key={item.id}>
                      <td>{formatWeekdayLabel(item.dayOfWeek)}</td>
                      <td>{item.classLabel || "-"}</td>
                      <td>{formatAcademicTrackLabel(item.track)}</td>
                      <td>{item.subjectLabel || "-"}</td>
                      <td>{item.startTime} - {item.endTime}</td>
                        <td>{item.room || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Notifications</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Titre</th>
                    <th>Cible</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherNotifications.length === 0 ? (
                    <tr><td colSpan={4} className="empty-row">Aucune notification.</td></tr>
                  ) : (
                    teacherNotifications.map((item) => (
                      <tr key={item.id}>
                        <td>{new Date(item.createdAt).toLocaleString(currentLanguageMeta.locale)}</td>
                        <td>{item.title}</td>
                        <td>{item.studentName || formatAudienceRoleLabel(item.audienceRole) || "-"}</td>
                        <td>{formatPortalNotificationStatusLabel(item.status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </>
    );
  };

  const renderIam = (): JSX.Element => {
    const iamSteps: WorkflowStepDef[] = [
      {
        id: "accounts",
        title: editingUserId ? "Edition compte" : "Comptes utilisateurs",
        hint: "Creer, modifier et desactiver les comptes.",
        done: users.length > 0
      },
      {
        id: "permissions",
        title: "Droits par profil",
        hint: "Ajuster les autorisations API par ressource et action.",
        done: rolePermissions.some((item) => item.source === "CUSTOM")
      }
    ];

    const goToStep = (stepId: string): void => {
      setIamWorkflowStep(stepId);
      const targetByStep: Record<string, string> = {
        accounts: "iam-accounts",
        permissions: "iam-permissions"
      };
      const target = targetByStep[stepId];
      if (!target) return;
      window.setTimeout(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    };

    return (
      <WorkflowGuide
        title="Utilisateurs & droits"
        steps={iamSteps}
        activeStepId={iamWorkflowStep}
        onStepChange={goToStep}
      >
        <>
          <section id="iam-accounts" data-step-id="accounts" className="panel editor-panel workflow-section">
            <h2>{editingUserId ? "Modifier utilisateur" : "Creer utilisateur"}</h2>
            {lastTemporaryPassword ? (
              <div className="notice-card notice-success" role="status">
                <strong>Mot de passe temporaire genere</strong>
                <p>Communiquez-le une seule fois a l'utilisateur, puis le compte devra changer son mot de passe a la premiere connexion.</p>
                <code>{lastTemporaryPassword}</code>
              </div>
            ) : null}
            <form className="iam-account-form" onSubmit={(event) => void submitUser(event)}>
              <fieldset className="iam-form-section">
                <legend>Acces au systeme</legend>
                <div className="form-grid iam-form-grid">
                  <label>
                    Nom utilisateur
                    <input
                      value={userForm.username}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, username: event.target.value }))}
                      required
                    />
                    {fieldError(userErrors, "username")}
                  </label>
                  <label>
                    Email d'acces
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
                    />
                  </label>
                  <label>
                    Telephone
                    <input
                      value={userForm.phone}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, phone: event.target.value }))}
                    />
                  </label>
                  <label>
                    Mode mot de passe
                    <select
                      value={userForm.passwordMode}
                      onChange={(event) =>
                        setUserForm((prev) => ({ ...prev, passwordMode: event.target.value as PasswordMode, password: "", confirmPassword: "" }))
                      }
                      disabled={Boolean(editingUserId)}
                    >
                      {(["AUTO", "MANUAL"] as PasswordMode[]).map((mode) => (
                        <option key={mode} value={mode}>{PASSWORD_MODE_LABELS[mode]}</option>
                      ))}
                    </select>
                  </label>
                  {userForm.passwordMode === "MANUAL" ? (
                    <>
                      <label>
                        Mot de passe {editingUserId ? "(laisser vide pour conserver)" : ""}
                        <input
                          type="password"
                          value={userForm.password}
                          onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))}
                          minLength={12}
                        />
                        {fieldError(userErrors, "password")}
                      </label>
                      <label>
                        Confirmation
                        <input
                          type="password"
                          value={userForm.confirmPassword}
                          onChange={(event) => setUserForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                        />
                        {fieldError(userErrors, "confirmPassword")}
                      </label>
                    </>
                  ) : (
                    <p className="iam-inline-help">
                      Un mot de passe temporaire fort sera genere et le changement a la premiere connexion restera actif.
                    </p>
                  )}
                  <label className="check-row iam-check-row">
                    <input
                      type="checkbox"
                      checked={userForm.mustChangePasswordAtFirstLogin}
                      onChange={(event) =>
                        setUserForm((prev) => ({ ...prev, mustChangePasswordAtFirstLogin: event.target.checked }))
                      }
                    />
                    Changement obligatoire a la premiere connexion
                  </label>
                  <label className="check-row iam-check-row">
                    <input
                      type="checkbox"
                      checked={userForm.isActive}
                      onChange={(event) =>
                        setUserForm((prev) => ({ ...prev, isActive: event.target.checked }))
                      }
                    />
                    Compte actif
                  </label>
                </div>
              </fieldset>

              <fieldset className="iam-form-section">
                <legend>Nature du compte</legend>
                <div className="form-grid iam-form-grid">
                  <label>
                    Type de personne
                    <select
                      value={userForm.accountType}
                      onChange={(event) => setUserAccountType(event.target.value as AccountType)}
                    >
                      {ACCOUNT_TYPE_VALUES.map((accountType) => (
                        <option key={accountType} value={accountType}>{ACCOUNT_TYPE_LABELS[accountType]}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Role d'acces
                    <select
                      value={userForm.roleId}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, roleId: event.target.value as Role }))}
                    >
                      {compatibleUserRoles.map((role) => (
                        <option key={role} value={role}>{formatRoleLabel(role)}</option>
                      ))}
                    </select>
                    {fieldError(userErrors, "roleId")}
                  </label>
                  <label>
                    Etablissement
                    <select
                      value={userForm.establishmentId}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, establishmentId: event.target.value }))}
                    >
                      <option value="">Al Manarat Islamiyat</option>
                    </select>
                  </label>
                  <label>
                    Fonction staff
                    <input
                      value={userForm.staffFunction}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, staffFunction: event.target.value }))}
                      disabled={userForm.accountType !== "STAFF"}
                    />
                  </label>
                  <label>
                    Departement
                    <input
                      value={userForm.department}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, department: event.target.value }))}
                      disabled={userForm.accountType !== "STAFF"}
                    />
                  </label>
                  <label className="form-grid-span-full">
                    Notes internes
                    <textarea
                      rows={2}
                      value={userForm.notes}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="iam-form-section">
                <legend>Rattachement metier</legend>
                <div className="form-grid iam-form-grid">
                  {userForm.accountType === "TEACHER" ? (
                    <label className="form-grid-span-full">
                      Fiche enseignant
                      <select
                        value={userForm.teacherId}
                        onChange={(event) => setUserForm((prev) => ({ ...prev, teacherId: event.target.value }))}
                      >
                        <option value="">Choisir une fiche enseignant</option>
                        {accountTeachers.map((teacher) => (
                          <option
                            key={teacher.id}
                            value={teacher.id}
                            disabled={Boolean((teacher.userId && teacher.userId !== editingUserId) || teacher.status !== "ACTIVE" || teacher.archivedAt)}
                          >
                            {teacher.matricule} - {teacher.fullName}{teacher.userId && teacher.userId !== editingUserId ? " (deja lie)" : ""}{teacher.status !== "ACTIVE" ? ` (${teacher.status})` : ""}
                          </option>
                        ))}
                      </select>
                      {accountTeachers.length === 0 ? <small>Creer d'abord la fiche enseignant dans le module Enseignants.</small> : null}
                      {fieldError(userErrors, "teacherId")}
                    </label>
                  ) : null}
                  {userForm.accountType === "PARENT" ? (
                    <label className="form-grid-span-full">
                      Fiche parent
                      <select
                        value={userForm.parentId}
                        onChange={(event) => setUserForm((prev) => ({ ...prev, parentId: event.target.value }))}
                      >
                        <option value="">Choisir une fiche parent</option>
                        {accountParents.map((parent) => (
                          <option
                            key={parent.id}
                            value={parent.id}
                            disabled={Boolean((parent.userId && parent.userId !== editingUserId) || parent.status !== "ACTIVE" || parent.archivedAt)}
                          >
                            {parent.fullName} - {parent.primaryPhone}{parent.userId && parent.userId !== editingUserId ? " (deja lie)" : ""}{parent.status !== "ACTIVE" ? ` (${parent.status})` : ""}
                          </option>
                        ))}
                      </select>
                      {accountParents.length === 0 ? <small>Creer d'abord la fiche parent dans le module Parents.</small> : null}
                      {fieldError(userErrors, "parentId")}
                    </label>
                  ) : null}
                  {userForm.accountType === "STUDENT" ? (
                    <label className="form-grid-span-full">
                      Fiche eleve
                      <select
                        value={userForm.studentId}
                        onChange={(event) => setUserForm((prev) => ({ ...prev, studentId: event.target.value }))}
                      >
                        <option value="">Choisir une fiche eleve</option>
                        {students.map((student) => (
                          <option
                            key={student.id}
                            value={student.id}
                            disabled={Boolean((student.userId && student.userId !== editingUserId) || student.status !== "ACTIVE" || student.archivedAt)}
                          >
                            {student.matricule} - {student.fullName || `${student.firstName} ${student.lastName}`}{student.userId && student.userId !== editingUserId ? " (deja lie)" : ""}{student.status && student.status !== "ACTIVE" ? ` (${student.status})` : ""}
                          </option>
                        ))}
                      </select>
                      {students.length === 0 ? <small>Creer d'abord la fiche eleve dans le module Eleves.</small> : null}
                      {fieldError(userErrors, "studentId")}
                    </label>
                  ) : null}
                  {userForm.accountType === "STAFF" ? (
                    <label className="form-grid-span-full">
                      Nom affiche staff
                      <input
                        value={userForm.staffDisplayName}
                        onChange={(event) => setUserForm((prev) => ({ ...prev, staffDisplayName: event.target.value, displayName: event.target.value }))}
                      />
                      {fieldError(userErrors, "staffDisplayName")}
                    </label>
                  ) : null}
                  <label className="check-row iam-check-row form-grid-span-full">
                    <input
                      type="checkbox"
                      checked={userForm.autoFillIdentity}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, autoFillIdentity: event.target.checked }))}
                      disabled={userForm.accountType === "STAFF"}
                    />
                    Identite issue de la fiche metier
                  </label>
                  {fieldError(userErrors, "businessProfile")}
                </div>
              </fieldset>

              <aside className="iam-account-summary">
                <p className="section-kicker">Resume identite</p>
                <h3>{selectedBusinessDisplayName || "Aucune identite selectionnee"}</h3>
                <span>{formatAccountTypeLabel(userForm.accountType)} / {formatRoleLabel(userForm.roleId)}</span>
                <small>{selectedBusinessEmail || "Email non renseigne"} - {selectedBusinessPhone || "Telephone non renseigne"}</small>
                {selectedBusinessAlreadyLinked ? <strong className="danger-text">Fiche deja rattachee a un autre compte</strong> : null}
                {selectedBusinessIsInactive ? <strong className="danger-text">Fiche inactive ou archivee</strong> : null}
              </aside>

              <div className="actions">
                <button type="submit">{editingUserId ? "Mettre a jour" : "Creer utilisateur"}</button>
                <button type="button" className="button-ghost" onClick={resetUserForm}>
                  {editingUserId ? "Annuler" : "Reinitialiser"}
                </button>
              </div>
            </form>
          </section>

          <section data-step-id="accounts" className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Utilisateurs du tenant</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Identifiant</th>
                    <th>Identite</th>
                    <th>Type</th>
                    <th>Role d'acces</th>
                    <th>Rattachement</th>
                    <th>Statut</th>
                    <th>Maj</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty-row">
                        Aucun utilisateur.
                      </td>
                    </tr>
                  ) : (
                    users.map((item) => (
                      <tr key={item.id}>
                        <td>{item.username}</td>
                        <td>{item.displayName || "-"}</td>
                        <td>{formatAccountTypeLabel(item.accountType)}</td>
                        <td>{formatRoleLabel(item.roleId || item.role)}</td>
                        <td>
                          {item.teacherId ? "Fiche enseignant" : item.parentId ? "Fiche parent" : item.studentId ? "Fiche eleve" : "Staff"}
                        </td>
                        <td>{item.isActive ? "ACTIF" : "INACTIF"}</td>
                        <td>{new Date(item.updatedAt).toLocaleString(currentLanguageMeta.locale)}</td>
                        <td>
                          <div className="inline-actions">
                            <button type="button" className="button-ghost" onClick={() => startEditUser(item)}>
                              Modifier
                            </button>
                            <button type="button" className="button-danger" onClick={() => void deleteUserAccount(item.id)}>
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section id="iam-permissions" data-step-id="permissions" className="panel table-panel workflow-section iam-permissions-panel">
            <div className="table-header iam-permissions-header">
              <h2>Droits API par role</h2>
              <div className="inline-actions iam-permissions-actions">
                <label className="iam-permissions-target">
                  Role cible
                  <select
                    value={rolePermissionTarget}
                    onChange={(event) => {
                      const nextRole = event.target.value as Role;
                      setRolePermissionTarget(nextRole);
                      void loadRolePermissions(nextRole);
                    }}
                  >
                    {ROLE_VALUES.map((role) => (
                      <option key={role} value={role}>
                        {formatRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="button-ghost" onClick={() => void loadRolePermissions(rolePermissionTarget)}>
                  Recharger
                </button>
                <button type="button" onClick={() => void saveRolePermissions()}>
                  Enregistrer les droits
                </button>
              </div>
            </div>
            <p className="subtle">
              Cochez pour autoriser. Les routes restent proteges par les profils d'ecran et d'API.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ressource</th>
                    {PERMISSION_ACTION_VALUES.map((action) => (
                      <th key={action}>{formatPermissionActionLabel(action)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_RESOURCE_VALUES.map((resource) => (
                    <tr key={resource}>
                      <td>{formatPermissionResourceLabel(resource)}</td>
                      {PERMISSION_ACTION_VALUES.map((action) => (
                        <td key={`${resource}:${action}`}>
                          <input
                            type="checkbox"
                            checked={getEffectivePermission(resource, action)}
                            onChange={(event) =>
                              toggleRolePermission(resource, action, event.target.checked)
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </>
      </WorkflowGuide>
    );
  };

  const renderParentPortal = (): JSX.Element => {
    return (
      <>
        <section className="panel table-panel workflow-section">
          <div className="table-header">
            <h2>Portail parent metier</h2>
            <div className="actions">
              <button type="button" className="button-ghost" onClick={() => void loadParentPortalData(parentStudentFilter)}>
                Recharger
              </button>
            </div>
          </div>
          <div className="metrics-grid">
            <article className="metric-card">
              <span>Enfants lies</span>
              <strong>{parentOverview?.childrenCount ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Factures ouvertes</span>
              <strong>{parentOverview?.openInvoicesCount ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Reste a payer</span>
              <strong>{formatMoney(parentOverview?.remainingAmount ?? 0)}</strong>
            </article>
            <article className="metric-card">
              <span>Absences/retards</span>
              <strong>{parentOverview?.absencesCount ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Bulletins</span>
              <strong>{parentOverview?.reportCardsCount ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Notifications</span>
              <strong>{parentOverview?.notificationsCount ?? 0}</strong>
            </article>
          </div>
          <form
            className="filter-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void loadParentPortalData(parentStudentFilter);
            }}
          >
            <label>
              Enfant
              <select
                value={parentStudentFilter}
                onChange={(event) => setParentStudentFilter(event.target.value)}
              >
                <option value="">Tous</option>
                {parentChildren.map((item) => (
                  <option key={item.linkId} value={item.studentId}>
                    {item.matricule} - {item.studentName}{item.primaryTrack ? ` (${formatAcademicTrackLabel(item.primaryTrack)})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              <button type="submit">Filtrer</button>
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  setParentStudentFilter("");
                  void loadParentPortalData("");
                }}
              >
                Reinitialiser
              </button>
            </div>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Eleve</th>
                  <th>Classe principale</th>
                  <th>Classe secondaire</th>
                  <th>Parcours actifs</th>
                </tr>
              </thead>
              <tbody>
                {parentChildren.length === 0 ? (
                  <tr><td colSpan={4} className="empty-row">Aucun parcours parent-eleve.</td></tr>
                ) : (
                  parentChildren.map((item) => (
                    <tr key={`child-placement-summary-${item.linkId}`}>
                      <td>{item.matricule} - {item.studentName}</td>
                      <td>
                        {[item.primaryPlacement?.classLabel || item.classLabel, item.primaryPlacement?.track ? formatAcademicTrackLabel(item.primaryPlacement.track) : item.primaryTrack ? formatAcademicTrackLabel(item.primaryTrack) : undefined]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </td>
                      <td>
                        {[item.secondaryPlacement?.classLabel || item.secondaryClassLabel, item.secondaryPlacement?.track ? formatAcademicTrackLabel(item.secondaryPlacement.track) : undefined]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </td>
                      <td>
                        {item.placements?.length ? (
                          item.placements
                            .map((placement) => {
                              const placementParts = [
                                formatAcademicTrackLabel(placement.track),
                                placement.levelCode,
                                placement.classLabel,
                                placement.schoolYearCode
                              ].filter(Boolean);
                              return `${placement.isPrimary ? "Principal" : "Secondaire"}: ${placementParts.join(" / ")}`;
                            })
                            .join(" | ")
                        ) : (
                          "Aucun parcours actif"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="split-grid">
          <section className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Notes</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Eleve</th>
                    <th>Cursus</th>
                    <th>Matiere</th>
                    <th>Periode</th>
                    <th>Evaluation</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {parentGrades.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucune note.</td></tr>
                  ) : (
                    parentGrades.map((item) => (
                      <tr key={item.id}>
                        <td>{item.studentName || "-"}</td>
                        <td>{formatAcademicTrackLabel(item.track)}</td>
                        <td>{item.subjectLabel || "-"}</td>
                        <td>{item.periodLabel || periods.find((period) => period.id === item.academicPeriodId)?.label || "-"}</td>
                        <td>{item.assessmentLabel}</td>
                        <td>{item.score}/{item.scoreMax}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Bulletins</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Eleve</th>
                    <th>Mode</th>
                    <th>Contexte</th>
                    <th>Periode</th>
                    <th>Moyenne</th>
                    <th>Rang</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {parentReportCards.length === 0 ? (
                    <tr><td colSpan={7} className="empty-row">Aucun bulletin.</td></tr>
                  ) : (
                    parentReportCards.map((item) => (
                      <tr key={item.id}>
                        <td>{item.studentName || "-"}</td>
                        <td>{formatReportCardModeLabel(item.mode)}</td>
                        <td>{formatReportCardContext(item)}</td>
                        <td>{item.periodLabel || "-"}</td>
                        <td>{formatReportCardAverage(item)}</td>
                        <td>{item.classRank || "-"}</td>
                        <td>
                          {item.pdfDataUrl ? (
                            <button
                              type="button"
                              className="button-ghost"
                              onClick={() => window.open(item.pdfDataUrl, "_blank", "noopener,noreferrer")}
                            >
                              Consulter le PDF
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="split-grid">
          <section className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Absences</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Eleve</th>
                    <th>Classe</th>
                    <th>Cursus</th>
                    <th>Statut</th>
                    <th>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {parentAttendance.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucune absence.</td></tr>
                  ) : (
                    parentAttendance.map((item) => (
                      <tr key={item.id}>
                        <td>{item.attendanceDate}</td>
                        <td>{item.studentName || "-"}</td>
                        <td>{item.classLabel || "-"}</td>
                        <td>{formatAcademicTrackLabel(item.track)}</td>
                        <td>{formatAttendanceStatusLabel(item.status)}</td>
                        <td>{formatValidationStatusLabel(item.justificationStatus)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Comptabilite famille</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Facture</th>
                    <th>Eleve</th>
                    <th>Classe principale</th>
                    <th>Classe secondaire</th>
                    <th>Du</th>
                    <th>Paye</th>
                    <th>Reste</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {parentInvoices.length === 0 ? (
                    <tr><td colSpan={8} className="empty-row">Aucune facture.</td></tr>
                  ) : (
                    parentInvoices.map((item) => (
                      <tr key={item.id}>
                        <td>{item.invoiceNo}</td>
                        <td>{item.studentName || "-"}</td>
                        <td>
                          {[item.primaryClassLabel, item.primaryTrack ? formatAcademicTrackLabel(item.primaryTrack) : undefined]
                            .filter(Boolean)
                            .join(" / ") || "-"}
                        </td>
                        <td>
                          {[item.secondaryClassLabel, item.secondaryTrack ? formatAcademicTrackLabel(item.secondaryTrack) : undefined]
                            .filter(Boolean)
                            .join(" / ") || "-"}
                        </td>
                        <td>{formatAmount(item.amountDue)}</td>
                        <td>{formatAmount(item.amountPaid)}</td>
                        <td>{formatAmount(item.remainingAmount)}</td>
                        <td>{formatInvoiceStatusLabel(item.status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="split-grid">
          <section className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Paiements</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Eleve</th>
                    <th>Facture</th>
                    <th>Recu</th>
                    <th>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {parentPayments.length === 0 ? (
                    <tr><td colSpan={5} className="empty-row">Aucun paiement.</td></tr>
                  ) : (
                    parentPayments.map((item) => (
                      <tr key={item.id}>
                        <td>{new Date(item.paidAt).toLocaleString(currentLanguageMeta.locale)}</td>
                        <td>{item.studentName || "-"}</td>
                        <td>{item.invoiceNo || "-"}</td>
                        <td>{item.receiptNo}</td>
                        <td>{formatAmount(item.paidAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel table-panel workflow-section">
            <div className="table-header">
              <h2>Emploi du temps</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Eleve</th>
                    <th>Cursus</th>
                    <th>Jour</th>
                    <th>Matiere</th>
                    <th>Horaire</th>
                    <th>Salle</th>
                  </tr>
                </thead>
                <tbody>
                  {parentTimetable.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucun creneau.</td></tr>
                  ) : (
                    parentTimetable.map((item) => (
                      <tr key={`${item.slotId}:${item.placementId || item.studentId}`}>
                        <td>{item.studentName}</td>
                        <td>{formatAcademicTrackLabel(item.track)}</td>
                        <td>{formatWeekdayLabel(item.dayOfWeek)}</td>
                        <td>{item.subjectLabel}</td>
                        <td>{item.startTime} - {item.endTime}</td>
                        <td>{item.room || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="panel table-panel workflow-section">
          <div className="table-header">
            <h2>Notifications recues</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Titre</th>
                  <th>Message</th>
                  <th>Cible</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {parentNotifications.length === 0 ? (
                  <tr><td colSpan={5} className="empty-row">Aucune notification.</td></tr>
                ) : (
                  parentNotifications.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.createdAt).toLocaleString(currentLanguageMeta.locale)}</td>
                      <td>{item.title}</td>
                      <td>{item.message}</td>
                      <td>{item.studentName || formatAudienceRoleLabel(item.audienceRole) || "-"}</td>
                      <td>{formatPortalNotificationStatusLabel(item.status)}</td>
                    </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  };

  const renderReferenceScreen = (): JSX.Element => {
    const activeSchoolYear = schoolYears.find((item) => item.status === "ACTIVE") || schoolYears.find((item) => item.isActive);
    const defaultSchoolYearId = activeSchoolYear?.id || schoolYears[0]?.id || "";
    const schoolFieldValue = SCHOOL_NAME;
    const cycleById = new Map(cycles.map((item) => [item.id, item]));
    const selectedLevelCycle = cycleById.get(levelForm.cycleId);
    const selectedLevelSchoolYearId = selectedLevelCycle?.schoolYearId || defaultSchoolYearId;
    const selectedClassLevel = levelById.get(classForm.levelId);
    const selectedClassCycle = selectedClassLevel ? cycleById.get(selectedClassLevel.cycleId) : undefined;
    const selectedClassCycleId = selectedClassCycle?.id || "";
    const classCycleOptions = classForm.schoolYearId
      ? cycles.filter((item) => item.schoolYearId === classForm.schoolYearId)
      : cycles;
    const selectedPeriodSchoolYear = schoolYearById.get(periodForm.schoolYearId);
    const periodParents = periodForm.schoolYearId
      ? periods.filter((item) => item.schoolYearId === periodForm.schoolYearId)
      : periods;
    const subjectAvailableLevels = subjectCycleScope
      ? levels.filter((item) => item.cycleId === subjectCycleScope)
      : levels;

    const formatSubjectLevels = (levelIds: string[] = []): string => {
      const labels = levelIds
        .map((levelId) => levelById.get(levelId)?.label)
        .filter((value): value is string => Boolean(value));
      return labels.length > 0 ? labels.join(", ") : "-";
    };

    const formatSubjectCycles = (levelIds: string[] = []): string => {
      const labels = Array.from(
        new Set(
          levelIds
            .map((levelId) => levelById.get(levelId))
            .map((level) => (level ? cycleById.get(level.cycleId)?.label : undefined))
            .filter((value): value is string => Boolean(value))
        )
      );
      return labels.length > 0 ? labels.join(", ") : "-";
    };

    const referenceSteps: WorkflowStepDef[] = [
      { id: "years", title: "Annees", hint: "Base temporelle du referentiel.", done: schoolYears.length > 0 },
      { id: "cycles", title: "Cycles", hint: "Regrouper les parcours.", done: cycles.length > 0 },
      { id: "levels", title: "Niveaux", hint: "Structurer les classes pedagogiques.", done: levels.length > 0 },
      { id: "classes", title: "Classes", hint: "Creer les classes reelles.", done: classes.length > 0 },
      { id: "periods", title: "Periodes", hint: "Decouper l'annee.", done: periods.length > 0 },
      { id: "subjects", title: "Matieres", hint: "Cataloguer les disciplines.", done: subjects.length > 0 }
    ];

    const scrollToReference = (stepId: string): void => {
      setReferenceWorkflowStep(stepId);
      const targetByStep: Record<string, string> = {
        years: "reference-years",
        cycles: "reference-cycles",
        levels: "reference-levels",
        classes: "reference-classes",
        periods: "reference-periods",
        subjects: "reference-subjects"
      };
      const target = targetByStep[stepId];
      if (!target) return;
      window.setTimeout(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    };

    return (
      <div className="reference-shell">
        <div className="reference-workflow-shell">
          <WorkflowGuide
            title="Referentiel academique"
            steps={referenceSteps}
            activeStepId={referenceWorkflowStep}
            onStepChange={scrollToReference}
          >
            <article id="reference-years" data-step-id="years" className="panel table-panel module-modern module-stack reference-card">
            <div className="reference-card-head">
              <div>
                <h3>Annee scolaire</h3>
                <p className="section-lead">
                  Base temporelle de tout le logiciel. Une seule annee peut etre active a la fois pour
                  {` ${SCHOOL_NAME}`}.
                </p>
              </div>
              <div className="module-inline-strip">
                <span className="module-inline-pill">{activeSchoolYear ? `Active: ${formatSchoolYearOptionLabel(activeSchoolYear)}` : "Aucune active"}</span>
                <span className="module-inline-pill">Libelle unique par etablissement</span>
              </div>
            </div>
            <div className="reference-section-grid">
              <form
                className="form-grid module-form reference-grid-strict"
                onSubmit={(event) => {
                  event.preventDefault();
                  const errors: FieldErrors = {};
                  const sortOrder = parseOptionalNumber(syForm.sortOrder);

                  if (!syForm.label.trim()) errors.label = "Libelle de l'annee requis.";
                  if (!syForm.startDate) errors.startDate = "Date de debut requise.";
                  if (!syForm.endDate) errors.endDate = "Date de fin requise.";
                  if (!syForm.status) errors.status = "Statut requis.";
                  if (syForm.startDate && syForm.endDate && syForm.endDate <= syForm.startDate) {
                    errors.endDate = "La date de fin doit etre strictement apres la date de debut.";
                  }
                  if (syForm.sortOrder.trim() && sortOrder === undefined) {
                    errors.sortOrder = "Ordre / rang invalide.";
                  }
                  if (syForm.previousYearId) {
                    const previousYear = schoolYearById.get(syForm.previousYearId);
                    if (previousYear?.endDate && syForm.startDate && previousYear.endDate >= syForm.startDate) {
                      errors.previousYearId = "L'annee precedente doit se terminer avant la nouvelle annee.";
                    }
                  }

                  setSchoolYearErrors(errors);
                  if (hasFieldErrors(errors)) {
                    focusFirstInlineErrorField("years");
                    return;
                  }

                  void createRef(
                    "/school-years",
                    {
                      code: syForm.code.trim() || undefined,
                      label: syForm.label.trim(),
                      startDate: syForm.startDate,
                      endDate: syForm.endDate,
                      status: syForm.status,
                      previousYearId: syForm.previousYearId || undefined,
                      isDefault: syForm.isDefault,
                      sortOrder,
                      comment: syForm.comment.trim() || undefined,
                      isActive: syForm.status === "ACTIVE"
                    },
                    "Annee scolaire creee."
                  ).then((ok) => {
                    if (ok) {
                      setSchoolYearErrors({});
                      setSyForm({
                        code: "",
                        label: "",
                        startDate: "",
                        endDate: "",
                        status: "DRAFT",
                        previousYearId: "",
                        isDefault: false,
                        sortOrder: "",
                        comment: ""
                      });
                    }
                  });
                }}
              >
                <label>
                  {renderFieldLabel("Libelle de l'annee scolaire", { required: true })}
                  <input value={syForm.label} onChange={(event) => setSyForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="2025-2026" />
                  {fieldError(schoolYearErrors, "label")}
                </label>
                <label>
                  {renderFieldLabel("Date de debut", { required: true })}
                  <input type="date" value={syForm.startDate} onChange={(event) => setSyForm((prev) => ({ ...prev, startDate: event.target.value }))} />
                  {fieldError(schoolYearErrors, "startDate")}
                </label>
                <label>
                  {renderFieldLabel("Date de fin", { required: true })}
                  <input type="date" value={syForm.endDate} onChange={(event) => setSyForm((prev) => ({ ...prev, endDate: event.target.value }))} />
                  {fieldError(schoolYearErrors, "endDate")}
                </label>
                <label>
                  {renderFieldLabel("Statut", { required: true })}
                  <select value={syForm.status} onChange={(event) => setSyForm((prev) => ({ ...prev, status: event.target.value as SchoolYearStatus }))}>
                    {SCHOOL_YEAR_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatSchoolYearStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                  {fieldError(schoolYearErrors, "status")}
                </label>
                <label>
                  {renderFieldLabel("Code")}
                  <input value={syForm.code} onChange={(event) => setSyForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="AS-2025-2026" />
                  {fieldError(schoolYearErrors, "code")}
                </label>
                <label>
                  {renderFieldLabel("Annee precedente liee")}
                  <select value={syForm.previousYearId} onChange={(event) => setSyForm((prev) => ({ ...prev, previousYearId: event.target.value }))}>
                    <option value="">Aucune</option>
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatSchoolYearOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                  {fieldError(schoolYearErrors, "previousYearId")}
                </label>
                <label>
                  {renderFieldLabel("Etablissement")}
                  <select value={schoolFieldValue} onChange={() => undefined}>
                    <option value={schoolFieldValue}>{SCHOOL_NAME}</option>
                  </select>
                </label>
                <label>
                  {renderFieldLabel("Ordre / rang")}
                  <input type="number" min={0} value={syForm.sortOrder} onChange={(event) => setSyForm((prev) => ({ ...prev, sortOrder: event.target.value }))} placeholder="2025" />
                  {fieldError(schoolYearErrors, "sortOrder")}
                </label>
                <label className="form-grid-span-full">
                  {renderFieldLabel("Commentaire")}
                  <textarea value={syForm.comment} onChange={(event) => setSyForm((prev) => ({ ...prev, comment: event.target.value }))} placeholder="Notes de cadrage, reconduction, decisions..." />
                  {fieldError(schoolYearErrors, "comment")}
                </label>
                <div className="reference-toggle-grid form-grid-span-full">
                  <label className="check-row reference-check-row">
                    <input type="checkbox" checked={syForm.isDefault} onChange={(event) => setSyForm((prev) => ({ ...prev, isDefault: event.target.checked }))} />
                    Annee par defaut pour les nouveaux ecrans et workflows
                  </label>
                </div>
                <div className="actions">
                  <button type="submit">Creer l'annee scolaire</button>
                </div>
              </form>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Libelle</th>
                    <th>Code</th>
                    <th>Dates</th>
                    <th>Statut</th>
                    <th>Options</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolYears.length === 0 ? (
                    <tr><td colSpan={5} className="empty-row">Aucune annee scolaire pour le moment.</td></tr>
                  ) : (
                    schoolYears.map((item) => (
                      <tr key={item.id}>
                        <td>{item.label || item.code}</td>
                        <td>{item.code}</td>
                        <td>{item.startDate} au {item.endDate}</td>
                        <td>{formatSchoolYearStatusLabel(item.status)}</td>
                        <td>
                          <button type="button" className="button-ghost" onClick={() => void deleteRef(`/school-years/${item.id}`, "Annee scolaire supprimee.")}>
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article id="reference-cycles" data-step-id="cycles" className="panel table-panel module-modern module-stack reference-card">
            <div className="reference-card-head">
              <div>
                <h3>Cycle</h3>
                <p className="section-lead">
                  Grand regroupement pedagogique tel que Primaire, College ou Lycee. Il sert de base a
                  plusieurs niveaux.
                </p>
              </div>
              <div className="module-inline-strip">
                <span className="module-inline-pill">{cycles.length} cycle(s)</span>
                <span className="module-inline-pill">Ordre academique coherent</span>
              </div>
            </div>
            <div className="reference-section-grid">
              <form
                className="form-grid module-form reference-grid-strict"
                onSubmit={(event) => {
                  event.preventDefault();
                  const errors: FieldErrors = {};
                  const theoreticalAgeMin = parseOptionalNumber(cycleForm.theoreticalAgeMin);
                  const theoreticalAgeMax = parseOptionalNumber(cycleForm.theoreticalAgeMax);

                  if (!cycleForm.schoolYearId) errors.schoolYearId = "Annee scolaire requise.";
                  if (!cycleForm.label.trim()) errors.label = "Nom du cycle requis.";
                  if (!cycleForm.code.trim()) errors.code = "Code cycle requis.";
                  if (!cycleForm.academicStage) errors.academicStage = "Stade academique requis.";
                  if (!Number.isFinite(cycleForm.sortOrder) || cycleForm.sortOrder < 0) {
                    errors.sortOrder = "Ordre academique invalide.";
                  }
                  if (cycleForm.theoreticalAgeMin.trim() && theoreticalAgeMin === undefined) {
                    errors.theoreticalAgeMin = "Age theorique min invalide.";
                  }
                  if (cycleForm.theoreticalAgeMax.trim() && theoreticalAgeMax === undefined) {
                    errors.theoreticalAgeMax = "Age theorique max invalide.";
                  }
                  if (
                    theoreticalAgeMin !== undefined &&
                    theoreticalAgeMax !== undefined &&
                    theoreticalAgeMax < theoreticalAgeMin
                  ) {
                    errors.theoreticalAgeMax = "L'age theorique max doit etre superieur ou egal au min.";
                  }

                  setCycleErrors(errors);
                  if (hasFieldErrors(errors)) {
                    focusFirstInlineErrorField("cycles");
                    return;
                  }

                  void createRef(
                    "/cycles",
                    {
                      schoolYearId: cycleForm.schoolYearId,
                      code: cycleForm.code.trim(),
                      label: cycleForm.label.trim(),
                      academicStage: cycleForm.academicStage,
                      sortOrder: cycleForm.sortOrder,
                      description: cycleForm.description.trim() || undefined,
                      theoreticalAgeMin,
                      theoreticalAgeMax,
                      status: cycleForm.status
                    },
                    "Cycle cree."
                  ).then((ok) => {
                    if (ok) {
                      setCycleErrors({});
                      setCycleForm((prev) => ({
                        ...prev,
                        schoolYearId: prev.schoolYearId || defaultSchoolYearId,
                        code: "",
                        label: "",
                        academicStage: "PRIMARY",
                        sortOrder: 1,
                        description: "",
                        theoreticalAgeMin: "",
                        theoreticalAgeMax: "",
                        status: "ACTIVE"
                      }));
                    }
                  });
                }}
              >
                <label>
                  {renderFieldLabel("Annee scolaire", { required: true })}
                  <select value={cycleForm.schoolYearId} onChange={(event) => setCycleForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}>
                    <option value="">Choisir</option>
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatSchoolYearOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                  {fieldError(cycleErrors, "schoolYearId")}
                </label>
                <label>
                  {renderFieldLabel("Nom du cycle", { required: true })}
                  <input value={cycleForm.label} onChange={(event) => setCycleForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="Primaire" />
                  {fieldError(cycleErrors, "label")}
                </label>
                <label>
                  {renderFieldLabel("Code", { required: true })}
                  <input value={cycleForm.code} onChange={(event) => setCycleForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="PRIM" />
                  {fieldError(cycleErrors, "code")}
                </label>
                <label>
                  {renderFieldLabel("Stade academique", { required: true })}
                  <select value={cycleForm.academicStage} onChange={(event) => setCycleForm((prev) => ({ ...prev, academicStage: event.target.value as AcademicStage }))}>
                    <option value="PRIMARY">{formatAcademicStageLabel("PRIMARY")}</option>
                    <option value="SECONDARY">{formatAcademicStageLabel("SECONDARY")}</option>
                    <option value="HIGHER">{formatAcademicStageLabel("HIGHER")}</option>
                  </select>
                  {fieldError(cycleErrors, "academicStage")}
                </label>
                <label>
                  {renderFieldLabel("Ordre academique", { required: true })}
                  <input type="number" min={0} value={cycleForm.sortOrder} onChange={(event) => setCycleForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))} />
                  {fieldError(cycleErrors, "sortOrder")}
                </label>
                <label>
                  {renderFieldLabel("Statut")}
                  <select value={cycleForm.status} onChange={(event) => setCycleForm((prev) => ({ ...prev, status: event.target.value as "ACTIVE" | "INACTIVE" }))}>
                    {REFERENCE_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatReferenceStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                  {fieldError(cycleErrors, "status")}
                </label>
                <label>
                  {renderFieldLabel("Age theorique min")}
                  <input type="number" min={0} value={cycleForm.theoreticalAgeMin} onChange={(event) => setCycleForm((prev) => ({ ...prev, theoreticalAgeMin: event.target.value }))} placeholder="6" />
                  {fieldError(cycleErrors, "theoreticalAgeMin")}
                </label>
                <label>
                  {renderFieldLabel("Age theorique max")}
                  <input type="number" min={0} value={cycleForm.theoreticalAgeMax} onChange={(event) => setCycleForm((prev) => ({ ...prev, theoreticalAgeMax: event.target.value }))} placeholder="11" />
                  {fieldError(cycleErrors, "theoreticalAgeMax")}
                </label>
                <label>
                  {renderFieldLabel("Etablissement")}
                  <select value={schoolFieldValue} onChange={() => undefined}>
                    <option value={schoolFieldValue}>{SCHOOL_NAME}</option>
                  </select>
                </label>
                <label className="form-grid-span-full">
                  {renderFieldLabel("Description")}
                  <textarea value={cycleForm.description} onChange={(event) => setCycleForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Grand regroupement pedagogique et contraintes de pilotage..." />
                  {fieldError(cycleErrors, "description")}
                </label>
                <div className="actions">
                  <button type="submit">Creer le cycle</button>
                </div>
              </form>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Annee</th>
                    <th>Cycle</th>
                    <th>Stade</th>
                    <th>Ordre</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucun cycle configure.</td></tr>
                  ) : (
                    cycles.map((item) => (
                      <tr key={item.id}>
                        <td>{item.schoolYearId ? formatSchoolYearOptionLabel(schoolYearById.get(item.schoolYearId)) : "-"}</td>
                        <td>{item.label} ({item.code})</td>
                        <td>{formatAcademicStageLabel(item.academicStage)}</td>
                        <td>{item.sortOrder}</td>
                        <td>{formatReferenceStatusLabel(item.status)}</td>
                        <td>
                          <button type="button" className="button-ghost" onClick={() => void deleteRef(`/cycles/${item.id}`, "Cycle supprime.")}>
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article id="reference-levels" data-step-id="levels" className="panel table-panel module-modern module-stack reference-card">
            <div className="reference-card-head">
              <div>
                <h3>Niveau</h3>
                <p className="section-lead">
                  Classe pedagogique abstraite telle que CP1, 6e ou Terminale. Il ne faut pas la confondre
                  avec la classe reelle d'affectation.
                </p>
              </div>
              <div className="module-inline-strip">
                <span className="module-inline-pill">{levels.length} niveau(x)</span>
                <span className="module-inline-pill">{shownLevels.length} visible(s) avec le filtre</span>
              </div>
            </div>
            <div className="reference-section-grid">
              <form
                className="form-grid module-form reference-grid-strict"
                onSubmit={(event) => {
                  event.preventDefault();
                  const errors: FieldErrors = {};
                  const theoreticalAge = parseOptionalNumber(levelForm.theoreticalAge);

                  if (!levelForm.cycleId) errors.cycleId = "Cycle requis.";
                  if (!levelForm.label.trim()) errors.label = "Nom du niveau requis.";
                  if (!levelForm.code.trim()) errors.code = "Code niveau requis.";
                  if (!levelForm.track) errors.track = "Cursus requis.";
                  if (!levelForm.status) errors.status = "Statut requis.";
                  if (!Number.isFinite(levelForm.sortOrder) || levelForm.sortOrder < 0) {
                    errors.sortOrder = "Ordre invalide dans le cycle.";
                  }
                  if (levelForm.theoreticalAge.trim() && theoreticalAge === undefined) {
                    errors.theoreticalAge = "Age theorique invalide.";
                  }

                  setLevelErrors(errors);
                  if (hasFieldErrors(errors)) {
                    focusFirstInlineErrorField("levels");
                    return;
                  }

                  void createRef(
                    "/levels",
                    {
                      cycleId: levelForm.cycleId,
                      code: levelForm.code.trim(),
                      label: levelForm.label.trim(),
                      sortOrder: levelForm.sortOrder,
                      track: levelForm.track,
                      alias: levelForm.alias.trim() || undefined,
                      status: levelForm.status,
                      theoreticalAge,
                      description: levelForm.description.trim() || undefined,
                      defaultSection: levelForm.defaultSection.trim() || undefined
                    },
                    "Niveau cree."
                  ).then((ok) => {
                    if (ok) {
                      setLevelErrors({});
                      setLevelForm((prev) => ({
                        ...prev,
                        code: "",
                        label: "",
                        sortOrder: 1,
                        alias: "",
                        theoreticalAge: "",
                        description: "",
                        defaultSection: ""
                      }));
                    }
                  });
                }}
              >
                <label>
                  {renderFieldLabel("Cycle de rattachement", { required: true })}
                  <select value={levelForm.cycleId} onChange={(event) => setLevelForm((prev) => ({ ...prev, cycleId: event.target.value }))}>
                    <option value="">Choisir</option>
                    {cycles.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label} - {item.schoolYearId ? formatSchoolYearOptionLabel(schoolYearById.get(item.schoolYearId)) : "-"}
                      </option>
                    ))}
                  </select>
                  {fieldError(levelErrors, "cycleId")}
                </label>
                <label>
                  {renderFieldLabel("Nom du niveau", { required: true })}
                  <input value={levelForm.label} onChange={(event) => setLevelForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="6e" />
                  {fieldError(levelErrors, "label")}
                </label>
                <label>
                  {renderFieldLabel("Code", { required: true })}
                  <input value={levelForm.code} onChange={(event) => setLevelForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="6E" />
                  {fieldError(levelErrors, "code")}
                </label>
                <label>
                  {renderFieldLabel("Ordre", { required: true })}
                  <input type="number" min={0} value={levelForm.sortOrder} onChange={(event) => setLevelForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))} />
                  {fieldError(levelErrors, "sortOrder")}
                </label>
                <label>
                  {renderFieldLabel("Cursus", { required: true })}
                  <select value={levelForm.track} onChange={(event) => setLevelForm((prev) => ({ ...prev, track: event.target.value as AcademicTrack }))}>
                    {ACADEMIC_TRACK_OPTIONS.map((track) => (
                      <option key={track} value={track}>
                        {formatAcademicTrackLabel(track)}
                      </option>
                    ))}
                  </select>
                  {fieldError(levelErrors, "track")}
                </label>
                <label>
                  {renderFieldLabel("Statut", { required: true })}
                  <select value={levelForm.status} onChange={(event) => setLevelForm((prev) => ({ ...prev, status: event.target.value as "ACTIVE" | "INACTIVE" }))}>
                    {REFERENCE_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatReferenceStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                  {fieldError(levelErrors, "status")}
                </label>
                <label>
                  {renderFieldLabel("Alias / libelle court")}
                  <input value={levelForm.alias} onChange={(event) => setLevelForm((prev) => ({ ...prev, alias: event.target.value }))} placeholder="Sixieme" />
                  {fieldError(levelErrors, "alias")}
                </label>
                <label>
                  {renderFieldLabel("Age theorique")}
                  <input type="number" min={0} value={levelForm.theoreticalAge} onChange={(event) => setLevelForm((prev) => ({ ...prev, theoreticalAge: event.target.value }))} placeholder="11" />
                  {fieldError(levelErrors, "theoreticalAge")}
                </label>
                <label>
                  {renderFieldLabel("Section / filiere par defaut")}
                  <input value={levelForm.defaultSection} onChange={(event) => setLevelForm((prev) => ({ ...prev, defaultSection: event.target.value }))} placeholder="General" />
                  {fieldError(levelErrors, "defaultSection")}
                </label>
                <label>
                  {renderFieldLabel("Annee scolaire")}
                  <select className="reference-derived-select" value={selectedLevelSchoolYearId} disabled>
                    {selectedLevelSchoolYearId ? null : <option value="">Aucune annee scolaire</option>}
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatSchoolYearOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-grid-span-full">
                  {renderFieldLabel("Description")}
                  <textarea value={levelForm.description} onChange={(event) => setLevelForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Positionnement du niveau, attentes, passerelles..." />
                  {fieldError(levelErrors, "description")}
                </label>
                <div className="actions">
                  <button type="submit">Creer le niveau</button>
                </div>
              </form>
            </div>
            <div className="filter-grid module-filter">
              <label>
                {renderFieldLabel("Filtre cycle")}
                <select value={levelCycleFilter} onChange={(event) => setLevelCycleFilter(event.target.value)}>
                  <option value="">Tous les cycles</option>
                  {cycles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cycle</th>
                    <th>Niveau</th>
                    <th>Cursus</th>
                    <th>Ordre</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shownLevels.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucun niveau pour le filtre courant.</td></tr>
                  ) : (
                    shownLevels.map((item) => (
                      <tr key={item.id}>
                        <td>{cycleById.get(item.cycleId)?.label || "-"}</td>
                        <td>{item.label} ({item.code})</td>
                        <td>{formatAcademicTrackLabel(item.track)}</td>
                        <td>{item.sortOrder}</td>
                        <td>{formatReferenceStatusLabel(item.status)}</td>
                        <td>
                          <button type="button" className="button-ghost" onClick={() => void deleteRef(`/levels/${item.id}`, "Niveau supprime.")}>
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article id="reference-classes" data-step-id="classes" className="panel table-panel module-modern module-stack reference-card">
            <div className="reference-card-head">
              <div>
                <h3>Classe</h3>
                <p className="section-lead">
                  Instance reelle d'affectation pour une annee donnee, par exemple 6e A. Ici on separe
                  volontairement le niveau abstrait de la classe concrete.
                </p>
              </div>
              <div className="module-inline-strip">
                <span className="module-inline-pill">{classes.length} classe(s)</span>
                <span className="module-inline-pill">Niveau et annee obligatoires</span>
              </div>
            </div>
            <div className="reference-section-grid">
              <form
                className="form-grid module-form reference-grid-strict"
                onSubmit={(event) => {
                  event.preventDefault();
                  const errors: FieldErrors = {};
                  const capacity = parseOptionalNumber(classForm.capacity);
                  const actualCapacity = parseOptionalNumber(classForm.actualCapacity);

                  if (!classForm.schoolYearId) errors.schoolYearId = "Annee scolaire requise.";
                  if (!classForm.levelId) errors.levelId = "Niveau requis.";
                  if (!classForm.track) errors.track = "Cursus requis.";
                  if (!classForm.code.trim()) errors.code = "Code classe requis.";
                  if (!classForm.label.trim()) errors.label = "Nom de la classe requis.";
                  if (capacity === undefined || capacity <= 0) {
                    errors.capacity = "L'effectif maximal doit etre strictement superieur a zero.";
                  }
                  if (!classForm.status) errors.status = "Statut requis.";
                  if (classForm.actualCapacity.trim() && (actualCapacity === undefined || actualCapacity < 0)) {
                    errors.actualCapacity = "Capacite reelle invalide.";
                  }
                  if (
                    actualCapacity !== undefined &&
                    capacity !== undefined &&
                    actualCapacity > capacity
                  ) {
                    errors.actualCapacity = "La capacite reelle ne peut pas depasser l'effectif maximal.";
                  }
                  if (selectedClassLevel && selectedClassLevel.track !== classForm.track) {
                    errors.track = "Le cursus de la classe doit rester coherent avec celui du niveau.";
                  }
                  if (
                    selectedClassCycle &&
                    classForm.schoolYearId &&
                    selectedClassCycle.schoolYearId !== classForm.schoolYearId
                  ) {
                    errors.schoolYearId = "L'annee de la classe doit correspondre a l'annee du niveau / cycle.";
                  }

                  setClassErrors(errors);
                  if (hasFieldErrors(errors)) {
                    focusFirstInlineErrorField("classes");
                    return;
                  }

                  void createRef(
                    "/classes",
                    {
                      schoolYearId: classForm.schoolYearId,
                      levelId: classForm.levelId,
                      code: classForm.code.trim(),
                      label: classForm.label.trim(),
                      capacity,
                      track: classForm.track,
                      status: classForm.status,
                      homeroomTeacherName: classForm.homeroomTeacherName.trim() || undefined,
                      mainRoom: classForm.mainRoom.trim() || undefined,
                      actualCapacity,
                      filiere: classForm.filiere.trim() || undefined,
                      series: classForm.series.trim() || undefined,
                      speciality: classForm.speciality.trim() || undefined,
                      description: classForm.description.trim() || undefined,
                      teachingMode: classForm.teachingMode
                    },
                    "Classe creee."
                  ).then((ok) => {
                    if (ok) {
                      setClassErrors({});
                      setClassForm((prev) => ({
                        ...prev,
                        schoolYearId: prev.schoolYearId || defaultSchoolYearId,
                        code: "",
                        label: "",
                        capacity: "",
                        homeroomTeacherName: "",
                        mainRoom: "",
                        actualCapacity: "",
                        filiere: "",
                        series: "",
                        speciality: "",
                        description: "",
                        teachingMode: "PRESENTIAL"
                      }));
                    }
                  });
                }}
              >
                <label>
                  {renderFieldLabel("Annee scolaire", { required: true })}
                  <select value={classForm.schoolYearId} onChange={(event) => setClassForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}>
                    <option value="">Choisir</option>
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatSchoolYearOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                  {fieldError(classErrors, "schoolYearId")}
                </label>
                <label>
                  {renderFieldLabel("Niveau", { required: true })}
                  <select
                    value={classForm.levelId}
                    onChange={(event) => {
                      const nextLevelId = event.target.value;
                      const nextLevel = levelById.get(nextLevelId);
                      const nextCycle = nextLevel ? cycleById.get(nextLevel.cycleId) : undefined;
                      setClassForm((prev) => ({
                        ...prev,
                        levelId: nextLevelId,
                        track: nextLevel?.track || prev.track,
                        schoolYearId: nextCycle?.schoolYearId || prev.schoolYearId
                      }));
                    }}
                  >
                    <option value="">Choisir</option>
                    {levels.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label} - {cycleById.get(item.cycleId)?.label || "-"}
                      </option>
                    ))}
                  </select>
                  {fieldError(classErrors, "levelId")}
                </label>
                <label>
                  {renderFieldLabel("Nom de la classe", { required: true })}
                  <input value={classForm.label} onChange={(event) => setClassForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="6e A" />
                  {fieldError(classErrors, "label")}
                </label>
                <label>
                  {renderFieldLabel("Code", { required: true })}
                  <input value={classForm.code} onChange={(event) => setClassForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="6A-2526" />
                  {fieldError(classErrors, "code")}
                </label>
                <label>
                  {renderFieldLabel("Cursus", { required: true })}
                  <select value={classForm.track} onChange={(event) => setClassForm((prev) => ({ ...prev, track: event.target.value as AcademicTrack }))}>
                    {ACADEMIC_TRACK_OPTIONS.map((track) => (
                      <option key={track} value={track}>
                        {formatAcademicTrackLabel(track)}
                      </option>
                    ))}
                  </select>
                  {fieldError(classErrors, "track")}
                </label>
                <label>
                  {renderFieldLabel("Effectif maximal", { required: true })}
                  <input type="number" min={1} value={classForm.capacity} onChange={(event) => setClassForm((prev) => ({ ...prev, capacity: event.target.value }))} placeholder="30" />
                  {fieldError(classErrors, "capacity")}
                </label>
                <label>
                  {renderFieldLabel("Statut", { required: true })}
                  <select value={classForm.status} onChange={(event) => setClassForm((prev) => ({ ...prev, status: event.target.value as "ACTIVE" | "INACTIVE" }))}>
                    {REFERENCE_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatReferenceStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                  {fieldError(classErrors, "status")}
                </label>
                <label>
                  {renderFieldLabel("Titulaire / professeur principal")}
                  <input value={classForm.homeroomTeacherName} onChange={(event) => setClassForm((prev) => ({ ...prev, homeroomTeacherName: event.target.value }))} placeholder="M. Diallo" />
                  {fieldError(classErrors, "homeroomTeacherName")}
                </label>
                <label>
                  {renderFieldLabel("Salle principale")}
                  <input value={classForm.mainRoom} onChange={(event) => setClassForm((prev) => ({ ...prev, mainRoom: event.target.value }))} placeholder="B-12" />
                  {fieldError(classErrors, "mainRoom")}
                </label>
                <label>
                  {renderFieldLabel("Capacite reelle")}
                  <input type="number" min={0} value={classForm.actualCapacity} onChange={(event) => setClassForm((prev) => ({ ...prev, actualCapacity: event.target.value }))} placeholder="28" />
                  {fieldError(classErrors, "actualCapacity")}
                </label>
                <label>
                  {renderFieldLabel("Filiere")}
                  <input value={classForm.filiere} onChange={(event) => setClassForm((prev) => ({ ...prev, filiere: event.target.value }))} placeholder="General" />
                  {fieldError(classErrors, "filiere")}
                </label>
                <label>
                  {renderFieldLabel("Serie")}
                  <input value={classForm.series} onChange={(event) => setClassForm((prev) => ({ ...prev, series: event.target.value }))} placeholder="D" />
                  {fieldError(classErrors, "series")}
                </label>
                <label>
                  {renderFieldLabel("Specialite")}
                  <input value={classForm.speciality} onChange={(event) => setClassForm((prev) => ({ ...prev, speciality: event.target.value }))} placeholder="Sciences" />
                  {fieldError(classErrors, "speciality")}
                </label>
                <label>
                  {renderFieldLabel("Mode d'enseignement")}
                  <select value={classForm.teachingMode} onChange={(event) => setClassForm((prev) => ({ ...prev, teachingMode: event.target.value }))}>
                    {TEACHING_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {fieldError(classErrors, "teachingMode")}
                </label>
                <label>
                  {renderFieldLabel("Cycle")}
                  <select className="reference-derived-select" value={selectedClassCycleId} disabled>
                    {selectedClassCycleId ? null : <option value="">Selectionner un niveau</option>}
                    {classCycleOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {renderFieldLabel("Etablissement")}
                  <select value={schoolFieldValue} onChange={() => undefined}>
                    <option value={schoolFieldValue}>{SCHOOL_NAME}</option>
                  </select>
                </label>
                <label className="form-grid-span-full">
                  {renderFieldLabel("Description")}
                  <textarea value={classForm.description} onChange={(event) => setClassForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Contraintes d'affectation, orientation, salle specialisee..." />
                  {fieldError(classErrors, "description")}
                </label>
                <div className="actions">
                  <button type="submit">Creer la classe</button>
                </div>
              </form>
            </div>
            <div className="filter-grid module-filter">
              <label>
                {renderFieldLabel("Filtre annee")}
                <select value={classYearFilter} onChange={(event) => setClassYearFilter(event.target.value)}>
                  <option value="">Toutes les annees</option>
                  {schoolYears.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatSchoolYearOptionLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {renderFieldLabel("Filtre niveau")}
                <select value={classLevelFilter} onChange={(event) => setClassLevelFilter(event.target.value)}>
                  <option value="">Tous les niveaux</option>
                  {levels.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Annee</th>
                    <th>Classe</th>
                    <th>Niveau</th>
                    <th>Capacite</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shownClasses.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucune classe pour le filtre courant.</td></tr>
                  ) : (
                    shownClasses.map((item) => (
                      <tr key={item.id}>
                        <td>{formatSchoolYearOptionLabel(schoolYearById.get(item.schoolYearId))}</td>
                        <td>{item.label} ({item.code})</td>
                        <td>{levelById.get(item.levelId)?.label || "-"}</td>
                        <td>{item.actualCapacity ?? item.capacity ?? "-"} / {item.capacity ?? "-"}</td>
                        <td>{formatReferenceStatusLabel(item.status)}</td>
                        <td>
                          <button type="button" className="button-ghost" onClick={() => void deleteRef(`/classes/${item.id}`, "Classe supprimee.")}>
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article id="reference-periods" data-step-id="periods" className="panel table-panel module-modern module-stack reference-card">
            <div className="reference-card-head">
              <div>
                <h3>Periode</h3>
                <p className="section-lead">
                  Decoupage pedagogique ou evaluatif de l'annee: trimestre, semestre, bimestre ou libre.
                </p>
              </div>
              <div className="module-inline-strip">
                <span className="module-inline-pill">{periods.length} periode(s)</span>
                <span className="module-inline-pill">Dates bornees dans l'annee</span>
              </div>
            </div>
            <div className="reference-section-grid">
              <form
                className="form-grid module-form reference-grid-strict"
                onSubmit={(event) => {
                  event.preventDefault();
                  const errors: FieldErrors = {};

                  if (!periodForm.schoolYearId) errors.schoolYearId = "Annee scolaire requise.";
                  if (!periodForm.label.trim()) errors.label = "Nom de la periode requis.";
                  if (!periodForm.code.trim()) errors.code = "Code periode requis.";
                  if (!periodForm.startDate) errors.startDate = "Date de debut requise.";
                  if (!periodForm.endDate) errors.endDate = "Date de fin requise.";
                  if (!Number.isFinite(periodForm.sortOrder) || periodForm.sortOrder < 0) {
                    errors.sortOrder = "Ordre de periode invalide.";
                  }
                  if (!periodForm.status) errors.status = "Statut requis.";
                  if (periodForm.startDate && periodForm.endDate && periodForm.endDate <= periodForm.startDate) {
                    errors.endDate = "La date de fin doit etre strictement apres la date de debut.";
                  }
                  if (
                    selectedPeriodSchoolYear &&
                    periodForm.startDate &&
                    selectedPeriodSchoolYear.startDate &&
                    selectedPeriodSchoolYear.endDate &&
                    (periodForm.startDate < selectedPeriodSchoolYear.startDate || periodForm.startDate > selectedPeriodSchoolYear.endDate)
                  ) {
                    errors.startDate = "La date de debut doit rester dans l'annee scolaire choisie.";
                  }
                  if (
                    selectedPeriodSchoolYear &&
                    periodForm.endDate &&
                    selectedPeriodSchoolYear.startDate &&
                    selectedPeriodSchoolYear.endDate &&
                    (periodForm.endDate < selectedPeriodSchoolYear.startDate || periodForm.endDate > selectedPeriodSchoolYear.endDate)
                  ) {
                    errors.endDate = "La date de fin doit rester dans l'annee scolaire choisie.";
                  }
                  if (
                    periodForm.gradeEntryDeadline &&
                    (periodForm.gradeEntryDeadline < periodForm.startDate || periodForm.gradeEntryDeadline > periodForm.endDate)
                  ) {
                    errors.gradeEntryDeadline = "La date limite de saisie doit rester dans la periode.";
                  }
                  if (periodForm.lockDate && periodForm.startDate && periodForm.lockDate < periodForm.startDate) {
                    errors.lockDate = "La date de verrouillage ne peut pas etre avant le debut.";
                  }
                  if (periodForm.parentPeriodId) {
                    const parent = periods.find((item) => item.id === periodForm.parentPeriodId);
                    if (parent && parent.schoolYearId !== periodForm.schoolYearId) {
                      errors.parentPeriodId = "La periode parent doit appartenir a la meme annee scolaire.";
                    }
                  }

                  setPeriodErrors(errors);
                  if (hasFieldErrors(errors)) {
                    focusFirstInlineErrorField("periods");
                    return;
                  }

                  void createRef(
                    "/academic-periods",
                    {
                      schoolYearId: periodForm.schoolYearId,
                      code: periodForm.code.trim(),
                      label: periodForm.label.trim(),
                      startDate: periodForm.startDate,
                      endDate: periodForm.endDate,
                      periodType: periodForm.periodType,
                      sortOrder: periodForm.sortOrder,
                      status: periodForm.status,
                      parentPeriodId: periodForm.parentPeriodId || undefined,
                      isGradeEntryOpen: periodForm.isGradeEntryOpen,
                      gradeEntryDeadline: periodForm.gradeEntryDeadline || undefined,
                      lockDate: periodForm.lockDate || undefined,
                      comment: periodForm.comment.trim() || undefined
                    },
                    "Periode creee."
                  ).then((ok) => {
                    if (ok) {
                      setPeriodErrors({});
                      setPeriodForm((prev) => ({
                        ...prev,
                        schoolYearId: prev.schoolYearId || defaultSchoolYearId,
                        code: "",
                        label: "",
                        startDate: "",
                        endDate: "",
                        periodType: "TRIMESTER",
                        sortOrder: 1,
                        status: "ACTIVE",
                        parentPeriodId: "",
                        isGradeEntryOpen: false,
                        gradeEntryDeadline: "",
                        lockDate: "",
                        comment: ""
                      }));
                    }
                  });
                }}
              >
                <label>
                  {renderFieldLabel("Annee scolaire", { required: true })}
                  <select value={periodForm.schoolYearId} onChange={(event) => setPeriodForm((prev) => ({ ...prev, schoolYearId: event.target.value, parentPeriodId: "" }))}>
                    <option value="">Choisir</option>
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatSchoolYearOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                  {fieldError(periodErrors, "schoolYearId")}
                </label>
                <label>
                  {renderFieldLabel("Nom de la periode", { required: true })}
                  <input value={periodForm.label} onChange={(event) => setPeriodForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="Trimestre 1" />
                  {fieldError(periodErrors, "label")}
                </label>
                <label>
                  {renderFieldLabel("Code", { required: true })}
                  <input value={periodForm.code} onChange={(event) => setPeriodForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="T1-2526" />
                  {fieldError(periodErrors, "code")}
                </label>
                <label>
                  {renderFieldLabel("Date de debut", { required: true })}
                  <input type="date" value={periodForm.startDate} onChange={(event) => setPeriodForm((prev) => ({ ...prev, startDate: event.target.value }))} />
                  {fieldError(periodErrors, "startDate")}
                </label>
                <label>
                  {renderFieldLabel("Date de fin", { required: true })}
                  <input type="date" value={periodForm.endDate} onChange={(event) => setPeriodForm((prev) => ({ ...prev, endDate: event.target.value }))} />
                  {fieldError(periodErrors, "endDate")}
                </label>
                <label>
                  {renderFieldLabel("Type de periode", { required: true })}
                  <select value={periodForm.periodType} onChange={(event) => setPeriodForm((prev) => ({ ...prev, periodType: event.target.value }))}>
                    {PERIOD_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {fieldError(periodErrors, "periodType")}
                </label>
                <label>
                  {renderFieldLabel("Ordre", { required: true })}
                  <input type="number" min={0} value={periodForm.sortOrder} onChange={(event) => setPeriodForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))} />
                  {fieldError(periodErrors, "sortOrder")}
                </label>
                <label>
                  {renderFieldLabel("Statut", { required: true })}
                  <select value={periodForm.status} onChange={(event) => setPeriodForm((prev) => ({ ...prev, status: event.target.value as PeriodStatus }))}>
                    {PERIOD_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatReferenceStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                  {fieldError(periodErrors, "status")}
                </label>
                <label>
                  {renderFieldLabel("Periode parent")}
                  <select value={periodForm.parentPeriodId} onChange={(event) => setPeriodForm((prev) => ({ ...prev, parentPeriodId: event.target.value }))}>
                    <option value="">Aucune</option>
                    {periodParents.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  {fieldError(periodErrors, "parentPeriodId")}
                </label>
                <label>
                  {renderFieldLabel("Date limite de saisie des notes")}
                  <input type="date" value={periodForm.gradeEntryDeadline} onChange={(event) => setPeriodForm((prev) => ({ ...prev, gradeEntryDeadline: event.target.value }))} />
                  {fieldError(periodErrors, "gradeEntryDeadline")}
                </label>
                <label>
                  {renderFieldLabel("Date de verrouillage")}
                  <input type="date" value={periodForm.lockDate} onChange={(event) => setPeriodForm((prev) => ({ ...prev, lockDate: event.target.value }))} />
                  {fieldError(periodErrors, "lockDate")}
                </label>
                <label className="form-grid-span-full">
                  {renderFieldLabel("Commentaire")}
                  <textarea value={periodForm.comment} onChange={(event) => setPeriodForm((prev) => ({ ...prev, comment: event.target.value }))} placeholder="Consignes de saisie, verrouillage, mode de calcul..." />
                  {fieldError(periodErrors, "comment")}
                </label>
                <div className="reference-toggle-grid form-grid-span-full">
                  <label className="check-row reference-check-row">
                    <input type="checkbox" checked={periodForm.isGradeEntryOpen} onChange={(event) => setPeriodForm((prev) => ({ ...prev, isGradeEntryOpen: event.target.checked }))} />
                    Periode de saisie des notes ouverte
                  </label>
                </div>
                <div className="actions">
                  <button type="submit">Creer la periode</button>
                </div>
              </form>
            </div>
            <div className="filter-grid module-filter">
              <label>
                {renderFieldLabel("Filtre annee")}
                <select value={periodYearFilter} onChange={(event) => setPeriodYearFilter(event.target.value)}>
                  <option value="">Toutes les annees</option>
                  {schoolYears.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatSchoolYearOptionLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Annee</th>
                    <th>Periode</th>
                    <th>Type</th>
                    <th>Dates</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shownPeriods.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucune periode pour le filtre courant.</td></tr>
                  ) : (
                    shownPeriods.map((item) => (
                      <tr key={item.id}>
                        <td>{formatSchoolYearOptionLabel(schoolYearById.get(item.schoolYearId))}</td>
                        <td>{item.label} ({item.code})</td>
                        <td>{formatPeriodTypeLabel(item.periodType)}</td>
                        <td>{item.startDate} au {item.endDate}</td>
                        <td>{formatReferenceStatusLabel(item.status)}</td>
                        <td>
                          <button type="button" className="button-ghost" onClick={() => void deleteRef(`/academic-periods/${item.id}`, "Periode supprimee.")}>
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article id="reference-subjects" data-step-id="subjects" className="panel table-panel module-modern module-stack reference-card">
            <div className="reference-card-head">
              <div>
                <h3>Matiere</h3>
                <p className="section-lead">
                  Discipline enseignee, distincte de son affectation a une classe, de son enseignant et de son emploi du temps.
                </p>
              </div>
              <div className="module-inline-strip">
                <span className="module-inline-pill">{subjects.length} matiere(s)</span>
                <span className="module-inline-pill">{subjectForm.levelIds.length} niveau(x) selectionne(s)</span>
              </div>
            </div>
            <div className="reference-section-grid">
              <form
                className="form-grid module-form reference-grid-strict"
                onSubmit={(event) => {
                  event.preventDefault();
                  const errors: FieldErrors = {};
                  const defaultCoefficient = parseOptionalNumber(subjectForm.defaultCoefficient);
                  const weeklyHours = parseOptionalNumber(subjectForm.weeklyHours);

                  if (!subjectForm.label.trim()) errors.label = "Nom de la matiere requis.";
                  if (!subjectForm.code.trim()) errors.code = "Code matiere requis.";
                  if (!subjectForm.status) errors.status = "Statut requis.";
                  if (!subjectForm.nature) errors.nature = "Nature de la matiere requise.";
                  if (subjectForm.defaultCoefficient.trim() && (defaultCoefficient === undefined || defaultCoefficient <= 0)) {
                    errors.defaultCoefficient = "Le coefficient doit etre strictement superieur a zero.";
                  }
                  if (subjectForm.weeklyHours.trim() && (weeklyHours === undefined || weeklyHours <= 0)) {
                    errors.weeklyHours = "Le volume horaire doit etre strictement superieur a zero.";
                  }

                  setSubjectErrors(errors);
                  if (hasFieldErrors(errors)) {
                    focusFirstInlineErrorField("subjects");
                    return;
                  }

                  void createRef(
                    "/subjects",
                    {
                      code: subjectForm.code.trim(),
                      label: subjectForm.label.trim(),
                      status: subjectForm.status,
                      nature: subjectForm.nature,
                      shortLabel: subjectForm.shortLabel.trim() || undefined,
                      defaultCoefficient,
                      category: subjectForm.category.trim() || undefined,
                      description: subjectForm.description.trim() || undefined,
                      color: subjectForm.color || undefined,
                      weeklyHours,
                      isGraded: subjectForm.isGraded,
                      isOptional: subjectForm.isOptional,
                      levelIds: subjectForm.levelIds.length > 0 ? subjectForm.levelIds : undefined,
                      isArabic: subjectForm.nature === "ARABOPHONE"
                    },
                    "Matiere creee."
                  ).then((ok) => {
                    if (ok) {
                      setSubjectErrors({});
                      setSubjectForm((prev) => ({
                        ...prev,
                        code: "",
                        label: "",
                        status: "ACTIVE",
                        nature: "FRANCOPHONE",
                        shortLabel: "",
                        defaultCoefficient: "",
                        category: "",
                        description: "",
                        color: "#16a34a",
                        weeklyHours: "",
                        isGraded: true,
                        isOptional: false,
                        levelIds: []
                      }));
                      setSubjectCycleScope("");
                    }
                  });
                }}
              >
                <label>
                  {renderFieldLabel("Nom de la matiere", { required: true })}
                  <input value={subjectForm.label} onChange={(event) => setSubjectForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="Mathematiques" />
                  {fieldError(subjectErrors, "label")}
                </label>
                <label>
                  {renderFieldLabel("Code", { required: true })}
                  <input value={subjectForm.code} onChange={(event) => setSubjectForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="MATH" />
                  {fieldError(subjectErrors, "code")}
                </label>
                <label>
                  {renderFieldLabel("Statut", { required: true })}
                  <select value={subjectForm.status} onChange={(event) => setSubjectForm((prev) => ({ ...prev, status: event.target.value as "ACTIVE" | "INACTIVE" }))}>
                    {REFERENCE_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatReferenceStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                  {fieldError(subjectErrors, "status")}
                </label>
                <label>
                  {renderFieldLabel("Nature", { required: true })}
                  <select value={subjectForm.nature} onChange={(event) => setSubjectForm((prev) => ({ ...prev, nature: event.target.value as SubjectNature }))}>
                    {SUBJECT_NATURE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatSubjectNatureLabel(option)}
                      </option>
                    ))}
                  </select>
                  {fieldError(subjectErrors, "nature")}
                </label>
                <label>
                  {renderFieldLabel("Libelle court")}
                  <input value={subjectForm.shortLabel} onChange={(event) => setSubjectForm((prev) => ({ ...prev, shortLabel: event.target.value }))} placeholder="Maths" />
                  {fieldError(subjectErrors, "shortLabel")}
                </label>
                <label>
                  {renderFieldLabel("Coefficient par defaut")}
                  <input type="number" min={0} step="0.1" value={subjectForm.defaultCoefficient} onChange={(event) => setSubjectForm((prev) => ({ ...prev, defaultCoefficient: event.target.value }))} placeholder="4" />
                  {fieldError(subjectErrors, "defaultCoefficient")}
                </label>
                <label>
                  {renderFieldLabel("Cycle concerne")}
                  <select
                    value={subjectCycleScope}
                    onChange={(event) => {
                      const nextCycleId = event.target.value;
                      const allowedLevelIds = nextCycleId
                        ? new Set(levels.filter((item) => item.cycleId === nextCycleId).map((item) => item.id))
                        : null;
                      setSubjectCycleScope(nextCycleId);
                      setSubjectForm((prev) => ({
                        ...prev,
                        levelIds: allowedLevelIds ? prev.levelIds.filter((levelId) => allowedLevelIds.has(levelId)) : prev.levelIds
                      }));
                    }}
                  >
                    <option value="">Tous les cycles</option>
                    {cycles.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {renderFieldLabel("Categorie / groupe")}
                  <input value={subjectForm.category} onChange={(event) => setSubjectForm((prev) => ({ ...prev, category: event.target.value }))} placeholder="Scientifique" />
                  {fieldError(subjectErrors, "category")}
                </label>
                <label>
                  {renderFieldLabel("Couleur d'affichage")}
                  <input type="color" value={subjectForm.color} onChange={(event) => setSubjectForm((prev) => ({ ...prev, color: event.target.value }))} />
                  {fieldError(subjectErrors, "color")}
                </label>
                <label>
                  {renderFieldLabel("Volume horaire hebdomadaire")}
                  <input type="number" min={0} step="0.5" value={subjectForm.weeklyHours} onChange={(event) => setSubjectForm((prev) => ({ ...prev, weeklyHours: event.target.value }))} placeholder="4" />
                  {fieldError(subjectErrors, "weeklyHours")}
                </label>
                <label className="form-grid-span-full">
                  {renderFieldLabel("Niveau(x) concerne(s)")}
                  <select
                    multiple
                    className="multi-select"
                    value={subjectForm.levelIds}
                    onChange={(event) =>
                      setSubjectForm((prev) => ({
                        ...prev,
                        levelIds: Array.from(event.target.selectedOptions).map((option) => option.value)
                      }))
                    }
                  >
                    {subjectAvailableLevels.map((item) => (
                      <option key={item.id} value={item.id}>
                        {cycleById.get(item.cycleId)?.label || "-"} - {item.label} ({formatAcademicTrackLabel(item.track)})
                      </option>
                    ))}
                  </select>
                  {fieldError(subjectErrors, "levelIds")}
                </label>
                <label className="form-grid-span-full">
                  {renderFieldLabel("Description")}
                  <textarea value={subjectForm.description} onChange={(event) => setSubjectForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Portee de la discipline, evaluation, obligations..." />
                  {fieldError(subjectErrors, "description")}
                </label>
                <div className="reference-toggle-grid form-grid-span-full">
                  <label className="check-row reference-check-row">
                    <input type="checkbox" checked={subjectForm.isGraded} onChange={(event) => setSubjectForm((prev) => ({ ...prev, isGraded: event.target.checked }))} />
                    Matiere notee
                  </label>
                  <label className="check-row reference-check-row">
                    <input type="checkbox" checked={subjectForm.isOptional} onChange={(event) => setSubjectForm((prev) => ({ ...prev, isOptional: event.target.checked }))} />
                    Matiere optionnelle
                  </label>
                </div>
                <div className="actions">
                  <button type="submit">Creer la matiere</button>
                </div>
              </form>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Matiere</th>
                    <th>Nature</th>
                    <th>Cycles</th>
                    <th>Niveaux</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">Aucune matiere configuree.</td></tr>
                  ) : (
                    subjects.map((item) => (
                      <tr key={item.id}>
                        <td>{item.label} ({item.code})</td>
                        <td>{formatSubjectNatureLabel(item.nature)}</td>
                        <td>{formatSubjectCycles(item.levelIds)}</td>
                        <td>{formatSubjectLevels(item.levelIds)}</td>
                        <td>{formatReferenceStatusLabel(item.status)}</td>
                        <td>
                          <button type="button" className="button-ghost" onClick={() => void deleteRef(`/subjects/${item.id}`, "Matiere supprimee.")}>
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </article>
          </WorkflowGuide>
        </div>
      </div>
    );
  };

  const renderForbidden = (): JSX.Element => (
    <section className="panel table-panel">
      <h2>Acces refuse</h2>
      <p className="subtle">Votre profil ({currentRoleLabel}) n'a pas acces a cet ecran.</p>
    </section>
  );

  const renderActiveScreen = (): JSX.Element => {
    if (!currentRole || !hasScreenAccess(currentRole, tab)) {
      return renderForbidden();
    }

    if (tab === "dashboard") return renderDashboard();
    if (tab === "iam") return renderIam();
    if (tab === "teachers") {
      return (
        <TeachersScreen
          api={api}
          classes={classes}
          cycles={cycles}
          levels={levels}
          periods={periods}
          schoolYears={schoolYears}
          subjects={subjects}
          users={users}
          onError={setError}
          onNotice={setNotice}
        />
      );
    }
    if (tab === "rooms") {
      return (
        <RoomsScreen
          api={api}
          classes={classes}
          cycles={cycles}
          levels={levels}
          periods={periods}
          schoolYears={schoolYears}
          subjects={subjects}
          onError={setError}
          onNotice={setNotice}
        />
      );
    }
    if (tab === "students") return renderStudents();
    if (tab === "parents") {
      return (
        <ParentsScreen
          api={api}
          students={students}
          users={users}
          onError={setError}
          onNotice={setNotice}
          onParentsChanged={loadStudents}
        />
      );
    }
    if (tab === "reference") return renderReferenceScreen();
    /*
    if (tab === "reference") {
      const referenceSteps: WorkflowStepDef[] = [
        { id: "years", title: "Annees", hint: "Configurer les annees scolaires.", done: schoolYears.length > 0 },
        { id: "cycles", title: "Cycles / niveaux", hint: "Structurer les parcours.", done: cycles.length > 0 && levels.length > 0 },
        { id: "classes", title: "Classes / matieres", hint: "Creer classes et matieres.", done: classes.length > 0 && subjects.length > 0 },
        { id: "periods", title: "Periodes", hint: "Definir les periodes academiques.", done: periods.length > 0 }
      ];

      const scrollToReference = (stepId: string): void => {
        setReferenceWorkflowStep(stepId);
        const targetByStep: Record<string, string> = {
          years: "reference-years",
          cycles: "reference-cycles",
          classes: "reference-classes",
          periods: "reference-periods"
        };
        const target = targetByStep[stepId];
        if (!target) return;
        window.setTimeout(() => {
          document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      };

      return (
        <WorkflowGuide
          title="Referentiel academique"
          steps={referenceSteps}
          activeStepId={referenceWorkflowStep}
          onStepChange={scrollToReference}
        >
          <section className="panel table-panel module-modern">
            <div className="table-header">
              <h2>Referentiel academique</h2>
            </div>
            <p className="section-lead">Unifiez les parametres metier: annee, structure pedagogique, classes et periodes.</p>
            <div className="reference-grid">
              <article id="reference-years" data-step-id="years" className="panel card-panel module-modern module-stack">
                <h3>Annees scolaires</h3>
                <p className="section-lead">Definissez la fenetre de travail de l'etablissement avant tout autre parametrage.</p>
                <form
                  className="form-grid module-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const errors: FieldErrors = {};
                    if (!syForm.code.trim()) errors.code = "Code annee requis.";
                    if (!syForm.startDate) errors.startDate = "Date de debut requise.";
                    if (!syForm.endDate) errors.endDate = "Date de fin requise.";
                    if (syForm.startDate && syForm.endDate && syForm.endDate < syForm.startDate) {
                      errors.endDate = "La date de fin doit etre apres la date de debut.";
                    }
                    setSchoolYearErrors(errors);
                    if (hasFieldErrors(errors)) {
                      focusFirstInlineErrorField("years");
                      return;
                    }
                    void createRef(
                      "/school-years",
                      {
                        code: syForm.code.trim(),
                        startDate: syForm.startDate,
                        endDate: syForm.endDate,
                        isActive: syForm.isActive
                      },
                      "Annee creee."
                    ).then((ok) => {
                      if (ok) {
                        setSchoolYearErrors({});
                        setSyForm({ code: "", startDate: "", endDate: "", isActive: false });
                      }
                    });
                  }}
                >
                  <label>
                    Code
                    <input value={syForm.code} onChange={(event) => setSyForm((prev) => ({ ...prev, code: event.target.value }))} required />
                    {fieldError(schoolYearErrors, "code")}
                  </label>
                  <label>
                    Debut
                    <input type="date" value={syForm.startDate} onChange={(event) => setSyForm((prev) => ({ ...prev, startDate: event.target.value }))} required />
                    {fieldError(schoolYearErrors, "startDate")}
                  </label>
                  <label>
                    Fin
                    <input type="date" value={syForm.endDate} onChange={(event) => setSyForm((prev) => ({ ...prev, endDate: event.target.value }))} required />
                    {fieldError(schoolYearErrors, "endDate")}
                  </label>
                  <label className="check-row">
                    <input type="checkbox" checked={syForm.isActive} onChange={(event) => setSyForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
                    Annee active
                  </label>
                  <button type="submit">Creer</button>
                </form>
                <div className="mini-list">
                  {schoolYears.map((item) => (
                    <div key={item.id} className="mini-item">
                      <span>{item.code} {item.isActive ? "(En cours)" : ""}</span>
                      <button type="button" className="button-ghost" onClick={() => void deleteRef(`/school-years/${item.id}`, "Annee supprimee.")}>
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article id="reference-cycles" data-step-id="cycles" className="panel card-panel module-modern module-stack">
                <h3>Cycles / Niveaux</h3>
                <p className="section-lead">Creez d'abord les cycles, puis les niveaux associes pour structurer les parcours.</p>
                <form
                  className="form-grid module-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const errors: FieldErrors = {};
                    if (!cycleForm.code.trim()) errors.code = "Code cycle requis.";
                    if (!cycleForm.label.trim()) errors.label = "Libelle cycle requis.";
                    if (!Number.isFinite(cycleForm.sortOrder) || cycleForm.sortOrder < 0) {
                      errors.sortOrder = "Ordre invalide.";
                    }
                    setCycleErrors(errors);
                    if (hasFieldErrors(errors)) {
                      focusFirstInlineErrorField("cycles");
                      return;
                    }
                    void createRef("/cycles", cycleForm, "Cycle cree.").then((ok) => {
                      if (ok) {
                        setCycleErrors({});
                        setCycleForm({
                          code: "",
                          label: "",
                          academicStage: "PRIMARY",
                          sortOrder: 1
                        });
                      }
                    });
                  }}
                >
                  <label>
                    Code cycle
                    <input value={cycleForm.code} onChange={(event) => setCycleForm((prev) => ({ ...prev, code: event.target.value }))} required />
                    {fieldError(cycleErrors, "code")}
                  </label>
                  <label>
                    Libelle cycle
                    <input value={cycleForm.label} onChange={(event) => setCycleForm((prev) => ({ ...prev, label: event.target.value }))} required />
                    {fieldError(cycleErrors, "label")}
                  </label>
                  <label>
                    Stade academique
                    <select
                      value={cycleForm.academicStage}
                      onChange={(event) =>
                        setCycleForm((prev) => ({
                          ...prev,
                          academicStage: event.target.value as AcademicStage
                        }))
                      }
                    >
                      <option value="PRIMARY">{formatAcademicStageLabel("PRIMARY")}</option>
                      <option value="SECONDARY">{formatAcademicStageLabel("SECONDARY")}</option>
                      <option value="HIGHER">{formatAcademicStageLabel("HIGHER")}</option>
                    </select>
                  </label>
                  <label>
                    Ordre
                    <input type="number" min={0} value={cycleForm.sortOrder} onChange={(event) => setCycleForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))} required />
                    {fieldError(cycleErrors, "sortOrder")}
                  </label>
                  <button type="submit">Creer cycle</button>
                </form>
                <div className="mini-list">
                  {cycles.map((item) => (
                    <div key={item.id} className="mini-item">
                      <span>{item.code} - {item.label} ({formatAcademicStageLabel(item.academicStage)})</span>
                      <button type="button" className="button-ghost" onClick={() => void deleteRef(`/cycles/${item.id}`, "Cycle supprime.")}>
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
                <p className="form-block-title">Niveaux par cycle</p>
                <form
                  className="form-grid module-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const errors: FieldErrors = {};
                    if (!levelForm.cycleId) errors.cycleId = "Choisir un cycle.";
                    if (!levelForm.code.trim()) errors.code = "Code niveau requis.";
                    if (!levelForm.label.trim()) errors.label = "Libelle niveau requis.";
                    if (!levelForm.track) errors.track = "Cursus requis.";
                    if (!Number.isFinite(levelForm.sortOrder) || levelForm.sortOrder < 0) {
                      errors.sortOrder = "Ordre invalide.";
                    }
                    setLevelErrors(errors);
                    if (hasFieldErrors(errors)) {
                      focusFirstInlineErrorField("cycles");
                      return;
                    }
                    void createRef("/levels", levelForm, "Niveau cree.").then((ok) => {
                      if (ok) {
                        setLevelErrors({});
                        setLevelForm((prev) => ({ ...prev, code: "", label: "", sortOrder: 1 }));
                      }
                    });
                  }}
                >
                  <label>
                    Cycle
                    <select value={levelForm.cycleId} onChange={(event) => setLevelForm((prev) => ({ ...prev, cycleId: event.target.value }))}>
                      {cycles.map((item) => (
                        <option key={item.id} value={item.id}>{item.code}</option>
                      ))}
                    </select>
                    {fieldError(levelErrors, "cycleId")}
                  </label>
                  <label>
                    Cursus
                    <select
                      value={levelForm.track}
                      onChange={(event) =>
                        setLevelForm((prev) => ({ ...prev, track: event.target.value as AcademicTrack }))
                      }
                    >
                      {ACADEMIC_TRACK_OPTIONS.map((track) => (
                        <option key={track} value={track}>
                          {formatAcademicTrackLabel(track)}
                        </option>
                      ))}
                    </select>
                    {fieldError(levelErrors, "track")}
                  </label>
                  <label>
                    Code niveau
                    <input value={levelForm.code} onChange={(event) => setLevelForm((prev) => ({ ...prev, code: event.target.value }))} required />
                    {fieldError(levelErrors, "code")}
                  </label>
                  <label>
                    Libelle niveau
                    <input value={levelForm.label} onChange={(event) => setLevelForm((prev) => ({ ...prev, label: event.target.value }))} required />
                    {fieldError(levelErrors, "label")}
                  </label>
                  <button type="submit">Creer niveau</button>
                </form>
                <label>
                  Filtre cycle
                  <select value={levelCycleFilter} onChange={(event) => setLevelCycleFilter(event.target.value)}>
                    <option value="">Tous</option>
                    {cycles.map((item) => (
                      <option key={item.id} value={item.id}>{item.code}</option>
                    ))}
                  </select>
                </label>
                <div className="mini-list">
                  {shownLevels.map((item) => (
                    <div key={item.id} className="mini-item">
                      <span>{item.code} - {item.label} ({formatAcademicTrackLabel(item.track)})</span>
                      <button type="button" className="button-ghost" onClick={() => void deleteRef(`/levels/${item.id}`, "Niveau supprime.")}>
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article id="reference-classes" data-step-id="classes" className="panel card-panel module-modern module-stack">
                <h3>Classes / Matieres / Periodes</h3>
                <p className="section-lead">Parametrez les classes et les matieres depuis un seul espace de configuration.</p>
                <form
                  className="form-grid module-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const errors: FieldErrors = {};
                    if (!classForm.schoolYearId) errors.schoolYearId = "Annee requise.";
                    if (!classForm.levelId) errors.levelId = "Niveau requis.";
                    if (!classForm.track) errors.track = "Cursus requis.";
                    if (!classForm.code.trim()) errors.code = "Code classe requis.";
                    if (!classForm.label.trim()) errors.label = "Libelle classe requis.";
                    const selectedLevel = levels.find((item) => item.id === classForm.levelId);
                    if (selectedLevel && selectedLevel.track !== classForm.track) {
                      errors.track = "Le cursus de la classe doit correspondre a celui du niveau.";
                    }
                    if (classForm.capacity.trim() && (!Number.isFinite(Number(classForm.capacity)) || Number(classForm.capacity) <= 0)) {
                      errors.capacity = "Capacite invalide.";
                    }
                    setClassErrors(errors);
                    if (hasFieldErrors(errors)) {
                      focusFirstInlineErrorField("classes");
                      return;
                    }
                    void createRef(
                      "/classes",
                      {
                        ...classForm,
                        capacity: classForm.capacity.trim() ? Number(classForm.capacity) : undefined
                      },
                      "Classe creee."
                    ).then((ok) => {
                      if (ok) {
                        setClassErrors({});
                        setClassForm((prev) => ({ ...prev, code: "", label: "", capacity: "" }));
                      }
                    });
                  }}
                >
                  <label>
                    Annee
                    <select value={classForm.schoolYearId} onChange={(event) => setClassForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}>
                      {schoolYears.map((item) => (
                        <option key={item.id} value={item.id}>{item.code}</option>
                      ))}
                    </select>
                    {fieldError(classErrors, "schoolYearId")}
                  </label>
                  <label>
                    Niveau
                    <select
                      value={classForm.levelId}
                      onChange={(event) => {
                        const nextLevelId = event.target.value;
                        const nextLevel = levels.find((item) => item.id === nextLevelId);
                        setClassForm((prev) => ({
                          ...prev,
                          levelId: nextLevelId,
                          track: nextLevel?.track || prev.track
                        }));
                      }}
                    >
                      {levels.map((item) => (
                        <option key={item.id} value={item.id}>{item.code}</option>
                      ))}
                    </select>
                    {fieldError(classErrors, "levelId")}
                  </label>
                  <label>
                    Cursus
                    <select
                      value={classForm.track}
                      onChange={(event) =>
                        setClassForm((prev) => ({ ...prev, track: event.target.value as AcademicTrack }))
                      }
                    >
                      {ACADEMIC_TRACK_OPTIONS.map((track) => (
                        <option key={track} value={track}>
                          {formatAcademicTrackLabel(track)}
                        </option>
                      ))}
                    </select>
                    {fieldError(classErrors, "track")}
                  </label>
                  <label>
                    Code classe
                    <input value={classForm.code} onChange={(event) => setClassForm((prev) => ({ ...prev, code: event.target.value }))} required />
                    {fieldError(classErrors, "code")}
                  </label>
                  <label>
                    Libelle classe
                    <input value={classForm.label} onChange={(event) => setClassForm((prev) => ({ ...prev, label: event.target.value }))} required />
                    {fieldError(classErrors, "label")}
                  </label>
                  <label>
                    Capacite (optionnel)
                    <input
                      type="number"
                      min={1}
                      value={classForm.capacity}
                      onChange={(event) => setClassForm((prev) => ({ ...prev, capacity: event.target.value }))}
                    />
                    {fieldError(classErrors, "capacity")}
                  </label>
                  <button type="submit">Creer classe</button>
                </form>
                <div className="filter-grid module-filter">
                  <label>
                    Filtre annee
                    <select value={classYearFilter} onChange={(event) => setClassYearFilter(event.target.value)}>
                      <option value="">Toutes</option>
                      {schoolYears.map((item) => (
                        <option key={item.id} value={item.id}>{item.code}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Filtre niveau
                    <select value={classLevelFilter} onChange={(event) => setClassLevelFilter(event.target.value)}>
                      <option value="">Tous</option>
                      {levels.map((item) => (
                        <option key={item.id} value={item.id}>{item.code}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mini-list">
                  {shownClasses.map((item) => (
                    <div key={item.id} className="mini-item">
                      <span>{item.code} - {item.label} ({formatAcademicTrackLabel(item.track)})</span>
                      <button type="button" className="button-ghost" onClick={() => void deleteRef(`/classes/${item.id}`, "Classe supprimee.")}>
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
                <p className="form-block-title">Matieres enseignees</p>
                <form
                  className="form-grid module-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const errors: FieldErrors = {};
                    if (!subjectForm.code.trim()) errors.code = "Code matiere requis.";
                    if (!subjectForm.label.trim()) errors.label = "Libelle matiere requis.";
                    setSubjectErrors(errors);
                    if (hasFieldErrors(errors)) {
                      focusFirstInlineErrorField("classes");
                      return;
                    }
                    void createRef("/subjects", subjectForm, "Matiere creee.").then((ok) => {
                      if (ok) {
                        setSubjectErrors({});
                        setSubjectForm({ code: "", label: "", isArabic: false });
                      }
                    });
                  }}
                >
                  <label>
                    Code matiere
                    <input value={subjectForm.code} onChange={(event) => setSubjectForm((prev) => ({ ...prev, code: event.target.value }))} required />
                    {fieldError(subjectErrors, "code")}
                  </label>
                  <label>
                    Libelle matiere
                    <input value={subjectForm.label} onChange={(event) => setSubjectForm((prev) => ({ ...prev, label: event.target.value }))} required />
                    {fieldError(subjectErrors, "label")}
                  </label>
                  <label className="check-row">
                    <input type="checkbox" checked={subjectForm.isArabic} onChange={(event) => setSubjectForm((prev) => ({ ...prev, isArabic: event.target.checked }))} />
                    Matiere arabe
                  </label>
                  <button type="submit">Creer matiere</button>
                </form>
                <div className="mini-list">
                  {subjects.map((item) => (
                    <div key={item.id} className="mini-item">
                      <span>{item.code} - {item.label} {item.isArabic ? "(AR)" : ""}</span>
                      <button type="button" className="button-ghost" onClick={() => void deleteRef(`/subjects/${item.id}`, "Matiere supprimee.")}>
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article id="reference-periods" data-step-id="periods" className="panel card-panel module-modern module-stack">
                <h3>Periodes academiques</h3>
                <p className="section-lead">Ajoutez les periodes (trimestres/semestres) en cohérence avec l'annee active.</p>
                <form
                  className="form-grid module-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const errors: FieldErrors = {};
                    if (!periodForm.schoolYearId) errors.schoolYearId = "Annee requise.";
                    if (!periodForm.code.trim()) errors.code = "Code periode requis.";
                    if (!periodForm.label.trim()) errors.label = "Libelle periode requis.";
                    if (!periodForm.startDate) errors.startDate = "Date debut requise.";
                    if (!periodForm.endDate) errors.endDate = "Date fin requise.";
                    if (periodForm.startDate && periodForm.endDate && periodForm.endDate < periodForm.startDate) {
                      errors.endDate = "La date de fin doit etre apres la date de debut.";
                    }
                    setPeriodErrors(errors);
                    if (hasFieldErrors(errors)) {
                      focusFirstInlineErrorField("periods");
                      return;
                    }
                    void createRef("/academic-periods", periodForm, "Periode creee.").then((ok) => {
                      if (ok) {
                        setPeriodErrors({});
                        setPeriodForm((prev) => ({ ...prev, code: "", label: "", startDate: "", endDate: "", periodType: "TRIMESTER" }));
                      }
                    });
                  }}
                >
                  <label>
                    Annee
                    <select value={periodForm.schoolYearId} onChange={(event) => setPeriodForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}>
                      {schoolYears.map((item) => (
                        <option key={item.id} value={item.id}>{item.code}</option>
                      ))}
                    </select>
                    {fieldError(periodErrors, "schoolYearId")}
                  </label>
                  <label>
                    Code
                    <input value={periodForm.code} onChange={(event) => setPeriodForm((prev) => ({ ...prev, code: event.target.value }))} required />
                    {fieldError(periodErrors, "code")}
                  </label>
                  <label>
                    Libelle
                    <input value={periodForm.label} onChange={(event) => setPeriodForm((prev) => ({ ...prev, label: event.target.value }))} required />
                    {fieldError(periodErrors, "label")}
                  </label>
                  <label>
                    Debut
                    <input type="date" value={periodForm.startDate} onChange={(event) => setPeriodForm((prev) => ({ ...prev, startDate: event.target.value }))} required />
                    {fieldError(periodErrors, "startDate")}
                  </label>
                  <label>
                    Fin
                    <input type="date" value={periodForm.endDate} onChange={(event) => setPeriodForm((prev) => ({ ...prev, endDate: event.target.value }))} required />
                    {fieldError(periodErrors, "endDate")}
                  </label>
                  <button type="submit">Creer periode</button>
                </form>
                <label>
                  Filtre annee
                  <select value={periodYearFilter} onChange={(event) => setPeriodYearFilter(event.target.value)}>
                    <option value="">Toutes</option>
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>{item.code}</option>
                    ))}
                  </select>
                </label>
                <div className="mini-list">
                  {shownPeriods.map((item) => (
                    <div key={item.id} className="mini-item">
                      <span>{item.code} - {item.label} ({item.periodType})</span>
                      <button type="button" className="button-ghost" onClick={() => void deleteRef(`/academic-periods/${item.id}`, "Periode supprimee.")}>
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>
        </WorkflowGuide>
      );
    }
    */
    if (tab === "enrollments") {
      const enrollmentSteps: WorkflowStepDef[] = [
        { id: "create", title: "Creation", hint: "Lier eleve, classe et annee." },
        { id: "list", title: "Suivi", hint: "Filtrer et gerer les inscriptions.", done: enrollments.length > 0 }
      ];

      const scrollToEnrollments = (stepId: string): void => {
        setEnrollmentWorkflowStep(stepId);
        const targetByStep: Record<string, string> = {
          create: "enrollments-create",
          list: "enrollments-list"
        };
        const target = targetByStep[stepId];
        if (!target) return;
        window.setTimeout(() => {
          document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      };
      const primaryEnrollmentsCount = enrollments.filter((item) => item.isPrimary).length;
      const filteredEnrollmentLabel = enrollmentFilters.schoolYearId
        ? schoolYearById.get(enrollmentFilters.schoolYearId)?.code || "Filtre actif"
        : "Toutes les annees";

      return (
        <WorkflowGuide
          title="Inscriptions"
          steps={enrollmentSteps}
          activeStepId={enrollmentWorkflowStep}
          onStepChange={scrollToEnrollments}
        >
          <>
            <section data-step-id="list" className="panel table-panel workflow-section module-modern module-overview-shell">
              <div className="table-header">
                <div>
                  <p className="section-kicker">Admissions</p>
                  <h2>Pilotage des inscriptions</h2>
                </div>
                <span className="module-header-badge">{filteredEnrollmentLabel}</span>
              </div>
              <p className="section-lead">
                Vue v2 plus stricte: creation, affectation et verification dans une grille plus proche
                du rythme FlexAdmin.
              </p>
              <div className="module-overview-grid">
                <article className="module-overview-card">
                  <span>Inscriptions</span>
                  <strong>{enrollments.length}</strong>
                  <small>Dossiers rattaches aux classes</small>
                </article>
                <article className="module-overview-card">
                  <span>Principal</span>
                  <strong>{primaryEnrollmentsCount}</strong>
                  <small>Classes principales actives</small>
                </article>
                <article className="module-overview-card">
                  <span>Eleves</span>
                  <strong>{students.length}</strong>
                  <small>Viviers disponibles</small>
                </article>
                <article className="module-overview-card">
                  <span>Classes</span>
                  <strong>{classes.length}</strong>
                  <small>Offre ouverte dans la v2</small>
                </article>
              </div>
              <div className="module-inline-strip">
                <span className="module-inline-pill">{schoolYears.length} annee(s) configuree(s)</span>
                <span className="module-inline-pill">{ACADEMIC_TRACK_OPTIONS.length} cursus</span>
                <span className="module-inline-pill">Workflow createur + registre</span>
              </div>
            </section>

            <section id="enrollments-create" data-step-id="create" className="panel editor-panel workflow-section module-modern">
              <div className="table-header">
                <div>
                  <p className="section-kicker">Creation</p>
                  <h2>Nouvelle inscription</h2>
                </div>
                <span className="module-header-badge">Etape de liaison</span>
              </div>
              <p className="section-lead">Liez l'eleve a sa classe et son annee scolaire en une seule operation.</p>
              <form className="form-grid module-form" onSubmit={(event) => void submitEnrollment(event)}>
                <label>
                  Annee scolaire
                  <select
                    value={enrollmentForm.schoolYearId}
                    onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, schoolYearId: event.target.value }))}
                    required
                  >
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code}
                      </option>
                    ))}
                  </select>
                  {fieldError(enrollmentErrors, "schoolYearId")}
                </label>
                <label>
                  Classe
                  <select
                    value={enrollmentForm.classId}
                    onChange={(event) => {
                      const nextClassId = event.target.value;
                      const nextClass = classes.find((item) => item.id === nextClassId);
                      setEnrollmentForm((prev) => ({
                        ...prev,
                        classId: nextClassId,
                        track: nextClass?.track || prev.track
                      }));
                    }}
                    required
                  >
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} - {item.label} ({formatAcademicTrackLabel(item.track)})
                      </option>
                    ))}
                  </select>
                  {fieldError(enrollmentErrors, "classId")}
                </label>
                <label>
                  Cursus
                  <select
                    value={enrollmentForm.track}
                    onChange={(event) =>
                      setEnrollmentForm((prev) => ({ ...prev, track: event.target.value as AcademicTrack }))
                    }
                    required
                  >
                    {ACADEMIC_TRACK_OPTIONS.map((track) => (
                      <option key={track} value={track}>
                        {formatAcademicTrackLabel(track)}
                      </option>
                    ))}
                  </select>
                  {fieldError(enrollmentErrors, "track")}
                </label>
                <label>
                  Eleve
                  <select
                    value={enrollmentForm.studentId}
                    onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, studentId: event.target.value }))}
                    required
                  >
                    {students.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.matricule} - {item.firstName} {item.lastName}
                      </option>
                    ))}
                  </select>
                  {fieldError(enrollmentErrors, "studentId")}
                </label>
                <label>
                  Date d'inscription
                  <input
                    type="date"
                    value={enrollmentForm.enrollmentDate}
                    onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, enrollmentDate: event.target.value }))}
                    required
                  />
                  {fieldError(enrollmentErrors, "enrollmentDate")}
                </label>
                <label>
                  Statut
                  <input
                    value={enrollmentForm.enrollmentStatus}
                    onChange={(event) => setEnrollmentForm((prev) => ({ ...prev, enrollmentStatus: event.target.value }))}
                  />
                  {fieldError(enrollmentErrors, "enrollmentStatus")}
                </label>
                <button type="submit">Creer inscription</button>
              </form>
            </section>

            <section id="enrollments-list" data-step-id="list" className="panel table-panel workflow-section module-modern">
              <div className="table-header">
                <div>
                  <p className="section-kicker">Registre</p>
                  <h2>Liste des inscriptions</h2>
                </div>
                <span className="module-header-badge">{enrollments.length} ligne(s)</span>
              </div>
              <p className="section-lead">Filtrez rapidement pour trouver la bonne inscription et agir sans bruit.</p>
              <form
                className="filter-grid module-filter"
                onSubmit={(event) => {
                  event.preventDefault();
                  void loadEnrollments(enrollmentFilters);
                }}
              >
                <label>
                  Filtre annee
                  <select
                    value={enrollmentFilters.schoolYearId}
                    onChange={(event) =>
                      setEnrollmentFilters((prev) => ({ ...prev, schoolYearId: event.target.value }))
                    }
                  >
                    <option value="">Toutes</option>
                    {schoolYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Filtre classe
                  <select
                    value={enrollmentFilters.classId}
                    onChange={(event) =>
                      setEnrollmentFilters((prev) => ({ ...prev, classId: event.target.value }))
                    }
                  >
                    <option value="">Toutes</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Filtre eleve
                  <select
                    value={enrollmentFilters.studentId}
                    onChange={(event) =>
                      setEnrollmentFilters((prev) => ({ ...prev, studentId: event.target.value }))
                    }
                  >
                    <option value="">Tous</option>
                    {students.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.matricule}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Filtre cursus
                  <select
                    value={enrollmentFilters.track}
                    onChange={(event) =>
                      setEnrollmentFilters((prev) => ({ ...prev, track: event.target.value }))
                    }
                  >
                    <option value="">Tous</option>
                    {ACADEMIC_TRACK_OPTIONS.map((track) => (
                      <option key={track} value={track}>
                        {formatAcademicTrackLabel(track)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="actions">
                  <button type="submit">Filtrer</button>
                  <button type="button" className="button-ghost" onClick={() => void resetEnrollmentFilters()}>
                    Reinitialiser
                  </button>
                </div>
              </form>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Annee</th>
                      <th>Classe</th>
                      <th>Eleve</th>
                      <th>Cursus</th>
                      <th>Role</th>
                      <th>Classe principale</th>
                      <th>Classe secondaire</th>
                      <th>Date</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="empty-row">
                          Aucune inscription.
                        </td>
                      </tr>
                    ) : (
                      enrollments.map((item) => {
                        const localClass = classById.get(item.classId);
                        const localStudent = studentById.get(item.studentId);
                        const fallbackStudent = localStudent
                          ? `${localStudent.firstName} ${localStudent.lastName}`.trim()
                          : "-";
                        return (
                          <tr key={item.id}>
                            <td>{item.schoolYearCode || schoolYearById.get(item.schoolYearId)?.code || "-"}</td>
                            <td>{item.classLabel || localClass?.label || "-"}</td>
                            <td>{item.studentName || fallbackStudent}</td>
                            <td>{formatAcademicTrackLabel(item.track)}</td>
                            <td>{item.isPrimary ? "Principal" : "Secondaire"}</td>
                            <td>{item.primaryClassLabel || "-"}</td>
                            <td>{item.secondaryClassLabel || "-"}</td>
                            <td>{item.enrollmentDate}</td>
                            <td>{formatEnrollmentStatusLabel(item.enrollmentStatus)}</td>
                            <td>
                              <button
                                type="button"
                                className="button-danger"
                                onClick={() => void deleteEnrollment(item.id)}
                              >
                                Supprimer
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        </WorkflowGuide>
      );
    }
    if (tab === "finance") return renderFinance();
    if (tab === "messages") return renderMessages();
    if (tab === "reports") return renderReports();
    if (tab === "mosque") return renderMosque();
    if (tab === "grades") return renderGrades();
    if (tab === "schoolLifeOverview") {
      return (
        <SchoolLifePanel
          api={api}
          students={students}
          classes={classes}
          subjects={subjects}
          locale={currentLanguageMeta.locale}
          onError={setError}
          onNotice={setNotice}
          focusSection="overview"
        />
      );
    }
    if (tab === "schoolLifeAttendance") {
      return (
        <SchoolLifePanel
          api={api}
          students={students}
          classes={classes}
          subjects={subjects}
          locale={currentLanguageMeta.locale}
          onError={setError}
          onNotice={setNotice}
          focusSection="attendance"
          readOnly={!currentRole || currentRole === "PARENT"}
        />
      );
    }
    if (tab === "schoolLifeTimetable") {
      return (
        <SchoolLifePanel
          api={api}
          students={students}
          classes={classes}
          subjects={subjects}
          locale={currentLanguageMeta.locale}
          onError={setError}
          onNotice={setNotice}
          focusSection="timetable"
          readOnly={currentRole === "PARENT"}
        />
      );
    }
    if (tab === "schoolLifeNotifications") {
      return (
        <SchoolLifePanel
          api={api}
          students={students}
          classes={classes}
          subjects={subjects}
          locale={currentLanguageMeta.locale}
          onError={setError}
          onNotice={setNotice}
          focusSection="notifications"
          readOnly={currentRole === "PARENT"}
        />
      );
    }
    if (tab === "teacherPortal") return renderTeacherPortal();
    if (tab === "parentPortal") return renderParentPortal();
    if (tab === "studentPortal") return renderStudentPortal();

    return renderDashboard();
  };

  const activeScreen = SCREEN_DEFS.find((entry) => entry.id === tab) ?? SCREEN_DEFS[0];
  const profileInitial = session?.user.username?.charAt(0)?.toUpperCase() || "U";
  const profileContextLabel = currentRole ? ROLE_CONTEXT_LABELS[currentRole] : "Session";
  const quickLinks = homeTiles.filter((tile) => tile.screen !== tab).slice(0, 4);
  const nextLanguage = languageFlipTarget || getNextUiLanguage(uiLanguage);
  const nextLanguageMeta = UI_LANGUAGE_META[nextLanguage];
  const lastSyncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString(currentLanguageMeta.locale)
    : "Non synchronise";
  const dashboardTarget =
    currentRole && hasScreenAccess(currentRole, "dashboard")
      ? "dashboard"
      : currentRole
        ? ROLE_HOME_SCREEN[currentRole] || "dashboard"
        : "dashboard";
  const buildHeaderAction = (screen: ScreenId, label: string): HeaderNavigationAction => {
    const allowed = currentRole ? hasScreenAccess(currentRole, screen) : false;
    return {
      id: screen,
      label,
      active: tab === screen,
      disabled: !allowed,
      helperText: allowed ? undefined : "Acces restreint",
      onSelect: () => {
        if (!allowed) return;
        setTab(screen);
      }
    };
  };
  const dashboardAction: HeaderNavigationAction = {
    id: dashboardTarget,
    label: "Tableau de bord",
    active: tab === dashboardTarget,
    disabled: !currentRole,
    onSelect: () => setTab(dashboardTarget)
  };
  const scolariteActions: HeaderNavigationAction[] = [
    buildHeaderAction("enrollments", "Inscriptions"),
    buildHeaderAction("iam", "Utilisateurs & droits"),
    buildHeaderAction("teachers", "Enseignants"),
    buildHeaderAction("rooms", "Salles"),
    buildHeaderAction("students", "Eleves"),
    buildHeaderAction("parents", "Parents"),
    buildHeaderAction("finance", "Comptabilite")
  ];
  const schoolLifeActions: HeaderNavigationAction[] = [
    buildHeaderAction("grades", "Notes & bulletins"),
    buildHeaderAction("messages", "Messagerie"),
    buildHeaderAction("schoolLifeOverview", "Pilotage"),
    buildHeaderAction("schoolLifeAttendance", "Absences"),
    buildHeaderAction("schoolLifeTimetable", "Emploi du temps"),
    buildHeaderAction("schoolLifeNotifications", "Notifications")
  ];
  const settingsActions: HeaderNavigationAction[] = [
    buildHeaderAction("reference", "Referentiel"),
    buildHeaderAction("reports", "Rapports & conformite")
  ];
  const settingsGroups: HeaderNavigationGroup[] = [
    {
      id: "mosque-management",
      label: "Gestion mosquee",
      items: [buildHeaderAction("mosque", "Mosquee")]
    }
  ];
  const portalActions: HeaderNavigationAction[] = [
    currentRole === "ENSEIGNANT" ? buildHeaderAction("teacherPortal", "Portail enseignant") : null,
    currentRole === "PARENT" ? buildHeaderAction("parentPortal", "Portail parent") : null,
    currentRole === "STUDENT" ? buildHeaderAction("studentPortal", "Portail eleve") : null
  ].filter((item): item is HeaderNavigationAction => item !== null);
  const sidebarGroups =
    currentRole === "ENSEIGNANT" || currentRole === "PARENT" || currentRole === "STUDENT"
      ? [{ id: "portal", title: "Acces rapide", items: portalActions }]
      : [
          { id: "pilotage", title: "Pilotage", items: [dashboardAction] },
          { id: "scolarite", title: "Scolarite", items: scolariteActions },
          { id: "school-life", title: "Vie scolaire", items: schoolLifeActions },
          {
            id: "settings",
            title: "Parametres",
            items: [...settingsActions, ...settingsGroups.flatMap((group) => group.items)]
          }
        ];
  const preferenceActions: HeaderPreferenceAction[] = [
    {
      id: "language",
      label: "Changer la langue",
      helperText: `${currentLanguageMeta.label} -> ${nextLanguageMeta.label}`,
      iconSrc: currentLanguageMeta.iconSrc,
      onSelect: cycleLanguage
    },
    {
      id: "theme",
      label: "Changer le mode",
      helperText: themeMode === "dark" ? "Activer le mode clair" : "Activer le mode sombre",
      iconSrc: themeMode === "light" ? "/mode-clair.png" : "/mode-sombre.png",
      onSelect: toggleThemeMode
    }
  ];
  const notificationTarget: ScreenId =
    currentRole === "ENSEIGNANT"
      ? "teacherPortal"
      : currentRole === "PARENT"
        ? "parentPortal"
        : currentRole === "STUDENT"
          ? "studentPortal"
          : currentRole && hasScreenAccess(currentRole, "schoolLifeNotifications")
            ? "schoolLifeNotifications"
            : dashboardTarget;
  const messageTarget: ScreenId =
    currentRole && hasScreenAccess(currentRole, "messages") ? "messages" : dashboardTarget;
  const headerMessageCount =
    currentRole && hasScreenAccess(currentRole, "messages")
      ? 0
      : 0;
  const notificationActive =
    notificationTarget === "schoolLifeNotifications"
      ? tab === "schoolLifeNotifications"
      : tab === notificationTarget;
  const messageActive = messageTarget === "messages" ? tab === "messages" : tab === messageTarget;
  const headerSearchSubmit = (): void => {
    if (!moduleQueryInput.trim()) return;
    if (currentRole && hasScreenAccess(currentRole, "dashboard")) {
      setTab("dashboard");
    }
  };
  return (
    <main
      ref={appRootRef}
      className={`page ${!session ? "page-auth" : ""}`.trim()}
      data-theme={themeMode}
      data-lang={uiLanguage}
      dir={currentLanguageMeta.dir}
    >
      <div className="aurora aurora-left" />
      <div className="aurora aurora-right" />

      {!session ? (
        <AuthScreen
          schoolName={SCHOOL_NAME}
          themeMode={themeMode}
          themeBusy={Boolean(themeFlipTarget)}
          onSelectTheme={selectThemeMode}
          uiLanguage={uiLanguage}
          languageBusy={Boolean(languageFlipTarget)}
          onSelectLanguage={selectLanguage}
          apiStatus={apiConnection.status}
          apiStatusText={apiStatusText}
          loginForm={loginForm}
          loginUsernameError={loginErrors.username}
          loginPasswordError={loginErrors.password}
          onLoginFormChange={(patch) => setLoginForm((prev) => ({ ...prev, ...patch }))}
          rememberMe={rememberMe}
          onRememberMeChange={(next) => {
            setRememberMe(next);
            if (!next) localStorage.removeItem(LOGIN_HINT_STORAGE_KEY);
          }}
          loadingAuth={loadingAuth}
          onSubmitLogin={(event) => void login(event)}
          authAssistMode={authAssistMode}
          onShowLogin={showLoginPanel}
          onShowForgotPassword={showForgotPasswordPanel}
          onShowFirstConnection={showFirstConnectionPanel}
          forgotPasswordForm={forgotPasswordForm}
          onForgotPasswordChange={(patch) => setForgotPasswordForm((prev) => ({ ...prev, ...patch }))}
          resetPasswordForm={resetPasswordForm}
          onResetPasswordChange={(patch) => setResetPasswordForm((prev) => ({ ...prev, ...patch }))}
          firstConnectionForm={firstConnectionForm}
          onFirstConnectionChange={(patch) => setFirstConnectionForm((prev) => ({ ...prev, ...patch }))}
          authAssistLoading={authAssistLoading}
          onSubmitForgotPassword={(event) => void requestForgotPasswordToken(event)}
          onSubmitResetPassword={(event) => void submitResetPassword(event)}
          onSubmitFirstConnection={(event) => void submitFirstConnection(event)}
          onEnterPreview={enterPreview}
          previewEnabled={PREVIEW_MODE_ENABLED}
        />
      ) : (
        <section className="workspace fade-up">
          <HeaderNavigation
            brandName={SCHOOL_NAME}
            logoAlt={`Logo ${SCHOOL_NAME}`}
            logoSrc="/logo.png"
            sidebarCollapsed={sidebarCollapsed}
            searchPlaceholder="Rechercher un module, un ecran, une action..."
            searchValue={moduleQueryInput}
            onSearchChange={setModuleQueryInput}
            onSearchSubmit={headerSearchSubmit}
            onToggleSidebar={() => setSidebarCollapsed((previous) => !previous)}
            dashboard={dashboardAction}
            scolarite={scolariteActions}
            schoolLife={schoolLifeActions}
            settings={settingsActions}
            settingsGroups={settingsGroups}
            preferences={preferenceActions}
            messages={{
              active: messageActive,
              count: headerMessageCount,
              disabled: true,
              label: "Messagerie en apercu",
              statusLabel: "Module UI-only, backend messagerie non branche",
              onSelect: () => setTab(messageTarget)
            }}
            notifications={{
              active: notificationActive,
              count: headerNotificationCount,
              iconSrc: "/notification.png",
              label: "Notifications en temps reel",
              onSelect: () => setTab(notificationTarget)
            }}
            user={{
              avatar: profileInitial,
              contextLabel: profileContextLabel,
              roleLabel: currentRoleLabel,
              secondaryLabel: `Annee: ${schoolYearLabel}`,
              username: session.user.username,
              onLogout: () => void logout()
            }}
          />

          <div className={`app-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`.trim()}>
            <AppSidebar
              brandName={SCHOOL_NAME}
              currentRoleLabel={currentRoleLabel}
              groups={sidebarGroups}
            />
            <div className="app-shell-main">
              {isPreviewSession ? (
                <section className="notice-card notice-warning" role="status">
                  <strong>Mode apercu local</strong>
                  <p>
                    Les donnees affichees sont des donnees de demonstration chargees dans le navigateur.
                    Elles ne sont pas persistees dans l'API ni dans PostgreSQL.
                  </p>
                </section>
              ) : null}

              {tab !== "dashboard" ? (
                <section key={`context-${tab}`} className="panel context-bar">
                  <div className="context-copy">
                    <p className="eyebrow">Module actif</p>
                    <h2>{activeScreen.label}</h2>
                  </div>
                  <div className="context-actions">
                    <button type="button" className="button-ghost" onClick={() => setTab("dashboard")}>
                      Retour accueil
                    </button>
                    {quickLinks.slice(0, 2).map((tile) => (
                      <button
                        key={`shortcut-${tile.screen}`}
                        type="button"
                        className="mini-link"
                        onClick={() => setTab(tile.screen)}
                      >
                        {tile.title}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section key={tab} className="screen-host">{renderActiveScreen()}</section>

              <footer className="panel app-footer app-footer-minimal">
                <div className="footer-head">
                  <strong>{SCHOOL_NAME}</strong>
                  <div className="footer-meta">
                    <span>Annee: {schoolYearLabel}</span>
                    <span>Derniere sync: {lastSyncLabel}</span>
                    {apiConnection.status !== "online" ? <span>{apiStatusText}</span> : null}
                  </div>
                </div>
              </footer>
            </div>
          </div>
        </section>
      )}

      {error || notice ? (
        <div className="toast-stack" aria-live="polite" aria-atomic="true">
          {error ? (
            <div className="toast-pop toast-pop-error" role="alert">
              <div>
                <strong>Attention</strong>
                <p>{error}</p>
              </div>
              <button type="button" aria-label="Fermer la notification d'erreur" onClick={() => setError(null)}>
                Fermer
              </button>
            </div>
          ) : null}
          {notice ? (
            <div className="toast-pop toast-pop-success" role="status">
              <div>
                <strong>Information</strong>
                <p>{notice}</p>
              </div>
              <button type="button" aria-label="Fermer la notification" onClick={() => setNotice(null)}>
                Fermer
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

