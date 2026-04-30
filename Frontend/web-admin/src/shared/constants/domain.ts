import type {
  AcademicTrack,
  AccountType,
  PasswordMode,
  PeriodStatus,
  PermissionAction,
  PermissionResource,
  Role,
  SchoolYearStatus,
  SubjectNature
} from "../types/app";

export const ACADEMIC_TRACK_OPTIONS: AcademicTrack[] = ["FRANCOPHONE", "ARABOPHONE"];
export const SCHOOL_YEAR_STATUS_OPTIONS: SchoolYearStatus[] = ["DRAFT", "ACTIVE", "CLOSED"];
export const REFERENCE_STATUS_OPTIONS: Array<"ACTIVE" | "INACTIVE"> = ["ACTIVE", "INACTIVE"];
export const PERIOD_STATUS_OPTIONS: PeriodStatus[] = ["DRAFT", "ACTIVE", "CLOSED"];
export const PERIOD_TYPE_OPTIONS = [
  { value: "TRIMESTER", label: "Trimestre" },
  { value: "SEMESTER", label: "Semestre" },
  { value: "BIMESTER", label: "Bimestre" },
  { value: "CUSTOM", label: "Decoupage libre" }
] as const;
export const SUBJECT_NATURE_OPTIONS: SubjectNature[] = ["FRANCOPHONE", "ARABOPHONE"];
export const TEACHING_MODE_OPTIONS = [
  { value: "PRESENTIAL", label: "Presentiel" },
  { value: "HYBRID", label: "Hybride" },
  { value: "REMOTE", label: "Distance" },
  { value: "BLENDED", label: "Mixte" }
] as const;

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  SCOLARITE: "Scolarite",
  ENSEIGNANT: "Portail enseignant",
  COMPTABLE: "Comptable",
  PARENT: "Portail parent",
  STUDENT: "Portail eleve"
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Ouverte",
  PARTIAL: "Partiellement reglee",
  PAID: "Soldee",
  VOID: "Annulee"
};

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Retard",
  EXCUSED: "Excuse"
};

export const VALIDATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Validee",
  REJECTED: "Rejetee"
};

export const PORTAL_NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  SCHEDULED: "Planifiee",
  SENT: "Envoyee",
  FAILED: "Echec",
  DELIVERED: "Livree",
  SENT_TO_PROVIDER: "Transmise",
  RETRYING: "Nouvelle tentative",
  UNDELIVERABLE: "Non distribuable"
};

export const AUDIENCE_ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administration",
  SCOLARITE: "Scolarite",
  ENSEIGNANT: "Enseignants",
  COMPTABLE: "Comptabilite",
  PARENT: "Parents",
  STUDENT: "Eleves"
};

export const MEMBER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif"
};

export const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  ENROLLED: "Inscrit",
  PENDING: "En attente",
  CANCELLED: "Annulee",
  COMPLETED: "Finalisee"
};

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche"
};

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  read: "Lecture",
  create: "Creation",
  update: "Modification",
  delete: "Suppression",
  validate: "Validation",
  dispatch: "Envoi"
};

export const PERMISSION_RESOURCE_LABELS: Record<PermissionResource, string> = {
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
  mosquee: "Mosquee",
  analytics: "Analytique",
  audit: "Audit"
};

export const ROLE_VALUES: Role[] = ["ADMIN", "SCOLARITE", "ENSEIGNANT", "COMPTABLE", "PARENT", "STUDENT"];
export const ACCOUNT_TYPE_VALUES: AccountType[] = ["STAFF", "TEACHER", "PARENT", "STUDENT"];
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  STAFF: "Staff interne",
  TEACHER: "Enseignant",
  PARENT: "Parent",
  STUDENT: "Eleve"
};
export const ACCOUNT_TYPE_ROLE_OPTIONS: Record<AccountType, Role[]> = {
  STAFF: ["ADMIN", "SCOLARITE", "COMPTABLE"],
  TEACHER: ["ENSEIGNANT"],
  PARENT: ["PARENT"],
  STUDENT: ["STUDENT"]
};
export const PASSWORD_MODE_LABELS: Record<PasswordMode, string> = {
  AUTO: "Mot de passe temporaire auto",
  MANUAL: "Saisie manuelle"
};
export const PERMISSION_RESOURCE_VALUES: PermissionResource[] = [
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
  "mosquee",
  "analytics",
  "audit"
];
export const PERMISSION_ACTION_VALUES: PermissionAction[] = [
  "read",
  "create",
  "update",
  "delete",
  "validate",
  "dispatch"
];
