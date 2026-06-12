import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ParentRecord } from "../../../shared/types/app";
import { ParentsListSection } from "./parents-list-section";

const parent: ParentRecord = {
  id: "parent-1",
  tenantId: "tenant-1",
  parentalRole: "MERE",
  firstName: "Aminata",
  lastName: "Diallo",
  fullName: "Aminata Diallo",
  primaryPhone: "+221770000000",
  email: "aminata@example.com",
  status: "ACTIVE",
  userUsername: "parent.diallo",
  childrenCount: 2,
  primaryChildrenCount: 1,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01"
};

describe("ParentsListSection", () => {
  it("affiche les responsables et expose les actions principales", async () => {
    const user = userEvent.setup();
    const handleEdit = vi.fn();
    const handleSelect = vi.fn();

    render(
      <ParentsListSection
        loading={false}
        onArchiveParent={vi.fn()}
        onEditParent={handleEdit}
        onSearchChange={vi.fn()}
        onSelectParent={handleSelect}
        search=""
        selectedParent={parent}
        shownParents={[parent]}
      />
    );

    expect(screen.getAllByText("Aminata Diallo")).toHaveLength(2);
    expect(screen.getByText("Liste des responsables")).toBeInTheDocument();
    expect(screen.getByText("Compte portail lié")).toBeInTheDocument();
    expect(screen.getAllByText("Actif").length).toBeGreaterThan(0);
    expect(screen.queryByText("ACTIVE")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /actions aminata diallo/i }));
    await user.click(screen.getByRole("button", { name: /voir/i }));
    await user.click(screen.getByRole("button", { name: /actions aminata diallo/i }));
    await user.click(screen.getByRole("button", { name: /modifier/i }));

    expect(handleSelect).toHaveBeenCalledWith("parent-1");
    expect(handleEdit).toHaveBeenCalledWith(parent);
  });
});
