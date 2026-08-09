import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { I18nProvider } from "../i18n-context";
import { ConfirmDialogProvider, useConfirmDialog } from "./confirm-dialog";

function ConfirmationHarness(): JSX.Element {
  const confirm = useConfirmDialog();
  const [result, setResult] = useState("pending");

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void confirm({
            title: "Supprimer l'élément",
            description: "Cette action est irréversible.",
            confirmLabel: "Supprimer",
            tone: "danger"
          }).then((accepted) => setResult(accepted ? "accepted" : "cancelled"));
        }}
      >
        Ouvrir
      </button>
      <output>{result}</output>
    </>
  );
}

afterEach(cleanup);

describe("ConfirmDialog", () => {
  it("place le focus sur l'action sûre et restaure le déclencheur", async () => {
    render(
      <I18nProvider language="fr">
        <ConfirmDialogProvider>
          <ConfirmationHarness />
        </ConfirmDialogProvider>
      </I18nProvider>
    );

    const trigger = screen.getByRole("button", { name: "Ouvrir" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(await screen.findByRole("alertdialog", { name: "Supprimer l'élément" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Annuler" })).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(screen.getByText("accepted")).toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("annule avec Escape", async () => {
    render(
      <I18nProvider language="fr">
        <ConfirmDialogProvider>
          <ConfirmationHarness />
        </ConfirmDialogProvider>
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir" }));
    await screen.findByRole("alertdialog");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.getByText("cancelled")).toBeInTheDocument());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
