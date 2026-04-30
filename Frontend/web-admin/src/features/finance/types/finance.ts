import type {
  FeePlan,
  Invoice,
  PaymentRecord,
  RecoveryDashboard
} from "../../../shared/types/app";

export type FinanceApiClient = (path: string, init?: RequestInit) => Promise<Response>;

export type FinanceData = {
  feePlans: FeePlan[];
  invoices: Invoice[];
  payments: PaymentRecord[];
  recovery: RecoveryDashboard | null;
};

export type FeePlanForm = {
  schoolYearId: string;
  levelId: string;
  label: string;
  totalAmount: string;
  currency: string;
};

export type InvoiceForm = {
  studentId: string;
  schoolYearId: string;
  feePlanId: string;
  amountDue: string;
  dueDate: string;
};

export type PaymentForm = {
  invoiceId: string;
  paidAmount: string;
  paymentMethod: "CASH" | "MOBILE_MONEY" | "BANK";
  referenceExternal: string;
};
