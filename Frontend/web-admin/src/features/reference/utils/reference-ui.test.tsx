import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../../shared/i18n-context";
import { ReferenceActionMenu } from "../components/reference-action-menu";
import { renderFieldLabel } from "./reference-ui";

afterEach(cleanup);

describe("reference accessibility and i18n", () => {
  it.each([
    ["fr", "Nom de la classe"],
    ["en", "Class name"],
    ["ar", "اسم الفصل"]
  ] as const)("traduit un libellé de formulaire en %s", (language, expected) => {
    render(
      <I18nProvider language={language}>
        <label>
          {renderFieldLabel("Nom de la classe", { required: true })}
          <input />
        </label>
      </I18nProvider>
    );

    expect(screen.getByRole("textbox", { name: new RegExp(expected, "u") })).toBeInTheDocument();
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("traduit le menu d'action dynamique en arabe", async () => {
    render(
      <I18nProvider language="ar">
        <ReferenceActionMenu label="Options classe 6e A" onDelete={vi.fn()} />
      </I18nProvider>
    );

    const trigger = screen.getByRole("button", { name: "خيارات الفصل 6e A" });
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "حذف" })).toHaveFocus());
  });
});
