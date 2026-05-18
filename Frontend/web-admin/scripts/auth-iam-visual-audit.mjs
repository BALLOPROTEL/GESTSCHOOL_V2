import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.VISUAL_AUDIT_URL || "http://127.0.0.1:5180";
const outputRoot = process.env.VISUAL_AUDIT_OUTPUT || "/tmp/gestschool-auth-iam-audit";
const runId = new Date().toISOString().replace(/[:.]/gu, "-");
const outputDir = path.join(outputRoot, runId);

const storageKeys = {
  language: "gestschool.web-admin.language",
  loginHint: "gestschool.web-admin.login-hint",
  session: "gestschool.web-admin.session",
  theme: "gestschool.web-admin.theme"
};

const viewports = {
  desktop: { width: 1440, height: 900 },
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
        window.localStorage.removeItem(keys.loginHint);
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

async function capture(page, name, options = {}) {
  const filePath = path.join(outputDir, `${safeName(name)}.png`);
  await page.screenshot({ fullPage: options.fullPage ?? false, path: filePath });
  screenshots.push(filePath);
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

async function auditAuthBasics(page, label, language) {
  await auditNoHorizontalOverflow(page, label);

  const brandTitle = await page.locator("[data-testid='auth-brand-title']").innerText().catch(() => "");
  if (!brandTitle.includes("Al Manarat Islamiyat")) {
    findings.push({
      label,
      priority: "P1",
      type: "branding",
      message: "Le titre auth n'affiche pas Al Manarat Islamiyat."
    });
  }

  const tinyEyeButtons = await page.locator(".auth-canvas__visibility-button").evaluateAll((buttons) =>
    buttons
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      })
      .filter((rect) => rect.width < 44 || rect.height < 44)
  );
  if (tinyEyeButtons.length > 0) {
    findings.push({
      label,
      priority: "P1",
      type: "password-toggle-size",
      message: `${tinyEyeButtons.length} bouton(s) oeil sous 44x44px.`
    });
  }

  const text = await page.locator(".auth-canvas").innerText().catch(() => "");
  const languageLeaks = {
    fr: ["Sign in", "Reset password", "Activate my account"],
    en: ["Connexion", "Mot de passe oublié", "Activer mon compte"],
    ar: ["Connexion", "Sign in", "Mot de passe oublié", "Reset password"]
  };
  const leak = languageLeaks[language]?.find((value) => text.includes(value));
  if (leak) {
    findings.push({
      label,
      priority: "P1",
      type: "i18n",
      message: `Mélange de langue détecté: ${leak}.`
    });
  }
}

async function openAuth(page, route = "/") {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".auth-canvas", { timeout: 20_000 });
  await page.waitForTimeout(650);
}

async function runAuthCapture(browser, label, route, language, theme, viewport = viewports.desktop, afterOpen) {
  const context = await createContext(browser, viewport, language, theme);
  const page = await context.newPage();
  await openAuth(page, route);
  if (afterOpen) {
    await afterOpen(page);
    await page.waitForTimeout(350);
  }
  await auditAuthBasics(page, label, language);
  await capture(page, label, { fullPage: viewport.width <= 480 });
  await context.close();
}

async function openPreview(page) {
  await page.goto(`${baseUrl}/#preview-admin`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-shell", { timeout: 20_000 });
  await page.waitForTimeout(900);
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

async function auditIamBasics(page, label) {
  await auditNoHorizontalOverflow(page, label);
  const screenText = await page.locator(".screen-host").innerText().catch(() => "");
  for (const forbidden of ["temporaryPassword", "parentUserId", "Token d'activation", "Mot de passe temporaire"]) {
    if (screenText.includes(forbidden)) {
      findings.push({
        label,
        priority: "P1",
        type: "security-copy",
        message: `Texte technique ou secret visible dans IAM: ${forbidden}.`
      });
    }
  }
  if (!screenText.includes("Renvoyer l’activation")) {
    findings.push({
      label,
      priority: "P2",
      type: "activation-action",
      message: "Aucune action « Renvoyer l’activation » visible dans la liste IAM de recette."
    });
  }
}

async function runIamCaptures(browser) {
  const context = await createContext(browser, viewports.desktop, "fr", "light");
  const page = await context.newPage();
  await openPreview(page);
  await openIam(page);
  await auditIamBasics(page, "iam-light-desktop");
  await capture(page, "iam-creer-utilisateur-light-desktop", { fullPage: true });

  await page.locator("#iam-accounts").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await capture(page, "iam-liste-pending-activation-light-desktop");

  const resendButton = page.getByRole("button", { name: "Renvoyer l’activation" }).first();
  if ((await resendButton.count()) > 0) {
    await resendButton.focus();
    await page.waitForTimeout(150);
    await capture(page, "iam-action-renvoyer-activation-light-desktop");
  }

  await page.getByRole("button", { name: "Créer l'utilisateur" }).first().click();
  await page.waitForTimeout(300);
  await capture(page, "iam-erreurs-formulaire-light-desktop");
  await context.close();
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    await runAuthCapture(browser, "login-fr-dark", "/", "fr", "dark");
    await runAuthCapture(browser, "login-fr-light", "/", "fr", "light");
    await runAuthCapture(browser, "login-en-light", "/", "en", "light");
    await runAuthCapture(browser, "login-ar-light", "/", "ar", "light");
    await runAuthCapture(browser, "forgot-password-sans-token", "/", "fr", "light", viewports.desktop, async (page) => {
      await page.getByRole("button", { name: /Mot de passe oublié/u }).click();
    });
    await runAuthCapture(browser, "reset-password-avec-token", "/reset-password?token=visual-reset-token", "fr", "light");
    await runAuthCapture(browser, "activation-avec-token", "/activate?token=visual-activation-token", "fr", "light");
    await runAuthCapture(browser, "mobile-login", "/", "fr", "light", viewports.mobile);
    await runAuthCapture(browser, "mobile-activation", "/activate?token=visual-activation-token", "fr", "light", viewports.mobile);
    await runAuthCapture(browser, "mobile-forgot-password", "/", "fr", "light", viewports.mobile, async (page) => {
      await page.getByRole("button", { name: /Mot de passe oublié/u }).click();
    });
    await runIamCaptures(browser);
  } finally {
    await browser.close();
  }

  const report = {
    baseUrl,
    consoleErrors: [...new Set(consoleErrors)],
    findings,
    outputDir,
    screenshots,
    timestamp: new Date().toISOString()
  };
  await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Auth/IAM visual audit output: ${outputDir}`);
  console.log(`Screenshots: ${screenshots.length}`);
  console.log(`Findings: ${findings.length}`);
  for (const finding of findings) {
    console.log(`[${finding.priority}] ${finding.label}: ${finding.message}`);
  }
  if (consoleErrors.length > 0) {
    console.log(`Console errors: ${consoleErrors.length}`);
  }
  if (findings.some((finding) => finding.priority === "P0")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
