// @ts-check

import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { createAuditGuard, inspectDomSnapshot, matchAllowlist } from "./audit-guard.mjs";

const metadata = {
  workflow: "mechanism-test",
  route: "/students",
  viewport: "mobile-large",
  theme: "light",
  language: "fr"
};

class FakeContext extends EventEmitter {
  routes = [];

  async route(matcher, handler) {
    this.routes.push({ matcher, handler });
  }
}

class FakePage extends EventEmitter {}

async function attachFakePage(guard) {
  const context = new FakeContext();
  await guard.attachContext(context, metadata);
  const page = new FakePage();
  context.emit("page", page);
  return { context, page };
}

test("bloque une reponse API 500 observee par le collecteur", async () => {
  const guard = createAuditGuard({ mode: "mocked" });
  const { page } = await attachFakePage(guard);
  page.emit("response", {
    url: () => "http://127.0.0.1:5180/api/v1/students",
    status: () => 500,
    request: () => ({ method: () => "GET" })
  });
  assert.equal(guard.blockingFindings().length, 1);
  assert.equal(guard.blockingFindings()[0].type, "api-response-error");
});

test("bloque une route API non mockee sans interception API generique", async () => {
  const guard = createAuditGuard({
    mode: "mocked",
    mockRoutes: [{ method: "GET", path: "/api/v1/health/live", body: { status: "ok" } }]
  });
  const { context, page } = await attachFakePage(guard);
  context.emit("request", {
    url: () => "http://127.0.0.1:5180/api/v1/unknown",
    method: () => "GET",
    frame: () => ({ page: () => page })
  });
  assert.equal(guard.blockingFindings().length, 1);
  assert.equal(guard.blockingFindings()[0].type, "unmocked-api-request");
  assert.equal(context.routes.length, 1);
  assert.ok(context.routes[0].matcher instanceof RegExp);
  assert.match(context.routes[0].matcher.source, /health\\\/live\$/u);
});

test("bloque les evenements console et pageerror observes", async () => {
  const guard = createAuditGuard({ mode: "mocked" });
  const { page } = await attachFakePage(guard);
  page.emit("console", {
    type: () => "error",
    text: () => "React invariant",
    location: () => ({ url: "http://127.0.0.1:5180/assets/index.js", lineNumber: 42 })
  });
  page.emit("pageerror", new Error("Unhandled TypeError"));
  assert.deepEqual(
    guard.blockingFindings().map((finding) => finding.type),
    ["console-error", "page-error"]
  );
});

test("detecte loading bloque, overflow et selecteur critique absent", () => {
  const findings = inspectDomSnapshot({
    bodyArea: 300_000,
    bodyText: "Chargement",
    horizontalOverflow: 32,
    loadingLabels: ["Chargement du module"],
    unavailableLabels: [],
    missingSelectors: [".screen-host"],
    offscreenSelectors: []
  });
  assert.deepEqual(
    findings.map((finding) => finding.type),
    ["horizontal-overflow", "loading-stuck", "missing-critical-selector"]
  );
});

test("une allowlist precise ne masque pas une autre erreur", () => {
  const entry = {
    type: "console-error",
    route: "/students",
    messagePattern: "Known warning 42",
    reason: "Correction planifiee",
    expiresAt: "2099-12-31",
    ticket: "LOT-7-42"
  };
  assert.ok(
    matchAllowlist(
      { type: "console-error", route: "/students", message: "Known warning 42", metadata },
      [entry]
    )
  );
  assert.equal(
    matchAllowlist(
      { type: "console-error", route: "/students", message: "Different critical error", metadata },
      [entry]
    ),
    undefined
  );
});

test("refuse les allowlists incompletes ou expirees", () => {
  assert.throws(
    () =>
      createAuditGuard({
        mode: "mocked",
        allowlist: [
          {
            type: "console-error",
            route: "/students",
            messagePattern: "warning",
            reason: "temporaire",
            expiresAt: "2020-01-01",
            ticket: "LOT-7-old"
          }
        ]
      }),
    /expiree/u
  );
});
