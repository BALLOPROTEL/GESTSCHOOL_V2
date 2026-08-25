// @ts-check

import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { mockApiV1Routes, MOCK_FIXTURE_VERSION } from "./visual-audit/fixtures/mock-api-v1.mjs";
import { createAuditGuard } from "./visual-audit/lib/audit-guard.mjs";
import { resolveChromiumLaunchOptions } from "./visual-audit/lib/local-tls.mjs";

const require = createRequire(new URL("../Frontend/web-admin/package.json", import.meta.url));
const { chromium } = require("playwright");

const mode = (process.env.VISUAL_AUDIT_MODE || "").trim().toLowerCase();
if (mode !== "mocked" && mode !== "integrated") {
  throw new Error("VISUAL_AUDIT_MODE est obligatoire et doit valoir mocked ou integrated.");
}

const baseUrl = process.env.VISUAL_AUDIT_URL || "http://127.0.0.1:5180";
const outputRoot = process.env.VISUAL_AUDIT_OUTPUT || "/tmp/gestschool-core-visual-audit";
const auditScope = (process.env.VISUAL_AUDIT_SCOPE || "full").trim().toLowerCase();
const runId = new Date().toISOString().replace(/[:.]/gu, "-");
const outputDir = path.join(outputRoot, runId);

const integratedCredentials = {
  username: process.env.VISUAL_AUDIT_USERNAME || "",
  password: process.env.VISUAL_AUDIT_PASSWORD || ""
};
if (mode === "integrated" && (!integratedCredentials.username || !integratedCredentials.password)) {
  throw new Error("Le mode integrated exige VISUAL_AUDIT_USERNAME et VISUAL_AUDIT_PASSWORD.");
}

const storageKeys = {
  language: "gestschool.web-admin.language",
  loginHint: "gestschool.web-admin.login-hint",
  session: "gestschool.web-admin.session",
  theme: "gestschool.web-admin.theme"
};

const viewports = {
  smallMobile: { width: 320, height: 568 },
  mobileNarrow: { width: 360, height: 800 },
  mobile375: { width: 375, height: 812 },
  mobile390: { width: 390, height: 844 },
  mobile412: { width: 412, height: 915 },
  mobileLarge: { width: 414, height: 896 },
  boundary767: { width: 767, height: 1024 },
  tabletPortrait: { width: 768, height: 1024 },
  tabletTall: { width: 768, height: 1366 },
  tablet800: { width: 800, height: 1280 },
  tablet820: { width: 820, height: 1180 },
  tablet834: { width: 834, height: 1194 },
  tablet900: { width: 900, height: 1200 },
  tablet1000: { width: 1000, height: 800 },
  boundary1023: { width: 1023, height: 768 },
  compactPortrait: { width: 1024, height: 1366 },
  tabletLandscape: { width: 1024, height: 768 },
  tabletLandscape1180: { width: 1180, height: 820 },
  tabletLandscape1194: { width: 1194, height: 834 },
  compact1200: { width: 1200, height: 800 },
  boundary1279: { width: 1279, height: 800 },
  desktop1280: { width: 1280, height: 720 },
  boundary1280: { width: 1280, height: 800 },
  desktop: { width: 1440, height: 900 },
  desktopLarge: { width: 1920, height: 1080 },
  zoom200: { width: 720, height: 450 },
  zoomTabletPortrait: { width: 384, height: 512 },
  zoomTabletLandscape: { width: 512, height: 384 },
  zoomTablet1180: { width: 590, height: 410 }
};

const allWorkflows = [
  { key: "dashboard", nav: /Tableau de bord/u, required: ["Tâches prioritaires", "Alertes & suivi"] },
  { key: "students", nav: /Élèves|Eleves/u, required: ["Élèves", "Ajouter un élève"] },
  { key: "teachers", nav: /Enseignants/u, required: ["Enseignants", "Base enseignants"] },
  { key: "iam", nav: /Utilisateurs & droits/u, required: ["Comptes utilisateurs", "Droits par profil"] },
  { key: "enrollments", nav: /Inscriptions/u, required: ["Inscriptions", "Liste des inscriptions"] },
  { key: "finance", nav: /Comptabilité/u, required: ["Console de recouvrement"] },
  { key: "grades", nav: /Notes & bulletins/u, required: ["Vue d’ensemble", "Saisie des notes", "Bulletins"] },
  { key: "attendance", navigationId: "schoolLifeAttendance", nav: /Absences/u, required: ["Absences", "Journal des absences"] },
  { key: "rooms", nav: /Salles/u, required: ["Salles", "Ajouter une salle"] },
  { key: "timetable", navigationId: "schoolLifeTimetable", nav: /Emploi du temps/u, required: ["Emploi du temps", "Grille d'emploi du temps"] },
  { key: "notifications", navigationId: "schoolLifeNotifications", nav: /Notifications/u, required: ["Notifications", "Historique notifications"] },
  { key: "reference", nav: /Référentiel/u, required: ["Annee scolaire"] },
  { key: "pilotage", navigationId: "schoolLifeOverview", nav: /Pilotage/u, required: ["CONSOLE OPÉRATIONNELLE", "Scolarité", "Finance"] },
  { key: "parents", nav: /Parents/u, required: ["Liste des responsables"] },
  { key: "reports", nav: /Rapports & conformité/u, required: ["Indicateurs executifs"] },
  { key: "profile", userAction: /Mon profil/u, required: ["Mon profil", "Informations personnelles", "Sécurité du compte"] },
  { key: "preferences", userAction: /Préférences/u, required: ["Préférences", "Enregistrer les préférences"] },
  { key: "activity", userAction: /Journal d’activité/u, required: ["Journal d’activité"] }
];

const criticalKeys = new Set(["dashboard", "students", "enrollments", "finance", "grades"]);
const responsiveFormWorkflowKeys = new Set([
  "students",
  "teachers",
  "iam",
  "finance",
  "grades",
  "attendance",
  "rooms",
  "timetable",
  "notifications",
  "reference",
  "parents",
  "profile",
  "preferences"
]);
const responsiveFormOpeners = {
  finance: ".workflow-tabs [role='tab']:nth-child(2)",
  grades: ".workflow-tabs [role='tab']:nth-child(2)",
  iam: ".iam-v3-table-card .v3-table-head button",
  parents: ".workflow-tabs [role='tab']:nth-child(2)",
  profile: ".premium-profile-primary",
  rooms: ".rooms-v3-table-card .v3-table-head > button",
  students: ".students-v3-page-header > button",
  teachers: ".teachers-v3-page-header > button"
};

const r6JourneyKeys = new Set([
  "iam",
  "students",
  "enrollments",
  "finance",
  "grades",
  "attendance",
  "timetable",
  "pilotage"
]);
const r6JourneyVariants = [
  { viewport: "mobile390", theme: "dark", r6Journey: true },
  { viewport: "tablet820", theme: "light", r6Journey: true }
];

const fullVariants = [
  { viewport: "desktop", theme: "light" },
  { viewport: "desktop", theme: "dark" },
  { viewport: "mobileLarge", theme: "light" },
  { viewport: "mobileLarge", theme: "dark" }
];
const criticalVariants = [
  { viewport: "mobileNarrow", theme: "light" },
  { viewport: "mobileNarrow", theme: "dark" },
  { viewport: "tabletPortrait", theme: "light" },
  { viewport: "tabletPortrait", theme: "dark" },
  { viewport: "tabletLandscape", theme: "light" },
  { viewport: "tabletLandscape", theme: "dark" },
  { viewport: "desktopLarge", theme: "light" },
  { viewport: "desktopLarge", theme: "dark" },
  { viewport: "zoom200", theme: "light" }
];
const ciVariants = [
  { viewport: "desktop", theme: "light" },
  { viewport: "mobileLarge", theme: "dark" }
];
const ciCriticalVariants = [
  { viewport: "mobileNarrow", theme: "light" },
  { viewport: "tabletPortrait", theme: "light" },
  { viewport: "zoom200", theme: "light" }
];
const responsiveReferenceVariants = [
  { viewport: "smallMobile", theme: "light" },
  { viewport: "mobileNarrow", theme: "light" },
  { viewport: "mobile375", theme: "light" },
  { viewport: "mobile390", theme: "dark" },
  { viewport: "mobile412", theme: "light" },
  { viewport: "tabletPortrait", theme: "light" },
  { viewport: "tablet820", theme: "dark" },
  { viewport: "tabletLandscape1180", theme: "light" },
  { viewport: "mobile375", theme: "dark", reducedMotion: "reduce" },
  { viewport: "compactPortrait", theme: "light" },
  { viewport: "desktop1280", theme: "light" },
  { viewport: "desktop", theme: "light" }
];
const responsiveBoundaryVariants = [
  { viewport: "boundary767", theme: "light" },
  { viewport: "tabletPortrait", theme: "light" },
  { viewport: "boundary1023", theme: "light" },
  { viewport: "compactPortrait", theme: "light" },
  { viewport: "boundary1279", theme: "light" },
  { viewport: "desktop1280", theme: "light" }
];
const r7CoreVariants = [
  { viewport: "tabletPortrait", theme: "light", r6Journey: true },
  { viewport: "tablet820", theme: "dark", r6Journey: true },
  { viewport: "compactPortrait", theme: "light", r6Journey: true },
  { viewport: "tabletLandscape1180", theme: "dark", r6Journey: true },
  { viewport: "boundary1279", theme: "light", r6Journey: true }
];
const r7PriorityVariants = [
  { viewport: "tabletTall", theme: "light" },
  { viewport: "tablet800", theme: "light" },
  { viewport: "tablet834", theme: "dark" },
  { viewport: "tablet900", theme: "light" },
  { viewport: "tablet1000", theme: "dark" },
  { viewport: "tabletLandscape", theme: "light" },
  { viewport: "tabletLandscape1194", theme: "dark" },
  { viewport: "compact1200", theme: "light" }
];
const r7PriorityKeys = new Set(["dashboard", "finance", "pilotage", "timetable"]);
const r7LanguageKeys = new Set(["dashboard", "finance", "iam", "pilotage", "reference", "timetable"]);
const r7RegressionVariants = [
  { viewport: "mobileNarrow", theme: "light" },
  { viewport: "mobile390", theme: "dark" },
  { viewport: "mobile412", theme: "light" },
  { viewport: "desktop1280", theme: "light" },
  { viewport: "desktop", theme: "dark" }
];
const r7BoundaryVariants = [
  { viewport: "boundary767", theme: "light" },
  { viewport: "boundary1023", theme: "light" },
  { viewport: "boundary1280", theme: "light" }
];
const r7ZoomVariants = [
  { viewport: "zoomTabletPortrait", theme: "light" },
  { viewport: "zoomTabletLandscape", theme: "dark" },
  { viewport: "zoomTablet1180", theme: "light" }
];
const r8CoreVariants = [
  { viewport: "smallMobile", theme: "light" },
  { viewport: "desktop1280", theme: "light" },
  { viewport: "desktop", theme: "dark" }
];
const r8LanguageVariants = [
  { language: "en", viewport: "desktop1280", theme: "dark" },
  { language: "ar", viewport: "smallMobile", theme: "dark" },
  { language: "ar", viewport: "tabletLandscape1180", theme: "light" }
];
const r8ZoomKeys = new Set(["dashboard", "iam", "students", "finance", "grades", "timetable", "reference", "pilotage"]);
const r8ZoomVariants = [
  { viewport: "desktop1280", theme: "light", zoomFactor: 2 },
  { viewport: "desktop", theme: "dark", zoomFactor: 2 },
  { viewport: "tabletLandscape", theme: "light", zoomFactor: 2 }
];
const r8ReducedMotionKeys = new Set(["dashboard", "finance", "timetable"]);

const guard = createAuditGuard({
  mode,
  mockRoutes: mode === "mocked" ? mockApiV1Routes : [],
  allowlist: []
});
const workflowResults = [];

const localizedCriticalContent = {
  dashboard: {
    ar: {
      forbidden: ["Bienvenue, voici", "Recouvrement & encaissements", "Suivi opérationnel", "Lecture rapide issue", "Indicateurs clés"],
      nav: /لوحة القيادة/u,
      required: ["المهام ذات الأولوية", "تنبيهات ومتابعة"]
    },
    en: {
      forbidden: ["Bienvenue, voici", "Recouvrement & encaissements", "Suivi opérationnel", "Lecture rapide issue", "Indicateurs clés"],
      nav: /Dashboard/u,
      required: ["Priority tasks", "Alerts & follow-up"]
    }
  },
  enrollments: {
    ar: {
      forbidden: ["Inscriptions", "Liste des inscriptions"],
      nav: /التسجيلات/u,
      required: ["التسجيلات", "قائمة التسجيلات"]
    },
    en: {
      forbidden: ["Inscriptions", "Liste des inscriptions"],
      nav: /Enrollments/u,
      required: ["Enrollments", "Enrollment list"]
    }
  },
  finance: {
    ar: {
      forbidden: ["Comptabilité", "Console de recouvrement"],
      nav: /المحاسبة/u,
      required: ["لوحة التحصيل"]
    },
    en: {
      forbidden: ["Comptabilité", "Console de recouvrement"],
      nav: /Accounting/u,
      required: ["Collection console"]
    }
  },
  iam: {
    ar: {
      forbidden: ["Utilisateurs & droits", "Comptes utilisateurs", "Droits par profil", "Profils, rattachements métier et sécurité d’accès."],
      nav: /المستخدمون والصلاحيات/u,
      required: ["حسابات المستخدمين", "الصلاحيات حسب الملف", "ملفات التعريف والارتباطات المهنية وأمان الوصول."]
    },
    en: {
      forbidden: ["Utilisateurs & droits", "Comptes utilisateurs", "Droits par profil", "Profils, rattachements métier et sécurité d’accès."],
      nav: /Users & permissions/u,
      required: ["User accounts", "Permissions by profile", "Profiles, business links, and access security."]
    }
  },
  pilotage: {
    ar: {
      forbidden: ["Pilotage"],
      nav: /المتابعة/u,
      required: ["المتابعة"]
    },
    en: {
      forbidden: ["Pilotage"],
      nav: /Overview/u,
      required: ["Overview"]
    }
  },
  reference: {
    ar: {
      forbidden: ["Référentiel", "Referentiel academique", "Annees", "Niveaux", "Base temporelle de tout le logiciel"],
      nav: /المرجع/u,
      required: ["السنة الدراسية", "السنوات الدراسية", "المستويات", "المرجع الزمني للتطبيق بأكمله"]
    },
    en: {
      forbidden: ["Référentiel", "Referentiel academique", "Annees", "Niveaux", "Base temporelle de tout le logiciel"],
      nav: /Reference/u,
      required: ["School year", "School years", "Levels", "Time foundation for the entire application"]
    }
  },
  grades: {
    ar: {
      forbidden: ["Notes & bulletins", "Saisie des notes", "Bulletins"],
      nav: /الدرجات وكشوف النتائج/u,
      required: ["إدخال الدرجات"]
    },
    en: {
      forbidden: ["Notes & bulletins", "Saisie des notes", "Bulletins"],
      nav: /Grades & report cards/u,
      required: ["Grade entry"]
    }
  },
  students: {
    ar: {
      forbidden: ["Élèves", "Ajouter un élève"],
      nav: /الطلاب/u,
      required: ["الطلاب", "إضافة طالب"]
    },
    en: {
      forbidden: ["Élèves", "Ajouter un élève"],
      nav: /Students/u,
      required: ["Students", "Add student"]
    }
  },
  teachers: {
    ar: {
      forbidden: ["Enseignants", "Base enseignants"],
      nav: /المعلمون/u,
      required: ["المعلمون", "دليل المعلمين"]
    },
    en: {
      forbidden: ["Enseignants", "Base enseignants"],
      nav: /Teachers/u,
      required: ["Teachers", "Teacher directory"]
    }
  },
  parents: {
    ar: {
      forbidden: ["Parents", "Liste des responsables"],
      nav: /أولياء الأمور/u,
      required: ["قائمة الأولياء"]
    },
    en: {
      forbidden: ["Liste des responsables"],
      nav: /Parents/u,
      required: ["Guardian list"]
    }
  },
  attendance: {
    ar: {
      forbidden: ["Absences", "Journal des absences"],
      nav: /الغياب/u,
      required: ["الغياب", "سجل الغياب"]
    },
    en: {
      forbidden: ["Absences", "Journal des absences"],
      nav: /Attendance/u,
      required: ["Attendance", "Attendance log"]
    }
  },
  rooms: {
    ar: {
      forbidden: ["Salles", "Ajouter une salle"],
      nav: /القاعات/u,
      required: ["القاعات", "إضافة قاعة"]
    },
    en: {
      forbidden: ["Salles", "Ajouter une salle"],
      nav: /Rooms/u,
      required: ["Rooms", "Add room"]
    }
  },
  notifications: {
    ar: {
      forbidden: ["Notifications", "Historique notifications"],
      nav: /الإشعارات/u,
      required: ["الإشعارات", "سجل الإشعارات"]
    },
    en: {
      forbidden: ["Historique notifications"],
      nav: /Notifications/u,
      required: ["Notifications", "Notification history"]
    }
  },
  reports: {
    ar: {
      forbidden: ["Rapports & conformité", "Indicateurs executifs"],
      nav: /التقارير والامتثال/u,
      required: ["المؤشرات التنفيذية"]
    },
    en: {
      forbidden: ["Rapports & conformité", "Indicateurs executifs"],
      nav: /Reports & compliance/u,
      required: ["Executive indicators"]
    }
  },
  profile: {
    ar: {
      forbidden: ["Mon profil", "Informations personnelles", "Sécurité du compte"],
      required: ["ملفي الشخصي", "المعلومات الشخصية", "أمان الحساب"]
    },
    en: {
      forbidden: ["Mon profil", "Informations personnelles", "Sécurité du compte"],
      required: ["My profile", "Personal information", "Account security"]
    }
  },
  preferences: {
    ar: {
      forbidden: ["Préférences", "Enregistrer les préférences"],
      required: ["التفضيلات", "حفظ التفضيلات"]
    },
    en: {
      forbidden: ["Préférences", "Enregistrer les préférences"],
      required: ["Preferences", "Save preferences"]
    }
  },
  activity: {
    ar: {
      forbidden: ["Journal d’activité"],
      required: ["سجل النشاط"]
    },
    en: {
      forbidden: ["Journal d’activité"],
      required: ["Activity log"]
    }
  },
  timetable: {
    ar: {
      forbidden: ["Emploi du temps", "Grille d'emploi du temps"],
      nav: /الجدول الدراسي/u,
      required: ["الجدول الدراسي", "شبكة الجدول الدراسي"]
    },
    en: {
      forbidden: ["Emploi du temps", "Grille d'emploi du temps"],
      nav: /Timetable/u,
      required: ["Timetable", "Timetable grid"]
    }
  }
};

const contentFor = (workflow, language) =>
  language === "fr" ? undefined : localizedCriticalContent[workflow.key]?.[language];

const safeName = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");

const localeFor = (language) => (language === "ar" ? "ar-SA" : language === "en" ? "en-US" : "fr-FR");

async function createContext(browser, metadata) {
  const viewport = viewports[metadata.viewport];
  const context = await browser.newContext({
    colorScheme: metadata.theme,
    deviceScaleFactor: 1,
    hasTouch: viewport.width <= 1024,
    isMobile: viewport.width <= 480,
    locale: localeFor(metadata.language),
    reducedMotion: metadata.reducedMotion ?? "no-preference",
    timezoneId: "Europe/Paris",
    viewport
  });
  await guard.attachContext(context, metadata);
  await context.addInitScript(
    ({ keys, language, theme }) => {
      try {
        window.localStorage.setItem(keys.language, language);
        window.localStorage.setItem(keys.theme, theme);
        window.localStorage.removeItem(keys.loginHint);
        window.localStorage.removeItem(keys.session);
        window.sessionStorage.removeItem(keys.session);
      } catch {
        // The first opaque document has no storage access.
      }
    },
    { keys: storageKeys, language: metadata.language, theme: metadata.theme }
  );
  await context.addInitScript((disableDeterministicStyles) => {
    if (disableDeterministicStyles) return;
    const installDeterministicStyles = () => {
      if (document.querySelector("style[data-visual-audit='deterministic']")) return;
      const style = document.createElement("style");
      style.dataset.visualAudit = "deterministic";
      style.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}";
      (document.head || document.documentElement).appendChild(style);
    };
    if (document.documentElement) installDeterministicStyles();
    else window.addEventListener("DOMContentLoaded", installDeterministicStyles, { once: true });
  }, auditScope === "r8" && metadata.reducedMotion === "reduce");
  return context;
}

async function applyR8BrowserZoom(page, metadata) {
  if (auditScope !== "r8" || !metadata.zoomFactor || metadata.zoomFactor === 1) return;
  const baseViewport = viewports[metadata.viewport];
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: metadata.zoomFactor,
    height: Math.floor(baseViewport.height / metadata.zoomFactor),
    mobile: false,
    screenHeight: baseViewport.height,
    screenWidth: baseViewport.width,
    width: Math.floor(baseViewport.width / metadata.zoomFactor)
  });
}

async function waitForStableShell(page) {
  await page.locator(".app-shell").waitFor({ state: "visible", timeout: 20_000 });
  await page.locator(".screen-host").waitFor({ state: "visible", timeout: 20_000 });
  await page.locator(".screen-loading").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => undefined);
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function openMockPreview(page) {
  await page.goto(`${baseUrl}/#preview-admin`, { waitUntil: "domcontentloaded" });
  await waitForStableShell(page);
}

async function loginIntegrated(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".auth-canvas").waitFor({ state: "visible", timeout: 20_000 });
  await page.getByLabel(/Email ou identifiant|Identifiant/u).first().fill(integratedCredentials.username);
  await page.getByLabel(/^Mot de passe$/u).fill(integratedCredentials.password);
  await page.getByRole("button", { name: /^Connexion$/u }).click();
  await waitForStableShell(page);
}

async function openApplication(page) {
  if (mode === "mocked") await openMockPreview(page);
  else await loginIntegrated(page);
}

async function clickFirstVisible(locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return true;
    }
  }
  return false;
}

async function openModule(page, workflow, language = "fr") {
  if (workflow.key === "dashboard") {
    await page.locator(".screen-host").waitFor({ state: "visible", timeout: 15_000 });
    return;
  }
  if (workflow.userAction) {
    const previousText = await page.locator(".screen-host").innerText();
    const desktopTrigger = page.locator(".sidebar-user-card").first();
    if (await desktopTrigger.isVisible().catch(() => false)) {
      await desktopTrigger.click();
      const desktopAction = page.locator(
        `.sidebar-user-dropdown .sidebar-user-action[data-user-action-id='${workflow.key}']`
      );
      if (!(await clickFirstVisible(desktopAction))) {
        throw new Error(`Action utilisateur absente pour ${workflow.key}.`);
      }
    } else {
      const toggle = page.locator(".header-mobile-toggle").first();
      await toggle.click();
      await page.locator("#header-mobile-panel.is-open").waitFor({ state: "visible" });
      const mobileAction = page.locator(
        `#header-mobile-panel .header-mobile-link[data-user-action-id='${workflow.key}']`
      );
      if (!(await clickFirstVisible(mobileAction))) {
        throw new Error(`Action utilisateur mobile absente pour ${workflow.key}.`);
      }
    }
    await page.waitForFunction(
      (before) => {
        const host = document.querySelector(".screen-host");
        return Boolean(host && host.textContent && host.textContent !== before);
      },
      previousText,
      { timeout: 15_000 }
    );
    await page.locator(".screen-loading").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => undefined);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return;
  }
  const navigationId = workflow.navigationId || workflow.key;
  const previousText = await page.locator(".screen-host").innerText();
  const desktopItem = page.locator(
    `.app-sidebar-v2 .sidebar-link[data-navigation-id='${navigationId}']`
  );
  if (!(await clickFirstVisible(desktopItem))) {
    const toggle = page.locator(".header-mobile-toggle").first();
    if (!(await toggle.isVisible().catch(() => false))) {
      throw new Error(`Navigation absente pour ${workflow.key}.`);
    }
    await toggle.click();
    await page.locator("#header-mobile-panel.is-open").waitFor({ state: "visible" });
    const mobileItem = page.locator(
      `#header-mobile-panel .header-mobile-link[data-navigation-id='${navigationId}']`
    );
    if (!(await clickFirstVisible(mobileItem))) {
      throw new Error(`Navigation mobile absente pour ${workflow.key}.`);
    }
  }
  await page.waitForFunction(
    (before) => {
      const host = document.querySelector(".screen-host");
      return Boolean(host && host.textContent && host.textContent !== before);
    },
    previousText,
    { timeout: 15_000 }
  );
  await page.locator(".screen-loading").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => undefined);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function assertRequiredText(page, workflow, metadata) {
  const text = await page.locator(".screen-host").innerText();
  const localized = contentFor(workflow, metadata.language);
  const required = localized?.required || workflow.required;
  for (const expected of required) {
    if (!text.includes(expected)) {
      guard.addFinding({
        type: "missing-critical-content",
        message: `Contenu critique absent: ${expected}.`,
        metadata,
        route: metadata.route
      });
    }
  }
  if (localized) {
    const forbidden = localized.forbidden || [];
    for (const sourceText of forbidden) {
      if (!text.includes(sourceText)) continue;
      guard.addFinding({
        type: "untranslated-critical-content",
        message: `Texte source francais encore visible en ${metadata.language}: ${sourceText}.`,
        metadata,
        route: metadata.route
      });
    }
  }
}

async function primaryShellSelector(page) {
  const candidates = [".header-mobile-toggle", ".header-searchbar input"];
  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) return selector;
  }
  return candidates.join(", ");
}

async function restoreTopViewport(page) {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
}

async function assertResponsiveShellContract(page, metadata) {
  const snapshot = await page.evaluate(() => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const sidebar = document.querySelector(".app-sidebar-v2");
    const shell = document.querySelector(".app-shell");
    const content = document.querySelector(".app-shell-main");
    const screenHost = document.querySelector(".screen-host");
    const mobileToggle = document.querySelector(".header-mobile-toggle");
    const railNavigationTrigger = document.querySelector(".sidebar-rail-navigation-trigger");
    const touchTargets = [...document.querySelectorAll(".global-header-shell button, .app-sidebar-v2 button")]
      .filter(isVisible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          height: rect.height,
          label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 60) || "button",
          width: rect.width
        };
      });
    const sidebarRect = sidebar?.getBoundingClientRect();
    const shellRect = shell?.getBoundingClientRect();
    const contentRect = content?.getBoundingClientRect();
    const screenHostRect = screenHost?.getBoundingClientRect();
    const layoutOverflow = screenHostRect
      ? [...screenHost.querySelectorAll([
          ".workflow-navigation",
          ".workflow-body",
          ".workflow-section",
          ".students-v3-shell",
          ".enrollments-v3-shell",
          ".teachers-v3-shell",
          ".iam-v3-shell",
          ".rooms-screen-shell",
          ".parents-screen-shell",
          ".finance-v3-shell",
          ".finance-screen-shell",
          ".school-life-root"
        ].join(", "))]
          .filter(isVisible)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return Math.max(0, screenHostRect.left - rect.left, rect.right - screenHostRect.right);
          })
          .reduce((maximum, overflow) => Math.max(maximum, overflow), 0)
      : 0;
    return {
      contentRight: contentRect?.right ?? 0,
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      mobileToggleVisible: isVisible(mobileToggle),
      railNavigationTriggerVisible: isVisible(railNavigationTrigger),
      layoutOverflow,
      shellLeft: shellRect?.left ?? 0,
      shellRight: shellRect?.right ?? 0,
      sidebarVisible: isVisible(sidebar),
      sidebarWidth: sidebarRect?.width ?? 0,
      touchTargets,
      viewportWidth: window.innerWidth
    };
  });

  const problems = [];
  const near = (actual, expected, tolerance = 2) => Math.abs(actual - expected) <= tolerance;
  if (snapshot.documentOverflow > 1) problems.push(`overflow document ${snapshot.documentOverflow}px`);
  if (snapshot.layoutOverflow > 1) problems.push(`overflow structurel ${snapshot.layoutOverflow}px`);
  if (snapshot.shellLeft < -1 || snapshot.shellRight > snapshot.viewportWidth + 1) {
    problems.push(`shell hors viewport (${snapshot.shellLeft.toFixed(1)}..${snapshot.shellRight.toFixed(1)})`);
  }
  if (snapshot.contentRight > snapshot.viewportWidth + 1) {
    problems.push(`contenu hors viewport (${snapshot.contentRight.toFixed(1)}px)`);
  }

  if (snapshot.viewportWidth < 768) {
    if (snapshot.sidebarVisible) problems.push("sidebar desktop visible sous 768px");
    if (!snapshot.mobileToggleVisible) problems.push("navigation mobile absente sous 768px");
  } else if (snapshot.viewportWidth < 1024) {
    if (!snapshot.sidebarVisible || !near(snapshot.sidebarWidth, 76)) {
      problems.push(`rail tablette invalide (${snapshot.sidebarWidth.toFixed(1)}px)`);
    }
    if (snapshot.mobileToggleVisible) problems.push("drawer mobile visible en mode rail");
    if (!snapshot.railNavigationTriggerVisible) problems.push("ouverture navigation complète absente du rail tablette");
  } else if (snapshot.viewportWidth < 1280) {
    if (!snapshot.sidebarVisible || !near(snapshot.sidebarWidth, 224)) {
      problems.push(`sidebar compacte invalide (${snapshot.sidebarWidth.toFixed(1)}px)`);
    }
    if (snapshot.mobileToggleVisible) problems.push("drawer mobile visible en desktop compact");
  } else if (!snapshot.sidebarVisible || !near(snapshot.sidebarWidth, 256)) {
    problems.push(`sidebar desktop modifiée (${snapshot.sidebarWidth.toFixed(1)}px)`);
  }

  if (snapshot.viewportWidth < 1024) {
    const undersized = snapshot.touchTargets.filter((target) => target.width < 43.5 || target.height < 43.5);
    if (undersized.length > 0) {
      problems.push(`cibles tactiles sous 44px: ${undersized.map((target) => target.label).join(" | ")}`);
    }
  }

  for (const problem of problems) {
    guard.addFinding({
      type: "responsive-shell-contract",
      message: problem,
      metadata,
      route: metadata.route
    });
  }
}

async function assertR7TabletContract(page, metadata) {
  if (auditScope !== "r7") return;
  const snapshot = await page.evaluate(() => {
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const screenHost = document.querySelector(".screen-host");
    const hostRect = screenHost?.getBoundingClientRect();
    const clippedSidebarLabels = [...document.querySelectorAll(".app-sidebar-v2 .sidebar-link-copy > span")]
      .filter(visible)
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => element.textContent?.trim() || "label");
    const tableProblems = [...document.querySelectorAll(".responsive-data-table-shell")]
      .filter(visible)
      .flatMap((shell) => {
        const wrapper = shell.querySelector(".table-wrap");
        const shellRect = shell.getBoundingClientRect();
        if (!(wrapper instanceof HTMLElement)) return ["conteneur de table absent"];
        const overflowX = getComputedStyle(wrapper).overflowX;
        const locallyScrollable = wrapper.scrollWidth > wrapper.clientWidth + 1;
        const problems = [];
        if (hostRect && (shellRect.left < hostRect.left - 1 || shellRect.right > hostRect.right + 1)) {
          problems.push(`table hors écran ${shellRect.left.toFixed(1)}..${shellRect.right.toFixed(1)}`);
        }
        if (locallyScrollable && !["auto", "scroll"].includes(overflowX)) {
          problems.push(`scroll local non contenu (${overflowX})`);
        }
        return problems;
      });
    const workflowNavigationProblems = [...document.querySelectorAll(".workflow-navigation")]
      .filter(visible)
      .flatMap((navigation) => {
        const style = getComputedStyle(navigation);
        const active = navigation.querySelector("[aria-current='step'], [aria-selected='true'], .is-active");
        const problems = [];
        if (navigation.scrollWidth > navigation.clientWidth + 1 && !["auto", "scroll"].includes(style.overflowX)) {
          problems.push(`navigation locale non scrollable (${style.overflowX})`);
        }
        if (active instanceof HTMLElement) {
          const navRect = navigation.getBoundingClientRect();
          const activeRect = active.getBoundingClientRect();
          if (activeRect.right < navRect.left || activeRect.left > navRect.right) problems.push("onglet actif hors champ");
        }
        return problems;
      });
    return {
      clippedSidebarLabels,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      tableProblems,
      workflowNavigationProblems
    };
  });

  const problems = [
    ...snapshot.tableProblems,
    ...snapshot.workflowNavigationProblems,
    ...snapshot.clippedSidebarLabels.map((label) => `libellé sidebar tronqué: ${label}`)
  ];
  if (snapshot.documentScrollWidth > snapshot.documentClientWidth + 1) {
    problems.push(`overflow document ${snapshot.documentScrollWidth - snapshot.documentClientWidth}px`);
  }
  for (const problem of problems) {
    guard.addFinding({
      type: "r7-tablet-contract",
      message: problem,
      metadata,
      route: metadata.route
    });
  }
}

async function assertR8AccessibilityContract(page, metadata) {
  if (auditScope !== "r8") return;
  const snapshot = await page.evaluate(({ expectedZoom, language, reducedMotion }) => {
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.closest("[aria-hidden='true']")) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const accessibleName = (element) => {
      const ariaLabel = element.getAttribute("aria-label")?.trim();
      if (ariaLabel) return ariaLabel;
      const labelledBy = element.getAttribute("aria-labelledby")
        ?.split(/\s+/u)
        .map((id) => document.getElementById(id)?.textContent?.trim() || "")
        .filter(Boolean)
        .join(" ");
      if (labelledBy) return labelledBy;
      if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
        const labelText = [...element.labels].map((label) => label.textContent?.trim() || "").filter(Boolean).join(" ");
        if (labelText) return labelText;
      }
      if (element instanceof HTMLImageElement && element.hasAttribute("alt")) return element.alt;
      return element.textContent?.trim() || element.getAttribute("title")?.trim() || "";
    };
    const describe = (element) =>
      `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.className && typeof element.className === "string" ? `.${element.className.trim().replace(/\s+/gu, ".")}` : ""}`.slice(0, 180);
    const interactive = [...document.querySelectorAll(
      "button, a[href], input:not([type='hidden']), select, textarea, [role='tab'], [role='menuitem']"
    )].filter(visible);
    const unnamedInteractive = interactive.filter((element) => !accessibleName(element)).map(describe);
    const unlabeledFields = [...document.querySelectorAll(".screen-host input:not([type='hidden']), .screen-host select, .screen-host textarea")]
      .filter(visible)
      .filter((element) => !accessibleName(element))
      .map(describe);
    const imagesWithoutAlt = [...document.querySelectorAll("img")]
      .filter(visible)
      .filter((image) => !image.hasAttribute("alt") && image.getAttribute("aria-hidden") !== "true")
      .map(describe);
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id).filter(Boolean);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    const unnamedDialogs = [...document.querySelectorAll("[role='dialog'], [role='alertdialog']")]
      .filter(visible)
      .filter((dialog) => !accessibleName(dialog))
      .map(describe);
    const tableProblems = [...document.querySelectorAll(".screen-host table")]
      .filter(visible)
      .flatMap((table, index) => {
        const cells = table.querySelectorAll("tbody td").length;
        const headers = table.querySelectorAll("thead th").length;
        return cells > 0 && headers === 0 ? [`table-${index + 1}: cellules sans en-têtes`] : [];
      });
    const tabProblems = [...document.querySelectorAll(".workflow-tabs[role='tablist']")]
      .filter(visible)
      .flatMap((tablist, index) => {
        const tabs = [...tablist.querySelectorAll("[role='tab']")].filter(visible);
        const tabStops = tabs.filter((tab) => tab.getAttribute("tabindex") === "0");
        const selected = tabs.find((tab) => tab.getAttribute("aria-selected") === "true");
        const problems = [];
        if (tabStops.length !== 1) problems.push(`tabs-${index + 1}: ${tabStops.length} tab stops`);
        if (selected && selected.getAttribute("tabindex") !== "0") problems.push(`tabs-${index + 1}: onglet actif hors tab stop`);
        return problems;
      });
    const touchTargetProblems = window.innerWidth < 1280
      ? [...document.querySelectorAll(
          ".header-icon-button, .header-mobile-toggle, .sidebar-rail-navigation-trigger, .workflow-tab, .responsive-pagination button, .v3-more-button, .responsive-form-close, .confirm-dialog button"
        )]
          .filter(visible)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return { height: rect.height, label: accessibleName(element) || describe(element), width: rect.width };
          })
          .filter((target) => target.width < 43.5 || target.height < 43.5)
      : [];
    const parseDurations = (value) => value.split(",").map((part) => {
      const normalized = part.trim();
      return normalized.endsWith("ms") ? Number.parseFloat(normalized) : Number.parseFloat(normalized) * 1000;
    });
    const motionProblems = reducedMotion === "reduce"
      ? [...document.querySelectorAll(
          ".workflow-step-active, .responsive-chart-card, .responsive-kpi-card, .header-mobile-panel, .responsive-form-surface, .confirm-dialog"
        )]
          .filter(visible)
          .filter((element) => {
            const style = getComputedStyle(element);
            return Math.max(...parseDurations(style.animationDuration), ...parseDurations(style.transitionDuration)) > 20;
          })
          .map(describe)
      : [];
    return {
      direction: getComputedStyle(document.querySelector(".screen-host") || document.body).direction,
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      duplicateIds,
      imagesWithoutAlt,
      innerWidth: window.innerWidth,
      motionProblems,
      pixelRatio: window.devicePixelRatio,
      tableProblems,
      tabProblems,
      touchTargetProblems,
      unnamedDialogs,
      unnamedInteractive,
      unlabeledFields,
      zoomExpected: expectedZoom,
      language
    };
  }, { expectedZoom: metadata.zoomFactor || 1, language: metadata.language, reducedMotion: metadata.reducedMotion });

  const problems = [];
  if (snapshot.documentOverflow > 1) problems.push(`overflow document ${snapshot.documentOverflow}px`);
  if (snapshot.unnamedInteractive.length) problems.push(`contrôles sans nom: ${snapshot.unnamedInteractive.join(" | ")}`);
  if (snapshot.unlabeledFields.length) problems.push(`champs sans label: ${snapshot.unlabeledFields.join(" | ")}`);
  if (snapshot.imagesWithoutAlt.length) problems.push(`images sans alt: ${snapshot.imagesWithoutAlt.join(" | ")}`);
  if (snapshot.duplicateIds.length) problems.push(`ids dupliqués: ${snapshot.duplicateIds.join(" | ")}`);
  if (snapshot.unnamedDialogs.length) problems.push(`dialogues sans nom: ${snapshot.unnamedDialogs.join(" | ")}`);
  problems.push(...snapshot.tableProblems, ...snapshot.tabProblems);
  if (snapshot.touchTargetProblems.length) {
    problems.push(`cibles tactiles sous 44px: ${snapshot.touchTargetProblems.map((target) => `${target.label} (${target.width.toFixed(1)}x${target.height.toFixed(1)})`).join(" | ")}`);
  }
  if (snapshot.motionProblems.length) problems.push(`mouvements non réduits: ${snapshot.motionProblems.join(" | ")}`);
  if (metadata.language === "ar" && snapshot.direction !== "rtl") problems.push(`direction RTL incorrecte (${snapshot.direction})`);
  if (metadata.zoomFactor > 1 && Math.abs(snapshot.pixelRatio - metadata.zoomFactor) > 0.1) {
    problems.push(`facteur de zoom CDP incorrect (${snapshot.pixelRatio})`);
  }
  for (const problem of problems) {
    guard.addFinding({ type: "r8-accessibility-contract", message: problem, metadata, route: metadata.route });
  }
}

async function assertNavigationDrawerContract(page, metadata) {
  const viewportWidth = page.viewportSize()?.width ?? 0;
  if (viewportWidth >= 1024) return;

  const trigger = viewportWidth < 768
    ? page.locator(".header-mobile-toggle").first()
    : page.locator(".sidebar-rail-navigation-trigger").first();
  if (!(await trigger.isVisible().catch(() => false))) {
    guard.addFinding({
      type: "navigation-drawer-contract",
      message: "Déclencheur du drawer introuvable.",
      metadata,
      route: metadata.route
    });
    return;
  }

  await trigger.focus();
  await trigger.click();
  const drawer = page.locator("#header-mobile-panel.is-open");
  await drawer.waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const panel = document.querySelector("#header-mobile-panel");
    return Boolean(panel?.contains(document.activeElement));
  });
  const openState = await page.evaluate(() => ({
    activeInside: Boolean(document.querySelector("#header-mobile-panel")?.contains(document.activeElement)),
    ariaModal: document.querySelector("#header-mobile-panel")?.getAttribute("aria-modal"),
    drawerOverflow: (() => {
      const panel = document.querySelector("#header-mobile-panel");
      return panel ? Math.max(0, panel.scrollWidth - panel.clientWidth) : -1;
    })(),
    undersizedTargets: [...document.querySelectorAll("#header-mobile-panel button")]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { height: rect.height, label: element.getAttribute("aria-label") || element.textContent?.trim(), width: rect.width };
      })
      .filter((target) => target.width < 43.5 || target.height < 43.5),
    scrollLocked: document.documentElement.classList.contains("mobile-shell-open")
  }));
  if (
    !openState.activeInside ||
    openState.ariaModal !== "true" ||
    openState.drawerOverflow > 1 ||
    openState.undersizedTargets.length > 0 ||
    !openState.scrollLocked
  ) {
    guard.addFinding({
      type: "navigation-drawer-contract",
      message: `Drawer incomplet: focus=${openState.activeInside}, modal=${openState.ariaModal}, overflow=${openState.drawerOverflow}, petites-cibles=${openState.undersizedTargets.length}, scroll=${openState.scrollLocked}.`,
      metadata,
      route: metadata.route
    });
  }

  const drawerScreenshot = path.join(
    outputDir,
    `${safeName(`${metadata.workflow}-${metadata.viewport}-${metadata.theme}-${metadata.language}-navigation-drawer`)}.png`
  );
  await page.screenshot({ path: drawerScreenshot, fullPage: false });

  await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "hidden" });
  const closeState = await page.evaluate(() => ({
    focusRestored: document.activeElement?.matches(".header-mobile-toggle, .sidebar-rail-navigation-trigger") ?? false,
    scrollLocked: document.documentElement.classList.contains("mobile-shell-open")
  }));
  if (!closeState.focusRestored || closeState.scrollLocked) {
    guard.addFinding({
      type: "navigation-drawer-contract",
      message: `Fermeture drawer incorrecte: focus=${closeState.focusRestored}, scroll=${closeState.scrollLocked}.`,
      metadata,
      route: metadata.route
    });
  }
  return drawerScreenshot;
}

async function assertResponsiveFormContract(page, metadata) {
  const viewportWidth = page.viewportSize()?.width ?? 0;
  if (!responsiveFormWorkflowKeys.has(metadata.workflow)) return null;

  if (viewportWidth >= 1024) {
    const inlineForm = page.locator("form.responsive-form-surface:visible").first();
    if (!(await inlineForm.isVisible().catch(() => false))) return null;
    const inlineState = await inlineForm.evaluate((form) => ({
      ariaModal: form.getAttribute("aria-modal"),
      role: form.getAttribute("role"),
      triggerVisible: [...document.querySelectorAll(".responsive-form-trigger")].some((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
    }));
    if (inlineState.ariaModal || inlineState.role || inlineState.triggerVisible) {
      guard.addFinding({
        type: "responsive-form-contract",
        message: `Formulaire desktop altere: modal=${inlineState.ariaModal}, role=${inlineState.role}, trigger=${inlineState.triggerVisible}.`,
        metadata,
        route: metadata.route
      });
    }
    return null;
  }

  let dialog = page.locator("form.responsive-form-surface[role='dialog']:visible").first();
  let trigger = page.locator(".responsive-form-trigger:visible").first();
  if (!(await dialog.isVisible().catch(() => false)) && !(await trigger.isVisible().catch(() => false))) {
    const openerSelector = responsiveFormOpeners[metadata.workflow];
    if (openerSelector) {
      const opener = page.locator(openerSelector).first();
      if (await opener.isVisible().catch(() => false)) {
        await opener.click();
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        dialog = page.locator("form.responsive-form-surface[role='dialog']:visible").first();
        trigger = page.locator(".responsive-form-trigger:visible").first();
      }
    }
  }

  if (!(await dialog.isVisible().catch(() => false))) {
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.focus();
      await trigger.click();
      dialog = page.locator("form.responsive-form-surface[role='dialog']:visible").first();
      await dialog.waitFor({ state: "visible" });
    } else {
      guard.addFinding({
        type: "responsive-form-contract",
        message: "Aucun formulaire responsive ouvrable dans ce module.",
        metadata,
        route: metadata.route
      });
      return null;
    }
  }

  const state = await dialog.evaluate((form) => {
    const isVisible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const controls = [...form.querySelectorAll("button, input, select, textarea")]
      .filter(isVisible)
      .filter((element) => !(element instanceof HTMLInputElement && ["checkbox", "radio", "hidden"].includes(element.type)))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
          height: rect.height,
          label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 50) || element.tagName,
          tag: element.tagName,
          width: rect.width
        };
      });
    const actions = form.querySelector(":scope > .actions, :scope > .premium-edit-actions, :scope > .profile-form-actions, :scope > .form-grid > .actions");
    const rect = form.getBoundingClientRect();
    return {
      activeInside: form.contains(document.activeElement),
      ariaLabelledBy: form.getAttribute("aria-labelledby"),
      ariaModal: form.getAttribute("aria-modal"),
      controls,
      direction: getComputedStyle(form).direction,
      formOverflow: Math.max(0, form.scrollWidth - form.clientWidth),
      left: rect.left,
      right: rect.right,
      scrollLocked: document.documentElement.classList.contains("responsive-form-overlay-open"),
      stickyActions: actions ? getComputedStyle(actions).position === "sticky" : null,
      viewportWidth: window.innerWidth,
      width: rect.width
    };
  });

  const problems = [];
  if (!state.activeInside) problems.push("focus initial hors formulaire");
  if (!state.ariaLabelledBy || state.ariaModal !== "true") problems.push("semantique de dialogue incomplete");
  if (!state.scrollLocked) problems.push("scroll arriere-plan non verrouille");
  if (state.formOverflow > 1) problems.push(`overflow formulaire ${state.formOverflow}px`);
  if (state.left < -1 || state.right > state.viewportWidth + 1) problems.push(`formulaire hors viewport ${state.left}..${state.right}`);
  if (viewportWidth < 768 && Math.abs(state.width - state.viewportWidth) > 2) {
    problems.push(`drawer mobile non plein ecran (${state.width.toFixed(1)}/${state.viewportWidth})`);
  }
  if (viewportWidth >= 768 && (state.width < 420 || state.width > Math.min(674, state.viewportWidth + 2))) {
    problems.push(`largeur drawer tablette incorrecte (${state.width.toFixed(1)}px)`);
  }
  const undersized = state.controls.filter((control) => control.height < 43.5 || (control.tag === "BUTTON" && control.width < 43.5));
  if (undersized.length > 0) problems.push(`cibles sous 44px: ${undersized.map((item) => item.label).join(" | ")}`);
  const smallInputs = state.controls.filter((control) => control.tag !== "BUTTON" && control.fontSize < 16);
  if (smallInputs.length > 0) problems.push(`police de controle sous 16px: ${smallInputs.map((item) => item.label).join(" | ")}`);
  if (state.stickyActions === false) problems.push("zone d'actions non sticky");
  if (metadata.language === "ar" && state.direction !== "rtl") problems.push(`direction formulaire incorrecte (${state.direction})`);

  for (const problem of problems) {
    guard.addFinding({
      type: "responsive-form-contract",
      message: problem,
      metadata,
      route: metadata.route
    });
  }

  const formScreenshot = path.join(
    outputDir,
    `${safeName(`${metadata.workflow}-${metadata.viewport}-${metadata.theme}-${metadata.language}-responsive-form`)}.png`
  );
  await page.screenshot({ path: formScreenshot, fullPage: false });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const closeState = await page.evaluate(() => ({
    focusRestored: document.activeElement?.matches(".responsive-form-trigger") ?? false,
    scrollLocked: document.documentElement.classList.contains("responsive-form-overlay-open")
  }));
  if (!closeState.focusRestored || closeState.scrollLocked) {
    guard.addFinding({
      type: "responsive-form-contract",
      message: `Fermeture formulaire incorrecte: focus=${closeState.focusRestored}, scroll=${closeState.scrollLocked}.`,
      metadata,
      route: metadata.route
    });
  }
  return formScreenshot;
}

async function assertFocusVisible(page, metadata) {
  const hasActiveElement = await page.evaluate(
    () => document.activeElement instanceof HTMLElement && document.activeElement !== document.body
  );
  if (!hasActiveElement) await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body) return { visible: false, label: "body" };
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      visible:
        rect.width > 0 &&
        rect.height > 0 &&
        (style.outlineStyle !== "none" || style.boxShadow !== "none" || style.borderColor !== "transparent"),
      label: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 80) || element.tagName
    };
  });
  if (!focus.visible) {
    guard.addFinding({
      type: "focus-not-visible",
      message: `Le premier element tabulable n'a pas de focus visible (${focus.label}).`,
      metadata,
      route: metadata.route
    });
  }
}

async function selectWorkflowStep(page, stepId, label) {
  const compactSelect = page.locator(".workflow-step-select select:visible").first();
  if (await compactSelect.isVisible().catch(() => false)) {
    await compactSelect.selectOption(stepId);
  } else {
    const tab = page.getByRole("tab", { name: label, exact: true }).first();
    await tab.waitFor({ state: "visible" });
    await tab.click();
  }
  await page.locator(`[data-step-id='${stepId}'][data-active-step='true']`).first().waitFor({ state: "visible" });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        let stableFrames = 0;
        let previousPosition = window.scrollY;
        const checkPosition = () => {
          const currentPosition = window.scrollY;
          stableFrames = Math.abs(currentPosition - previousPosition) < 0.5 ? stableFrames + 1 : 0;
          previousPosition = currentPosition;
          if (stableFrames >= 3) {
            resolve(undefined);
            return;
          }
          requestAnimationFrame(checkPosition);
        };
        requestAnimationFrame(checkPosition);
      })
  );
}

async function clickFirstRowAction(page, scopeSelector, actionLabel) {
  const trigger = page.locator(scopeSelector).locator("button[aria-haspopup='menu']:visible").first();
  await trigger.waitFor({ state: "visible" });
  await trigger.click();
  const action = page.getByRole("menuitem", { name: actionLabel, exact: true }).first();
  await action.waitFor({ state: "visible" });
  await action.click();
}

async function assertR6BusinessJourney(page, workflow, metadata) {
  if (!metadata.r6Journey) return;

  if (workflow.key === "iam") {
    await page.locator("#iam-accounts[data-active-step='true']").waitFor({ state: "visible" });
    await clickFirstRowAction(page, "#iam-accounts[data-active-step='true']", "Modifier");
    await page.locator("#iam-account-form[data-active-step='true']").waitFor({ state: "visible" });
    await selectWorkflowStep(page, "accounts", "Comptes utilisateurs");
    return;
  }

  if (workflow.key === "students") {
    await page.locator(".students-v3-table-card").waitFor({ state: "visible" });
    await clickFirstRowAction(page, ".students-v3-table-card", "Voir");
    await page.locator(".students-detail-panel").waitFor({ state: "visible" });
    await clickFirstRowAction(page, ".students-v3-table-card", "Modifier");
    await page.getByRole("heading", { name: "Modifier le dossier" }).first().waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Voir la base élèves", exact: true }).click();
    await page.locator(".students-v3-table-card").waitFor({ state: "visible" });
    return;
  }

  if (workflow.key === "enrollments") {
    await page.getByRole("button", { name: "Nouvelle inscription", exact: true }).click();
    await page.getByRole("heading", { name: "Que souhaitez-vous faire ?", exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: /Inscrire un nouvel élève/u }).click();
    await page.getByRole("heading", { name: "Identité de l'élève", exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Liste des inscriptions", exact: true }).click();
    await page.locator("#enrollments-list[data-active-step='true']").waitFor({ state: "visible" });
    return;
  }

  if (workflow.key === "finance") {
    await selectWorkflowStep(page, "invoices", "Factures");
    await clickFirstRowAction(page, "[data-step-id='invoices'][data-active-step='true']", "Enregistrer paiement");
    await page.locator("[data-step-id='payments'][data-active-step='true']").first().waitFor({ state: "visible" });
    await page.locator(".workflow-context-bar").waitFor({ state: "visible" });
    await selectWorkflowStep(page, "overview", "Pilotage");
    return;
  }

  if (workflow.key === "grades") {
    await selectWorkflowStep(page, "entry", "Saisie des notes");
    await page.locator(".workflow-context-bar").waitFor({ state: "visible" });
    await selectWorkflowStep(page, "filters", "Vue d’ensemble");
    return;
  }

  if (workflow.key === "attendance") {
    await selectWorkflowStep(page, "journal", "Journal des absences");
    await selectWorkflowStep(page, "validation", "Justificatifs & validation");
    await page.locator(".workflow-context-bar").waitFor({ state: "visible" });
    await selectWorkflowStep(page, "absences", "Absences");
    return;
  }

  if (workflow.key === "timetable") {
    await selectWorkflowStep(page, "grid", "Grille d'emploi du temps");
    if ((page.viewportSize()?.width ?? 0) < 768) {
      await page.locator(".timetable-list-view.is-active").waitFor({ state: "visible" });
      await page.getByRole("button", { name: "Vue semaine", exact: true }).click();
      await page.locator(".timetable-week-view.is-active").waitFor({ state: "visible" });
      await page.getByRole("button", { name: "Vue liste", exact: true }).click();
    } else {
      await page.locator(".timetable-list-view").waitFor({ state: "visible" });
      await page.locator(".timetable-week-view").waitFor({ state: "visible" });
    }
    await selectWorkflowStep(page, "timetable", "Emploi du temps");
    return;
  }

  if (workflow.key === "pilotage") {
    const section = page.locator(".workflow-disclosure").filter({ has: page.getByRole("heading", { name: "Vie scolaire" }) });
    const toggle = section.getByRole("button", { name: "Afficher", exact: true });
    if (await toggle.isVisible().catch(() => false)) await toggle.click();
    await section.getByRole("button", { name: "Ouvrir absences", exact: true }).waitFor({ state: "visible" });
  }
}

async function restoreR6JourneyLanding(page, workflow) {
  if (workflow.key === "iam") {
    await selectWorkflowStep(page, "accounts", "Comptes utilisateurs");
  } else if (workflow.key === "students") {
    const back = page.getByRole("button", { name: /Base élèves|Voir la base élèves/u }).first();
    if (await back.isVisible().catch(() => false)) await back.click();
  } else if (workflow.key === "enrollments") {
    const dialog = page.locator("form.responsive-form-surface[role='dialog']:visible").first();
    if (await dialog.isVisible().catch(() => false)) await page.keyboard.press("Escape");
    const back = page.getByRole("button", { name: "Liste des inscriptions", exact: true });
    if (await back.isVisible().catch(() => false)) await back.click();
  } else if (workflow.key === "finance") {
    await selectWorkflowStep(page, "overview", "Pilotage");
  } else if (workflow.key === "grades") {
    await selectWorkflowStep(page, "filters", "Vue d’ensemble");
  } else if (workflow.key === "attendance") {
    await selectWorkflowStep(page, "absences", "Absences");
  } else if (workflow.key === "timetable") {
    await selectWorkflowStep(page, "timetable", "Emploi du temps");
  } else if (workflow.key === "pilotage") {
    const section = page.locator(".workflow-disclosure").filter({ has: page.getByRole("heading", { name: "Vie scolaire" }) });
    const toggle = section.getByRole("button", { name: "Réduire", exact: true });
    if (await toggle.isVisible().catch(() => false)) await toggle.click();
  }
}

async function executeModuleWorkflow(browser, workflow, variant, language = "fr") {
  const metadata = {
    workflow: workflow.key,
    route: `/app/${workflow.key}`,
    viewport: variant.viewport,
    theme: variant.theme,
    language,
    r6Journey: variant.r6Journey ?? false,
    reducedMotion: variant.reducedMotion ?? "no-preference",
    zoomFactor: variant.zoomFactor ?? 1
  };
  const before = guard.blockingFindings().length;
  const context = await createContext(browser, metadata);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  let screenshot;
  let drawerScreenshot;
  let formScreenshot;
  try {
    await applyR8BrowserZoom(page, metadata);
    await openApplication(page);
    guard.setMetadata(page, metadata);
    await openModule(page, workflow, language);
    await assertRequiredText(page, workflow, metadata);
    await assertResponsiveShellContract(page, metadata);
    await assertR7TabletContract(page, metadata);
    await assertR8AccessibilityContract(page, metadata);
    await assertR6BusinessJourney(page, workflow, metadata);
    if (workflow.key === "dashboard") drawerScreenshot = await assertNavigationDrawerContract(page, metadata);
    formScreenshot = await assertResponsiveFormContract(page, metadata);
    if (metadata.r6Journey) await restoreR6JourneyLanding(page, workflow);
    if (criticalKeys.has(workflow.key)) await assertFocusVisible(page, metadata);
    if (language === "ar") {
      const direction = await page.locator("main.page").getAttribute("dir");
      if (direction !== "rtl") {
        guard.addFinding({ type: "rtl-missing", message: `Direction arabe incorrecte: ${direction}.`, metadata, route: metadata.route });
      }
    }
    const screenshotKey = `${workflow.key}-${variant.viewport}-${variant.theme}-${language}${metadata.r6Journey ? "-r6-journey" : ""}${metadata.zoomFactor > 1 ? `-zoom-${metadata.zoomFactor}` : ""}`;
    screenshot = path.join(outputDir, `${safeName(screenshotKey)}.png`);
    await guard.capture(page, screenshot, { fullPage: variant.viewport !== "desktop" });
    await restoreTopViewport(page);
    await guard.assertPageReady(page, {
      criticalSelectors: [".app-shell", ".screen-host"],
      primarySelectors: [await primaryShellSelector(page)]
    });
  } catch (error) {
    guard.addFinding({
      type: "workflow-error",
      message: error instanceof Error ? error.message : String(error),
      metadata,
      route: metadata.route,
      screenshot
    });
  } finally {
    const failed = guard.blockingFindings().length > before;
    const tracePath = path.join(outputDir, `${safeName(`${workflow.key}-${variant.viewport}-${variant.theme}-${language}`)}-trace.zip`);
    await context.tracing.stop(failed ? { path: tracePath } : undefined);
    workflowResults.push({
      ...metadata,
      drawerScreenshot,
      formScreenshot,
      screenshot,
      status: failed ? "failed" : "passed",
      trace: failed ? tracePath : null
    });
    await context.close();
  }
}

async function runMockedAuthWorkflow(browser, kind, language, theme, viewportName) {
  const metadata = {
    workflow: `auth-${kind}`,
    route: kind === "login" ? "/" : kind === "activation-first-login" ? "/activate" : `/auth/${kind}`,
    viewport: viewportName,
    theme,
    language
  };
  const before = guard.blockingFindings().length;
  const context = await createContext(browser, metadata);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  let screenshot;
  try {
    const entryUrl = kind === "activation-first-login"
      ? `${baseUrl}/activate?token=visual-activation-token`
      : baseUrl;
    await page.goto(entryUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".auth-canvas").waitFor({ state: "visible", timeout: 20_000 });
    if (kind === "login") {
      await page.locator('input[autocomplete="username"]').fill("visual.admin");
      await page.locator('input[autocomplete="current-password"]').fill("Visual-Test-2026!");
      await page.locator(".auth-canvas__submit").click();
      await waitForStableShell(page);
    } else if (kind === "forgot-password") {
      await page.getByRole("button", { name: /Mot de passe oublié/u }).click();
      await page.getByLabel(/^Identifiant$/u).fill("visual.admin");
      await page.getByRole("button", { name: /Envoyer les instructions/u }).click();
      await page
        .getByText("Si un compte correspond à ces informations, un email de réinitialisation a été envoyé.")
        .waitFor({ state: "visible" });
    } else if (kind === "activation-resend") {
      await page.getByRole("button", { name: /Activer mon compte/u }).click();
      await page.getByLabel(/Email ou identifiant/u).fill("visual.admin");
      await page.getByRole("button", { name: /Renvoyer le lien d.activation/u }).click();
      await page
        .getByText("Si un compte en attente correspond à ces informations, un email d'activation a été envoyé.")
        .waitFor({ state: "visible" });
    } else if (kind === "activation-first-login") {
      const passwordInputs = page.locator('input[autocomplete="new-password"]');
      await passwordInputs.nth(0).fill("Visual-Activation-2026!");
      await passwordInputs.nth(1).fill("Visual-Activation-2026!");
      await page.locator(".auth-canvas__submit").click();
      await page.locator('input[autocomplete="username"]').waitFor({ state: "visible" });
    } else {
      throw new Error(`Workflow d'authentification inconnu: ${kind}.`);
    }
    screenshot = path.join(outputDir, `${safeName(`${metadata.workflow}-${viewportName}-${theme}-${language}`)}.png`);
    await guard.capture(page, screenshot, { fullPage: viewportName.startsWith("mobile") });
    await restoreTopViewport(page);
    await guard.assertPageReady(page, {
      criticalSelectors: [kind === "login" ? ".app-shell" : ".auth-canvas"],
      primarySelectors: [kind === "login" ? await primaryShellSelector(page) : ".auth-canvas button"]
    });
    if (language === "ar") {
      const direction = await page.locator("main.page").getAttribute("dir");
      if (direction !== "rtl") {
        guard.addFinding({ type: "rtl-missing", message: `Direction arabe incorrecte: ${direction}.`, metadata, route: metadata.route });
      }
    }
  } catch (error) {
    guard.addFinding({
      type: "workflow-error",
      message: error instanceof Error ? error.message : String(error),
      metadata,
      route: metadata.route,
      screenshot
    });
  } finally {
    const failed = guard.blockingFindings().length > before;
    const tracePath = path.join(outputDir, `${safeName(`${metadata.workflow}-${viewportName}-${theme}-${language}`)}-trace.zip`);
    await context.tracing.stop(failed ? { path: tracePath } : undefined);
    workflowResults.push({ ...metadata, screenshot, status: failed ? "failed" : "passed", trace: failed ? tracePath : null });
    await context.close();
  }
}

async function runIntegratedSuite(browser) {
  const metadata = { workflow: "integrated-login", route: "/", viewport: "desktop", theme: "light", language: "fr" };
  const before = guard.blockingFindings().length;
  const context = await createContext(browser, metadata);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  try {
    await loginIntegrated(page);
    for (const workflow of allWorkflows) {
      const workflowMetadata = { ...metadata, workflow: workflow.key, route: `/app/${workflow.key}` };
      guard.setMetadata(page, workflowMetadata);
      await openModule(page, workflow, "fr");
      await assertRequiredText(page, workflow, workflowMetadata);
      const screenshot = path.join(outputDir, `${safeName(`integrated-${workflow.key}-desktop-light-fr`)}.png`);
      await guard.capture(page, screenshot);
      await restoreTopViewport(page);
      await guard.assertPageReady(page, { criticalSelectors: [".app-shell", ".screen-host"], primarySelectors: [await primaryShellSelector(page)] });
      workflowResults.push({ ...workflowMetadata, screenshot, status: "checked", trace: null });
    }
  } catch (error) {
    guard.addFinding({
      type: "workflow-error",
      message: error instanceof Error ? error.message : String(error),
      metadata,
      route: metadata.route
    });
  } finally {
    const failed = guard.blockingFindings().length > before;
    const tracePath = path.join(outputDir, "integrated-suite-trace.zip");
    await context.tracing.stop(failed ? { path: tracePath } : undefined);
    await context.close();
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch(
    resolveChromiumLaunchOptions({
      mode,
      baseUrl,
      runtimeEnvironment: String(process.env.VISUAL_AUDIT_RUNTIME_ENV || "")
        .trim()
        .toLowerCase(),
      spkiSha256: process.env.VISUAL_AUDIT_LOCAL_TLS_SPKI_SHA256,
      hostResolverRules: process.env.VISUAL_AUDIT_HOST_RESOLVER_RULES
    })
  );
  try {
    if (mode === "integrated") {
      await runIntegratedSuite(browser);
    } else {
      if (auditScope === "r8") {
        for (const workflow of allWorkflows) {
          for (const variant of r8CoreVariants) await executeModuleWorkflow(browser, workflow, variant);
          for (const variant of r8LanguageVariants) {
            await executeModuleWorkflow(browser, workflow, variant, variant.language);
          }
        }
        for (const workflow of allWorkflows.filter((item) => r8ZoomKeys.has(item.key))) {
          for (const variant of r8ZoomVariants) await executeModuleWorkflow(browser, workflow, variant);
        }
        for (const workflow of allWorkflows.filter((item) => r8ReducedMotionKeys.has(item.key))) {
          await executeModuleWorkflow(browser, workflow, {
            viewport: "tabletPortrait",
            theme: "dark",
            reducedMotion: "reduce"
          });
        }
      } else if (auditScope === "r7") {
        for (const workflow of allWorkflows) {
          for (const variant of r7CoreVariants) await executeModuleWorkflow(browser, workflow, variant);
        }
        for (const workflow of allWorkflows.filter((item) => r7PriorityKeys.has(item.key))) {
          for (const variant of r7PriorityVariants) await executeModuleWorkflow(browser, workflow, variant);
        }
        for (const workflow of allWorkflows.filter((item) => r7LanguageKeys.has(item.key))) {
          await executeModuleWorkflow(browser, workflow, { viewport: "tablet820", theme: "light" }, "en");
          await executeModuleWorkflow(browser, workflow, { viewport: "tabletLandscape1180", theme: "dark" }, "ar");
        }
        const dashboard = allWorkflows.find((workflow) => workflow.key === "dashboard");
        const students = allWorkflows.find((workflow) => workflow.key === "students");
        const finance = allWorkflows.find((workflow) => workflow.key === "finance");
        if (!dashboard || !students || !finance) throw new Error("Workflows de non-régression R7 incomplets.");
        for (const workflow of [dashboard, students, finance]) {
          for (const variant of r7RegressionVariants) await executeModuleWorkflow(browser, workflow, variant);
        }
        for (const variant of r7BoundaryVariants) await executeModuleWorkflow(browser, dashboard, variant);
        for (const variant of r7ZoomVariants) await executeModuleWorkflow(browser, dashboard, variant);
      } else {
        await runMockedAuthWorkflow(browser, "login", "fr", "light", "desktop");
        await runMockedAuthWorkflow(browser, "forgot-password", "fr", "light", "mobileLarge");
        await runMockedAuthWorkflow(browser, "activation-resend", "fr", "dark", "tabletPortrait");
        await runMockedAuthWorkflow(browser, "activation-first-login", "fr", "light", "mobileLarge");
        await runMockedAuthWorkflow(browser, "login", "en", "dark", "desktop");
        await runMockedAuthWorkflow(browser, "login", "ar", "light", "mobileLarge");

        const variants = auditScope === "ci" ? ciVariants : fullVariants;
        const extraCritical = auditScope === "ci" ? ciCriticalVariants : criticalVariants;
        for (const workflow of allWorkflows) {
          for (const variant of variants) await executeModuleWorkflow(browser, workflow, variant);
          if (criticalKeys.has(workflow.key)) {
            for (const variant of extraCritical) await executeModuleWorkflow(browser, workflow, variant);
          }
        }
        for (const workflow of allWorkflows.filter((item) => criticalKeys.has(item.key))) {
          await executeModuleWorkflow(browser, workflow, { viewport: "desktop", theme: "dark" }, "en");
          await executeModuleWorkflow(browser, workflow, { viewport: "tabletLandscape", theme: "light" }, "ar");
        }
        for (const workflow of allWorkflows.filter((item) => r6JourneyKeys.has(item.key))) {
          for (const variant of r6JourneyVariants) await executeModuleWorkflow(browser, workflow, variant);
        }
        const dashboard = allWorkflows.find((workflow) => workflow.key === "dashboard");
        if (!dashboard) throw new Error("Workflow dashboard absent de l'audit visuel.");
        const responsiveVariants = auditScope === "ci" ? responsiveBoundaryVariants : responsiveReferenceVariants;
        for (const variant of responsiveVariants) await executeModuleWorkflow(browser, dashboard, variant);
        if (auditScope !== "ci") {
          await executeModuleWorkflow(browser, dashboard, { viewport: "mobile412", theme: "dark" }, "ar");
          await executeModuleWorkflow(browser, dashboard, { viewport: "tabletPortrait", theme: "light" }, "ar");
          for (const variant of responsiveBoundaryVariants) {
            if (responsiveReferenceVariants.some((candidate) => candidate.viewport === variant.viewport)) continue;
            await executeModuleWorkflow(browser, dashboard, variant);
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  const report = await guard.writeReport(outputDir, {
    auditScope,
    baseUrl,
    fixtureVersion: mode === "mocked" ? MOCK_FIXTURE_VERSION : null,
    workflows: workflowResults
  });
  console.log(JSON.stringify({ outputDir, mode, status: report.status, workflows: workflowResults.length, findings: guard.findings.length }, null, 2));
  if (guard.blockingFindings().length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
