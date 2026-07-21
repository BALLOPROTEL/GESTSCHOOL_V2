import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { translateUiString } from "../../shared/i18n";
import { LegacyDomEnhancementsBoundary } from "./legacy-dom-enhancements-boundary";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LegacyDomEnhancementsBoundary", () => {
  it("traduit et décore uniquement son sous-arbre legacy", () => {
    render(
      <div>
        <p data-testid="outside">Tableau de bord</p>
        <LegacyDomEnhancementsBoundary language="en">
          <section>
            <h1>Tableau de bord</h1>
            <input aria-label="Rechercher un module, un écran, une action..." />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Élève</th><th>Statut</th></tr>
                </thead>
                <tbody>
                  <tr><td>Aicha Diallo</td><td>Actif</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </LegacyDomEnhancementsBoundary>
      </div>
    );

    expect(screen.getByTestId("outside")).toHaveTextContent("Tableau de bord");
    expect(screen.getByRole("heading")).toHaveTextContent(translateUiString("en", "Tableau de bord"));
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "aria-label",
      translateUiString("en", "Rechercher un module, un écran, une action...")
    );
    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveAttribute("data-label", translateUiString("en", "Élève"));
    expect(cells[1]).toHaveAttribute("data-label", translateUiString("en", "Statut"));
    expect(cells[0]).toHaveTextContent("Aicha Diallo");
  });

  it("déconnecte chaque observer local en React Strict Mode", () => {
    const disconnects: ReturnType<typeof vi.fn>[] = [];
    class FakeMutationObserver {
      disconnect = vi.fn();
      observe = vi.fn();
      takeRecords = vi.fn(() => []);

      constructor() {
        disconnects.push(this.disconnect);
      }
    }
    vi.stubGlobal("MutationObserver", FakeMutationObserver);

    const { unmount } = render(
      <StrictMode>
        <LegacyDomEnhancementsBoundary language="fr">
          <p>Tableau de bord</p>
        </LegacyDomEnhancementsBoundary>
      </StrictMode>
    );
    unmount();

    expect(disconnects.length).toBeGreaterThanOrEqual(1);
    disconnects.forEach((disconnect) => expect(disconnect).toHaveBeenCalledTimes(1));
  });
});
