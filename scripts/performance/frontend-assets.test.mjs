import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const root = resolve("Frontend/web-admin");
const publicFile = (name) => resolve(root, "public", name);

test("les médias critiques restent sous leurs budgets", () => {
  assert.ok(statSync(publicFile("page-de-connexion.webp")).size <= 150_000);
  assert.ok(statSync(publicFile("logo.webp")).size <= 20_000);
  assert.ok(statSync(publicFile("apple-touch-icon.png")).size <= 40_000);

  for (const icon of ["anglais.png", "arabe.png", "france.png", "mode-clair.png", "mode-sombre.png"]) {
    assert.ok(statSync(publicFile(icon)).size <= 5_000, `${icon} dépasse 5 kB`);
  }
});

test("les médias historiques surdimensionnés ne sont plus référencés", () => {
  assert.equal(existsSync(publicFile("pageDeConnexion.png")), false);
  assert.equal(existsSync(publicFile("logo.png")), false);
  assert.match(
    readFileSync(resolve(root, "src/styles/auth.css"), "utf8"),
    /url\("\/page-de-connexion\.webp"\)/u
  );
  assert.match(readFileSync(resolve(root, "src/app/App.tsx"), "utf8"), /logoSrc="\/logo\.webp"/u);
});
