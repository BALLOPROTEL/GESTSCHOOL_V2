import {
  type AcademicTrack,
  type AdmissionCaseMode,
  type AdmissionCaseStatus,
} from "@prisma/client";

import {
  type AdmissionPrerequisiteIssue,
  type AdmissionPrerequisiteIssueCode,
} from "./admission-prerequisites.types";

export const ADMISSION_CASE_CONTRACT_VERSION = "1" as const;
export const ADMISSION_DRAFT_PAYLOAD_VERSION = 1 as const;

export const AdmissionCaseSection = {
  STUDENT: "STUDENT",
  GUARDIANS: "GUARDIANS",
  ACADEMICS: "ACADEMICS",
  FINANCE: "FINANCE",
} as const;

export const ADMISSION_CASE_MUTABLE_SECTIONS = Object.values(
  AdmissionCaseSection,
);

export type AdmissionCaseMutableSection =
  (typeof AdmissionCaseSection)[keyof typeof AdmissionCaseSection];

export type AdmissionStudentDraft = {
  matricule?: string;
  firstName?: string;
  lastName?: string;
  sex?: "M" | "F";
  birthDate?: string;
  birthPlace?: string;
  nationality?: string;
  address?: string;
  phone?: string;
  email?: string;
  admissionDate?: string;
  internalId?: string;
  birthCertificateNo?: string;
  specialNeeds?: string;
  primaryLanguage?: string;
  administrativeNotes?: string;
};

export type AdmissionGuardianDraft = {
  source?: "EXISTING_GUARDIAN" | "NEW_GUARDIAN";
  parentId?: string;
  parentalRole?: "PERE" | "MERE" | "TUTEUR" | "AUTRE";
  firstName?: string;
  lastName?: string;
  sex?: "M" | "F";
  primaryPhone?: string;
  secondaryPhone?: string;
  email?: string;
  address?: string;
  profession?: string;
  identityDocumentType?: string;
  identityDocumentNumber?: string;
  relationType?: "PERE" | "MERE" | "TUTEUR" | "AUTRE";
  isPrimaryContact?: boolean;
  livesWithStudent?: boolean;
  pickupAuthorized?: boolean;
  legalGuardian?: boolean;
  financialResponsible?: boolean;
  emergencyContact?: boolean;
  comment?: string;
};

export type AdmissionGuardiansDraft = {
  guardians?: AdmissionGuardianDraft[];
};

export type AdmissionAcademicsDraft = {
  schoolYearId?: string;
  cycleId?: string;
  levelId?: string;
  classId?: string;
  track?: AcademicTrack;
};

export type AdmissionFinanceDraft = {
  disposition?: "IMMEDIATE" | "DEFERRED" | "EXEMPT_OR_SPECIAL";
  feePlanId?: string;
  note?: string;
};

export type AdmissionDraftData = {
  STUDENT?: AdmissionStudentDraft;
  GUARDIANS?: AdmissionGuardiansDraft;
  ACADEMICS?: AdmissionAcademicsDraft;
  FINANCE?: AdmissionFinanceDraft;
};

export const ADMISSION_CASE_ISSUE_CODES = [
  "ADMISSION_STUDENT_SECTION_INCOMPLETE",
  "ADMISSION_EXISTING_STUDENT_UNAVAILABLE",
  "ADMISSION_ACADEMICS_SECTION_INCOMPLETE",
  "ADMISSION_ACADEMIC_SELECTION_INVALID",
  "ADMISSION_MODE_PERMISSION_DENIED",
] as const;

export type AdmissionCaseIssueCode =
  (typeof ADMISSION_CASE_ISSUE_CODES)[number];

export type AdmissionCaseIssue = {
  code: AdmissionCaseIssueCode | AdmissionPrerequisiteIssueCode;
  scope: AdmissionPrerequisiteIssue["scope"] | "STUDENT";
};

export type AdmissionCaseCompletion = {
  STUDENT: boolean;
  GUARDIANS: boolean;
  ACADEMICS: boolean;
  FINANCE: boolean;
  DOCUMENTS: false;
};

export type AdmissionCaseView = {
  contractVersion: typeof ADMISSION_CASE_CONTRACT_VERSION;
  payloadVersion: typeof ADMISSION_DRAFT_PAYLOAD_VERSION;
  id: string;
  mode: AdmissionCaseMode;
  status: AdmissionCaseStatus;
  version: number;
  studentId: string | null;
  schoolYearId: string | null;
  sections: AdmissionDraftData & { DOCUMENTS: null };
  completion: AdmissionCaseCompletion;
  ready: boolean;
  blockingIssues: AdmissionCaseIssue[];
  warnings: AdmissionCaseIssue[];
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdmissionCasePage = {
  contractVersion: typeof ADMISSION_CASE_CONTRACT_VERSION;
  items: AdmissionCaseView[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
