import type { AdmissionCase } from "../types/admission";
import {
  ADMISSION_MODE_LABELS,
  ADMISSION_STATUS_LABELS,
  admissionStudentName,
  getAdmissionProgress
} from "./admission-copy";

export function AdmissionDraftList({
  cases,
  loading,
  locale,
  t,
  onCancel,
  onResume
}: {
  cases: AdmissionCase[];
  loading: boolean;
  locale: string;
  t: (source: string) => string;
  onCancel: (admissionCase: AdmissionCase) => void;
  onResume: (admissionCase: AdmissionCase) => void;
}): JSX.Element | null {
  const activeCases = cases.filter((item) => ["DRAFT", "READY", "FAILED"].includes(item.status));
  if (!loading && activeCases.length === 0) return null;

  return (
    <section className="panel admission-drafts" aria-labelledby="admission-drafts-title">
      <header className="admission-drafts-header">
        <div>
          <span className="section-kicker">{t("Brouillons")}</span>
          <h2 id="admission-drafts-title">{t("Reprendre une inscription")}</h2>
          <p>{t("Continuez un dossier enregistré ou corrigez une confirmation interrompue.")}</p>
        </div>
        <span className="students-overview-status">{activeCases.length} {t("dossier(s) actif(s)")}</span>
      </header>
      {loading ? <p role="status">{t("Chargement des brouillons...")}</p> : (
        <div className="admission-draft-grid">
          {activeCases.map((admissionCase) => {
            const progress = getAdmissionProgress(admissionCase);
            const studentName = admissionStudentName(admissionCase);
            return (
              <article key={admissionCase.id} className="admission-draft-card">
                <div className="admission-draft-copy">
                  <span className={`status-pill admission-status-${admissionCase.status.toLowerCase()}`}>
                    {t(ADMISSION_STATUS_LABELS[admissionCase.status])}
                  </span>
                  <h3>{studentName === "Élève existant" ? t(studentName) : studentName}</h3>
                  <p>{t(ADMISSION_MODE_LABELS[admissionCase.mode])}</p>
                  <small>{t("Mis à jour le")} {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(admissionCase.updatedAt))}</small>
                </div>
                <div className="admission-draft-progress">
                  <span>{progress} {t("étape(s) sur 4 complétée(s)")}</span>
                  <progress value={progress} max={4} aria-label={t("Progression du dossier")} />
                </div>
                <div className="admission-draft-actions">
                  <button type="button" onClick={() => onResume(admissionCase)}>
                    {t(admissionCase.status === "FAILED" ? "Corriger" : "Reprendre")}
                  </button>
                  <button type="button" className="button-ghost admission-danger-action" onClick={() => onCancel(admissionCase)}>
                    {t("Annuler cette inscription")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
