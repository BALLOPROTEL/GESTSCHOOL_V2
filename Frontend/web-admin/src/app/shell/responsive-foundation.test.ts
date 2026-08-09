import { describe, expect, it } from "vitest";
// @ts-expect-error -- Vitest runs this source guard in Node; the browser app excludes Node types.
import { readFileSync } from "node:fs";
// @ts-expect-error -- Vitest runs this source guard in Node; the browser app excludes Node types.
import { join } from "node:path";

declare const process: { cwd(): string };

const cssNames = [
  "auth-canvas.css",
  "auth-premium.css",
  "auth.css",
  "controls-foundation.css",
  "dashboard.css",
  "erp-refinement.css",
  "feature-foundation.css",
  "features.css",
  "forms.css",
  "globals.css",
  "header.css",
  "layout.css",
  "mobile-product.css",
  "parents.css",
  "pilotage.css",
  "premium-v3-foundation.css",
  "profile-premium.css",
  "responsive-foundation.css",
  "responsive.css",
  "rooms.css",
  "tables.css",
  "teachers.css",
  "theme-overrides.css",
  "utilities.css",
  "v3-module-unification.css"
] as const;

const cssFiles = Object.fromEntries(
  cssNames.map((name) => [name, readFileSync(join(process.cwd(), "src", "styles", name), "utf8")])
) as Record<(typeof cssNames)[number], string>;

const css = (name: (typeof cssNames)[number]): string => cssFiles[name];

const foundation = css("responsive-foundation.css");
const shellSources = ([
  "responsive-foundation.css",
  "layout.css",
  "utilities.css",
  "header.css",
  "responsive.css",
  "erp-refinement.css",
  "premium-v3-foundation.css",
  "mobile-product.css"
] satisfies Array<keyof typeof cssFiles>).map(css);
const shellCss = shellSources.join("\n");

describe("responsive shell foundation", () => {
  it("déclare les quatre frontières canoniques sans redimensionnement typographique continu", () => {
    expect(foundation).toContain("@media (max-width: 479px)");
    expect(foundation).toContain("@media (min-width: 480px) and (max-width: 767px)");
    expect(foundation).toContain("@media (min-width: 768px) and (max-width: 1023px)");
    expect(foundation).toContain("@media (min-width: 1024px) and (max-width: 1279px)");
    expect(foundation).not.toMatch(/--gs-responsive-(?:page|section)-title-size:\s*clamp\(/u);
  });

  it("centralise les dimensions structurelles et la cible tactile de 44px", () => {
    expect(foundation).toContain("--gs-responsive-touch-target: 2.75rem");
    expect(foundation).toContain("--gs-responsive-header-height: 4rem");
    expect(foundation).toContain("--gs-responsive-sidebar-width: 16rem");
    expect(foundation).toContain("--gs-responsive-rail-width: 4.75rem");
    expect(foundation).toContain("--gs-responsive-safe-top: env(safe-area-inset-top, 0px)");
    expect(foundation).toContain("--gs-responsive-z-drawer: 620");
  });

  it("préserve le desktop et active le rail uniquement entre 768px et 1023px", () => {
    const premium = css("premium-v3-foundation.css");
    expect(premium).toContain(
      "grid-template-columns: var(--gs-responsive-sidebar-width) minmax(0, 1fr) !important"
    );
    expect(premium).toContain("@media (min-width: 768px) and (max-width: 1023px)");
    expect(premium).toContain(
      "grid-template-columns: var(--gs-responsive-rail-width) minmax(0, 1fr) !important"
    );
    expect(premium).not.toContain("@media (min-width: 761px) and (max-width: 1100px)");
  });

  it("n'utilise plus de clipping global pour masquer un débordement document", () => {
    const globalOverflowMasks = [
      /html\s*,\s*body\s*,\s*#root\s*\{[^}]*overflow-x:\s*(?:clip|hidden)/su,
      /body\s*\{[^}]*overflow-x:\s*(?:clip|hidden)/su,
      /\.page:not\(\.page-auth\)\s*\{[^}]*overflow-x:\s*(?:clip|hidden)/su
    ];

    for (const pattern of globalOverflowMasks) {
      expect(shellCss).not.toMatch(pattern);
    }
  });

  it("n'augmente pas la dette !important globale de référence", () => {
    const importantCount = Object.values(cssFiles).reduce(
      (total, source) => total + (source.match(/!important/gu)?.length ?? 0),
      0
    );
    expect(importantCount).toBeLessThanOrEqual(1196);
  });
});
