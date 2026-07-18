import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";

import { translateUiString, UI_LANGUAGE_META, useDomTranslation } from "./i18n";
import type { UiLanguage } from "./i18n";

const DASHBOARD_SOURCE = "Tableau de bord";
const CREATE_STUDENT_SOURCE = "Créer un élève";
const SEARCH_SOURCE = "Rechercher un module, un écran, une action...";
const PREVIEW_SOURCE = "Mode aperçu local";

function TranslationHarness({ language }: { language: UiLanguage }): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  useDomTranslation(rootRef, language);

  return (
    <div ref={rootRef} data-testid="translation-root" dir={UI_LANGUAGE_META[language].dir}>
      <h1>{DASHBOARD_SOURCE}</h1>
      <button type="button">{CREATE_STUDENT_SOURCE}</button>
      <input aria-label={SEARCH_SOURCE} placeholder={SEARCH_SOURCE} />
      <p>{PREVIEW_SOURCE}</p>
    </div>
  );
}

describe("useDomTranslation", () => {
  it("rebascule les textes et attributs sans conserver l'ancienne langue", () => {
    const { rerender } = render(<TranslationHarness language="fr" />);

    expect(screen.getByText(DASHBOARD_SOURCE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CREATE_STUDENT_SOURCE })).toBeInTheDocument();
    expect(screen.getByLabelText(SEARCH_SOURCE)).toBeInTheDocument();

    rerender(<TranslationHarness language="ar" />);

    expect(screen.getByTestId("translation-root")).toHaveAttribute("dir", "rtl");
    expect(screen.getByText(translateUiString("ar", DASHBOARD_SOURCE))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: translateUiString("ar", CREATE_STUDENT_SOURCE) })).toBeInTheDocument();
    expect(screen.getByLabelText(translateUiString("ar", SEARCH_SOURCE))).toBeInTheDocument();
    expect(screen.queryByText(DASHBOARD_SOURCE)).not.toBeInTheDocument();

    rerender(<TranslationHarness language="en" />);

    expect(screen.getByTestId("translation-root")).toHaveAttribute("dir", "ltr");
    expect(screen.getByText(translateUiString("en", DASHBOARD_SOURCE))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: translateUiString("en", CREATE_STUDENT_SOURCE) })).toBeInTheDocument();
    expect(screen.getByLabelText(translateUiString("en", SEARCH_SOURCE))).toBeInTheDocument();
    expect(screen.queryByText(translateUiString("ar", DASHBOARD_SOURCE))).not.toBeInTheDocument();

    rerender(<TranslationHarness language="fr" />);

    expect(screen.getByText(DASHBOARD_SOURCE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CREATE_STUDENT_SOURCE })).toBeInTheDocument();
    expect(screen.getByLabelText(SEARCH_SOURCE)).toBeInTheDocument();
    expect(screen.queryByText(translateUiString("ar", DASHBOARD_SOURCE))).not.toBeInTheDocument();
    expect(screen.queryByText(translateUiString("en", DASHBOARD_SOURCE))).not.toBeInTheDocument();
  });
});
