// @ts-check

import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const distRoot = path.resolve("Frontend/web-admin/dist");
const indexHtml = await readFile(path.join(distRoot, "index.html"), "utf8");
const initialScript = /<script[^>]+src="([^"]+)"/u.exec(indexHtml)?.[1];
const initialStyles = [...indexHtml.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/gu)].map(
  (match) => match[1]
);
if (!initialScript || initialStyles.length === 0) {
  throw new Error("Le build frontend ne déclare pas ses assets initiaux attendus.");
}

const collectFiles = async (directory, prefix = "") => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path.join(directory, entry.name), relative)));
    else files.push(relative);
  }
  return files;
};

const assetMetrics = async (relativePath) => {
  const normalized = relativePath.replace(/^\//u, "");
  const buffer = await readFile(path.join(distRoot, normalized));
  return {
    gzipBytes: gzipSync(buffer, { level: 9 }).byteLength,
    path: normalized,
    rawBytes: buffer.byteLength
  };
};

const allFiles = await collectFiles(distRoot);
const measured = await Promise.all(
  allFiles
    .filter((file) => /\.(?:css|js|png|webp|woff2)$/u.test(file))
    .map((file) => assetMetrics(file))
);
const initial = await Promise.all([initialScript, ...initialStyles].map((file) => assetMetrics(file)));
const byPath = new Map(measured.map((item) => [item.path, item]));
const required = (file) => {
  const metric = byPath.get(file);
  if (!metric) throw new Error(`Asset critique absent du build: ${file}`);
  return metric;
};

const budgets = {
  initialCssGzipBytes: 75_000,
  initialJsGzipBytes: 145_000,
  loginBackgroundBytes: 150_000,
  logoBytes: 20_000
};
const summary = {
  budgets,
  chunks: {
    css: measured.filter((item) => item.path.endsWith(".css")).length,
    js: measured.filter((item) => item.path.endsWith(".js")).length
  },
  initial: {
    gzipBytes: initial.reduce((total, item) => total + item.gzipBytes, 0),
    rawBytes: initial.reduce((total, item) => total + item.rawBytes, 0),
    stylesGzipBytes: initial.filter((item) => item.path.endsWith(".css")).reduce((total, item) => total + item.gzipBytes, 0),
    scriptGzipBytes: initial.filter((item) => item.path.endsWith(".js")).reduce((total, item) => total + item.gzipBytes, 0)
  },
  top20: [...measured].sort((left, right) => right.rawBytes - left.rawBytes).slice(0, 20)
};

const failures = [];
if (summary.initial.scriptGzipBytes > budgets.initialJsGzipBytes) {
  failures.push(`JS initial gzip ${summary.initial.scriptGzipBytes} > ${budgets.initialJsGzipBytes}`);
}
if (summary.initial.stylesGzipBytes > budgets.initialCssGzipBytes) {
  failures.push(`CSS initial gzip ${summary.initial.stylesGzipBytes} > ${budgets.initialCssGzipBytes}`);
}
if (required("page-de-connexion.webp").rawBytes > budgets.loginBackgroundBytes) {
  failures.push("Le fond de connexion dépasse son budget.");
}
if (required("logo.webp").rawBytes > budgets.logoBytes) {
  failures.push("Le logo dépasse son budget.");
}

const outputPath = process.env.FRONTEND_BUNDLE_REPORT;
if (outputPath) await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) {
  console.error(`Budgets frontend dépassés:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
}
