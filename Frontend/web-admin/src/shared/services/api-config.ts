const DEFAULT_API_PROXY_BASE = "/api/v1";
const HOSTED_API_FALLBACK_BASE = "https://gestschool-ylik.onrender.com/api/v1";
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

const uniqueApiBaseUrls = (urls: Array<string | null>): string[] => {
  const seen = new Set<string>();
  return urls.filter((url): url is string => {
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
};

export const resolveApiBaseUrls = (options: {
  configuredBaseUrl?: string;
  dev: boolean;
  hostedFallbackBaseUrl?: string;
}): string[] => {
  if (options.dev) {
    return [DEFAULT_API_PROXY_BASE];
  }

  const configured = normalizeApiBaseUrl(options.configuredBaseUrl);
  const hostedFallback = normalizeApiBaseUrl(
    options.hostedFallbackBaseUrl || HOSTED_API_FALLBACK_BASE
  );

  return uniqueApiBaseUrls([
    configured && !isLoopbackApiBaseUrl(configured) ? configured : null,
    hostedFallback && !isLoopbackApiBaseUrl(hostedFallback) ? hostedFallback : null,
    DEFAULT_API_PROXY_BASE
  ]);
};

export const API_BASE_URLS = resolveApiBaseUrls({
  configuredBaseUrl: import.meta.env.VITE_API_BASE_URL,
  dev: import.meta.env.DEV,
  hostedFallbackBaseUrl: import.meta.env.VITE_API_FALLBACK_BASE_URL
});
