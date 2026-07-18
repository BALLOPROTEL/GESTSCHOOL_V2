import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

import { resolveApiBaseUrl } from "./src/shared/services/api-runtime-config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = env.API_PORT || "3000";
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || `http://127.0.0.1:${apiPort}`;

  resolveApiBaseUrl({
    configuredBaseUrl: env.VITE_API_BASE_URL,
    mode
  });
  resolveApiBaseUrl({
    configuredBaseUrl: apiProxyTarget,
    mode: "development"
  });

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5180,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true
        }
      }
    },
    test: {
      environment: "jsdom",
      globals: false,
      setupFiles: ["./src/test/setup.ts"]
    }
  };
});
