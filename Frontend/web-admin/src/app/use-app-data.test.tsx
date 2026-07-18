import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { UserSelfProfile } from "../shared/types/app";
import { createPreviewAppData } from "./preview/preview-data";
import { createEmptyAppDomainData, useAppDomainState } from "./use-app-data";

const profile: UserSelfProfile = {
  user: {
    id: "user-1",
    tenantId: "tenant-1",
    username: "admin.preview",
    role: "ADMIN",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  context: {
    tenantId: "tenant-1",
    tenantName: "Al Manarat Islamiyat",
    timeZone: "Africa/Dakar"
  },
  permissions: []
};

describe("useAppDomainState", () => {
  it("expose un état métier vide et des actions stables", () => {
    const { result, rerender } = renderHook(() => useAppDomainState());
    const initialActions = result.current.actions;

    expect(result.current.data).toEqual(createEmptyAppDomainData());
    rerender();
    expect(result.current.actions).toBe(initialActions);
  });

  it("hydrate les données de prévisualisation après avoir vidé le profil courant", () => {
    const preview = createPreviewAppData("tenant-1", "CFA", "2026-07-18T12:00:00.000Z");
    const { result } = renderHook(() => useAppDomainState());

    act(() => {
      result.current.actions.setCurrentProfile(profile);
      result.current.actions.applyPreviewData(preview);
    });

    expect(result.current.data.currentProfile).toBeNull();
    expect(result.current.data.students).toEqual(preview.students);
    expect(result.current.data.enrollments).toEqual(preview.enrollments);
    expect(result.current.data.reference.classes).toEqual(preview.classes);
    expect(result.current.data.finance.recovery).toEqual(preview.recovery);
  });

  it("réinitialise toutes les données métier lors de la fin de session", () => {
    const preview = createPreviewAppData("tenant-1", "CFA");
    const { result } = renderHook(() => useAppDomainState());

    act(() => result.current.actions.applyPreviewData(preview));
    expect(result.current.data.students.length).toBeGreaterThan(0);

    act(() => result.current.actions.clearData());
    expect(result.current.data).toEqual(createEmptyAppDomainData());
  });
});
