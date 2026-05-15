import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HeaderNavigation } from "./header-navigation";
import type { HeaderNavigationAction, HeaderPreferenceAction } from "./header-navigation-types";

const action = (id: string, label: string): HeaderNavigationAction => ({
  id,
  label,
  onSelect: vi.fn()
});

const preferences: HeaderPreferenceAction[] = [
  { id: "language", label: "Francais", onSelect: vi.fn() },
  { id: "theme", label: "Mode", onSelect: vi.fn() }
];

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

describe("HeaderNavigation", () => {
  it("ouvre et ferme le panneau mobile sans casser le shell", () => {
    const { container } = render(
      <HeaderNavigation
        brandName="Al Manarat"
        logoAlt="Logo GestSchool"
        logoSrc="/logo.png"
        sidebarCollapsed={false}
        searchPlaceholder="Rechercher"
        searchValue=""
        onSearchChange={vi.fn()}
        onToggleSidebar={vi.fn()}
        dashboard={action("dashboard", "Tableau de bord")}
        scolarite={[action("students", "Eleves")]}
        schoolLife={[action("grades", "Notes")]}
        settings={[action("reports", "Rapports")]}
        preferences={preferences}
        messages={{ count: 0, label: "Messages", onSelect: vi.fn() }}
        notifications={{ count: 2, label: "Notifications", onSelect: vi.fn() }}
        user={{
          avatar: "AD",
          contextLabel: "GestSchool admin",
          roleLabel: "Administrateur",
          username: "preview.admin",
          onLogout: vi.fn()
        }}
      />
    );

    const mobileToggle = container.querySelector<HTMLButtonElement>(".header-mobile-toggle");
    const mobilePanel = container.querySelector("#header-mobile-panel");
    expect(mobileToggle).not.toBeNull();
    expect(mobilePanel).not.toBeNull();

    fireEvent.click(mobileToggle!);
    expect(mobilePanel).toHaveAttribute("aria-hidden", "false");

    fireEvent.click(container.querySelector<HTMLButtonElement>(".header-mobile-close")!);
    expect(mobilePanel).toHaveAttribute("aria-hidden", "true");
  });

  it("rend les notifications dans une couche flottante hors du header", () => {
    const rectSpy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if (this.classList.contains("global-header-shell")) {
        return domRect({ bottom: 140, height: 90, right: 900, top: 50, width: 860, x: 20, y: 50 });
      }
      if (this.classList.contains("header-notifications-dropdown")) {
        return domRect({ bottom: 92, height: 42, left: 690, right: 742, top: 50, width: 52, x: 690, y: 50 });
      }

      return domRect({});
    });

    const { container } = render(
      <HeaderNavigation
        brandName="Al Manarat"
        logoAlt="Logo GestSchool"
        logoSrc="/logo.png"
        sidebarCollapsed={false}
        searchPlaceholder="Rechercher"
        searchValue=""
        onSearchChange={vi.fn()}
        onToggleSidebar={vi.fn()}
        dashboard={action("dashboard", "Tableau de bord")}
        scolarite={[action("students", "Eleves")]}
        schoolLife={[action("grades", "Notes")]}
        settings={[action("reports", "Rapports")]}
        preferences={preferences}
        messages={{ count: 0, label: "Messages", onSelect: vi.fn() }}
        notifications={{ count: 2, label: "Notifications", onSelect: vi.fn() }}
        user={{
          avatar: "AD",
          contextLabel: "GestSchool admin",
          roleLabel: "Administrateur",
          username: "preview.admin",
          onLogout: vi.fn()
        }}
      />
    );

    const header = container.querySelector(".global-header-shell");
    const notificationButton = container.querySelector<HTMLButtonElement>(
      ".header-notifications-dropdown .header-icon-button"
    );

    fireEvent.click(notificationButton!);

    const floatingPanel = document.body.querySelector<HTMLElement>(
      ".header-floating-panel.header-notifications-dropdown"
    );
    expect(floatingPanel).not.toBeNull();
    expect(floatingPanel?.parentElement).toBe(document.body);
    expect(header?.contains(floatingPanel)).toBe(false);
    expect(floatingPanel?.dataset.headerFloatingPanel).toBe("true");
    expect(floatingPanel?.style.position).toBe("fixed");
    expect(floatingPanel?.style.zIndex).toBe("var(--shell-z-dropdown, 10000)");
    expect(floatingPanel?.style.top).toBe("148px");

    fireEvent.mouseDown(floatingPanel!);
    expect(document.body.querySelector(".header-floating-panel.header-notifications-dropdown")).not.toBeNull();

    fireEvent.mouseDown(document.body);
    expect(document.body.querySelector(".header-floating-panel.header-notifications-dropdown")).toBeNull();

    rectSpy.mockRestore();
  });

  it("rend aussi le menu utilisateur hors du header", () => {
    const rectSpy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if (this.classList.contains("global-header-shell")) {
        return domRect({ bottom: 120, height: 70, right: 900, top: 50, width: 860, x: 20, y: 50 });
      }
      if (this.classList.contains("header-user-menu")) {
        return domRect({ bottom: 96, height: 44, left: 760, right: 820, top: 52, width: 60, x: 760, y: 52 });
      }

      return domRect({});
    });

    const { container } = render(
      <HeaderNavigation
        brandName="Al Manarat"
        logoAlt="Logo GestSchool"
        logoSrc="/logo.png"
        sidebarCollapsed={false}
        searchPlaceholder="Rechercher"
        searchValue=""
        onSearchChange={vi.fn()}
        onToggleSidebar={vi.fn()}
        dashboard={action("dashboard", "Tableau de bord")}
        scolarite={[action("students", "Eleves")]}
        schoolLife={[action("grades", "Notes")]}
        settings={[action("reports", "Rapports")]}
        preferences={preferences}
        messages={{ count: 0, label: "Messages", onSelect: vi.fn() }}
        notifications={{ count: 2, label: "Notifications", onSelect: vi.fn() }}
        user={{
          avatar: "AD",
          contextLabel: "GestSchool admin",
          roleLabel: "Administrateur",
          username: "preview.admin",
          onLogout: vi.fn()
        }}
      />
    );

    fireEvent.click(container.querySelector<HTMLButtonElement>(".header-user-trigger")!);

    const header = container.querySelector(".global-header-shell");
    const userPanel = document.body.querySelector<HTMLElement>(".header-floating-panel.header-user-dropdown");
    expect(userPanel).not.toBeNull();
    expect(userPanel?.parentElement).toBe(document.body);
    expect(header?.contains(userPanel)).toBe(false);
    expect(userPanel?.style.position).toBe("fixed");
    expect(userPanel?.style.top).toBe("128px");

    rectSpy.mockRestore();
  });
});
