import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { translateUiString, UI_MESSAGES } from "../../../shared/i18n";
import { useI18n } from "../../../shared/i18n-context";
import { toUiErrorMessage } from "../../../shared/services/api-errors";
import type { FieldErrors, Level, SchoolYear, Student } from "../../../shared/types/app";
import {
  createFeePlan,
  createInvoice,
  createPayment,
  fetchFinanceData,
  fetchPaymentReceipt,
  initiatePaydunyaPayment,
  updateInvoiceStatus
} from "../services/finance-service";
import type {
  FeePlanForm,
  FinanceApiClient,
  FinanceData,
  InvoiceForm,
  PaymentForm
} from "../types/finance";

type UseFinanceDataOptions = {
  api: FinanceApiClient;
  initialData: FinanceData;
  schoolYears: SchoolYear[];
  levels: Level[];
  students: Student[];
  defaultCurrency: string;
  remoteEnabled?: boolean;
  onFinanceDataChange?: (data: FinanceData) => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
};

const hasFieldErrors = (errors: FieldErrors): boolean => Object.keys(errors).length > 0;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;

const focusFirstInlineErrorField = (stepId?: string): void => {
  window.setTimeout(() => {
    const scope = stepId
      ? document.querySelector(`[data-step-id="${stepId}"][data-active-step="true"]`)
      : document;

    if (!scope) return;
    const errorNode = scope.querySelector(".field-error");
    if (!errorNode) return;

    const label = errorNode.closest("label");
    const input = label?.querySelector<HTMLElement>("input, select, textarea");
    if (!input) return;

    input.focus();
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 0);
};

const buildFeePlanForm = (defaultCurrency: string): FeePlanForm => ({
  schoolYearId: "",
  levelId: "",
  label: "",
  totalAmount: "",
  currency: defaultCurrency
});

const buildInvoiceForm = (): InvoiceForm => ({
  studentId: "",
  schoolYearId: "",
  feePlanId: "",
  amountDue: "",
  dueDate: ""
});

const buildPaymentForm = (): PaymentForm => ({
  invoiceId: "",
  paidAmount: "",
  paymentMethod: "CASH",
  paidAt: new Date().toISOString().slice(0, 10),
  referenceExternal: ""
});

export const useFinanceData = ({
  api,
  initialData,
  schoolYears,
  levels,
  students,
  defaultCurrency,
  remoteEnabled = true,
  onFinanceDataChange,
  onError,
  onNotice
}: UseFinanceDataOptions) => {
  const { language } = useI18n();
  const [financeData, setFinanceData] = useState<FinanceData>(initialData);
  const [feePlanForm, setFeePlanForm] = useState<FeePlanForm>(() => buildFeePlanForm(defaultCurrency));
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>(() => buildInvoiceForm());
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(() => buildPaymentForm());
  const [feePlanErrors, setFeePlanErrors] = useState<FieldErrors>({});
  const [invoiceErrors, setInvoiceErrors] = useState<FieldErrors>({});
  const [paymentErrors, setPaymentErrors] = useState<FieldErrors>({});
  const [financeWorkflowStep, setFinanceWorkflowStep] = useState("overview");
  const [receiptPdfUrl, setReceiptPdfUrl] = useState("");

  const setFinanceDataAndNotify = useCallback(
    (nextData: FinanceData) => {
      setFinanceData(nextData);
      onFinanceDataChange?.(nextData);
    },
    [onFinanceDataChange]
  );

  useEffect(() => {
    setFinanceData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (!feePlanForm.schoolYearId && schoolYears[0]) {
      setFeePlanForm((previous) => ({ ...previous, schoolYearId: schoolYears[0].id }));
    }
    if (!feePlanForm.levelId && levels[0]) {
      setFeePlanForm((previous) => ({ ...previous, levelId: levels[0].id }));
    }
    if (!invoiceForm.studentId && students[0]) {
      setInvoiceForm((previous) => ({ ...previous, studentId: students[0].id }));
    }
    if (!invoiceForm.schoolYearId && schoolYears[0]) {
      setInvoiceForm((previous) => ({ ...previous, schoolYearId: schoolYears[0].id }));
    }
    if (!paymentForm.invoiceId && financeData.invoices[0]) {
      setPaymentForm((previous) => ({ ...previous, invoiceId: financeData.invoices[0].id }));
    }
  }, [
    feePlanForm.levelId,
    feePlanForm.schoolYearId,
    financeData.invoices,
    invoiceForm.schoolYearId,
    invoiceForm.studentId,
    levels,
    paymentForm.invoiceId,
    schoolYears,
    students
  ]);

  const loadFinance = useCallback(async (): Promise<void> => {
    if (!remoteEnabled) {
      setFinanceData(initialData);
      return;
    }

    try {
      setFinanceDataAndNotify(await fetchFinanceData(api));
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.loadError));
    }
  }, [api, initialData, onError, remoteEnabled, setFinanceDataAndNotify]);

  const setNoticeAndStep = useCallback(
    (message: string, step: string): void => {
      onNotice(message);
      setFinanceWorkflowStep(step);
    },
    [onNotice]
  );

  const submitFeePlan = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);

    const errors: FieldErrors = {};
    if (!feePlanForm.schoolYearId) errors.schoolYearId = UI_MESSAGES.validationError;
    if (!feePlanForm.levelId) errors.levelId = UI_MESSAGES.validationError;
    if (!feePlanForm.label.trim()) errors.label = UI_MESSAGES.validationError;
    if (!feePlanForm.currency.trim()) errors.currency = UI_MESSAGES.validationError;
    if (feePlanForm.currency.trim() && feePlanForm.currency.trim().length !== 3) {
      errors.currency = UI_MESSAGES.validationError;
    }

    const totalAmount = Number(feePlanForm.totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      errors.totalAmount = UI_MESSAGES.validationError;
    }
    setFeePlanErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("feePlans");
      return;
    }
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }

    try {
      await createFeePlan(api, {
        schoolYearId: feePlanForm.schoolYearId,
        levelId: feePlanForm.levelId,
        label: feePlanForm.label.trim(),
        totalAmount,
        currency: feePlanForm.currency.trim().toUpperCase()
      });
      setFeePlanErrors({});
      setNoticeAndStep(UI_MESSAGES.created, "feePlans");
      setFeePlanForm((previous) => ({ ...previous, label: "", totalAmount: "" }));
      await loadFinance();
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
    }
  };

  const submitInvoice = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);

    const errors: FieldErrors = {};
    if (!invoiceForm.studentId) errors.studentId = UI_MESSAGES.validationError;
    if (!invoiceForm.schoolYearId) errors.schoolYearId = UI_MESSAGES.validationError;
    if (!invoiceForm.feePlanId && !invoiceForm.amountDue.trim()) {
      errors.amountDue = UI_MESSAGES.validationError;
    }
    if (!invoiceForm.dueDate) {
      errors.dueDate = UI_MESSAGES.validationError;
    } else if (!isoDatePattern.test(invoiceForm.dueDate)) {
      errors.dueDate = UI_MESSAGES.validationError;
    }

    const payload: Record<string, unknown> = {
      studentId: invoiceForm.studentId,
      schoolYearId: invoiceForm.schoolYearId,
      dueDate: invoiceForm.dueDate || undefined
    };

    if (invoiceForm.feePlanId) {
      payload.feePlanId = invoiceForm.feePlanId;
    }

    if (invoiceForm.amountDue.trim()) {
      const amountDue = Number(invoiceForm.amountDue);
      if (!Number.isFinite(amountDue) || amountDue <= 0) {
        errors.amountDue = UI_MESSAGES.validationError;
      } else {
        payload.amountDue = amountDue;
      }
    }
    setInvoiceErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("invoices");
      return;
    }
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }

    try {
      await createInvoice(api, payload);
      setInvoiceErrors({});
      setNoticeAndStep(UI_MESSAGES.created, "invoices");
      setInvoiceForm((previous) => ({ ...previous, feePlanId: "", amountDue: "", dueDate: "" }));
      await loadFinance();
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
    }
  };

  const voidInvoice = async (id: string): Promise<void> => {
    if (!window.confirm(translateUiString(language, UI_MESSAGES.invoiceCancelConfirm))) return;
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }

    try {
      await updateInvoiceStatus(api, id, "VOID");
      onNotice(UI_MESSAGES.invoiceCancelled);
      await loadFinance();
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
    }
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);

    const errors: FieldErrors = {};
    if (!paymentForm.invoiceId) errors.invoiceId = UI_MESSAGES.validationError;
    if (!paymentForm.paymentMethod) errors.paymentMethod = UI_MESSAGES.validationError;
    if (!paymentForm.paidAt) {
      errors.paidAt = UI_MESSAGES.validationError;
    } else if (!isoDatePattern.test(paymentForm.paidAt)) {
      errors.paidAt = UI_MESSAGES.validationError;
    }

    const paidAmount = Number(paymentForm.paidAmount);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      errors.paidAmount = UI_MESSAGES.validationError;
    }
    const selectedInvoice = financeData.invoices.find((item) => item.id === paymentForm.invoiceId);
    if (selectedInvoice && paidAmount > selectedInvoice.remainingAmount) {
      errors.paidAmount = UI_MESSAGES.validationError;
    }
    setPaymentErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("payments");
      return;
    }
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.previewNotPersisted);
      return;
    }

    try {
      await createPayment(api, {
        invoiceId: paymentForm.invoiceId,
        paidAmount,
        paymentMethod: paymentForm.paymentMethod,
        paidAt: paymentForm.paidAt ? new Date(paymentForm.paidAt).toISOString() : undefined,
        referenceExternal: paymentForm.referenceExternal || undefined
      });
      setPaymentErrors({});
      setNoticeAndStep(UI_MESSAGES.paymentSaved, "payments");
      setPaymentForm((previous) => ({ ...previous, paidAmount: "", referenceExternal: "" }));
      await loadFinance();
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
    }
  };

  const openReceipt = async (paymentId: string): Promise<void> => {
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.receiptUnavailable);
      return;
    }

    try {
      const pdfDataUrl = await fetchPaymentReceipt(api, paymentId);
      setReceiptPdfUrl(pdfDataUrl);
      window.open(pdfDataUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.downloadError));
    }
  };

  const initiateOnlinePayment = async (invoiceId: string): Promise<void> => {
    onError(null);
    if (!invoiceId) {
      setPaymentErrors({ invoiceId: UI_MESSAGES.validationError });
      focusFirstInlineErrorField("payments");
      return;
    }
    if (!remoteEnabled) {
      onNotice(UI_MESSAGES.onlinePaymentNeedsApi);
      return;
    }

    try {
      const attempt = await initiatePaydunyaPayment(api, invoiceId);
      setNoticeAndStep(UI_MESSAGES.onlinePaymentPending, "payments");
      if (attempt.checkoutUrl) {
        window.open(attempt.checkoutUrl, "_blank", "noopener,noreferrer");
      }
      await loadFinance();
    } catch (error) {
      onError(toUiErrorMessage(error, UI_MESSAGES.saveError));
    }
  };

  const financeSteps = useMemo(
    () => [
      { id: "overview", title: "Pilotage", hint: "Suivre le recouvrement.", done: !!financeData.recovery },
      { id: "feePlans", title: "Plans de frais", hint: "Définir les plans de frais.", done: financeData.feePlans.length > 0 },
      { id: "invoices", title: "Factures", hint: "Générer les factures élèves.", done: financeData.invoices.length > 0 },
      { id: "payments", title: "Paiements", hint: "Enregistrer les encaissements.", done: financeData.payments.length > 0 }
    ],
    [financeData.feePlans.length, financeData.invoices.length, financeData.payments.length, financeData.recovery]
  );

  return {
    feePlanErrors,
    feePlanForm,
    financeData,
    financeSteps,
    financeWorkflowStep,
    initiateOnlinePayment,
    invoiceErrors,
    invoiceForm,
    loadFinance,
    openReceipt,
    paymentErrors,
    paymentForm,
    receiptPdfUrl,
    setFeePlanForm,
    setFinanceWorkflowStep,
    setInvoiceForm,
    setPaymentForm,
    submitFeePlan,
    submitInvoice,
    submitPayment,
    voidInvoice
  };
};
