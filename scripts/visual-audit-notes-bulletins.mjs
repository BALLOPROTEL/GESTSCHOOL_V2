import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(new URL("../Frontend/web-admin/package.json", import.meta.url));
const { chromium } = require("playwright");

const baseUrl = process.env.VISUAL_AUDIT_URL || "http://127.0.0.1:5180";
const outputRoot = process.env.VISUAL_AUDIT_OUTPUT || "/tmp/gestschool-notes-bulletins-audit";
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
        // Opaque initial documents do not expose storage yet.
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

async function openGrades(page) {
  const sidebarItem = page.locator(".app-sidebar-v2 .sidebar-link").filter({ hasText: /Notes & bulletins/u });

  if (await clickFirstVisible(sidebarItem)) {
    await page.waitForTimeout(350);
  } else {
    const mobileToggle = page.locator(".header-mobile-toggle").first();
    if (await mobileToggle.isVisible().catch(() => false)) {
      await mobileToggle.click({ timeout: 5_000 });
      await page.waitForTimeout(250);
      const mobileItem = page.locator(".header-mobile-link").filter({ hasText: /Notes & bulletins/u });
      if (!(await clickFirstVisible(mobileItem))) {
        throw new Error("Impossible d'ouvrir Notes & bulletins depuis le menu mobile.");
      }
    } else {
      throw new Error("Impossible d'ouvrir le module Notes & bulletins.");
    }
  }

  await page.waitForFunction(() => document.body.innerText.includes("Vue d’ensemble"), undefined, {
    timeout: 10_000
  });
  await page.waitForTimeout(500);
}

async function clickTab(page, label) {
  await page.getByRole("tab", { name: label }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(500);
}

async function seedGradeAndComputeSummary(page) {
  await clickTab(page, /Saisie des notes/u);
  const firstScore = page.locator('input[aria-label^="Note de"]').first();
  if (await firstScore.isVisible().catch(() => false)) {
    await firstScore.fill("15");
    await page.getByRole("button", { name: "Enregistrer les notes" }).click({ timeout: 5_000 });
    await page.waitForTimeout(500);
  }
  await clickTab(page, /Moyennes/u);
  const computeButton = page.getByRole("button", { name: "Calculer les moyennes/rangs" }).first();
  if (await computeButton.isVisible().catch(() => false)) {
    await computeButton.click({ timeout: 5_000 });
    await page.waitForTimeout(500);
  }
  const detailButton = page.getByRole("button", { name: "Voir détail" }).first();
  if (await detailButton.isVisible().catch(() => false)) {
    await detailButton.click({ timeout: 5_000 });
    await page.waitForTimeout(300);
  }
}

async function capture(page, name, options = {}) {
  const filePath = path.join(outputDir, `${safeName(name)}.png`);
  await page.screenshot({ fullPage: options.fullPage ?? false, path: filePath });
  screenshots.push(filePath);
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

async function auditGradesText(page, label) {
  const screenText = await getScreenText(page);
  const forbidden = [
    "Passe finale",
    "meme langage",
    "cadencees",
    "Generation bulletin PDF",
    "Generez",
    "Generer bulletin",
    "Bulletins generes",
    "Aucun resume calcule",
    "Eleve",
    "Matiere",
    "Periode",
    "Bareme",
	    "DEVOIR",
	    "Filtrer",
	    "Recharger",
	    "Notification prête",
    "fichier(s)",
    "bulletin(s)",
    "note(s)"
  ];

  for (const value of forbidden) {
    if (screenText.includes(value)) {
      findings.push({
        label,
        priority: "P1",
        type: "forbidden-content",
        message: `Ancien libellé visible dans Notes & bulletins: ${value}.`
      });
    }
  }
}

async function auditRequiredFields(page, label, fields) {
  const screenText = await getScreenText(page);
  for (const value of fields) {
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

async function auditCompactCheckboxes(page, label) {
  const oversized = await page.locator('input[type="checkbox"]').evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          height: Math.round(rect.height),
          width: Math.round(rect.width)
        };
      })
      .filter((item) => item.width > 24 || item.height > 24)
  );

  if (oversized.length > 0) {
    findings.push({
      label,
      priority: "P1",
      type: "checkbox-sizing",
      message: `Cases à cocher trop grandes: ${oversized.map((item) => `${item.width}x${item.height}`).join(", ")}.`
    });
  }
}

async function runDesktop(browser, theme) {
  const context = await createContext(browser, viewports.desktop, theme);
  const page = await context.newPage();
  await openPreview(page);
  await openGrades(page);

  await clickTab(page, /Vue d’ensemble/u);
  await auditNoHorizontalOverflow(page, `notes-vue-ensemble-avant-filtre-${theme}-desktop`);
  await auditGradesText(page, `notes-vue-ensemble-avant-filtre-${theme}-desktop`);
  await auditRequiredFields(page, `notes-vue-ensemble-avant-filtre-${theme}-desktop`, [
    "Année scolaire *",
    "Classe *",
    "Période *"
  ]);
  await capture(page, `notes-vue-ensemble-avant-filtre-${theme}-desktop`, { fullPage: true });
  await page.getByLabel("Année scolaire *").first().selectOption({ index: 1 }).catch(() => {});
  await page.getByLabel("Classe *").first().selectOption({ index: 1 }).catch(() => {});
  await page.getByLabel("Période *").first().selectOption({ index: 1 }).catch(() => {});
  await page.getByRole("button", { name: "Afficher les données" }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(500);
  await capture(page, `notes-vue-ensemble-apres-filtre-${theme}-desktop`, { fullPage: true });

  await clickTab(page, /Saisie des notes/u);
  await auditNoHorizontalOverflow(page, `notes-saisie-${theme}-desktop`);
  await auditGradesText(page, `notes-saisie-${theme}-desktop`);
  await auditCompactCheckboxes(page, `notes-saisie-${theme}-desktop`);
  await auditRequiredFields(page, `notes-saisie-${theme}-desktop`, [
    "Classe *",
    "Matière *",
    "Période *",
    "Type d’évaluation *",
    "Libellé de l’évaluation *",
    "Date d’évaluation *",
    "Barème *",
    "Coefficient *",
    "Cursus *"
  ]);
  await capture(page, `notes-saisie-${theme}-desktop`, { fullPage: true });

  await clickTab(page, /Moyennes/u);
	  await auditNoHorizontalOverflow(page, `notes-moyennes-${theme}-desktop`);
	  await auditGradesText(page, `notes-moyennes-${theme}-desktop`);
	  await capture(page, `notes-moyennes-${theme}-desktop`, { fullPage: true });
	  await clickTab(page, /Bulletins/u);
	  await auditNoHorizontalOverflow(page, `notes-bulletins-avant-generation-${theme}-desktop`);
	  await auditGradesText(page, `notes-bulletins-avant-generation-${theme}-desktop`);
	  await capture(page, `notes-bulletins-avant-generation-${theme}-desktop`, { fullPage: true });
	  await seedGradeAndComputeSummary(page);
	  await auditNoHorizontalOverflow(page, `notes-moyennes-calculees-detail-${theme}-desktop`);
	  await auditGradesText(page, `notes-moyennes-calculees-detail-${theme}-desktop`);
	  await capture(page, `notes-moyennes-calculees-detail-${theme}-desktop`, { fullPage: true });

	  await clickTab(page, /Bulletins/u);
  await auditNoHorizontalOverflow(page, `notes-bulletins-${theme}-desktop`);
  await auditGradesText(page, `notes-bulletins-${theme}-desktop`);
  await auditCompactCheckboxes(page, `notes-bulletins-${theme}-desktop`);
  await auditRequiredFields(page, `notes-bulletins-${theme}-desktop`, [
    "Année scolaire *",
    "Classe *",
    "Période *",
    "Cursus *",
    "Mode *"
  ]);
  await capture(page, `notes-bulletins-${theme}-desktop`, { fullPage: true });
  await capture(page, `notes-bulletins-table-pdf-${theme}-desktop`);

  await context.close();
}

async function runResponsive(browser, name, viewport) {
  const context = await createContext(browser, viewport, "light");
  const page = await context.newPage();
  await openPreview(page);
  await openGrades(page);
  await auditNoHorizontalOverflow(page, `notes-${name}-vue-ensemble`);
  await capture(page, `notes-${name}-vue-ensemble`, { fullPage: true });
  await clickTab(page, /Saisie des notes/u);
  await auditCompactCheckboxes(page, `notes-${name}-saisie`);
  await capture(page, `notes-${name}-saisie`, { fullPage: true });
  await clickTab(page, /Bulletins/u);
  await auditCompactCheckboxes(page, `notes-${name}-bulletins`);
  await capture(page, `notes-${name}-bulletins`, { fullPage: true });
  await context.close();
}

async function runErrors(browser) {
  const context = await createContext(browser, viewports.desktop, "light");
  const page = await context.newPage();
  await openPreview(page);
  await openGrades(page);
  await clickTab(page, /Saisie des notes/u);
  await page.locator('input[type="number"]').first().fill("99");
  await page.getByRole("button", { name: "Enregistrer les notes" }).click();
  await page.waitForTimeout(500);
  await capture(page, "notes-erreurs-formulaire-light-desktop", { fullPage: true });
  await context.close();
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    await runDesktop(browser, "light");
    await runDesktop(browser, "dark");
    await runResponsive(browser, "mobile-390", viewports.mobile);
    await runResponsive(browser, "tablette-768", viewports.tablet);
    await runErrors(browser);
  } finally {
    await browser.close();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    screenshots,
    findings,
    consoleErrors
  };
  const reportPath = path.join(outputDir, "report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Notes & bulletins visual audit written to ${outputDir}`);
  console.log(JSON.stringify({ reportPath, screenshots: screenshots.length, findings: findings.length }, null, 2));

  if (findings.some((finding) => finding.priority === "P1") || consoleErrors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
