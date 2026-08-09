import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "./app-sidebar";
import type { HeaderUserAction } from "../../app/navigation/header-navigation-types";

afterEach(() => {
  cleanup();
  document.documentElement.dir = "ltr";
});

const domRect = (partial: Partial<DOMRect>): DOMRect =>
  ({
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...partial
  }) as DOMRect;

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

    const trigger = getByLabelText("Ouvrir le menu utilisateur");
    fireEvent.click(trigger);

    expect(getByRole("menu", { name: "Compte utilisateur" })).toBeInTheDocument();
    fireEvent.click(getByRole("menuitem", { name: /Mon profil/i }));
    expect(profileAction).toHaveBeenCalledTimes(1);
    expect(queryByRole("menu", { name: "Compte utilisateur" })).toBeNull();

    fireEvent.click(trigger);
    fireEvent.click(getByRole("menuitem", { name: /Préférences/i }));
    expect(preferencesAction).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    fireEvent.click(getByRole("menuitem", { name: /Se déconnecter/i }));
    expect(logoutAction).toHaveBeenCalledTimes(1);
  });

  it("expose l'état actif et les aides accessibles du rail tablette", () => {
    const openNavigation = vi.fn();
    const { getByLabelText, getByRole } = render(
      <AppSidebar
        groups={[
          {
            id: "pilotage",
            title: "Pilotage",
            items: [{ id: "dashboard", label: "Tableau de bord", active: true, onSelect: vi.fn() }]
          }
        ]}
        navigationOpen
        onOpenNavigation={openNavigation}
      />
    );

    const activeLink = getByLabelText("Tableau de bord");
    expect(activeLink).toHaveAttribute("aria-current", "page");
    fireEvent.focus(activeLink);
    expect(getByRole("tooltip")).toHaveTextContent("Tableau de bord");

    const drawerTrigger = getByLabelText("Ouvrir le menu");
    expect(drawerTrigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(drawerTrigger);
    expect(openNavigation).toHaveBeenCalledWith(drawerTrigger);
  });

  it("positionne le tooltip du rail du bon cote en RTL", () => {
    document.documentElement.dir = "rtl";
    const { getByLabelText, getByRole } = render(
      <AppSidebar
        groups={[
          {
            id: "pilotage",
            title: "Pilotage",
            items: [{ id: "dashboard", label: "Tableau de bord", onSelect: vi.fn() }]
          }
        ]}
      />
    );
    const link = getByLabelText("Tableau de bord");
    vi.spyOn(link, "getBoundingClientRect").mockReturnValue(domRect({ left: 76, height: 44, top: 100 }));

    fireEvent.focus(link);
    const tooltip = getByRole("tooltip");
    expect(tooltip).toHaveStyle({ left: "68px", transform: "translate(-100%, -50%)" });
  });

  it("ferme le menu profil avec Escape et restaure le focus", () => {
    const { getByLabelText, getByRole, queryByRole } = render(
      <AppSidebar
        groups={[
          {
            id: "pilotage",
            title: "Pilotage",
            items: [{ id: "dashboard", label: "Tableau de bord", onSelect: vi.fn() }]
          }
        ]}
        user={{ avatar: "PR", roleLabel: "Administrateur", username: "preview.admin" }}
      />
    );

    const trigger = getByLabelText("Ouvrir le menu utilisateur");
    fireEvent.click(trigger);
    expect(getByRole("menu", { name: "Compte utilisateur" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(queryByRole("menu", { name: "Compte utilisateur" })).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
