import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");

const failures = [];

const read = (relativePath) => readFileSync(path.join(projectRoot, relativePath), "utf8");
const lineCount = (content) => content.split(/\r?\n/).length;

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const walkFiles = (directory) => {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(fullPath);
    return [fullPath];
  });
};

const appSource = read("src/app/App.tsx");
const lazyScreensSource = read("src/app/lazy-screens.tsx");
const mainSource = read("src/main.tsx");
assert(lineCount(appSource) < 2000, "App.tsx doit rester sous 2000 lignes apres extraction du preview et des features.");
assert(
  lazyScreensSource.includes("lazy("),
  "src/app/lazy-screens.tsx doit declarer les imports React.lazy pour le code splitting."
);
assert(
  appSource.includes('from "./lazy-screens"'),
  "App.tsx doit consommer les ecrans lazy depuis src/app/lazy-screens.tsx."
);
assert(appSource.includes("<Suspense"), "App.tsx doit rendre les ecrans lazy dans un Suspense.");
assert(!appSource.includes("preview-sy-2025"), "Les donnees preview lourdes ne doivent plus vivre dans App.tsx.");

const requiredFiles = [
  "src/app/preview/preview-data.ts",
  "src/app/navigation/header-floating-panel.tsx",
  "src/shared/constants/domain.ts",
  "src/shared/services/api-errors.ts",
  "src/features/school-life/types/school-life.ts",
  "src/features/school-life/constants/school-life-labels.ts"
];

for (const file of requiredFiles) {
  assert(existsSync(path.join(projectRoot, file)), `Fichier structurel manquant: ${file}`);
}

const featureFiles = walkFiles(path.join(srcRoot, "features")).filter((file) => /\.(ts|tsx)$/.test(file));
const productionSources = walkFiles(srcRoot).filter(
  (file) => /\.(ts|tsx)$/.test(file) && !/\.(test|spec)\.(ts|tsx)$/.test(file)
);
const mutationObserverSources = productionSources.filter((file) =>
  /\b(?:new\s+)?MutationObserver\s*\(/u.test(readFileSync(file, "utf8"))
);
assert(
  mutationObserverSources.length === 0,
  `Aucun MutationObserver applicatif ne doit etre reintroduit: ${mutationObserverSources
    .map((file) => path.relative(projectRoot, file))
    .join(", ")}`
);
assert(
  !existsSync(path.join(projectRoot, "src/app/shell/legacy-dom-enhancements-boundary.tsx")),
  "La boundary DOM legacy supprimee au LOT 8D ne doit pas revenir."
);
const appNavigationLeaks = featureFiles.filter((file) =>
  readFileSync(file, "utf8").includes("app/navigation/screen-registry")
);
assert(
  appNavigationLeaks.length === 0,
  `Les features ne doivent pas importer app/navigation/screen-registry: ${appNavigationLeaks
    .map((file) => path.relative(projectRoot, file))
    .join(", ")}`
);

const schoolLifeSource = read("src/features/school-life/school-life-panel.tsx");
assert(
  lineCount(schoolLifeSource) < 1250,
  "school-life-panel.tsx doit rester sous 1250 lignes apres extraction types/constantes."
);
assert(
  schoolLifeSource.includes("./types/school-life") && schoolLifeSource.includes("./constants/school-life-labels"),
  "school-life-panel.tsx doit consommer ses types et constantes internes extraits."
);

const legacyGlobalStyle = path.join(projectRoot, "src/styles.css");
assert(!existsSync(legacyGlobalStyle), "L'ancien src/styles.css global ne doit pas revenir.");
assert(!mainSource.includes("shell-foundation.css"), "La couche CSS legacy shell-foundation ne doit pas etre reimportee.");

const expectedStyleLayers = [
  "src/styles/globals.css",
  "src/styles/feature-foundation.css",
  "src/styles/controls-foundation.css",
  "src/styles/responsive-foundation.css",
  "src/styles/theme-overrides.css",
  "src/styles/header.css",
  "src/styles/layout.css",
  "src/styles/dashboard.css",
  "src/styles/forms.css",
  "src/styles/tables.css",
  "src/styles/auth.css",
  "src/styles/auth-premium.css",
  "src/styles/auth-canvas.css",
  "src/styles/features.css",
  "src/styles/teachers.css",
  "src/styles/rooms.css",
  "src/styles/parents.css",
  "src/styles/utilities.css",
  "src/styles/responsive.css"
];

for (const file of expectedStyleLayers) {
  const fullPath = path.join(projectRoot, file);
  assert(existsSync(fullPath), `Couche CSS manquante: ${file}`);
  assert(statSync(fullPath).size > 0, `Couche CSS vide: ${file}`);
}

const cssFiles = walkFiles(srcRoot).filter((file) => file.endsWith(".css"));
const cssBytes = cssFiles.reduce((total, file) => total + statSync(file).size, 0);
const importantCount = cssFiles.reduce(
  (total, file) => total + (readFileSync(file, "utf8").match(/!important/gu)?.length || 0),
  0
);
assert(cssBytes <= 575_000, `Le CSS source depasse le budget LOT 8D: ${cssBytes} octets.`);
assert(importantCount <= 1_200, `Le nombre de !important depasse le budget LOT 8D: ${importantCount}.`);

const removedVisualScripts = [
  "scripts/auth-iam-visual-audit.mjs",
  "scripts/auth-visual-audit.mjs",
  "scripts/dashboard-visual-audit.mjs",
  "scripts/enrollments-visual-audit.mjs",
  "scripts/finance-visual-audit.mjs",
  "scripts/iam-visual-audit.mjs",
  "scripts/parents-visual-audit.mjs",
  "scripts/rooms-visual-audit.mjs",
  "scripts/students-visual-audit.mjs",
  "scripts/teachers-visual-audit.mjs",
  "scripts/visual-audit.mjs"
];
for (const file of removedVisualScripts) {
  assert(!existsSync(path.join(projectRoot, file)), `Script visuel legacy revenu: ${file}`);
}
assert(
  !existsSync(path.resolve(projectRoot, "../../scripts/visual-audit-notes-bulletins.mjs")) &&
    !existsSync(path.resolve(projectRoot, "../../scripts/visual-audit-profile.mjs")),
  "Les scripts visuels legacy racine ne doivent pas revenir."
);

if (failures.length > 0) {
  console.error("Smoke frontend KO:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Smoke frontend OK: structure, dette CSS (${cssBytes} octets, ${importantCount} !important), observers et scripts visuels verifies.`
);
