import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.VISUAL_AUDIT_URL || "http://127.0.0.1:5180";
const outputRoot = process.env.VISUAL_AUDIT_OUTPUT || "/tmp/gestschool-enrollments-audit";
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

async function openEnrollments(page) {
  const item = page
    .locator(".app-sidebar-v2 .sidebar-link")
    .filter({ hasText: /Inscriptions|Enrollments|التسجيلات/u })
    .first();
  await item.click({ timeout: 5_000 }).catch(async () => {
    await page.getByRole("button", { name: /Scolarité|School office|شؤون الدراسة/u }).first().click();
    await page.waitForTimeout(250);
    await page.getByRole("button", { name: /Inscriptions|Enrollments|التسجيلات/u }).last().click();
  });
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("Nouvelle inscription") ||
      document.body.innerText.includes("New enrollment") ||
      document.body.innerText.includes("تسجيل جديد"),
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

async function clickButton(page, label) {
  await page
    .getByRole("button", { name: label })
    .first()
    .click({ timeout: 2_500 })
    .catch(async () => {
      await page.getByRole("tab", { name: label }).first().click({ timeout: 2_500 });
    });
  await page.waitForTimeout(350);
}

async function clickFirstVisible(page, locator, label) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click({ timeout: 2_500 });
      await page.waitForTimeout(350);
      return true;
    }
  }
  findings.push({
    label,
    priority: "P2",
    type: "interaction-skipped",
    message: "Aucun déclencheur visible trouvé pour cette capture."
  });
  return false;
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
  const bodyText = await page.locator("body").innerText();
  const forbidden = [
    "Vue v2",
    "FlexAdmin",
    "Offre ouverte",
    "Workflow createur",
    "Workflow créateur",
    "Viviers disponibles",
    "registre",
    "legacy",
    "Classe principale",
    "Classe secondaire",
    "Filtre annee",
    "Filtre classe",
    "Filtre eleve",
    "Filtre cursus",
    "Reinitialiser"
  ];

  for (const value of forbidden) {
    if (bodyText.includes(value)) {
      findings.push({
        label,
        priority: "P1",
        type: "forbidden-content",
        message: `Texte interdit visible: ${value}.`
      });
    }
  }

  if (language === "en") {
    const leaks = [
      "Suivi des inscriptions",
      "Nouvelle inscription",
      "Année scolaire",
      "Élève",
      "Réinitialiser",
      "Supprimer",
      "Aucune inscription trouvée"
    ];
    const leak = leaks.find((value) => bodyText.includes(value));
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
      "Enrollment monitoring",
      "New enrollment",
      "Suivi des inscriptions",
      "Nouvelle inscription",
      "Année scolaire",
      "Élève",
      "Réinitialiser",
      "Supprimer"
    ];
    const leak = leaks.find((value) => bodyText.includes(value));
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

async function auditButtons(page, label) {
  const danger = page.locator(".enrollment-row-actions .button-danger").first();
  if ((await danger.count()) > 0) {
    const dangerColor = await danger.evaluate((node) => getComputedStyle(node).backgroundColor);
    if (!/rgb\(255,\s*0,\s*0\)/u.test(dangerColor)) {
      findings.push({
        label,
        priority: "P1",
        type: "button-contrast",
        message: `Le bouton Supprimer n'est pas rouge pur: ${dangerColor}.`
      });
    }
  }

  const submit = page.locator("#enrollments-create button[type='submit']").first();
  if ((await submit.count()) > 0 && (await submit.isVisible().catch(() => false))) {
    const submitColor = await submit.evaluate((node) => getComputedStyle(node).backgroundColor);
    if (!/rgb\(81,\s*206,\s*216\)/u.test(submitColor)) {
      findings.push({
        label,
        priority: "P2",
        type: "button-contrast",
        message: `Le bouton Créer inscription n'utilise pas le turquoise attendu: ${submitColor}.`
      });
    }
  }
}

async function runDesktop(browser, theme) {
  const context = await createContext(browser, viewports.desktop, "fr", theme);
  const page = await context.newPage();
  await openPreview(page);
  await openEnrollments(page);
  await auditForbiddenContent(page, `inscriptions-${theme}-desktop`, "fr");
  await auditNoHorizontalOverflow(page, `inscriptions-${theme}-desktop`);

  await clickButton(page, /^Création$/u);
  await capture(page, `inscriptions-creation-${theme}-desktop`, { fullPage: true });

  await clickButton(page, /^Suivi$/u);
  await capture(page, `inscriptions-suivi-${theme}-desktop`, { fullPage: true });

  await page.locator("#enrollments-list").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await capture(page, `inscriptions-table-${theme}-desktop`);
  await auditButtons(page, `inscriptions-${theme}-desktop`);

  if (theme === "light") {
    await clickButton(page, /^Création$/u);
    await page.locator("#enrollments-create").scrollIntoViewIfNeeded();
    await page.locator("#enrollments-create button[type='submit']").click();
    await page.waitForTimeout(500);
    await capture(page, "inscriptions-formulaire-erreur-light-desktop");

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(250);
    await page.setViewportSize({ width: 1920, height: 900 });
    await page.waitForTimeout(350);
    const opened = await clickFirstVisible(
      page,
      page.locator("button").filter({ hasText: /Scolarité|Scolarite/u }),
      "inscriptions-dropdown-scolarite-light-desktop"
    );
    if (opened) {
      await capture(page, "inscriptions-dropdown-scolarite-light-desktop");
    }
  }

  await context.close();
}

async function runResponsive(browser) {
  for (const [name, viewport] of Object.entries({ tablet: viewports.tablet, mobile: viewports.mobile })) {
    const context = await createContext(browser, viewports.desktop, "fr", "light");
    const page = await context.newPage();
    await openPreview(page);
    await openEnrollments(page);
    await page.setViewportSize(viewport);
    await page.waitForTimeout(550);
    await auditForbiddenContent(page, `inscriptions-${name}-light`, "fr");
    await auditNoHorizontalOverflow(page, `inscriptions-${name}-light`);
    await capture(page, `inscriptions-${name}-light`, { fullPage: true });
    await context.close();
  }
}

async function runLanguages(browser) {
  for (const language of ["fr", "en", "ar"]) {
    const context = await createContext(browser, viewports.desktop, language, "light");
    const page = await context.newPage();
    await openPreview(page);
    await openEnrollments(page);
    await auditForbiddenContent(page, `inscriptions-${language}-light`, language);
    await capture(page, `inscriptions-${language}-light`, { fullPage: true });
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
  console.log(`Enrollments visual audit output: ${outputDir}`);
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
