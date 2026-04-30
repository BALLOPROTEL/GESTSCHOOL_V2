import type {
  FeePlan,
  Invoice,
  PaymentRecord,
  RecoveryDashboard
} from "../../../shared/types/app";
import type { FinanceApiClient, FinanceData } from "../types/finance";

export const parseFinanceError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(payload.message)) return payload.message.join(", ");
    if (typeof payload.message === "string") return payload.message;
    if (typeof payload.error === "string") return payload.error;
  } catch {
    // Keep a stable fallback for non-JSON API errors.
  }
  return `Erreur HTTP ${response.status}`;
};

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

export const removeFeePlan = async (api: FinanceApiClient, id: string): Promise<void> => {
  const response = await api(`/fee-plans/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await parseFinanceError(response));
  }
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

export const removeInvoice = async (api: FinanceApiClient, id: string): Promise<void> => {
  const response = await api(`/invoices/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await parseFinanceError(response));
  }
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
