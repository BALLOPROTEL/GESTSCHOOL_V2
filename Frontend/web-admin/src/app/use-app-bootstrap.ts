import { useEffect, useRef } from "react";

import type { Role, ScreenId, Session, UserAccount } from "../shared/types/app";
import { hasScreenAccess } from "./navigation/screen-registry";
import { isLocalPreviewRoute } from "./preview/preview-mode";
import { resolveBootstrapNeeds } from "./app-data-loaders";

type BootstrapLoader = () => Promise<void>;

type UseAppBootstrapParams = {
  apiAvailable: boolean;
  clearData: () => void;
  currentRole: Role | null;
  ensureApiAvailable: () => Promise<boolean>;
  isPreviewSession: boolean;
  loadEnrollments: BootstrapLoader;
  loadFinance: BootstrapLoader;
  loadReference: BootstrapLoader;
  loadReportCards: BootstrapLoader;
  loadStudents: BootstrapLoader;
  loadUsers: BootstrapLoader;
  localPreviewEnabled: boolean;
  session: Session | null;
  setUsers: (users: UserAccount[]) => void;
};

const shouldLoadUsers = (role: Role): boolean =>
  role === "ADMIN" &&
  (hasScreenAccess(role, "iam" as ScreenId) ||
    hasScreenAccess(role, "parents" as ScreenId) ||
    hasScreenAccess(role, "reports" as ScreenId));

export function useAppBootstrap({
  apiAvailable,
  clearData,
  currentRole,
  ensureApiAvailable,
  isPreviewSession,
  loadEnrollments,
  loadFinance,
  loadReference,
  loadReportCards,
  loadStudents,
  loadUsers,
  localPreviewEnabled,
  session,
  setUsers
}: UseAppBootstrapParams): void {
  const bootstrappedSessionKeyRef = useRef<string | null>(null);
  const inFlightSessionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session || !currentRole) {
      bootstrappedSessionKeyRef.current = null;
      inFlightSessionKeyRef.current = null;
      if (!(localPreviewEnabled && isLocalPreviewRoute())) {
        clearData();
      }
      return;
    }

    if (isPreviewSession) {
      return;
    }

    if (!apiAvailable) {
      void ensureApiAvailable();
      return;
    }

    const { needReference, needStudents } = resolveBootstrapNeeds(currentRole);
    const sessionKey = `${session.user.username}:${session.tenantId}:${currentRole}`;
    if (
      bootstrappedSessionKeyRef.current === sessionKey ||
      inFlightSessionKeyRef.current === sessionKey
    ) {
      return;
    }

    inFlightSessionKeyRef.current = sessionKey;
    let cancelled = false;

    const bootstrapData = async (): Promise<void> => {
      try {
        if (needReference) await loadReference();
        if (needStudents) await loadStudents();
        if (shouldLoadUsers(currentRole)) {
          await loadUsers();
        } else {
          setUsers([]);
        }
        if (hasScreenAccess(currentRole, "enrollments")) await loadEnrollments();
        if (hasScreenAccess(currentRole, "finance")) await loadFinance();
        if (hasScreenAccess(currentRole, "grades")) await loadReportCards();
        if (!cancelled) {
          bootstrappedSessionKeyRef.current = sessionKey;
        }
      } finally {
        if (inFlightSessionKeyRef.current === sessionKey) {
          inFlightSessionKeyRef.current = null;
        }
      }
    };

    void bootstrapData();

    return () => {
      cancelled = true;
      if (inFlightSessionKeyRef.current === sessionKey) {
        inFlightSessionKeyRef.current = null;
      }
    };
  }, [
    apiAvailable,
    clearData,
    currentRole,
    ensureApiAvailable,
    isPreviewSession,
    loadEnrollments,
    loadFinance,
    loadReference,
    loadReportCards,
    loadStudents,
    loadUsers,
    localPreviewEnabled,
    session,
    setUsers
  ]);
}
