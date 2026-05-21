import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(new URL("../Frontend/web-admin/package.json", import.meta.url));
const { chromium } = require("playwright");

const baseUrl = process.env.VISUAL_AUDIT_URL || "http://127.0.0.1:5180";
const outputRoot = process.env.VISUAL_AUDIT_OUTPUT || "/tmp/gestschool-profile-audit";
const runId = new Date().toISOString().replace(/[:.]/gu, "-");
const outputDir = path.join(outputRoot, runId);

const storageKeys = {
  language: "gestschool.web-admin.language",
  session: "gestschool.web-admin.session",
  theme: "gestschool.web-admin.theme"
};

const viewports = {
  desktop: { width: 1440, height: 900 },
  compactDesktop: { width: 1366, height: 768 },
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

async function createContext(browser, viewport, theme = "light") {
  const context = await browser.newContext({
    colorScheme: theme,
    deviceScaleFactor: 1,
    hasTouch: viewport.width <= 768,
    isMobile: viewport.width <= 480,
    locale: "fr-FR",
    viewport
  });

  await context.addInitScript(
    ({ keys, selectedTheme }) => {
      try {
        window.localStorage.setItem(keys.language, "fr");
        window.localStorage.setItem(keys.theme, selectedTheme);
        window.localStorage.removeItem(keys.session);
        window.sessionStorage.removeItem(keys.session);
      } catch {
        // Initial browser documents can have opaque origins before the app URL is loaded.
      }
    },
    { keys: storageKeys, selectedTheme: theme }
  );

  context.on("page", (page) => {
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
  });

  return context;
}

async function capture(page, name, options = {}) {
  const filePath = path.join(outputDir, `${safeName(name)}.png`);
  await page.screenshot({ fullPage: options.fullPage ?? false, path: filePath });
  screenshots.push(filePath);
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

async function openPreview(page) {
  await page.goto(`${baseUrl}/#preview-admin`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-shell", { timeout: 20_000 });
  await page.waitForTimeout(700);
}

async function openUserMenu(page) {
  const trigger = page.locator(".header-user-trigger").first();
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click({ timeout: 5_000 });
    await page.waitForSelector(".header-floating-panel.header-user-dropdown", { timeout: 5_000 });
    return "desktop";
  }

  const mobileToggle = page.locator(".header-mobile-toggle").first();
  await mobileToggle.click({ timeout: 5_000 });
  await page.waitForSelector("#header-mobile-panel.is-open", { timeout: 5_000 });
  return "mobile";
}

async function clickUserAction(page, mode, actionLabel, expectedText) {
  if (mode === "desktop") {
    await page
      .locator(".header-floating-panel.header-user-dropdown .header-user-link")
      .filter({ hasText: actionLabel })
      .click({ timeout: 5_000 });
  } else {
    await page
      .locator("#header-mobile-panel .header-mobile-link")
      .filter({ hasText: actionLabel })
      .click({ timeout: 5_000 });
  }
  await page.waitForFunction((text) => document.body.innerText.includes(text), expectedText, {
    timeout: 10_000
  });
  await page.waitForTimeout(500);
}

async function auditUserPanel(page, label, mode) {
  const scope =
    mode === "desktop"
      ? page.locator(".header-floating-panel.header-user-dropdown").first()
      : page.locator("#header-mobile-panel").first();
  const text = await scope.innerText();
  for (const expected of ["Mon profil", "Préférences", "Journal d’activité", "Facturation"]) {
    if (!text.includes(expected)) {
      findings.push({
        label,
        priority: "P1",
        type: "profile-menu",
        message: `Entrée absente dans le panneau utilisateur: ${expected}.`
      });
    }
  }
  if (!text.includes("Al Manarat Islamiyat")) {
    findings.push({
      label,
      priority: "P1",
      type: "profile-menu-context",
      message: "Le panneau utilisateur n'affiche pas l'établissement."
    });
  }
}

async function auditProfileScreen(page, label) {
  await auditNoHorizontalOverflow(page, label);
  const text = await page.locator(".screen-host").innerText();
  for (const expected of [
    "Mon profil",
    "Informations personnelles",
    "Sécurité",
    "Sessions",
    "Changer la photo",
    "Enregistrer les modifications"
  ]) {
    if (!text.includes(expected)) {
      findings.push({
        label,
        priority: "P1",
        type: "profile-screen",
        message: `Section absente sur Mon profil: ${expected}.`
      });
    }
  }
  for (const forbidden of ["Activité récente", "Accès et permissions", "Facturation / abonnement"]) {
    if (text.includes(forbidden)) {
      findings.push({
        label,
        priority: "P1",
        type: "profile-scope",
        message: `Section hors périmètre encore visible dans Mon profil: ${forbidden}.`
      });
    }
  }
  for (const forbidden of ["passwordHash", "refreshToken", "temporaryPassword"]) {
    if (text.includes(forbidden)) {
      findings.push({
        label,
        priority: "P1",
        type: "sensitive-field",
        message: `Champ sensible visible sur Mon profil: ${forbidden}.`
      });
    }
  }
}

async function runScenario(browser, label, viewport, theme, fullPage = false) {
  const context = await createContext(browser, viewport, theme);
  const page = await context.newPage();
  await openPreview(page);
  await auditNoHorizontalOverflow(page, `${label}-dashboard`);

  const menuMode = await openUserMenu(page);
  await auditUserPanel(page, `${label}-menu`, menuMode);
  await capture(page, `${label}-panneau-utilisateur`);

  if (menuMode === "desktop") {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    const stillOpenAfterEscape = await page
      .locator(".header-floating-panel.header-user-dropdown")
      .isVisible()
      .catch(() => false);
    if (stillOpenAfterEscape) {
      findings.push({
        label,
        priority: "P1",
        type: "keyboard-close",
        message: "Le panneau utilisateur ne se ferme pas avec Escape."
      });
    }

    await openUserMenu(page);
    await page.mouse.click(8, 8);
    await page.waitForTimeout(150);
    const stillOpenAfterOutsideClick = await page
      .locator(".header-floating-panel.header-user-dropdown")
      .isVisible()
      .catch(() => false);
    if (stillOpenAfterOutsideClick) {
      findings.push({
        label,
        priority: "P1",
        type: "outside-click-close",
        message: "Le panneau utilisateur ne se ferme pas au clic extérieur."
      });
    }
  }

  const nextMenuMode = await openUserMenu(page);
  await clickUserAction(page, nextMenuMode, "Mon profil", "Informations personnelles");
  await auditProfileScreen(page, `${label}-profil`);
  await capture(page, `${label}-ecran-mon-profil`, { fullPage });

  if (label === "desktop-1440-light") {
    for (const destination of [
      ["Préférences", "Enregistrer les préférences"],
      ["Journal d’activité", "Aucune activité récente disponible"],
      ["Facturation", "Aucune information de facturation utilisateur disponible"]
    ]) {
      const destinationMenuMode = await openUserMenu(page);
      await clickUserAction(page, destinationMenuMode, destination[0], destination[1]);
      await auditNoHorizontalOverflow(page, `${label}-${safeName(destination[0])}`);
      await capture(page, `${label}-ecran-${safeName(destination[0])}`);
    }
  }

  await context.close();
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    await runScenario(browser, "desktop-1440-light", viewports.desktop, "light");
    await runScenario(browser, "desktop-1440-dark", viewports.desktop, "dark");
    await runScenario(browser, "desktop-1366-light", viewports.compactDesktop, "light");
    await runScenario(browser, "tablette-768-light", viewports.tablet, "light", true);
    await runScenario(browser, "mobile-390-light", viewports.mobile, "light", true);
  } finally {
    await browser.close();
  }

  const unexpectedConsoleErrors = consoleErrors.filter(
    (line) => !/Failed to load resource|api\/v1|favicon|net::ERR/u.test(line)
  );
  for (const message of unexpectedConsoleErrors) {
    findings.push({
      label: "console",
      priority: "P2",
      type: "console-error",
      message
    });
  }

  const report = {
    baseUrl,
    outputDir,
    screenshots,
    findings,
    consoleErrors,
    generatedAt: new Date().toISOString()
  };
  const reportPath = path.join(outputDir, "report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputDir, screenshots: screenshots.length, findings }, null, 2));
  if (findings.some((item) => item.priority === "P1")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
