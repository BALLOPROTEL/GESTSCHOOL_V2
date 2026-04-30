#!/usr/bin/env node
const { buildTestDatabaseEnv, runCommand } = require("./with-test-database.cjs");

const sequences = {
  test: [
    ["pnpm", "exec", "jest", "--config", "./test/jest-e2e.json", "--runInBand"]
  ],
  db: [
    ["pnpm", "run", "db:migrate:deploy"],
    ["pnpm", "exec", "jest", "--config", "./test/jest-e2e.json", "--runInBand"]
  ],
  fresh: [
    ["pnpm", "run", "db:generate"],
    ["pnpm", "run", "db:migrate:deploy"],
    ["pnpm", "exec", "jest", "--config", "./test/jest-e2e.json", "--runInBand"]
  ],
  status: [["pnpm", "run", "db:status"]]
};

async function main() {
  const sequenceName = process.argv[2] || "test";
  const sequence = sequences[sequenceName];
  if (!sequence) {
    console.error(`Unknown e2e database sequence: ${sequenceName}`);
    process.exit(1);
  }

  let env;
  try {
    env = buildTestDatabaseEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  for (const command of sequence) {
    const code = await runCommand(command, { env });
    if (code !== 0) {
      process.exit(code);
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
