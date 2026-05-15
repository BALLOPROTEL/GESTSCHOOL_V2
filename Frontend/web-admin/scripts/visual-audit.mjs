import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.VISUAL_AUDIT_URL || process.argv[2] || "http://127.0.0.1:5180";
const outputRoot = process.env.VISUAL_AUDIT_OUTPUT || "/tmp/gestschool-visual-audit";
const runId = new Date().toISOString().replace(/[:.]/gu, "-");
const outputDir = path.join(outputRoot, runId);

const storageKeys = {
  language: "gestschool.web-admin.language",
  loginHint: "gestschool.web-admin.login-hint",
  session: "gestschool.web-admin.session",
  theme: "gestschool.web-admin.theme",
  visualSeeded: "gestschool.visual-audit.seeded"
};

const desktop = { name: "desktop-1440", width: 1440, height: 900 };
const laptop = { name: "laptop-1366", width: 1366, height: 768 };
const tablet = { name: "tablet-768", width: 768, height: 1024 };
const mobileLarge = { name: "mobile-390", width: 390, height: 844 };
const mobileSmall = { name: "mobile-360", width: 360, height: 800 };

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

async function createContext(browser, viewport, options = {}) {
  const language = options.language || "fr";
  const theme = options.theme || "light";
  const context = await browser.newContext({
    colorScheme: theme,
    deviceScaleFactor: 1,
    hasTouch: viewport.width <= 768,
    isMobile: viewport.width <= 480,
    locale: language === "ar" ? "ar" : language === "en" ? "en-US" : "fr-FR",
    viewport: { width: viewport.width, height: viewport.height }
  });

  await context.addInitScript(
    ({ keys, selectedLanguage, selectedTheme }) => {
      if (window.localStorage.getItem(keys.visualSeeded) === "true") {
        return;
      }

      window.localStorage.setItem(keys.language, selectedLanguage);
      window.localStorage.setItem(keys.theme, selectedTheme);
      window.localStorage.removeItem(keys.loginHint);
      window.localStorage.removeItem(keys.session);
      window.localStorage.setItem(keys.visualSeeded, "true");
      window.sessionStorage.removeItem(keys.session);
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
  await page.waitForSelector(".app-shell, .auth-canvas", { timeout: 20_000 });
  if ((await page.locator(".app-shell").count()) === 0) {
    const previewButton = page.getByRole("button", { name: /sans connexion|preview|v2/iu }).first();
    if ((await previewButton.count()) > 0) {
      await previewButton.click();
      await page.waitForSelector(".app-shell", { timeout: 20_000 });
    }
  }
  await page.waitForTimeout(1_200);
}

async function openAuth(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".auth-canvas, .app-shell", { timeout: 20_000 });
  await page.waitForTimeout(1_000);
}

async function capture(page, name, options = {}) {
  const fileName = `${safeName(name)}.png`;
  const filePath = path.join(outputDir, fileName);
  await page.screenshot({ fullPage: options.fullPage ?? false, path: filePath });
  screenshots.push(filePath);
  return filePath;
}

async function addOverflowFinding(page, label) {
  const overflow = await page.evaluate(() => {
    const width = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return width - window.innerWidth;
  });
  if (overflow > 2) {
    findings.push({
      label,
      priority: "P1",
      type: "horizontal-overflow",
      message: `Debordement horizontal detecte: ${Math.round(overflow)}px.`
    });
  }
}

async function clickSidebar(page, label) {
  const item = page.locator(".app-sidebar-v2 .sidebar-link").filter({ hasText: label }).first();
  if ((await item.count()) === 0) {
    findings.push({
      label,
      priority: "P2",
      type: "navigation-skipped",
      message: `Entree sidebar introuvable ou non accessible dans la session preview: ${label}.`
    });
    return false;
  }
  await item.click();
  await page.waitForTimeout(650);
  return true;
}

async function auditHeaderOverlays(page) {
  const header = page.locator(".global-header-shell").first();
  const headerBox = await header.boundingBox();

  const toast = page.locator(".global-toast-layer .toast-pop").first();
  if ((await toast.count()) > 0 && headerBox) {
    const toastBox = await toast.boundingBox();
    if (toastBox && toastBox.y < headerBox.y + headerBox.height - 1) {
      findings.push({
        label: "toast-global",
        priority: "P0",
        type: "overlay-hidden-behind-header",
        message: "Le toast global commence dans la zone du header."
      });
    }
  }

  await page.locator(".header-notifications-dropdown .header-icon-button").click();
  await page.waitForSelector(".header-floating-panel.header-notifications-dropdown", {
    timeout: 5_000
  });
  await page.waitForTimeout(350);
  await capture(page, "notification-open-desktop-fr-dark");

  const notificationPanel = page
    .locator(".header-floating-panel.header-notifications-dropdown")
    .first();
  const notificationBox = await notificationPanel.boundingBox();
  if (headerBox && notificationBox && notificationBox.y < headerBox.y + headerBox.height - 1) {
    findings.push({
      label: "notification-dropdown",
      priority: "P0",
      type: "overlay-hidden-behind-header",
      message: "Le dropdown notification chevauche ou passe derriere le header."
    });
  }

  await page.mouse.click(16, 16);
  await page.waitForTimeout(300);
  if (await notificationPanel.isVisible().catch(() => false)) {
    findings.push({
      label: "notification-dropdown",
      priority: "P1",
      type: "outside-click",
      message: "Le dropdown notification reste ouvert apres clic exterieur."
    });
  }
}

async function auditThemePersistence(page) {
  const before = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  const expected = before === "dark" ? "light" : "dark";
  await page.getByRole("button", { name: /changer le mode|change theme mode|تغيير الوضع/iu }).click();
  await page
    .waitForFunction(
      (nextTheme) => document.documentElement.getAttribute("data-theme") === nextTheme,
      expected,
      { timeout: 3_500 }
    )
    .catch(() => undefined);
  const after = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  if (before === after) {
    findings.push({
      label: "theme-toggle",
      priority: "P1",
      type: "theme",
      message: "Le theme ne change pas apres clic sur le bouton de theme."
    });
  }
  const stored = await page.evaluate((key) => window.localStorage.getItem(key), storageKeys.theme);
  if (stored !== after) {
    findings.push({
      label: "theme-storage",
      priority: "P1",
      type: "theme",
      message: "Le theme actif n'est pas synchronise dans localStorage."
    });
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-shell, .auth-canvas", { timeout: 20_000 });
  await page
    .waitForFunction(
      (nextTheme) => document.documentElement.getAttribute("data-theme") === nextTheme,
      after,
      { timeout: 3_500 }
    )
    .catch(() => undefined);
  const persisted = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  if (persisted !== after) {
    findings.push({
      label: "theme-persistence",
      priority: "P1",
      type: "theme",
      message: "Le theme ne persiste pas apres reload."
    });
  }
}

async function auditLanguage(page, language) {
  const bodyText = await page.locator("body").innerText();
  const htmlDir = await page.locator("[data-theme]").first().getAttribute("dir").catch(() => null);

  if (language === "en") {
    const frenchLeaks = [
      "Tableau de bord",
      "Eleves",
      "Inscriptions",
      "Comptabilite",
      "Fermer",
      "Mode apercu local",
      "Les donnees affichees",
      "Rechercher un module",
      "Salles",
      "Dossiers, cursus",
      "Responsables et liens",
      "Fiches, competences",
      "Espaces, capacites"
    ];
    const leak = frenchLeaks.find((value) => bodyText.includes(value));
    if (leak) {
      findings.push({
        label: "i18n-en",
        priority: "P1",
        type: "i18n",
        message: `Texte francais visible en anglais: ${leak}.`
      });
    }
  }

  if (language === "ar") {
    const latinLeaks = [
      "Dashboard",
      "Students",
      "Rooms",
      "Classes",
      "Tableau de bord",
      "Eleves",
      "Inscriptions",
      "Salles",
      "Fermer",
      "Mode apercu local",
      "Les donnees affichees",
      "Rechercher un module",
      "Dossiers, cursus",
      "Responsables et liens",
      "Fiches, competences",
      "Espaces, capacites"
    ];
    const leak = latinLeaks.find((value) => bodyText.includes(value));
    if (leak) {
      findings.push({
        label: "i18n-ar",
        priority: "P1",
        type: "i18n",
        message: `Texte non arabe visible en arabe: ${leak}.`
      });
    }
    if (htmlDir !== "rtl") {
      findings.push({
        label: "i18n-ar-dir",
        priority: "P1",
        type: "i18n",
        message: "La langue arabe ne force pas dir=rtl sur le conteneur applicatif."
      });
    }
  }
}

async function runDesktopAudit(browser) {
  const context = await createContext(browser, desktop, { language: "fr", theme: "dark" });
  const page = await context.newPage();
  await openAuth(page);
  await capture(page, "auth-login-desktop-fr-dark");

  await openPreview(page);
  await capture(page, "dashboard-desktop-fr-dark", { fullPage: true });
  await addOverflowFinding(page, "dashboard desktop fr dark");
  await auditHeaderOverlays(page);

  await page.locator(".header-user-trigger").click();
  await page.waitForSelector(".header-floating-panel.header-user-dropdown", { timeout: 5_000 });
  await page.waitForTimeout(350);
  await capture(page, "profile-menu-desktop-fr-dark");
  await page.mouse.click(16, 16);

  const pages = [
    "Inscriptions",
    "Eleves",
    "Parents",
    "Enseignants",
    "Salles",
    "Utilisateurs & droits",
    "Comptabilite",
    "Notes & bulletins",
    "Absences",
    "Emploi du temps",
    "Notifications",
    "Referentiel"
  ];
  for (const label of pages) {
    if (await clickSidebar(page, label)) {
      await addOverflowFinding(page, `${label} desktop`);
      await capture(page, `${label} desktop fr dark`, { fullPage: true });
    }
  }

  await auditThemePersistence(page);
  await capture(page, "theme-after-toggle-and-reload-desktop-fr");
  await context.close();
}

async function runLanguageAudit(browser) {
  for (const language of ["fr", "en", "ar"]) {
    const context = await createContext(browser, desktop, { language, theme: "light" });
    const page = await context.newPage();
    await openPreview(page);
    await auditLanguage(page, language);
    await capture(page, `dashboard-desktop-${language}-light`, { fullPage: true });
    await context.close();
  }
}

async function runLightScreenAudit(browser) {
  const context = await createContext(browser, desktop, { language: "fr", theme: "light" });
  const page = await context.newPage();
  await openPreview(page);
  await capture(page, "dashboard-desktop-fr-light", { fullPage: true });

  const pages = [
    "Inscriptions",
    "Utilisateurs & droits",
    "Enseignants",
    "Salles",
    "Eleves",
    "Parents",
    "Comptabilite",
    "Notes & bulletins",
    "Absences",
    "Emploi du temps",
    "Notifications"
  ];

  for (const label of pages) {
    if (await clickSidebar(page, label)) {
      await addOverflowFinding(page, `${label} desktop light`);
      await capture(page, `${label} desktop fr light`, { fullPage: true });
    }
  }

  await context.close();
}

async function runResponsiveAudit(browser) {
  for (const viewport of [desktop, laptop, tablet, mobileLarge, mobileSmall]) {
    const context = await createContext(browser, viewport, { language: "fr", theme: "light" });
    const page = await context.newPage();
    await openPreview(page);
    await addOverflowFinding(page, `dashboard ${viewport.name}`);
    await capture(page, `dashboard-${viewport.name}-fr-light`, { fullPage: true });

    if (viewport.width <= 768) {
      const menuButton = page.getByRole("button", { name: /menu/iu }).first();
      if ((await menuButton.count()) > 0) {
        await menuButton.click();
        await page.waitForTimeout(350);
        await capture(page, `mobile-menu-${viewport.name}-fr-light`);
      }
    }

    await context.close();
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    await runDesktopAudit(browser);
    await runLanguageAudit(browser);
    await runLightScreenAudit(browser);
    await runResponsiveAudit(browser);
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
  const reportPath = path.join(outputDir, "report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Visual audit output: ${outputDir}`);
  console.log(`Screenshots: ${screenshots.length}`);
  console.log(`Findings: ${findings.length}`);
  if (findings.length > 0) {
    for (const finding of findings) {
      console.log(`[${finding.priority}] ${finding.label}: ${finding.message}`);
    }
  }
  if (consoleErrors.length > 0) {
    console.log(`Console errors: ${consoleErrors.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
