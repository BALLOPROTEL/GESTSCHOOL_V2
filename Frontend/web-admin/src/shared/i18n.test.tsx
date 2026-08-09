import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  translateUiMessage,
  translateUiString,
  UI_MESSAGES,
  type UiLanguage
} from "./i18n";
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
const RESPONSIVE_FORM_LABELS = [
  "Absences - saisie de masse",
  "Ajout de justificatif",
  "Ajouter le type",
  "Ajouter un créneau",
  "Ajouter un cycle",
  "Ajouter un document",
  "Ajouter un enseignant",
  "Ajouter un niveau",
  "Ajouter un responsable",
  "Ajouter un élève",
  "Ajouter une année scolaire",
  "Ajouter une classe",
  "Ajouter une compétence",
  "Ajouter une matière",
  "Ajouter une période",
  "Créer l'affectation",
  "Créer un plan de frais",
  "Créer une affectation",
  "Créer une facture",
  "Créer la salle",
  "Créer l'utilisateur",
  "Déclarer une indisponibilité",
  "Enregistrer note",
  "Enregistrer pointage",
  "Enregistrer un paiement",
  "Enregistrer une absence",
  "Enregistrer validation",
  "Génération des bulletins",
  "Lier un responsable à un élève",
  "Modifier inscription",
  "Modifier l'enseignant",
  "Modifier la salle",
  "Modifier le dossier",
  "Modifier le mot de passe",
  "Modifier le profil",
  "Modifier le responsable",
  "Modifier l'utilisateur",
  "Nouvelle inscription",
  "Préférences",
  "Programmer une notification",
  "Saisie des notes par évaluation",
  "Modifications non enregistrées",
  "Abandonner les modifications en cours ?",
  "Continuer la modification",
  "Abandonner",
  "Fermer le formulaire",
  "Ouvrir le formulaire"
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

  it("traduit les commandes du drawer dans les trois langues", () => {
    expect(translateUiString("fr", "Ouvrir le menu")).toBe("Ouvrir le menu");
    expect(translateUiString("en", "Ouvrir le menu")).toBe("Open menu");
    expect(translateUiString("ar", "Ouvrir le menu")).toBe("فتح القائمة");
    expect(translateUiString("en", "Fermer le menu")).toBe("Close menu");
    expect(translateUiString("ar", "Navigation principale")).toBe("التنقل الرئيسي");
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

  it("traduit les formulaires et dialogues responsives en anglais et en arabe", () => {
    const missingEnglish = RESPONSIVE_FORM_LABELS.filter((source) => translateUiString("en", source) === source);
    const missingArabic = RESPONSIVE_FORM_LABELS.filter((source) => translateUiString("ar", source) === source);

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

  it.each([
    ["fr", "Attention", "Fermer"],
    ["en", "Warning", "Close"],
    ["ar", "تنبيه", "إغلاق"]
  ] as const)("traduit les alertes globales en %s", (language, attention, close) => {
    expect(translateUiMessage(language, UI_MESSAGES.toastAttention)).toBe(attention);
    expect(translateUiMessage(language, UI_MESSAGES.toastClose)).toBe(close);
  });

  it("traduit les conflits de suppression sans exposer le message backend", () => {
    expect(translateUiMessage("fr", UI_MESSAGES.schoolYearInUse)).toBe(
      "L'année scolaire ne peut pas être supprimée car elle est encore utilisée."
    );
    expect(translateUiMessage("en", UI_MESSAGES.classInUse)).toBe(
      "The class cannot be deleted because it is still in use."
    );
    expect(translateUiMessage("ar", UI_MESSAGES.schoolYearInUse)).toBe(
      "لا يمكن حذف السنة الدراسية لأنها لا تزال مستخدمة."
    );
  });

  it("possède une traduction FR, EN et AR pour chaque message centralisé", () => {
    for (const token of Object.values(UI_MESSAGES)) {
      for (const language of ["fr", "en", "ar"] as const) {
        const translated = translateUiMessage(language, token);
        expect(translated.trim()).not.toBe("");
        expect(translated).not.toBe(token);
      }
    }
  });

  it("interpole les messages dynamiques dans les trois langues", () => {
    const params = { created: 3, updated: 2, errors: 1 };

    for (const language of ["fr", "en", "ar"] as const) {
      const translated = translateUiMessage(language, UI_MESSAGES.bulkAttendanceCompleted, params);
      expect(translated).toContain("3");
      expect(translated).toContain("2");
      expect(translated).toContain("1");
      expect(translated).not.toMatch(/\{(?:created|updated|errors)\}/u);
    }
  });
});
