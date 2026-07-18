import { describe, expect, it } from "vitest";

import {
  getScreenFeatureFlag,
  isScreenFeatureEnabled,
  resolveFeatureFlags
} from "./feature-flags";

describe("feature-flags", () => {
  it("desactive toutes les fonctionnalites provisoires par defaut", () => {
    expect(resolveFeatureFlags({})).toEqual({
      studentPortal: false,
      mosquee: false,
      messages: false,
      userBilling: false
    });
  });

  it("n'active un flag que pour la valeur exacte true", () => {
    expect(resolveFeatureFlags({
      VITE_FEATURE_STUDENT_PORTAL: "true",
      VITE_FEATURE_MOSQUEE: "TRUE",
      VITE_FEATURE_MESSAGES: true,
      VITE_FEATURE_USER_BILLING: "false"
    })).toEqual({
      studentPortal: true,
      mosquee: false,
      messages: false,
      userBilling: false
    });
  });

  it("associe les ecrans provisoires a leur flag sans affecter les modules actifs", () => {
    const disabled = resolveFeatureFlags({});
    expect(getScreenFeatureFlag("studentPortal")).toBe("studentPortal");
    expect(getScreenFeatureFlag("mosquee")).toBe("mosquee");
    expect(getScreenFeatureFlag("messages")).toBe("messages");
    expect(getScreenFeatureFlag("billing")).toBe("userBilling");
    expect(isScreenFeatureEnabled("students", disabled)).toBe(true);
    expect(isScreenFeatureEnabled("studentPortal", disabled)).toBe(false);
  });
});
