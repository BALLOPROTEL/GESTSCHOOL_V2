import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { translateUiString, type UiLanguage } from "./i18n";
import { I18nProvider, useI18n } from "./i18n-context";

const DASHBOARD_SOURCE = "Tableau de bord";
const CREATE_STUDENT_SOURCE = "Créer un élève";
const SEARCH_SOURCE = "Rechercher un module, un écran, une action...";
const PREVIEW_SOURCE = "Mode aperçu local";
const FEATURE_DISABLED_SOURCE = "Fonctionnalité désactivée";
const USER_CONTENT = "Commentaire libre saisi par la famille";
const LEGACY_SCREEN_LABELS = [
  "Comptes utilisateurs",
  "Base enseignants",
  "Ajouter une salle",
  "Ajouter un élève",
  "Liste des responsables",
  "Annee scolaire",
  "Console de recouvrement",
  "Messagerie",
  "Indicateurs executifs",
  "Module Mosquée",
  "Saisie des notes",
  "Vie scolaire",
  "Journal des absences",
  "Grille d'emploi du temps",
  "Historique notifications",
  "Portail enseignant",
  "Portail parent",
  "Portail élève"
] as const;

afterEach(cleanup);

function TranslationContent(props: { showLazyContent?: boolean }): JSX.Element {
  const { meta, t } = useI18n();

  return (
    <div data-testid="translation-root" dir={meta.dir}>
      <h1>{t(DASHBOARD_SOURCE)}</h1>
      <button type="button">{t(CREATE_STUDENT_SOURCE)}</button>
      <input aria-label={t(SEARCH_SOURCE)} placeholder={t(SEARCH_SOURCE)} />
      <p>{t(PREVIEW_SOURCE)}</p>
      <p data-testid="user-content">{USER_CONTENT}</p>
      <p data-testid="notification-count">{t("12 non lue(s)")}</p>
      {props.showLazyContent ? <p>{t("Chargement du module")}</p> : null}
    </div>
  );
}

function TranslationHarness(props: {
  language: UiLanguage;
  showLazyContent?: boolean;
}): JSX.Element {
  return (
    <I18nProvider language={props.language}>
      <TranslationContent showLazyContent={props.showLazyContent} />
    </I18nProvider>
  );
}

describe("declarative i18n", () => {
  it("rebascule les textes et attributs sans réécriture du DOM", () => {
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

    rerender(<TranslationHarness language="en" showLazyContent />);

    expect(screen.getByTestId("translation-root")).toHaveAttribute("dir", "ltr");
    expect(screen.getByText(translateUiString("en", DASHBOARD_SOURCE))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: translateUiString("en", CREATE_STUDENT_SOURCE) })).toBeInTheDocument();
    expect(screen.getByLabelText(translateUiString("en", SEARCH_SOURCE))).toBeInTheDocument();
    expect(screen.getByText(translateUiString("en", "Chargement du module"))).toBeInTheDocument();

    rerender(<TranslationHarness language="fr" />);

    expect(screen.getByText(DASHBOARD_SOURCE)).toBeInTheDocument();
    expect(screen.queryByText(translateUiString("ar", DASHBOARD_SOURCE))).not.toBeInTheDocument();
    expect(screen.queryByText(translateUiString("en", DASHBOARD_SOURCE))).not.toBeInTheDocument();
  });

  it("traduit les contenus dynamiques connus sans toucher aux données métier libres", () => {
    render(<TranslationHarness language="ar" />);

    expect(screen.getByTestId("notification-count")).toHaveTextContent(
      translateUiString("ar", "12 non lue(s)")
    );
    expect(screen.getByTestId("user-content")).toHaveTextContent(USER_CONTENT);
  });

  it("traduit l'état d'une fonctionnalité désactivée en anglais et en arabe", () => {
    expect(translateUiString("en", FEATURE_DISABLED_SOURCE)).toBe("Feature disabled");
    expect(translateUiString("ar", FEATURE_DISABLED_SOURCE)).toBe("الميزة معطلة");
    expect(
      translateUiString("en", "Cette fonctionnalité n’est pas activée dans cet environnement.")
    ).toBe("This feature is not enabled in this environment.");
    expect(translateUiString("ar", "Ouvrir mon profil")).toBe("فتح ملفي الشخصي");
  });

  it("conserve une traduction déclarative pour les dix-huit destinations migrées", () => {
    const missingEnglish = LEGACY_SCREEN_LABELS.filter(
      (source) => translateUiString("en", source) === source
    );
    const missingArabic = LEGACY_SCREEN_LABELS.filter(
      (source) => translateUiString("ar", source) === source
    );

    expect(missingEnglish).toEqual([]);
    expect(missingArabic).toEqual([]);
  });

  it("traduit les libellés dynamiques des indicateurs de notes", () => {
    for (const source of [
      "Contexte appliqué",
      "Dans le contexte choisi",
      "Matières avec notes",
      "Calculées le",
      "Bulletins générés le",
      "Moyennes et rangs calculés le"
    ]) {
      expect(translateUiString("en", source)).not.toBe(source);
      expect(translateUiString("ar", source)).not.toBe(source);
    }
  });
});
