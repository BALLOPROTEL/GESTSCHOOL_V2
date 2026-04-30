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
const mainSource = read("src/main.tsx");
assert(lineCount(appSource) < 2000, "App.tsx doit rester sous 2000 lignes apres extraction du preview et des features.");
assert(appSource.includes("lazy("), "App.tsx doit declarer des imports React.lazy pour le code splitting.");
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

if (failures.length > 0) {
  console.error("Smoke frontend KO:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Smoke frontend OK: shell, lazy loading, isolation features et couches CSS verifies.");
