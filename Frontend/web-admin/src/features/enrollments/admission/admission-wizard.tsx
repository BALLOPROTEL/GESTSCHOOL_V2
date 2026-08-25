import { useCallback, useEffect, useRef, useState } from "react";

import type { Role } from "../../../shared/types/app";
import { useConfirmDialog } from "../../../shared/components/confirm-dialog";
import {
  AdmissionApiError,
  cancelAdmissionCase,
  createAdmissionCase,
  finalizeAdmissionCase,
  getAdmissionAcademicOptions,
  getAdmissionCase,
  getAdmissionFinanceOptions,
  getAdmissionPrerequisites,
  reopenAdmissionCase,
  saveAdmissionSection,
  searchAdmissionGuardians,
  searchAdmissionStudents
} from "../services/admission-service";
import type { EnrollmentsApiClient } from "../types/enrollments";
import type {
  AdmissionAcademicOptions,
  AdmissionAcademicsDraft,
  AdmissionCase,
  AdmissionFinanceDraft,
  AdmissionFinanceOptions,
  AdmissionGuardianDraft,
  AdmissionGuardianMatch,
  AdmissionGuardianSearchQuery,
  AdmissionMode,
  AdmissionPrerequisites,
  AdmissionStudentDraft,
  AdmissionStudentMatch,
  AdmissionStudentSearchQuery,
  AdmissionWizardStep
} from "../types/admission";
import {
  ADMISSION_MODE_LABELS,
  ADMISSION_STEP_LABELS,
  ADMISSION_STEPS,
  admissionErrorSource,
  admissionStudentName,
  getInitialAdmissionStep,
  issueSource
} from "./admission-copy";
import { AdmissionAcademicsStep } from "./admission-academics-step";
import { AdmissionFinanceStep } from "./admission-finance-step";
import { AdmissionGuardianStep } from "./admission-guardian-step";
import { AdmissionReviewStep, AdmissionSuccess } from "./admission-review-step";
import { AdmissionStudentStep } from "./admission-student-step";

type AdmissionWizardProps = {
  api: EnrollmentsApiClient;
  initialCase?: AdmissionCase | null;
  locale: string;
  role: Role | null;
  t: (source: string) => string;
  onCaseChange: (admissionCase: AdmissionCase) => void;
  onClose: () => void;
  onConfirmed: () => void;
  onNotice: (message: string) => void;
};

type WizardPhase = "LOADING" | "BLOCKED" | "MODE" | "WIZARD" | "SUCCESS";

export const createAdmissionIdempotencyKey = (admissionCaseId: string): string =>
  `admission-finalize:${admissionCaseId}`;

export function AdmissionWizard({
  api,
  initialCase = null,
  locale,
  role,
  t,
  onCaseChange,
  onClose,
  onConfirmed,
  onNotice
}: AdmissionWizardProps): JSX.Element {
  const confirm = useConfirmDialog();
  const [phase, setPhase] = useState<WizardPhase>("LOADING");
  const [prerequisites, setPrerequisites] = useState<AdmissionPrerequisites | null>(null);
  const [admissionCase, setAdmissionCase] = useState<AdmissionCase | null>(initialCase);
  const [mode, setMode] = useState<AdmissionMode | null>(initialCase?.mode || null);
  const [step, setStep] = useState<AdmissionWizardStep>(initialCase ? getInitialAdmissionStep(initialCase) : "STUDENT");
  const [studentDraft, setStudentDraft] = useState<AdmissionStudentDraft>(initialCase?.sections.STUDENT || { matriculeMode: "AUTO" });
  const [guardians, setGuardians] = useState<AdmissionGuardianDraft[]>(initialCase?.sections.GUARDIANS?.guardians || []);
  const [academics, setAcademics] = useState<AdmissionAcademicsDraft>(initialCase?.sections.ACADEMICS || {});
  const [finance, setFinance] = useState<AdmissionFinanceDraft>(initialCase?.sections.FINANCE || {});
  const [academicOptions, setAcademicOptions] = useState<AdmissionAcademicOptions | null>(null);
  const [financeOptions, setFinanceOptions] = useState<AdmissionFinanceOptions | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<AdmissionStudentMatch | null>(null);
  const [studentResults, setStudentResults] = useState<AdmissionStudentMatch[]>([]);
  const [guardianResults, setGuardianResults] = useState<AdmissionGuardianMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [optionsBusy, setOptionsBusy] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [dirty, setDirty] = useState(false);
  const initialCaseId = initialCase?.id || null;
  const onCaseChangeRef = useRef(onCaseChange);

  useEffect(() => {
    onCaseChangeRef.current = onCaseChange;
  }, [onCaseChange]);

  const hydrateCase = useCallback((next: AdmissionCase): void => {
    setAdmissionCase(next);
    setMode(next.mode);
    setStudentDraft(next.sections.STUDENT || { matriculeMode: "AUTO" });
    setGuardians(next.sections.GUARDIANS?.guardians || []);
    setAcademics(next.sections.ACADEMICS || {});
    setFinance(next.sections.FINANCE || {});
    setDirty(false);
    onCaseChangeRef.current(next);
  }, []);

  const handleError = useCallback((caught: unknown): void => {
    const code = caught instanceof AdmissionApiError ? caught.code : null;
    if (code === "ADMISSION_VERSION_CONFLICT") setConflict(true);
    setError(t(admissionErrorSource(code)));
  }, [t]);

  useEffect(() => {
    let active = true;
    const bootstrap = async (): Promise<void> => {
      setPhase("LOADING");
      try {
        const nextPrerequisites = await getAdmissionPrerequisites(api);
        if (!active) return;
        setPrerequisites(nextPrerequisites);
        if (!nextPrerequisites.ready && !initialCaseId) {
          setPhase("BLOCKED");
          return;
        }
        if (initialCaseId) {
          const latest = await getAdmissionCase(api, initialCaseId);
          if (!active) return;
          hydrateCase(latest);
          setStep(getInitialAdmissionStep(latest));
          setPhase(latest.status === "CONFIRMED" ? "SUCCESS" : "WIZARD");
        } else {
          setPhase("MODE");
        }
      } catch (caught) {
        if (!active) return;
        handleError(caught);
        setPhase("BLOCKED");
      }
    };
    void bootstrap();
    return () => { active = false; };
  }, [api, handleError, hydrateCase, initialCaseId]);

  const loadAcademicOptions = useCallback(async (selection: AdmissionAcademicsDraft): Promise<void> => {
    setOptionsBusy(true);
    try {
      const options = await getAdmissionAcademicOptions(api, selection);
      setAcademicOptions(options);
      if (!selection.schoolYearId && options.schoolYears.length === 1) {
        const next = { schoolYearId: options.schoolYears[0]?.id };
        setAcademics(next);
      }
    } catch (caught) {
      handleError(caught);
    } finally {
      setOptionsBusy(false);
    }
  }, [api, handleError]);

  useEffect(() => {
    if (phase === "WIZARD" && step === "ACADEMICS") void loadAcademicOptions(academics);
  }, [phase, step]);

  useEffect(() => {
    if (phase !== "WIZARD" || step !== "FINANCE" || !admissionCase) return;
    let active = true;
    setOptionsBusy(true);
    getAdmissionFinanceOptions(api, admissionCase.id)
      .then((options) => {
        if (!active) return;
        setFinanceOptions(options);
        if (!finance.mode && options.selectedIntent) {
          setFinance({ mode: options.selectedIntent.mode, feePlanId: options.selectedIntent.feePlanId || undefined });
        }
      })
      .catch((caught: unknown) => { if (active) handleError(caught); })
      .finally(() => { if (active) setOptionsBusy(false); });
    return () => { active = false; };
  }, [admissionCase, api, finance.mode, handleError, phase, step]);

  const startMode = async (nextMode: AdmissionMode): Promise<void> => {
    setMode(nextMode);
    setStep("STUDENT");
    setError(null);
    if (nextMode === "RE_ENROLLMENT") {
      setPhase("WIZARD");
      return;
    }
    setBusy(true);
    try {
      const created = await createAdmissionCase(api, nextMode);
      hydrateCase(created);
      setPhase("WIZARD");
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  };

  const searchStudents = async (query: AdmissionStudentSearchQuery): Promise<void> => {
    setSearchBusy(true);
    setError(null);
    try {
      const result = await searchAdmissionStudents(api, query);
      setStudentResults(result.matches);
      if (result.code) setError(t(admissionErrorSource(result.code)));
    } catch (caught) {
      handleError(caught);
    } finally {
      setSearchBusy(false);
    }
  };

  const searchGuardians = async (query: AdmissionGuardianSearchQuery): Promise<void> => {
    setSearchBusy(true);
    setError(null);
    try {
      const result = await searchAdmissionGuardians(api, query);
      setGuardianResults(result.matches);
      if (result.code) setError(t(admissionErrorSource(result.code)));
    } catch (caught) {
      handleError(caught);
    } finally {
      setSearchBusy(false);
    }
  };

  const saveSection = async (section: "STUDENT" | "GUARDIANS" | "ACADEMICS" | "FINANCE", data: Record<string, unknown>, nextStep: AdmissionWizardStep): Promise<void> => {
    if (!admissionCase) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await saveAdmissionSection(api, admissionCase, section, data);
      hydrateCase(updated);
      setStep(nextStep);
      onNotice(t("Brouillon enregistré"));
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  };

  const continueStudent = async (): Promise<void> => {
    if (mode === "RE_ENROLLMENT") {
      if (!selectedStudent) return;
      setBusy(true);
      try {
        const created = admissionCase || await createAdmissionCase(api, "RE_ENROLLMENT", selectedStudent.id);
        hydrateCase(created);
        setStep("GUARDIANS");
        onNotice(t("Brouillon enregistré"));
      } catch (caught) {
        handleError(caught);
      } finally {
        setBusy(false);
      }
      return;
    }
    await saveSection("STUDENT", studentDraft, "GUARDIANS");
  };

  const switchToReEnrollment = async (student: AdmissionStudentMatch): Promise<void> => {
    setBusy(true);
    try {
      if (admissionCase && ["DRAFT", "READY"].includes(admissionCase.status)) {
        await cancelAdmissionCase(api, admissionCase);
      }
      const created = await createAdmissionCase(api, "RE_ENROLLMENT", student.id);
      setSelectedStudent(student);
      hydrateCase(created);
      setMode("RE_ENROLLMENT");
      setStep("GUARDIANS");
      setStudentResults([]);
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  };

  const continueAcademics = (): Promise<void> => saveSection("ACADEMICS", academics, "FINANCE");
  const continueFinance = (): Promise<void> => saveSection("FINANCE", finance, "REVIEW");

  const finalize = async (): Promise<void> => {
    if (!admissionCase || busy) return;
    const accepted = await confirm({
      title: t("Confirmer l'inscription"),
      description: t("Vérifiez que toutes les informations sont exactes avant de confirmer."),
      cancelLabel: t("Revenir au récapitulatif"),
      confirmLabel: t("Confirmer l'inscription")
    });
    if (!accepted) return;
    setBusy(true);
    setError(null);
    try {
      await finalizeAdmissionCase(api, admissionCase, createAdmissionIdempotencyKey(admissionCase.id));
      const confirmed = await getAdmissionCase(api, admissionCase.id);
      hydrateCase(confirmed);
      setPhase("SUCCESS");
      onConfirmed();
    } catch (caught) {
      handleError(caught);
      try {
        const latest = await getAdmissionCase(api, admissionCase.id);
        hydrateCase(latest);
      } catch {
        // Keep local form values after an uncertain network outcome.
      }
    } finally {
      setBusy(false);
    }
  };

  const reopen = async (): Promise<void> => {
    if (!admissionCase) return;
    setBusy(true);
    try {
      const reopened = await reopenAdmissionCase(api, admissionCase);
      hydrateCase(reopened);
      setStep(getInitialAdmissionStep(reopened));
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (): Promise<void> => {
    if (!admissionCase) return onClose();
    const accepted = await confirm({
      title: t("Annuler cette inscription"),
      description: t("Le dossier sera conservé dans l'historique avec le statut annulé."),
      cancelLabel: t("Continuer l'inscription"),
      confirmLabel: t("Annuler l'inscription"),
      tone: "danger"
    });
    if (!accepted) return;
    setBusy(true);
    try {
      const cancelled = await cancelAdmissionCase(api, admissionCase);
      onCaseChange(cancelled);
      onClose();
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  };

  const close = async (): Promise<void> => {
    if (dirty) {
      const accepted = await confirm({
        title: t("Modifications non enregistrées"),
        description: t("Quitter cette étape sans enregistrer les dernières modifications ?"),
        cancelLabel: t("Rester dans l'assistant"),
        confirmLabel: t("Quitter")
      });
      if (!accepted) return;
    }
    if (admissionCase) onNotice(t("Votre inscription a été enregistrée comme brouillon."));
    onClose();
  };

  const reloadAfterConflict = async (): Promise<void> => {
    if (!admissionCase) return;
    setBusy(true);
    try {
      const latest = await getAdmissionCase(api, admissionCase.id);
      hydrateCase(latest);
      setConflict(false);
      setError(null);
      setStep(getInitialAdmissionStep(latest));
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  };

  const startAnother = (): void => {
    setAdmissionCase(null);
    setMode(null);
    setStep("STUDENT");
    setStudentDraft({ matriculeMode: "AUTO" });
    setGuardians([]);
    setAcademics({});
    setFinance({});
    setAcademicOptions(null);
    setFinanceOptions(null);
    setSelectedStudent(null);
    setStudentResults([]);
    setGuardianResults([]);
    setError(null);
    setConflict(false);
    setDirty(false);
    setPhase("MODE");
  };

  if (phase === "LOADING") {
    return <section className="panel admission-loading" role="status"><span className="mini-loader" /><h2>{t("Préparation de l'inscription...")}</h2><p>{t("Vérification des prérequis et des permissions.")}</p></section>;
  }

  if (phase === "BLOCKED") {
    const issues = prerequisites?.blockingIssues || [];
    return (
      <section className="panel admission-blocked" role="alert">
        <span className="section-kicker">{t("Prérequis")}</span>
        <h2>{t("Impossible de commencer l'inscription")}</h2>
        <p>{t("Corrigez les éléments suivants avant de réessayer.")}</p>
        {error ? <p className="field-error">{error}</p> : null}
        <ul>{issues.map((issue) => <li key={`${issue.scope}-${issue.code}`}>{t(issueSource(issue))}</li>)}</ul>
        <button type="button" className="button-ghost" onClick={onClose}>{t("Retour aux inscriptions")}</button>
      </section>
    );
  }

  if (phase === "MODE") {
    return (
      <section className="panel admission-mode" aria-labelledby="admission-mode-title">
        <header>
          <span className="section-kicker">{t("Nouvelle inscription")}</span>
          <h2 id="admission-mode-title">{t("Que souhaitez-vous faire ?")}</h2>
          <p>{t("Choisissez le parcours adapté à la situation de l'élève.")}</p>
        </header>
        {prerequisites?.warnings.length ? <div className="notice-card notice-warning"><strong>{t("Points d'attention")}</strong><ul>{prerequisites.warnings.map((issue) => <li key={issue.code}>{t(issueSource(issue))}</li>)}</ul></div> : null}
        <div className="admission-mode-grid">
          <button type="button" disabled={busy || !prerequisites?.permissions.modes.NEW_ADMISSION.allowed} onClick={() => void startMode("NEW_ADMISSION")}>
            <strong>{t("Inscrire un nouvel élève")}</strong>
            <span>{t("Créer l'identité de l'élève et son dossier scolaire dans un parcours guidé.")}</span>
          </button>
          <button type="button" disabled={busy || !prerequisites?.permissions.modes.RE_ENROLLMENT.allowed} onClick={() => void startMode("RE_ENROLLMENT")}>
            <strong>{t("Réinscrire un élève existant")}</strong>
            <span>{t("Rechercher un élève puis créer son placement pour la nouvelle année.")}</span>
          </button>
        </div>
        {error ? <p className="field-error admission-inline-error" role="alert">{error}</p> : null}
        <div className="admission-step-actions"><button type="button" className="button-ghost" onClick={onClose}>{t("Retour aux inscriptions")}</button></div>
      </section>
    );
  }

  if (phase === "SUCCESS" && admissionCase) {
    const classroom = academicOptions?.classes.find((item) => item.id === admissionCase.sections.ACADEMICS?.classId) || null;
    const schoolYear = academicOptions?.schoolYears.find((item) => item.id === admissionCase.sections.ACADEMICS?.schoolYearId);
    return <AdmissionSuccess admissionCase={admissionCase} classroom={classroom} schoolYearLabel={schoolYear?.label || ""} studentName={selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : admissionStudentName(admissionCase)} t={t} onClose={onClose} onStartAnother={startAnother} />;
  }

  const activeIndex = ADMISSION_STEPS.indexOf(step);
  const classroom = academicOptions?.classes.find((item) => item.id === academics.classId) || null;
  const level = academicOptions?.levels.find((item) => item.id === academics.levelId) || null;
  const schoolYear = academicOptions?.schoolYears.find((item) => item.id === academics.schoolYearId) || null;
  const feePlan = financeOptions?.plans.find((item) => item.id === finance.feePlanId) || null;

  return (
    <div className="admission-wizard" data-admission-step={step}>
      <header className="admission-wizard-header">
        <div><span className="section-kicker">{t(mode ? ADMISSION_MODE_LABELS[mode] : "Inscription")}</span><h1>{t("Assistant d'inscription")}</h1><p>{t("Votre progression est enregistrée à chaque étape.")}</p></div>
        <div className="admission-wizard-header-actions">
          {admissionCase ? <button type="button" className="button-ghost admission-danger-action" onClick={() => void cancel()} disabled={busy}>{t("Annuler cette inscription")}</button> : null}
          <button type="button" className="button-ghost" onClick={() => void close()}>{t("Quitter l'assistant")}</button>
        </div>
      </header>
      <nav className="admission-stepper" aria-label={t("Étapes de l'inscription")}>
        <div className="admission-stepper-summary" aria-hidden="true">
          <span>{activeIndex + 1} / {ADMISSION_STEPS.length}</span>
          <strong>{t(ADMISSION_STEP_LABELS[step])}</strong>
        </div>
        <ol>
          {ADMISSION_STEPS.map((item, index) => (
            <li key={item} className={item === step ? "is-active" : index < activeIndex ? "is-complete" : ""} aria-current={item === step ? "step" : undefined}>
              <span aria-hidden="true">{index < activeIndex ? "✓" : index + 1}</span><strong>{t(ADMISSION_STEP_LABELS[item])}</strong>
            </li>
          ))}
        </ol>
        <progress value={activeIndex + 1} max={ADMISSION_STEPS.length} aria-label={t("Progression de l'inscription")} />
      </nav>
      <div className="admission-save-state" role="status" aria-live="polite">{busy ? t("Enregistrement en cours...") : admissionCase ? t("Brouillon enregistré") : t("Choix en cours")}</div>
      {conflict ? (
        <section className="notice-card notice-warning admission-conflict" role="alert">
          <div><strong>{t("Cette inscription a été modifiée ailleurs.")}</strong><p>{t("Rechargez la version la plus récente avant de continuer.")}</p></div>
          <div><button type="button" onClick={() => void reloadAfterConflict()}>{t("Recharger la version la plus récente")}</button><button type="button" className="button-ghost" onClick={onClose}>{t("Annuler mes changements locaux")}</button></div>
        </section>
      ) : null}
      {admissionCase?.status === "FAILED" ? (
        <section className="notice-card notice-warning admission-failure" role="alert">
          <div><strong>{t("La confirmation a été interrompue")}</strong><p>{t(admissionErrorSource(admissionCase.failureCode))}</p></div>
          {admissionCase.recoveryAction === "EDIT_AND_REVALIDATE" ? <button type="button" onClick={() => void reopen()} disabled={busy}>{t("Corriger le dossier")}</button> : <button type="button" onClick={() => void finalize()} disabled={busy}>{t("Réessayer")}</button>}
        </section>
      ) : null}
      {error && !conflict ? <p className="admission-global-error" role="alert">{error}</p> : null}
      {step === "STUDENT" && mode ? <AdmissionStudentStep busy={busy} draft={studentDraft} mode={mode} role={role} searchBusy={searchBusy} searchResults={studentResults} selectedStudent={selectedStudent} t={t} onChange={(value) => { setStudentDraft(value); setDirty(true); }} onContinue={() => void continueStudent()} onSearch={(query) => void searchStudents(query)} onSelectExisting={setSelectedStudent} onSwitchToReEnrollment={(student) => void switchToReEnrollment(student)} /> : null}
      {step === "GUARDIANS" && mode ? <AdmissionGuardianStep busy={busy} guardians={guardians} mode={mode} searchBusy={searchBusy} searchResults={guardianResults} t={t} onChange={(value) => { setGuardians(value); setDirty(true); }} onContinue={() => mode === "RE_ENROLLMENT" ? setStep("ACADEMICS") : void saveSection("GUARDIANS", { guardians }, "ACADEMICS")} onPrevious={() => setStep("STUDENT")} onSearch={(query) => void searchGuardians(query)} /> : null}
      {step === "ACADEMICS" ? <AdmissionAcademicsStep busy={busy} loading={optionsBusy} options={academicOptions} selection={academics} t={t} onChange={(value) => { setAcademics(value); setDirty(true); void loadAcademicOptions(value); }} onContinue={() => void continueAcademics()} onPrevious={() => setStep("GUARDIANS")} /> : null}
      {step === "FINANCE" ? <AdmissionFinanceStep busy={busy} loading={optionsBusy} options={financeOptions} selection={finance} locale={locale} t={t} onChange={(value) => { setFinance(value); setDirty(true); }} onContinue={() => void continueFinance()} onPrevious={() => setStep("ACADEMICS")} /> : null}
      {step === "REVIEW" && admissionCase ? <AdmissionReviewStep admissionCase={admissionCase} busy={busy} classroom={classroom} feePlan={feePlan} level={level} selectedStudent={selectedStudent} schoolYearLabel={schoolYear?.label || ""} t={t} onEdit={setStep} onFinalize={() => void finalize()} onPrevious={() => setStep("FINANCE")} /> : null}
    </div>
  );
}
