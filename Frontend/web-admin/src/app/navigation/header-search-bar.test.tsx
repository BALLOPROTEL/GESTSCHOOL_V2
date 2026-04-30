import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HeaderSearchBar } from "./header-search-bar";

describe("HeaderSearchBar", () => {
  it("soumet la recherche quand l'utilisateur valide le formulaire", () => {
    const handleChange = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <HeaderSearchBar
        value="parents"
        placeholder="Rechercher"
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Rechercher"), { target: { value: "eleves" } });
    fireEvent.submit(screen.getByRole("search"));

    expect(handleChange).toHaveBeenCalledWith("eleves");
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });
});
