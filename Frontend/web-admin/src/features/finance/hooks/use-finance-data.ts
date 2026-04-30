import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type { FieldErrors, Level, SchoolYear, Student } from "../../../shared/types/app";
import {
  createFeePlan,
  createInvoice,
  createPayment,
  fetchFinanceData,
  fetchPaymentReceipt,
  removeFeePlan,
  removeInvoice
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
      onError(error instanceof Error ? error.message : "Erreur de chargement de la comptabilite.");
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
    if (!feePlanForm.schoolYearId) errors.schoolYearId = "Annee scolaire requise.";
    if (!feePlanForm.levelId) errors.levelId = "Niveau requis.";
    if (!feePlanForm.label.trim()) errors.label = "Libelle requis.";
    if (!feePlanForm.currency.trim()) errors.currency = "Devise requise.";
    if (feePlanForm.currency.trim() && feePlanForm.currency.trim().length !== 3) {
      errors.currency = "Code devise sur 3 lettres (ex: CFA, affiche F CFA).";
    }

    const totalAmount = Number(feePlanForm.totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      errors.totalAmount = "Le montant total doit etre > 0.";
    }
    setFeePlanErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("feePlans");
      return;
    }
    if (!remoteEnabled) {
      onNotice("Mode apercu local : plan de frais non persiste.");
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
      setNoticeAndStep("Plan tarifaire cree.", "feePlans");
      setFeePlanForm((previous) => ({ ...previous, label: "", totalAmount: "" }));
      await loadFinance();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur de creation du plan tarifaire.");
    }
  };

  const deleteFeePlan = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer ce plan de frais ?")) return;
    if (!remoteEnabled) {
      onNotice("Mode apercu local : suppression non persistee.");
      return;
    }

    try {
      await removeFeePlan(api, id);
      onNotice("Plan tarifaire supprime.");
      await loadFinance();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur de suppression du plan tarifaire.");
    }
  };

  const submitInvoice = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);

    const errors: FieldErrors = {};
    if (!invoiceForm.studentId) errors.studentId = "Eleve requis.";
    if (!invoiceForm.schoolYearId) errors.schoolYearId = "Annee scolaire requise.";
    if (!invoiceForm.feePlanId && !invoiceForm.amountDue.trim()) {
      errors.amountDue = "Saisir un montant ou choisir un plan de frais.";
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
      if (!Number.isFinite(amountDue) || amountDue < 0) {
        errors.amountDue = "Le montant doit etre >= 0.";
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
      onNotice("Mode apercu local : facture non persistee.");
      return;
    }

    try {
      await createInvoice(api, payload);
      setInvoiceErrors({});
      setNoticeAndStep("Facture creee.", "invoices");
      setInvoiceForm((previous) => ({ ...previous, feePlanId: "", amountDue: "", dueDate: "" }));
      await loadFinance();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur de creation de facture.");
    }
  };

  const deleteInvoice = async (id: string): Promise<void> => {
    if (!window.confirm("Supprimer cette facture ?")) return;
    if (!remoteEnabled) {
      onNotice("Mode apercu local : suppression non persistee.");
      return;
    }

    try {
      await removeInvoice(api, id);
      onNotice("Facture supprimee.");
      await loadFinance();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur de suppression de facture.");
    }
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    onError(null);

    const errors: FieldErrors = {};
    if (!paymentForm.invoiceId) errors.invoiceId = "Facture requise.";
    if (!paymentForm.paymentMethod) errors.paymentMethod = "Mode de paiement requis.";

    const paidAmount = Number(paymentForm.paidAmount);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      errors.paidAmount = "Le montant verse doit etre > 0.";
    }
    setPaymentErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField("payments");
      return;
    }
    if (!remoteEnabled) {
      onNotice("Mode apercu local : paiement non persiste.");
      return;
    }

    try {
      await createPayment(api, {
        invoiceId: paymentForm.invoiceId,
        paidAmount,
        paymentMethod: paymentForm.paymentMethod,
        referenceExternal: paymentForm.referenceExternal || undefined
      });
      setPaymentErrors({});
      setNoticeAndStep("Paiement enregistre.", "payments");
      setPaymentForm((previous) => ({ ...previous, paidAmount: "", referenceExternal: "" }));
      await loadFinance();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur d'enregistrement du paiement.");
    }
  };

  const openReceipt = async (paymentId: string): Promise<void> => {
    if (!remoteEnabled) {
      onNotice("Mode apercu local : recu PDF indisponible.");
      return;
    }

    try {
      const pdfDataUrl = await fetchPaymentReceipt(api, paymentId);
      setReceiptPdfUrl(pdfDataUrl);
      window.open(pdfDataUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erreur d'ouverture du recu.");
    }
  };

  const financeSteps = useMemo(
    () => [
      { id: "overview", title: "Pilotage", hint: "Suivre recouvrement et caisses.", done: !!financeData.recovery },
      { id: "feePlans", title: "Plans de frais", hint: "Definir les plans de frais.", done: financeData.feePlans.length > 0 },
      { id: "invoices", title: "Factures", hint: "Generer les factures eleves.", done: financeData.invoices.length > 0 },
      { id: "payments", title: "Paiements", hint: "Enregistrer les encaissements.", done: financeData.payments.length > 0 }
    ],
    [financeData.feePlans.length, financeData.invoices.length, financeData.payments.length, financeData.recovery]
  );

  return {
    deleteFeePlan,
    deleteInvoice,
    feePlanErrors,
    feePlanForm,
    financeData,
    financeSteps,
    financeWorkflowStep,
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
    submitPayment
  };
};
