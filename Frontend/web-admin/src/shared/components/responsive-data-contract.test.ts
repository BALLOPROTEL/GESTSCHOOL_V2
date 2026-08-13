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
const featuresRoot = join(projectRoot, "src/features");
const tablesCssPath = join(projectRoot, "src/styles/tables.css");

const walkFiles = (directory: string, extension: string): string[] =>
  (readdirSync(directory, { withFileTypes: true }) as DirectoryEntry[]).flatMap((entry) => {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(target, extension);
    return entry.name.endsWith(extension) ? [target] : [];
  });

describe("responsive data source contract", () => {
  const productionSources = walkFiles(featuresRoot, ".tsx").filter((file) => !file.includes(".test."));

  it("centralise les quarante-six tables métier", () => {
    const count = productionSources.reduce((total, file) => {
      const source = readFileSync(file, "utf8");
      return total + (source.match(/<ResponsiveDataTable\b/gu)?.length || 0);
    }, 0);
    expect(count).toBe(46);
  });

  it("interdit les anciens conteneurs et menus positionnés dans les lignes", () => {
    const offenders = productionSources
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return source.includes('<div className="table-wrap') || source.includes('<div className="v3-action-menu"');
      })
      .map((file) => relative(projectRoot, file));
    expect(offenders).toEqual([]);
  });

  it("reste sur les breakpoints R1 et ne rajoute pas de dette important", () => {
    const css = readFileSync(tablesCssPath, "utf8");
    const breakpoints = [...css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/gu)].map(
      (match) => Number(match[1])
    );
    expect([...new Set(breakpoints)].sort((left, right) => left - right)).toEqual([420, 767, 1279]);
    expect(css.match(/!important/gu)?.length || 0).toBeLessThanOrEqual(180);
  });
});
