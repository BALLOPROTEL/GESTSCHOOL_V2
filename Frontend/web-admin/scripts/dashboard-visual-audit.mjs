import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.VISUAL_AUDIT_URL || "http://127.0.0.1:5180";
const outputRoot = process.env.VISUAL_AUDIT_OUTPUT || "/tmp/gestschool-dashboard-audit";
const runId = new Date().toISOString().replace(/[:.]/gu, "-");
const outputDir = path.join(outputRoot, runId);

const storageKeys = {
  language: "gestschool.web-admin.language",
  session: "gestschool.web-admin.session",
  theme: "gestschool.web-admin.theme"
};

const viewports = {
  wide: { width: 1920, height: 900 },
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

async function createContext(browser, viewport, language, theme) {
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
        // Some browser-created documents have an opaque origin before the app URL is loaded.
      }
    },
    { keys: storageKeys, selectedLanguage: language, selectedTheme: theme }
  );

  context.on("page", (page) => {
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });
  });

  return context;
}

async function openPreview(page) {
  await page.goto(`${baseUrl}/#preview-admin`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-shell", { timeout: 20_000 });
  await page.waitForTimeout(1_200);
}

async function capture(page, name, options = {}) {
  const filePath = path.join(outputDir, `${safeName(name)}.png`);
  await page.screenshot({ fullPage: options.fullPage ?? false, path: filePath });
  screenshots.push(filePath);
  return filePath;
}

async function closeOverlays(page) {
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.mouse.click(8, 8).catch(() => undefined);
  await page.waitForTimeout(250);
}

async function clickByText(page, text) {
  const button = page.getByRole("button", { name: new RegExp(`^${text}$`, "u") }).first();
  await button.click();
  await page.waitForTimeout(350);
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

async function auditDashboardContent(page, language) {
  const bodyText = await page.locator("body").innerText();
  const forbidden = [
    "UI-only",
    "backend messagerie",
    "non branchée",
    "Lot 0",
    "Accueil simplifie",
    "Tableau de bord clair et actionnable",
    "\nModules\n"
  ];

  for (const text of forbidden) {
    if (bodyText.includes(text)) {
      findings.push({
        label: `dashboard-${language}`,
        priority: "P1",
        type: "dashboard-content",
        message: `Texte ou section interdite visible: ${text}.`
      });
    }
  }

  if (language === "en") {
    const leaks = [
      "Tableau de bord",
      "Tâches prioritaires",
      "Alertes & suivi",
      "Mode aperçu local",
      "Créer un élève",
      "Santé financière"
    ];
    const leak = leaks.find((text) => bodyText.includes(text));
    if (leak) {
      findings.push({
        label: "dashboard-en",
        priority: "P1",
        type: "i18n",
        message: `Texte français visible en anglais: ${leak}.`
      });
    }
  }

  if (language === "ar") {
    const leaks = [
      "Dashboard",
      "Priority tasks",
      "Alerts & follow-up",
      "Tableau de bord",
      "Tâches prioritaires",
      "Mode aperçu local",
      "Créer un élève"
    ];
    const leak = leaks.find((text) => bodyText.includes(text));
    if (leak) {
      findings.push({
        label: "dashboard-ar",
        priority: "P1",
        type: "i18n",
        message: `Texte non arabe visible en arabe: ${leak}.`
      });
    }
  }
}

async function runLightDesktop(browser) {
  const context = await createContext(browser, viewports.desktop, "fr", "light");
  const page = await context.newPage();
  await openPreview(page);
  await auditDashboardContent(page, "fr");
  await auditNoHorizontalOverflow(page, "dashboard-desktop-fr-light");
  await capture(page, "dashboard-complet-desktop-1440-fr-light", { fullPage: true });

  await page.locator(".dashboard-priority-panel").scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await capture(page, "dashboard-actions-prioritaires-fr-light");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(250);
  await context.close();

  const wideContext = await createContext(browser, viewports.wide, "fr", "light");
  const widePage = await wideContext.newPage();
  await openPreview(widePage);

  await clickByText(widePage, "Scolarité");
  await capture(widePage, "dashboard-dropdown-scolarite-fr-light");
  await closeOverlays(widePage);

  await clickByText(widePage, "Vie scolaire");
  await capture(widePage, "dashboard-dropdown-vie-scolaire-fr-light");
  await closeOverlays(widePage);

  await clickByText(widePage, "Paramètres");
  await capture(widePage, "dashboard-dropdown-parametres-fr-light");
  await closeOverlays(widePage);

  await widePage.locator(".header-quick-dropdown .header-icon-button").click();
  await widePage.waitForSelector(".header-floating-panel.header-quick-dropdown", { timeout: 5_000 });
  await widePage.waitForTimeout(350);
  await capture(widePage, "dashboard-quick-actions-fr-light");
  await closeOverlays(widePage);

  await widePage.locator(".header-notifications-dropdown .header-icon-button").click();
  await widePage.waitForSelector(".header-floating-panel.header-notifications-dropdown", { timeout: 5_000 });
  await widePage.waitForTimeout(350);
  await capture(widePage, "dashboard-notification-dropdown-fr-light");
  await closeOverlays(widePage);

  await widePage.locator(".header-user-trigger").click();
  await widePage.waitForSelector(".header-floating-panel.header-user-dropdown", { timeout: 5_000 });
  await widePage.waitForTimeout(350);
  await capture(widePage, "dashboard-profile-menu-fr-light");
  await closeOverlays(widePage);

  await wideContext.close();
}

async function runDarkDesktop(browser) {
  const context = await createContext(browser, viewports.desktop, "fr", "dark");
  const page = await context.newPage();
  await openPreview(page);
  await capture(page, "dashboard-complet-desktop-1440-fr-dark", { fullPage: true });

  await page.locator(".header-notifications-dropdown .header-icon-button").click();
  await page.waitForSelector(".header-floating-panel.header-notifications-dropdown", { timeout: 5_000 });
  await page.waitForTimeout(350);
  await capture(page, "dashboard-notification-dropdown-fr-dark");
  await closeOverlays(page);

  await page.locator(".header-user-trigger").click();
  await page.waitForSelector(".header-floating-panel.header-user-dropdown", { timeout: 5_000 });
  await page.waitForTimeout(350);
  await capture(page, "dashboard-profile-menu-fr-dark");
  await context.close();
}

async function runLanguages(browser) {
  for (const language of ["fr", "en", "ar"]) {
    const context = await createContext(browser, viewports.desktop, language, "light");
    const page = await context.newPage();
    await openPreview(page);
    await auditDashboardContent(page, language);
    await capture(page, `dashboard-desktop-${language}-light`, { fullPage: true });
    await context.close();
  }
}

async function runResponsive(browser) {
  for (const [name, viewport] of Object.entries({ tablet: viewports.tablet, mobile: viewports.mobile })) {
    const context = await createContext(browser, viewport, "fr", "light");
    const page = await context.newPage();
    await openPreview(page);
    await auditNoHorizontalOverflow(page, `dashboard-${name}-fr-light`);
    await capture(page, `dashboard-${name}-fr-light`, { fullPage: true });
    await context.close();
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    await runLightDesktop(browser);
    await runDarkDesktop(browser);
    await runLanguages(browser);
    await runResponsive(browser);
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
  console.log(`Dashboard visual audit output: ${outputDir}`);
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
