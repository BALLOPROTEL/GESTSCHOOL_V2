import { describe, expect, it } from "vitest";

import { resolveApiBaseUrls } from "./api-config";

describe("api-config", () => {
  it("utilise le proxy local en developpement", () => {
    expect(
      resolveApiBaseUrls({
        configuredBaseUrl: "https://api.example.com/api/v1",
        dev: true,
        hostedFallbackBaseUrl: "https://fallback.example.com/api/v1"
      })
    ).toEqual(["/api/v1"]);
  });

  it("priorise l'URL API configuree en production", () => {
    expect(
      resolveApiBaseUrls({
        configuredBaseUrl: "https://api.example.com/api/v1/",
        dev: false,
        hostedFallbackBaseUrl: "https://fallback.example.com/api/v1"
      })
    ).toEqual([
      "https://api.example.com/api/v1",
      "https://fallback.example.com/api/v1",
      "/api/v1"
    ]);
  });

  it("garde un fallback heberge quand l'environnement Vercel n'est pas renseigne", () => {
    expect(
      resolveApiBaseUrls({
        dev: false,
        hostedFallbackBaseUrl: "https://gestschool-ylik.onrender.com/api/v1"
      })
    ).toEqual(["https://gestschool-ylik.onrender.com/api/v1", "/api/v1"]);
  });

  it("ignore les URL loopback dans un build production", () => {
    expect(
      resolveApiBaseUrls({
        configuredBaseUrl: "http://localhost:3000/api/v1",
        dev: false,
        hostedFallbackBaseUrl: "https://fallback.example.com/api/v1"
      })
    ).toEqual(["https://fallback.example.com/api/v1", "/api/v1"]);
  });
});
