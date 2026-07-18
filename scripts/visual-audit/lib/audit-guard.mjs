// @ts-check

import { writeFile } from "node:fs/promises";
import path from "node:path";

const API_PREFIX = "/api/v1";
const BLOCKING_CONSOLE_TYPES = new Set(["error", "assert"]);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * @typedef {object} AuditMetadata
 * @property {string} workflow
 * @property {string} route
 * @property {string} viewport
 * @property {string} theme
 * @property {string} language
 */

/**
 * @typedef {object} AuditFinding
 * @property {string} type
 * @property {string} message
 * @property {string=} route
 * @property {AuditMetadata} metadata
 * @property {string=} screenshot
 * @property {boolean} allowlisted
 * @property {string=} allowlistReason
 */

/**
 * @typedef {object} AuditAllowlistEntry
 * @property {string} type
 * @property {string} route
 * @property {string} messagePattern
 * @property {string} reason
 * @property {string} expiresAt
 * @property {string} ticket
 */

/**
 * @typedef {object} MockRoute
 * @property {string} method
 * @property {string} path
 * @property {number=} status
 * @property {unknown|((request: import('playwright').Request) => unknown|Promise<unknown>)=} body
 */

const createDefaultMetadata = () => ({
  workflow: "bootstrap",
  route: "/",
  viewport: "unknown",
  theme: "unknown",
  language: "unknown"
});

const apiPath = (value) => {
  const parsed = new URL(value);
  return `${parsed.pathname}${parsed.search}`;
};

const isApiRequest = (value) => {
  try {
    return new URL(value).pathname.startsWith(API_PREFIX);
  } catch {
    return false;
  }
};

const validateAllowlist = (entries, now = new Date()) => {
  for (const entry of entries) {
    if (!entry.type || !entry.route || !entry.messagePattern || !entry.reason || !entry.expiresAt || !entry.ticket) {
      throw new Error("Chaque allowlist visuelle doit preciser type, route, motif, raison, echeance et ticket.");
    }
    if (Number.isNaN(Date.parse(entry.expiresAt))) {
      throw new Error(`Echeance d'allowlist invalide: ${entry.expiresAt}.`);
    }
    if (new Date(entry.expiresAt) < now) {
      throw new Error(`Allowlist expiree pour ${entry.type} ${entry.route} (${entry.ticket}).`);
    }
  }
};

export const matchAllowlist = (finding, entries) => {
  const route = finding.route || finding.metadata.route;
  return entries.find((entry) => {
    if (entry.type !== finding.type || entry.route !== route) return false;
    try {
      return new RegExp(entry.messagePattern, "u").test(finding.message);
    } catch {
      return false;
    }
  });
};

export const inspectDomSnapshot = (snapshot, options = {}) => {
  const findings = [];
  const overflowLimit = options.overflowLimit ?? 4;
  if (!snapshot.bodyText.trim() || snapshot.bodyArea < 10_000) {
    findings.push({ type: "blank-page", message: "La page est vide ou n'a pas produit de surface visible exploitable." });
  }
  if (snapshot.horizontalOverflow > overflowLimit) {
    findings.push({
      type: "horizontal-overflow",
      message: `Debordement horizontal significatif: ${Math.round(snapshot.horizontalOverflow)}px.`
    });
  }
  if (snapshot.loadingLabels.length > 0) {
    findings.push({
      type: "loading-stuck",
      message: `Etat de chargement encore visible: ${snapshot.loadingLabels.join(" | ")}.`
    });
  }
  if (snapshot.unavailableLabels.length > 0) {
    findings.push({
      type: "unexpected-unavailable",
      message: `Message d'indisponibilite inattendu: ${snapshot.unavailableLabels.join(" | ")}.`
    });
  }
  if (snapshot.missingSelectors.length > 0) {
    findings.push({
      type: "missing-critical-selector",
      message: `Selecteur critique absent ou invisible: ${snapshot.missingSelectors.join(", ")}.`
    });
  }
  if (snapshot.offscreenSelectors.length > 0) {
    findings.push({
      type: "primary-action-offscreen",
      message: `Element interactif principal hors ecran: ${snapshot.offscreenSelectors.join(", ")}.`
    });
  }
  return findings;
};

export function createAuditGuard(options) {
  const mode = options.mode;
  const allowlist = options.allowlist ?? [];
  const mockRoutes = options.mockRoutes ?? [];
  validateAllowlist(allowlist);

  if (mode !== "mocked" && mode !== "integrated") {
    throw new Error(`Mode d'audit invalide: ${mode || "absent"}. Utiliser mocked ou integrated.`);
  }

  const findings = [];
  const requests = [];
  const screenshots = [];
  const metadataByPage = new WeakMap();
  const screenshotByPage = new WeakMap();
  const routeMap = new Map(
    mockRoutes.map((route) => [`${route.method.toUpperCase()} ${route.path}`, route])
  );

  const metadataFor = (page) => metadataByPage.get(page) || createDefaultMetadata();

  const addFinding = (finding) => {
    const allowlisted = matchAllowlist(finding, allowlist);
    findings.push({
      ...finding,
      screenshot: finding.screenshot || undefined,
      allowlisted: Boolean(allowlisted),
      allowlistReason: allowlisted
        ? `${allowlisted.reason} (${allowlisted.ticket}, expiration ${allowlisted.expiresAt})`
        : undefined
    });
  };

  const setMetadata = (page, metadata) => metadataByPage.set(page, { ...metadata });

  const attachPage = (page, initialMetadata) => {
    setMetadata(page, initialMetadata);
    page.on("console", (message) => {
      if (!BLOCKING_CONSOLE_TYPES.has(message.type())) return;
      const location = message.location();
      const source = location.url ? ` (${location.url}:${location.lineNumber || 0})` : "";
      addFinding({
        type: "console-error",
        message: `${message.text()}${source}`,
        metadata: metadataFor(page),
        screenshot: screenshotByPage.get(page),
        route: metadataFor(page).route
      });
    });
    page.on("pageerror", (error) => {
      addFinding({
        type: "page-error",
        message: error.message,
        metadata: metadataFor(page),
        screenshot: screenshotByPage.get(page),
        route: metadataFor(page).route
      });
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText || "raison inconnue";
      addFinding({
        type: "request-failed",
        message: `${request.method()} ${request.url()}: ${failure}`,
        metadata: metadataFor(page),
        screenshot: screenshotByPage.get(page),
        route: isApiRequest(request.url()) ? apiPath(request.url()) : metadataFor(page).route
      });
    });
    page.on("response", (response) => {
      if (!isApiRequest(response.url()) || response.status() < 400) return;
      addFinding({
        type: "api-response-error",
        message: `HTTP ${response.status()} ${response.request().method()} ${apiPath(response.url())}`,
        metadata: metadataFor(page),
        screenshot: screenshotByPage.get(page),
        route: apiPath(response.url())
      });
    });
  };

  const attachContext = async (context, initialMetadata) => {
    if (mode === "mocked") {
      const mockedPaths = new Set(mockRoutes.map((route) => route.path));

      context.on("request", (request) => {
        if (!isApiRequest(request.url())) return;
        const requestPath = apiPath(request.url());
        const key = `${request.method().toUpperCase()} ${requestPath}`;
        if (routeMap.has(key)) return;
        let page;
        try {
          page = request.frame().page();
        } catch {
          page = undefined;
        }
        addFinding({
          type: "unmocked-api-request",
          message: `Requete API non declaree en mode mocke: ${key}.`,
          metadata: page ? metadataFor(page) : initialMetadata,
          route: requestPath
        });
      });

      for (const mockedPath of mockedPaths) {
        const exactPath = new RegExp(`${escapeRegExp(mockedPath)}$`, "u");
        await context.route(exactPath, async (route) => {
          const request = route.request();
          const requestPath = apiPath(request.url());
          const key = `${request.method().toUpperCase()} ${requestPath}`;
          const mock = routeMap.get(key);
          requests.push({ key, matched: Boolean(mock) });
          if (!mock) {
            await route.abort("blockedbyclient");
            return;
          }

          const body = typeof mock.body === "function" ? await mock.body(request) : mock.body;
          await route.fulfill({
            status: mock.status ?? 200,
            contentType: "application/json; charset=utf-8",
            body: JSON.stringify(body ?? {})
          });
        });
      }
    }

    context.on("page", (page) => attachPage(page, initialMetadata));
  };

  const capture = async (page, filePath, options = {}) => {
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    const bytes = await page.screenshot({
      animations: "disabled",
      caret: "hide",
      fullPage: options.fullPage ?? false,
      path: filePath
    });
    screenshotByPage.set(page, filePath);
    screenshots.push(filePath);
    if (bytes.byteLength < 5_000) {
      addFinding({
        type: "blank-screenshot",
        message: `Capture anormalement petite (${bytes.byteLength} octets).`,
        metadata: metadataFor(page),
        screenshot: filePath,
        route: metadataFor(page).route
      });
    }
    return filePath;
  };

  const assertPageReady = async (page, options = {}) => {
    const criticalSelectors = options.criticalSelectors ?? [];
    const primarySelectors = options.primarySelectors ?? [];
    const snapshot = await page.evaluate(
      ({ expectedSelectors, expectedPrimarySelectors }) => {
        const isVisible = (element) => {
          if (!(element instanceof HTMLElement)) return false;
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        };
        const visibleText = (element) => (element.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 180);
        const loadingNodes = Array.from(
          document.querySelectorAll('[aria-busy="true"], .screen-loading, [data-loading="true"]')
        ).filter(isVisible);
        const unavailableNodes = Array.from(document.querySelectorAll("body *")).filter((element) => {
          if (!isVisible(element) || element.children.length > 0) return false;
          return /(?:API|service|donnees?|donn[ée]es?|module).{0,40}indisponible|indisponible.{0,40}(?:API|service|donnees?|donn[ée]es?|module)/iu.test(
            visibleText(element)
          );
        });
        const missingSelectors = expectedSelectors.filter((selector) => {
          const element = document.querySelector(selector);
          return !element || !isVisible(element);
        });
        const offscreenSelectors = expectedPrimarySelectors.filter((selector) => {
          const element = document.querySelector(selector);
          if (!element || !isVisible(element)) return true;
          const rect = element.getBoundingClientRect();
          return rect.right <= 0 || rect.left >= window.innerWidth || rect.bottom <= 0 || rect.top >= window.innerHeight;
        });
        const bodyRect = document.body.getBoundingClientRect();
        return {
          bodyArea: Math.max(0, bodyRect.width) * Math.max(0, bodyRect.height),
          bodyText: document.body.innerText,
          horizontalOverflow:
            Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
          loadingLabels: loadingNodes.map(visibleText).filter(Boolean),
          unavailableLabels: unavailableNodes.map(visibleText).filter(Boolean),
          missingSelectors,
          offscreenSelectors
        };
      },
      { expectedSelectors: criticalSelectors, expectedPrimarySelectors: primarySelectors }
    );

    for (const result of inspectDomSnapshot(snapshot, { overflowLimit: options.overflowLimit })) {
      addFinding({
        ...result,
        metadata: metadataFor(page),
        screenshot: screenshotByPage.get(page),
        route: metadataFor(page).route
      });
    }
  };

  const blockingFindings = () => findings.filter((finding) => !finding.allowlisted);

  const writeReport = async (outputDir, extra = {}) => {
    const report = {
      schemaVersion: 1,
      mode,
      generatedAt: new Date().toISOString(),
      status: blockingFindings().length === 0 ? "passed" : "failed",
      findings,
      requests,
      screenshots,
      allowlist,
      ...extra
    };
    await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return report;
  };

  return {
    addFinding,
    assertPageReady,
    attachContext,
    blockingFindings,
    capture,
    findings,
    requests,
    screenshots,
    setMetadata,
    writeReport
  };
}
