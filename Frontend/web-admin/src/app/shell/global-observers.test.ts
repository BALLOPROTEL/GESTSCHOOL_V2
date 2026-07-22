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
  it("interdit tout MutationObserver applicatif", () => {
    const observerOwners = productionSources
      .filter(([, source]) => source.includes("new MutationObserver"))
      .map(([path]) => path);

    expect(observerOwners).toEqual([]);
  });

  it("interdit les anciens branchements i18n, tableaux et boundary legacy", () => {
    const forbiddenGlobalBindings = productionSources.filter(
      ([, source]) =>
        source.includes("useDomTranslation") ||
        source.includes("decorateResponsiveTables") ||
        source.includes("decorateLegacyResponsiveTables") ||
        source.includes("LegacyDomEnhancementsBoundary") ||
        source.includes("data-legacy-dom-enhancements")
    );

    expect(forbiddenGlobalBindings).toEqual([]);
  });

  it("exige des métadonnées responsives déclaratives sur chaque tableau métier", () => {
    const featureSources = productionSources.filter(([path]) => path.includes("/features/"));
    const tablesWithoutMetadata: string[] = [];
    const cellsWithoutLabels: string[] = [];

    for (const [path, source] of featureSources) {
      for (const match of source.matchAll(/<table\b[^>]*>/gu)) {
        if (!match[0].includes('data-responsive-table="true"')) {
          tablesWithoutMetadata.push(path);
        }
      }
      for (const match of source.matchAll(/<td\b[^>]*>/gu)) {
        if (!match[0].includes("data-label=") && !match[0].includes("colSpan=")) {
          cellsWithoutLabels.push(path);
        }
      }
    }

    expect([...new Set(tablesWithoutMetadata)]).toEqual([]);
    expect([...new Set(cellsWithoutLabels)]).toEqual([]);
  });
});
