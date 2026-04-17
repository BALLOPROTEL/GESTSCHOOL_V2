import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const source = resolve("apps/web-admin/dist");
const target = resolve("dist");

if (!existsSync(source)) {
  throw new Error(`Web Admin build output not found: ${source}`);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });

console.log(`Prepared Vercel output directory: ${target}`);
