import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Session } from "../shared/types/app";
import { useAppBootstrap } from "./use-app-bootstrap";

const session: Session = {
  accessToken: "a".repeat(40),
  refreshToken: "r".repeat(40),
  tenantId: "00000000-0000-4000-8000-000000000001",
  user: {
    role: "ADMIN",
    tenantId: "00000000-0000-4000-8000-000000000001",
    username: "performance.admin"
  }
};

function BootstrapHarness({ loaders }: { loaders: Array<() => Promise<void>> }): null {
  useAppBootstrap({
    apiAvailable: true,
    clearData: vi.fn(),
    currentRole: "ADMIN",
    ensureApiAvailable: vi.fn(async () => true),
    isPreviewSession: false,
    loadReference: loaders[0],
    loadStudents: loaders[1],
    loadUsers: loaders[2],
    loadEnrollments: loaders[3],
    loadFinance: loaders[4],
    loadReportCards: loaders[5],
    localPreviewEnabled: false,
    session,
    setUsers: vi.fn()
  });
  return null;
}

describe("useAppBootstrap performance", () => {
  it("démarre en parallèle les lectures indépendantes autorisées", async () => {
    const releases: Array<() => void> = [];
    const loaders = Array.from({ length: 6 }, () =>
      vi.fn<() => Promise<void>>(
        () =>
          new Promise<void>((resolve) => {
            releases.push(resolve);
          })
      )
    );

    render(<BootstrapHarness loaders={loaders} />);

    await waitFor(() => expect(loaders.every((loader) => loader.mock.calls.length === 1)).toBe(true));
    releases.forEach((release) => release());
  });
});
