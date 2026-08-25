import { useState } from "react";

import type {
  AdmissionFinanceDraft,
  AdmissionFinanceOptions
} from "../types/admission";

type AdmissionFinanceStepProps = {
  busy: boolean;
  loading: boolean;
  options: AdmissionFinanceOptions | null;
  selection: AdmissionFinanceDraft;
  locale: string;
  t: (source: string) => string;
  onChange: (selection: AdmissionFinanceDraft) => void;
  onContinue: () => void;
  onPrevious: () => void;
};

export function AdmissionFinanceStep({
  busy,
  loading,
  options,
  selection,
  locale,
  t,
  onChange,
  onContinue,
  onPrevious
}: AdmissionFinanceStepProps): JSX.Element {
  const [validationError, setValidationError] = useState<string | null>(null);
  const money = (value: number, currency: string): string =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

  const continueStep = (): void => {
    if (!selection.mode || (selection.mode === "FEE_PLAN" && !selection.feePlanId)) {
      setValidationError(t("Choisissez un plan de frais ou le traitement ultérieur."));
      return;
    }
    setValidationError(null);
    onContinue();
  };

  return (
    <section className="admission-step-card" aria-labelledby="admission-finance-title">
      <header className="admission-step-heading">
        <div>
          <span className="section-kicker">{t("Frais")}</span>
          <h2 id="admission-finance-title">{t("Frais de scolarité")}</h2>
          <p>{t("Le traitement des frais est optionnel et ne déclenche aucun paiement.")}</p>
        </div>
        {loading ? <span className="admission-local-loading" role="status">{t("Chargement des plans...")}</span> : null}
      </header>
      <div className="admission-choice-grid" role="radiogroup" aria-label={t("Frais de scolarité")}>
        <label className={selection.mode === "FEE_PLAN" ? "admission-choice-card is-selected" : "admission-choice-card"}>
          <input
            type="radio"
            name="finance-mode"
            checked={selection.mode === "FEE_PLAN"}
            disabled={!options?.capabilities.canSelectFeePlan}
            onChange={() => onChange({ mode: "FEE_PLAN" })}
          />
          <span>
            <strong>{t("Appliquer un plan de frais")}</strong>
            <small>{t("Choisissez un plan compatible avec la scolarité sélectionnée.")}</small>
          </span>
        </label>
        <label className={selection.mode === "DEFERRED" ? "admission-choice-card is-selected" : "admission-choice-card"}>
          <input
            type="radio"
            name="finance-mode"
            checked={selection.mode === "DEFERRED"}
            disabled={options ? !options.capabilities.canDefer : false}
            onChange={() => onChange({ mode: "DEFERRED" })}
          />
          <span>
            <strong>{t("Traiter les frais plus tard")}</strong>
            <small>{t("L'inscription sera confirmée sans facture ni paiement automatique.")}</small>
          </span>
        </label>
      </div>
      {selection.mode === "FEE_PLAN" ? (
        <div className="admission-plan-grid" role="radiogroup" aria-label={t("Plans de frais compatibles")}>
          {(options?.plans || []).length === 0 ? <p className="empty-row">{t("Aucun plan de frais compatible n'est disponible.")}</p> : null}
          {(options?.plans || []).map((plan) => (
            <label key={plan.id} className={selection.feePlanId === plan.id ? "admission-plan-card is-selected" : "admission-plan-card"}>
              <input type="radio" name="fee-plan" checked={selection.feePlanId === plan.id} onChange={() => onChange({ mode: "FEE_PLAN", feePlanId: plan.id })} />
              <span><strong>{plan.label}</strong><small>{money(plan.totalAmount, plan.currency)}</small></span>
            </label>
          ))}
        </div>
      ) : null}
      {validationError ? <p className="field-error admission-inline-error" role="alert">{validationError}</p> : null}
      <div className="admission-step-actions is-split">
        <button type="button" className="button-ghost" onClick={onPrevious}>{t("Précédent")}</button>
        <button type="button" onClick={continueStep} disabled={busy || loading}>{t(busy ? "Enregistrement..." : "Continuer")}</button>
      </div>
    </section>
  );
}
