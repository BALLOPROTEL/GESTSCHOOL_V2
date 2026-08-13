import { StrictMode } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useNavigationDrawer } from "./use-navigation-drawer";

afterEach(cleanup);

function DrawerHarness(): JSX.Element {
  const drawer = useNavigationDrawer();
  return (
    <div>
      <button type="button" onClick={(event) => drawer.openFrom(event.currentTarget)}>
        Ouvrir
      </button>
      <div ref={drawer.panelRef} role="dialog" hidden={!drawer.isOpen} tabIndex={-1}>
        <button type="button" data-navigation-drawer-initial-focus onClick={drawer.close}>
          Fermer
        </button>
        <button type="button">Dernière action</button>
      </div>
    </div>
  );
}

describe("useNavigationDrawer", () => {
  it("piège le focus, ferme avec Escape et restaure le déclencheur", async () => {
    const { getByRole } = render(<DrawerHarness />);
    const trigger = getByRole("button", { name: "Ouvrir" });
    fireEvent.click(trigger);

    const close = getByRole("button", { name: "Fermer" });
    const last = getByRole("button", { name: "Dernière action" });
    await waitFor(() => expect(close).toHaveFocus());
    expect(document.documentElement).toHaveClass("mobile-shell-open");

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();
    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(getByRole("dialog", { hidden: true })).not.toBeVisible();
    expect(document.documentElement).not.toHaveClass("mobile-shell-open");
  });

  it("nettoie correctement son cycle de vie sous React Strict Mode", async () => {
    const { getByRole, unmount } = render(
      <StrictMode>
        <DrawerHarness />
      </StrictMode>
    );
    const trigger = getByRole("button", { name: "Ouvrir" });
    fireEvent.click(trigger);
    await waitFor(() => expect(getByRole("button", { name: "Fermer" })).toHaveFocus());
    await waitFor(() => expect(document.documentElement).toHaveClass("mobile-shell-open"));
    unmount();
    expect(document.documentElement).not.toHaveClass("mobile-shell-open");
  });
});
