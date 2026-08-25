import type {
  AdmissionCase,
  AdmissionIssue,
  AdmissionMode,
  AdmissionStatus,
  AdmissionWizardStep,
  ParentRelationCode
} from "../types/admission";

export const ADMISSION_STEPS: AdmissionWizardStep[] = [
  "STUDENT",
  "GUARDIANS",
  "ACADEMICS",
  "FINANCE",
  "REVIEW"
];

export const ADMISSION_STEP_LABELS: Record<AdmissionWizardStep, string> = {
  STUDENT: "Élève",
  GUARDIANS: "Responsable",
  ACADEMICS: "Scolarité",
  FINANCE: "Frais",
  REVIEW: "Récapitulatif"
};

export const ADMISSION_MODE_LABELS: Record<AdmissionMode, string> = {
  NEW_ADMISSION: "Nouvel élève",
  RE_ENROLLMENT: "Réinscription"
};

export const ADMISSION_STATUS_LABELS: Record<AdmissionStatus, string> = {
  DRAFT: "Brouillon",
  READY: "Prêt à confirmer",
  FAILED: "À corriger",
  CONFIRMED: "Confirmée",
  CANCELLED: "Annulée"
};

export const PARENT_RELATION_LABELS: Record<ParentRelationCode, string> = {
  PERE: "Père",
  MERE: "Mère",
  TUTEUR: "Tuteur",
  RESPONSABLE_LEGAL: "Responsable légal",
  AUTRE: "Autre"
};

const ADMISSION_ERROR_MESSAGES: Record<string, string> = {
  ADMISSION_VERSION_CONFLICT: "Cette inscription a été modifiée ailleurs.",
  ADMISSION_IDEMPOTENCY_CONFLICT: "Cette confirmation ne correspond plus à la tentative en cours.",
  STUDENT_DUPLICATE_SUSPECTED: "Un élève similaire existe déjà.",
  STUDENT_EXACT_MATCH: "Cet élève existe déjà.",
  GUARDIAN_DUPLICATE_SUSPECTED: "Un responsable similaire existe déjà.",
  GUARDIAN_REQUIRED: "Ajoutez au moins un responsable.",
  PRIMARY_GUARDIAN_REQUIRED: "Choisissez le responsable principal.",
  PRIMARY_GUARDIAN_CONFLICT: "Un seul responsable peut être principal.",
  MATRICULE_CONFLICT: "Ce matricule est déjà utilisé.",
  PLACEMENT_CONFLICT: "Cet élève possède déjà un placement incompatible.",
  CLASS_NOT_AVAILABLE: "La classe sélectionnée n'est plus disponible.",
  ACADEMIC_CONTEXT_INVALID: "La sélection scolaire n'est plus valide.",
  FEE_PLAN_NOT_AVAILABLE: "Aucun plan de frais n'est disponible pour cette sélection.",
  FEE_PLAN_NOT_COMPATIBLE: "Le plan de frais sélectionné n'est plus compatible.",
  FINANCE_PERMISSION_DENIED: "Vous n'avez pas l'autorisation de choisir ce traitement des frais.",
  ADMISSION_CASE_NOT_READY: "Le dossier n'est pas encore prêt à être confirmé.",
  ADMISSION_INVALID_TRANSITION: "Cette action n'est pas disponible dans l'état actuel du dossier.",
  ADMISSION_EXISTING_STUDENT_UNAVAILABLE: "Cet élève ne peut pas être réinscrit pour le moment.",
  ADMISSION_PERMISSION_DENIED: "Vous n'avez pas l'autorisation de démarrer ce type d'inscription.",
  ADMISSION_ACTIVE_SCHOOL_YEAR_MISSING: "Aucune année scolaire active n'est configurée.",
  ADMISSION_MULTIPLE_ACTIVE_SCHOOL_YEARS: "Plusieurs années scolaires actives doivent être vérifiées.",
  ADMISSION_ACTIVE_LEVEL_MISSING: "Aucun niveau actif n'est configuré.",
  ADMISSION_ACTIVE_CLASS_MISSING: "Aucune classe disponible n'est configurée.",
  ADMISSION_REFERENCE_INCONSISTENCY: "Le référentiel scolaire contient une incohérence.",
  ADMISSION_MODE_PERMISSION_LIMITED: "Votre profil ne permet pas tous les types d'inscription.",
  ADMISSION_FEE_PLAN_NOT_AVAILABLE: "Aucun plan de frais n'est disponible actuellement.",
  ADMISSION_FINANCE_PERMISSION_LIMITED: "Le traitement financier est limité pour votre profil.",
  FINANCE_ACADEMIC_CONTEXT_REQUIRED: "Choisissez d'abord la scolarité de l'élève.",
  HTTP_400: "Les informations envoyées sont invalides.",
  HTTP_401: "Votre session a expiré. Reconnectez-vous.",
  HTTP_403: "Vous n'avez pas l'autorisation d'effectuer cette action.",
  HTTP_404: "Cette inscription est introuvable.",
  HTTP_409: "Cette action entre en conflit avec des données existantes.",
  HTTP_429: "Trop de tentatives. Réessayez dans quelques instants."
};

export const admissionErrorSource = (code?: string | null): string =>
  (code && ADMISSION_ERROR_MESSAGES[code]) || "Impossible d'enregistrer pour le moment. Réessayez.";

export const issueSource = (issue: AdmissionIssue): string => admissionErrorSource(issue.code);

export const getAdmissionProgress = (admissionCase: AdmissionCase): number =>
  ["STUDENT", "GUARDIANS", "ACADEMICS", "FINANCE"].filter(
    (section) => admissionCase.completion[section as keyof typeof admissionCase.completion]
  ).length;

export const getInitialAdmissionStep = (admissionCase: AdmissionCase): AdmissionWizardStep => {
  if (!admissionCase.completion.STUDENT) return "STUDENT";
  if (!admissionCase.completion.GUARDIANS) return "GUARDIANS";
  if (!admissionCase.completion.ACADEMICS) return "ACADEMICS";
  if (!admissionCase.completion.FINANCE) return "FINANCE";
  return "REVIEW";
};

export const admissionStudentName = (admissionCase: AdmissionCase): string => {
  const student = admissionCase.sections.STUDENT;
  return [student?.firstName, student?.lastName].filter(Boolean).join(" ") || "Élève existant";
};
