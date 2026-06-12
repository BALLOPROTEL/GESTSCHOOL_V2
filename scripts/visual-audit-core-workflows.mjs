import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(new URL("../Frontend/web-admin/package.json", import.meta.url));
const { chromium } = require("playwright");

const baseUrl = process.env.VISUAL_AUDIT_URL || "http://127.0.0.1:5180";
const outputRoot = process.env.VISUAL_AUDIT_OUTPUT || "/tmp/gestschool-core-visual-audit";
const auditScope = (process.env.VISUAL_AUDIT_SCOPE || "full").trim().toLowerCase();
const isCiAudit = auditScope === "ci";
const runId = new Date().toISOString().replace(/[:.]/gu, "-");
const outputDir = path.join(outputRoot, runId);

const storageKeys = {
  language: "gestschool.web-admin.language",
  session: "gestschool.web-admin.session",
  theme: "gestschool.web-admin.theme"
};

const viewports = {
  desktopLarge: { width: 1920, height: 1080 },
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1366, height: 768 },
  desktopNarrow: { width: 1220, height: 760 },
  tablet: { width: 768, height: 1024 },
  tabletWide: { width: 1024, height: 768 },
  mobile: { width: 414, height: 896 },
  mobileSmall: { width: 360, height: 800 }
};

const requiredViewportThemes = [
  ["desktopLarge", "light"],
  ["desktopLarge", "dark"],
  ["desktop", "light"],
  ["desktop", "dark"],
  ["laptop", "light"],
  ["laptop", "dark"],
  ["tabletWide", "light"],
  ["tabletWide", "dark"],
  ["tablet", "light"],
  ["tablet", "dark"],
  ["mobile", "light"],
  ["mobile", "dark"],
  ["mobileSmall", "light"],
  ["mobileSmall", "dark"]
];

const ciViewportThemes = [
  ["desktop", "light"],
  ["tablet", "dark"],
  ["mobile", "light"]
];

const activeViewportThemes = isCiAudit ? ciViewportThemes : requiredViewportThemes;

const screenshots = [];
const findings = [];
const consoleErrors = [];
const networkErrors = [];
const ignoredLocalApiErrors = [];

const safeName = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");

const isExpectedLocalApiFailure = (value) =>
  value.includes("127.0.0.1") && value.includes("/api/v1/");

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
      if (message.type() !== "error") return;
      const location = message.location();
      const source = location.url ? ` (${location.url}:${location.lineNumber})` : "";
      const entry = `${message.text()}${source}`;
      if (isExpectedLocalApiFailure(entry)) {
        ignoredLocalApiErrors.push(entry);
        return;
      }
      consoleErrors.push(entry);
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() < 400) return;
      const entry = `HTTP ${response.status()} ${response.url()}`;
      if (isExpectedLocalApiFailure(entry)) {
        ignoredLocalApiErrors.push(entry);
        return;
      }
      networkErrors.push(entry);
    });
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
  await page.waitForSelector(".screen-host", { timeout: 20_000 });
  await page.waitForTimeout(700);
}

async function openModule(page, labelPattern, expectedTextPattern) {
  const sidebarItem = page.locator(".app-sidebar-v2 .sidebar-link").filter({ hasText: labelPattern });

  if (await clickFirstVisible(sidebarItem)) {
    await page.waitForTimeout(350);
  } else {
    const mobileToggle = page.locator(".header-mobile-toggle").first();
    if (!(await mobileToggle.isVisible().catch(() => false))) {
      throw new Error(`Impossible d'ouvrir le module ${labelPattern}.`);
    }

    await mobileToggle.click({ timeout: 5_000 });
    await page.waitForSelector("#header-mobile-panel.is-open", { timeout: 5_000 });
    const mobileItem = page.locator("#header-mobile-panel .header-mobile-link").filter({ hasText: labelPattern });
    if (!(await clickFirstVisible(mobileItem))) {
      throw new Error(`Impossible d'ouvrir le module ${labelPattern} depuis le menu mobile.`);
    }
  }

  await page.waitForFunction((pattern) => new RegExp(pattern, "u").test(document.body.innerText), expectedTextPattern.source, {
    timeout: 10_000
  });
  await page.waitForTimeout(500);
}

async function openUserMenu(page) {
  const trigger = page.locator(".sidebar-user-card").first();
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click({ timeout: 5_000 });
    await page.waitForSelector(".sidebar-user-dropdown", { timeout: 5_000 });
    return "desktop";
  }

  const mobileToggle = page.locator(".header-mobile-toggle").first();
  await mobileToggle.click({ timeout: 5_000 });
  await page.waitForSelector("#header-mobile-panel.is-open", { timeout: 5_000 });
  return "mobile";
}

async function clickUserAction(page, mode, actionLabel, expectedTextPattern) {
  const container =
    mode === "desktop"
      ? page.locator(".sidebar-user-dropdown")
      : page.locator("#header-mobile-panel");
  await container.getByRole("menuitem", { name: actionLabel }).click({ timeout: 5_000 });
  await page.waitForFunction((pattern) => new RegExp(pattern, "u").test(document.body.innerText), expectedTextPattern.source, {
    timeout: 10_000
  });
  await page.waitForTimeout(600);
}

async function clickTab(page, labelPattern) {
  const tab = page.getByRole("tab", { name: labelPattern }).first();
  if (await tab.isVisible().catch(() => false)) {
    await tab.click({ timeout: 5_000 });
  } else {
    await page.getByRole("button", { name: labelPattern }).first().click({ timeout: 5_000 });
  }
  await page.waitForTimeout(500);
}

async function capture(page, name, options = {}) {
  const filePath = path.join(outputDir, `${safeName(name)}.png`);
  await page.screenshot({ fullPage: options.fullPage ?? false, path: filePath });
  screenshots.push(filePath);
}

async function captureScrolledTable(page, tableWrapSelector, label) {
  const tableWrap = page.locator(tableWrapSelector).first();
  if (!(await tableWrap.isVisible().catch(() => false))) return;

  await tableWrap.evaluate((element) => {
    const scrollContainer =
      element instanceof HTMLTableElement
        ? element.closest(".table-wrap") ?? element.parentElement ?? element
        : element;
    scrollContainer.scrollLeft = scrollContainer.scrollWidth;
  });
  await page.waitForTimeout(250);
  await capture(page, label, { fullPage: true });
  await tableWrap.evaluate((element) => {
    const scrollContainer =
      element instanceof HTMLTableElement
        ? element.closest(".table-wrap") ?? element.parentElement ?? element
        : element;
    scrollContainer.scrollLeft = 0;
  });
}

async function captureFirstActionMenu(page, triggerSelector, menuSelector, label) {
  const actionMenuTrigger = page.locator(triggerSelector).first();
  if (!(await actionMenuTrigger.isVisible().catch(() => false))) return;
  await actionMenuTrigger.click({ timeout: 5_000 });
  await page.waitForSelector(menuSelector, { timeout: 5_000 });
  await page.waitForTimeout(200);
  await capture(page, label, { fullPage: true });
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

async function auditRequiredText(page, label, values) {
  const text = await page.locator("body").innerText();
  for (const value of values) {
    if (!text.includes(value)) {
      findings.push({
        label,
        priority: "P1",
        type: "required-content",
        message: `Texte attendu absent: ${value}.`
      });
    }
  }
}

async function auditForbiddenText(page, label, values) {
  const text = await getScreenText(page);
  for (const value of values) {
    if (text.includes(value)) {
      findings.push({
        label,
        priority: "P1",
        type: "forbidden-content",
        message: `Texte interdit ou technique visible: ${value}.`
      });
    }
  }
}

async function auditUserMenu(page, label, mode) {
  const scope =
    mode === "desktop"
      ? page.locator(".sidebar-user-dropdown").first()
      : page.locator("#header-mobile-panel").first();
  const text = await scope.innerText();
  for (const expected of ["Mon profil", "Préférences", "Journal d’activité", "Facturation", "Se déconnecter"]) {
    if (!text.includes(expected)) {
      findings.push({
        label,
        priority: "P1",
        type: "user-menu",
        message: `Entrée absente du menu utilisateur: ${expected}.`
      });
    }
  }
  for (const forbidden of ["ÉTABLISSEMENT", "ANNÉE SCOLAIRE", "STATUT"]) {
    if (text.includes(forbidden)) {
      findings.push({
        label,
        priority: "P1",
        type: "user-menu-context",
        message: `Ancienne information de contexte encore visible dans le menu utilisateur: ${forbidden}.`
      });
    }
  }
}

async function seedGradesSummary(page) {
  await clickTab(page, /Saisie des notes/u);
  const firstScore = page.locator('input[aria-label^="Note de"]').first();
  if (await firstScore.isVisible().catch(() => false)) {
    await firstScore.fill("15");
    await page.getByRole("button", { name: "Enregistrer les notes" }).click({ timeout: 5_000 });
    await page.waitForTimeout(500);
  }

  await clickTab(page, /Moyennes/u);
  const computeButton = page.getByRole("button", { name: /Calculer les moyennes\/rangs|Recalculer les moyennes\/rangs/u }).first();
  if (await computeButton.isVisible().catch(() => false)) {
    await computeButton.click({ timeout: 5_000 });
    await page.waitForTimeout(600);
  }

  const detailButton = page.getByRole("button", { name: "Voir détail" }).first();
  if (await detailButton.isVisible().catch(() => false)) {
    await detailButton.click({ timeout: 5_000 });
    await page.waitForTimeout(300);
  }
}

async function runDashboard(browser, viewportName, theme) {
  const context = await createContext(browser, viewports[viewportName], theme);
  const page = await context.newPage();
  await openPreview(page);
  await openModule(page, /Tableau de bord/u, /Tableau de bord/u);
  const label = `dashboard-${viewportName}-${theme}`;
  await auditNoHorizontalOverflow(page, label);
  await auditRequiredText(page, label, ["Tâches prioritaires", "Alertes & suivi"]);
  await auditForbiddenText(page, label, ["Accueil simplifie", "backend messagerie", "UI-only"]);
  await capture(page, label, { fullPage: viewportName !== "desktop" });
  await context.close();
}

async function runHeaderLanguage(browser, theme) {
  const context = await createContext(browser, viewports.desktop, theme);
  const page = await context.newPage();
  await openPreview(page);
  const trigger = page.locator(".header-language-dropdown .header-icon-button").first();
  await trigger.click({ timeout: 5_000 });
  await page.waitForSelector(".header-floating-panel.header-language-dropdown", { timeout: 5_000 });
  const label = `header-language-desktop-${theme}`;
  await auditNoHorizontalOverflow(page, label);
  await auditRequiredText(page, label, ["Langue", "Français", "Anglais", "Arabe"]);
  await capture(page, label);
  await context.close();
}

async function runProfile(browser, viewportName, theme) {
  const context = await createContext(browser, viewports[viewportName], theme);
  const page = await context.newPage();
  await openPreview(page);
  const mode = await openUserMenu(page);
  await auditUserMenu(page, `profile-menu-${viewportName}-${theme}`, mode);
  await capture(page, `profile-menu-${viewportName}-${theme}`);
  await clickUserAction(page, mode, "Mon profil", /Mon profil/u);

  const label = `profile-${viewportName}-${theme}`;
  await auditNoHorizontalOverflow(page, label);
  await auditRequiredText(page, label, [
    "Mon profil",
    "Informations personnelles",
    "Sécurité du compte",
    "Préférences",
    "Activité récente",
    "Mes rôles et permissions"
  ]);
  await auditForbiddenText(page, label, ["passwordHash", "refreshToken", "temporaryPassword", "Facturation / abonnement"]);
  await capture(page, label, { fullPage: viewportName !== "desktop" });
  await context.close();
}

async function runPilotage(browser, viewportName, theme) {
  const context = await createContext(browser, viewports[viewportName], theme);
  const page = await context.newPage();
  await openPreview(page);
  await openModule(page, /Pilotage/u, /Pilotage/u);
  const label = `pilotage-${viewportName}-${theme}`;
  await auditNoHorizontalOverflow(page, label);
  await auditRequiredText(page, label, [
    "CONSOLE OPÉRATIONNELLE",
    "Scolarité",
    "Vie scolaire",
    "Finance",
    "À traiter en priorité",
    "Inscriptions",
    "Notes & bulletins"
  ]);
  await auditForbiddenText(page, label, ["Tableau de bord", "données fictives", "mock"]);
  await capture(page, label, { fullPage: viewportName !== "desktop" });
  await context.close();
}

async function runGrades(browser, viewportName, theme) {
  const context = await createContext(browser, viewports[viewportName], theme);
  const page = await context.newPage();
  await openPreview(page);
  await openModule(page, /Notes & bulletins/u, /Vue d’ensemble/u);

  const overviewLabel = `notes-bulletins-overview-${viewportName}-${theme}`;
  await auditNoHorizontalOverflow(page, overviewLabel);
  await auditRequiredText(page, overviewLabel, ["Vue d’ensemble", "Saisie des notes", "Moyennes & rangs", "Bulletins"]);
  await auditForbiddenText(page, overviewLabel, [
    "Passe finale",
    "Generation bulletin PDF",
    "Generez",
    "Generer",
    "Bulletins generes",
    "Aucun resume calcule",
    "fichier(s)",
    "bulletin(s)",
    "note(s)"
  ]);
  await capture(page, overviewLabel, { fullPage: viewportName !== "desktop" });

  if (viewportName === "desktop" && theme === "light") {
    await seedGradesSummary(page);
    await auditNoHorizontalOverflow(page, "notes-bulletins-moyennes-detail-desktop-light");
    await auditRequiredText(page, "notes-bulletins-moyennes-detail-desktop-light", ["Moyennes & rangs"]);
    await capture(page, "notes-bulletins-moyennes-detail-desktop-light", { fullPage: true });

    await clickTab(page, /Bulletins/u);
    await auditNoHorizontalOverflow(page, "notes-bulletins-bulletins-desktop-light");
    await auditRequiredText(page, "notes-bulletins-bulletins-desktop-light", ["Génération des bulletins", "Bulletins générés"]);
    await capture(page, "notes-bulletins-bulletins-desktop-light", { fullPage: true });
  }

  await context.close();
}

async function runFinance(browser, viewportName, theme) {
  const context = await createContext(browser, viewports[viewportName], theme);
  const page = await context.newPage();
  await openPreview(page);
  await openModule(page, /Comptabilité/u, /Console de recouvrement/u);
  const label = `finance-${viewportName}-${theme}`;
  await auditNoHorizontalOverflow(page, label);
  await auditRequiredText(page, label, ["Comptabilité", "Console de recouvrement"]);
  await auditForbiddenText(page, label, ["Finance v2", "ACTIVE", "INACTIVE", "ARCHIVED", "Recharger comptabilite"]);
  await capture(page, label, { fullPage: viewportName !== "desktop" });

  if (viewportName.startsWith("mobile") || viewportName.startsWith("tablet")) {
    await clickTab(page, /Plans de frais/u);
    await captureScrolledTable(page, ".finance-v3-shell .table-wrap", `finance-fee-plans-table-right-${viewportName}-${theme}`);
    await clickTab(page, /Factures/u);
    await captureScrolledTable(page, ".finance-v3-shell .table-wrap", `finance-invoices-table-right-${viewportName}-${theme}`);
    await captureFirstActionMenu(page, ".finance-v3-shell .v3-more-button", ".finance-v3-shell .v3-action-menu", `finance-actions-${viewportName}-${theme}`);
  }
  await context.close();
}

async function runStudents(browser, viewportName, theme) {
  const context = await createContext(browser, viewports[viewportName], theme);
  const page = await context.newPage();
  await openPreview(page);
  await openModule(page, /Élèves|Eleves/u, /Ajouter un élève/u);
  const label = `students-${viewportName}-${theme}`;
  await auditNoHorizontalOverflow(page, label);
  await auditRequiredText(page, label, ["Élèves", "Ajouter un élève"]);
  await auditForbiddenText(page, label, ["Identifiant interne", "source de verite", "Resultat filtre"]);
  await capture(page, label, { fullPage: viewportName !== "desktop" });
  if (viewportName.startsWith("mobile") || viewportName.startsWith("tablet")) {
    await captureScrolledTable(page, ".students-v3-table-card .table-wrap", `students-table-right-${viewportName}-${theme}`);
    await captureFirstActionMenu(page, ".students-v3-more-button", ".students-v3-action-menu", `students-actions-${viewportName}-${theme}`);
  }
  await context.close();
}

async function runEnrollments(browser, viewportName, theme) {
  const context = await createContext(browser, viewports[viewportName], theme);
  const page = await context.newPage();
  await openPreview(page);
  await openModule(page, /Inscriptions/u, /Nouvelle inscription/u);
  const label = `enrollments-${viewportName}-${theme}`;
  await auditNoHorizontalOverflow(page, label);
  await auditRequiredText(page, label, ["Inscriptions", "Recherche rapide", "Liste des inscriptions"]);
  await auditForbiddenText(page, label, [
    "Suivi des inscriptions",
    "Admissions",
    "Type de placement",
    "Actions",
    "FlexAdmin",
    "Vue v2"
  ]);
  await capture(page, label, { fullPage: viewportName !== "desktop" });

  if (viewportName.startsWith("mobile") || viewportName.startsWith("tablet")) {
    await captureScrolledTable(page, ".enrollments-v3-table-card .table-wrap", `enrollments-table-right-${viewportName}-${theme}`);
    await captureFirstActionMenu(page, ".enrollments-v3-more-button", ".enrollments-v3-action-menu", `enrollments-actions-${viewportName}-${theme}`);
  }

  if (viewportName === "desktopNarrow" && theme === "dark") {
    const tableWrap = page.locator(".enrollments-v3-table-card .table-wrap").first();
    await tableWrap.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await capture(page, "enrollments-table-actions-desktopnarrow-dark", { fullPage: true });
  }

  if (viewportName === "desktop" && theme === "light") {
    const actionMenuTrigger = page.locator(".enrollments-v3-more-button").first();
    if (await actionMenuTrigger.isVisible().catch(() => false)) {
      await actionMenuTrigger.click({ timeout: 5_000 });
      await page.waitForSelector(".enrollments-v3-action-menu", { timeout: 5_000 });
      await auditRequiredText(page, "enrollments-actions-desktop-light", ["Voir", "Modifier", "Supprimer"]);
      await capture(page, "enrollments-actions-desktop-light");
    }

    await page.getByRole("button", { name: "Nouvelle inscription" }).click({ timeout: 5_000 });
    await page.waitForFunction(() => document.body.innerText.includes("Créer inscription"), { timeout: 10_000 });
    await auditNoHorizontalOverflow(page, "enrollments-create-desktop-light");
    await auditRequiredText(page, "enrollments-create-desktop-light", ["Nouvelle inscription", "Créer inscription"]);
    await capture(page, "enrollments-create-desktop-light");
  }
  await context.close();
}

async function runTeachers(browser, viewportName, theme) {
  const context = await createContext(browser, viewports[viewportName], theme);
  const page = await context.newPage();
  await openPreview(page);
  await openModule(page, /Enseignants/u, /Ajouter un enseignant/u);
  const label = `teachers-${viewportName}-${theme}`;
  await auditNoHorizontalOverflow(page, label);
  await auditRequiredText(page, label, ["Enseignants", "Base enseignants", "Recherche rapide", "Aminata Coulibaly"]);
  await auditForbiddenText(page, label, ["Registre enseignants", "Module enseignants", "Actions", "Workflow"]);
  await capture(page, label, { fullPage: viewportName !== "desktop" });
  if (viewportName.startsWith("mobile") || viewportName.startsWith("tablet")) {
    await captureScrolledTable(page, ".teachers-v3-table-card .table-wrap", `teachers-table-right-${viewportName}-${theme}`);
    await captureFirstActionMenu(page, ".teachers-v3-more-button", ".teachers-v3-action-menu", `teachers-actions-${viewportName}-${theme}`);
  }

  if (viewportName === "desktop" && theme === "light") {
    const actionMenuTrigger = page.locator(".teachers-v3-more-button").first();
    if (await actionMenuTrigger.isVisible().catch(() => false)) {
      await actionMenuTrigger.click({ timeout: 5_000 });
      await page.waitForSelector(".teachers-v3-action-menu", { timeout: 5_000 });
      await auditRequiredText(page, "teachers-actions-desktop-light", ["Voir", "Modifier", "Archiver"]);
      await capture(page, "teachers-actions-desktop-light");
    }
  }
  await context.close();
}

const moduleOverviewScenarios = [
  {
    key: "iam",
    nav: /Utilisateurs & droits/u,
    expected: /Comptes utilisateurs/u,
    required: ["Comptes utilisateurs", "Droits par profil"],
    tableSelector: '[data-testid="iam-users-table"]'
  },
  {
    key: "rooms",
    nav: /Salles/u,
    expected: /Salles, capacités et usages/u,
    required: ["Salles", "Salles, capacités et usages", "Ajouter une salle"],
    tableSelector: ".rooms-v3-table-card .table-wrap"
  },
  {
    key: "parents",
    nav: /Parents/u,
    expected: /Liste des responsables/u,
    required: ["Liste des responsables"],
    tableSelector: ".parents-v3-table-card .table-wrap"
  },
  {
    key: "attendance",
    nav: /Absences/u,
    expected: /Absences/u,
    required: ["Absences", "Journal des absences"],
    tableSelector: ".school-life-root .table-wrap"
  },
  {
    key: "timetable",
    nav: /Emploi du temps/u,
    expected: /Emploi du temps/u,
    required: ["Emploi du temps", "Grille d'emploi du temps"],
    tableSelector: ".school-life-root .table-wrap"
  },
  {
    key: "notifications",
    nav: /Notifications/u,
    expected: /Notifications/u,
    required: ["Notifications", "Historique notifications"],
    tableSelector: ".school-life-root .table-wrap"
  },
  {
    key: "reference",
    nav: /Référentiel/u,
    expected: /Annee scolaire|Annees/u,
    required: ["Annee scolaire", "Libelle de l'annee scolaire"],
    tableSelector: ".reference-shell .table-wrap"
  },
  {
    key: "reports",
    nav: /Rapports & conformité/u,
    expected: /Filtrer la fenetre de pilotage/u,
    required: ["Filtrer la fenetre de pilotage", "Indicateurs executifs"],
    tableSelector: ".table-wrap"
  },
  {
    key: "mosquee",
    nav: /Mosquée/u,
    expected: /Mosquée|Mosquee/u,
    required: [],
    tableSelector: null
  }
];

async function runModuleOverview(browser, viewportName, theme, scenario) {
  const context = await createContext(browser, viewports[viewportName], theme);
  const page = await context.newPage();
  await openPreview(page);
  await openModule(page, scenario.nav, scenario.expected);
  const label = `${scenario.key}-${viewportName}-${theme}`;
  await auditNoHorizontalOverflow(page, label);
  await auditRequiredText(page, label, scenario.required);
  await auditForbiddenText(page, label, ["FlexAdmin", "Vue v2", "UI-only"]);
  await capture(page, label, { fullPage: viewportName !== "desktop" });

  if (scenario.tableSelector && (viewportName.startsWith("mobile") || viewportName.startsWith("tablet"))) {
    await captureScrolledTable(page, scenario.tableSelector, `${scenario.key}-table-right-${viewportName}-${theme}`);
    await captureFirstActionMenu(page, ".screen-host .v3-more-button", ".screen-host .v3-action-menu", `${scenario.key}-actions-${viewportName}-${theme}`);
  }

  if (viewportName === "desktop" && theme === "light") {
    const actionMenuTrigger = page.locator(".v3-more-button").first();
    if (await actionMenuTrigger.isVisible().catch(() => false)) {
      await actionMenuTrigger.click({ timeout: 5_000 });
      await page.waitForSelector(".v3-action-menu", { timeout: 5_000 });
      await capture(page, `${scenario.key}-actions-desktop-light`);
    }
  }

  await context.close();
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [viewportName, theme] of activeViewportThemes) {
      await runDashboard(browser, viewportName, theme);
    }

    await runHeaderLanguage(browser, "light");
    if (!isCiAudit) {
      await runHeaderLanguage(browser, "dark");
    }

    for (const [viewportName, theme] of activeViewportThemes) {
      await runProfile(browser, viewportName, theme);
      await runFinance(browser, viewportName, theme);
      await runStudents(browser, viewportName, theme);
      if (!isCiAudit) {
        await runPilotage(browser, viewportName, theme);
        await runGrades(browser, viewportName, theme);
      }
    }

    await runEnrollments(browser, "desktop", "light");
    if (!isCiAudit) {
      await runEnrollments(browser, "desktop", "dark");
      await runEnrollments(browser, "desktopNarrow", "light");
      await runEnrollments(browser, "desktopNarrow", "dark");
    }
    for (const [viewportName, theme] of activeViewportThemes) {
      if (viewportName !== "desktop") {
        await runEnrollments(browser, viewportName, theme);
      }
      await runTeachers(browser, viewportName, theme);
    }

    const activeModuleScenarios = isCiAudit
      ? moduleOverviewScenarios.filter((scenario) =>
          ["iam", "rooms", "parents"].includes(scenario.key)
        )
      : moduleOverviewScenarios;
    for (const scenario of activeModuleScenarios) {
      for (const [viewportName, theme] of activeViewportThemes) {
        try {
          await runModuleOverview(browser, viewportName, theme, scenario);
        } catch (error) {
          findings.push({
            label: `${scenario.key}-${viewportName}-${theme}`,
            priority: "P1",
            type: "module-capture",
            message: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
  } finally {
    await browser.close();
  }

  for (const message of consoleErrors) {
    findings.push({
      label: "console",
      priority: "P2",
      type: "console-error",
      message
    });
  }

  for (const message of networkErrors) {
    findings.push({
      label: "network",
      priority: "P2",
      type: "network-error",
      message
    });
  }

  const report = {
    baseUrl,
    auditScope,
    outputDir,
    screenshots,
    findings,
    consoleErrors,
    networkErrors,
    ignoredLocalApiErrors,
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
