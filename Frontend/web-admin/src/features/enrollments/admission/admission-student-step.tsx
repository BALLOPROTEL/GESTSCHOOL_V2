import { useState, type FormEvent } from "react";

import type { Role } from "../../../shared/types/app";
import type {
  AdmissionMode,
  AdmissionStudentDraft,
  AdmissionStudentMatch,
  AdmissionStudentSearchQuery
} from "../types/admission";

type AdmissionStudentStepProps = {
  busy: boolean;
  draft: AdmissionStudentDraft;
  mode: AdmissionMode;
  role: Role | null;
  searchBusy: boolean;
  searchResults: AdmissionStudentMatch[];
  selectedStudent: AdmissionStudentMatch | null;
  t: (source: string) => string;
  onChange: (draft: AdmissionStudentDraft) => void;
  onContinue: () => void;
  onSearch: (query: AdmissionStudentSearchQuery) => void;
  onSelectExisting: (student: AdmissionStudentMatch) => void;
  onSwitchToReEnrollment: (student: AdmissionStudentMatch) => void;
};

const required = (label: string): JSX.Element => (
  <span className="field-label-required">
    {label} <span className="required-indicator">*</span>
  </span>
);

export function AdmissionStudentStep({
  busy,
  draft,
  mode,
  role,
  searchBusy,
  searchResults,
  selectedStudent,
  t,
  onChange,
  onContinue,
  onSearch,
  onSelectExisting,
  onSwitchToReEnrollment
}: AdmissionStudentStepProps): JSX.Element {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(draft.matriculeMode === "MANUAL");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);

  const runSearch = (event: FormEvent): void => {
    event.preventDefault();
    const query = searchTerm.trim();
    if (mode === "RE_ENROLLMENT") {
      if (query.length < 2) {
        setValidationError(t("Saisissez au moins deux caractères pour rechercher un élève."));
        return;
      }
      setValidationError(null);
      setSearchAttempted(true);
      onSearch({ matricule: query, lastName: query, limit: 10 });
      return;
    }

    if (!draft.firstName?.trim() || !draft.lastName?.trim()) {
      setValidationError(t("Renseignez le prénom et le nom avant la recherche de doublons."));
      return;
    }
    setValidationError(null);
    setSearchAttempted(true);
    onSearch({
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      birthDate: draft.birthDate,
      limit: 10
    });
  };

  const continueStep = (): void => {
    if (mode === "RE_ENROLLMENT") {
      if (!selectedStudent) {
        setValidationError(t("Sélectionnez l'élève à réinscrire."));
        return;
      }
    } else if (!draft.firstName?.trim() || !draft.lastName?.trim() || !draft.sex || !draft.birthDate) {
      setValidationError(t("Complétez les champs obligatoires de l'élève."));
      return;
    }
    if (draft.matriculeMode === "MANUAL" && !draft.matricule?.trim()) {
      setValidationError(t("Renseignez le matricule manuel."));
      return;
    }
    setValidationError(null);
    onContinue();
  };

  if (mode === "RE_ENROLLMENT") {
    return (
      <section className="admission-step-card" aria-labelledby="admission-student-title">
        <header className="admission-step-heading">
          <div>
            <span className="section-kicker">{t("Réinscription")}</span>
            <h2 id="admission-student-title">{t("Rechercher l'élève")}</h2>
            <p>{t("Recherchez puis confirmez l'élève existant à réinscrire.")}</p>
          </div>
        </header>
        <form className="admission-search-bar" role="search" onSubmit={runSearch}>
          <label>
            <span>{t("Nom ou matricule")}</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("Saisir un nom ou un matricule")}
              autoComplete="off"
            />
          </label>
          <button type="submit" className="button-ghost" disabled={searchBusy}>
            {t(searchBusy ? "Recherche en cours..." : "Rechercher")}
          </button>
        </form>
        <StudentMatches
          mode={mode}
          results={searchResults}
          selectedStudent={selectedStudent}
          t={t}
          onSelect={onSelectExisting}
        />
        {searchAttempted && !searchBusy && searchResults.length === 0 ? <p className="empty-row" role="status">{t("Aucun élève correspondant trouvé.")}</p> : null}
        {validationError ? <p className="field-error admission-inline-error" role="alert">{validationError}</p> : null}
        <div className="admission-step-actions">
          <button type="button" onClick={continueStep} disabled={busy || !selectedStudent}>
            {t(busy ? "Création du brouillon..." : "Réinscrire cet élève")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="admission-step-card" aria-labelledby="admission-student-title">
      <header className="admission-step-heading">
        <div>
          <span className="section-kicker">{t("Nouvelle admission")}</span>
          <h2 id="admission-student-title">{t("Identité de l'élève")}</h2>
          <p>{t("Commencez par les informations essentielles. Le matricule sera généré automatiquement.")}</p>
        </div>
      </header>
      <div className="admission-form-grid">
        <label>
          {required(t("Prénom"))}
          <input
            value={draft.firstName || ""}
            onChange={(event) => onChange({ ...draft, firstName: event.target.value })}
            autoComplete="given-name"
          />
        </label>
        <label>
          {required(t("Nom"))}
          <input
            value={draft.lastName || ""}
            onChange={(event) => onChange({ ...draft, lastName: event.target.value })}
            autoComplete="family-name"
          />
        </label>
        <label>
          {required(t("Sexe"))}
          <select
            value={draft.sex || ""}
            onChange={(event) => onChange({ ...draft, sex: event.target.value as "M" | "F" })}
          >
            <option value="">{t("Choisir")}</option>
            <option value="F">{t("Féminin")}</option>
            <option value="M">{t("Masculin")}</option>
          </select>
        </label>
        <label>
          {required(t("Date de naissance"))}
          <input
            type="date"
            value={draft.birthDate || ""}
            onChange={(event) => onChange({ ...draft, birthDate: event.target.value })}
          />
        </label>
      </div>
      {role === "ADMIN" ? (
        <details
          className="admission-advanced-options"
          open={showAdvanced}
          onToggle={(event) => setShowAdvanced(event.currentTarget.open)}
        >
          <summary>{t("Options avancées")}</summary>
          <label className="admission-manual-matricule">
            <input
              type="checkbox"
              checked={draft.matriculeMode === "MANUAL"}
              onChange={(event) =>
                onChange({
                  ...draft,
                  matriculeMode: event.target.checked ? "MANUAL" : "AUTO",
                  matricule: event.target.checked ? draft.matricule : undefined
                })
              }
            />
            <span>{t("Saisir un matricule manuellement")}</span>
          </label>
          {draft.matriculeMode === "MANUAL" ? (
            <label>
              <span>{t("Matricule")}</span>
              <input
                value={draft.matricule || ""}
                onChange={(event) => onChange({ ...draft, matricule: event.target.value })}
              />
            </label>
          ) : null}
        </details>
      ) : null}
      <form className="admission-duplicate-check" onSubmit={runSearch}>
        <div>
          <strong>{t("Vérifier les doublons")}</strong>
          <p>{t("La recherche est lancée uniquement à votre demande.")}</p>
        </div>
        <button type="submit" className="button-ghost" disabled={searchBusy}>
          {t(searchBusy ? "Vérification en cours..." : "Rechercher un élève similaire")}
        </button>
      </form>
      <StudentMatches
        mode={mode}
        results={searchResults}
        selectedStudent={null}
        t={t}
        onSelect={onSwitchToReEnrollment}
      />
      {searchAttempted && !searchBusy && searchResults.length === 0 ? <p className="empty-row" role="status">{t("Aucun doublon potentiel trouvé.")}</p> : null}
      {validationError ? <p className="field-error admission-inline-error" role="alert">{validationError}</p> : null}
      <div className="admission-step-actions">
        <button type="button" onClick={continueStep} disabled={busy}>
          {t(busy ? "Enregistrement..." : "Continuer")}
        </button>
      </div>
    </section>
  );
}

function StudentMatches({
  mode,
  results,
  selectedStudent,
  t,
  onSelect
}: {
  mode: AdmissionMode;
  results: AdmissionStudentMatch[];
  selectedStudent: AdmissionStudentMatch | null;
  t: (source: string) => string;
  onSelect: (student: AdmissionStudentMatch) => void;
}): JSX.Element | null {
  if (results.length === 0) return null;
  return (
    <div className="admission-search-results" aria-live="polite">
      <strong>{t(mode === "NEW_ADMISSION" ? "Un élève similaire existe peut-être déjà" : "Résultats de recherche")}</strong>
      <div className="admission-result-grid">
        {results.map((student) => {
          const selected = selectedStudent?.id === student.id;
          return (
            <article key={student.id} className={selected ? "admission-result-card is-selected" : "admission-result-card"}>
              <div>
                <strong>{student.firstName} {student.lastName}</strong>
                <span>{student.matricule}</span>
                {student.birthDate ? <small>{student.birthDate}</small> : null}
              </div>
              <button type="button" className="button-ghost" aria-pressed={selected} onClick={() => onSelect(student)}>
                {t(mode === "NEW_ADMISSION" ? "Utiliser pour une réinscription" : selected ? "Élève sélectionné" : "Sélectionner")}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
