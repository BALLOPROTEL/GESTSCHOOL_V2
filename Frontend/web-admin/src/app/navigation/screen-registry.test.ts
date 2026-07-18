import { describe, expect, it } from "vitest";

import type { FeatureFlags } from "../../shared/config/feature-flags";
import {
  getScreenAccessDecision,
  hasScreenAccess,
  hasScreenRoleAccess
} from "./screen-registry";

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

describe("screen-registry feature access", () => {
  it("distingue le droit du role et la disponibilite fonctionnelle", () => {
    expect(hasScreenRoleAccess("ADMIN", "mosquee")).toBe(true);
    expect(hasScreenAccess("ADMIN", "mosquee", disabledFlags)).toBe(false);
    expect(getScreenAccessDecision("ADMIN", "mosquee", disabledFlags)).toBe("feature-disabled");
    expect(getScreenAccessDecision("SCOLARITE", "mosquee", enabledFlags)).toBe("role-forbidden");
  });

  it("refuse proprement le portail eleve desactive et l'autorise explicitement", () => {
    expect(getScreenAccessDecision("STUDENT", "studentPortal", disabledFlags)).toBe("feature-disabled");
    expect(getScreenAccessDecision("STUDENT", "studentPortal", enabledFlags)).toBe("allowed");
  });

  it("ne change pas l'acces aux modules actifs", () => {
    expect(getScreenAccessDecision("SCOLARITE", "students", disabledFlags)).toBe("allowed");
    expect(getScreenAccessDecision(null, "students", disabledFlags)).toBe("unauthenticated");
  });
});
