import { StrictMode, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { translateUiString, type UiLanguage } from "../i18n";
import { I18nProvider } from "../i18n-context";
import { ConfirmDialogProvider } from "./confirm-dialog";
import { ResponsiveForm } from "./responsive-form";

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

function FormHarness(props: { language?: UiLanguage; openOnMount?: boolean }): JSX.Element {
  const [value, setValue] = useState("");
  const language = props.language || "fr";
  const formTitle = translateUiString(language, "Ajouter un élève");

  return (
    <I18nProvider language={language}>
      <ConfirmDialogProvider>
        <div dir={language === "ar" ? "rtl" : "ltr"}>
          <ResponsiveForm
            className="form-grid module-form"
            formTitle={formTitle}
            openOnMount={props.openOnMount}
            onSubmit={(event) => event.preventDefault()}
          >
            <label>
              {translateUiString(language, "Prénom")}
              <input value={value} onChange={(event) => setValue(event.target.value)} required />
            </label>
            <div className="actions">
              <button type="submit">{translateUiString(language, "Enregistrer")}</button>
            </div>
          </ResponsiveForm>
        </div>
      </ConfirmDialogProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  viewportWidth = 390;
  installMatchMedia();
});

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("responsive-form-overlay-open");
  vi.restoreAllMocks();
});

describe("ResponsiveForm", () => {
  it.each([320, 767, 768, 1023])("affiche une ouverture dédiée à %ipx", async (width) => {
    viewportWidth = width;
    render(<FormHarness />);

    const trigger = screen.getByRole("button", { name: "Ajouter un élève" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog", { name: "Ajouter un élève" })).not.toBeInTheDocument();

    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Ajouter un élève" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(document.documentElement).toHaveClass("responsive-form-overlay-open");
    await waitFor(() => expect(screen.getByRole("button", { name: "Fermer le formulaire" })).toHaveFocus());
  });

  it.each([1024, 1280, 1440])("conserve le formulaire inline à %ipx", (width) => {
    viewportWidth = width;
    render(<FormHarness />);

    expect(screen.queryByRole("button", { name: "Ajouter un élève" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("protège un formulaire modifié et restaure le focus", async () => {
    render(<FormHarness />);
    const trigger = screen.getByRole("button", { name: "Ajouter un élève" });
    fireEvent.click(trigger);
    fireEvent.input(screen.getByRole("textbox"), { target: { value: "Aminata" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer le formulaire" }));

    const confirmation = await screen.findByRole("alertdialog", { name: "Modifications non enregistrées" });
    expect(confirmation).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuer la modification" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Continuer la modification" }));
    expect(await screen.findByRole("dialog", { name: "Ajouter un élève" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fermer le formulaire" }));
    fireEvent.click(await screen.findByRole("button", { name: "Abandonner" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ajouter un élève" })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.documentElement).not.toHaveClass("responsive-form-overlay-open");
  });

  it("ne ferme que l'overlay supérieur avec Escape", async () => {
    render(<FormHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un élève" }));
    fireEvent.input(screen.getByRole("textbox"), { target: { value: "Aminata" } });
    fireEvent.keyDown(document, { key: "Escape" });
    await screen.findByRole("alertdialog");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Ajouter un élève" })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("responsive-form-overlay-open");
  });

  it("piège le focus dans le formulaire", async () => {
    render(<FormHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un élève" }));
    const close = screen.getByRole("button", { name: "Fermer le formulaire" });
    const save = screen.getByRole("button", { name: "Enregistrer" });
    await waitFor(() => expect(close).toHaveFocus());

    save.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();
    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(save).toHaveFocus();
  });

  it("traduit le drawer en arabe et préserve le RTL", async () => {
    render(<FormHarness language="ar" openOnMount />);

    const title = translateUiString("ar", "Ajouter un élève");
    expect(await screen.findByRole("dialog", { name: title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: translateUiString("ar", "Fermer le formulaire") })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("dir", "rtl");
  });

  it("nettoie le scroll lock sous React Strict Mode", async () => {
    const { unmount } = render(
      <StrictMode>
        <FormHarness openOnMount />
      </StrictMode>
    );
    await screen.findByRole("dialog");
    expect(document.documentElement).toHaveClass("responsive-form-overlay-open");
    unmount();
    expect(document.documentElement).not.toHaveClass("responsive-form-overlay-open");
  });
});
