import { useState, type JSX } from "react";

import { WorkflowGuide } from "../../shared/components/workflow-guide";
import type {
  AcademicTrack,
  FieldErrors,
  Level,
  SchoolYear,
  Student
} from "../../shared/types/app";
import { useFinanceData } from "./hooks/use-finance-data";
import type { FinanceApiClient, FinanceData } from "./types/finance";
import { useI18n } from "../../shared/i18n-context";
import { ResponsiveForm } from "../../shared/components/responsive-form";
import { ResponsiveDataTable } from "../../shared/components/responsive-data-table";
import {
  ResponsiveKpiCard,
  ResponsiveKpiGrid
} from "../../shared/components/responsive-dashboard";
import { RowActionMenu } from "../../shared/components/row-action-menu";
import { WorkflowContextBar } from "../../shared/components/responsive-workflow";

type FinanceScreenProps = {
  api: FinanceApiClient;
  initialData: FinanceData;
  schoolYears: SchoolYear[];
  levels: Level[];
  students: Student[];
  locale: string;
  defaultCurrency: string;
  remoteEnabled?: boolean;
  onFinanceDataChange?: (data: FinanceData) => void;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
};

const CHANNEL_LABELS: Record<string, string> = {
  CASH: "Espèces",
  MOBILE_MONEY: "Mobile money",
  BANK: "Virement bancaire",
  OTHER: "Autre"
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  OPEN: "Émise",
  PARTIAL: "Partiellement payée",
  PAID: "Payée",
  OVERDUE: "En retard",
  VOID: "Annulée"
};

const renderFieldError = (
  errors: FieldErrors,
  key: string,
  translate: (source: string) => string
): JSX.Element | null =>
  errors[key] ? (
    <span className="field-error" role="alert">
      {translate(errors[key])}
    </span>
  ) : null;

const formatLookupLabel = (map: Record<string, string>, value?: string): string => {
  const normalized = (value || "").trim().toUpperCase();
  return map[normalized] || value || "-";
};

const formatInvoiceStatusLabel = (value?: string): string => formatLookupLabel(INVOICE_STATUS_LABELS, value);
const formatChannelLabel = (value?: string): string => formatLookupLabel(CHANNEL_LABELS, value);
const formatAcademicTrackLabel = (value?: AcademicTrack): string =>
  value === "ARABOPHONE" ? "Arabophone" : "Francophone";

const isOverdueInvoice = (dueDate: string | undefined, status: string): boolean => {
  if (!dueDate || ["PAID", "VOID"].includes(status)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(dueDate);
  deadline.setHours(0, 0, 0, 0);
  return deadline < today;
};

const shouldDisplayOverdueInvoiceStatus = (dueDate: string | undefined, status: string): boolean =>
  ["DRAFT", "OPEN"].includes(status) && isOverdueInvoice(dueDate, status);

export function FinanceScreen({
  api,
  initialData,
  schoolYears,
  levels,
  students,
  locale,
  defaultCurrency,
  remoteEnabled = true,
  onFinanceDataChange,
  onError,
  onNotice
}: FinanceScreenProps): JSX.Element {
  const { t: tr } = useI18n();
  const [openFeePlanActionMenuId, setOpenFeePlanActionMenuId] = useState<string | null>(null);
  const [openInvoiceActionMenuId, setOpenInvoiceActionMenuId] = useState<string | null>(null);
  const [openPaymentActionMenuId, setOpenPaymentActionMenuId] = useState<string | null>(null);
  const {
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
  } = useFinanceData({
    api,
    initialData,
    schoolYears,
    levels,
    students,
    defaultCurrency,
    remoteEnabled,
    onFinanceDataChange,
    onError,
    onNotice
  });

  const { feePlans, invoices, payments, recovery } = financeData;
  const schoolYearById = new Map(schoolYears.map((item) => [item.id, item]));
  const studentById = new Map(students.map((item) => [item.id, item]));
  const levelById = new Map(levels.map((item) => [item.id, item]));
  const formatAmount = (value: number): string =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  const formatCurrencyLabel = (currency?: string): string => {
    const normalized = (currency || defaultCurrency).trim().toUpperCase();
    return normalized === "XOF" || normalized === "CFA" ? "F CFA" : normalized;
  };
  const formatMoney = (value: number, currency?: string): string =>
    `${formatAmount(value)} ${formatCurrencyLabel(currency)}`;

  const scrollToFinance = (stepId: string): void => {
    setFinanceWorkflowStep(stepId);
    const targetByStep: Record<string, string> = {
      overview: "finance-overview",
      feePlans: "finance-fee-plans",
      invoices: "finance-invoices",
      payments: "finance-payments"
    };
    const target = targetByStep[stepId];
    if (!target) return;
    window.setTimeout(() => {
      const targetElement = document.getElementById(target);
      if (typeof targetElement?.scrollIntoView === "function") {
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 0);
  };

  const openInvoicesCount = invoices.filter((item) => item.status !== "PAID").length;
  const paidInvoicesCount = invoices.filter((item) => item.status === "PAID").length;
  const overdueInvoicesCount = invoices.filter((item) => isOverdueInvoice(item.dueDate, item.status)).length;
  const selectedPaymentInvoice = invoices.find((item) => item.id === paymentForm.invoiceId);
  const invoiceStatusLabel = (item: { dueDate?: string; status?: string }): string =>
    shouldDisplayOverdueInvoiceStatus(item.dueDate, item.status || "")
      ? "En retard"
      : formatInvoiceStatusLabel(item.status);
  const planInvoiceCount = (feePlanId: string): number => invoices.filter((item) => item.feePlanId === feePlanId).length;

  return (
    <div className="finance-v3-shell module-v3-shell">
      <header className="finance-mobile-heading">
        <h1>{tr("Comptabilité")}</h1>
        <p>{tr("Suivez le recouvrement, les factures et les paiements de l’établissement.")}</p>
      </header>

      <WorkflowGuide
        className="module-v3-workflow"
        title={tr("Comptabilité")}
        steps={financeSteps}
        activeStepId={financeWorkflowStep}
        onStepChange={scrollToFinance}
      >
      {financeWorkflowStep === "payments" ? (
        <WorkflowContextBar
          title="Contexte actif"
          items={[
            { label: "Facture", value: selectedPaymentInvoice?.invoiceNo || tr("À sélectionner") },
            { label: "Élève", value: selectedPaymentInvoice?.studentName || "-" },
            {
              label: "Statut",
              value: selectedPaymentInvoice ? tr(invoiceStatusLabel(selectedPaymentInvoice)) : "-"
            },
            {
              label: "Reste à payer",
              value: selectedPaymentInvoice ? formatMoney(selectedPaymentInvoice.remainingAmount) : "-"
            }
          ]}
          actionLabel="Voir les factures"
          onAction={() => scrollToFinance("invoices")}
        />
      ) : null}
      {financeWorkflowStep === "overview" ? (
        <section className="panel table-panel workflow-section module-modern module-overview-shell finance-screen-shell">
          <div className="table-header">
            <div>
              <p className="section-kicker">{tr("Recouvrement")}</p>
              <h2>{tr("Console de recouvrement")}</h2>
            </div>
            <span className="module-header-badge">
              {(recovery?.totals.recoveryRatePercent || 0).toFixed(1)}{tr("% recouvrement")}</span>
          </div>
          <p className="section-lead">
            {tr("Suivez les montants facturés, encaissés et restant à recouvrer pour l’année scolaire sélectionnée.")}</p>
          <ResponsiveKpiGrid label={tr("Synthèse du recouvrement")}>
            <ResponsiveKpiCard className="module-overview-card" label={tr("Total facturé")} value={formatMoney(recovery?.totals.amountDue || 0)} hint={tr("Factures émises")} />
            <ResponsiveKpiCard className="module-overview-card" label={tr("Montant encaissé")} value={formatMoney(recovery?.totals.amountPaid || 0)} hint={tr("Paiements confirmés")} tone="positive" />
            <ResponsiveKpiCard className="module-overview-card" label={tr("Reste à recouvrer")} value={formatMoney(recovery?.totals.remainingAmount || 0)} hint={tr("Suivi des impayés")} tone="warning" />
            <ResponsiveKpiCard className="module-overview-card" label={tr("Factures en retard")} value={overdueInvoicesCount} hint={tr("Relances prioritaires")} tone={overdueInvoicesCount > 0 ? "negative" : "neutral"} />
          </ResponsiveKpiGrid>
          <div className="module-inline-strip">
            <span className="module-inline-pill">{tr("Factures ouvertes : ")}{openInvoicesCount}</span>
            <span className="module-inline-pill">
              {tr("Factures payées : ")}{paidInvoicesCount}
            </span>
            <span className="module-inline-pill">
              {tr("Paiements reçus : ")}{payments.length}
            </span>
          </div>
        </section>
      ) : null}

      <section id="finance-overview" data-step-id="overview" className="panel table-panel workflow-section module-modern finance-screen-shell">
        <div className="table-header">
          <div>
            <p className="section-kicker">{tr("Synthèse")}</p>
            <h2>{tr("Synthèse du recouvrement")}</h2>
          </div>
          <span className="module-header-badge">{tr("Pilotage journalier")}</span>
        </div>
        <p className="section-lead">{tr("Suivez la santé financière avant de passer aux opérations de saisie.")}</p>
        <ResponsiveKpiGrid label={tr("Synthèse du recouvrement")} priority="secondary">
          <ResponsiveKpiCard className="metric-card" label={tr("Total dû")} value={formatMoney(recovery?.totals.amountDue || 0)} priority="secondary" />
          <ResponsiveKpiCard className="metric-card" label={tr("Montant encaissé")} value={formatMoney(recovery?.totals.amountPaid || 0)} priority="secondary" tone="positive" />
          <ResponsiveKpiCard className="metric-card" label={tr("Reste à recouvrer")} value={formatMoney(recovery?.totals.remainingAmount || 0)} priority="secondary" tone="warning" />
          <ResponsiveKpiCard className="metric-card" label={tr("Taux de recouvrement")} value={`${(recovery?.totals.recoveryRatePercent || 0).toFixed(2)}%`} priority="secondary" />
          <ResponsiveKpiCard className="metric-card" label={tr("Factures ouvertes")} value={openInvoicesCount} priority="secondary" />
          <ResponsiveKpiCard className="metric-card" label={tr("Factures en retard")} value={overdueInvoicesCount} priority="secondary" tone={overdueInvoicesCount > 0 ? "negative" : "neutral"} />
          <ResponsiveKpiCard className="metric-card" label={tr("Paiements reçus")} value={payments.length} priority="secondary" />
        </ResponsiveKpiGrid>
        <div className="actions">
          <button type="button" className="button-ghost" onClick={() => void loadFinance()}>
            {tr("Recharger la comptabilité")}</button>
          {receiptPdfUrl ? (
            <button
              type="button"
              className="button-ghost"
              onClick={() => window.open(receiptPdfUrl, "_blank", "noopener,noreferrer")}
            >
              {tr("Ouvrir le dernier reçu")}</button>
          ) : null}
        </div>
      </section>

      <section id="finance-fee-plans" data-step-id="feePlans" className="panel editor-panel workflow-section module-modern finance-screen-shell">
        <div className="table-header">
          <div>
            <p className="section-kicker">{tr("Tarification")}</p>
            <h2>{tr("Plans de frais")}</h2>
          </div>
          <span className="module-header-badge">{feePlans.length} {tr("plan(s)")}</span>
        </div>
        <p className="section-lead">{tr("Définissez les frais par année et niveau, puis réutilisez-les pour la facturation.")}</p>
        <ResponsiveForm className="form-grid module-form" formTitle={tr("Créer un plan de frais")} onSubmit={(event) => void submitFeePlan(event)}>
          <label>
            {tr("Année scolaire *")}<select
              value={feePlanForm.schoolYearId}
              onChange={(event) => setFeePlanForm((previous) => ({ ...previous, schoolYearId: event.target.value }))}
              required
            >
              <option value="">{tr("Choisir...")}</option>
              {schoolYears.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code}
                </option>
              ))}
            </select>
            {renderFieldError(feePlanErrors, "schoolYearId", tr)}
          </label>
          <label>
            {tr("Niveau *")}<select
              value={feePlanForm.levelId}
              onChange={(event) => setFeePlanForm((previous) => ({ ...previous, levelId: event.target.value }))}
              required
            >
              <option value="">{tr("Choisir...")}</option>
              {levels.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.label}
                </option>
              ))}
            </select>
            {renderFieldError(feePlanErrors, "levelId", tr)}
          </label>
          <label>
            {tr("Libellé *")}<input
              value={feePlanForm.label}
              onChange={(event) => setFeePlanForm((previous) => ({ ...previous, label: event.target.value }))}
              required
            />
            {renderFieldError(feePlanErrors, "label", tr)}
          </label>
          <label>
            {tr("Montant total *")}<input
              type="number"
              min={1}
              value={feePlanForm.totalAmount}
              onChange={(event) => setFeePlanForm((previous) => ({ ...previous, totalAmount: event.target.value }))}
              required
            />
            {renderFieldError(feePlanErrors, "totalAmount", tr)}
          </label>
          <label>
            {tr("Devise *")}<input
              maxLength={3}
              value={feePlanForm.currency}
              onChange={(event) =>
                setFeePlanForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))
              }
            />
            {renderFieldError(feePlanErrors, "currency", tr)}
          </label>
          <button type="submit">{tr("Créer le plan de frais")}</button>
        </ResponsiveForm>
      </section>

      <section data-step-id="feePlans" className="panel table-panel workflow-section module-modern finance-screen-shell">
        <div className="table-header">
          <div>
            <p className="section-kicker">{tr("Catalogue")}</p>
            <h2>{tr("Liste des plans de frais")}</h2>
          </div>
          <span className="module-header-badge">{feePlans.length} {tr("plan(s)")}</span>
        </div>
        <ResponsiveDataTable label={tr("Liste des plans de frais")}>
          <table data-responsive-table="true">
            <thead>
              <tr>
                <th>{tr("Libellé")}</th>
                <th>{tr("Année scolaire")}</th>
                <th>{tr("Niveau")}</th>
                <th>{tr("Cursus")}</th>
                <th>{tr("Montant total")}</th>
                <th>{tr("Devise")}</th>
                <th>{tr("Statut")}</th>
                <th aria-label={tr("Actions")}></th>
              </tr>
            </thead>
            <tbody>
              {feePlans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-row">
                    {tr("Aucun plan de frais.")}</td>
                </tr>
              ) : (
                feePlans.map((item) => {
                  const usageCount = planInvoiceCount(item.id);
                  return (
                    <tr key={item.id}>
                      <td data-label={tr("Libellé")}>{item.label}</td>
                      <td data-label={tr("Année scolaire")}>{schoolYearById.get(item.schoolYearId)?.code || "-"}</td>
                      <td data-label={tr("Niveau")}>{levelById.get(item.levelId)?.label || "-"}</td>
                      <td data-label={tr("Cursus")}>{tr("Selon inscription")}</td>
                      <td data-label={tr("Montant total")}>{formatMoney(item.totalAmount, item.currency)}</td>
                      <td data-label={tr("Devise")}>{formatCurrencyLabel(item.currency)}</td>
                      <td data-label={tr("Statut")}><span className="status-pill is-success">{tr("Actif")}</span></td>
                      <td data-label={tr("Actions")}>
                          <RowActionMenu
                            label={`${tr("Informations plan")} ${item.label}`}
                            open={openFeePlanActionMenuId === item.id}
                            onOpenChange={(open) => setOpenFeePlanActionMenuId(open ? item.id : null)}
                          >
                              <span className="v3-action-menu-note">
                                {usageCount > 0 ? `${usageCount} ${tr("facture(s) liée(s)")}` : tr("Plan protégé")}
                              </span>
                          </RowActionMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </ResponsiveDataTable>
      </section>

      <section id="finance-invoices" data-step-id="invoices" className="panel editor-panel workflow-section module-modern finance-screen-shell">
        <div className="table-header">
          <div>
            <p className="section-kicker">{tr("Facturation")}</p>
            <h2>{tr("Factures")}</h2>
          </div>
          <span className="module-header-badge">{invoices.length} {tr("facture(s)")}</span>
        </div>
        <p className="section-lead">{tr("Associez un élève, une année et un montant dû pour générer une facture claire.")}</p>
        <ResponsiveForm className="form-grid module-form" formTitle={tr("Créer une facture")} onSubmit={(event) => void submitInvoice(event)}>
          <label>
            {tr("Élève *")}<select
              value={invoiceForm.studentId}
              onChange={(event) => setInvoiceForm((previous) => ({ ...previous, studentId: event.target.value }))}
              required
            >
              <option value="">{tr("Choisir...")}</option>
              {students.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.matricule} - {item.firstName} {item.lastName}
                </option>
              ))}
            </select>
            {renderFieldError(invoiceErrors, "studentId", tr)}
          </label>
          <label>
            {tr("Année scolaire *")}<select
              value={invoiceForm.schoolYearId}
              onChange={(event) => setInvoiceForm((previous) => ({ ...previous, schoolYearId: event.target.value }))}
              required
            >
              <option value="">{tr("Choisir...")}</option>
              {schoolYears.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code}
                </option>
              ))}
            </select>
            {renderFieldError(invoiceErrors, "schoolYearId", tr)}
          </label>
          <label>
            {tr("Plan de frais (optionnel)")}<select
              value={invoiceForm.feePlanId}
              onChange={(event) => setInvoiceForm((previous) => ({ ...previous, feePlanId: event.target.value }))}
            >
              <option value="">{tr("Aucun (montant manuel)")}</option>
              {feePlans.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            {renderFieldError(invoiceErrors, "feePlanId", tr)}
          </label>
          <label>
            {tr("Montant dû si saisie manuelle")}<input
              type="number"
              min={1}
              value={invoiceForm.amountDue}
              onChange={(event) => setInvoiceForm((previous) => ({ ...previous, amountDue: event.target.value }))}
              placeholder={tr("Requis si aucun plan de frais")}
            />
            {renderFieldError(invoiceErrors, "amountDue", tr)}
          </label>
          <label>
            {tr("Date d’échéance *")}<input
              type="text"
              inputMode="numeric"
              placeholder={tr("aaaa-mm-jj")}
              value={invoiceForm.dueDate}
              onChange={(event) => setInvoiceForm((previous) => ({ ...previous, dueDate: event.target.value }))}
              required
            />
            {renderFieldError(invoiceErrors, "dueDate", tr)}
          </label>
          <button type="submit">{tr("Créer la facture")}</button>
        </ResponsiveForm>
      </section>

      <section data-step-id="invoices" className="panel table-panel workflow-section module-modern finance-screen-shell">
        <div className="table-header">
          <div>
            <p className="section-kicker">{tr("Registre")}</p>
            <h2>{tr("Liste des factures")}</h2>
          </div>
          <span className="module-header-badge">{invoices.length} {tr("facture(s)")}</span>
        </div>
        <ResponsiveDataTable label={tr("Factures")}>
          <table data-responsive-table="true">
            <thead>
              <tr>
                <th>{tr("Numéro")}</th>
                <th>{tr("Élève")}</th>
                <th>{tr("Classe / cursus")}</th>
                <th>{tr("Montant dû")}</th>
                <th>{tr("Payé")}</th>
                <th>{tr("Reste")}</th>
                <th>{tr("Date d’échéance")}</th>
                <th>{tr("Statut")}</th>
                <th aria-label={tr("Actions")}></th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-row">
                    {tr("Aucune facture.")}</td>
                </tr>
              ) : (
                invoices.map((item) => (
                  <tr key={item.id}>
                    <td data-label={tr("Numéro")}>{item.invoiceNo}</td>
                    <td data-label={tr("Élève")}>{item.studentName || studentById.get(item.studentId)?.matricule || "-"}</td>
                    <td data-label={tr("Classe / cursus")}>
                      {[item.primaryClassLabel, item.primaryTrack ? tr(formatAcademicTrackLabel(item.primaryTrack)) : undefined]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </td>
                    <td data-label={tr("Montant dû")}>{formatMoney(item.amountDue)}</td>
                    <td data-label={tr("Payé")}>{formatMoney(item.amountPaid)}</td>
                    <td data-label={tr("Reste")}>{formatMoney(item.remainingAmount)}</td>
                    <td data-label={tr("Date d’échéance")}>{item.dueDate ? new Date(item.dueDate).toLocaleDateString(locale) : "-"}</td>
                    <td data-label={tr("Statut")}>
                      <span className={`status-pill ${item.status === "PAID" ? "is-success" : "is-muted"}`}>
                        {invoiceStatusLabel(item)}
                      </span>
                    </td>
                    <td data-label={tr("Actions")}>
                      {item.status === "VOID" ? (
                        <span className="finance-safe-note">{tr("Annulée")}</span>
                      ) : item.remainingAmount <= 0 ? (
                        <span className="finance-safe-note">{tr("Soldée")}</span>
                      ) : (
                        <RowActionMenu
                          label={`${tr("Actions facture")} ${item.invoiceNo}`}
                          open={openInvoiceActionMenuId === item.id}
                          onOpenChange={(open) => setOpenInvoiceActionMenuId(open ? item.id : null)}
                        >
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenInvoiceActionMenuId(null);
                                  setFinanceWorkflowStep("payments");
                                  setPaymentForm((previous) => ({ ...previous, invoiceId: item.id }));
                                }}
                              >
                                {tr("Enregistrer paiement")}</button>
                              {item.amountPaid <= 0 ? (
                                <button
                                  type="button"
                                  className="is-danger"
                                  onClick={() => {
                                    setOpenInvoiceActionMenuId(null);
                                    void voidInvoice(item.id);
                                  }}
                                >
                                  {tr("Annuler")}</button>
                              ) : null}
                        </RowActionMenu>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ResponsiveDataTable>
      </section>

      <section id="finance-payments" data-step-id="payments" className="panel editor-panel workflow-section module-modern finance-screen-shell">
        <div className="table-header">
          <div>
            <p className="section-kicker">{tr("Encaissements")}</p>
            <h2>{tr("Paiements")}</h2>
          </div>
          <span className="module-header-badge">{payments.length} {tr("reçu(s)")}</span>
        </div>
        <p className="section-lead">{tr("Enregistrez chaque encaissement et rattachez-le à la facture correspondante.")}</p>
        <ResponsiveForm className="form-grid module-form" formTitle={tr("Enregistrer un paiement")} onSubmit={(event) => void submitPayment(event)}>
          <label>
            {tr("Facture *")}<select
              value={paymentForm.invoiceId}
              onChange={(event) => setPaymentForm((previous) => ({ ...previous, invoiceId: event.target.value }))}
              required
            >
              <option value="">{tr("Choisir...")}</option>
              {invoices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.invoiceNo} {tr("- reste ")}{formatMoney(item.remainingAmount)}
                </option>
              ))}
            </select>
            {renderFieldError(paymentErrors, "invoiceId", tr)}
          </label>
          <label>
            {tr("Montant versé *")}<input
              type="number"
              min={1}
              max={selectedPaymentInvoice?.remainingAmount}
              value={paymentForm.paidAmount}
              onChange={(event) => setPaymentForm((previous) => ({ ...previous, paidAmount: event.target.value }))}
              required
            />
            {renderFieldError(paymentErrors, "paidAmount", tr)}
          </label>
          <label>
            {tr("Mode de paiement *")}<select
              value={paymentForm.paymentMethod}
              onChange={(event) =>
                setPaymentForm((previous) => ({
                  ...previous,
                  paymentMethod: event.target.value as "CASH" | "MOBILE_MONEY" | "BANK"
                }))
              }
            >
              <option value="CASH">{tr(formatChannelLabel("CASH"))}</option>
              <option value="MOBILE_MONEY">{tr(formatChannelLabel("MOBILE_MONEY"))}</option>
              <option value="BANK">{tr(formatChannelLabel("BANK"))}</option>
            </select>
            {renderFieldError(paymentErrors, "paymentMethod", tr)}
          </label>
          <label>
            {tr("Date de paiement *")}<input
              type="text"
              inputMode="numeric"
              placeholder={tr("aaaa-mm-jj")}
              value={paymentForm.paidAt}
              onChange={(event) => setPaymentForm((previous) => ({ ...previous, paidAt: event.target.value }))}
              required
            />
            {renderFieldError(paymentErrors, "paidAt", tr)}
          </label>
          <label>
            {tr("Référence externe")}<input
              value={paymentForm.referenceExternal}
              onChange={(event) => setPaymentForm((previous) => ({ ...previous, referenceExternal: event.target.value }))}
            />
          </label>
          <div className="finance-payment-context">
            <strong>{tr("Reste à payer")}</strong>
            <span>{selectedPaymentInvoice ? formatMoney(selectedPaymentInvoice.remainingAmount) : "-"}</span>
          </div>
          <div className="actions form-grid-span-full finance-action-grid">
            <button type="submit">{tr("Enregistrer le paiement")}</button>
            <button
              type="button"
              className="button-ghost"
              onClick={() => void initiateOnlinePayment(paymentForm.invoiceId)}
              disabled={!remoteEnabled || !paymentForm.invoiceId || selectedPaymentInvoice?.remainingAmount === 0}
            >
              {tr("Paiement en ligne PayDunya")}</button>
          </div>
        </ResponsiveForm>
      </section>

      <section data-step-id="payments" className="panel table-panel workflow-section module-modern finance-screen-shell">
        <div className="table-header">
          <div>
            <p className="section-kicker">{tr("Historique")}</p>
            <h2>{tr("Historique des paiements")}</h2>
          </div>
          <span className="module-header-badge">{payments.length} {tr("opération(s)")}</span>
        </div>
        <ResponsiveDataTable label={tr("Paiements")}>
          <table data-responsive-table="true">
            <thead>
              <tr>
                <th>{tr("Reçu")}</th>
                <th>{tr("Facture")}</th>
                <th>{tr("Élève")}</th>
                <th>{tr("Montant")}</th>
                <th>{tr("Mode")}</th>
                <th>{tr("Référence")}</th>
                <th>{tr("Date")}</th>
                <th>{tr("Statut")}</th>
                <th aria-label={tr("Actions")}></th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-row">
                    {tr("Aucun paiement.")}</td>
                </tr>
              ) : (
                payments.map((item) => (
                  <tr key={item.id}>
                    <td data-label={tr("Reçu")}>{item.receiptNo}</td>
                    <td data-label={tr("Facture")}>{item.invoiceNo || "-"}</td>
                    <td data-label={tr("Élève")}>{item.studentName || "-"}</td>
                    <td data-label={tr("Montant")}>{formatMoney(item.paidAmount)}</td>
                    <td data-label={tr("Mode")}>{tr(formatChannelLabel(item.paymentMethod))}</td>
                    <td data-label={tr("Référence")}>{item.referenceExternal || "-"}</td>
                    <td data-label={tr("Date")}>{new Date(item.paidAt).toLocaleString(locale)}</td>
                    <td data-label={tr("Statut")}><span className="status-pill is-success">{tr("Enregistré")}</span></td>
                    <td data-label={tr("Actions")}>
                      {remoteEnabled ? (
                        <RowActionMenu
                          label={`${tr("Actions paiement")} ${item.receiptNo}`}
                          open={openPaymentActionMenuId === item.id}
                          onOpenChange={(open) => setOpenPaymentActionMenuId(open ? item.id : null)}
                        >
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenPaymentActionMenuId(null);
                                  void openReceipt(item.id);
                                }}
                              >
                                {tr("Reçu en PDF")}</button>
                        </RowActionMenu>
                      ) : (
                        <span className="finance-safe-note">{tr("PDF non disponible en aperçu")}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ResponsiveDataTable>
      </section>
      </WorkflowGuide>
    </div>
  );
}
