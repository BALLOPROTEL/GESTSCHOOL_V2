import {
  type AcademicTrack,
  type AdmissionCaseMode,
  type AdmissionCaseStatus,
} from "@prisma/client";

import {
  type AdmissionPrerequisiteIssue,
  type AdmissionPrerequisiteIssueCode,
} from "./admission-prerequisites.types";
import { type ParentRelationCode } from "../parents/parent-relations";
import {
  type AdmissionFinalFinanceResult,
  type AdmissionFinanceIssueCode,
  type AdmissionFinanceMode,
} from "./admission-finance-policy.types";

export const ADMISSION_CASE_CONTRACT_VERSION = "1" as const;
export const ADMISSION_DRAFT_PAYLOAD_VERSION = 1 as const;
export const ADMISSION_FINALIZATION_RESULT_VERSION = "1" as const;

export const AdmissionCaseSection = {
  STUDENT: "STUDENT",
  GUARDIANS: "GUARDIANS",
  ACADEMICS: "ACADEMICS",
  FINANCE: "FINANCE",
} as const;

export const ADMISSION_CASE_MUTABLE_SECTIONS =
  Object.values(AdmissionCaseSection);

export type AdmissionCaseMutableSection =
  (typeof AdmissionCaseSection)[keyof typeof AdmissionCaseSection];

export type AdmissionStudentDraft = {
  matriculeMode?: "AUTO" | "MANUAL";
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
  parentalRole?: ParentRelationCode;
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
  relationType?: ParentRelationCode;
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
  mode?: AdmissionFinanceMode;
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
  "GUARDIAN_REQUIRED",
  "PRIMARY_GUARDIAN_REQUIRED",
  "PRIMARY_GUARDIAN_CONFLICT",
  "ADMISSION_EXISTING_STUDENT_UNAVAILABLE",
  "ADMISSION_ACADEMICS_SECTION_INCOMPLETE",
  "ADMISSION_ACADEMIC_SELECTION_INVALID",
  "ADMISSION_MODE_PERMISSION_DENIED",
] as const;

export type AdmissionCaseIssueCode =
  (typeof ADMISSION_CASE_ISSUE_CODES)[number];

export type AdmissionCaseIssue = {
  code:
    | AdmissionCaseIssueCode
    | AdmissionPrerequisiteIssueCode
    | AdmissionFinanceIssueCode;
  scope: AdmissionPrerequisiteIssue["scope"] | "STUDENT" | "GUARDIANS";
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
  finalizationResult: AdmissionFinalizationResult | null;
  confirmedAt: string | null;
  failedAt: string | null;
  failureCode: string | null;
  recoveryAction: "EDIT_AND_REVALIDATE" | "RETRY" | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdmissionFinalizationResult = {
  contractVersion: typeof ADMISSION_FINALIZATION_RESULT_VERSION;
  admissionCaseId: string;
  status: "CONFIRMED";
  studentId: string;
  studentMatricule: string;
  placementId: string;
  enrollmentId: string;
  guardianIds: string[];
  parentStudentLinkIds: string[];
  finance: AdmissionFinalFinanceResult;
  invoiceIds: [];
  confirmedAt: string;
  version: number;
};

export type AdmissionIdentityMatchKind =
  | "EXACT_MATCH"
  | "POSSIBLE_MATCH"
  | "NO_MATCH";

export type AdmissionStudentSearchMatch = {
  id: string;
  matchKind: Exclude<AdmissionIdentityMatchKind, "NO_MATCH">;
  signals: Array<
    "MATRICULE" | "IDENTITY_AND_BIRTH_DATE" | "NAME" | "PHONE" | "EMAIL"
  >;
  blocksCreation: boolean;
  matricule: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  status: string;
  phoneHint: string | null;
  emailHint: string | null;
};

export type AdmissionStudentSearchResult = {
  matchKind: AdmissionIdentityMatchKind;
  code: "STUDENT_EXACT_MATCH" | "STUDENT_DUPLICATE_SUSPECTED" | null;
  matches: AdmissionStudentSearchMatch[];
};

export type AdmissionGuardianSearchMatch = {
  id: string;
  matchKind: "POSSIBLE_MATCH";
  signals: Array<"IDENTITY_DOCUMENT" | "PHONE" | "EMAIL" | "NAME">;
  blocksCreation: boolean;
  firstName: string;
  lastName: string;
  parentalRole: ParentRelationCode;
  status: string;
  phoneHint: string;
  emailHint: string | null;
  identityDocumentType: string | null;
  identityDocumentHint: string | null;
};

export type AdmissionGuardianSearchResult = {
  matchKind: "POSSIBLE_MATCH" | "NO_MATCH";
  code: "GUARDIAN_DUPLICATE_SUSPECTED" | null;
  matches: AdmissionGuardianSearchMatch[];
};

export type AdmissionCasePage = {
  contractVersion: typeof ADMISSION_CASE_CONTRACT_VERSION;
  items: AdmissionCaseView[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
