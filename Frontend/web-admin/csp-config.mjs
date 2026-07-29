const HTTPS_MODES = new Set(["production", "preview", "staging"]);

const originFromUrl = (rawValue, variableName, mode, required) => {
  const value = String(rawValue || "").trim();
  if (!value) {
    if (required) {
      throw new Error(`${variableName} is required for the ${mode} frontend CSP.`);
    }
    return null;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${variableName} must be an absolute HTTP(S) URL.`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${variableName} must use HTTP or HTTPS.`);
  }
  if (HTTPS_MODES.has(mode) && parsed.protocol !== "https:") {
    throw new Error(`${variableName} must use HTTPS in ${mode}.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${variableName} must not contain credentials.`);
  }
  return parsed.origin;
};

export const resolveFrontendCspOrigins = ({
  apiBaseUrl,
  storageAssetOrigin,
  mode
}) => {
  const normalizedMode = String(mode || "production").trim().toLowerCase();
  const strict = HTTPS_MODES.has(normalizedMode);
  return {
    apiOrigin: originFromUrl(apiBaseUrl, "VITE_API_BASE_URL", normalizedMode, strict),
    storageOrigin: originFromUrl(
      storageAssetOrigin,
      "VITE_STORAGE_ASSET_ORIGIN",
      normalizedMode,
      strict
    )
  };
};

export const buildFrontendCsp = ({
  apiOrigin,
  storageOrigin,
  includeFrameAncestors = false,
  upgradeInsecureRequests = true
}) => {
  const connectSources = ["'self'", apiOrigin].filter(Boolean);
  const imageSources = ["'self'", "data:", "blob:", storageOrigin].filter(Boolean);
  const directives = [
    ["default-src", "'self'"],
    ["base-uri", "'self'"],
    ["object-src", "'none'"],
    ["form-action", "'self'"],
    ["script-src", "'self'"],
    ["style-src", "'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    ["font-src", "'self'", "data:", "https://fonts.gstatic.com"],
    ["img-src", ...new Set(imageSources)],
    ["connect-src", ...new Set(connectSources)],
    ["media-src", "'self'"],
    ["manifest-src", "'self'"],
    ["worker-src", "'self'", "blob:"],
    ["frame-src", "'none'"]
  ];
  if (includeFrameAncestors) directives.splice(3, 0, ["frame-ancestors", "'none'"]);
  if (upgradeInsecureRequests) directives.push(["upgrade-insecure-requests"]);
  return directives.map((parts) => parts.join(" ")).join("; ");
};

export const frontendSecurityHeaders = (csp) => ({
  "Content-Security-Policy": csp,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  "X-Frame-Options": "DENY"
});
