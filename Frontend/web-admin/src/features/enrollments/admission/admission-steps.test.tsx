import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { academicOptions, financeOptions, makeAdmissionCase } from "./admission-test-fixtures";
import { AdmissionAcademicsStep } from "./admission-academics-step";
import { AdmissionFinanceStep } from "./admission-finance-step";
import { AdmissionGuardianStep } from "./admission-guardian-step";
import { AdmissionReviewStep } from "./admission-review-step";
import { AdmissionStudentStep } from "./admission-student-step";

const t = (source: string): string => source;

afterEach(cleanup);

describe("admission student step", () => {
  it("valide les champs minimum d'une nouvelle admission avant de continuer", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<AdmissionStudentStep busy={false} draft={{ matriculeMode: "AUTO" }} mode="NEW_ADMISSION" role="SCOLARITE" searchBusy={false} searchResults={[]} selectedStudent={null} t={t} onChange={vi.fn()} onContinue={onContinue} onSearch={vi.fn()} onSelectExisting={vi.fn()} onSwitchToReEnrollment={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Continuer" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Complétez les champs obligatoires de l'élève.");
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("réserve l'override matricule à ADMIN", () => {
    const { rerender } = render(<AdmissionStudentStep busy={false} draft={{ matriculeMode: "AUTO" }} mode="NEW_ADMISSION" role="SCOLARITE" searchBusy={false} searchResults={[]} selectedStudent={null} t={t} onChange={vi.fn()} onContinue={vi.fn()} onSearch={vi.fn()} onSelectExisting={vi.fn()} onSwitchToReEnrollment={vi.fn()} />);
    expect(screen.queryByText("Options avancées")).not.toBeInTheDocument();

    rerender(<AdmissionStudentStep busy={false} draft={{ matriculeMode: "AUTO" }} mode="NEW_ADMISSION" role="ADMIN" searchBusy={false} searchResults={[]} selectedStudent={null} t={t} onChange={vi.fn()} onContinue={vi.fn()} onSearch={vi.fn()} onSelectExisting={vi.fn()} onSwitchToReEnrollment={vi.fn()} />);
    expect(screen.getByText("Options avancées")).toBeInTheDocument();
  });

  it("affiche le doublon potentiel sans fusion automatique", async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    render(<AdmissionStudentStep busy={false} draft={{ firstName: "Awa", lastName: "Diallo", sex: "F", birthDate: "2015-04-10" }} mode="NEW_ADMISSION" role="ADMIN" searchBusy={false} searchResults={[{ id: "student-1", matchKind: "POSSIBLE_MATCH", signals: ["NAME"], blocksCreation: false, matricule: "GS-1", firstName: "Awa", lastName: "Diallo", birthDate: "2015-04-10", status: "ACTIVE", phoneHint: null, emailHint: null }]} selectedStudent={null} t={t} onChange={vi.fn()} onContinue={vi.fn()} onSearch={vi.fn()} onSelectExisting={vi.fn()} onSwitchToReEnrollment={onSwitch} />);

    expect(screen.getByText("Un élève similaire existe peut-être déjà")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Utiliser pour une réinscription" }));
    expect(onSwitch).toHaveBeenCalledWith(expect.objectContaining({ id: "student-1" }));
  });

  it("n'auto-sélectionne pas un résultat de réinscription", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const student = { id: "student-1", matchKind: "POSSIBLE_MATCH" as const, signals: ["NAME" as const], blocksCreation: false, matricule: "GS-1", firstName: "Awa", lastName: "Diallo", birthDate: null, status: "ACTIVE", phoneHint: null, emailHint: null };
    render(<AdmissionStudentStep busy={false} draft={{}} mode="RE_ENROLLMENT" role="SCOLARITE" searchBusy={false} searchResults={[student]} selectedStudent={null} t={t} onChange={vi.fn()} onContinue={vi.fn()} onSearch={vi.fn()} onSelectExisting={onSelect} onSwitchToReEnrollment={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Réinscrire cet élève" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Sélectionner" }));
    expect(onSelect).toHaveBeenCalledWith(student);
  });
});

describe("admission guardian step", () => {
  const baseProps = {
    busy: false,
    mode: "NEW_ADMISSION" as const,
    searchBusy: false,
    searchResults: [],
    t,
    onContinue: vi.fn(),
    onPrevious: vi.fn(),
    onSearch: vi.fn()
  };

  it("exige au moins un responsable", async () => {
    const user = userEvent.setup();
    render(<AdmissionGuardianStep {...baseProps} guardians={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("group", { name: "Choix du responsable" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuer" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Ajoutez au moins un responsable.");
  });

  it("ajoute un nouveau responsable principal", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AdmissionGuardianStep {...baseProps} guardians={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Ajouter un nouveau responsable" }));
    await user.type(screen.getByLabelText("Prénom"), "Mariam");
    await user.type(screen.getByLabelText("Nom"), "Diallo");
    await user.click(screen.getByRole("button", { name: "Ajouter ce responsable" }));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ firstName: "Mariam", lastName: "Diallo", isPrimaryContact: true })]);
  });

  it("utilise un responsable existant sans le recréer", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AdmissionGuardianStep {...baseProps} guardians={[]} onChange={onChange} searchResults={[{ id: "guardian-1", matchKind: "POSSIBLE_MATCH", signals: ["NAME"], blocksCreation: false, firstName: "Mariam", lastName: "Diallo", parentalRole: "MERE", status: "ACTIVE", phoneHint: "***42", emailHint: null, identityDocumentType: null, identityDocumentHint: null }]} />);

    await user.click(screen.getByRole("button", { name: "Utiliser ce responsable" }));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ source: "EXISTING_GUARDIAN", parentId: "guardian-1", isPrimaryContact: true })]);
  });

  it("conserve exactement un principal après le retrait", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AdmissionGuardianStep {...baseProps} guardians={[{ source: "NEW_GUARDIAN", firstName: "A", lastName: "One", relationType: "MERE", isPrimaryContact: true }, { source: "NEW_GUARDIAN", firstName: "B", lastName: "Two", relationType: "PERE", isPrimaryContact: false }]} onChange={onChange} />);

    await user.click(screen.getAllByRole("button", { name: "Retirer du brouillon" })[0]!);
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ firstName: "B", isPrimaryContact: true })]);
  });

  it("rend les responsables en lecture seule en réinscription", () => {
    render(<AdmissionGuardianStep {...baseProps} mode="RE_ENROLLMENT" guardians={[]} onChange={vi.fn()} />);
    expect(screen.getByText("Relations conservées")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ajouter un nouveau responsable" })).not.toBeInTheDocument();
  });
});

describe("admission academic and finance steps", () => {
  it("réinitialise les dépendances académiques à chaque choix", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AdmissionAcademicsStep busy={false} loading={false} options={academicOptions} selection={{}} t={t} onChange={onChange} onContinue={vi.fn()} onPrevious={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText("Année scolaire"), "year-1");
    expect(onChange).toHaveBeenLastCalledWith({ schoolYearId: "year-1" });
  });

  it("affiche la capacité comme avertissement non bloquant", () => {
    const options = { ...academicOptions, classes: [{ ...academicOptions.classes[0]!, capacityStatus: "FULL" as const, placesRemaining: 0 }] };
    render(<AdmissionAcademicsStep busy={false} loading={false} options={options} selection={{ schoolYearId: "year-1", track: "FRANCOPHONE", cycleId: "cycle-1", levelId: "level-1", classId: "class-1" }} t={t} onChange={vi.fn()} onContinue={vi.fn()} onPrevious={vi.fn()} />);
    expect(screen.getByText("Capacité informative atteinte")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuer" })).toBeEnabled();
  });

  it("enregistre un plan compatible sans demander de paiement", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<AdmissionFinanceStep busy={false} loading={false} options={financeOptions} selection={{}} locale="fr-FR" t={t} onChange={onChange} onContinue={vi.fn()} onPrevious={vi.fn()} />);

    await user.click(screen.getByRole("radio", { name: /Appliquer un plan de frais/u }));
    expect(onChange).toHaveBeenLastCalledWith({ mode: "FEE_PLAN" });
    rerender(<AdmissionFinanceStep busy={false} loading={false} options={financeOptions} selection={{ mode: "FEE_PLAN" }} locale="fr-FR" t={t} onChange={onChange} onContinue={vi.fn()} onPrevious={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: /Plan CM2/u }));
    expect(onChange).toHaveBeenLastCalledWith({ mode: "FEE_PLAN", feePlanId: "plan-1" });
    expect(screen.queryByText(/carte|Mobile Money|montant payé/iu)).not.toBeInTheDocument();
  });

  it("propose le traitement différé explicite", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AdmissionFinanceStep busy={false} loading={false} options={financeOptions} selection={{}} locale="fr-FR" t={t} onChange={onChange} onContinue={vi.fn()} onPrevious={vi.fn()} />);
    expect(screen.getByRole("radiogroup", { name: "Frais de scolarité" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Traiter les frais plus tard/u }));
    expect(onChange).toHaveBeenCalledWith({ mode: "DEFERRED" });
    expect(screen.getByText("L'inscription sera confirmée sans facture ni paiement automatique.")).toBeInTheDocument();
  });

  it("rend un récapitulatif modifiable avant confirmation", () => {
    const admissionCase = makeAdmissionCase({
      status: "READY",
      ready: true,
      sections: {
        STUDENT: { firstName: "Awa", lastName: "Diallo", sex: "F", birthDate: "2015-04-10", matriculeMode: "AUTO" },
        GUARDIANS: { guardians: [{ firstName: "Mariam", lastName: "Diallo", relationType: "MERE", isPrimaryContact: true }] },
        ACADEMICS: financeOptions.academicContext || {},
        FINANCE: { mode: "DEFERRED" },
        DOCUMENTS: null
      }
    });
    render(<AdmissionReviewStep admissionCase={admissionCase} busy={false} classroom={academicOptions.classes[0]!} feePlan={null} level={academicOptions.levels[0]!} selectedStudent={null} schoolYearLabel="Année 2026-2027" t={t} onEdit={vi.fn()} onFinalize={vi.fn()} onPrevious={vi.fn()} />);
    expect(screen.getByText("Awa Diallo")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Modifier" })).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Confirmer l'inscription" })).toBeEnabled();
  });
});
