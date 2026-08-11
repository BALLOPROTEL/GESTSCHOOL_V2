import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n-context";
import type { UiLanguage } from "../i18n";
import { ResponsiveDataTable } from "./responsive-data-table";
import { ResponsiveFilterPanel } from "./responsive-filter-panel";
import { ResponsivePagination } from "./responsive-pagination";
import { RowActionMenu } from "./row-action-menu";

let viewportWidth = 390;

const installMatchMedia = (): void => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string): MediaQueryList => {
      const maximum = /max-width:\s*(\d+)px/u.exec(query)?.[1];
      return {
        matches: maximum ? viewportWidth <= Number(maximum) : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      } as unknown as MediaQueryList;
    })
  });
};

const renderWithLanguage = (children: JSX.Element, language: UiLanguage = "fr") =>
  render(<I18nProvider language={language}>{children}</I18nProvider>);

beforeEach(() => {
  viewportWidth = 390;
  installMatchMedia();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe(): void {}
      disconnect(): void {}
    }
  );
});

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("responsive-form-overlay-open");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ResponsiveDataTable", () => {
  it("garde le débordement dans une région locale accessible", async () => {
    renderWithLanguage(
      <ResponsiveDataTable label="Élèves">
        <table><tbody><tr><td>Aminata</td></tr></tbody></table>
      </ResponsiveDataTable>
    );
    const region = screen.getByRole("region", { name: "Élèves" });
    Object.defineProperties(region, {
      clientWidth: { configurable: true, value: 320 },
      scrollWidth: { configurable: true, value: 780 },
      scrollLeft: { configurable: true, writable: true, value: 0 }
    });
    fireEvent.scroll(region);
    await waitFor(() => expect(region).toHaveAttribute("data-scrollable", "true"));
    expect(region).toHaveAttribute("tabindex", "0");
    expect(screen.getByText("Faites défiler le tableau horizontalement")).toHaveAttribute("aria-hidden", "false");
    expect(document.documentElement.scrollWidth).toBe(document.documentElement.clientWidth);
  });

  it("traduit l'indication de défilement en arabe", () => {
    renderWithLanguage(
      <ResponsiveDataTable><table><tbody /></table></ResponsiveDataTable>,
      "ar"
    );
    expect(screen.getByText("مرر الجدول أفقياً")).toBeInTheDocument();
  });
});

function MenuHarness(): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <RowActionMenu label="Actions élève" open={open} onOpenChange={setOpen}>
      <button type="button">Voir</button>
      <button type="button">Modifier</button>
    </RowActionMenu>
  );
}

describe("RowActionMenu", () => {
  it("sort le menu du tableau, gère le clavier et restaure le focus", async () => {
    renderWithLanguage(<MenuHarness />);
    const trigger = screen.getByRole("button", { name: "Actions élève" });
    fireEvent.click(trigger);
    const menu = await screen.findByRole("menu");
    expect(menu.parentElement).toBe(document.body);
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Voir" })).toHaveFocus());
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Modifier" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("se ferme lors d'un clic extérieur", async () => {
    renderWithLanguage(<><MenuHarness /><button type="button">Extérieur</button></>);
    fireEvent.click(screen.getByRole("button", { name: "Actions élève" }));
    await screen.findByRole("menu");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Extérieur" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("se ferme lors du défilement du viewport", async () => {
    renderWithLanguage(<MenuHarness />);
    const trigger = screen.getByRole("button", { name: "Actions élève" });
    fireEvent.click(trigger);
    await screen.findByRole("menu");
    fireEvent.scroll(window);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("ResponsiveFilterPanel", () => {
  it.each([320, 767, 768, 1023])("ouvre un drawer de filtres à %ipx", async (width) => {
    viewportWidth = width;
    renderWithLanguage(
      <ResponsiveFilterPanel title="Filtres élèves" activeCount={2}>
        <label>Statut<select><option>Actif</option></select></label>
      </ResponsiveFilterPanel>
    );
    const trigger = screen.getByRole("button", { name: /Filtres élèves/u });
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Filtres élèves" })).toBeInTheDocument();
    expect(screen.getByText("2 filtres actifs")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it.each([1024, 1279, 1280])("reste inline à partir de 1024 px (%ipx)", (width) => {
    viewportWidth = width;
    renderWithLanguage(
      <ResponsiveFilterPanel title="Filtres élèves"><label>Statut<input /></label></ResponsiveFilterPanel>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Filtres élèves/u })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("applique la direction RTL et traduit le résumé en arabe", async () => {
    viewportWidth = 390;
    renderWithLanguage(
      <ResponsiveFilterPanel title="عوامل تصفية الطلاب" activeCount={1}>
        <label>Statut<input /></label>
      </ResponsiveFilterPanel>,
      "ar"
    );
    fireEvent.click(screen.getByRole("button", { name: /^عوامل تصفية الطلاب/u }));
    const dialog = await screen.findByRole("dialog", { name: "عوامل تصفية الطلاب" });
    expect(dialog).toHaveAttribute("dir", "rtl");
    expect(screen.getByText("1 عامل تصفية نشط")).toBeInTheDocument();
  });
});

describe("ResponsivePagination", () => {
  it("expose des actions compactes et bornées", () => {
    const previous = vi.fn();
    const next = vi.fn();
    renderWithLanguage(
      <ResponsivePagination currentPage={2} totalPages={3} onPrevious={previous} onNext={next} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Page précédente" }));
    fireEvent.click(screen.getByRole("button", { name: "Page suivante" }));
    expect(previous).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
