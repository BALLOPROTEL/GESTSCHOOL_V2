import { useState, type FormEvent } from "react";

import type {
  AdmissionGuardianDraft,
  AdmissionGuardianMatch,
  AdmissionGuardianSearchQuery,
  AdmissionMode,
  ParentRelationCode
} from "../types/admission";
import { PARENT_RELATION_LABELS } from "./admission-copy";

const RELATION_CODES = Object.keys(PARENT_RELATION_LABELS) as ParentRelationCode[];

const emptyGuardian = (): AdmissionGuardianDraft => ({
  source: "NEW_GUARDIAN",
  relationType: "RESPONSABLE_LEGAL",
  parentalRole: "RESPONSABLE_LEGAL",
  isPrimaryContact: false,
  legalGuardian: true,
  financialResponsible: false,
  emergencyContact: true
});

type AdmissionGuardianStepProps = {
  busy: boolean;
  guardians: AdmissionGuardianDraft[];
  mode: AdmissionMode;
  searchBusy: boolean;
  searchResults: AdmissionGuardianMatch[];
  t: (source: string) => string;
  onChange: (guardians: AdmissionGuardianDraft[]) => void;
  onContinue: () => void;
  onPrevious: () => void;
  onSearch: (query: AdmissionGuardianSearchQuery) => void;
};

export function AdmissionGuardianStep({
  busy,
  guardians,
  mode,
  searchBusy,
  searchResults,
  t,
  onChange,
  onContinue,
  onPrevious,
  onSearch
}: AdmissionGuardianStepProps): JSX.Element {
  const [entryMode, setEntryMode] = useState<"SEARCH" | "NEW">("SEARCH");
  const [searchTerm, setSearchTerm] = useState("");
  const [editor, setEditor] = useState<AdmissionGuardianDraft>(emptyGuardian);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);

  if (mode === "RE_ENROLLMENT") {
    return (
      <section className="admission-step-card" aria-labelledby="admission-guardian-title">
        <header className="admission-step-heading">
          <div>
            <span className="section-kicker">{t("Responsable")}</span>
            <h2 id="admission-guardian-title">{t("Responsables existants")}</h2>
            <p>{t("Les responsables existants sont conservés sans modification pendant la réinscription.")}</p>
          </div>
        </header>
        <div className="notice-card notice-info">
          <strong>{t("Relations conservées")}</strong>
          <p>{t("La modification des responsables n'est pas disponible dans ce parcours de réinscription.")}</p>
        </div>
        <div className="admission-step-actions is-split">
          <button type="button" className="button-ghost" onClick={onPrevious}>{t("Précédent")}</button>
          <button type="button" onClick={onContinue}>{t("Continuer")}</button>
        </div>
      </section>
    );
  }

  const setPrimary = (index: number): void => {
    onChange(guardians.map((guardian, guardianIndex) => ({
      ...guardian,
      isPrimaryContact: guardianIndex === index
    })));
  };

  const addExisting = (match: AdmissionGuardianMatch): void => {
    if (guardians.some((guardian) => guardian.parentId === match.id)) return;
    const first = guardians.length === 0;
    onChange([
      ...guardians,
      {
        source: "EXISTING_GUARDIAN",
        parentId: match.id,
        firstName: match.firstName,
        lastName: match.lastName,
        parentalRole: match.parentalRole,
        relationType: match.parentalRole,
        primaryPhone: match.phoneHint,
        email: match.emailHint || undefined,
        isPrimaryContact: first,
        legalGuardian: true,
        emergencyContact: true
      }
    ]);
  };

  const saveEditor = (): void => {
    if (!editor.firstName?.trim() || !editor.lastName?.trim() || !editor.relationType) {
      setValidationError(t("Complétez le prénom, le nom et la relation du responsable."));
      return;
    }
    const normalized: AdmissionGuardianDraft = {
      ...editor,
      source: "NEW_GUARDIAN",
      firstName: editor.firstName.trim(),
      lastName: editor.lastName.trim(),
      parentalRole: editor.relationType,
      isPrimaryContact: editingIndex === null && guardians.length === 0 ? true : editor.isPrimaryContact
    };
    const next = editingIndex === null
      ? [...guardians, normalized]
      : guardians.map((guardian, index) => index === editingIndex ? normalized : guardian);
    const primaryIndex = next.findIndex((guardian) => guardian.isPrimaryContact);
    onChange(next.map((guardian, index) => ({ ...guardian, isPrimaryContact: index === primaryIndex })));
    setEditor(emptyGuardian());
    setEditingIndex(null);
    setValidationError(null);
  };

  const runSearch = (event: FormEvent): void => {
    event.preventDefault();
    const query = searchTerm.trim();
    if (query.length < 2) {
      setValidationError(t("Saisissez au moins deux caractères pour rechercher un responsable."));
      return;
    }
    setValidationError(null);
    setSearchAttempted(true);
    onSearch({ lastName: query, phone: query, email: query.includes("@") ? query : undefined, limit: 10 });
  };

  const continueStep = (): void => {
    if (guardians.length === 0) {
      setValidationError(t("Ajoutez au moins un responsable."));
      return;
    }
    if (guardians.filter((guardian) => guardian.isPrimaryContact).length !== 1) {
      setValidationError(t("Choisissez un seul responsable principal."));
      return;
    }
    setValidationError(null);
    onContinue();
  };

  return (
    <section className="admission-step-card" aria-labelledby="admission-guardian-title">
      <header className="admission-step-heading">
        <div>
          <span className="section-kicker">{t("Responsable")}</span>
          <h2 id="admission-guardian-title">{t("Responsable de l'élève")}</h2>
          <p>{t("Ajoutez au moins un responsable et choisissez le contact principal.")}</p>
        </div>
      </header>

      {guardians.length > 0 ? (
        <div className="admission-guardian-list" aria-label={t("Responsables ajoutés")}>
          {guardians.map((guardian, index) => (
            <article key={`${guardian.parentId || "new"}-${index}`} className="admission-guardian-card">
              <div>
                <strong>{guardian.firstName} {guardian.lastName}</strong>
                <span>{t(PARENT_RELATION_LABELS[guardian.relationType || "AUTRE"])}</span>
                {guardian.primaryPhone ? <small>{guardian.primaryPhone}</small> : null}
              </div>
              <div className="admission-guardian-actions">
                <label>
                  <input
                    type="radio"
                    name="primary-guardian"
                    checked={Boolean(guardian.isPrimaryContact)}
                    onChange={() => setPrimary(index)}
                  />
                  <span>{t("Responsable principal")}</span>
                </label>
                {guardian.source === "NEW_GUARDIAN" ? (
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => {
                      setEditor(guardian);
                      setEditingIndex(index);
                      setEntryMode("NEW");
                    }}
                  >
                    {t("Modifier")}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => {
                    const next = guardians.filter((_, guardianIndex) => guardianIndex !== index);
                    const hasPrimary = next.some((item) => item.isPrimaryContact);
                    onChange(next.map((item, nextIndex) => ({
                      ...item,
                      isPrimaryContact: hasPrimary ? item.isPrimaryContact : nextIndex === 0
                    })));
                  }}
                >
                  {t("Retirer du brouillon")}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className="admission-segmented-control" role="group" aria-label={t("Choix du responsable")}>
        <button type="button" className={entryMode === "SEARCH" ? "is-active" : ""} aria-pressed={entryMode === "SEARCH"} onClick={() => setEntryMode("SEARCH")}>
          {t("Rechercher un responsable existant")}
        </button>
        <button type="button" className={entryMode === "NEW" ? "is-active" : ""} aria-pressed={entryMode === "NEW"} onClick={() => setEntryMode("NEW")}>
          {t("Ajouter un nouveau responsable")}
        </button>
      </div>

      {entryMode === "SEARCH" ? (
        <>
          <form className="admission-search-bar" role="search" onSubmit={runSearch}>
            <label>
              <span>{t("Nom, téléphone ou email")}</span>
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} autoComplete="off" />
            </label>
            <button type="submit" className="button-ghost" disabled={searchBusy}>
              {t(searchBusy ? "Recherche en cours..." : "Rechercher")}
            </button>
          </form>
          {searchResults.length > 0 ? (
            <div className="admission-result-grid" aria-live="polite">
              {searchResults.map((guardian) => (
                <article key={guardian.id} className="admission-result-card">
                  <div>
                    <strong>{guardian.firstName} {guardian.lastName}</strong>
                    <span>{guardian.phoneHint}</span>
                    {guardian.emailHint ? <small>{guardian.emailHint}</small> : null}
                  </div>
                  <button type="button" className="button-ghost" onClick={() => addExisting(guardian)}>
                    {t("Utiliser ce responsable")}
                  </button>
                </article>
              ))}
            </div>
          ) : null}
          {searchAttempted && !searchBusy && searchResults.length === 0 ? <p className="empty-row" role="status">{t("Aucun responsable correspondant trouvé.")}</p> : null}
        </>
      ) : (
        <div className="admission-form-grid admission-guardian-editor">
          <label>
            <span>{t("Prénom")}</span>
            <input value={editor.firstName || ""} onChange={(event) => setEditor({ ...editor, firstName: event.target.value })} />
          </label>
          <label>
            <span>{t("Nom")}</span>
            <input value={editor.lastName || ""} onChange={(event) => setEditor({ ...editor, lastName: event.target.value })} />
          </label>
          <label>
            <span>{t("Relation avec l'élève")}</span>
            <select value={editor.relationType || "RESPONSABLE_LEGAL"} onChange={(event) => setEditor({ ...editor, relationType: event.target.value as ParentRelationCode })}>
              {RELATION_CODES.map((code) => <option key={code} value={code}>{t(PARENT_RELATION_LABELS[code])}</option>)}
            </select>
          </label>
          <label>
            <span>{t("Téléphone")}</span>
            <input type="tel" value={editor.primaryPhone || ""} onChange={(event) => setEditor({ ...editor, primaryPhone: event.target.value })} />
          </label>
          <label>
            <span>{t("Email")}</span>
            <input type="email" value={editor.email || ""} onChange={(event) => setEditor({ ...editor, email: event.target.value })} />
          </label>
          <div className="admission-editor-actions">
            <button type="button" className="button-ghost" onClick={saveEditor}>
              {t(editingIndex === null ? "Ajouter ce responsable" : "Enregistrer les modifications")}
            </button>
          </div>
        </div>
      )}

      {validationError ? <p className="field-error admission-inline-error" role="alert">{validationError}</p> : null}
      <div className="admission-step-actions is-split">
        <button type="button" className="button-ghost" onClick={onPrevious}>{t("Précédent")}</button>
        <button type="button" onClick={continueStep} disabled={busy}>{t(busy ? "Enregistrement..." : "Continuer")}</button>
      </div>
    </section>
  );
}
