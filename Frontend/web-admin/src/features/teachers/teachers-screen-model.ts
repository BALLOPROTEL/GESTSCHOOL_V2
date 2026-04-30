import type { AcademicTrack } from "../../shared/types/app";

export type TeacherForm = {
  matricule: string;
  firstName: string;
  lastName: string;
  sex: "" | "M" | "F";
  birthDate: string;
  primaryPhone: string;
  secondaryPhone: string;
  email: string;
  address: string;
  nationality: string;
  identityDocumentType: string;
  identityDocumentNumber: string;
  hireDate: string;
  teacherType: string;
  speciality: string;
  mainDiploma: string;
  teachingLanguage: string;
  status: string;
  establishmentId: string;
  userId: string;
  internalNotes: string;
};

export type SkillForm = {
  teacherId: string;
  subjectId: string;
  track: AcademicTrack;
  cycleId: string;
  levelId: string;
  qualification: string;
  yearsExperience: string;
  priority: string;
  status: string;
  comment: string;
};

export type TeacherAssignmentForm = {
  teacherId: string;
  schoolYearId: string;
  classId: string;
  subjectId: string;
  track: AcademicTrack;
  periodId: string;
  workloadHours: string;
  coefficient: string;
  isHomeroomTeacher: boolean;
  role: string;
  startDate: string;
  endDate: string;
  status: string;
  comment: string;
};

export type TeacherDocumentForm = {
  teacherId: string;
  documentType: string;
  fileUrl: string;
  originalName: string;
  mimeType: string;
  size: string;
  status: string;
};

export type TeacherFilters = {
  search: string;
  status: string;
  teacherType: string;
  subjectId: string;
  classId: string;
  track: string;
};

export const SCHOOL_NAME = "Al Manarat Islamiyat";
export const TEACHER_TYPES = ["TITULAIRE", "VACATAIRE", "CONTRACTUEL", "STAGIAIRE"];
export const TEACHER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"];
export const ASSIGNMENT_STATUSES = ["ACTIVE", "INACTIVE", "COMPLETED", "SUSPENDED", "ARCHIVED"];
export const DOCUMENT_TYPES = ["CONTRAT", "DIPLOME", "PIECE_IDENTITE", "CV", "ATTESTATION", "AUTRE"];
export const TRACKS: AcademicTrack[] = ["FRANCOPHONE", "ARABOPHONE"];

export const trackLabel = (track: AcademicTrack): string => (track === "ARABOPHONE" ? "Arabophone" : "Francophone");

export const today = (): string => new Date().toISOString().slice(0, 10);

export const emptyToUndefined = (value: string): string | undefined => {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
};

export const numberOrUndefined = (value: string): number | undefined => {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const defaultTeacherFilters = (): TeacherFilters => ({
  search: "",
  status: "",
  teacherType: "",
  subjectId: "",
  classId: "",
  track: ""
});

export const defaultTeacherForm = (): TeacherForm => ({
  matricule: "",
  firstName: "",
  lastName: "",
  sex: "",
  birthDate: "",
  primaryPhone: "",
  secondaryPhone: "",
  email: "",
  address: "",
  nationality: "",
  identityDocumentType: "",
  identityDocumentNumber: "",
  hireDate: "",
  teacherType: "TITULAIRE",
  speciality: "",
  mainDiploma: "",
  teachingLanguage: "Francais",
  status: "ACTIVE",
  establishmentId: "",
  userId: "",
  internalNotes: ""
});

export const defaultSkillForm = (): SkillForm => ({
  teacherId: "",
  subjectId: "",
  track: "FRANCOPHONE",
  cycleId: "",
  levelId: "",
  qualification: "",
  yearsExperience: "",
  priority: "",
  status: "ACTIVE",
  comment: ""
});

export const defaultAssignmentForm = (): TeacherAssignmentForm => ({
  teacherId: "",
  schoolYearId: "",
  classId: "",
  subjectId: "",
  track: "FRANCOPHONE",
  periodId: "",
  workloadHours: "",
  coefficient: "",
  isHomeroomTeacher: false,
  role: "",
  startDate: today(),
  endDate: "",
  status: "ACTIVE",
  comment: ""
});

export const defaultDocumentForm = (): TeacherDocumentForm => ({
  teacherId: "",
  documentType: "CONTRAT",
  fileUrl: "",
  originalName: "",
  mimeType: "application/pdf",
  size: "",
  status: "ACTIVE"
});
