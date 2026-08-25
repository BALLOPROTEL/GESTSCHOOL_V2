import type { AcademicTrack } from "../../../shared/types/app";

export type AdmissionMode = "NEW_ADMISSION" | "RE_ENROLLMENT";
export type AdmissionStatus = "DRAFT" | "READY" | "FAILED" | "CONFIRMED" | "CANCELLED";
export type AdmissionSection = "STUDENT" | "GUARDIANS" | "ACADEMICS" | "FINANCE";
export type ParentRelationCode = "PERE" | "MERE" | "TUTEUR" | "RESPONSABLE_LEGAL" | "AUTRE";

export type AdmissionIssue = {
  code: string;
  scope: "TENANT" | "ACADEMIC" | "FINANCE" | "PERMISSIONS" | "STUDENT" | "GUARDIANS";
};

export type AdmissionStudentDraft = {
  matriculeMode?: "AUTO" | "MANUAL";
  matricule?: string;
  firstName?: string;
  lastName?: string;
  sex?: "M" | "F";
  birthDate?: string;
};

export type AdmissionGuardianDraft = {
  source?: "EXISTING_GUARDIAN" | "NEW_GUARDIAN";
  parentId?: string;
  parentalRole?: ParentRelationCode;
  firstName?: string;
  lastName?: string;
  sex?: "M" | "F";
  primaryPhone?: string;
  email?: string;
  relationType?: ParentRelationCode;
  isPrimaryContact?: boolean;
  legalGuardian?: boolean;
  financialResponsible?: boolean;
  emergencyContact?: boolean;
};

export type AdmissionAcademicsDraft = {
  schoolYearId?: string;
  cycleId?: string;
  levelId?: string;
  classId?: string;
  track?: AcademicTrack;
};

export type AdmissionFinanceMode = "FEE_PLAN" | "DEFERRED";

export type AdmissionFinanceDraft = {
  mode?: AdmissionFinanceMode;
  feePlanId?: string;
  note?: string;
};

export type AdmissionFinalizationResult = {
  admissionCaseId: string;
  status: "CONFIRMED";
  studentId: string;
  studentMatricule: string;
  placementId: string;
  enrollmentId: string;
  guardianIds: string[];
  parentStudentLinkIds: string[];
  finance: {
    policy: "OPTIONAL";
    mode: AdmissionFinanceMode | "UNSPECIFIED";
    feePlanId: string | null;
    amount: number | null;
    currency: string | null;
    invoiceGeneration: "DEFERRED";
  };
  invoiceIds: [];
  confirmedAt: string;
  version: number;
};

export type AdmissionCase = {
  contractVersion: "1";
  payloadVersion: 1;
  id: string;
  mode: AdmissionMode;
  status: AdmissionStatus;
  version: number;
  studentId: string | null;
  schoolYearId: string | null;
  sections: {
    STUDENT?: AdmissionStudentDraft;
    GUARDIANS?: { guardians?: AdmissionGuardianDraft[] };
    ACADEMICS?: AdmissionAcademicsDraft;
    FINANCE?: AdmissionFinanceDraft;
    DOCUMENTS: null;
  };
  completion: Record<AdmissionSection, boolean> & { DOCUMENTS: false };
  ready: boolean;
  blockingIssues: AdmissionIssue[];
  warnings: AdmissionIssue[];
  finalizationResult: AdmissionFinalizationResult | null;
  confirmedAt: string | null;
  failedAt: string | null;
  failureCode: string | null;
  recoveryAction: "EDIT_AND_REVALIDATE" | "RETRY" | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export type AdmissionPrerequisites = {
  contractVersion: "1";
  tenant: { id: string; eligibilitySource: "AUTHENTICATED_ACTIVE_ACCOUNT" };
  supportedModes: AdmissionMode[];
  schoolYear: AdmissionSchoolYearOption | null;
  tracks: AcademicTrack[];
  levels: AdmissionLevelOption[];
  classes: AdmissionClassOption[];
  feePlans: AdmissionFeePlanOption[];
  financePolicy: "OPTIONAL";
  permissions: {
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
    modes: Record<AdmissionMode, { allowed: boolean; missingPermissions: AdmissionPermissionKey[] }>;
  };
  blockingIssues: AdmissionIssue[];
  warnings: AdmissionIssue[];
  ready: boolean;
};

export type AdmissionSchoolYearOption = {
  id: string;
  code: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type AdmissionLevelOption = {
  id: string;
  cycleId: string;
  cycleCode: string;
  cycleLabel: string;
  code: string;
  label: string;
  track: AcademicTrack;
  sortOrder: number;
};

export type AdmissionClassOption = {
  id: string;
  schoolYearId: string;
  cycleId: string;
  levelId: string;
  code: string;
  label: string;
  track: AcademicTrack;
  capacity?: number;
  actualCapacity?: number;
  currentEnrollmentCount: number;
  placesRemaining?: number;
  capacityStatus: "UNBOUNDED" | "AVAILABLE" | "FULL";
};

export type AdmissionAcademicOptions = {
  contractVersion: "1";
  selectionPolicy: {
    schoolYear: "SINGLE_ACTIVE";
    classCapacity: "INFORMATIONAL";
    automaticClassSelection: false;
    automaticStudentSelection: false;
  };
  selected: AdmissionAcademicsDraft;
  schoolYears: AdmissionSchoolYearOption[];
  tracks: AcademicTrack[];
  levels: AdmissionLevelOption[];
  classes: AdmissionClassOption[];
};

export type AdmissionFeePlanOption = {
  id: string;
  schoolYearId: string;
  levelId: string;
  label: string;
  totalAmount: number;
  currency: string;
};

export type AdmissionFinanceOptions = {
  contractVersion: "1";
  admissionCaseId: string;
  policy: "OPTIONAL";
  supportedModes: AdmissionFinanceMode[];
  academicContext: AdmissionAcademicsDraft | null;
  plans: AdmissionFeePlanOption[];
  selectedIntent: { mode: AdmissionFinanceMode; feePlanId: string | null } | null;
  schedule: { supported: false };
  services: { supported: false };
  discounts: { supported: false };
  exemptions: { supported: false };
  capabilities: {
    canReadFeePlans: boolean;
    canSelectFeePlan: boolean;
    canDefer: boolean;
    canCreateInvoice: boolean;
    automaticInvoiceCreation: false;
  };
  blockingIssues: AdmissionIssue[];
  warnings: AdmissionIssue[];
};

export type AdmissionStudentMatch = {
  id: string;
  matchKind: "EXACT_MATCH" | "POSSIBLE_MATCH";
  signals: Array<"MATRICULE" | "IDENTITY_AND_BIRTH_DATE" | "NAME" | "PHONE" | "EMAIL">;
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
  matchKind: "EXACT_MATCH" | "POSSIBLE_MATCH" | "NO_MATCH";
  code: "STUDENT_EXACT_MATCH" | "STUDENT_DUPLICATE_SUSPECTED" | null;
  matches: AdmissionStudentMatch[];
};

export type AdmissionGuardianMatch = {
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
  matches: AdmissionGuardianMatch[];
};

export type AdmissionCasePage = {
  contractVersion: "1";
  items: AdmissionCase[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdmissionStudentSearchQuery = Partial<
  Pick<AdmissionStudentDraft, "matricule" | "firstName" | "lastName" | "birthDate">
> & { phone?: string; email?: string; limit?: number };

export type AdmissionGuardianSearchQuery = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  identityDocumentType?: string;
  identityDocumentNumber?: string;
  limit?: number;
};

export type AdmissionWizardStep = "STUDENT" | "GUARDIANS" | "ACADEMICS" | "FINANCE" | "REVIEW";
