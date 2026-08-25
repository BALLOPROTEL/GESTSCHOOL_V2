import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialogProvider } from "../../../shared/components/confirm-dialog";
import { I18nProvider } from "../../../shared/i18n-context";
import type { AdmissionCase } from "../types/admission";
import { admissionPrerequisites, createAdmissionApi, makeAdmissionCase } from "./admission-test-fixtures";
import { AdmissionWizard, createAdmissionIdempotencyKey } from "./admission-wizard";

const t = (source: string): string => source;

afterEach(cleanup);

const renderWizard = (options: {
  api?: ReturnType<typeof createAdmissionApi>;
  initialCase?: AdmissionCase | null;
} = {}) => {
  const apiState = options.api || createAdmissionApi({ initialCase: options.initialCase || undefined });
  const onCaseChange = vi.fn();
  const onClose = vi.fn();
  const onConfirmed = vi.fn();
  const onNotice = vi.fn();
  render(
    <I18nProvider language="fr">
      <ConfirmDialogProvider>
        <AdmissionWizard
          api={apiState.api}
          initialCase={options.initialCase}
          locale="fr-FR"
          role="ADMIN"
          t={t}
          onCaseChange={onCaseChange}
          onClose={onClose}
          onConfirmed={onConfirmed}
          onNotice={onNotice}
        />
      </ConfirmDialogProvider>
    </I18nProvider>
  );
  return { ...apiState, onCaseChange, onClose, onConfirmed, onNotice };
};

const startNewAdmission = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await screen.findByRole("heading", { name: "Que souhaitez-vous faire ?" });
  await user.click(screen.getByRole("button", { name: /Inscrire un nouvel élève/u }));
  await screen.findByRole("heading", { name: "Identité de l'élève" });
};

const completeNewAdmission = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await startNewAdmission(user);
  await user.type(screen.getByLabelText(/Prénom/u), "Awa");
  await user.type(screen.getByLabelText(/^Nom/u), "Diallo");
  await user.selectOptions(screen.getByLabelText(/Sexe/u), "F");
  await user.type(screen.getByLabelText(/Date de naissance/u), "2015-04-10");
  await user.click(screen.getByRole("button", { name: "Continuer" }));

  await screen.findByRole("heading", { name: "Responsable de l'élève" });
  await user.click(screen.getByRole("button", { name: "Ajouter un nouveau responsable" }));
  await user.type(screen.getByLabelText("Prénom"), "Mariam");
  await user.type(screen.getByLabelText("Nom"), "Diallo");
  await user.click(screen.getByRole("button", { name: "Ajouter ce responsable" }));
  await waitFor(() => expect(screen.getByText("Mariam Diallo")).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Continuer" }));

  await screen.findByRole("heading", { name: "Choisir la scolarité" });
  await waitFor(() => expect(screen.getByLabelText("Année scolaire")).toHaveValue("year-1"));
  await user.selectOptions(screen.getByLabelText("Cursus"), "FRANCOPHONE");
  await user.selectOptions(screen.getByLabelText("Niveau"), "level-1");
  await user.selectOptions(screen.getByLabelText("Classe"), "class-1");
  await user.click(screen.getByRole("button", { name: "Continuer" }));

  await screen.findByRole("heading", { name: "Frais de scolarité" });
  await user.click(screen.getByRole("radio", { name: /Traiter les frais plus tard/u }));
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  await screen.findByRole("heading", { name: "Vérifier l'inscription" });
};

describe("admission wizard orchestration", () => {
  it("ne recharge qu'une fois un même brouillon lorsque sa représentation parent change", async () => {
    const draft = makeAdmissionCase();
    const state = createAdmissionApi({ initialCase: draft });

    const Harness = (): JSX.Element => {
      const [current, setCurrent] = useState(draft);
      return (
        <I18nProvider language="fr">
          <ConfirmDialogProvider>
            <AdmissionWizard
              api={state.api}
              initialCase={current}
              locale="fr-FR"
              role="ADMIN"
              t={t}
              onCaseChange={(updated) => setCurrent({ ...updated })}
              onClose={vi.fn()}
              onConfirmed={vi.fn()}
              onNotice={vi.fn()}
            />
          </ConfirmDialogProvider>
        </I18nProvider>
      );
    };

    render(<Harness />);
    await screen.findByRole("heading", { name: "Identité de l'élève" });
    await waitFor(() => {
      expect(state.calls.filter((call) => call.path === `/admission-cases/${draft.id}`)).toHaveLength(1);
    });
  });

  it("vérifie les prérequis puis crée immédiatement un brouillon NEW_ADMISSION", async () => {
    const user = userEvent.setup();
    const state = renderWizard();

    await startNewAdmission(user);

    expect(state.calls.some((call) => call.path === "/admission-prerequisites")).toBe(true);
    expect(state.calls.find((call) => call.path === "/admission-cases")?.body).toEqual({ mode: "NEW_ADMISSION" });
    expect(screen.getByRole("status")).toHaveTextContent("Brouillon enregistré");
    const stepper = screen.getByRole("navigation", { name: "Étapes de l'inscription" });
    expect(stepper.querySelector("[aria-current='step']")).toHaveTextContent("Élève");
    expect(stepper.querySelector(".admission-stepper-summary")).toHaveTextContent("1 / 5");
  });

  it("bloque le parcours avant saisie lorsque les prérequis échouent", async () => {
    const blocked = { ...admissionPrerequisites, ready: false, blockingIssues: [{ code: "ADMISSION_ACTIVE_CLASS_MISSING", scope: "ACADEMIC" as const }] };
    renderWizard({ api: createAdmissionApi({ prerequisites: blocked }) });

    expect(await screen.findByRole("heading", { name: "Impossible de commencer l'inscription" })).toBeInTheDocument();
    expect(screen.getByText("Aucune classe disponible n'est configurée.")).toBeInTheDocument();
    expect(screen.queryByText("Identité de l'élève")).not.toBeInTheDocument();
  });

  it("recherche puis sélectionne explicitement l'élève avant de créer une réinscription", async () => {
    const user = userEvent.setup();
    const state = renderWizard();
    await screen.findByRole("heading", { name: "Que souhaitez-vous faire ?" });
    await user.click(screen.getByRole("button", { name: /Réinscrire un élève existant/u }));
    await user.type(screen.getByLabelText("Nom ou matricule"), "Awa");
    await user.click(screen.getByRole("button", { name: "Rechercher" }));
    await screen.findByText("Awa Diallo");
    await user.click(screen.getByRole("button", { name: "Sélectionner" }));
    await user.click(screen.getByRole("button", { name: "Réinscrire cet élève" }));

    expect(await screen.findByRole("heading", { name: "Responsables existants" })).toBeInTheDocument();
    expect(state.calls.find((call) => call.path === "/admission-cases" && call.init?.method === "POST")?.body).toEqual({ mode: "RE_ENROLLMENT", studentId: "student-existing" });
  });

  it("finalise le workflow complet et conserve une clé idempotente par dossier", async () => {
    const user = userEvent.setup();
    const state = renderWizard();
    await completeNewAdmission(user);

    await user.click(screen.getByRole("button", { name: "Confirmer l'inscription" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Confirmer l'inscription" }));

    expect(await screen.findByRole("heading", { name: "Inscription confirmée" })).toBeInTheDocument();
    const finalizeCall = state.calls.find((call) => call.path.endsWith("/finalize"));
    expect(finalizeCall?.body).toEqual(expect.objectContaining({ idempotencyKey: createAdmissionIdempotencyKey("case-1") }));
    expect(state.onConfirmed).toHaveBeenCalledOnce();
    expect(screen.getByText("GS-2026-001")).toBeInTheDocument();
  }, 20_000);

  it("affiche un échec retryable avec une action explicite", async () => {
    const user = userEvent.setup();
    const readyCase = makeAdmissionCase({
      status: "READY",
      ready: true,
      completion: { STUDENT: true, GUARDIANS: true, ACADEMICS: true, FINANCE: true, DOCUMENTS: false },
      sections: { STUDENT: { firstName: "Awa", lastName: "Diallo" }, GUARDIANS: { guardians: [] }, ACADEMICS: {}, FINANCE: { mode: "DEFERRED" }, DOCUMENTS: null }
    });
    renderWizard({ initialCase: readyCase, api: createAdmissionApi({ initialCase: readyCase, failFinalizeCode: "HTTP_429" }) });
    await screen.findByRole("heading", { name: "Vérifier l'inscription" });
    await user.click(screen.getByRole("button", { name: "Confirmer l'inscription" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Confirmer l'inscription" }));

    expect(await screen.findByText("La confirmation a été interrompue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("propose reopen pour un échec corrigeable", async () => {
    const user = userEvent.setup();
    const failed = makeAdmissionCase({ status: "FAILED", ready: false, failedAt: "2026-08-23T09:00:00.000Z", failureCode: "PLACEMENT_CONFLICT", recoveryAction: "EDIT_AND_REVALIDATE", completion: { STUDENT: true, GUARDIANS: true, ACADEMICS: true, FINANCE: true, DOCUMENTS: false } });
    const state = renderWizard({ initialCase: failed });

    expect(await screen.findByRole("button", { name: "Corriger le dossier" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Corriger le dossier" }));
    expect(state.calls.some((call) => call.path.endsWith("/reopen"))).toBe(true);
  });

  it("ne franchit pas l'étape lors d'un conflit de version et permet le rechargement", async () => {
    const user = userEvent.setup();
    const state = renderWizard({ api: createAdmissionApi({ conflictSection: "STUDENT" }) });
    await startNewAdmission(user);
    await user.type(screen.getByLabelText(/Prénom/u), "Awa");
    await user.type(screen.getByLabelText(/^Nom/u), "Diallo");
    await user.selectOptions(screen.getByLabelText(/Sexe/u), "F");
    await user.type(screen.getByLabelText(/Date de naissance/u), "2015-04-10");
    await user.click(screen.getByRole("button", { name: "Continuer" }));

    expect(await screen.findByText("Cette inscription a été modifiée ailleurs.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Identité de l'élève" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Recharger la version la plus récente" }));
    expect(state.calls.filter((call) => call.path === "/admission-cases/case-1").length).toBeGreaterThan(0);
  });

  it("reprend un brouillon à la première section incomplète", async () => {
    const draft = makeAdmissionCase({
      version: 3,
      sections: { STUDENT: { firstName: "Awa", lastName: "Diallo", sex: "F", birthDate: "2015-04-10" }, DOCUMENTS: null },
      completion: { STUDENT: true, GUARDIANS: false, ACADEMICS: false, FINANCE: false, DOCUMENTS: false }
    });
    renderWizard({ initialCase: draft });
    expect(await screen.findByRole("heading", { name: "Responsable de l'élève" })).toBeInTheDocument();
  });

  it("annule logiquement le dossier après confirmation sans le supprimer", async () => {
    const user = userEvent.setup();
    const draft = makeAdmissionCase();
    const state = renderWizard({ initialCase: draft });
    await screen.findByRole("heading", { name: "Identité de l'élève" });
    await user.click(screen.getByRole("button", { name: "Annuler cette inscription" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Annuler l'inscription" }));
    await waitFor(() => expect(state.onClose).toHaveBeenCalledOnce());
    expect(state.currentCase().status).toBe("CANCELLED");
    expect(state.calls.some((call) => call.path.endsWith("/cancel"))).toBe(true);
  });
});
