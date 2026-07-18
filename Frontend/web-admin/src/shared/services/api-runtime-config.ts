const DEFAULT_LOCAL_API_BASE_URL = "/api/v1";

export type ApiRuntimeConfigOptions = {
  configuredBaseUrl?: string;
  mode: string;
};

const configurationError = (message: string): Error =>
  new Error(`[web-admin runtime] ${message}`);

const normalizeRelativeApiBaseUrl = (value: string): string | null => {
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  const normalized = value.replace(/\/+$/, "");
  return normalized || null;
};

const parseAbsoluteApiBaseUrl = (value: string): URL => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw configurationError("VITE_API_BASE_URL doit être une URL HTTP(S) valide.");
  }

  if (!new Set(["http:", "https:"]).has(parsed.protocol)) {
    throw configurationError("VITE_API_BASE_URL doit utiliser HTTP ou HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw configurationError("VITE_API_BASE_URL ne doit contenir aucun identifiant.");
  }
  if (parsed.search || parsed.hash) {
    throw configurationError("VITE_API_BASE_URL ne doit contenir ni query string ni fragment.");
  }
  return parsed;
};

const normalizeAbsoluteApiBaseUrl = (parsed: URL): string =>
  parsed.toString().replace(/\/+$/, "");

const isLocalMode = (mode: string): boolean => mode === "development";
const isTestMode = (mode: string): boolean => mode === "test";
const isLoopbackHost = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  return (
    normalized === "localhost" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized.startsWith("127.")
  );
};

export const resolveApiBaseUrl = ({
  configuredBaseUrl,
  mode
}: ApiRuntimeConfigOptions): string => {
  const configured = configuredBaseUrl?.trim() || "";

  if (!configured) {
    if (isLocalMode(mode) || isTestMode(mode)) {
      return DEFAULT_LOCAL_API_BASE_URL;
    }
    throw configurationError(
      `VITE_API_BASE_URL est obligatoire pour le mode ${mode || "production"}.`
    );
  }

  const relative = normalizeRelativeApiBaseUrl(configured);
  if (relative) {
    if (isLocalMode(mode) || isTestMode(mode)) return relative;
    throw configurationError(
      "VITE_API_BASE_URL doit être une URL HTTPS absolue hors développement et test."
    );
  }

  const parsed = parseAbsoluteApiBaseUrl(configured);
  const loopback = isLoopbackHost(parsed.hostname);

  if (isLocalMode(mode)) {
    if (!loopback) {
      throw configurationError(
        "Le développement local ne peut cibler qu'une API loopback ou le proxy /api/v1."
      );
    }
    return normalizeAbsoluteApiBaseUrl(parsed);
  }

  if (!isTestMode(mode)) {
    if (loopback) {
      throw configurationError("Une API localhost est interdite hors développement et test.");
    }
    if (parsed.protocol !== "https:") {
      throw configurationError("VITE_API_BASE_URL doit utiliser HTTPS hors développement et test.");
    }
  }

  return normalizeAbsoluteApiBaseUrl(parsed);
};

export const resolveApiBaseUrls = (options: ApiRuntimeConfigOptions): [string] => [
  resolveApiBaseUrl(options)
];
