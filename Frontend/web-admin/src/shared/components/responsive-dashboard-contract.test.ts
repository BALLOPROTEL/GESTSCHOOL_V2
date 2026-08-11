import { describe, expect, it } from "vitest";
// @ts-expect-error -- Vitest runs this source guard in Node; the browser app excludes Node types.
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error -- Vitest runs this source guard in Node; the browser app excludes Node types.
import { join, relative } from "node:path";

declare const process: { cwd(): string };

type DirectoryEntry = {
  isDirectory(): boolean;
  name: string;
};

const projectRoot = process.cwd();
const sourceRoot = join(projectRoot, "src");
const featuresRoot = join(sourceRoot, "features");
const dashboardCssPath = join(sourceRoot, "styles", "responsive-dashboard.css");
const dashboardSourcePath = join(featuresRoot, "dashboard-screen.tsx");

const walkFiles = (directory: string, extension: string): string[] =>
  (readdirSync(directory, { withFileTypes: true }) as DirectoryEntry[]).flatMap((entry) => {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(target, extension);
    return entry.name.endsWith(extension) ? [target] : [];
  });

describe("responsive dashboard source contract", () => {
  const productionSources = walkFiles(featuresRoot, ".tsx").filter((file) => !file.includes(".test."));
  const css = readFileSync(dashboardCssPath, "utf8");

  it("centralise les KPI et graphiques audités dans les primitives R5", () => {
    const source = productionSources.map((file) => readFileSync(file, "utf8")).join("\n");

    expect(source.match(/<ResponsiveKpiCard\b/gu)?.length).toBe(58);
    expect(source.match(/<ResponsiveKpiGrid\b/gu)?.length).toBe(10);
    expect(source.match(/<ResponsiveChartCard\b/gu)?.length).toBe(3);
  });

  it("interdit les anciennes grilles KPI concurrentes", () => {
    const forbidden = [
      "dashboard-kpi-grid-flex",
      "metrics-grid",
      "module-overview-grid",
      "teachers-v3-kpi-grid",
      "pilotage-kpi-grid"
    ];
    const offenders = walkFiles(sourceRoot, ".tsx")
      .concat(walkFiles(join(sourceRoot, "styles"), ".css"))
      .filter((file) => forbidden.some((className) => readFileSync(file, "utf8").includes(className)))
      .map((file) => relative(projectRoot, file));

    expect(offenders).toEqual([]);
  });

  it("utilise uniquement les frontières canoniques R1 et deux KPI compacts sur mobile", () => {
    const maximums = [...css.matchAll(/max-width:\s*(\d+)px/gu)].map((match) => Number(match[1]));
    const minimums = [...css.matchAll(/min-width:\s*(\d+)px/gu)].map((match) => Number(match[1]));

    expect([...new Set(maximums)].sort((left, right) => left - right)).toEqual([479, 767, 1023, 1279]);
    expect([...new Set(minimums)].sort((left, right) => left - right)).toEqual([480, 768, 1024, 1280]);
    expect(css).toMatch(/@media \(max-width: 479px\)[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/u);
    expect(css).toMatch(/@media \(min-width: 768px\) and \(max-width: 1023px\)[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/u);
  });

  it("préserve le premier écran mobile et le desktop déclaré par contexte", () => {
    expect(css).toContain(".dashboard-shell-v2 > .responsive-kpi-grid");
    expect(css).toContain("order: 1");
    expect(css).toContain(".dashboard-shell-v2 > .dashboard-main-grid-summary");
    expect(css).toContain("order: 2");
    expect(css).toContain("@media (min-width: 1280px)");
    expect(css).toContain("repeat(var(--responsive-kpi-desktop-columns), minmax(0, 1fr))");

    const dashboardSource = readFileSync(dashboardSourcePath, "utf8");
    expect(dashboardSource.indexOf("<ResponsiveKpiGrid")).toBeLessThan(
      dashboardSource.indexOf("dashboard-main-grid-summary")
    );
  });

  it("n'ajoute ni important, ni couleur dispersée, ni observer DOM", () => {
    expect(css).not.toContain("!important");
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/iu);
    expect(css).not.toContain("MutationObserver");
  });
});
