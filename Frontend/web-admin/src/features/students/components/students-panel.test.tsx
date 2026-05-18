import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { translateUiString } from "../../../shared/i18n";
import type { Student } from "../../../shared/types/app";
import { StudentsScreen } from "../students-screen";

afterEach(() => {
  cleanup();
});

const failingApi = vi.fn(async () => new Response(null, { status: 500 }));

const studentWithoutPlacement: Student = {
  id: "student-1",
  matricule: "GS-2025-001",
  firstName: "Aicha",
  lastName: "Diallo",
  fullName: "Aicha Diallo",
  sex: "F",
  birthDate: "2014-05-12",
  status: "ACTIVE",
  tracks: [],
  placements: [],
  parents: []
};

const renderStudents = (initialStudents: Student[] = []) =>
  render(
    <StudentsScreen
      api={failingApi}
      initialStudents={initialStudents}
      onError={vi.fn()}
      onNotice={vi.fn()}
      remoteEnabled={false}
    />
  );

describe("StudentsScreen", () => {
  it("présente un formulaire de dossier administratif clair et sans champs techniques", () => {
    renderStudents();

    expect(screen.getByRole("tab", { name: "Ajouter un élève" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Base élèves" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ajouter un élève" })).toBeInTheDocument();
    expect(screen.getByText("Ce formulaire crée le dossier administratif de l’élève. Les classes et cursus sont gérés ensuite depuis les inscriptions.")).toBeInTheDocument();
    expect(screen.getByText("Identité")).toBeInTheDocument();
    expect(screen.getByText("Coordonnées utiles")).toBeInTheDocument();
    expect(screen.getByText("Scolarité administrative")).toBeInTheDocument();
    expect(screen.getByText("Informations complémentaires")).toBeInTheDocument();

    for (const label of ["Prénom *", "Nom *", "Sexe *", "Date de naissance *", "Établissement *", "Statut *"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }

    expect(screen.getByRole("button", { name: "Créer le dossier" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voir la base élèves" })).toBeInTheDocument();
    expect(screen.queryByText("Identifiant interne")).not.toBeInTheDocument();
    expect(screen.queryByText("Acte de naissance")).not.toBeInTheDocument();
  });

  it("affiche la base élèves sans statut technique ni confusion cursus/dossier", async () => {
    const user = userEvent.setup();
    renderStudents([studentWithoutPlacement]);

    await user.click(screen.getByRole("tab", { name: "Base élèves" }));

    const table = screen.getByRole("table");
    expect(table).toHaveAttribute("data-responsive-table", "true");
    expect(within(table).getByText("Actif")).toBeInTheDocument();
    expect(within(table).getAllByText("À régulariser via inscription").length).toBeGreaterThan(0);
    expect(within(table).getByText("Aucun responsable")).toBeInTheDocument();
    expect(screen.queryByText("ACTIVE")).not.toBeInTheDocument();
  });

  it("affiche un état vide propre quand aucun dossier n'est présent", async () => {
    const user = userEvent.setup();
    renderStudents();

    await user.click(screen.getByRole("tab", { name: "Base élèves" }));

    expect(screen.getByText("Aucun élève enregistré.")).toBeInTheDocument();
  });

  it("couvre les libellés critiques élèves en EN et AR", () => {
    const criticalSources = [
      "Ajouter un élève",
      "Base élèves",
      "Créer le dossier",
      "Voir la base élèves",
      "Dossiers actifs",
      "Élèves bi-cursus",
      "Responsables liés",
      "Dossiers affichés",
      "À régulariser via inscription",
      "Aucun responsable",
      "Aucun élève enregistré.",
      "Archiver",
      "Actif",
      "Inactif",
      "Archivé",
      "Identité",
      "Coordonnées utiles",
      "Scolarité administrative",
      "Informations complémentaires",
      "Dossier consulté",
      "À vérifier",
      "2 responsables",
      "3 dossier(s)"
    ];

    for (const source of criticalSources) {
      expect(translateUiString("fr", source)).toBe(source);
      expect(translateUiString("en", source)).not.toBe(source);
      expect(translateUiString("ar", source)).not.toBe(source);
    }
  });
});
