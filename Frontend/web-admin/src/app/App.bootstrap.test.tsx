import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

const makeSession = (role: string) => ({
  accessToken: "a".repeat(40),
  refreshToken: "r".repeat(40),
  tenantId: "tenant-1",
  user: {
    username: `${role.toLowerCase()}@gestschool.local`,
    role,
    tenantId: "tenant-1"
  }
});

const okJson = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });

describe("App bootstrap authenticated data", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.sessionStorage.setItem(
      "gestschool.web-admin.session",
      JSON.stringify(makeSession("SCOLARITE"))
    );
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("ne charge pas la liste IAM /users pour un staff scolarité", async () => {
    const calledUrls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calledUrls.push(url);

      if (url.endsWith("/health/live")) return okJson({ status: "ok" });
      if (url.endsWith("/finance/recovery")) {
        return okJson({
          totals: {
            amountDue: 0,
            amountPaid: 0,
            remainingAmount: 0,
            recoveryRatePercent: 0
          },
          invoices: {
            total: 0,
            open: 0,
            partial: 0,
            paid: 0,
            void: 0
          }
        });
      }
      if (url.endsWith("/users")) {
        return okJson([{ id: "should-not-be-called" }]);
      }
      return okJson([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    await waitFor(() => {
      expect(calledUrls.some((url) => url.endsWith("/report-cards"))).toBe(true);
    });

    expect(calledUrls.some((url) => url.endsWith("/users"))).toBe(false);
  });
});
