// @ts-check

import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { resolveChromiumLaunchOptions } from "./visual-audit/lib/local-tls.mjs";

const require = createRequire(new URL("../Frontend/web-admin/package.json", import.meta.url));
const { chromium } = require("playwright");

const baseUrl = process.env.PERFORMANCE_AUDIT_URL || "http://127.0.0.1:5182";
const outputDir = process.env.PERFORMANCE_AUDIT_OUTPUT || "/tmp/gestschool-r9-performance";
const canonicalTenantId = "00000000-0000-4000-8000-000000000001";
const selectedProfiles = new Set(
  (process.env.PERFORMANCE_AUDIT_PROFILES || "").split(",").map((value) => value.trim()).filter(Boolean)
);
const selectedRoutes = new Set(
  (process.env.PERFORMANCE_AUDIT_ROUTES || "").split(",").map((value) => value.trim()).filter(Boolean)
);

const profiles = [
  { key: "desktop", viewport: { width: 1440, height: 900 } },
  { key: "mobile", viewport: { width: 390, height: 844 } },
  {
    key: "mobile-throttled",
    viewport: { width: 390, height: 844 },
    cpuRate: 4,
    network: {
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      latency: 150,
      offline: false,
      uploadThroughput: (750 * 1024) / 8
    }
  }
];

const routes = [
  { key: "login", readySelector: ".auth-canvas" },
  { key: "dashboard", readySelector: ".dashboard-shell-v2" },
  { key: "students", navigationId: "students", readySelector: ".students-screen-shell" },
  { key: "finance", navigationId: "finance", readySelector: ".finance-screen-shell" },
  { key: "grades", navigationId: "grades", readySelector: "#grades-filters" },
  { key: "pilotage", navigationId: "schoolLifeOverview", readySelector: ".pilotage-screen" },
  {
    key: "students-100",
    navigationId: "students",
    profiles: ["desktop", "mobile-throttled"],
    readySelector: ".students-screen-shell",
    studentCount: 100
  },
  {
    key: "students-200",
    navigationId: "students",
    profiles: ["desktop", "mobile-throttled"],
    readySelector: ".students-screen-shell",
    studentCount: 200
  }
];

const createStudents = (count) =>
  Array.from({ length: count }, (_, index) => ({
    firstName: `Prenom${index + 1}`,
    id: `performance-student-${index + 1}`,
    lastName: `Eleve${index + 1}`,
    matricule: `PERF-${String(index + 1).padStart(4, "0")}`,
    placements: [],
    sex: index % 2 === 0 ? "F" : "M",
    status: "ACTIVE",
    tracks: ["FRANCOPHONE"]
  }));

const mockPayload = (requestUrl, studentCount = 0) => {
  const url = new URL(requestUrl);
  if (url.pathname.endsWith("/health/live")) return { status: "ok" };
  if (url.pathname.endsWith("/finance/recovery")) {
    return {
      totals: { amountDue: 0, amountPaid: 0, remainingAmount: 0, recoveryRatePercent: 0 },
      invoices: { total: 0, open: 0, partial: 0, paid: 0, void: 0 }
    };
  }
  if (url.pathname.endsWith("/attendance/summary")) {
    return {
      byStatus: { ABSENT: 0, EXCUSED: 0, LATE: 0, PRESENT: 0 },
      total: 0
    };
  }
  if (url.pathname.endsWith("/students")) return createStudents(studentCount);
  if (url.pathname.endsWith("/timetable-slots/grid")) return { days: [] };
  return [];
};

const storedSession = {
  accessToken: "a".repeat(40),
  refreshToken: "r".repeat(40),
  tenantId: canonicalTenantId,
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    username: "performance.admin",
    displayName: "Performance Admin",
    role: "ADMIN",
    status: "ACTIVE",
    tenantId: canonicalTenantId
  }
};

const installMetricsObserver = async (page, authenticated) => {
  await page.addInitScript(
    ({ session, shouldAuthenticate }) => {
      if (shouldAuthenticate) {
        window.sessionStorage.setItem("gestschool.web-admin.session", JSON.stringify(session));
      } else {
        window.sessionStorage.removeItem("gestschool.web-admin.session");
      }
      window.localStorage.setItem("gestschool.web-admin.language", "fr");
      window.localStorage.setItem("gestschool.web-admin.theme", "light");

      window.__gestschoolR9 = {
        cls: 0,
        events: [],
        longTasks: [],
        lcp: 0,
        shifts: []
      };

      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              window.__gestschoolR9.cls += entry.value;
              window.__gestschoolR9.shifts.push({
                sources: (entry.sources || []).map((source) => ({
                  currentRect: source.currentRect,
                  node: source.node instanceof Element
                    ? `${source.node.tagName.toLowerCase()}.${String(source.node.className || "").trim().replace(/\s+/gu, ".")}`
                    : null,
                  previousRect: source.previousRect
                })),
                startTime: entry.startTime,
                value: entry.value
              });
            }
          }
        }).observe({ type: "layout-shift", buffered: true });
      } catch {}
      try {
        new PerformanceObserver((list) => {
          const latest = list.getEntries().at(-1);
          if (latest) window.__gestschoolR9.lcp = latest.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
      } catch {}
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__gestschoolR9.events.push({
              duration: entry.duration,
              interactionId: entry.interactionId || 0,
              name: entry.name,
              startTime: entry.startTime
            });
          }
        }).observe({ type: "event", buffered: true, durationThreshold: 16 });
      } catch {}
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__gestschoolR9.longTasks.push({ duration: entry.duration, startTime: entry.startTime });
          }
        }).observe({ type: "longtask", buffered: true });
      } catch {}
    },
    { session: storedSession, shouldAuthenticate: authenticated }
  );
};

const collectBrowserMetrics = async (page, client, transitionStartedAt, resourcesBefore) => {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.waitForTimeout(500);

  const cdpMetrics = await client.send("Performance.getMetrics");
  const cdp = Object.fromEntries(cdpMetrics.metrics.map((metric) => [metric.name, metric.value]));

  return page.evaluate(
    ({ cdpValues, routeStartedAt, resourceOffset }) => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const paints = Object.fromEntries(
        performance.getEntriesByType("paint").map((entry) => [entry.name, entry.startTime])
      );
      const allResources = performance.getEntriesByType("resource").map((entry) => ({
        duration: entry.duration,
        encodedBodySize: entry.encodedBodySize,
        initiatorType: entry.initiatorType,
        name: entry.name,
        responseEnd: entry.responseEnd,
        startTime: entry.startTime,
        transferSize: entry.transferSize
      }));
      const routeResources = allResources.slice(resourceOffset);
      const apiResources = allResources.filter((entry) => {
        try {
          return new URL(entry.name).pathname.startsWith("/api/v1");
        } catch {
          return false;
        }
      });
      const interactions = window.__gestschoolR9.events
        .filter((entry) => entry.interactionId > 0)
        .map((entry) => entry.duration);
      const longTaskDuration = window.__gestschoolR9.longTasks.reduce(
        (total, entry) => total + entry.duration,
        0
      );

      return {
        api: {
          count: apiResources.length,
          spanMs: apiResources.length > 0
            ? Math.max(...apiResources.map((entry) => entry.responseEnd)) -
              Math.min(...apiResources.map((entry) => entry.startTime))
            : 0
        },
        coreWebVitals: {
          cls: window.__gestschoolR9.cls,
          fcp: paints["first-contentful-paint"] || null,
          inp: interactions.length > 0 ? Math.max(...interactions) : null,
          lcp: window.__gestschoolR9.lcp || null,
          ttfb: navigation ? navigation.responseStart - navigation.requestStart : null
        },
        document: {
          clientWidth: document.documentElement.clientWidth,
          nodeCount: document.getElementsByTagName("*").length,
          scrollWidth: document.documentElement.scrollWidth
        },
        longTasks: {
          count: window.__gestschoolR9.longTasks.length,
          duration: longTaskDuration
        },
        layoutShifts: window.__gestschoolR9.shifts,
        navigation: navigation
          ? {
              domContentLoaded: navigation.domContentLoadedEventEnd,
              load: navigation.loadEventEnd,
              responseEnd: navigation.responseEnd,
              transferSize: navigation.transferSize
            }
          : null,
        process: {
          jsHeapUsedBytes: cdpValues.JSHeapUsedSize || null,
          layoutCount: cdpValues.LayoutCount || null,
          nodes: cdpValues.Nodes || null,
          recalcStyleCount: cdpValues.RecalcStyleCount || null,
          scriptDurationMs: (cdpValues.ScriptDuration || 0) * 1000,
          taskDurationMs: (cdpValues.TaskDuration || 0) * 1000
        },
        resources: allResources,
        routeResources,
        routeTransitionMs: routeStartedAt === null ? null : performance.now() - routeStartedAt
      };
    },
    {
      cdpValues: cdp,
      routeStartedAt: transitionStartedAt,
      resourceOffset: resourcesBefore
    }
  );
};

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch(
  resolveChromiumLaunchOptions({
    baseUrl,
    mode: "mocked",
    runtimeEnvironment: "rc",
    spkiSha256: ""
  })
);

const report = {
  generatedAt: new Date().toISOString(),
  mode: "local-synthetic",
  results: [],
  schemaVersion: 1
};

try {
  for (const profile of profiles) {
    if (selectedProfiles.size > 0 && !selectedProfiles.has(profile.key)) continue;
    for (const route of routes) {
      if (selectedRoutes.size > 0 && !selectedRoutes.has(route.key)) continue;
      if (route.profiles && !route.profiles.includes(profile.key)) continue;
      const context = await browser.newContext({ viewport: profile.viewport });
      const apiRequests = [];
      const consoleErrors = [];
      const pageErrors = [];
      const requestFailures = [];
      await context.route("**/api/v1/**", async (interceptedRoute) => {
        apiRequests.push(`${interceptedRoute.request().method()} ${new URL(interceptedRoute.request().url()).pathname}`);
        await interceptedRoute.fulfill({
          body: JSON.stringify(mockPayload(interceptedRoute.request().url(), route.studentCount)),
          contentType: "application/json; charset=utf-8",
          status: 200
        });
      });

      const page = await context.newPage();
      page.on("console", (message) => {
        if (message.type() === "error" || message.type() === "assert") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("requestfailed", (request) => {
        requestFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText || "unknown"}`);
      });

      await installMetricsObserver(page, route.key !== "login");
      const client = await context.newCDPSession(page);
      await client.send("Performance.enable");
      if (profile.network) {
        await client.send("Network.enable");
        await client.send("Network.emulateNetworkConditions", profile.network);
      }
      if (profile.cpuRate) await client.send("Emulation.setCPUThrottlingRate", { rate: profile.cpuRate });

      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      await page.locator(route.key === "login" ? ".auth-canvas" : ".app-shell").waitFor({ state: "visible" });

      const resourcesBefore = await page.evaluate(() => performance.getEntriesByType("resource").length);
      let transitionStartedAt = null;
      if (route.navigationId) {
        transitionStartedAt = await page.evaluate(() => performance.now());
        if (profile.viewport.width < 1280) {
          await page.locator(".header-mobile-toggle").click();
          await page
            .locator(`#header-mobile-panel [data-navigation-id="${route.navigationId}"]`)
            .click();
        } else {
          await page.locator(`[data-navigation-id="${route.navigationId}"]`).first().click();
        }
      }

      await page.locator(route.readySelector).first().waitFor({ state: "visible", timeout: 15_000 });
      const metrics = await collectBrowserMetrics(page, client, transitionStartedAt, resourcesBefore);
      report.results.push({
        apiRequestCount: apiRequests.length,
        apiRequests: [...new Set(apiRequests)].sort(),
        consoleErrors,
        pageErrors,
        profile: profile.key,
        requestFailures,
        route: route.key,
        ...metrics
      });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const outputPath = path.join(outputDir, "report.json");
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

const failures = report.results.flatMap((result) => [
  ...result.consoleErrors,
  ...result.pageErrors,
  ...result.requestFailures
]);
const expectedRuns = profiles.reduce(
  (total, profile) => {
    if (selectedProfiles.size > 0 && !selectedProfiles.has(profile.key)) return total;
    return total + routes.filter(
      (route) =>
        (!route.profiles || route.profiles.includes(profile.key)) &&
        (selectedRoutes.size === 0 || selectedRoutes.has(route.key))
    ).length;
  },
  0
);
console.log(`Audit performance R9: ${report.results.length}/${expectedRuns} parcours mesures.`);
console.log(`Erreurs console/page/reseau: ${failures.length}.`);
console.log(`Rapport: ${outputPath}`);
if (failures.length > 0) process.exitCode = 1;
