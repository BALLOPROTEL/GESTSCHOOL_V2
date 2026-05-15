import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.VISUAL_AUDIT_URL || "http://127.0.0.1:5180";
const outputRoot = process.env.VISUAL_AUDIT_OUTPUT || "/tmp/gestschool-teachers-audit";
const runId = new Date().toISOString().replace(/[:.]/gu, "-");
const outputDir = path.join(outputRoot, runId);

const storageKeys = {
  language: "gestschool.web-admin.language",
  session: "gestschool.web-admin.session",
  theme: "gestschool.web-admin.theme"
};

const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 }
};

const screenshots = [];
const findings = [];
const consoleErrors = [];

const safeName = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");

async function createContext(browser, viewport, language = "fr", theme = "light") {
  const context = await browser.newContext({
    colorScheme: theme,
    deviceScaleFactor: 1,
    hasTouch: viewport.width <= 768,
    isMobile: viewport.width <= 480,
    locale: language === "ar" ? "ar" : language === "en" ? "en-US" : "fr-FR",
    viewport
  });

  await context.addInitScript(
    ({ keys, selectedLanguage, selectedTheme }) => {
      try {
        window.localStorage.setItem(keys.language, selectedLanguage);
        window.localStorage.setItem(keys.theme, selectedTheme);
        window.localStorage.removeItem(keys.session);
        window.sessionStorage.removeItem(keys.session);
      } catch {
        // Initial browser documents can have opaque origins before the app URL is loaded.
      }
    },
    { keys: storageKeys, selectedLanguage: language, selectedTheme: theme }
  );

  context.on("page", (page) => {
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
  });

  return context;
}

async function openPreview(page) {
  await page.goto(`${baseUrl}/#preview-admin`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-shell", { timeout: 20_000 });
  await page.waitForTimeout(1_000);
}

async function openTeachers(page) {
  const item = page
    .locator(".app-sidebar-v2 .sidebar-link")
    .filter({ hasText: /Enseignants|Teachers|المعلمون/u })
    .first();
  await item.click({ timeout: 5_000 }).catch(async () => {
    await page.getByRole("button", { name: /Scolarité|School office|شؤون الدراسة/u }).first().click();
    await page.waitForTimeout(250);
    await page.getByRole("button", { name: /Enseignants|Teachers|المعلمون/u }).last().click();
  });
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("Liste des enseignants") ||
      document.body.innerText.includes("Teacher list") ||
      document.body.innerText.includes("قائمة المعلمين"),
    undefined,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(500);
}

async function capture(page, name, options = {}) {
  const filePath = path.join(outputDir, `${safeName(name)}.png`);
  await page.screenshot({ fullPage: options.fullPage ?? false, path: filePath });
  screenshots.push(filePath);
  return filePath;
}

async function clickTab(page, label) {
  await page.getByRole("tab", { name: label }).first().click({ timeout: 4_000 });
  await page.waitForTimeout(450);
}

async function auditNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) {
    findings.push({
      label,
      priority: "P1",
      type: "horizontal-overflow",
      message: `Débordement horizontal détecté: ${Math.round(overflow)}px.`
    });
  }
}

async function auditForbiddenContent(page, label, language = "fr") {
  const screenText = await page.locator(".screen-host").innerText();
  const forbidden = [
    "ancien lien portail",
    "verite metier",
    "vérité métier",
    "legacy",
    "IAM",
    "URL fichier",
    "Mime type",
    "Taille octets",
    "Creer enseignant",
    "Creer affectation",
    "Ajouter competence",
    "Competences",
    "Matiere",
    "Annee scolaire",
    "Periode",
    "Debut",
    "Diplome principal",
    "Telephone principal",
    "Aucune competence.",
    "Aucune affectation.",
    "Aucune charge calculee.",
    "Aucun document.",
    "TITULAIRE",
    "CONTRAT",
    "ACTIVE"
  ];

  for (const value of forbidden) {
    if (screenText.includes(value)) {
      findings.push({
        label,
        priority: "P1",
        type: "forbidden-content",
        message: `Texte interdit visible dans Enseignants: ${value}.`
      });
    }
  }

  if (language === "en") {
    const leaks = [
      "Liste des enseignants",
      "Ajouter un enseignant",
      "Compétences",
      "Affectations",
      "Réinitialiser",
      "Aucun enseignant",
      "Créer",
      "Établissement"
    ];
    const leak = leaks.find((value) => screenText.includes(value));
    if (leak) {
      findings.push({
        label,
        priority: "P1",
        type: "i18n",
        message: `Texte français visible en anglais: ${leak}.`
      });
    }
  }

  if (language === "ar") {
    const leaks = [
      "Teacher",
      "Teachers",
      "Liste des enseignants",
      "Ajouter un enseignant",
      "Compétences",
      "Affectations",
      "Réinitialiser",
      "Créer",
      "Établissement"
    ];
    const leak = leaks.find((value) => screenText.includes(value));
    if (leak) {
      findings.push({
        label,
        priority: "P1",
        type: "i18n",
        message: `Texte non arabe visible en arabe: ${leak}.`
      });
    }
  }
}

async function auditTeacherContextBar(page, label) {
  const contextText = await page.locator(".context-bar").innerText().catch(() => "");
  if (!contextText.includes("Retour tableau de bord")) {
    findings.push({
      label,
      priority: "P1",
      type: "context-actions",
      message: "Le bouton de retour Enseignants n'affiche pas « Retour tableau de bord »."
    });
  }
  for (const forbidden of ["Retour accueil", "Utilisateurs & droits", "Élèves"]) {
    if (contextText.includes(forbidden)) {
      findings.push({
        label,
        priority: "P1",
        type: "context-actions",
        message: `Action inutile visible dans l'en-tête Enseignants: ${forbidden}.`
      });
    }
  }
}

async function auditButtons(page, label) {
  const edit = page.locator(".teachers-panel .button-edit").first();
  if ((await edit.count()) > 0) {
    const editStyle = await edit.evaluate((node) => {
      const styles = getComputedStyle(node);
      return { backgroundColor: styles.backgroundColor, color: styles.color };
    });
    if (!/rgb\(81,\s*206,\s*216\)/u.test(editStyle.backgroundColor)) {
      findings.push({
        label,
        priority: "P2",
        type: "button-style",
        message: `Le bouton Modifier n'utilise pas #51CED8: ${editStyle.backgroundColor}.`
      });
    }
  }

  const danger = page.locator(".teachers-panel .button-danger").first();
  if ((await danger.count()) > 0) {
    const dangerColor = await danger.evaluate((node) => getComputedStyle(node).backgroundColor);
    if (!/rgb\(255,\s*0,\s*0\)/u.test(dangerColor)) {
      findings.push({
        label,
        priority: "P1",
        type: "button-style",
        message: `Le bouton Supprimer n'est pas rouge pur: ${dangerColor}.`
      });
    }
  }
}

async function runDesktop(browser, theme) {
  const context = await createContext(browser, viewports.desktop, "fr", theme);
  const page = await context.newPage();
  await openPreview(page);
  await openTeachers(page);
  await auditForbiddenContent(page, `teachers-${theme}-desktop`, "fr");
  await auditTeacherContextBar(page, `teachers-${theme}-desktop`);
  await auditNoHorizontalOverflow(page, `teachers-${theme}-desktop`);

  await capture(page, `teachers-liste-${theme}-desktop`, { fullPage: true });
  await auditButtons(page, `teachers-${theme}-desktop`);

  await clickTab(page, /^Ajouter un enseignant$/u);
  await capture(page, `teachers-ajouter-haut-${theme}-desktop`);
  await page.locator(".teachers-panel .actions").last().scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await capture(page, `teachers-ajouter-bas-${theme}-desktop`);

  await clickTab(page, /^Détail$/u);
  await capture(page, `teachers-detail-${theme}-desktop`);

  await clickTab(page, /^Compétences$/u);
  await capture(page, `teachers-competences-${theme}-desktop`, { fullPage: true });

  await clickTab(page, /^Affectations$/u);
  await capture(page, `teachers-affectations-haut-${theme}-desktop`);
  await page.locator(".teachers-panel .table-wrap").last().scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await capture(page, `teachers-affectations-bas-${theme}-desktop`);

  await clickTab(page, /^Charges$/u);
  await capture(page, `teachers-charges-${theme}-desktop`, { fullPage: true });

  await clickTab(page, /^Documents$/u);
  await capture(page, `teachers-documents-${theme}-desktop`, { fullPage: true });
  await auditForbiddenContent(page, `teachers-documents-${theme}-desktop`, "fr");
  const fileInput = page.locator('input[type="file"][aria-label="Fichier *"]').first();
  if ((await fileInput.count()) > 0) {
    await fileInput.setInputFiles({
      name: "contrat-test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n")
    });
    await page.waitForTimeout(250);
    await capture(page, `teachers-documents-fichier-selectionne-${theme}-desktop`, { fullPage: true });
  } else {
    findings.push({
      label: `teachers-documents-${theme}-desktop`,
      priority: "P0",
      type: "document-upload",
      message: "Le champ fichier des documents enseignants est introuvable."
    });
  }

  await context.close();
}

async function runResponsive(browser) {
  for (const [name, viewport] of Object.entries({ tablet: viewports.tablet, mobile: viewports.mobile })) {
    const context = await createContext(browser, viewports.desktop, "fr", "light");
    const page = await context.newPage();
    await openPreview(page);
    await openTeachers(page);
    await page.setViewportSize(viewport);
    await page.waitForTimeout(600);
    await auditForbiddenContent(page, `teachers-${name}-light`, "fr");
    await auditNoHorizontalOverflow(page, `teachers-${name}-light`);
    await capture(page, `teachers-${name}-light`, { fullPage: true });
    await context.close();
  }
}

async function runLanguages(browser) {
  const languageTabs = {
    fr: [
      { name: "liste", label: /^Liste des enseignants$/u },
      { name: "ajouter", label: /^Ajouter un enseignant$/u },
      { name: "competences", label: /^Compétences$/u },
      { name: "affectations", label: /^Affectations$/u },
      { name: "documents", label: /^Documents$/u }
    ],
    en: [
      { name: "list", label: /^Teacher list$/u },
      { name: "add", label: /^Add teacher$/u },
      { name: "skills", label: /^Skills$/u },
      { name: "assignments", label: /^Assignments$/u },
      { name: "documents", label: /^Documents$/u }
    ],
    ar: [
      { name: "list", label: /^قائمة المعلمين$/u },
      { name: "add", label: /^إضافة معلم$/u },
      { name: "skills", label: /^الكفاءات$/u },
      { name: "assignments", label: /^الإسنادات$/u },
      { name: "documents", label: /^الوثائق$/u }
    ]
  };

  for (const language of ["fr", "en", "ar"]) {
    const context = await createContext(browser, viewports.desktop, language, "light");
    const page = await context.newPage();
    await openPreview(page);
    await openTeachers(page);
    for (const tab of languageTabs[language]) {
      await clickTab(page, tab.label);
      await auditForbiddenContent(page, `teachers-${language}-${tab.name}-light`, language);
      await capture(page, `teachers-${language}-${tab.name}-light`, { fullPage: true });
    }
    await context.close();
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    await runDesktop(browser, "light");
    await runDesktop(browser, "dark");
    await runResponsive(browser);
    await runLanguages(browser);
  } finally {
    await browser.close();
  }

  const report = {
    baseUrl,
    consoleErrors,
    findings,
    outputDir,
    screenshots,
    timestamp: new Date().toISOString()
  };
  await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Teachers visual audit output: ${outputDir}`);
  console.log(`Screenshots: ${screenshots.length}`);
  console.log(`Findings: ${findings.length}`);
  for (const finding of findings) {
    console.log(`[${finding.priority}] ${finding.label}: ${finding.message}`);
  }
  if (consoleErrors.length > 0) {
    console.log(`Console errors: ${consoleErrors.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
