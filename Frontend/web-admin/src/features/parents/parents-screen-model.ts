import type { Student } from "../../shared/types/app";

export type ParentForm = {
  parentalRole: string;
  firstName: string;
  lastName: string;
  sex: "" | "M" | "F";
  primaryPhone: string;
  secondaryPhone: string;
  email: string;
  address: string;
  profession: string;
  identityDocumentType: string;
  identityDocumentNumber: string;
  status: string;
  establishmentId: string;
  userId: string;
  notes: string;
};

export type ParentLinkForm = {
  parentId: string;
  studentId: string;
  relationType: string;
  isPrimaryContact: boolean;
  livesWithStudent: boolean;
  pickupAuthorized: boolean;
  legalGuardian: boolean;
  financialResponsible: boolean;
  emergencyContact: boolean;
  comment: string;
};

export const SCHOOL_NAME = "Al Manarat Islamiyat";
export const PARENT_ROLES = ["PERE", "MERE", "TUTEUR", "AUTRE"];
export const PARENT_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"];

export const roleLabel = (role?: string): string => {
  if (role === "PERE") return "Pere";
  if (role === "MERE") return "Mere";
  if (role === "TUTEUR") return "Tuteur";
  return "Autre";
};

export const trackLabel = (track?: string): string => (track === "ARABOPHONE" ? "Arabophone" : "Francophone");

export const defaultParentForm = (): ParentForm => ({
  parentalRole: "PERE",
  firstName: "",
  lastName: "",
  sex: "",
  primaryPhone: "",
  secondaryPhone: "",
  email: "",
  address: "",
  profession: "",
  identityDocumentType: "",
  identityDocumentNumber: "",
  status: "ACTIVE",
  establishmentId: "",
  userId: "",
  notes: ""
});

export const defaultLinkForm = (): ParentLinkForm => ({
  parentId: "",
  studentId: "",
  relationType: "PERE",
  isPrimaryContact: false,
  livesWithStudent: false,
  pickupAuthorized: false,
  legalGuardian: false,
  financialResponsible: false,
  emergencyContact: false,
  comment: ""
});

export const buildStudentOption = (student: Student): string =>
  `${student.matricule} - ${student.fullName || `${student.firstName} ${student.lastName}`}`;
