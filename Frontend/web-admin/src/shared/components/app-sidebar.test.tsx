import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppSidebar } from "./app-sidebar";

describe("AppSidebar", () => {
  it("rend tous les items dans une structure de liste uniforme", () => {
    const { container } = render(
      <AppSidebar
        brandName="Al Manarat Islamiyat"
        currentRoleLabel="Administrateur"
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
});
