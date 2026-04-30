const DEFAULT_API_PROXY_BASE = "/api/v1";
const LOOPBACK_API_HOSTS = new Set(["127.0.0.1", "0.0.0.0", "localhost"]);

const normalizeApiBaseUrl = (value?: string): string | null => {
  const normalized = value?.trim().replace(/\/+$/, "") || "";
  return normalized.length > 0 ? normalized : null;
};

const isLoopbackApiBaseUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return LOOPBACK_API_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

export const resolveApiBaseUrls = (options: {
  configuredBaseUrl?: string;
  dev: boolean;
}): string[] => {
  if (options.dev) {
    return [DEFAULT_API_PROXY_BASE];
  }

  const configured = normalizeApiBaseUrl(options.configuredBaseUrl);
  const candidates = [
    ...(configured && !isLoopbackApiBaseUrl(configured) ? [configured] : []),
    DEFAULT_API_PROXY_BASE
  ];

  return Array.from(new Set(candidates));
};

export const API_BASE_URLS = resolveApiBaseUrls({
  configuredBaseUrl: import.meta.env.VITE_API_BASE_URL,
  dev: import.meta.env.DEV
});
