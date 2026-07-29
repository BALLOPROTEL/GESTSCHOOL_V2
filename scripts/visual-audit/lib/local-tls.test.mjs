import assert from "node:assert/strict";
import test from "node:test";

import { resolveChromiumLaunchOptions } from "./local-tls.mjs";

const pin = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

test("accepts one explicitly pinned local certificate only in integrated RC mode", () => {
  assert.deepEqual(
    resolveChromiumLaunchOptions({
      mode: "integrated",
      baseUrl: "https://gestschool.local:5443",
      runtimeEnvironment: "rc",
      spkiSha256: pin,
      hostResolverRules: "MAP gestschool.local 127.0.0.1"
    }),
    {
      headless: true,
      args: [
        `--ignore-certificate-errors-spki-list=${pin}`,
        "--host-resolver-rules=MAP gestschool.local 127.0.0.1"
      ]
    }
  );
});

test("refuses certificate bypasses outside a local integrated RC", () => {
  for (const candidate of [
    {
      mode: "mocked",
      baseUrl: "https://gestschool.local",
      runtimeEnvironment: "rc"
    },
    {
      mode: "integrated",
      baseUrl: "https://gestschool.example.com",
      runtimeEnvironment: "rc"
    },
    {
      mode: "integrated",
      baseUrl: "https://gestschool.local",
      runtimeEnvironment: "production"
    }
  ]) {
    assert.throws(
      () => resolveChromiumLaunchOptions({ ...candidate, spkiSha256: pin }),
      /allowed only/u
    );
  }
});

test("uses normal TLS verification when no local pin is configured", () => {
  assert.deepEqual(
    resolveChromiumLaunchOptions({
      mode: "integrated",
      baseUrl: "https://gestschool.example.com",
      runtimeEnvironment: "production"
    }),
    { headless: true }
  );
});
