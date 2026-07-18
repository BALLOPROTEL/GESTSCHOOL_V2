import { describe, expect, it, vi } from "vitest";

import type { FeatureFlags } from "../shared/config/feature-flags";
import { UI_LANGUAGE_META } from "../shared/i18n";
import { createAppNavigationModel } from "./app-navigation-model";

const disabledFlags: FeatureFlags = {
  studentPortal: false,
  mosquee: false,
  messages: false,
  userBilling: false
};
const enabledFlags: FeatureFlags = {
  studentPortal: true,
  mosquee: true,
  messages: true,
  userBilling: true
};

const createModel = (featureFlags: FeatureFlags, role: "ADMIN" | "STUDENT" = "ADMIN") =>
  createAppNavigationModel({
    currentLanguageMeta: UI_LANGUAGE_META.fr,
    currentRole: role,
    featureFlags,
    moduleQueryInput: "",
    selectLanguage: vi.fn(),
    selectScreen: vi.fn(),
    tab: role === "STUDENT" ? "studentPortal" : "dashboard",
    themeMode: "light",
    toggleThemeMode: vi.fn(),
    uiLanguage: "fr"
  });

describe("app navigation feature flags", () => {
  it("masque les modules et actions provisoires quand les flags sont desactives", () => {
    const model = createModel(disabledFlags);
    const sidebarIds = model.sidebarGroups.flatMap((group) => group.items.map((item) => item.id));
    expect(sidebarIds).not.toContain("mosquee");
    expect(model.headerUserActions.map((item) => item.id)).not.toContain("billing");
    expect(model.messagesEnabled).toBe(false);
  });

  it("expose les modules uniquement apres activation explicite", () => {
    const model = createModel(enabledFlags);
    const sidebarIds = model.sidebarGroups.flatMap((group) => group.items.map((item) => item.id));
    expect(sidebarIds).toContain("mosquee");
    expect(model.headerUserActions.map((item) => item.id)).toContain("billing");
    expect(model.messagesEnabled).toBe(true);
  });

  it("masque le portail eleve de la navigation quand il est desactive", () => {
    const disabledModel = createModel(disabledFlags, "STUDENT");
    expect(disabledModel.sidebarGroups).toEqual([
      { id: "portal", title: "Accès rapide", items: [] }
    ]);
    expect(disabledModel.dashboardAction.id).toBe("profile");
    expect(createModel(enabledFlags, "STUDENT").sidebarGroups[0]?.items[0]?.id).toBe("studentPortal");
  });
});
