import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_POLICY_PATH = path.join(
  ROOT,
  "scripts/security/dependency-audit-exceptions.json",
);

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

function assertPolicy(policy) {
  if (policy?.schemaVersion !== 1 || !Array.isArray(policy.exceptions)) {
    throw new Error("Dependency audit exception policy is invalid.");
  }
  if (policy.exceptions.length !== 0) {
    throw new Error("Dependency audit exceptions are not currently allowed.");
  }
}

export function evaluateAuditPolicy({
  productionReport,
  fullReport,
  policy,
}) {
  assertPolicy(policy);
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
  if (highOrCritical.length > 0) {
    throw new Error(
      `Unexpected high/critical advisories: ${highOrCritical
        .map((advisory) => `${getAdvisoryId(advisory)}:${advisory.module_name}`)
        .join(", ")}.`,
    );
  }

  const lowAdvisories = fullAdvisories.filter(
    (advisory) => advisory.severity === "low",
  );

  return {
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

  const result = evaluateAuditPolicy({
    productionReport,
    fullReport,
    policy,
  });

  console.log("Dependency audit policy: PASS");
  console.log("Production advisories: 0");
  console.log("Temporary exceptions: 0");
  console.log(
    "Compatible fixes verified: no PostCSS advisory and no high/critical advisory.",
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
