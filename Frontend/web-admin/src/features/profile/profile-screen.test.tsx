import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SchoolYear, Session, UserAccount } from "../../shared/types/app";
import { PreferencesScreen } from "./account-destination-screens";
import { ProfileScreen } from "./profile-screen";

afterEach(() => {
  cleanup();
});

const session: Session = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  tenantId: "tenant-1",
  user: {
    id: "user-1",
    username: "admin@gestschool.local",
    role: "ADMIN",
    tenantId: "tenant-1",
    email: "admin@gestschool.local",
    displayName: "Admin GestSchool",
    accountType: "STAFF",
    status: "ACTIVE"
  }
};

const schoolYear: SchoolYear = {
  id: "year-1",
  code: "AS-2025-2026",
  label: "Année 2025-2026",
  isActive: true,
  status: "ACTIVE"
};

const user: UserAccount = {
  id: "user-1",
  tenantId: "tenant-1",
  username: "admin@gestschool.local",
  role: "ADMIN",
  roleId: "ADMIN",
  accountType: "STAFF",
  email: "admin@gestschool.local",
  phone: "+22370000000",
  displayName: "Admin GestSchool",
  mustChangePasswordAtFirstLogin: false,
  status: "ACTIVE",
  isActive: true,
  createdAt: "2026-05-01T08:00:00.000Z",
  lastLoginAt: "2026-05-20T09:30:00.000Z",
  updatedAt: "2026-05-10T08:00:00.000Z"
};

const baseProfileProps = {
  api: vi.fn(),
  currentRoleLabel: "Administrateur",
  locale: "fr-FR",
  onError: vi.fn(),
  onLanguageChange: vi.fn(),
  onNotice: vi.fn(),
  onProfileChange: vi.fn(),
  onThemeChange: vi.fn(),
  remoteEnabled: false,
  schoolName: "Al Manarat Islamiyat",
  schoolYears: [schoolYear],
  session,
  themeMode: "light" as const,
  uiLanguage: "fr" as const,
  users: [user]
};

const renderProfile = (overrides: Partial<ComponentProps<typeof ProfileScreen>> = {}) =>
  render(<ProfileScreen {...baseProfileProps} {...overrides} />);

describe("ProfileScreen", () => {
  it("affiche une page profil premium avec les sections principales", () => {
    renderProfile();

    expect(screen.getByRole("heading", { name: "Mon profil" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Informations personnelles" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sécurité du compte" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Préférences" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Activité récente" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mes rôles et permissions" })).toBeInTheDocument();
    expect(screen.getByText(/20 mai 2026/i)).toBeInTheDocument();
    expect(screen.queryByText(/passwordHash/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/refreshToken/i)).not.toBeInTheDocument();
  });

  it("ouvre l’édition du profil et expose les champs personnels modifiables", async () => {
    const browserUser = userEvent.setup();
    renderProfile();

    await browserUser.click(screen.getByRole("button", { name: "Modifier le profil" }));

    expect(screen.getByLabelText("Nom affiché *")).toHaveValue("Admin GestSchool");
    expect(screen.getByLabelText("Prénom")).toBeInTheDocument();
    expect(screen.getByLabelText("Nom")).toBeInTheDocument();
    expect(screen.getByLabelText("Téléphone")).toHaveValue("+22370000000");
  });

  it("refuse un avatar non image et un avatar trop lourd côté frontend", () => {
    const onError = vi.fn();
    renderProfile({ onError });

    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const textFile = new File(["bad"], "notes.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [textFile] } });
    expect(onError).toHaveBeenCalledWith("Format d’image non autorisé. Utilisez JPG, PNG ou WebP.");

    const heavyImage = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "avatar.png", {
      type: "image/png"
    });
    fireEvent.change(input, { target: { files: [heavyImage] } });
    expect(onError).toHaveBeenCalledWith("L’image doit peser 2 Mo maximum.");
  });

  it("valide le changement de mot de passe faible ou avec confirmation différente", async () => {
    const browserUser = userEvent.setup();
    renderProfile();

    const securityCard = screen.getByRole("heading", { name: "Sécurité du compte" }).closest(".premium-profile-card") as HTMLElement;
    await browserUser.click(within(securityCard).getByRole("button", { name: "Modifier" }));
    const securityPanel = securityCard;
    await browserUser.type(within(securityPanel).getByLabelText("Mot de passe actuel *"), "AncienMot1!");
    await browserUser.type(within(securityPanel).getByLabelText("Nouveau mot de passe *"), "faible");
    await browserUser.type(within(securityPanel).getByLabelText("Confirmation du nouveau mot de passe *"), "different");
    await browserUser.click(within(securityPanel).getByRole("button", { name: "Changer le mot de passe" }));

    expect(within(securityPanel).getAllByText(/au moins 12 caractères/i).length).toBeGreaterThan(0);
    expect(within(securityPanel).getByText("La confirmation ne correspond pas.")).toBeInTheDocument();
  });

  it("garde les boutons de visibilité de mot de passe indépendants et stables", async () => {
    const browserUser = userEvent.setup();
    renderProfile();

    const securityPanel = screen.getByRole("heading", { name: "Sécurité du compte" }).closest(".premium-profile-card") as HTMLElement;
    await browserUser.click(within(securityPanel).getByRole("button", { name: "Modifier" }));
    const currentPassword = within(securityPanel).getByLabelText("Mot de passe actuel *");
    const newPassword = within(securityPanel).getByLabelText("Nouveau mot de passe *");
    const confirmation = within(securityPanel).getByLabelText("Confirmation du nouveau mot de passe *");
    const currentToggle = within(securityPanel).getByLabelText("Afficher le mot de passe actuel");
    const newToggle = within(securityPanel).getByLabelText("Afficher le nouveau mot de passe");

    expect(currentPassword).toHaveAttribute("type", "password");
    expect(newPassword).toHaveAttribute("type", "password");
    expect(confirmation).toHaveAttribute("type", "password");

    await browserUser.click(currentToggle);

    expect(currentPassword).toHaveAttribute("type", "text");
    expect(newPassword).toHaveAttribute("type", "password");
    expect(confirmation).toHaveAttribute("type", "password");

    await browserUser.click(newToggle);

    expect(currentPassword).toHaveAttribute("type", "text");
    expect(newPassword).toHaveAttribute("type", "text");
    expect(confirmation).toHaveAttribute("type", "password");
  });

  it("n’injecte pas d’activité fictive quand le profil est chargé depuis l’API", async () => {
    const api = vi.fn(async (path: string) => {
      if (path === "/users/me") {
        return new Response(
          JSON.stringify({
            user,
            context: {
              tenantId: "tenant-1",
              tenantName: "Al Manarat Islamiyat",
              activeSchoolYear: {
                id: schoolYear.id,
                code: schoolYear.code,
                label: schoolYear.label,
                status: schoolYear.status,
                isActive: schoolYear.isActive
              },
              timeZone: "Europe/Paris"
            },
            preferences: {
              language: "fr",
              theme: "light",
              emailNotificationsEnabled: true,
              systemNotificationsEnabled: true
            },
            permissions: []
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (path === "/users/me/activity") {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response("{}", { status: 404 });
    });

    renderProfile({ api, remoteEnabled: true });

    await waitFor(() => expect(api).toHaveBeenCalledWith("/users/me", undefined, true, { background: true }));
    expect(await screen.findByText("Aucune activité récente disponible.")).toBeInTheDocument();
    expect(screen.queryByText("Création d’une classe")).not.toBeInTheDocument();
    expect(screen.queryByText("Export des notes")).not.toBeInTheDocument();
  });
});

describe("PreferencesScreen", () => {
  it("reste une destination séparée du profil et applique langue/thème", async () => {
    const browserUser = userEvent.setup();
    const onLanguageChange = vi.fn();
    const onThemeChange = vi.fn();
    render(
      <PreferencesScreen
        api={vi.fn()}
        onError={vi.fn()}
        onLanguageChange={onLanguageChange}
        onNotice={vi.fn()}
        onThemeChange={onThemeChange}
        remoteEnabled={false}
        schoolName="Al Manarat Islamiyat"
        schoolYears={[schoolYear]}
        session={session}
        themeMode="light"
        uiLanguage="fr"
        users={[user]}
      />
    );

    expect(screen.getByRole("heading", { name: "Préférences" })).toBeInTheDocument();
    await browserUser.selectOptions(screen.getByLabelText("Langue"), "en");
    await browserUser.selectOptions(screen.getByLabelText("Thème"), "dark");
    await browserUser.click(screen.getByRole("button", { name: "Enregistrer les préférences" }));

    expect(onLanguageChange).toHaveBeenCalledWith("en");
    expect(onThemeChange).toHaveBeenCalledWith("dark");
  });
});
