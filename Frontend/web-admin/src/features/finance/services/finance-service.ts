import { parseApiError } from "../../../shared/services/api-errors";
import type {
  FeePlan,
  Invoice,
  PaymentRecord,
  RecoveryDashboard
} from "../../../shared/types/app";
import type { FinanceApiClient, FinanceData, PaydunyaAttempt } from "../types/finance";

export const parseFinanceError = parseApiError;

export const fetchFinanceData = async (api: FinanceApiClient): Promise<FinanceData> => {
  const responses = await Promise.all([
    api("/fee-plans"),
    api("/invoices"),
    api("/payments"),
    api("/finance/recovery")
  ]);

  const failed = responses.find((item) => !item.ok);
  if (failed) {
    throw new Error(await parseFinanceError(failed));
  }

  const [feePlans, invoices, payments, recovery] = await Promise.all([
    responses[0].json() as Promise<FeePlan[]>,
    responses[1].json() as Promise<Invoice[]>,
    responses[2].json() as Promise<PaymentRecord[]>,
    responses[3].json() as Promise<RecoveryDashboard>
  ]);

  return { feePlans, invoices, payments, recovery };
};

export const createFeePlan = async (
  api: FinanceApiClient,
  payload: Record<string, unknown>
): Promise<FeePlan> => {
  const response = await api("/fee-plans", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parseFinanceError(response));
  }
  return (await response.json()) as FeePlan;
};

export const createInvoice = async (
  api: FinanceApiClient,
  payload: Record<string, unknown>
): Promise<Invoice> => {
  const response = await api("/invoices", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parseFinanceError(response));
  }
  return (await response.json()) as Invoice;
};

export const updateInvoiceStatus = async (
  api: FinanceApiClient,
  id: string,
  status: "OPEN" | "PARTIAL" | "PAID" | "VOID"
): Promise<Invoice> => {
  const response = await api(`/invoices/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  if (!response.ok) {
    throw new Error(await parseFinanceError(response));
  }
  return (await response.json()) as Invoice;
};

export const createPayment = async (
  api: FinanceApiClient,
  payload: Record<string, unknown>
): Promise<PaymentRecord> => {
  const response = await api("/payments", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parseFinanceError(response));
  }
  return (await response.json()) as PaymentRecord;
};

export const initiatePaydunyaPayment = async (
  api: FinanceApiClient,
  invoiceId: string
): Promise<PaydunyaAttempt> => {
  const response = await api("/payments/paydunya/initiate", {
    method: "POST",
    body: JSON.stringify({ invoiceId })
  });
  if (!response.ok) {
    throw new Error(await parseFinanceError(response));
  }
  return (await response.json()) as PaydunyaAttempt;
};

export const fetchPaymentReceipt = async (
  api: FinanceApiClient,
  paymentId: string
): Promise<string> => {
  const response = await api(`/payments/${paymentId}/receipt`);
  if (!response.ok) {
    throw new Error(await parseFinanceError(response));
  }
  const payload = (await response.json()) as { pdfDataUrl: string };
  return payload.pdfDataUrl;
};
