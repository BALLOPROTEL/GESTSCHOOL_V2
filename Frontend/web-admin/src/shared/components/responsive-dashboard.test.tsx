import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { translateUiString, type UiLanguage } from "../i18n";
import { I18nProvider } from "../i18n-context";
import {
  ResponsiveChartCard,
  ResponsiveKpiCard,
  ResponsiveKpiGrid
} from "./responsive-dashboard";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  cleanup();
});

const renderWithLanguage = (language: UiLanguage, children: ReactNode) =>
  render(<I18nProvider language={language}>{children}</I18nProvider>);

describe("responsive dashboard primitives", () => {
  it("rend une grille typée et conserve le nombre de colonnes desktop demandé", () => {
    renderWithLanguage(
      "fr",
      <ResponsiveKpiGrid label="Indicateurs" desktopColumns={3} priority="secondary">
        <ResponsiveKpiCard label="Élèves" value="12" />
      </ResponsiveKpiGrid>
    );

    const grid = screen.getByRole("group", { name: "Indicateurs" });
    expect(grid).toHaveAttribute("dir", "ltr");
    expect(grid).toHaveAttribute("data-priority", "secondary");
    expect(grid).toHaveStyle("--responsive-kpi-desktop-columns: 3");
  });

  it.each([
    ["loading", "Chargement..."],
    ["empty", "Non disponible"],
    ["error", "Indisponible"]
  ] as const)("rend l'état %s sans valeur métier trompeuse", (state, label) => {
    renderWithLanguage(
      "fr",
      <ResponsiveKpiCard label="Recouvrement" value="98 %" state={state} />
    );

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText("98 %")).not.toBeInTheDocument();
  });

  it("rend la tendance compréhensible sans dépendre uniquement de sa couleur", () => {
    renderWithLanguage(
      "en",
      <ResponsiveKpiCard
        label="Collection"
        value="82 %"
        trend={{ direction: "up", label: "+4 %" }}
        tone="positive"
      />
    );

    expect(screen.getByText("+4 %")).toBeInTheDocument();
    expect(screen.getByText(`(${translateUiString("en", "Tendance positive")})`)).toBeInTheDocument();
  });

  it("applique le RTL et traduit les états en arabe", () => {
    renderWithLanguage(
      "ar",
      <ResponsiveKpiCard ariaLabel="مؤشر" label="التحصيل" value="0" state="loading" />
    );

    const card = screen.getByLabelText("مؤشر");
    expect(card).toHaveAttribute("dir", "rtl");
    expect(card).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(translateUiString("ar", "Chargement..."))).toBeInTheDocument();
  });

  it("expose les valeurs d'un graphique aux technologies d'assistance", () => {
    renderWithLanguage(
      "fr",
      <ResponsiveChartCard
        className="panel"
        title="Recouvrement"
        chartLabel="Recouvrement mensuel"
        summary={[
          { label: "Facturé", value: "100 000 F CFA" },
          { label: "Encaissé", value: "82 000 F CFA" }
        ]}
      >
        <span aria-hidden="true">Graphique</span>
      </ResponsiveChartCard>
    );

    expect(screen.getByRole("img", { name: "Recouvrement mensuel" })).toBeInTheDocument();
    expect(screen.getByText("Facturé")).toBeInTheDocument();
    expect(screen.getByText("100 000 F CFA")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recouvrement" })).toBeInTheDocument();
  });

  it.each(["light", "dark"] as const)("conserve la même structure en thème %s", (theme) => {
    document.documentElement.dataset.theme = theme;
    renderWithLanguage("fr", <ResponsiveKpiCard label="Élèves" value="12" hint="Population" />);

    expect(screen.getByText("Élèves").closest("article")).toHaveAttribute("data-state", "ready");
    expect(screen.getByText("Population")).toBeInTheDocument();
  });
});
