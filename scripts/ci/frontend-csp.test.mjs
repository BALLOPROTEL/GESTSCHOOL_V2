import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFrontendCsp,
  frontendSecurityHeaders,
  resolveFrontendCspOrigins
} from "../../Frontend/web-admin/csp-config.mjs";

test("builds an exact production CSP without unsafe-eval or wildcards", () => {
  const origins = resolveFrontendCspOrigins({
    apiBaseUrl: "https://api.example.com/api/v1",
    storageAssetOrigin: "https://storage.example.com",
    mode: "production"
  });
  const csp = buildFrontendCsp({
    ...origins,
    includeFrameAncestors: true
  });

  assert.match(csp, /connect-src 'self' https:\/\/api\.example\.com/u);
  assert.match(csp, /img-src 'self' data: blob: https:\/\/storage\.example\.com/u);
  assert.match(csp, /frame-ancestors 'none'/u);
  assert.match(csp, /object-src 'none'/u);
  assert.match(csp, /base-uri 'self'/u);
  assert.match(csp, /form-action 'self'/u);
  assert.doesNotMatch(csp, /unsafe-eval|\*/u);
  assert.equal(frontendSecurityHeaders(csp)["X-Content-Type-Options"], "nosniff");
});

test("requires explicit HTTPS API and Storage origins outside development", () => {
  assert.throws(
    () =>
      resolveFrontendCspOrigins({
        apiBaseUrl: "https://api.example.com/api/v1",
        storageAssetOrigin: "",
        mode: "production"
      }),
    /VITE_STORAGE_ASSET_ORIGIN is required/u
  );
  assert.throws(
    () =>
      resolveFrontendCspOrigins({
        apiBaseUrl: "http://127.0.0.1:3000/api/v1",
        storageAssetOrigin: "https://storage.example.com",
        mode: "preview"
      }),
    /VITE_API_BASE_URL must use HTTPS/u
  );
});

test("allows explicit local HTTP origins only for development", () => {
  assert.deepEqual(
    resolveFrontendCspOrigins({
      apiBaseUrl: "http://127.0.0.1:3000/api/v1",
      storageAssetOrigin: "",
      mode: "development"
    }),
    {
      apiOrigin: "http://127.0.0.1:3000",
      storageOrigin: null
    }
  );
});
