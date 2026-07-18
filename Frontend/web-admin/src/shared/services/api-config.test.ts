import { describe, expect, it } from "vitest";

import { resolveApiBaseUrl, resolveApiBaseUrls } from "./api-runtime-config";

describe("api-config", () => {
  it("utilise le proxy local en developpement", () => {
    expect(
      resolveApiBaseUrls({
        mode: "development"
      })
    ).toEqual(["/api/v1"]);
  });

  it("accepte une URL locale explicitement configuree en developpement", () => {
    expect(resolveApiBaseUrl({ configuredBaseUrl: "http://localhost:3000/api/v1/", mode: "development" }))
      .toBe("http://localhost:3000/api/v1");
  });

  it("refuse une configuration absente en production", () => {
    expect(() => resolveApiBaseUrl({ mode: "production" })).toThrow(
      "VITE_API_BASE_URL est obligatoire"
    );
  });

  it("refuse une URL invalide", () => {
    expect(() => resolveApiBaseUrl({ configuredBaseUrl: "pas-une-url", mode: "production" }))
      .toThrow("URL HTTP(S) valide");
  });

  it("refuse localhost en production", () => {
    expect(() => resolveApiBaseUrl({
      configuredBaseUrl: "http://localhost:3000/api/v1",
      mode: "production"
    })).toThrow("localhost est interdite");
    expect(() => resolveApiBaseUrl({
      configuredBaseUrl: "https://127.12.0.4/api/v1",
      mode: "production"
    })).toThrow("localhost est interdite");
    expect(() => resolveApiBaseUrl({
      configuredBaseUrl: "https://[::1]/api/v1",
      mode: "production"
    })).toThrow("localhost est interdite");
  });

  it("accepte une URL de production explicitement configuree sans fallback", () => {
    expect(resolveApiBaseUrls({
      configuredBaseUrl: "https://api.example.com/api/v1/",
      mode: "production"
    })).toEqual(["https://api.example.com/api/v1"]);
  });

  it("utilise un endpoint mock explicite en mode test", () => {
    expect(resolveApiBaseUrl({ configuredBaseUrl: "https://mock.test/api/v1", mode: "test" }))
      .toBe("https://mock.test/api/v1");
    expect(resolveApiBaseUrl({ mode: "test" })).toBe("/api/v1");
  });
});
