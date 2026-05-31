import type { JSX } from "react";

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

const renderFieldError = (errors: FieldErrors, key: string): JSX.Element | null =>
  errors[key] ? (
    <span className="field-error" role="alert">
      {errors[key]}
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
    <WorkflowGuide
      title="Comptabilité"
      steps={financeSteps}
      activeStepId={financeWorkflowStep}
      onStepChange={scrollToFinance}
    >
      {financeWorkflowStep === "overview" ? (
        <section className="panel table-panel workflow-section module-modern module-overview-shell finance-screen-shell">
          <div className="table-header">
            <div>
              <p className="section-kicker">Recouvrement</p>
              <h2>Console de recouvrement</h2>
            </div>
            <span className="module-header-badge">
              {(recovery?.totals.recoveryRatePercent || 0).toFixed(1)}% recouvrement
            </span>
          </div>
          <p className="section-lead">
            Suivez les montants facturés, encaissés et restant à recouvrer pour l’année scolaire sélectionnée.
          </p>
          <div className="module-overview-grid">
            <article className="module-overview-card">
              <span>Total facturé</span>
              <strong>{formatMoney(recovery?.totals.amountDue || 0)}</strong>
              <small>Factures émises</small>
            </article>
            <article className="module-overview-card">
              <span>Montant encaissé</span>
              <strong>{formatMoney(recovery?.totals.amountPaid || 0)}</strong>
              <small>Paiements confirmés</small>
            </article>
            <article className="module-overview-card">
              <span>Reste à recouvrer</span>
              <strong>{formatMoney(recovery?.totals.remainingAmount || 0)}</strong>
              <small>Suivi des impayés</small>
            </article>
            <article className="module-overview-card">
              <span>Factures en retard</span>
              <strong>{overdueInvoicesCount}</strong>
              <small>Relances prioritaires</small>
            </article>
          </div>
          <div className="module-inline-strip">
            <span className="module-inline-pill">Factures ouvertes : {openInvoicesCount}</span>
            <span className="module-inline-pill">
              Factures payées : {paidInvoicesCount}
            </span>
            <span className="module-inline-pill">
              Paiements reçus : {payments.length}
            </span>
          </div>
        </section>
      ) : null}

      <section id="finance-overview" data-step-id="overview" className="panel table-panel workflow-section module-modern finance-screen-shell">
        <div className="table-header">
          <div>
            <p className="section-kicker">Synthèse</p>
            <h2>Synthèse du recouvrement</h2>
          </div>
          <span className="module-header-badge">Pilotage journalier</span>
        </div>
        <p className="section-lead">Suivez la santé financière avant de passer aux opérations de saisie.</p>
        <div className="metrics-grid">
          <article className="metric-card">
            <span>Total dû</span>
            <strong>{formatMoney(recovery?.totals.amountDue || 0)}</strong>
          </article>
          <article className="metric-card">
            <span>Montant encaissé</span>
            <strong>{formatMoney(recovery?.totals.amountPaid || 0)}</strong>
          </article>
          <article className="metric-card">
            <span>Reste à recouvrer</span>
            <strong>{formatMoney(recovery?.totals.remainingAmount || 0)}</strong>
          </article>
          <article className="metric-card">
            <span>Taux de recouvrement</span>
            <strong>{(recovery?.totals.recoveryRatePercent || 0).toFixed(2)}%</strong>
          </article>
          <article className="metric-card">
            <span>Factures ouvertes</span>
            <strong>{openInvoicesCount}</strong>
          </article>
          <article className="metric-card">
            <span>Factures en retard</span>
            <strong>{overdueInvoicesCount}</strong>
          </article>
          <article className="metric-card">
            <span>Paiements reçus</span>
            <strong>{payments.length}</strong>
          </article>
        </div>
        <div className="actions">
          <button type="button" className="button-ghost" onClick={() => void loadFinance()}>
            Recharger la comptabilité
          </button>
          {receiptPdfUrl ? (
            <button
              type="button"
              className="button-ghost"
              onClick={() => window.open(receiptPdfUrl, "_blank", "noopener,noreferrer")}
            >
              Ouvrir le dernier reçu
            </button>
          ) : null}
        </div>
      </section>

      <section id="finance-fee-plans" data-step-id="feePlans" className="panel editor-panel workflow-section module-modern finance-screen-shell">
        <div className="table-header">
          <div>
            <p className="section-kicker">Tarification</p>
            <h2>Plans de frais</h2>
          </div>
          <span className="module-header-badge">{feePlans.length} plan(s)</span>
        </div>
        <p className="section-lead">Définissez les frais par année et niveau, puis réutilisez-les pour la facturation.</p>
        <form className="form-grid module-form" onSubmit={(event) => void submitFeePlan(event)}>
          <label>
            Année scolaire *
            <select
              value={feePlanForm.schoolYearId}
              onChange={(event) => setFeePlanForm((previous) => ({ ...previous, schoolYearId: event.target.value }))}
              required
            >
              <option value="">Choisir...</option>
              {schoolYears.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code}
                </option>
              ))}
            </select>
            {renderFieldError(feePlanErrors, "schoolYearId")}
          </label>
          <label>
            Niveau *
            <select
              value={feePlanForm.levelId}
              onChange={(event) => setFeePlanForm((previous) => ({ ...previous, levelId: event.target.value }))}
              required
            >
              <option value="">Choisir...</option>
              {levels.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.label}
                </option>
              ))}
            </select>
            {renderFieldError(feePlanErrors, "levelId")}
          </label>
          <label>
            Libellé *
            <input
              value={feePlanForm.label}
              onChange={(event) => setFeePlanForm((previous) => ({ ...previous, label: event.target.value }))}
              required
            />
            {renderFieldError(feePlanErrors, "label")}
          </label>
          <label>
            Montant total *
            <input
              type="number"
              min={1}
              value={feePlanForm.totalAmount}
              onChange={(event) => setFeePlanForm((previous) => ({ ...previous, totalAmount: event.target.value }))}
              required
            />
            {renderFieldError(feePlanErrors, "totalAmount")}
          </label>
          <label>
            Devise *
            <input
              maxLength={3}
              value={feePlanForm.currency}
              onChange={(event) =>
                setFeePlanForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))
              }
            />
            {renderFieldError(feePlanErrors, "currency")}
          </label>
          <button type="submit">Créer le plan de frais</button>
        </form>
      </section>

      <section data-step-id="feePlans" className="panel table-panel workflow-section module-modern finance-screen-shell">
        <div className="table-header">
          <div>
            <p className="section-kicker">Catalogue</p>
            <h2>Liste des plans de frais</h2>
          </div>
          <span className="module-header-badge">{feePlans.length} plan(s)</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Libellé</th>
                <th>Année scolaire</th>
                <th>Niveau</th>
                <th>Cursus</th>
                <th>Montant total</th>
                <th>Devise</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {feePlans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-row">
                    Aucun plan de frais.
                  </td>
                </tr>
              ) : (
                feePlans.map((item) => {
                  const usageCount = planInvoiceCount(item.id);
                  return (
                    <tr key={item.id}>
                      <td>{item.label}</td>
                      <td>{schoolYearById.get(item.schoolYearId)?.code || "-"}</td>
                      <td>{levelById.get(item.levelId)?.label || "-"}</td>
                      <td>Selon inscription</td>
                      <td>{formatMoney(item.totalAmount, item.currency)}</td>
                      <td>{formatCurrencyLabel(item.currency)}</td>
                      <td><span className="status-pill is-success">Actif</span></td>
                      <td>
                        {usageCount > 0 ? (
                          <span className="finance-safe-note">{usageCount} facture(s) liée(s)</span>
                        ) : (
                          <span className="finance-safe-note">Protégé</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="finance-invoices" data-step-id="invoices" className="panel editor-panel workflow-section module-modern finance-screen-shell">
        <div className="table-header">
          <div>
            <p className="section-kicker">Facturation</p>
            <h2>Factures</h2>
          </div>
          <span className="module-header-badge">{invoices.length} facture(s)</span>
        </div>
        <p className="section-lead">Associez un élève, une année et un montant dû pour générer une facture claire.</p>
        <form className="form-grid module-form" onSubmit={(event) => void submitInvoice(event)}>
          <label>
            Élève *
            <select
              value={invoiceForm.studentId}
              onChange={(event) => setInvoiceForm((previous) => ({ ...previous, studentId: event.target.value }))}
              required
            >
              <option value="">Choisir...</option>
              {students.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.matricule} - {item.firstName} {item.lastName}
                </option>
              ))}
            </select>
            {renderFieldError(invoiceErrors, "studentId")}
          </label>
          <label>
            Année scolaire *
            <select
              value={invoiceForm.schoolYearId}
              onChange={(event) => setInvoiceForm((previous) => ({ ...previous, schoolYearId: event.target.value }))}
              required
            >
              <option value="">Choisir...</option>
              {schoolYears.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code}
                </option>
              ))}
            </select>
            {renderFieldError(invoiceErrors, "schoolYearId")}
          </label>
          <label>
            Plan de frais (optionnel)
            <select
              value={invoiceForm.feePlanId}
              onChange={(event) => setInvoiceForm((previous) => ({ ...previous, feePlanId: event.target.value }))}
            >
              <option value="">Aucun (montant manuel)</option>
              {feePlans.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            {renderFieldError(invoiceErrors, "feePlanId")}
          </label>
          <label>
            Montant dû si saisie manuelle
            <input
              type="number"
              min={1}
              value={invoiceForm.amountDue}
              onChange={(event) => setInvoiceForm((previous) => ({ ...previous, amountDue: event.target.value }))}
              placeholder="Requis si aucun plan de frais"
            />
            {renderFieldError(invoiceErrors, "amountDue")}
          </label>
          <label>
            Date d’échéance *
            <input
              type="text"
              inputMode="numeric"
              placeholder="aaaa-mm-jj"
              value={invoiceForm.dueDate}
              onChange={(event) => setInvoiceForm((previous) => ({ ...previous, dueDate: event.target.value }))}
              required
            />
            {renderFieldError(invoiceErrors, "dueDate")}
          </label>
          <button type="submit">Créer la facture</button>
        </form>
      </section>

      <section data-step-id="invoices" className="panel table-panel workflow-section module-modern finance-screen-shell">
        <div className="table-header">
          <div>
            <p className="section-kicker">Registre</p>
            <h2>Liste des factures</h2>
          </div>
          <span className="module-header-badge">{invoices.length} facture(s)</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Élève</th>
                <th>Classe / cursus</th>
                <th>Montant dû</th>
                <th>Payé</th>
                <th>Reste</th>
                <th>Date d’échéance</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-row">
                    Aucune facture.
                  </td>
                </tr>
              ) : (
                invoices.map((item) => (
                  <tr key={item.id}>
                    <td>{item.invoiceNo}</td>
                    <td>{item.studentName || studentById.get(item.studentId)?.matricule || "-"}</td>
                    <td>
                      {[item.primaryClassLabel, item.primaryTrack ? formatAcademicTrackLabel(item.primaryTrack) : undefined]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </td>
                    <td>{formatMoney(item.amountDue)}</td>
                    <td>{formatMoney(item.amountPaid)}</td>
                    <td>{formatMoney(item.remainingAmount)}</td>
                    <td>{item.dueDate ? new Date(item.dueDate).toLocaleDateString(locale) : "-"}</td>
                    <td>
                      <span className={`status-pill ${item.status === "PAID" ? "is-success" : "is-muted"}`}>
                        {invoiceStatusLabel(item)}
                      </span>
                    </td>
                    <td>
                      {item.status === "VOID" ? (
                        <span className="finance-safe-note">Annulée</span>
                      ) : item.remainingAmount <= 0 ? (
                        <span className="finance-safe-note">Soldée</span>
                      ) : item.amountPaid > 0 ? (
                        <button
                          type="button"
                          className="button-ghost"
                          onClick={() => {
                            setFinanceWorkflowStep("payments");
                            setPaymentForm((previous) => ({ ...previous, invoiceId: item.id }));
                          }}
                        >
                          Enregistrer paiement
                        </button>
                      ) : (
                        <button type="button" className="button-danger" onClick={() => void voidInvoice(item.id)}>
                          Annuler
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="finance-payments" data-step-id="payments" className="panel editor-panel workflow-section module-modern finance-screen-shell">
        <div className="table-header">
          <div>
            <p className="section-kicker">Encaissements</p>
            <h2>Paiements</h2>
          </div>
          <span className="module-header-badge">{payments.length} reçu(s)</span>
        </div>
        <p className="section-lead">Enregistrez chaque encaissement et rattachez-le à la facture correspondante.</p>
        <form className="form-grid module-form" onSubmit={(event) => void submitPayment(event)}>
          <label>
            Facture *
            <select
              value={paymentForm.invoiceId}
              onChange={(event) => setPaymentForm((previous) => ({ ...previous, invoiceId: event.target.value }))}
              required
            >
              <option value="">Choisir...</option>
              {invoices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.invoiceNo} - reste {formatMoney(item.remainingAmount)}
                </option>
              ))}
            </select>
            {renderFieldError(paymentErrors, "invoiceId")}
          </label>
          <label>
            Montant versé *
            <input
              type="number"
              min={1}
              max={selectedPaymentInvoice?.remainingAmount}
              value={paymentForm.paidAmount}
              onChange={(event) => setPaymentForm((previous) => ({ ...previous, paidAmount: event.target.value }))}
              required
            />
            {renderFieldError(paymentErrors, "paidAmount")}
          </label>
          <label>
            Mode de paiement *
            <select
              value={paymentForm.paymentMethod}
              onChange={(event) =>
                setPaymentForm((previous) => ({
                  ...previous,
                  paymentMethod: event.target.value as "CASH" | "MOBILE_MONEY" | "BANK"
                }))
              }
            >
              <option value="CASH">{formatChannelLabel("CASH")}</option>
              <option value="MOBILE_MONEY">{formatChannelLabel("MOBILE_MONEY")}</option>
              <option value="BANK">{formatChannelLabel("BANK")}</option>
            </select>
            {renderFieldError(paymentErrors, "paymentMethod")}
          </label>
          <label>
            Date de paiement *
            <input
              type="text"
              inputMode="numeric"
              placeholder="aaaa-mm-jj"
              value={paymentForm.paidAt}
              onChange={(event) => setPaymentForm((previous) => ({ ...previous, paidAt: event.target.value }))}
              required
            />
            {renderFieldError(paymentErrors, "paidAt")}
          </label>
          <label>
            Référence externe
            <input
              value={paymentForm.referenceExternal}
              onChange={(event) => setPaymentForm((previous) => ({ ...previous, referenceExternal: event.target.value }))}
            />
          </label>
          <div className="finance-payment-context">
            <strong>Reste à payer</strong>
            <span>{selectedPaymentInvoice ? formatMoney(selectedPaymentInvoice.remainingAmount) : "-"}</span>
          </div>
          <div className="actions form-grid-span-full finance-action-grid">
            <button type="submit">Enregistrer le paiement</button>
            <button
              type="button"
              className="button-ghost"
              onClick={() => void initiateOnlinePayment(paymentForm.invoiceId)}
              disabled={!remoteEnabled || !paymentForm.invoiceId || selectedPaymentInvoice?.remainingAmount === 0}
            >
              Paiement en ligne PayDunya
            </button>
          </div>
        </form>
      </section>

      <section data-step-id="payments" className="panel table-panel workflow-section module-modern finance-screen-shell">
        <div className="table-header">
          <div>
            <p className="section-kicker">Historique</p>
            <h2>Historique des paiements</h2>
          </div>
          <span className="module-header-badge">{payments.length} opération(s)</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reçu</th>
                <th>Facture</th>
                <th>Élève</th>
                <th>Montant</th>
                <th>Mode</th>
                <th>Référence</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-row">
                    Aucun paiement.
                  </td>
                </tr>
              ) : (
                payments.map((item) => (
                  <tr key={item.id}>
                    <td>{item.receiptNo}</td>
                    <td>{item.invoiceNo || "-"}</td>
                    <td>{item.studentName || "-"}</td>
                    <td>{formatMoney(item.paidAmount)}</td>
                    <td>{formatChannelLabel(item.paymentMethod)}</td>
                    <td>{item.referenceExternal || "-"}</td>
                    <td>{new Date(item.paidAt).toLocaleString(locale)}</td>
                    <td><span className="status-pill is-success">Enregistré</span></td>
                    <td>
                      {remoteEnabled ? (
                        <button type="button" className="button-ghost" onClick={() => void openReceipt(item.id)}>
                          Reçu en PDF
                        </button>
                      ) : (
                        <span className="finance-safe-note">PDF non disponible en aperçu</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </WorkflowGuide>
  );
}
