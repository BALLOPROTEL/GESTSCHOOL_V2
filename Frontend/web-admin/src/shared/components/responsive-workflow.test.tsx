import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n-context";
import { WorkflowNavigation } from "./workflow-guide";
import { ResponsiveWorkflowDisclosure, WorkflowContextBar } from "./responsive-workflow";

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

beforeEach(() => {
  viewportWidth = 390;
  installMatchMedia();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("responsive workflow primitives", () => {
  it("propose un sélecteur compact pour un parcours de plus de quatre étapes", () => {
    const onStepChange = vi.fn();
    render(
      <I18nProvider language="fr">
        <WorkflowNavigation
          title="Enseignants"
          activeStepId="list"
          onStepChange={onStepChange}
          steps={[
            { id: "list", title: "Liste", hint: "Consulter" },
            { id: "skills", title: "Compétences", hint: "Gérer" },
            { id: "assignments", title: "Affectations", hint: "Gérer" },
            { id: "workloads", title: "Charges", hint: "Consulter" },
            { id: "documents", title: "Documents", hint: "Consulter" }
          ]}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Choisir une étape" }), {
      target: { value: "documents" }
    });
    expect(onStepChange).toHaveBeenCalledWith("documents");
  });

  it("conserve le contexte, la traduction arabe et une action explicite", () => {
    const onAction = vi.fn();
    render(
      <I18nProvider language="ar">
        <WorkflowContextBar
          title="Contexte actif"
          items={[{ label: "Classe", value: "CM2 A" }]}
          actionLabel="Modifier le contexte"
          onAction={onAction}
        />
      </I18nProvider>
    );

    expect(screen.getByRole("complementary", { name: "السياق النشط" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تعديل السياق" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("replie puis développe une section secondaire sur mobile", () => {
    render(
      <I18nProvider language="fr">
        <ResponsiveWorkflowDisclosure title="Finance">
          <p>Contenu financier</p>
        </ResponsiveWorkflowDisclosure>
      </I18nProvider>
    );

    expect(screen.queryByText("Contenu financier")).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Afficher" }));
    expect(screen.getByText("Contenu financier")).toBeVisible();
    expect(screen.getByRole("button", { name: "Réduire" })).toHaveAttribute("aria-expanded", "true");
  });

  it("laisse les sections déployées sur tablette et desktop", () => {
    viewportWidth = 820;
    installMatchMedia();
    render(
      <I18nProvider language="fr">
        <ResponsiveWorkflowDisclosure title="Finance">
          <p>Contenu financier</p>
        </ResponsiveWorkflowDisclosure>
      </I18nProvider>
    );

    expect(screen.getByText("Contenu financier")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Afficher" })).not.toBeInTheDocument();
  });
});
