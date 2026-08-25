// @ts-check

import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { mockApiV1Routes } from "./fixtures/mock-api-v1.mjs";
import { resolveChromiumLaunchOptions } from "./lib/local-tls.mjs";

const require = createRequire(new URL("../../Frontend/web-admin/package.json", import.meta.url));
const { chromium } = require("playwright");

const baseUrl = process.env.ADMISSION_E2E_URL || "http://127.0.0.1:5181";
const visualMatrixEnabled = process.env.ADMISSION_E2E_VISUAL_MATRIX === "true";
const outputRoot = process.env.ADMISSION_E2E_OUTPUT
  || (visualMatrixEnabled ? "/tmp/gestschool-i8-visual" : "/tmp/gestschool-i7-e2e");
const runId = new Date().toISOString().replace(/[:.]/gu, "-");
const outputDir = path.join(outputRoot, runId);
const tenantId = "00000000-0000-4000-8000-000000000001";

const basePrerequisites = structuredClone(
  mockApiV1Routes.find((route) => route.path === "/api/v1/admission-prerequisites")?.body
);
const baseAdmissionCase = structuredClone(
  mockApiV1Routes.find((route) => route.method === "POST" && route.path === "/api/v1/admission-cases")?.body
);
const fixtureSession = structuredClone(
  mockApiV1Routes.find((route) => route.method === "POST" && route.path === "/api/v1/auth/login")?.body
);

if (!basePrerequisites || !baseAdmissionCase || !fixtureSession) {
  throw new Error("Les fixtures Admission officielles sont absentes.");
}

const browserSession = {
  ...fixtureSession,
  accessToken: "a".repeat(40),
  refreshToken: "r".repeat(40),
  tenantId,
  user: { ...fixtureSession.user, tenantId }
};

const academicOptions = {
  contractVersion: "1",
  selectionPolicy: {
    schoolYear: "SINGLE_ACTIVE",
    classCapacity: "INFORMATIONAL",
    automaticClassSelection: false,
    automaticStudentSelection: false
  },
  selected: {},
  schoolYears: [basePrerequisites.schoolYear],
  tracks: ["FRANCOPHONE"],
  levels: [{
    id: "level-visual",
    cycleId: "cycle-visual",
    cycleCode: "PRIMAIRE",
    cycleLabel: "Primaire",
    code: "CM2",
    label: "CM2",
    track: "FRANCOPHONE",
    sortOrder: 1
  }],
  classes: [{
    id: "class-visual",
    schoolYearId: basePrerequisites.schoolYear.id,
    cycleId: "cycle-visual",
    levelId: "level-visual",
    code: "CM2-A",
    label: "CM2 A",
    track: "FRANCOPHONE",
    capacity: 30,
    actualCapacity: 30,
    currentEnrollmentCount: 18,
    placesRemaining: 12,
    capacityStatus: "AVAILABLE"
  }]
};

const financeOptions = {
  contractVersion: "1",
  admissionCaseId: baseAdmissionCase.id,
  policy: "OPTIONAL",
  supportedModes: ["FEE_PLAN", "DEFERRED"],
  academicContext: {
    schoolYearId: basePrerequisites.schoolYear.id,
    track: "FRANCOPHONE",
    cycleId: "cycle-visual",
    levelId: "level-visual",
    classId: "class-visual"
  },
  plans: [{
    id: "plan-visual",
    schoolYearId: basePrerequisites.schoolYear.id,
    levelId: "level-visual",
    label: "Plan CM2",
    totalAmount: 150000,
    currency: "XOF"
  }],
  selectedIntent: null,
  schedule: { supported: false },
  services: { supported: false },
  discounts: { supported: false },
  exemptions: { supported: false },
  capabilities: {
    canReadFeePlans: true,
    canSelectFeePlan: true,
    canDefer: true,
    canCreateInvoice: false,
    automaticInvoiceCreation: false
  },
  blockingIssues: [],
  warnings: []
};

const studentMatch = {
  id: "student-existing",
  matchKind: "POSSIBLE_MATCH",
  signals: ["NAME"],
  blocksCreation: false,
  matricule: "GS-EXISTING-001",
  firstName: "Awa",
  lastName: "Diallo",
  birthDate: "2015-04-10",
  status: "ACTIVE",
  phoneHint: null,
  emailHint: null
};

const guardianMatch = {
  id: "guardian-existing",
  matchKind: "POSSIBLE_MATCH",
  signals: ["NAME"],
  blocksCreation: false,
  firstName: "Mariam",
  lastName: "Diallo",
  parentalRole: "MERE",
  status: "ACTIVE",
  phoneHint: "***42",
  emailHint: "m***@example.test",
  identityDocumentType: null,
  identityDocumentHint: null
};

const bootstrapBodies = new Map([
  ["/api/v1/school-years", []],
  ["/api/v1/cycles", []],
  ["/api/v1/levels", []],
  ["/api/v1/classes", []],
  ["/api/v1/subjects", []],
  ["/api/v1/academic-periods", []],
  ["/api/v1/students", []],
  ["/api/v1/users", []],
  ["/api/v1/enrollments", []],
  ["/api/v1/fee-plans", []],
  ["/api/v1/invoices", []],
  ["/api/v1/payments", []],
  ["/api/v1/finance/recovery", null],
  ["/api/v1/report-cards", []]
]);

const makeCase = (overrides = {}) => ({
  ...structuredClone(baseAdmissionCase),
  ...overrides
});

const createScenarioState = (options = {}) => ({
  current: options.initialCase || null,
  prerequisites: options.blocked
    ? {
        ...structuredClone(basePrerequisites),
        ready: false,
        blockingIssues: [{
          code: "ADMISSION_ACTIVE_CLASS_MISSING",
          scope: "CLASS",
          severity: "BLOCKING",
          message: "No active class"
        }]
      }
    : structuredClone(basePrerequisites),
  conflictSection: options.conflictSection || null,
  calls: [],
  expectedErrors: [],
  unexpectedRequests: []
});

const fulfillJson = (route, body, status = 200) => route.fulfill({
  status,
  headers: {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8"
  },
  body: JSON.stringify(body === undefined ? {} : body)
});

const parseBody = (request) => {
  try {
    return request.postDataJSON() || {};
  } catch {
    return {};
  }
};

const summarizeCalls = (calls) => Object.fromEntries(
  Array.from(calls.reduce((counts, call) => {
    counts.set(call, (counts.get(call) || 0) + 1);
    return counts;
  }, new Map())).sort(([left], [right]) => left.localeCompare(right))
);

const installAdmissionApi = async (context, state) => {
  const staticRoutes = new Map(
    mockApiV1Routes.map((route) => [`${route.method} ${route.path}`, route])
  );

  await context.route(/\/api\/v1\//u, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const requestPath = `${url.pathname}${url.search}`;
    const method = request.method().toUpperCase();
    state.calls.push(`${method} ${requestPath}`);

    if (url.pathname === "/api/v1/admission-prerequisites" && method === "GET") {
      await fulfillJson(route, state.prerequisites);
      return;
    }
    if (url.pathname === "/api/v1/admission-cases" && method === "GET") {
      const items = state.current && ["DRAFT", "READY", "FAILED"].includes(state.current.status)
        ? [state.current]
        : [];
      await fulfillJson(route, {
        contractVersion: "1",
        items,
        page: 1,
        pageSize: 25,
        total: items.length,
        totalPages: items.length ? 1 : 0
      });
      return;
    }
    if (url.pathname === "/api/v1/admission-cases" && method === "POST") {
      const body = parseBody(request);
      const mode = body.mode === "RE_ENROLLMENT" ? "RE_ENROLLMENT" : "NEW_ADMISSION";
      state.current = makeCase({
        mode,
        studentId: typeof body.studentId === "string" ? body.studentId : null,
        completion: {
          STUDENT: mode === "RE_ENROLLMENT",
          GUARDIANS: mode === "RE_ENROLLMENT",
          ACADEMICS: false,
          FINANCE: false,
          DOCUMENTS: false
        }
      });
      await fulfillJson(route, state.current, 201);
      return;
    }
    if (url.pathname === "/api/v1/admission-cases/search/students" && method === "GET") {
      await fulfillJson(route, {
        matchKind: "POSSIBLE_MATCH",
        code: "STUDENT_DUPLICATE_SUSPECTED",
        matches: [studentMatch]
      });
      return;
    }
    if (url.pathname === "/api/v1/admission-cases/search/guardians" && method === "GET") {
      await fulfillJson(route, {
        matchKind: "POSSIBLE_MATCH",
        code: "GUARDIAN_DUPLICATE_SUSPECTED",
        matches: [guardianMatch]
      });
      return;
    }
    if (url.pathname === "/api/v1/admission-cases/academic-options" && method === "GET") {
      await fulfillJson(route, academicOptions);
      return;
    }
    if (url.pathname === "/api/v1/admission-cases/finance-options" && method === "GET") {
      await fulfillJson(route, { ...financeOptions, admissionCaseId: state.current?.id });
      return;
    }
    const caseMatch = url.pathname.match(/^\/api\/v1\/admission-cases\/([^/]+)$/u);
    if (caseMatch && method === "GET" && state.current?.id === caseMatch[1]) {
      await fulfillJson(route, state.current);
      return;
    }

    const staticMock = staticRoutes.get(`${method} ${requestPath}`);
    if (staticMock) {
      const body = typeof staticMock.body === "function" ? await staticMock.body(request) : staticMock.body;
      await fulfillJson(route, body, staticMock.status || 200);
      return;
    }
    if (method === "GET" && bootstrapBodies.has(url.pathname)) {
      await fulfillJson(route, bootstrapBodies.get(url.pathname));
      return;
    }

    const sectionMatch = url.pathname.match(
      /^\/api\/v1\/admission-cases\/([^/]+)\/sections\/(STUDENT|GUARDIANS|ACADEMICS|FINANCE)$/u
    );
    if (sectionMatch && method === "PATCH" && state.current?.id === sectionMatch[1]) {
      const section = sectionMatch[2];
      if (state.conflictSection === section) {
        state.expectedErrors.push(`409 ${section}`);
        await fulfillJson(route, { code: "ADMISSION_VERSION_CONFLICT" }, 409);
        return;
      }
      const body = parseBody(request);
      const completion = { ...state.current.completion, [section]: true };
      const ready = completion.STUDENT && completion.GUARDIANS && completion.ACADEMICS && completion.FINANCE;
      state.current = {
        ...state.current,
        sections: { ...state.current.sections, [section]: body.data || {} },
        completion,
        ready,
        status: ready ? "READY" : "DRAFT",
        version: state.current.version + 1
      };
      await fulfillJson(route, state.current);
      return;
    }

    const reopenMatch = url.pathname.match(/^\/api\/v1\/admission-cases\/([^/]+)\/reopen$/u);
    if (reopenMatch && method === "POST" && state.current?.id === reopenMatch[1]) {
      state.current = {
        ...state.current,
        status: state.current.ready ? "READY" : "DRAFT",
        version: state.current.version + 1,
        failedAt: null,
        failureCode: null,
        recoveryAction: null
      };
      await fulfillJson(route, state.current);
      return;
    }

    const finalizeMatch = url.pathname.match(/^\/api\/v1\/admission-cases\/([^/]+)\/finalize$/u);
    if (finalizeMatch && method === "POST" && state.current?.id === finalizeMatch[1]) {
      const finance = state.current.sections.FINANCE || { mode: "DEFERRED" };
      const result = {
        admissionCaseId: state.current.id,
        status: "CONFIRMED",
        studentId: state.current.studentId || "student-created",
        studentMatricule: "GS-2026-001",
        placementId: "placement-created",
        enrollmentId: "enrollment-created",
        guardianIds: ["guardian-created"],
        parentStudentLinkIds: ["link-created"],
        finance: {
          policy: "OPTIONAL",
          mode: finance.mode,
          feePlanId: finance.feePlanId || null,
          amount: null,
          currency: null,
          invoiceGeneration: "DEFERRED"
        },
        invoiceIds: [],
        confirmedAt: "2026-08-23T09:00:00.000Z",
        version: state.current.version + 1
      };
      state.current = {
        ...state.current,
        status: "CONFIRMED",
        version: result.version,
        confirmedAt: result.confirmedAt,
        finalizationResult: result
      };
      await fulfillJson(route, result, 201);
      return;
    }

    state.unexpectedRequests.push(`${method} ${requestPath}`);
    await fulfillJson(route, { code: "NOT_MOCKED" }, 500);
  });
};

const waitStep = (page, step) => page.locator(`[data-admission-step='${step}']`).waitFor({ state: "visible" });

const openEnrollments = async (page) => {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.locator(".screen-host").waitFor({ state: "visible" });
  await page.locator(".screen-loading").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => undefined);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const visibleLink = page.locator("[data-navigation-id='enrollments']:visible").first();
  if (await visibleLink.isVisible().catch(() => false)) {
    await visibleLink.click();
  } else {
    const toggle = page.locator(".header-mobile-toggle").first();
    await toggle.waitFor({ state: "visible" });
    await toggle.click();
    const mobileLink = page.locator("#header-mobile-panel .header-mobile-link[data-navigation-id='enrollments']").first();
    await mobileLink.waitFor({ state: "visible" });
    await mobileLink.click();
  }
  await page.locator(".enrollments-v3-page-header h1").waitFor({ state: "visible" });
};

const startMode = async (page, index) => {
  await page.locator(".enrollments-v3-page-header > button").click();
  await page.locator(".admission-mode-grid button").nth(index).click();
  await waitStep(page, "STUDENT");
};

const fillNewStudent = async (page) => {
  const step = page.locator("[data-admission-step='STUDENT']");
  const inputs = step.locator(".admission-form-grid input");
  await inputs.nth(0).fill("Awa");
  await inputs.nth(1).fill("Diallo");
  await step.locator(".admission-form-grid select").selectOption("F");
  await inputs.nth(2).fill("2015-04-10");
};

const continueStep = async (page, step) => {
  const root = page.locator(`[data-admission-step='${step}']`);
  await root.locator(".admission-step-actions button").last().click();
};

const addNewGuardian = async (page) => {
  const step = page.locator("[data-admission-step='GUARDIANS']");
  await step.locator(".admission-segmented-control button").nth(1).click();
  const editor = step.locator(".admission-guardian-editor");
  await editor.locator("input").nth(0).fill("Mariam");
  await editor.locator("input").nth(1).fill("Diallo");
  await editor.locator("select").selectOption("MERE");
  await editor.locator(".admission-editor-actions button").click();
};

const selectAcademics = async (page) => {
  await waitStep(page, "ACADEMICS");
  const selects = page.locator("[data-admission-step='ACADEMICS'] .admission-form-grid select");
  await selects.nth(0).selectOption(basePrerequisites.schoolYear.id);
  await selects.nth(1).selectOption("FRANCOPHONE");
  await selects.nth(2).selectOption("level-visual");
  await selects.nth(3).selectOption("class-visual");
  await continueStep(page, "ACADEMICS");
};

const selectFinance = async (page, mode) => {
  await waitStep(page, "FINANCE");
  const step = page.locator("[data-admission-step='FINANCE']");
  if (mode === "FEE_PLAN") {
    await step.locator("input[name='finance-mode']").nth(0).check();
    await step.locator("input[name='fee-plan']").check();
  } else {
    await step.locator("input[name='finance-mode']").nth(1).check();
  }
  await continueStep(page, "FINANCE");
  await waitStep(page, "REVIEW");
};

const finalize = async (page) => {
  await continueStep(page, "REVIEW");
  const dialog = page.locator("[role='alertdialog']:visible");
  await dialog.waitFor({ state: "visible" });
  await dialog.getByRole("button").last().click();
  await page.locator(".admission-success").waitFor({ state: "visible" });
};

const scenarios = [
  {
    key: "A-new-new-guardian-fee-plan-success",
    language: "fr",
    run: async (page) => {
      await startMode(page, 0);
      await fillNewStudent(page);
      await continueStep(page, "STUDENT");
      await waitStep(page, "GUARDIANS");
      await addNewGuardian(page);
      await continueStep(page, "GUARDIANS");
      await selectAcademics(page);
      await selectFinance(page, "FEE_PLAN");
      await finalize(page);
    }
  },
  {
    key: "B-new-existing-guardian-deferred",
    language: "en",
    run: async (page) => {
      await startMode(page, 0);
      await fillNewStudent(page);
      await continueStep(page, "STUDENT");
      await waitStep(page, "GUARDIANS");
      const step = page.locator("[data-admission-step='GUARDIANS']");
      await step.locator("form[role='search'] input").fill("Diallo");
      await step.locator("form[role='search'] button").click();
      await step.locator(".admission-result-card button").click();
      await continueStep(page, "GUARDIANS");
      await selectAcademics(page);
      await selectFinance(page, "DEFERRED");
      await finalize(page);
    }
  },
  {
    key: "C-re-enrollment",
    language: "ar",
    run: async (page) => {
      await startMode(page, 1);
      const step = page.locator("[data-admission-step='STUDENT']");
      await step.locator("form[role='search'] input").fill("Diallo");
      await step.locator("form[role='search'] button").click();
      await step.locator(".admission-result-card button").click();
      await continueStep(page, "STUDENT");
      await waitStep(page, "ACADEMICS");
      await selectAcademics(page);
      await selectFinance(page, "DEFERRED");
      if (await page.evaluate(() => document.documentElement.dir !== "rtl")) {
        throw new Error("Le scenario arabe n'est pas rendu en RTL.");
      }
    }
  },
  {
    key: "D-resume-draft",
    language: "fr",
    state: () => createScenarioState({
      initialCase: makeCase({
        version: 3,
        sections: {
          STUDENT: { firstName: "Awa", lastName: "Diallo", sex: "F", birthDate: "2015-04-10" },
          DOCUMENTS: null
        },
        completion: { STUDENT: true, GUARDIANS: false, ACADEMICS: false, FINANCE: false, DOCUMENTS: false }
      })
    }),
    run: async (page) => {
      await page.locator(".admission-draft-card button").first().click();
      await waitStep(page, "GUARDIANS");
    }
  },
  {
    key: "E-failed-reopen",
    language: "fr",
    state: () => createScenarioState({
      initialCase: makeCase({
        status: "FAILED",
        version: 5,
        failedAt: "2026-08-23T09:00:00.000Z",
        failureCode: "PLACEMENT_CONFLICT",
        recoveryAction: "EDIT_AND_REVALIDATE",
        sections: {
          STUDENT: { firstName: "Awa", lastName: "Diallo", sex: "F", birthDate: "2015-04-10" },
          DOCUMENTS: null
        },
        completion: { STUDENT: true, GUARDIANS: false, ACADEMICS: false, FINANCE: false, DOCUMENTS: false }
      })
    }),
    run: async (page) => {
      await page.locator(".admission-draft-card button").first().click();
      await page.getByRole("button", { name: "Corriger le dossier" }).click();
      await waitStep(page, "GUARDIANS");
    }
  },
  {
    key: "F-version-conflict",
    language: "fr",
    state: () => createScenarioState({ conflictSection: "STUDENT" }),
    run: async (page) => {
      await startMode(page, 0);
      await fillNewStudent(page);
      await continueStep(page, "STUDENT");
      await page.locator(".admission-conflict").waitFor({ state: "visible" });
    }
  },
  {
    key: "G-prerequisites-blocked",
    language: "fr",
    state: () => createScenarioState({ blocked: true }),
    run: async (page) => {
      await page.locator(".enrollments-v3-page-header > button").click();
      await page.locator(".admission-blocked").waitFor({ state: "visible" });
    }
  },
  {
    key: "H-duplicate-student",
    language: "fr",
    run: async (page) => {
      await startMode(page, 0);
      await fillNewStudent(page);
      const step = page.locator("[data-admission-step='STUDENT']");
      await step.locator(".admission-duplicate-check button").click();
      await step.locator(".admission-result-card").waitFor({ state: "visible" });
    }
  }
];

const visualViewports = [
  { key: "mobile", width: 390, height: 844 },
  { key: "tablet", width: 820, height: 1180 },
  { key: "desktop", width: 1440, height: 900 }
];

const prepareNewAdmission = async (page) => {
  await startMode(page, 0);
  await fillNewStudent(page);
  await continueStep(page, "STUDENT");
  await waitStep(page, "GUARDIANS");
};

const prepareGuardian = async (page) => {
  await prepareNewAdmission(page);
  await addNewGuardian(page);
};

const prepareAcademics = async (page) => {
  await prepareGuardian(page);
  await continueStep(page, "GUARDIANS");
  await waitStep(page, "ACADEMICS");
};

const prepareFinance = async (page) => {
  await prepareAcademics(page);
  await selectAcademics(page);
  await waitStep(page, "FINANCE");
};

const prepareReview = async (page) => {
  await prepareFinance(page);
  await selectFinance(page, "DEFERRED");
};

const visualStates = [
  {
    key: "draft-list",
    state: () => createScenarioState({
      initialCase: makeCase({
        version: 3,
        sections: {
          STUDENT: { firstName: "Awa", lastName: "Diallo", sex: "F", birthDate: "2015-04-10" },
          DOCUMENTS: null
        },
        completion: { STUDENT: true, GUARDIANS: false, ACADEMICS: false, FINANCE: false, DOCUMENTS: false }
      })
    }),
    run: async () => {}
  },
  { key: "student-new", run: async (page) => startMode(page, 0) },
  { key: "student-re-enrollment", run: async (page) => startMode(page, 1) },
  { key: "guardian-empty", run: prepareNewAdmission },
  { key: "guardian-populated", run: prepareGuardian },
  { key: "academics", run: prepareAcademics },
  { key: "finance", run: prepareFinance },
  { key: "review", run: prepareReview },
  {
    key: "success",
    run: async (page) => {
      await prepareReview(page);
      await finalize(page);
    }
  }
];

const visualScenarios = visualStates.flatMap((visualState) => {
  const standardRuns = visualViewports.flatMap((viewport) => ["light", "dark"].map((theme) => ({
    ...visualState,
    key: `${visualState.key}-fr-${theme}-${viewport.key}`,
    stateKey: visualState.key,
    language: "fr",
    theme,
    viewport
  })));
  const englishRun = {
    ...visualState,
    key: `${visualState.key}-en-light-desktop`,
    stateKey: visualState.key,
    language: "en",
    theme: "light",
    viewport: visualViewports[2]
  };
  const arabicRuns = ["guardian-populated", "academics", "review"].includes(visualState.key)
    ? visualViewports.flatMap((viewport) => ["light", "dark"].map((theme) => ({
        ...visualState,
        key: `${visualState.key}-ar-${theme}-${viewport.key}`,
        stateKey: visualState.key,
        language: "ar",
        theme,
        viewport
      })))
    : [];
  return [...standardRuns, englishRun, ...arabicRuns];
});

const requestedScenarios = new Set(
  String(process.env.ADMISSION_E2E_SCENARIOS || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean)
);
const availableScenarios = visualMatrixEnabled ? visualScenarios : scenarios;
const selectedScenarios = requestedScenarios.size > 0
  ? availableScenarios.filter((scenario) => requestedScenarios.has(scenario.key))
  : availableScenarios;

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch(
  resolveChromiumLaunchOptions({
    mode: "mocked",
    baseUrl,
    runtimeEnvironment: "rc",
    spkiSha256: "",
    hostResolverRules: ""
  })
);
const results = [];

try {
  for (const scenario of selectedScenarios) {
    console.log(`[admission-e2e] ${scenario.key}: running`);
    const state = scenario.state ? scenario.state() : createScenarioState();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(({ language, session, theme }) => {
      try {
        window.localStorage.setItem("gestschool.web-admin.language", language);
        window.localStorage.setItem("gestschool.web-admin.theme", theme);
        window.sessionStorage.setItem("gestschool.web-admin.session", JSON.stringify(session));
      } catch {
        // Chromium also executes init scripts on the initial opaque about:blank document.
      }
    }, { language: scenario.language, session: browserSession, theme: scenario.theme || "light" });
    await installAdmissionApi(context, state);
    const page = await context.newPage();
    page.setDefaultTimeout(12_000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(`console: ${message.text()}`);
      }
    });
    page.on("response", (response) => {
      if (response.status() < 400) return;
      const url = new URL(response.url());
      const isExpectedConflict = response.status() === 409
        && state.conflictSection === "STUDENT"
        && /\/api\/v1\/admission-cases\/[^/]+\/sections\/STUDENT$/u.test(url.pathname);
      if (!isExpectedConflict) errors.push(`http ${response.status()}: ${url.pathname}`);
    });

    let status = "passed";
    let error = null;
    let metrics = null;
    try {
      await openEnrollments(page);
      if (scenario.viewport) {
        await page.setViewportSize({ width: scenario.viewport.width, height: scenario.viewport.height });
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      }
      await scenario.run(page, state);
      metrics = await page.evaluate(() => {
        const parseRgb = (value) => {
          const channels = value.match(/[\d.]+/gu)?.slice(0, 3).map(Number);
          return channels?.length === 3 ? channels : null;
        };
        const luminance = (value) => {
          const channels = parseRgb(value);
          if (!channels) return null;
          const linear = channels.map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.04045
              ? normalized / 12.92
              : ((normalized + 0.055) / 1.055) ** 2.4;
          });
          return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
        };
        const contrast = (foreground, background) => {
          const foregroundLuminance = luminance(foreground);
          const backgroundLuminance = luminance(background);
          if (foregroundLuminance === null || backgroundLuminance === null) return null;
          const light = Math.max(foregroundLuminance, backgroundLuminance);
          const dark = Math.min(foregroundLuminance, backgroundLuminance);
          return (light + 0.05) / (dark + 0.05);
        };
        const root = document.documentElement;
        const shell = document.querySelector(".admission-wizard, .admission-drafts, .admission-success");
        const card = document.querySelector(".admission-step-card, .admission-draft-card, .admission-success");
        const heading = card?.querySelector("h1, h2, h3, strong");
        const cardStyle = card ? getComputedStyle(card) : null;
        const headingStyle = heading ? getComputedStyle(heading) : null;
        const undersizedButtons = shell
          ? Array.from(shell.querySelectorAll("button")).filter((button) => {
              const rect = button.getBoundingClientRect();
              const style = getComputedStyle(button);
              return style.visibility !== "hidden"
                && style.display !== "none"
                && (rect.width < 43.5 || rect.height < 43.5);
            }).map((button) => ({
              label: button.getAttribute("aria-label") || button.textContent?.trim().slice(0, 80) || "button",
              width: button.getBoundingClientRect().width,
              height: button.getBoundingClientRect().height
            }))
          : [];
        const cardBackground = cardStyle?.backgroundColor || null;
        const headingColor = headingStyle?.color || null;
        return {
          documentClientWidth: root.clientWidth,
          documentScrollWidth: root.scrollWidth,
          overflow: root.scrollWidth - root.clientWidth,
          shellWidth: shell instanceof HTMLElement ? shell.getBoundingClientRect().width : null,
          cardBackground,
          cardForeground: cardStyle?.color || null,
          headingColor,
          headingContrast: cardBackground && headingColor ? contrast(headingColor, cardBackground) : null,
          undersizedButtons,
          direction: root.dir || getComputedStyle(root).direction
        };
      });
      if (metrics.overflow > 4) throw new Error(`Overflow document: ${metrics.overflow}px.`);
      if (metrics.headingContrast !== null && metrics.headingContrast < 4.5) {
        throw new Error(`Contraste titre/carte insuffisant: ${metrics.headingContrast.toFixed(2)}.`);
      }
      if (metrics.undersizedButtons.length > 0) {
        throw new Error(`Cibles tactiles inferieures a 44px: ${JSON.stringify(metrics.undersizedButtons)}.`);
      }
      if (scenario.language === "ar" && metrics.direction !== "rtl") {
        throw new Error("Le scenario arabe n'est pas rendu en RTL.");
      }
      if (visualMatrixEnabled) {
        await page.screenshot({ path: path.join(outputDir, `${scenario.key}.png`), fullPage: true });
      }
      if (state.unexpectedRequests.length > 0) {
        throw new Error(`Requetes API non declarees: ${state.unexpectedRequests.join(", ")}`);
      }
      const enrollmentReloads = state.calls.filter((call) => call === "GET /api/v1/enrollments").length;
      if (enrollmentReloads > 6) {
        throw new Error(`Boucle de rechargement des inscriptions: ${enrollmentReloads} appels.`);
      }
      const unexpectedErrors = errors.filter((message) => {
        const expectedResourceError = state.expectedErrors.includes("409 STUDENT")
          && /^console: Failed to load resource: the server responded with a status of 409 \((?:Conflict)?\)$/u.test(message);
        return !expectedResourceError;
      });
      if (unexpectedErrors.length > 0) throw new Error(unexpectedErrors.join(" | "));
    } catch (caught) {
      status = "failed";
      error = caught instanceof Error ? caught.message : String(caught);
      await page.screenshot({ path: path.join(outputDir, `failed-${scenario.key}.png`), fullPage: true }).catch(() => undefined);
    }
    results.push({
      key: scenario.key,
      state: scenario.stateKey || scenario.key,
      language: scenario.language,
      theme: scenario.theme || "light",
      viewport: scenario.viewport || { width: 1280, height: 800 },
      status,
      error,
      browserErrors: errors,
      metrics,
      calls: state.calls.length,
      callSummary: summarizeCalls(state.calls),
      expectedErrors: state.expectedErrors,
      unexpectedRequests: state.unexpectedRequests
    });
    console.log(`[admission-e2e] ${scenario.key}: ${status}`);
    await context.close();
  }
} finally {
  await browser.close();
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: results.every((result) => result.status === "passed") ? "passed" : "failed",
  scenarios: results,
  findings: results.filter((result) => result.status !== "passed").length,
  allowlist: []
};

await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  outputDir,
  status: report.status,
  scenarios: results.length,
  passed: results.filter((result) => result.status === "passed").length,
  findings: report.findings,
  allowlist: report.allowlist.length
}, null, 2));

if (report.status !== "passed") process.exitCode = 1;
