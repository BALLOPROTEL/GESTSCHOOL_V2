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
  CASH: "Especes",
  MOBILE_MONEY: "Mobile money",
  BANK: "Banque",
  TRANSFER: "Virement",
  OTHER: "Autre"
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Ouverte",
  PARTIAL: "Partielle",
  PAID: "Payee",
  VOID: "Annulee"
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
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const openInvoicesCount = invoices.filter((item) => item.status !== "PAID").length;
  const paidInvoicesCount = invoices.filter((item) => item.status === "PAID").length;

  return (
    <WorkflowGuide
      title="Comptabilite"
      steps={financeSteps}
      activeStepId={financeWorkflowStep}
      onStepChange={scrollToFinance}
    >
      {financeWorkflowStep === "overview" ? (
        <section className="panel table-panel workflow-section module-modern module-overview-shell">
          <div className="table-header">
            <div>
              <p className="section-kicker">Finance v2</p>
              <h2>Console de recouvrement</h2>
            </div>
            <span className="module-header-badge">
              {(recovery?.totals.recoveryRatePercent || 0).toFixed(1)}% recouvrement
            </span>
          </div>
          <p className="section-lead">
            Meme logique visuelle que FlexAdmin: synthese en tete, formulaires plus nets et tableaux
            de caisse resserres pour la lecture quotidienne.
          </p>
          <div className="module-overview-grid">
            <article className="module-overview-card">
              <span>Plans</span>
              <strong>{feePlans.length}</strong>
              <small>Grilles tarifaires actives</small>
            </article>
            <article className="module-overview-card">
              <span>Factures ouvertes</span>
              <strong>{openInvoicesCount}</strong>
              <small>Suivi des impayes</small>
            </article>
            <article className="module-overview-card">
              <span>Factures reglees</span>
              <strong>{paidInvoicesCount}</strong>
              <small>Dossiers finalises</small>
            </article>
            <article className="module-overview-card">
              <span>Paiements</span>
              <strong>{payments.length}</strong>
              <small>Encaissements saisis</small>
            </article>
          </div>
          <div className="module-inline-strip">
            <span className="module-inline-pill">Du: {formatMoney(recovery?.totals.amountDue || 0)}</span>
            <span className="module-inline-pill">
              Encaisse: {formatMoney(recovery?.totals.amountPaid || 0)}
            </span>
            <span className="module-inline-pill">
              Reste: {formatMoney(recovery?.totals.remainingAmount || 0)}
            </span>
          </div>
        </section>
      ) : null}

      <section id="finance-overview" data-step-id="overview" className="panel table-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">Synthese</p>
            <h2>Synthese du recouvrement</h2>
          </div>
          <span className="module-header-badge">Pilotage journalier</span>
        </div>
        <p className="section-lead">Suivez la sante financiere avant de passer aux operations de saisie.</p>
        <div className="metrics-grid">
          <article className="metric-card">
            <span>Total du</span>
            <strong>{formatMoney(recovery?.totals.amountDue || 0)}</strong>
          </article>
          <article className="metric-card">
            <span>Montant encaisse</span>
            <strong>{formatMoney(recovery?.totals.amountPaid || 0)}</strong>
          </article>
          <article className="metric-card">
            <span>Reste a recouvrer</span>
            <strong>{formatMoney(recovery?.totals.remainingAmount || 0)}</strong>
          </article>
          <article className="metric-card">
            <span>Taux recouvrement</span>
            <strong>{(recovery?.totals.recoveryRatePercent || 0).toFixed(2)}%</strong>
          </article>
        </div>
        <div className="actions">
          <button type="button" className="button-ghost" onClick={() => void loadFinance()}>
            Recharger comptabilite
          </button>
          {receiptPdfUrl ? (
            <button
              type="button"
              className="button-ghost"
              onClick={() => window.open(receiptPdfUrl, "_blank", "noopener,noreferrer")}
            >
              Ouvrir le dernier recu
            </button>
          ) : null}
        </div>
      </section>

      <section id="finance-fee-plans" data-step-id="feePlans" className="panel editor-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">Tarification</p>
            <h2>Plans de frais</h2>
          </div>
          <span className="module-header-badge">{feePlans.length} plan(s)</span>
        </div>
        <p className="section-lead">Definissez les frais par annee et niveau, puis reutilisez-les pour la facturation.</p>
        <form className="form-grid module-form" onSubmit={(event) => void submitFeePlan(event)}>
          <label>
            Annee scolaire
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
            Niveau
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
            Libelle
            <input
              value={feePlanForm.label}
              onChange={(event) => setFeePlanForm((previous) => ({ ...previous, label: event.target.value }))}
              required
            />
            {renderFieldError(feePlanErrors, "label")}
          </label>
          <label>
            Montant total
            <input
              type="number"
              min={0}
              value={feePlanForm.totalAmount}
              onChange={(event) => setFeePlanForm((previous) => ({ ...previous, totalAmount: event.target.value }))}
              required
            />
            {renderFieldError(feePlanErrors, "totalAmount")}
          </label>
          <label>
            Devise
            <input
              maxLength={3}
              value={feePlanForm.currency}
              onChange={(event) =>
                setFeePlanForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))
              }
            />
            {renderFieldError(feePlanErrors, "currency")}
          </label>
          <button type="submit">Creer le plan de frais</button>
        </form>
      </section>

      <section data-step-id="feePlans" className="panel table-panel workflow-section module-modern">
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
                <th>Libelle</th>
                <th>Annee</th>
                <th>Niveau</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {feePlans.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-row">
                    Aucun plan de frais.
                  </td>
                </tr>
              ) : (
                feePlans.map((item) => (
                  <tr key={item.id}>
                    <td>{item.label}</td>
                    <td>{schoolYearById.get(item.schoolYearId)?.code || "-"}</td>
                    <td>{levelById.get(item.levelId)?.label || "-"}</td>
                    <td>{formatMoney(item.totalAmount, item.currency)}</td>
                    <td>
                      <button type="button" className="button-danger" onClick={() => void deleteFeePlan(item.id)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="finance-invoices" data-step-id="invoices" className="panel editor-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">Facturation</p>
            <h2>Factures</h2>
          </div>
          <span className="module-header-badge">{invoices.length} facture(s)</span>
        </div>
        <p className="section-lead">Associez un eleve, une annee et un montant du pour generer une facture claire.</p>
        <form className="form-grid module-form" onSubmit={(event) => void submitInvoice(event)}>
          <label>
            Eleve
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
            Annee scolaire
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
            Montant du (optionnel)
            <input
              type="number"
              min={0}
              value={invoiceForm.amountDue}
              onChange={(event) => setInvoiceForm((previous) => ({ ...previous, amountDue: event.target.value }))}
              placeholder="Requis si aucun plan de frais"
            />
            {renderFieldError(invoiceErrors, "amountDue")}
          </label>
          <label>
            Date echeance
            <input
              type="date"
              value={invoiceForm.dueDate}
              onChange={(event) => setInvoiceForm((previous) => ({ ...previous, dueDate: event.target.value }))}
            />
          </label>
          <button type="submit">Creer facture</button>
        </form>
      </section>

      <section data-step-id="invoices" className="panel table-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">Registre</p>
            <h2>Liste factures</h2>
          </div>
          <span className="module-header-badge">{invoices.length} facture(s)</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Numero</th>
                <th>Eleve</th>
                <th>Classe principale</th>
                <th>Classe secondaire</th>
                <th>Du</th>
                <th>Paye</th>
                <th>Reste</th>
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
                    <td>
                      {[item.secondaryClassLabel, item.secondaryTrack ? formatAcademicTrackLabel(item.secondaryTrack) : undefined]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </td>
                    <td>{formatAmount(item.amountDue)}</td>
                    <td>{formatAmount(item.amountPaid)}</td>
                    <td>{formatAmount(item.remainingAmount)}</td>
                    <td>{formatInvoiceStatusLabel(item.status)}</td>
                    <td>
                      <button type="button" className="button-danger" onClick={() => void deleteInvoice(item.id)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="finance-payments" data-step-id="payments" className="panel editor-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">Encaissements</p>
            <h2>Paiements</h2>
          </div>
          <span className="module-header-badge">{payments.length} recu(s)</span>
        </div>
        <p className="section-lead">Enregistrez chaque encaissement et rattachez-le a la facture correspondante.</p>
        <form className="form-grid module-form" onSubmit={(event) => void submitPayment(event)}>
          <label>
            Facture
            <select
              value={paymentForm.invoiceId}
              onChange={(event) => setPaymentForm((previous) => ({ ...previous, invoiceId: event.target.value }))}
              required
            >
              <option value="">Choisir...</option>
              {invoices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.invoiceNo} - reste {formatAmount(item.remainingAmount)}
                </option>
              ))}
            </select>
            {renderFieldError(paymentErrors, "invoiceId")}
          </label>
          <label>
            Montant verse
            <input
              type="number"
              min={0}
              value={paymentForm.paidAmount}
              onChange={(event) => setPaymentForm((previous) => ({ ...previous, paidAmount: event.target.value }))}
              required
            />
            {renderFieldError(paymentErrors, "paidAmount")}
          </label>
          <label>
            Mode paiement
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
            Reference externe
            <input
              value={paymentForm.referenceExternal}
              onChange={(event) => setPaymentForm((previous) => ({ ...previous, referenceExternal: event.target.value }))}
            />
          </label>
          <button type="submit">Enregistrer paiement</button>
        </form>
      </section>

      <section data-step-id="payments" className="panel table-panel workflow-section module-modern">
        <div className="table-header">
          <div>
            <p className="section-kicker">Historique</p>
            <h2>Historique paiements</h2>
          </div>
          <span className="module-header-badge">{payments.length} operation(s)</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Recu</th>
                <th>Facture</th>
                <th>Eleve</th>
                <th>Montant</th>
                <th>Mode</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-row">
                    Aucun paiement.
                  </td>
                </tr>
              ) : (
                payments.map((item) => (
                  <tr key={item.id}>
                    <td>{item.receiptNo}</td>
                    <td>{item.invoiceNo || "-"}</td>
                    <td>{item.studentName || "-"}</td>
                    <td>{formatAmount(item.paidAmount)}</td>
                    <td>{formatChannelLabel(item.paymentMethod)}</td>
                    <td>{new Date(item.paidAt).toLocaleString(locale)}</td>
                    <td>
                      <button type="button" className="button-ghost" onClick={() => void openReceipt(item.id)}>
                        Recu en PDF
                      </button>
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
