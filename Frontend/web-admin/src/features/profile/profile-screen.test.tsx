import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  updatedAt: "2026-05-10T08:00:00.000Z"
};

const baseProfileProps = {
  api: vi.fn(),
  currentRoleLabel: "Administrateur",
  locale: "fr-FR",
  onBackToDashboard: vi.fn(),
  onError: vi.fn(),
  onNotice: vi.fn(),
  onProfileChange: vi.fn(),
  remoteEnabled: false,
  schoolName: "Al Manarat Islamiyat",
  schoolYears: [schoolYear],
  session,
  uiLanguage: "fr" as const,
  users: [user]
};

const renderProfile = (overrides: Partial<ComponentProps<typeof ProfileScreen>> = {}) =>
  render(<ProfileScreen {...baseProfileProps} {...overrides} />);

describe("ProfileScreen", () => {
  it("affiche un profil compact sans mélanger préférences, activité ou facturation", () => {
    renderProfile();

    expect(screen.getByRole("heading", { name: "Mon profil" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Informations personnelles" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sécurité" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sessions" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Préférences" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Activité récente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Facturation / abonnement" })).not.toBeInTheDocument();
    expect(screen.queryByText(/passwordHash/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/refreshToken/i)).not.toBeInTheDocument();
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

    await browserUser.click(screen.getByRole("tab", { name: "Sécurité" }));
    const securityPanel = screen.getByText("État du compte").closest(".profile-tab-body") as HTMLElement;
    await browserUser.type(within(securityPanel).getByLabelText("Mot de passe actuel *"), "AncienMot1!");
    await browserUser.type(within(securityPanel).getByLabelText("Nouveau mot de passe *"), "faible");
    await browserUser.type(within(securityPanel).getByLabelText("Confirmation du nouveau mot de passe *"), "different");
    await browserUser.click(within(securityPanel).getByRole("button", { name: "Changer le mot de passe" }));

    expect(within(securityPanel).getAllByText(/au moins 12 caractères/i).length).toBeGreaterThan(0);
    expect(within(securityPanel).getByText("La confirmation ne correspond pas.")).toBeInTheDocument();
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
