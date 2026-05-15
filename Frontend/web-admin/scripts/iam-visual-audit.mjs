import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.VISUAL_AUDIT_URL || "http://127.0.0.1:5180";
const outputRoot = process.env.VISUAL_AUDIT_OUTPUT || "/tmp/gestschool-iam-audit";
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

async function openIam(page) {
  const item = page
    .locator(".app-sidebar-v2 .sidebar-link")
    .filter({ hasText: /Utilisateurs & droits|Users & permissions|المستخدمون والصلاحيات/u })
    .first();
  await item.click({ timeout: 5_000 }).catch(async () => {
    await page.getByRole("button", { name: /Scolarité|School office|شؤون الدراسة/u }).first().click();
    await page.waitForTimeout(250);
    await page.getByRole("button", { name: /Utilisateurs & droits|Users & permissions|المستخدمون والصلاحيات/u }).last().click();
  });
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("Comptes utilisateurs") ||
      document.body.innerText.includes("User accounts") ||
      document.body.innerText.includes("حسابات المستخدمين"),
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
  await page.getByRole("tab", { name: label }).first().click({ timeout: 3_000 });
  await page.waitForTimeout(400);
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
    "Utilisateurs du tenant",
    "Droits API",
    "routes",
    "Role d'acces",
    "Departement",
    "Nom affiche staff",
    "Identite issue",
    "Fonction staff",
    "Rattachement metier",
    "MAJ",
    "ACTIF",
    "Referentiel",
    "Eleves",
    "Mosquee",
    "Validation absences",
    "UI-only",
    "legacy",
    "V2"
  ];

  for (const value of forbidden) {
    if (screenText.includes(value)) {
      findings.push({
        label,
        priority: "P1",
        type: "forbidden-content",
        message: `Texte interdit visible dans IAM: ${value}.`
      });
    }
  }

  if (language === "en") {
    const leaks = [
      "Comptes utilisateurs",
      "Droits par profil",
      "Rôle d'accès",
      "Réinitialiser",
      "Désactiver",
      "Supprimer",
      "Sélectionnez"
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
      "User accounts",
      "Permissions by profile",
      "Comptes utilisateurs",
      "Droits par profil",
      "Rôle d'accès",
      "Réinitialiser",
      "Supprimer"
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

async function auditIamContextBar(page, label) {
  const contextText = await page.locator(".context-bar").innerText().catch(() => "");
  if (!contextText.includes("Retour tableau de bord")) {
    findings.push({
      label,
      priority: "P1",
      type: "context-actions",
      message: "Le bouton de retour IAM n'affiche pas « Retour tableau de bord »."
    });
  }
  for (const forbidden of ["Retour accueil", "Élèves", "Parents"]) {
    if (contextText.includes(forbidden)) {
      findings.push({
        label,
        priority: "P1",
        type: "context-actions",
        message: `Action inutile visible dans l'en-tête IAM: ${forbidden}.`
      });
    }
  }
}

async function auditButtons(page, label) {
  const danger = page.locator(".iam-user-actions .button-danger").first();
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
}

async function auditPermissionsMatrix(page, label) {
  const table = page.getByTestId("iam-permissions-table");
  const firstResourceCell = table.locator("tbody td").first();
  const firstHeaderPosition = await table.locator("th").first().evaluate((node) => getComputedStyle(node).position);
  const firstCellPosition = await firstResourceCell.evaluate((node) => getComputedStyle(node).position);
  const firstCellStyle = await firstResourceCell.evaluate((node) => {
    const styles = getComputedStyle(node);
    return {
      backgroundColor: styles.backgroundColor,
      color: styles.color
    };
  });
  if (firstHeaderPosition !== "sticky" || firstCellPosition !== "sticky") {
    findings.push({
      label,
      priority: "P2",
      type: "permissions-matrix",
      message: `Sticky incomplet: header=${firstHeaderPosition}, first-cell=${firstCellPosition}.`
    });
  }
  if (/rgba\([^)]*,\s*0(?:\.0+)?\)/u.test(firstCellStyle.backgroundColor) || firstCellStyle.backgroundColor === "transparent") {
    findings.push({
      label,
      priority: "P1",
      type: "permissions-matrix",
      message: `La colonne Ressource a un fond transparent: ${firstCellStyle.backgroundColor}.`
    });
  }
  if (label.includes("light") && /rgb\((2[2-5]\d|255),\s*(2[2-5]\d|255),\s*(2[2-5]\d|255)\)/u.test(firstCellStyle.color)) {
    findings.push({
      label,
      priority: "P1",
      type: "permissions-matrix",
      message: `La colonne Ressource a un texte trop clair: ${firstCellStyle.color}.`
    });
  }
  if (label.includes("light")) {
    await firstResourceCell.hover();
    await page.waitForTimeout(120);
    const firstCellHoverStyle = await firstResourceCell.evaluate((node) => {
      const styles = getComputedStyle(node);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color
      };
    });
    if (/rgb\((2[2-5]\d|255),\s*(2[2-5]\d|255),\s*(2[2-5]\d|255)\)/u.test(firstCellHoverStyle.color)) {
      findings.push({
        label,
        priority: "P1",
        type: "permissions-matrix",
        message: `La colonne Ressource a un texte trop clair au survol: ${firstCellHoverStyle.color}.`
      });
    }
  }
}

async function runDesktop(browser, theme) {
  const context = await createContext(browser, viewports.desktop, "fr", theme);
  const page = await context.newPage();
  await openPreview(page);
  await openIam(page);
  await auditForbiddenContent(page, `iam-${theme}-desktop`, "fr");
  await auditIamContextBar(page, `iam-${theme}-desktop`);
  await auditNoHorizontalOverflow(page, `iam-${theme}-desktop`);

  await capture(page, `iam-comptes-utilisateurs-${theme}-desktop`, { fullPage: true });
  await page.getByText(/Comptes utilisateurs/u).last().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await capture(page, `iam-liste-utilisateurs-${theme}-desktop`);
  await auditButtons(page, `iam-${theme}-desktop`);

  await clickTab(page, /^Droits par profil$/u);
  await capture(page, `iam-droits-par-profil-${theme}-desktop`, { fullPage: true });
  await auditPermissionsMatrix(page, `iam-${theme}-desktop`);

  if (theme === "light") {
    await tableHoverCapture(page);
    await page.locator(".iam-permissions-wrap").evaluate((node) => {
      node.scrollTop = node.scrollHeight / 2;
    });
    await page.waitForTimeout(250);
    await capture(page, "iam-matrice-permissions-milieu-light-desktop");
    await page.locator(".iam-permissions-wrap").evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await page.waitForTimeout(250);
    await capture(page, "iam-matrice-permissions-bas-light-desktop");

    await clickTab(page, /^Comptes utilisateurs$/u);
    await page.locator("#iam-accounts").scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await capture(page, "iam-formulaire-creation-utilisateur-light-desktop", { fullPage: true });
  }

  await context.close();
}

async function tableHoverCapture(page) {
  const firstResourceCell = page.getByTestId("iam-permissions-table").locator("tbody td").first();
  await firstResourceCell.hover();
  await page.waitForTimeout(150);
  await capture(page, "iam-matrice-ressource-hover-light-desktop");
}

async function runResponsive(browser) {
  for (const [name, viewport] of Object.entries({ tablet: viewports.tablet, mobile: viewports.mobile })) {
    const context = await createContext(browser, viewports.desktop, "fr", "light");
    const page = await context.newPage();
    await openPreview(page);
    await openIam(page);
    await page.setViewportSize(viewport);
    await page.waitForTimeout(550);
    await auditForbiddenContent(page, `iam-${name}-light`, "fr");
    await auditNoHorizontalOverflow(page, `iam-${name}-light`);
    await capture(page, `iam-${name}-light`, { fullPage: true });
    await context.close();
  }
}

async function runLanguages(browser) {
  for (const language of ["fr", "en", "ar"]) {
    const context = await createContext(browser, viewports.desktop, language, "light");
    const page = await context.newPage();
    await openPreview(page);
    await openIam(page);
    await auditForbiddenContent(page, `iam-${language}-light`, language);
    await capture(page, `iam-${language}-light`, { fullPage: true });
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
  console.log(`IAM visual audit output: ${outputDir}`);
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
