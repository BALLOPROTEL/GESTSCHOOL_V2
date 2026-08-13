import { describe, expect, it } from "vitest";
// @ts-expect-error -- Vitest executes this contract in Node; browser sources exclude Node types.
import { readFileSync } from "node:fs";
// @ts-expect-error -- Vitest executes this contract in Node; browser sources exclude Node types.
import { join } from "node:path";

declare const process: { cwd(): string };

const projectRoot = process.cwd();
const repositoryRoot = join(projectRoot, "../..");
const foundationCss = readFileSync(join(projectRoot, "src/styles/responsive-foundation.css"), "utf8");
const premiumCss = readFileSync(join(projectRoot, "src/styles/premium-v3-foundation.css"), "utf8");
const tablesCss = readFileSync(join(projectRoot, "src/styles/tables.css"), "utf8");
const mobileProductCss = readFileSync(join(projectRoot, "src/styles/mobile-product.css"), "utf8");
const auditSource = readFileSync(join(repositoryRoot, "scripts/visual-audit-core-workflows.mjs"), "utf8");

describe("R7 tablet responsive contract", () => {
  it("conserve uniquement les breakpoints canoniques dans la couche tablette", () => {
    expect(foundationCss).toContain("@media (min-width: 1024px) and (max-width: 1279px)");
    expect(foundationCss).toContain("--gs-responsive-sidebar-link-padding: 0.5rem");
    expect(foundationCss).toContain("white-space: normal");
    expect(premiumCss).toContain("var(--gs-responsive-sidebar-link-padding,");
    expect(premiumCss).toContain("var(--gs-responsive-sidebar-link-gap,");
  });

  it("aligne les tables et actions sur 768 et 1279 pixels", () => {
    expect(tablesCss).toContain("@media (min-width: 768px) and (max-width: 1279px)");
    expect(tablesCss).toContain("@media (max-width: 767px)");
    expect(tablesCss).not.toMatch(/(?:min|max)-width:\s*(?:760|761|1180)px/u);
    expect(mobileProductCss).toContain("@media (min-width: 768px) and (max-width: 1279px)");
    expect(mobileProductCss).not.toMatch(/(?:min|max)-width:\s*(?:760|761|1180)px/u);
  });

  it("garde une matrice Playwright R7 stricte sans allowlist", () => {
    for (const viewport of [
      "boundary767",
      "tabletPortrait",
      "tablet800",
      "tablet820",
      "tablet834",
      "tablet900",
      "tablet1000",
      "boundary1023",
      "compactPortrait",
      "tabletLandscape",
      "tabletLandscape1180",
      "tabletLandscape1194",
      "compact1200",
      "boundary1279",
      "boundary1280"
    ]) {
      expect(auditSource).toContain(`${viewport}:`);
    }
    expect(auditSource).toContain('auditScope === "r7"');
    expect(auditSource).toContain("async function assertR7TabletContract");
    expect(auditSource).toMatch(/allowlist:\s*\[\]/u);
  });
});
