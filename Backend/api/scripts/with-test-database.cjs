#!/usr/bin/env node
const { spawn } = require("node:child_process");

function buildTestDatabaseEnv(baseEnv = process.env) {
  const testDatabaseUrl = (baseEnv.TEST_DATABASE_URL || "").trim();
  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL is required for backend e2e commands.");
  }

  if (!looksLikeDedicatedTestDatabase(testDatabaseUrl)) {
    throw new Error(
      "TEST_DATABASE_URL must point to a dedicated disposable database whose name or host contains test, e2e or jest."
    );
  }

  const testDirectUrl = (baseEnv.TEST_DIRECT_URL || "").trim() || testDatabaseUrl;
  if (!looksLikeDedicatedTestDatabase(testDirectUrl)) {
    throw new Error(
      "TEST_DIRECT_URL must also point to a dedicated disposable database when provided."
    );
  }

  return {
    ...baseEnv,
    DATABASE_URL: testDatabaseUrl,
    DIRECT_URL: testDirectUrl
  };
}

function runCommand(commandArgs, options = {}) {
  if (commandArgs.length === 0) {
    throw new Error("A command is required.");
  }

  const child = spawn(commandArgs[0], commandArgs.slice(1), {
    cwd: options.cwd || process.cwd(),
    env: options.env || buildTestDatabaseEnv(),
    shell: false,
    stdio: "inherit"
  });

  return new Promise((resolve, reject) => {
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Command interrupted by signal ${signal}.`));
        return;
      }
      resolve(code || 0);
    });

    child.on("error", reject);
  });
}

function looksLikeDedicatedTestDatabase(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    const databaseName = parsed.pathname.replace(/^\//, "").toLowerCase();
    const host = parsed.hostname.toLowerCase();
    return [databaseName, host].some(
      (value) => value.includes("test") || value.includes("e2e") || value.includes("jest")
    );
  } catch {
    const normalized = databaseUrl.toLowerCase();
    return normalized.includes("test") || normalized.includes("e2e") || normalized.includes("jest");
  }
}

async function main() {
  const separatorIndex = process.argv.indexOf("--");
  const commandArgs =
    separatorIndex >= 0 ? process.argv.slice(separatorIndex + 1) : process.argv.slice(2);

  try {
    const code = await runCommand(commandArgs, {
      env: buildTestDatabaseEnv()
    });
    process.exit(code);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (require.main === module) {
  void main();
}

module.exports = {
  buildTestDatabaseEnv,
  looksLikeDedicatedTestDatabase,
  runCommand
};
