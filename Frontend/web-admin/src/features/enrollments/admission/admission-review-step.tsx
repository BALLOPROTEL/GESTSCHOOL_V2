import type {
  AdmissionCase,
  AdmissionClassOption,
  AdmissionFeePlanOption,
  AdmissionLevelOption,
  AdmissionStudentMatch,
  AdmissionWizardStep
} from "../types/admission";
import { PARENT_RELATION_LABELS } from "./admission-copy";

type AdmissionReviewStepProps = {
  admissionCase: AdmissionCase;
  busy: boolean;
  classroom: AdmissionClassOption | null;
  feePlan: AdmissionFeePlanOption | null;
  level: AdmissionLevelOption | null;
  selectedStudent: AdmissionStudentMatch | null;
  schoolYearLabel: string;
  t: (source: string) => string;
  onEdit: (step: AdmissionWizardStep) => void;
  onFinalize: () => void;
  onPrevious: () => void;
};

export function AdmissionReviewStep({
  admissionCase,
  busy,
  classroom,
  feePlan,
  level,
  selectedStudent,
  schoolYearLabel,
  t,
  onEdit,
  onFinalize,
  onPrevious
}: AdmissionReviewStepProps): JSX.Element {
  const student = admissionCase.sections.STUDENT;
  const guardian = admissionCase.sections.GUARDIANS?.guardians?.find((item) => item.isPrimaryContact);
  const finance = admissionCase.sections.FINANCE;
  const studentName = admissionCase.mode === "RE_ENROLLMENT"
    ? selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : t("Élève existant")
    : `${student?.firstName || ""} ${student?.lastName || ""}`.trim();

  const sections: Array<{ step: AdmissionWizardStep; title: string; rows: Array<[string, string]> }> = [
    {
      step: "STUDENT",
      title: "Élève",
      rows: [
        ["Identité", studentName || t("À compléter")],
        ["Date de naissance", student?.birthDate || selectedStudent?.birthDate || t("Non disponible")],
        ["Matricule", admissionCase.mode === "RE_ENROLLMENT" ? selectedStudent?.matricule || t("Non disponible") : student?.matriculeMode === "MANUAL" ? student.matricule || t("À compléter") : t("Généré automatiquement")]
      ]
    },
    {
      step: "GUARDIANS",
      title: "Responsable",
      rows: admissionCase.mode === "RE_ENROLLMENT"
        ? [["Responsables", t("Relations existantes conservées")]]
        : [["Responsable principal", guardian ? `${guardian.firstName || ""} ${guardian.lastName || ""}`.trim() : t("À compléter")], ["Relation", guardian?.relationType ? t(PARENT_RELATION_LABELS[guardian.relationType]) : t("Non disponible")]]
    },
    {
      step: "ACADEMICS",
      title: "Scolarité",
      rows: [["Année scolaire", schoolYearLabel || t("À compléter")], ["Cursus", admissionCase.sections.ACADEMICS?.track ? t(admissionCase.sections.ACADEMICS.track === "ARABOPHONE" ? "Arabophone" : "Francophone") : t("À compléter")], ["Niveau", level?.label || t("À compléter")], ["Classe", classroom?.label || t("À compléter")]]
    },
    {
      step: "FINANCE",
      title: "Frais",
      rows: finance?.mode === "DEFERRED"
        ? [["Traitement", t("Frais à traiter ultérieurement")]]
        : [["Plan de frais", feePlan?.label || t("À compléter")], ["Facturation", t("Aucune facture automatique")]]
    }
  ];

  return (
    <section className="admission-step-card" aria-labelledby="admission-review-title">
      <header className="admission-step-heading">
        <div>
          <span className="section-kicker">{t("Récapitulatif")}</span>
          <h2 id="admission-review-title">{t("Vérifier l'inscription")}</h2>
          <p>{t("Relisez les informations avant la confirmation définitive.")}</p>
        </div>
      </header>
      <div className="admission-review-grid">
        {sections.map((section) => (
          <article key={section.step} className="admission-review-card">
            <header>
              <h3>{t(section.title)}</h3>
              <button type="button" className="button-ghost" onClick={() => onEdit(section.step)}>{t("Modifier")}</button>
            </header>
            <dl>
              {section.rows.map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}
            </dl>
          </article>
        ))}
      </div>
      {!admissionCase.ready ? (
        <div className="notice-card notice-warning" role="alert">
          <strong>{t("Dossier incomplet")}</strong>
          <p>{t("Corrigez les sections signalées avant de confirmer l'inscription.")}</p>
        </div>
      ) : null}
      <div className="admission-step-actions is-split">
        <button type="button" className="button-ghost" onClick={onPrevious}>{t("Précédent")}</button>
        <button type="button" onClick={onFinalize} disabled={busy || !admissionCase.ready}>
          {t(busy ? "Confirmation en cours..." : "Confirmer l'inscription")}
        </button>
      </div>
    </section>
  );
}

export function AdmissionSuccess({
  admissionCase,
  classroom,
  schoolYearLabel,
  studentName,
  t,
  onClose,
  onStartAnother
}: {
  admissionCase: AdmissionCase;
  classroom: AdmissionClassOption | null;
  schoolYearLabel: string;
  studentName: string;
  t: (source: string) => string;
  onClose: () => void;
  onStartAnother: () => void;
}): JSX.Element {
  const result = admissionCase.finalizationResult;
  return (
    <section className="admission-success" role="status" aria-labelledby="admission-success-title">
      <span className="admission-success-mark" aria-hidden="true">✓</span>
      <div>
        <span className="section-kicker">{t("Dossier confirmé")}</span>
        <h2 id="admission-success-title">{t("Inscription confirmée")}</h2>
        <p>{t("Le dossier scolaire a été créé sans paiement ni facture automatique.")}</p>
      </div>
      <dl>
        <div><dt>{t("Élève")}</dt><dd>{studentName}</dd></div>
        <div><dt>{t("Matricule")}</dt><dd>{result?.studentMatricule || "-"}</dd></div>
        <div><dt>{t("Année scolaire")}</dt><dd>{schoolYearLabel || "-"}</dd></div>
        <div><dt>{t("Classe")}</dt><dd>{classroom?.label || "-"}</dd></div>
        <div><dt>{t("Frais")}</dt><dd>{t(result?.finance.mode === "FEE_PLAN" ? "Plan de frais appliqué" : "Frais à traiter ultérieurement")}</dd></div>
      </dl>
      <div className="admission-step-actions">
        <button type="button" className="button-ghost" onClick={onClose}>{t("Voir les inscriptions")}</button>
        <button type="button" onClick={onStartAnother}>{t("Inscrire un autre élève")}</button>
      </div>
    </section>
  );
}
