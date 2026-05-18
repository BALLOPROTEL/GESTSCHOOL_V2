import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { translateUiString } from "../../shared/i18n";
import type { ParentRecord, ParentStudentRelation, Student, UserAccount } from "../../shared/types/app";
import { ParentsScreen } from "../parents-screen";

afterEach(() => {
  cleanup();
});

const failingApi = vi.fn(async () => new Response(null, { status: 500 }));

const student: Student = {
  id: "student-1",
  matricule: "GS-2025-001",
  firstName: "Aicha",
  lastName: "Diallo",
  fullName: "Aicha Diallo",
  sex: "F",
  birthDate: "2014-05-12",
  status: "ACTIVE",
  tracks: ["FRANCOPHONE"],
  placements: [
    {
      placementId: "placement-1",
      track: "FRANCOPHONE",
      placementStatus: "ACTIVE",
      isPrimary: true,
      schoolYearId: "year-1",
      schoolYearCode: "2025-2026",
      levelId: "level-1",
      levelLabel: "CM2",
      classId: "class-1",
      classLabel: "CM2 A"
    }
  ],
  parents: []
};

const parent: ParentRecord = {
  id: "parent-1",
  tenantId: "tenant-1",
  parentalRole: "PERE",
  firstName: "Ousmane",
  lastName: "Diallo",
  fullName: "Ousmane Diallo",
  sex: "M",
  primaryPhone: "+221770000000",
  email: "ousmane@example.com",
  status: "ACTIVE",
  userUsername: "parent.ousmane",
  childrenCount: 1,
  primaryChildrenCount: 1,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01"
};

const relation: ParentStudentRelation = {
  id: "relation-1",
  tenantId: "tenant-1",
  parentId: parent.id,
  studentId: student.id,
  relationType: "PERE",
  isPrimary: true,
  isPrimaryContact: true,
  livesWithStudent: true,
  pickupAuthorized: true,
  legalGuardian: true,
  financialResponsible: true,
  emergencyContact: true,
  status: "ACTIVE",
  parentName: parent.fullName,
  studentMatricule: student.matricule,
  studentName: student.fullName || `${student.firstName} ${student.lastName}`,
  studentTracks: ["FRANCOPHONE"],
  studentPlacements: student.placements || [],
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01"
};

const portalUser: UserAccount = {
  id: "user-parent-1",
  tenantId: "tenant-1",
  username: "parent.ousmane",
  role: "PARENT",
  accountType: "PARENT",
  parentId: parent.id,
  isActive: true,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01"
};

const renderParents = (options?: {
  parents?: ParentRecord[];
  relations?: ParentStudentRelation[];
  students?: Student[];
  users?: UserAccount[];
}) =>
  render(
    <ParentsScreen
      api={failingApi}
      initialParents={options?.parents || []}
      initialRelations={options?.relations || []}
      onError={vi.fn()}
      onNotice={vi.fn()}
      remoteEnabled={false}
      students={options?.students || [student]}
      users={options?.users || [portalUser]}
    />
  );

describe("ParentsScreen", () => {
  it("présente la liste des responsables sans statut technique", () => {
    renderParents({ parents: [parent], relations: [relation] });

    expect(screen.getByRole("tab", { name: "Liste des responsables" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ajouter un responsable" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Liens parent-élève" })).toBeInTheDocument();
    expect(screen.getByText("Un responsable est une personne rattachée à un ou plusieurs élèves. Le compte portail reste optionnel.")).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(within(table).getByText("Actif")).toBeInTheDocument();
    expect(within(table).getByText("Père")).toBeInTheDocument();
    expect(within(table).queryByText("ACTIVE")).not.toBeInTheDocument();
  });

  it("affiche un état vide propre quand aucun responsable n'est présent", () => {
    renderParents();

    expect(screen.getByText("Aucun responsable enregistré.")).toBeInTheDocument();
  });

  it("structure le formulaire responsable avec les champs obligatoires et le portail optionnel", async () => {
    const user = userEvent.setup();
    renderParents({ parents: [parent] });

    await user.click(screen.getByRole("tab", { name: "Ajouter un responsable" }));

    expect(screen.getByRole("heading", { name: "Ajouter un responsable" })).toBeInTheDocument();
    expect(screen.getByText("Fiche responsable")).toBeInTheDocument();
    expect(screen.getByText("Dossier responsable")).toBeInTheDocument();
    expect(screen.queryByText("Metier, pas IAM")).not.toBeInTheDocument();

    for (const label of ["Rôle parental *", "Prénom *", "Nom *", "Téléphone principal *", "Statut *"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }

    expect(screen.getByLabelText("Compte portail optionnel")).toBeInTheDocument();
    expect(screen.getByText("Le compte portail n’est pas créé automatiquement.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer le responsable" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réinitialiser" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voir la liste" })).toBeInTheDocument();
    expect(screen.queryByText("Pere")).not.toBeInTheDocument();
    expect(screen.queryByText("parentUserId")).not.toBeInTheDocument();
  });

  it("structure les liens parent-élève avec rôles métier et cursus en lecture", async () => {
    const user = userEvent.setup();
    renderParents({ parents: [parent], relations: [relation] });

    await user.click(screen.getByRole("tab", { name: "Liens parent-élève" }));

    expect(screen.getByRole("heading", { name: "Liens parent-élève" })).toBeInTheDocument();
    expect(screen.getByLabelText("Parent *")).toBeInTheDocument();
    expect(screen.getByLabelText("Élève *")).toBeInTheDocument();
    expect(screen.getByLabelText("Relation *")).toBeInTheDocument();
    expect(screen.getAllByText("Père").length).toBeGreaterThan(0);
    expect(screen.getByText("Contact d’urgence")).toBeInTheDocument();
    expect(screen.getByText("Autorisé à récupérer l’élève")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer le lien parent-élève" })).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(within(table).getByText("Francophone")).toBeInTheDocument();
    expect(within(table).getByText(/Contact principal/)).toBeInTheDocument();
    expect(within(table).getByText("Actif")).toBeInTheDocument();
    expect(screen.queryByText("Eleve")).not.toBeInTheDocument();
    expect(screen.queryByText("Pere")).not.toBeInTheDocument();
  });

  it("couvre les libellés critiques parents en EN et AR", () => {
    const criticalSources = [
      "Liste des responsables",
      "Ajouter un responsable",
      "Liens parent-élève",
      "Rôle parental *",
      "Téléphone principal *",
      "Compte portail optionnel",
      "Aucun compte portail",
      "Créer le responsable",
      "Voir la liste",
      "Créer le lien parent-élève",
      "Contact principal",
      "Tuteur légal",
      "Responsable financier",
      "Contact d’urgence",
      "Autorisé à récupérer l’élève",
      "Vit avec l’élève",
      "Aucun responsable enregistré.",
      "Aucun lien parent-élève enregistré.",
      "Actif",
      "Inactif",
      "Archivé",
      "3 liens"
    ];

    for (const source of criticalSources) {
      expect(translateUiString("fr", source)).toBe(source);
      expect(translateUiString("en", source)).not.toBe(source);
      expect(translateUiString("ar", source)).not.toBe(source);
    }
  });
});
