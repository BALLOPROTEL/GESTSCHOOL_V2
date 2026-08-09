import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAuditPolicy } from "./dependency-audit-policy.mjs";

const policy = {
  schemaVersion: 1,
  owner: "GestSchool maintainers",
  exceptions: [],
};

function report(advisories = []) {
  return {
    advisories: Object.fromEntries(
      advisories.map((advisory, index) => [String(index + 1), advisory]),
    ),
    metadata: {
      vulnerabilities: {
        info: 0,
        low: advisories.filter((item) => item.severity === "low").length,
        moderate: advisories.filter((item) => item.severity === "moderate")
          .length,
        high: advisories.filter((item) => item.severity === "high").length,
        critical: advisories.filter((item) => item.severity === "critical")
          .length,
      },
    },
  };
}

function advisory({
  id = "GHSA-test-advisory",
  packageName = "test-package",
  severity = "high",
  version = "1.0.0",
} = {}) {
  return {
    github_advisory_id: id,
    module_name: packageName,
    severity,
    findings: [{ version, paths: [`tool>${packageName}`] }],
  };
}

test("accepts clean production and full dependency reports", () => {
  const result = evaluateAuditPolicy({
    productionReport: report(),
    fullReport: report(),
    policy,
  });

  assert.deepEqual(result.lowAdvisories, []);
});

test("reports a low development advisory without failing", () => {
  const result = evaluateAuditPolicy({
    productionReport: report(),
    fullReport: report([
      advisory({
        id: "GHSA-low-test",
        packageName: "dev-tool",
        severity: "low",
        version: "2.0.0",
      }),
    ]),
    policy,
  });

  assert.deepEqual(result.lowAdvisories, [
    { id: "GHSA-low-test", package: "dev-tool", versions: ["2.0.0"] },
  ]);
});

test("rejects every production advisory", () => {
  assert.throws(
    () =>
      evaluateAuditPolicy({
        productionReport: report([advisory({ severity: "moderate" })]),
        fullReport: report(),
        policy,
      }),
    /Production dependencies must have no advisories/,
  );
});

test("rejects every high or critical development advisory", () => {
  for (const severity of ["high", "critical"]) {
    assert.throws(
      () =>
        evaluateAuditPolicy({
          productionReport: report(),
          fullReport: report([advisory({ severity })]),
          policy,
        }),
      /Unexpected high\/critical advisories/,
    );
  }
});

test("rejects every remaining PostCSS advisory regardless of severity", () => {
  assert.throws(
    () =>
      evaluateAuditPolicy({
        productionReport: report(),
        fullReport: report([
          advisory({
            id: "GHSA-postcss-test",
            packageName: "postcss",
            severity: "moderate",
            version: "8.5.22",
          }),
        ]),
        policy,
      }),
    /PostCSS advisories remain/,
  );
});

test("rejects temporary exception entries", () => {
  assert.throws(
    () =>
      evaluateAuditPolicy({
        productionReport: report(),
        fullReport: report(),
        policy: {
          ...policy,
          exceptions: [{ id: "GHSA-temporary" }],
        },
      }),
    /exceptions are not currently allowed/,
  );
});

test("rejects an unavailable or malformed report", () => {
  assert.throws(
    () =>
      evaluateAuditPolicy({
        productionReport: {},
        fullReport: report(),
        policy,
      }),
    /expected pnpm audit JSON shape/,
  );
});
