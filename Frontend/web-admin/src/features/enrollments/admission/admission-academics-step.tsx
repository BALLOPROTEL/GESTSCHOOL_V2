import { useState } from "react";

import type {
  AdmissionAcademicOptions,
  AdmissionAcademicsDraft
} from "../types/admission";

type AdmissionAcademicsStepProps = {
  busy: boolean;
  loading: boolean;
  options: AdmissionAcademicOptions | null;
  selection: AdmissionAcademicsDraft;
  t: (source: string) => string;
  onChange: (selection: AdmissionAcademicsDraft) => void;
  onContinue: () => void;
  onPrevious: () => void;
};

export function AdmissionAcademicsStep({
  busy,
  loading,
  options,
  selection,
  t,
  onChange,
  onContinue,
  onPrevious
}: AdmissionAcademicsStepProps): JSX.Element {
  const selectedLevel = options?.levels.find((level) => level.id === selection.levelId);
  const [validationError, setValidationError] = useState<string | null>(null);

  const continueStep = (): void => {
    if (!selection.schoolYearId || !selection.track || !selection.cycleId || !selection.levelId || !selection.classId) {
      setValidationError(t("Complétez l'année scolaire, le cursus, le niveau et la classe."));
      return;
    }
    setValidationError(null);
    onContinue();
  };

  return (
    <section className="admission-step-card" aria-labelledby="admission-academics-title">
      <header className="admission-step-heading">
        <div>
          <span className="section-kicker">{t("Scolarité")}</span>
          <h2 id="admission-academics-title">{t("Choisir la scolarité")}</h2>
          <p>{t("Les choix sont proposés progressivement selon le référentiel actif.")}</p>
        </div>
        {loading ? <span className="admission-local-loading" role="status">{t("Actualisation des choix...")}</span> : null}
      </header>
      <div className="admission-form-grid">
        <label>
          <span>{t("Année scolaire")}</span>
          <select
            value={selection.schoolYearId || ""}
            onChange={(event) => onChange({ schoolYearId: event.target.value || undefined })}
          >
            <option value="">{t("Choisir une année")}</option>
            {(options?.schoolYears || []).map((year) => <option key={year.id} value={year.id}>{year.code} - {year.label}</option>)}
          </select>
        </label>
        <label>
          <span>{t("Cursus")}</span>
          <select
            value={selection.track || ""}
            disabled={!selection.schoolYearId}
            onChange={(event) => onChange({ schoolYearId: selection.schoolYearId, track: event.target.value as AdmissionAcademicsDraft["track"] })}
          >
            <option value="">{t("Choisir un cursus")}</option>
            {(options?.tracks || []).map((track) => <option key={track} value={track}>{t(track === "ARABOPHONE" ? "Arabophone" : "Francophone")}</option>)}
          </select>
        </label>
        <label>
          <span>{t("Niveau")}</span>
          <select
            value={selection.levelId || ""}
            disabled={!selection.track}
            onChange={(event) => {
              const level = options?.levels.find((item) => item.id === event.target.value);
              onChange({
                schoolYearId: selection.schoolYearId,
                track: selection.track,
                levelId: level?.id,
                cycleId: level?.cycleId
              });
            }}
          >
            <option value="">{t("Choisir un niveau")}</option>
            {(options?.levels || []).map((level) => <option key={level.id} value={level.id}>{level.cycleLabel} - {level.label}</option>)}
          </select>
        </label>
        <label>
          <span>{t("Classe")}</span>
          <select
            value={selection.classId || ""}
            disabled={!selection.levelId}
            onChange={(event) => onChange({ ...selection, classId: event.target.value || undefined })}
          >
            <option value="">{t((options?.classes.length || 0) > 0 ? "Choisir une classe" : "Aucune classe disponible pour cette sélection")}</option>
            {(options?.classes || []).map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.label} - {classroom.placesRemaining === undefined ? t("capacité non limitée") : `${classroom.placesRemaining} ${t("place(s) restante(s)")}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {selectedLevel ? (
        <div className="notice-card notice-info">
          <strong>{t("Contexte scolaire")}</strong>
          <p>{selectedLevel.cycleLabel} - {selectedLevel.label}</p>
        </div>
      ) : null}
      {selection.classId && options?.classes.find((item) => item.id === selection.classId)?.capacityStatus === "FULL" ? (
        <div className="notice-card notice-warning" role="status">
          <strong>{t("Capacité informative atteinte")}</strong>
          <p>{t("Vous pouvez continuer. Le backend validera définitivement le placement.")}</p>
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
