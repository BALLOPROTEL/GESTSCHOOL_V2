import { resolveApiBaseUrls } from "./api-runtime-config";

export { resolveApiBaseUrl, resolveApiBaseUrls } from "./api-runtime-config";

export const API_BASE_URLS = resolveApiBaseUrls({
  configuredBaseUrl: import.meta.env.VITE_API_BASE_URL,
  mode: import.meta.env.MODE
});
