import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.VISUAL_AUDIT_URL || "http://127.0.0.1:5180";
const outputRoot = process.env.VISUAL_AUDIT_OUTPUT || "/tmp/gestschool-rooms-audit";
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
  await page.waitForTimeout(800);
}

async function clickFirstVisible(locator, timeout = 5_000) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    if (await item.isVisible().catch(() => false)) {
      await item.click({ timeout });
      return true;
    }
  }
  return false;
}

async function openRooms(page) {
  const sidebarItem = page
    .locator(".app-sidebar-v2 .sidebar-link")
    .filter({ hasText: /Salles|Rooms|القاعات/u });

  if (await clickFirstVisible(sidebarItem)) {
    await page.waitForTimeout(250);
  } else {
    const mobileToggle = page.locator(".header-mobile-toggle").first();
    if (await mobileToggle.isVisible().catch(() => false)) {
      await mobileToggle.click({ timeout: 5_000 });
      await page.waitForTimeout(250);
      const mobileItem = page.locator(".header-mobile-link").filter({ hasText: /Salles|Rooms|القاعات/u });
      if (!(await clickFirstVisible(mobileItem))) {
        throw new Error("Impossible d'ouvrir le module Salles depuis le menu mobile.");
      }
    } else {
      const schoolButton = page.getByRole("button", { name: /Scolarité|School office|شؤون الدراسة/u });
      if (!(await clickFirstVisible(schoolButton))) {
        throw new Error("Impossible d'ouvrir le module Salles depuis la navigation desktop.");
      }
      await page.waitForTimeout(250);
      const menuItem = page.getByRole("button", { name: /Salles|Rooms|القاعات/u });
      if (!(await clickFirstVisible(menuItem))) {
        throw new Error("Impossible de sélectionner Salles dans le menu Scolarité.");
      }
    }
  }

  await page.waitForFunction(
    () =>
      document.body.innerText.includes("Liste des salles") ||
      document.body.innerText.includes("Room list") ||
      document.body.innerText.includes("قائمة القاعات"),
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
  const tab = page.getByRole("tab", { name: label }).first();
  if (await tab.count()) {
    await tab.click({ timeout: 5_000 });
  } else {
    await page.getByRole("button", { name: label }).first().click({ timeout: 5_000 });
  }
  await page.waitForTimeout(450);
}

async function auditNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const width = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return width - window.innerWidth;
  });
  if (overflow > 2) {
    findings.push({
      label,
      priority: "P1",
      type: "horizontal-overflow",
      message: `Débordement horizontal détecté: ${Math.round(overflow)}px.`
    });
  }
}

async function auditForbiddenFrenchContent(page, label) {
  const screenText = await page.locator(".screen-host").innerText();
  const forbidden = [
    "ACTIVE",
    "AVAILABLE",
    "Créer salle",
    "Creer salle",
    "Ajouter disponibilite",
    "Aucune salle.",
    "Aucune affectation.",
    "Aucune disponibilite.",
    "Capacite",
    "Batiment",
    "Etage",
    "Annee scolaire",
    "Debut",
    "Periode",
    "Reinitialiser"
  ];

  for (const value of forbidden) {
    if (screenText.includes(value)) {
      findings.push({
        label,
        priority: "P1",
        type: "forbidden-content",
        message: `Texte brut ou non accentué visible dans Salles: ${value}.`
      });
    }
  }
}

async function auditDetailEmpty(page, label) {
  await clickTab(page, /Détail salle|Room detail|تفاصيل القاعة/u);
  const screenText = await page.locator(".screen-host").innerText();
  if (!screenText.includes("Aucune salle sélectionnée")) {
    findings.push({
      label,
      priority: "P1",
      type: "detail-empty-state",
      message: "L'état vide du détail salle n'est pas explicite."
    });
  }
  if (screenText.includes("Affecter")) {
    findings.push({
      label,
      priority: "P1",
      type: "detail-actions",
      message: "Le bouton Affecter est visible sans salle sélectionnée."
    });
  }
}

async function auditLanguageLeak(page, label, language) {
  const screenText = await page.locator(".screen-host").innerText();
  const leaksByLanguage = {
    en: [
      "Liste des salles",
      "Ajouter une salle",
      "Détail salle",
      "Affectations",
      "Disponibilités",
      "Occupation",
      "Types de salles",
      "Réinitialiser",
      "Aucune salle"
    ],
    ar: [
      "Room",
      "Rooms",
      "Liste des salles",
      "Ajouter une salle",
      "Détail salle",
      "Affectations",
      "Disponibilités",
      "Occupation",
      "Réinitialiser"
    ]
  };
  const leaks = leaksByLanguage[language] ?? [];
  const leak = leaks.find((value) => screenText.includes(value));
  if (leak) {
    findings.push({
      label,
      priority: "P1",
      type: "i18n",
      message: `Texte non conforme à la langue ${language}: ${leak}.`
    });
  }
}

async function runDesktop(browser, theme) {
  const context = await createContext(browser, viewports.desktop, "fr", theme);
  const page = await context.newPage();
  await openPreview(page);
  await openRooms(page);

  const suffix = `${theme}-desktop`;
  await auditNoHorizontalOverflow(page, `rooms-list-${suffix}`);
  await auditForbiddenFrenchContent(page, `rooms-list-${suffix}`);
  await capture(page, `rooms-list-${suffix}`);

  await clickTab(page, /Ajouter une salle|Add room|إضافة قاعة/u);
  await auditNoHorizontalOverflow(page, `rooms-add-${suffix}`);
  await auditForbiddenFrenchContent(page, `rooms-add-${suffix}`);
  await capture(page, `rooms-add-${suffix}`);

  await auditDetailEmpty(page, `rooms-detail-empty-${suffix}`);
  await capture(page, `rooms-detail-empty-${suffix}`);

  await clickTab(page, /Affectations|Assignments|التخصيصات/u);
  await auditForbiddenFrenchContent(page, `rooms-assignments-${suffix}`);
  await capture(page, `rooms-assignments-${suffix}`);

  await clickTab(page, /Disponibilités|Availability|التوفر/u);
  await auditForbiddenFrenchContent(page, `rooms-availability-${suffix}`);
  await capture(page, `rooms-availability-${suffix}`);

  await clickTab(page, /Occupation|Occupancy|الإشغال/u);
  await auditForbiddenFrenchContent(page, `rooms-occupancy-${suffix}`);
  await capture(page, `rooms-occupancy-${suffix}`);

  await clickTab(page, /Typologie des salles|Room typology|تصنيف القاعات/u);
  await auditForbiddenFrenchContent(page, `rooms-types-${suffix}`);
  await capture(page, `rooms-types-${suffix}`);

  await context.close();
}

async function runResponsive(browser, viewportName, viewport) {
  const context = await createContext(browser, viewport, "fr", "light");
  const page = await context.newPage();
  await openPreview(page);
  await openRooms(page);
  await auditNoHorizontalOverflow(page, `rooms-list-${viewportName}-light`);
  await auditForbiddenFrenchContent(page, `rooms-list-${viewportName}-light`);
  await capture(page, `rooms-list-${viewportName}-light`, { fullPage: true });
  await clickTab(page, /Ajouter une salle|Add room|إضافة قاعة/u);
  await auditNoHorizontalOverflow(page, `rooms-add-${viewportName}-light`);
  await auditForbiddenFrenchContent(page, `rooms-add-${viewportName}-light`);
  await capture(page, `rooms-add-${viewportName}-light`, { fullPage: true });
  await context.close();
}

async function runLocalized(browser, language) {
  const context = await createContext(browser, viewports.desktop, language, "light");
  const page = await context.newPage();
  await openPreview(page);
  await openRooms(page);
  await auditLanguageLeak(page, `rooms-list-${language}-light-desktop`, language);
  await capture(page, `rooms-list-${language}-light-desktop`);
  await context.close();
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    await runDesktop(browser, "light");
    await runDesktop(browser, "dark");
    await runResponsive(browser, "tablet-768", viewports.tablet);
    await runResponsive(browser, "mobile-390", viewports.mobile);
    await runLocalized(browser, "en");
    await runLocalized(browser, "ar");
  } finally {
    await browser.close();
  }

  const report = {
    url: baseUrl,
    outputDir,
    screenshots,
    findings,
    consoleErrors
  };
  await writeFile(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
