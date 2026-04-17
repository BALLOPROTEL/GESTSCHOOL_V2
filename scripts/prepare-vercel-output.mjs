import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(repoRoot, "apps/web-admin/dist");
const target = resolve(repoRoot, "dist");

if (!existsSync(source)) {
  throw new Error(`Web Admin build output not found: ${source}`);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });

console.log(`Prepared Vercel output directory: ${target}`);
