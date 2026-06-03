import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppSidebar } from "./app-sidebar";
import type { HeaderUserAction } from "../../app/navigation/header-navigation-types";

describe("AppSidebar", () => {
  it("rend tous les items dans une structure de liste uniforme", () => {
    const { container } = render(
      <AppSidebar
        groups={[
          {
            id: "pilotage",
            title: "Pilotage",
            items: [{ id: "dashboard", label: "Tableau de bord", onSelect: vi.fn() }]
          },
          {
            id: "scolarite",
            title: "Scolarite",
            items: [
              { id: "enrollments", label: "Inscriptions", onSelect: vi.fn() },
              { id: "iam", label: "Utilisateurs & droits", onSelect: vi.fn() },
              { id: "teachers", label: "Enseignants", onSelect: vi.fn() }
            ]
          }
        ]}
      />
    );

    const lists = container.querySelectorAll(".sidebar-nav-list");
    const links = container.querySelectorAll(".sidebar-link");

    expect(lists).toHaveLength(2);
    expect(links).toHaveLength(4);

    links.forEach((link) => {
      expect(link.parentElement).toHaveClass("sidebar-nav-list");
      expect(link.querySelector(".sidebar-link-visual")).not.toBeNull();
      expect(link.querySelector(".sidebar-link-icon")).not.toBeNull();
      expect(link.querySelector(".sidebar-link-copy")).not.toBeNull();
    });
  });

  it("ouvre le menu profil depuis le bas de la sidebar et exécute les actions", () => {
    const profileAction = vi.fn();
    const preferencesAction = vi.fn();
    const logoutAction = vi.fn();
    const userActions: HeaderUserAction[] = [
      { id: "profile", icon: "profile", label: "Mon profil", onSelect: profileAction },
      { id: "preferences", icon: "settings", label: "Préférences", onSelect: preferencesAction }
    ];

    const { getByLabelText, getByRole, queryByRole } = render(
      <AppSidebar
        groups={[
          {
            id: "pilotage",
            title: "Pilotage",
            items: [{ id: "dashboard", label: "Tableau de bord", onSelect: vi.fn() }]
          }
        ]}
        onUserLogout={logoutAction}
        user={{
          avatar: "PR",
          email: "preview.admin@gestschool.local",
          roleLabel: "Administrateur",
          username: "preview.admin"
        }}
        userActions={userActions}
      />
    );

    const trigger = getByLabelText("Ouvrir le menu du profil");
    fireEvent.click(trigger);

    expect(getByRole("menu", { name: "Menu profil" })).toBeInTheDocument();
    fireEvent.click(getByRole("menuitem", { name: /Mon profil/i }));
    expect(profileAction).toHaveBeenCalledTimes(1);
    expect(queryByRole("menu", { name: "Menu profil" })).toBeNull();

    fireEvent.click(trigger);
    fireEvent.click(getByRole("menuitem", { name: /Préférences/i }));
    expect(preferencesAction).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    fireEvent.click(getByRole("menuitem", { name: /Se déconnecter/i }));
    expect(logoutAction).toHaveBeenCalledTimes(1);
  });
});
