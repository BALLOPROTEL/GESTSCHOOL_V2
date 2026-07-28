import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_POLICY_PATH = path.join(
  ROOT,
  "scripts/security/dependency-audit-exceptions.json",
);

const ALLOWED_ROOT_DEV_DEPENDENCIES = new Set([
  "@nestjs/cli",
  "@typescript-eslint/eslint-plugin",
  "@typescript-eslint/parser",
  "eslint",
  "eslint-config-prettier",
  "jest",
  "ts-jest",
  "typescript-eslint",
]);

const ALLOWED_ESLINT_CHAIN_PACKAGES = new Set([
  "@eslint-community/eslint-utils",
  "@typescript-eslint/eslint-plugin",
  "@typescript-eslint/parser",
  "@typescript-eslint/type-utils",
  "@typescript-eslint/utils",
  "eslint",
  "eslint-config-prettier",
  "typescript-eslint",
]);

const ALLOWED_JEST_CHAIN_PACKAGES = new Set([
  "@jest/core",
  "@jest/expect",
  "@jest/globals",
  "@jest/reporters",
  "@jest/transform",
  "babel-jest",
  "babel-plugin-istanbul",
  "brace-expansion",
  "glob",
  "jest",
  "jest-circus",
  "jest-cli",
  "jest-config",
  "jest-resolve-dependencies",
  "jest-runner",
  "jest-runtime",
  "jest-snapshot",
  "minimatch",
  "test-exclude",
  "ts-jest",
]);

function readJson(filePath, label) {
  if (!filePath) {
    throw new Error(`${label} path is required.`);
  }

  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`${label} is unavailable: ${error.message}`);
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
}

function getArgument(name, args = process.argv.slice(2)) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function getAdvisories(report, label) {
  if (
    !report ||
    typeof report !== "object" ||
    !report.metadata ||
    !report.metadata.vulnerabilities ||
    !report.advisories ||
    typeof report.advisories !== "object"
  ) {
    throw new Error(`${label} does not have the expected pnpm audit JSON shape.`);
  }

  return Object.values(report.advisories);
}

function getAdvisoryId(advisory) {
  return advisory.github_advisory_id || advisory.githubAdvisoryId || "";
}

function getRootDependency(auditPath) {
  const [, rootDependency] = auditPath.split(">");
  return rootDependency || "";
}

function classifyAllowedChain(auditPath) {
  const packages = auditPath.split(">").slice(1);

  if (
    JSON.stringify(packages) ===
    JSON.stringify([
      "@nestjs/cli",
      "fork-ts-checker-webpack-plugin",
      "minimatch",
      "brace-expansion",
    ])
  ) {
    return "nestjs-cli";
  }

  if (
    auditPath.startsWith("Backend__api>") &&
    ["jest", "ts-jest"].includes(packages[0]) &&
    packages.includes("jest") &&
    packages.includes("babel-plugin-istanbul") &&
    packages.includes("test-exclude") &&
    packages.every((packageName) =>
      ALLOWED_JEST_CHAIN_PACKAGES.has(packageName),
    ) &&
    packages.slice(-2).join(">") === "minimatch>brace-expansion" &&
    packages
      .slice(packages.indexOf("test-exclude") + 1, -2)
      .every((packageName) => packageName === "glob") &&
    auditPath.endsWith(">minimatch>brace-expansion")
  ) {
    return "jest";
  }

  const eslintIndex = packages.lastIndexOf("eslint");
  const eslintTail = packages.slice(eslintIndex + 1).join(">");
  if (
    (auditPath.startsWith("Backend__api>") ||
      auditPath.startsWith("Frontend__web-admin>")) &&
    eslintIndex >= 0 &&
    packages
      .slice(0, eslintIndex + 1)
      .every((packageName) => ALLOWED_ESLINT_CHAIN_PACKAGES.has(packageName)) &&
    [
      "minimatch>brace-expansion",
      "@eslint/config-array>minimatch>brace-expansion",
      "@eslint/eslintrc>minimatch>brace-expansion",
    ].includes(eslintTail)
  ) {
    return "eslint";
  }

  return undefined;
}

function loadWorkspaceManifests(root = ROOT) {
  return [
    readJson(path.join(root, "Backend/api/package.json"), "API package manifest"),
    readJson(
      path.join(root, "Frontend/web-admin/package.json"),
      "Web Admin package manifest",
    ),
  ];
}

function assertDevDependency(rootDependency, manifests) {
  if (!ALLOWED_ROOT_DEV_DEPENDENCIES.has(rootDependency)) {
    throw new Error(
      `Unexpected root dependency in exception chain: ${rootDependency}.`,
    );
  }

  const appearsInProduction = manifests.some(
    (manifest) => manifest.dependencies?.[rootDependency],
  );
  const appearsInDevelopment = manifests.some(
    (manifest) => manifest.devDependencies?.[rootDependency],
  );

  if (appearsInProduction || !appearsInDevelopment) {
    throw new Error(
      `${rootDependency} is not exclusively declared as a development dependency.`,
    );
  }
}

function assertPolicy(policy, now) {
  if (policy?.schemaVersion !== 1 || !Array.isArray(policy.exceptions)) {
    throw new Error("Dependency audit exception policy is invalid.");
  }
  if (policy.exceptions.length !== 1) {
    throw new Error("Exactly one temporary dependency audit exception is allowed.");
  }

  const exception = policy.exceptions[0];
  const expected = {
    id: "GHSA-mh99-v99m-4gvg",
    package: "brace-expansion",
    version: "1.1.16",
    scope: "devDependencies",
    expiresAt: "2026-08-11T23:59:59.999Z",
  };

  for (const [field, value] of Object.entries(expected)) {
    if (exception[field] !== value) {
      throw new Error(`Unexpected exception ${field}: ${exception[field]}.`);
    }
  }

  const allowedChains = [...exception.allowedChains].sort();
  if (
    JSON.stringify(allowedChains) !==
    JSON.stringify(["eslint", "jest", "nestjs-cli"])
  ) {
    throw new Error("Exception chains differ from the approved inventory.");
  }

  const expiration = new Date(exception.expiresAt);
  if (Number.isNaN(expiration.getTime())) {
    throw new Error("Exception expiration is invalid.");
  }
  if (now.getTime() > expiration.getTime()) {
    throw new Error(
      `Dependency audit exception expired at ${exception.expiresAt}.`,
    );
  }

  return exception;
}

export function evaluateAuditPolicy({
  productionReport,
  fullReport,
  policy,
  now = new Date(),
  manifests = loadWorkspaceManifests(),
}) {
  const exception = assertPolicy(policy, now);
  const productionAdvisories = getAdvisories(
    productionReport,
    "Production audit report",
  );
  const fullAdvisories = getAdvisories(fullReport, "Full audit report");

  if (productionAdvisories.length > 0) {
    const ids = productionAdvisories.map(getAdvisoryId).filter(Boolean);
    throw new Error(
      `Production dependencies must have no advisories; found: ${ids.join(", ") || "unknown"}.`,
    );
  }

  const postcssAdvisories = fullAdvisories.filter(
    (advisory) => advisory.module_name === "postcss",
  );
  if (postcssAdvisories.length > 0) {
    throw new Error(
      `PostCSS advisories remain: ${postcssAdvisories
        .map((advisory) => getAdvisoryId(advisory) || "unknown")
        .join(", ")}.`,
    );
  }

  const highOrCritical = fullAdvisories.filter((advisory) =>
    ["high", "critical"].includes(advisory.severity),
  );
  const exceptionalAdvisories = highOrCritical.filter(
    (advisory) => getAdvisoryId(advisory) === exception.id,
  );
  const unexpectedAdvisories = highOrCritical.filter(
    (advisory) => getAdvisoryId(advisory) !== exception.id,
  );

  if (unexpectedAdvisories.length > 0) {
    throw new Error(
      `Unexpected high/critical advisories: ${unexpectedAdvisories
        .map((advisory) => `${getAdvisoryId(advisory)}:${advisory.module_name}`)
        .join(", ")}.`,
    );
  }
  if (exceptionalAdvisories.length !== 1) {
    throw new Error(
      `Expected exactly one ${exception.id} advisory, found ${exceptionalAdvisories.length}.`,
    );
  }

  const advisory = exceptionalAdvisories[0];
  if (advisory.module_name !== exception.package) {
    throw new Error(
      `Exception package mismatch: ${advisory.module_name || "missing"}.`,
    );
  }

  const findings = advisory.findings || [];
  if (findings.length === 0) {
    throw new Error("The exceptional advisory has no dependency findings.");
  }

  const observedChains = new Set();
  for (const finding of findings) {
    if (finding.version !== exception.version) {
      throw new Error(
        `Exception does not allow ${exception.package}@${finding.version}.`,
      );
    }

    for (const auditPath of finding.paths || []) {
      const chain = classifyAllowedChain(auditPath);
      if (!chain || !exception.allowedChains.includes(chain)) {
        throw new Error(`Unexpected exception dependency chain: ${auditPath}.`);
      }
      assertDevDependency(getRootDependency(auditPath), manifests);
      observedChains.add(chain);
    }
  }

  for (const expectedChain of exception.allowedChains) {
    if (!observedChains.has(expectedChain)) {
      throw new Error(`Approved chain is no longer present: ${expectedChain}.`);
    }
  }

  const lowAdvisories = fullAdvisories.filter(
    (advisory) => advisory.severity === "low",
  );

  return {
    exception,
    observedChains: [...observedChains].sort(),
    lowAdvisories: lowAdvisories.map((item) => ({
      id: getAdvisoryId(item),
      package: item.module_name,
      versions: (item.findings || []).map((finding) => finding.version),
    })),
  };
}

function main() {
  const productionReport = readJson(
    getArgument("--prod"),
    "Production audit report",
  );
  const fullReport = readJson(getArgument("--full"), "Full audit report");
  const policy = readJson(
    getArgument("--policy") || DEFAULT_POLICY_PATH,
    "Dependency audit exception policy",
  );
  const nowValue = process.env.AUDIT_POLICY_NOW;
  const now = nowValue ? new Date(nowValue) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error("AUDIT_POLICY_NOW is not a valid date.");
  }

  const result = evaluateAuditPolicy({
    productionReport,
    fullReport,
    policy,
    now,
  });

  console.log("Dependency audit policy: PASS");
  console.log("Production advisories: 0");
  console.log(
    `Temporary exception: ${result.exception.id} ${result.exception.package}@${result.exception.version}`,
  );
  console.log(`Owner: ${policy.owner}`);
  console.log(`Reason: ${result.exception.reason}`);
  console.log(`Expires: ${result.exception.expiresAt}`);
  console.log(`Observed dev-only chains: ${result.observedChains.join(", ")}`);
  console.log(
    "Compatible fixes verified: no PostCSS advisory and no vulnerable brace-expansion 5.x finding.",
  );
  if (result.lowAdvisories.length > 0) {
    console.log(
      `Non-blocking low advisories: ${result.lowAdvisories
        .map((item) => `${item.id}:${item.package}@${item.versions.join("/")}`)
        .join(", ")}`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`Dependency audit policy: FAIL - ${error.message}`);
    process.exitCode = 1;
  }
}
