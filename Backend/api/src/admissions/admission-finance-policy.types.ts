import { type AdmissionAcademicsDraft } from "./admission-cases.types";

export const ADMISSION_FINANCE_CONTRACT_VERSION = "1" as const;
export const ADMISSION_FINANCE_POLICY = "OPTIONAL" as const;
export const ADMISSION_FINANCE_MODES = ["FEE_PLAN", "DEFERRED"] as const;

export type AdmissionFinanceMode = (typeof ADMISSION_FINANCE_MODES)[number];

export type AdmissionFinancePlanOption = {
  id: string;
  schoolYearId: string;
  levelId: string;
  label: string;
  totalAmount: number;
  currency: string;
};

export type AdmissionFinanceIssueCode =
  | "FINANCE_ACADEMIC_CONTEXT_REQUIRED"
  | "FINANCE_PERMISSION_DENIED"
  | "FEE_PLAN_NOT_AVAILABLE"
  | "FEE_PLAN_NOT_COMPATIBLE";

export type AdmissionFinanceIssue = {
  code: AdmissionFinanceIssueCode;
  scope: "FINANCE";
};

export type AdmissionFinanceCapabilities = {
  canReadFeePlans: boolean;
  canSelectFeePlan: boolean;
  canDefer: boolean;
  canCreateInvoice: boolean;
  automaticInvoiceCreation: false;
};

export type AdmissionFinanceOptionsResponse = {
  contractVersion: typeof ADMISSION_FINANCE_CONTRACT_VERSION;
  admissionCaseId: string;
  policy: typeof ADMISSION_FINANCE_POLICY;
  supportedModes: AdmissionFinanceMode[];
  academicContext: AdmissionAcademicsDraft | null;
  plans: AdmissionFinancePlanOption[];
  selectedIntent: {
    mode: AdmissionFinanceMode;
    feePlanId: string | null;
  } | null;
  schedule: { supported: false };
  services: { supported: false };
  discounts: { supported: false };
  exemptions: { supported: false };
  capabilities: AdmissionFinanceCapabilities;
  blockingIssues: AdmissionFinanceIssue[];
  warnings: AdmissionFinanceIssue[];
};

export type AdmissionFinalFinanceResult = {
  policy: typeof ADMISSION_FINANCE_POLICY;
  mode: AdmissionFinanceMode | "UNSPECIFIED";
  feePlanId: string | null;
  amount: number | null;
  currency: string | null;
  invoiceGeneration: "DEFERRED";
};
