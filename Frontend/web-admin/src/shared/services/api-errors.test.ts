import { describe, expect, it } from "vitest";

import { UI_MESSAGES } from "../i18n";
import { parseApiError, toUiErrorMessage } from "./api-errors";

const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });

describe("localized API errors", () => {
  it.each([
    ["REFERENCE_SCHOOL_YEAR_IN_USE", UI_MESSAGES.schoolYearInUse],
    ["REFERENCE_CLASS_IN_USE", UI_MESSAGES.classInUse],
    ["AUTH_INVALID_CREDENTIALS", UI_MESSAGES.invalidCredentials],
    ["RATE_LIMITED", UI_MESSAGES.rateLimited]
  ] as const)("mappe le code stable %s", async (code, expected) => {
    await expect(parseApiError(jsonResponse(409, { code, message: "backend detail" }))).resolves.toBe(
      expected
    );
  });

  it("ne présente jamais un message backend arbitraire", async () => {
    const backendMessage = "Internal provider rejected the request for user@example.test";

    const result = await parseApiError(jsonResponse(409, { message: backendMessage }));

    expect(result).toBe(UI_MESSAGES.conflict);
    expect(result).not.toBe(backendMessage);
  });

  it("conserve une compatibilité limitée avec les anciens conflits connus", async () => {
    await expect(
      parseApiError(
        jsonResponse(409, {
          message: "Class cannot be deleted because it is still used."
        })
      )
    ).resolves.toBe(UI_MESSAGES.classInUse);
  });

  it("utilise le statut HTTP si le corps est absent ou invalide", async () => {
    await expect(parseApiError(new Response("not-json", { status: 503 }))).resolves.toBe(
      UI_MESSAGES.serverError
    );
  });

  it("refuse les messages Error non centralisés", () => {
    expect(toUiErrorMessage(new Error("Raw backend error"), UI_MESSAGES.saveError)).toBe(
      UI_MESSAGES.saveError
    );
    expect(toUiErrorMessage(new Error(UI_MESSAGES.deleteError))).toBe(UI_MESSAGES.deleteError);
  });
});
