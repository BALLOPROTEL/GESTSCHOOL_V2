import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.VISUAL_AUDIT_URL || "http://127.0.0.1:5180";
const outputRoot = process.env.VISUAL_AUDIT_OUTPUT || "/tmp/gestschool-parents-audit";
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

async function openPreview(page) {
  await page.goto(`${baseUrl}/#preview-admin`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-shell", { timeout: 20_000 });
  await page.waitForTimeout(800);
}

async function openParents(page) {
  const sidebarItem = page.locator(".app-sidebar-v2 .sidebar-link").filter({ hasText: /Parents/u });

  if (await clickFirstVisible(sidebarItem)) {
    await page.waitForTimeout(350);
  } else {
    const mobileToggle = page.locator(".header-mobile-toggle").first();
    if (await mobileToggle.isVisible().catch(() => false)) {
      await mobileToggle.click({ timeout: 5_000 });
      await page.waitForTimeout(250);
      const mobileItem = page.locator(".header-mobile-link").filter({ hasText: /Parents/u });
      if (!(await clickFirstVisible(mobileItem))) {
        throw new Error("Impossible d'ouvrir le module Parents depuis le menu mobile.");
      }
    } else {
      const schoolButton = page.getByRole("button", { name: /Scolarité/u });
      if (!(await clickFirstVisible(schoolButton))) {
        throw new Error("Impossible d'ouvrir le module Parents depuis la navigation desktop.");
      }
      await page.waitForTimeout(250);
      const menuItem = page.getByRole("button", { name: /Parents/u });
      if (!(await clickFirstVisible(menuItem))) {
        throw new Error("Impossible de sélectionner Parents dans le menu Scolarité.");
      }
    }
  }

  await page.waitForFunction(() => document.body.innerText.includes("Liste des responsables"), undefined, {
    timeout: 10_000
  });
  await page.waitForTimeout(500);
}

async function clickTab(page, label) {
  const tab = page.getByRole("tab", { name: label }).first();
  if (await tab.count()) {
    await tab.click({ timeout: 5_000 });
  } else {
    await page.getByRole("button", { name: label }).first().click({ timeout: 5_000 });
  }
  await page.waitForTimeout(500);
}

async function capture(page, name, options = {}) {
  const filePath = path.join(outputDir, `${safeName(name)}.png`);
  await page.screenshot({ fullPage: options.fullPage ?? false, path: filePath });
  screenshots.push(filePath);
  return filePath;
}

async function getScreenText(page) {
  const screenHost = page.locator(".screen-host").first();
  if (await screenHost.count()) return screenHost.innerText();
  return page.locator("body").innerText();
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

async function auditParentsText(page, label) {
  const screenText = await getScreenText(page);
  const forbidden = [
    "Invalid or expired token",
    "ACTIVE",
    "INACTIVE",
    "ARCHIVED",
    "PENDING",
    "ROLE",
    "TELEPHONE",
    "ENFANTS",
    "Liste parents",
    "Ajouter parent",
    "Liens parent-eleve",
    "Relation parent-enfant",
    "Metier",
    "pas IAM",
    "Pere",
    "Eleve",
    "Tuteur legal",
    "Contact urgence",
    "Autorise recuperation",
    "Vit avec l'eleve",
    "Creer parent",
    "Creer lien parent-eleve",
    "Reinitialiser",
    "Retour liste",
    "Aucun parent.",
    "parentUserId",
    "A regulariser",
    "Cursus eleve",
    "Roles"
  ];

  for (const value of forbidden) {
    if (screenText.includes(value)) {
      findings.push({
        label,
        priority: "P1",
        type: "forbidden-content",
        message: `Texte technique ou ancien libellé visible dans Parents: ${value}.`
      });
    }
  }
}

async function auditAddRequiredFields(page, label) {
  const screenText = await getScreenText(page);
  const requiredLabels = ["Rôle parental *", "Prénom *", "Nom *", "Téléphone principal *", "Statut *"];
  for (const value of requiredLabels) {
    if (!screenText.includes(value)) {
      findings.push({
        label,
        priority: "P1",
        type: "required-field",
        message: `Champ obligatoire sans étoile visible: ${value}.`
      });
    }
  }
}

async function auditLinkRequiredFields(page, label) {
  const screenText = await getScreenText(page);
  const requiredLabels = ["Parent *", "Élève *", "Relation *"];
  for (const value of requiredLabels) {
    if (!screenText.includes(value)) {
      findings.push({
        label,
        priority: "P1",
        type: "required-field",
        message: `Champ obligatoire sans étoile visible: ${value}.`
      });
    }
  }
}

async function runDesktop(browser, theme) {
  const context = await createContext(browser, viewports.desktop, theme);
  const page = await context.newPage();
  await openPreview(page);
  await openParents(page);

  await clickTab(page, /Liste des responsables/u);
  await auditNoHorizontalOverflow(page, `parents-list-${theme}-desktop`);
  await auditParentsText(page, `parents-list-${theme}-desktop`);
  await capture(page, `parents-list-${theme}-desktop`, { fullPage: true });

  await clickTab(page, /Ajouter un responsable/u);
  await auditNoHorizontalOverflow(page, `parents-add-${theme}-desktop`);
  await auditParentsText(page, `parents-add-${theme}-desktop`);
  await auditAddRequiredFields(page, `parents-add-${theme}-desktop`);
  await capture(page, `parents-add-${theme}-desktop`, { fullPage: true });

  await clickTab(page, /Liens parent-élève/u);
  await auditNoHorizontalOverflow(page, `parents-links-${theme}-desktop`);
  await auditParentsText(page, `parents-links-${theme}-desktop`);
  await auditLinkRequiredFields(page, `parents-links-${theme}-desktop`);
  await capture(page, `parents-links-${theme}-desktop`, { fullPage: true });

  await context.close();
}

async function runResponsive(browser, viewportName, viewport) {
  const context = await createContext(browser, viewport, "light");
  const page = await context.newPage();
  await openPreview(page);
  await openParents(page);

  await clickTab(page, /Liste des responsables/u);
  await auditNoHorizontalOverflow(page, `parents-list-${viewportName}-light`);
  await auditParentsText(page, `parents-list-${viewportName}-light`);
  await capture(page, `parents-list-${viewportName}-light`, { fullPage: true });

  await clickTab(page, /Ajouter un responsable/u);
  await auditNoHorizontalOverflow(page, `parents-add-${viewportName}-light`);
  await auditParentsText(page, `parents-add-${viewportName}-light`);
  await auditAddRequiredFields(page, `parents-add-${viewportName}-light`);
  await capture(page, `parents-add-${viewportName}-light`, { fullPage: true });

  await clickTab(page, /Liens parent-élève/u);
  await auditNoHorizontalOverflow(page, `parents-links-${viewportName}-light`);
  await auditParentsText(page, `parents-links-${viewportName}-light`);
  await auditLinkRequiredFields(page, `parents-links-${viewportName}-light`);
  await capture(page, `parents-links-${viewportName}-light`, { fullPage: true });

  await context.close();
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    await runDesktop(browser, "light");
    await runDesktop(browser, "dark");
    await runResponsive(browser, "mobile-390", viewports.mobile);
    await runResponsive(browser, "tablet-768", viewports.tablet);
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
  if (findings.some((finding) => finding.priority === "P1") || consoleErrors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
