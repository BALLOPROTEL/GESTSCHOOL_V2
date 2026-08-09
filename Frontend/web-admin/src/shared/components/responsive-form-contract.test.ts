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
const responsiveCssPath = join(sourceRoot, "styles/responsive-forms.css");

const walkFiles = (directory: string, extension: string): string[] =>
  (readdirSync(directory, { withFileTypes: true }) as DirectoryEntry[]).flatMap((entry) => {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(target, extension);
    return entry.name.endsWith(extension) ? [target] : [];
  });

describe("responsive form source contract", () => {
  it("centralise les trente-sept formulaires métier migrés", () => {
    const productionSources = walkFiles(featuresRoot, ".tsx").filter((file) => !file.includes(".test."));
    const responsiveForms = productionSources.reduce((count, file) => {
      const source = readFileSync(file, "utf8");
      return count + (source.match(/<ResponsiveForm\b/gu)?.length || 0);
    }, 0);

    expect(responsiveForms).toBe(37);
  });

  it("n'utilise plus de confirmation native dans les modules métier", () => {
    const sourceFiles = walkFiles(featuresRoot, ".ts").concat(walkFiles(featuresRoot, ".tsx"));
    const offenders = sourceFiles
      .filter((file) => !file.includes(".test."))
      .filter((file) => readFileSync(file, "utf8").includes("window.confirm"))
      .map((file) => relative(projectRoot, file));

    expect(offenders).toEqual([]);
  });

  it("reste sur les breakpoints R1 sans ajouter de important", () => {
    const responsiveCss = readFileSync(responsiveCssPath, "utf8");
    const breakpoints = [...responsiveCss.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/gu)].map(
      (match) => Number(match[1])
    );

    expect([...new Set(breakpoints)].sort((left, right) => left - right)).toEqual([767, 1023]);
    expect(responsiveCss).not.toContain("!important");
  });
});
