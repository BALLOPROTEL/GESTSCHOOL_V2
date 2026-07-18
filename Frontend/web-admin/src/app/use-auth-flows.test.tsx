import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Session } from "../shared/types/app";
import { useAuthFlows } from "./use-auth-flows";

const renderAuthFlows = () =>
  renderHook(() =>
    useAuthFlows({
      clearData: vi.fn(),
      clearSession: vi.fn(),
      ensureApiAvailable: vi.fn(async () => true),
      markApiAvailable: vi.fn(),
      markApiUnavailable: vi.fn(),
      onError: vi.fn(),
      onNotice: vi.fn(),
      onSyncNow: vi.fn(),
      rememberedLogin: null,
      resolveApiUrl: (path) => `https://api.test.invalid/api/v1${path}`,
      saveSession: vi.fn(),
      sessionRef: { current: null } as { current: Session | null },
      setTab: vi.fn()
    })
  );

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("useAuthFlows URL bootstrap", () => {
  it("conserve le jeton d'activation porté par l'URL", () => {
    window.history.replaceState({}, "", "/activate?token=activation-token");
    const { result } = renderAuthFlows();

    expect(result.current.authAssistMode).toBe("first");
    expect(result.current.firstConnectionForm.temporaryPassword).toBe("activation-token");
  });

  it("conserve le jeton de réinitialisation porté par l'URL", () => {
    window.history.replaceState({}, "", "/reset-password?token=reset-token");
    const { result } = renderAuthFlows();

    expect(result.current.authAssistMode).toBe("forgot");
    expect(result.current.resetPasswordForm.token).toBe("reset-token");
  });
});
