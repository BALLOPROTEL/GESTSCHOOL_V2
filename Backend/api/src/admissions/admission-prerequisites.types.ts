import { type AcademicTrack } from "@prisma/client";

import {
  type AdmissionAcademicClass,
  type AdmissionAcademicLevel,
  type AdmissionAcademicSchoolYear,
} from "../academic-structure/admission-academic-policy.types";

export const ADMISSION_PREREQUISITES_CONTRACT_VERSION = "1" as const;

export const ADMISSION_MODES = ["NEW_ADMISSION", "RE_ENROLLMENT"] as const;
export type AdmissionMode = (typeof ADMISSION_MODES)[number];

export const ADMISSION_PREREQUISITE_ISSUE_CODES = [
  "ADMISSION_ACTIVE_SCHOOL_YEAR_MISSING",
  "ADMISSION_MULTIPLE_ACTIVE_SCHOOL_YEARS",
  "ADMISSION_ACTIVE_LEVEL_MISSING",
  "ADMISSION_ACTIVE_CLASS_MISSING",
  "ADMISSION_PERMISSION_DENIED",
  "ADMISSION_MODE_PERMISSION_LIMITED",
  "ADMISSION_FEE_PLAN_NOT_AVAILABLE",
  "ADMISSION_FINANCE_PERMISSION_LIMITED",
  "ADMISSION_REFERENCE_INCONSISTENCY",
] as const;

export type AdmissionPrerequisiteIssueCode =
  (typeof ADMISSION_PREREQUISITE_ISSUE_CODES)[number];

export type AdmissionPrerequisiteIssue = {
  code: AdmissionPrerequisiteIssueCode;
  scope: "TENANT" | "ACADEMIC" | "FINANCE" | "PERMISSIONS";
};

export type AdmissionPermissionKey =
  | "students:read"
  | "students:create"
  | "parents:read"
  | "parents:create"
  | "enrollments:create"
  | "enrollments:update"
  | "reference:read"
  | "reference:create"
  | "finance:read"
  | "finance:create";

export type AdmissionModeEligibility = {
  allowed: boolean;
  missingPermissions: AdmissionPermissionKey[];
};

export type AdmissionPrerequisitePermissions = {
  canReadStudents: boolean;
  canCreateStudent: boolean;
  canReadGuardians: boolean;
  canCreateGuardianAndLink: boolean;
  canCreatePlacement: boolean;
  canUpdatePlacement: boolean;
  canReadReference: boolean;
  canQuickCreateClass: boolean;
  canReadFeePlans: boolean;
  canCreateFeePlan: boolean;
  canCreateInvoice: boolean;
  modes: Record<AdmissionMode, AdmissionModeEligibility>;
};

export type AdmissionSchoolYearPrerequisite = AdmissionAcademicSchoolYear;

export type AdmissionLevelPrerequisite = AdmissionAcademicLevel;

export type AdmissionClassPrerequisite = AdmissionAcademicClass;

export type AdmissionFeePlanPrerequisite = {
  id: string;
  schoolYearId: string;
  levelId: string;
  label: string;
  totalAmount: number;
  currency: string;
};

export type AdmissionPrerequisitesResponse = {
  contractVersion: typeof ADMISSION_PREREQUISITES_CONTRACT_VERSION;
  tenant: {
    id: string;
    eligibilitySource: "AUTHENTICATED_ACTIVE_ACCOUNT";
  };
  supportedModes: AdmissionMode[];
  schoolYear: AdmissionSchoolYearPrerequisite | null;
  tracks: AcademicTrack[];
  levels: AdmissionLevelPrerequisite[];
  classes: AdmissionClassPrerequisite[];
  feePlans: AdmissionFeePlanPrerequisite[];
  financePolicy: "UNCONFIGURED";
  permissions: AdmissionPrerequisitePermissions;
  blockingIssues: AdmissionPrerequisiteIssue[];
  warnings: AdmissionPrerequisiteIssue[];
  ready: boolean;
};
