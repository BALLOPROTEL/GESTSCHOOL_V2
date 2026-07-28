import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAuditPolicy } from "./dependency-audit-policy.mjs";

const exception = {
  id: "GHSA-mh99-v99m-4gvg",
  package: "brace-expansion",
  version: "1.1.16",
  scope: "devDependencies",
  expiresAt: "2026-08-11T23:59:59.999Z",
  reason: "Test fixture",
  allowedChains: ["eslint", "jest", "nestjs-cli"],
};

const policy = {
  schemaVersion: 1,
  owner: "GestSchool maintainers",
  exceptions: [exception],
};

const manifests = [
  {
    devDependencies: {
      "@nestjs/cli": "11.0.24",
      eslint: "9.39.2",
      jest: "30.4.2",
    },
  },
];

function report(advisories = []) {
  return {
    advisories: Object.fromEntries(
      advisories.map((advisory, index) => [String(index + 1), advisory]),
    ),
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: advisories.filter((item) => item.severity === "high").length,
        critical: advisories.filter((item) => item.severity === "critical")
          .length,
      },
    },
  };
}

function exceptionalAdvisory(overrides = {}) {
  return {
    github_advisory_id: exception.id,
    module_name: exception.package,
    severity: "high",
    findings: [
      {
        version: exception.version,
        paths: [
          "Backend__api>eslint>minimatch>brace-expansion",
          "Backend__api>jest>@jest/core>@jest/transform>babel-plugin-istanbul>test-exclude>minimatch>brace-expansion",
          "Backend__api>@nestjs/cli>fork-ts-checker-webpack-plugin>minimatch>brace-expansion",
        ],
      },
    ],
    ...overrides,
  };
}

const validNow = new Date("2026-07-28T12:00:00.000Z");

test("accepts only the approved dev-only advisory before expiration", () => {
  const result = evaluateAuditPolicy({
    productionReport: report(),
    fullReport: report([exceptionalAdvisory()]),
    policy,
    now: validNow,
    manifests,
  });

  assert.deepEqual(result.observedChains, ["eslint", "jest", "nestjs-cli"]);
});

test("rejects the exception in production dependencies", () => {
  assert.throws(
    () =>
      evaluateAuditPolicy({
        productionReport: report([exceptionalAdvisory()]),
        fullReport: report([exceptionalAdvisory()]),
        policy,
        now: validNow,
        manifests,
      }),
    /Production dependencies must have no advisories/,
  );
});

test("rejects another version or an unexpected dependency chain", () => {
  assert.throws(
    () =>
      evaluateAuditPolicy({
        productionReport: report(),
        fullReport: report([
          exceptionalAdvisory({
            findings: [
              {
                version: "5.0.7",
                paths: [
                  "Backend__api>jest>minimatch>brace-expansion",
                ],
              },
            ],
          }),
        ]),
        policy,
        now: validNow,
        manifests,
      }),
    /does not allow brace-expansion@5.0.7/,
  );

  assert.throws(
    () =>
      evaluateAuditPolicy({
        productionReport: report(),
        fullReport: report([
          exceptionalAdvisory({
            findings: [
              {
                version: "1.1.16",
                paths: [
                  "Backend__api>unknown-tool>minimatch>brace-expansion",
                ],
              },
            ],
          }),
        ]),
        policy,
        now: validNow,
        manifests,
      }),
    /Unexpected exception dependency chain/,
  );

  assert.throws(
    () =>
      evaluateAuditPolicy({
        productionReport: report(),
        fullReport: report([
          exceptionalAdvisory({
            findings: [
              {
                version: "1.1.16",
                paths: [
                  "Backend__api>jest>unexpected-plugin>babel-plugin-istanbul>test-exclude>minimatch>brace-expansion",
                ],
              },
            ],
          }),
        ]),
        policy,
        now: validNow,
        manifests,
      }),
    /Unexpected exception dependency chain/,
  );
});

test("rejects every other high or critical advisory", () => {
  assert.throws(
    () =>
      evaluateAuditPolicy({
        productionReport: report(),
        fullReport: report([
          exceptionalAdvisory(),
          {
            github_advisory_id: "GHSA-unrelated-test",
            module_name: "unrelated-package",
            severity: "high",
            findings: [{ version: "1.0.0", paths: ["tool>unrelated-package"] }],
          },
        ]),
        policy,
        now: validNow,
        manifests,
      }),
    /Unexpected high\/critical advisories/,
  );
});

test("rejects every remaining PostCSS advisory regardless of severity", () => {
  assert.throws(
    () =>
      evaluateAuditPolicy({
        productionReport: report(),
        fullReport: report([
          exceptionalAdvisory(),
          {
            github_advisory_id: "GHSA-postcss-test",
            module_name: "postcss",
            severity: "low",
            findings: [{ version: "8.5.10", paths: ["vite>postcss"] }],
          },
        ]),
        policy,
        now: validNow,
        manifests,
      }),
    /PostCSS advisories remain/,
  );
});

test("rejects an unavailable or malformed report", () => {
  assert.throws(
    () =>
      evaluateAuditPolicy({
        productionReport: {},
        fullReport: report([exceptionalAdvisory()]),
        policy,
        now: validNow,
        manifests,
      }),
    /expected pnpm audit JSON shape/,
  );
});

test("fails strictly after 2026-08-11", () => {
  assert.throws(
    () =>
      evaluateAuditPolicy({
        productionReport: report(),
        fullReport: report([exceptionalAdvisory()]),
        policy,
        now: new Date("2026-08-12T00:00:00.000Z"),
        manifests,
      }),
    /expired at 2026-08-11/,
  );
});
