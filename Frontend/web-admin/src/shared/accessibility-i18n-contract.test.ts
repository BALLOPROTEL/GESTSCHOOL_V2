// @ts-expect-error -- Vitest runs this source guard in Node; the browser app excludes Node types.
import { readFileSync } from "node:fs";
// @ts-expect-error -- Vitest runs this source guard in Node; the browser app excludes Node types.
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { translateUiString } from "./i18n";

declare const process: { cwd(): string };

const root = resolve(process.cwd(), "src");
const referenceSections = [
  "classes",
  "cycles",
  "levels",
  "periods",
  "school-years",
  "subjects"
] as const;

describe("R8 accessibility and i18n source contracts", () => {
  it("couvre les 51 libellés du Référentiel en anglais et en arabe", () => {
    const labels = new Set<string>();
    for (const section of referenceSections) {
      const source = readFileSync(
        resolve(root, `features/reference/components/${section}-section.tsx`),
        "utf8"
      );
      for (const match of source.matchAll(/renderFieldLabel\("([^"]+)"/gu)) labels.add(match[1]);
    }

    expect(labels.size).toBe(51);
    expect([...labels].filter((label) => translateUiString("ar", label) === label)).toEqual([]);
    expect(
      [...labels].filter(
        (label) =>
          translateUiString("en", label) === label &&
          !["Code", "Cycle", "Description", "Nature"].includes(label)
      )
    ).toEqual([]);
  });

  it("interdit les sorties i18n brutes corrigées par R8", () => {
    const header = readFileSync(resolve(root, "app/navigation/header-dropdown-menu.tsx"), "utf8");
    const grades = readFileSync(resolve(root, "features/grades/grades-screen.tsx"), "utf8");
    const referenceMenu = readFileSync(
      resolve(root, "features/reference/components/reference-action-menu.tsx"),
      "utf8"
    );

    expect(header).not.toContain("<span>Préférences</span>");
    expect(header).not.toContain("<small>Langue et thème</small>");
    expect(grades).not.toMatch(/aria-label=\{`(?:Absent|Dispensé|Commentaire) /u);
    expect(referenceMenu).toContain("label={t(label)}");
    expect(referenceMenu).toContain("{t(deleteLabel)}");
  });

  it("inventorie les libellés littéraux non traduits de IAM et du Référentiel", () => {
    const files = [
      resolve(root, "features/iam/iam-screen.tsx"),
      resolve(root, "features/reference/reference-screen.tsx"),
      ...referenceSections.map((section) =>
        resolve(root, `features/reference/components/${section}-section.tsx`)
      )
    ];
    const labels = new Set<string>();
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/tr\("([^"\n]+)"\)/gu)) labels.add(match[1]);
      if (file.endsWith("reference-screen.tsx")) {
        for (const match of source.matchAll(/(?:title|hint): "([^"]+)"/gu)) labels.add(match[1]);
      }
    }
    const neutral = new Set([
      "6A-2526", "6E", "6e", "6e A", "AS-2025-2026", "Al Manarat Islamiyat",
      "B-12", "Code", "D", "M. Diallo", "MATH", "Maths", "PRIM", "T1-2526"
    ]);
    const englishInvariant = new Set([
      "Action", "Actions", "Classes", "Cycle", "Cycles", "Dates", "General", "Nature", "Options", "Type", "cycle(s)"
    ]);

    for (const language of ["ar", "en"] as const) {
      expect(
        [...labels].filter(
          (label) =>
            !neutral.has(label) &&
            !(language === "en" && englishInvariant.has(label)) &&
            translateUiString(language, label) === label
        )
      ).toEqual([]);
    }
  });
});
