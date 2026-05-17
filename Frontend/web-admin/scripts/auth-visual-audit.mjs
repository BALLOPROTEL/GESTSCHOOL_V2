import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.VISUAL_AUDIT_URL || "http://127.0.0.1:5180";
const outputRoot = process.env.VISUAL_AUDIT_OUTPUT || "/tmp/gestschool-auth-audit";
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
        window.localStorage.removeItem(keys.loginHint);
        window.localStorage.removeItem(keys.session);
        window.sessionStorage.removeItem(keys.session);
      } catch {
        // Opaque origins can exist before the Vite document is loaded.
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

async function openAuth(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".auth-canvas", { timeout: 20_000 });
  await page.waitForTimeout(500);
}

async function capture(page, name, options = {}) {
  const filePath = path.join(outputDir, `${safeName(name)}.png`);
  await page.screenshot({ fullPage: options.fullPage ?? false, path: filePath });
  screenshots.push(filePath);
  return filePath;
}

async function clickAuthButton(page, label) {
  await page.getByRole("button", { name: label }).first().click({ timeout: 5_000 });
  await page.waitForTimeout(350);
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
      message: `Debordement horizontal detecte: ${Math.round(overflow)}px.`
    });
  }
}

async function auditAuthLayout(page, label) {
  await auditNoHorizontalOverflow(page, label);

  const visibleThemeText = await page.evaluate(() => /\b(th[èe]me|theme)\b/iu.test(document.body.innerText));
  if (visibleThemeText) {
    findings.push({
      label,
      priority: "P1",
      type: "theme-label",
      message: "Le libelle visible Theme/Theme est encore present dans l'auth."
    });
  }

  const brandTitle = await page.locator("[data-testid='auth-brand-title']").innerText().catch(() => "");
  if (!brandTitle.includes("Al Manarat Islamiyat")) {
    findings.push({
      label,
      priority: "P1",
      type: "branding",
      message: "Al Manarat Islamiyat n'est pas le titre principal de la page auth."
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

  const narrowFields = await page.locator(".auth-canvas__field").evaluateAll((fields) =>
    fields
      .map((field) => {
        const rect = field.getBoundingClientRect();
        return Math.round(rect.width);
      })
      .filter((width) => width < 300 && window.innerWidth >= 768)
  );
  if (narrowFields.length > 0) {
    findings.push({
      label,
      priority: "P1",
      type: "compact-fields",
      message: `${narrowFields.length} champ(s) auth trop etroit(s) en desktop/tablette.`
    });
  }
}

async function runScenario(browser, name, viewport, theme, visit) {
  const context = await createContext(browser, viewport, "fr", theme);
  const page = await context.newPage();
  await openAuth(page);
  await visit(page);
  await auditAuthLayout(page, name);
  await capture(page, name, { fullPage: viewport.width <= 480 || name.includes("bottom") });
  await context.close();
}

async function runLocalizedLogin(browser, language, theme) {
  const context = await createContext(browser, viewports.desktop, language, theme);
  const page = await context.newPage();
  await openAuth(page);
  await auditAuthLayout(page, `login-${language}-${theme}`);
  await capture(page, `login-${language}-desktop-${theme}`);
  await context.close();
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  await runScenario(browser, "login-desktop-dark", viewports.desktop, "dark", async () => {});
  await runScenario(browser, "login-desktop-light", viewports.desktop, "light", async () => {});
  await runScenario(browser, "activation-desktop-dark", viewports.desktop, "dark", async (page) => {
    await clickAuthButton(page, /Activer mon compte/u);
  });
  await runScenario(browser, "activation-desktop-light", viewports.desktop, "light", async (page) => {
    await clickAuthButton(page, /Activer mon compte/u);
  });
  await runScenario(browser, "forgot-desktop-dark-top", viewports.desktop, "dark", async (page) => {
    await clickAuthButton(page, /Mot de passe oublié/u);
  });
  await runScenario(browser, "forgot-desktop-light-top", viewports.desktop, "light", async (page) => {
    await clickAuthButton(page, /Mot de passe oublié/u);
  });
  await runScenario(browser, "forgot-desktop-dark-bottom", viewports.desktop, "dark", async (page) => {
    await clickAuthButton(page, /Mot de passe oublié/u);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(250);
  });
  await runScenario(browser, "forgot-desktop-light-bottom", viewports.desktop, "light", async (page) => {
    await clickAuthButton(page, /Mot de passe oublié/u);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(250);
  });
  await runScenario(browser, "login-mobile-390", viewports.mobile, "light", async () => {});
  await runScenario(browser, "activation-mobile-390", viewports.mobile, "light", async (page) => {
    await clickAuthButton(page, /Activer mon compte/u);
  });
  await runScenario(browser, "forgot-mobile-390", viewports.mobile, "light", async (page) => {
    await clickAuthButton(page, /Mot de passe oublié/u);
  });
  await runScenario(browser, "login-tablet-768", viewports.tablet, "light", async () => {});
  await runLocalizedLogin(browser, "en", "light");
  await runLocalizedLogin(browser, "ar", "light");

  await browser.close();

  const report = {
    url: baseUrl,
    outputDir,
    screenshots,
    findings,
    consoleErrors: [...new Set(consoleErrors)]
  };
  await writeFile(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));

  if (findings.some((finding) => finding.priority === "P0")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
