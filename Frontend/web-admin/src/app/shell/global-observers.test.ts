import { describe, expect, it } from "vitest";

const sourceFiles = import.meta.glob("../../**/*.{ts,tsx}", {
  eager: true,
  import: "default",
  query: "?raw"
}) as Record<string, string>;

const productionSources = Object.entries(sourceFiles).filter(
  ([path]) => !path.includes(".test.")
);

describe("global observer guard", () => {
  it("interdit la réintroduction d'un MutationObserver dans le shell global", () => {
    const observerOwners = productionSources
      .filter(([, source]) => source.includes("new MutationObserver"))
      .map(([path]) => path);

    expect(observerOwners).toHaveLength(1);
    expect(observerOwners[0]).toMatch(/legacy-dom-enhancements-boundary\.tsx$/u);
    expect(sourceFiles[observerOwners[0]]).toContain("data-legacy-dom-enhancements");
  });

  it("interdit les anciens branchements globaux i18n et tableaux", () => {
    const forbiddenGlobalBindings = productionSources.filter(
      ([path, source]) =>
        source.includes("useDomTranslation") ||
        source.includes("decorateResponsiveTables") ||
        (source.includes("decorateLegacyResponsiveTables") &&
          !path.endsWith("legacy-dom-enhancements-boundary.tsx") &&
          !path.endsWith("responsive-tables.ts"))
    );

    expect(forbiddenGlobalBindings).toEqual([]);
  });
});
