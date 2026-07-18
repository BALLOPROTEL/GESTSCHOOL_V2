import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FeatureUnavailableScreen } from "./app-shell-panels";

describe("FeatureUnavailableScreen", () => {
  it("explique qu'un module est desactive et propose une sortie utilisable", () => {
    const onBackToAvailableScreen = vi.fn();
    render(
      <FeatureUnavailableScreen
        actionLabel="Ouvrir mon profil"
        featureLabel="Portail élève"
        onBackToAvailableScreen={onBackToAvailableScreen}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Fonctionnalité désactivée");
    expect(screen.getByRole("heading", { name: "Portail élève" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir mon profil" }));
    expect(onBackToAvailableScreen).toHaveBeenCalledOnce();
  });
});
