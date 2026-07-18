import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Session } from "../types/app";
import { useAuthSession } from "./use-auth-session-resilient";

const session: Session = {
  accessToken: "a".repeat(40),
  refreshToken: "r".repeat(40),
  tenantId: "tenant-1",
  user: {
    username: "admin@gestschool.local",
    role: "ADMIN",
    tenantId: "tenant-1"
  }
};

const okJson = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });

describe("useAuthSession orchestration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem("gestschool.web-admin.session", JSON.stringify(session));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("expose l'état de chargement pendant la sonde API initiale", async () => {
    let resolveProbe: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveProbe = resolve;
          })
      )
    );
    const { result } = renderHook(() =>
      useAuthSession({
        apiBaseUrls: ["https://api.test.invalid/api/v1"],
        onAuthError: vi.fn(),
        onClearData: vi.fn(),
        onRefreshNotice: vi.fn(),
        onRefreshSuccess: vi.fn()
      })
    );

    let probePromise: Promise<boolean>;
    act(() => {
      probePromise = result.current.ensureApiAvailable();
    });
    expect(result.current.apiConnection.status).toBe("checking");

    resolveProbe?.(okJson({ status: "live" }));
    await act(async () => {
      await probePromise;
    });
    expect(result.current.apiConnection.status).toBe("online");
  });

  it("retire une session expirée lorsque le refresh est refusé", async () => {
    const onAuthError = vi.fn();
    const onClearData = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/health/live")) return okJson({ status: "live" });
        return new Response(JSON.stringify({ message: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      })
    );
    const { result } = renderHook(() =>
      useAuthSession({
        apiBaseUrls: ["https://api.test.invalid/api/v1"],
        onAuthError,
        onClearData,
        onRefreshNotice: vi.fn(),
        onRefreshSuccess: vi.fn()
      })
    );

    await act(async () => {
      await result.current.api("/students");
    });

    await waitFor(() => expect(result.current.session).toBeNull());
    expect(onAuthError).toHaveBeenCalledWith("Session expiree.");
    expect(onClearData).toHaveBeenCalledOnce();
    expect(window.sessionStorage.getItem("gestschool.web-admin.session")).toBeNull();
  });
});
