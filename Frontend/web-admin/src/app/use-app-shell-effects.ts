import { useEffect, type RefObject } from "react";

import type { Role, ScreenId, Session } from "../shared/types/app";
import type { UiLanguage } from "../shared/i18n";
import { hasScreenAccess, ROLE_HOME_SCREEN } from "./navigation/screen-registry";
import { isLocalPreviewRoute } from "./preview/preview-mode";
import { decorateResponsiveTables } from "./shell/responsive-tables";

type ApiConnectionState = {
  nextRetryAt?: number | null;
  status: string;
};

type UseAppShellEffectsParams = {
  apiAvailable: boolean;
  apiConnection: ApiConnectionState;
  appRootRef: RefObject<HTMLElement | null>;
  currentRole: Role | null;
  ensureApiAvailable: () => Promise<boolean>;
  enterPreview: () => Promise<void>;
  error: string | null;
  isPreviewSession: boolean;
  lastSyncAt: string | null;
  loadHeaderNotificationCount: () => Promise<void>;
  localPreviewEnabled: boolean;
  notice: string | null;
  session: Session | null;
  setError: (message: string | null) => void;
  setHeaderNotificationCount: (count: number) => void;
  setLastSyncAt: (value: string | null) => void;
  setMobileTasksOpen: (open: boolean) => void;
  setNotice: (message: string | null) => void;
  setTab: (screen: ScreenId) => void;
  tab: ScreenId;
  uiLanguage: UiLanguage;
};

export function useAppShellEffects({
  apiAvailable,
  apiConnection,
  appRootRef,
  currentRole,
  ensureApiAvailable,
  enterPreview,
  error,
  isPreviewSession,
  lastSyncAt,
  loadHeaderNotificationCount,
  localPreviewEnabled,
  notice,
  session,
  setError,
  setHeaderNotificationCount,
  setLastSyncAt,
  setMobileTasksOpen,
  setNotice,
  setTab,
  tab,
  uiLanguage
}: UseAppShellEffectsParams): void {
  useEffect(() => {
    const root = appRootRef.current;
    if (!root) return;

    decorateResponsiveTables(root);

    const observer = new MutationObserver(() => {
      decorateResponsiveTables(root);
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return () => observer.disconnect();
  }, [appRootRef, session, tab, uiLanguage]);

  useEffect(() => {
    if (!localPreviewEnabled || session || !isLocalPreviewRoute()) {
      return;
    }

    void enterPreview();
  }, [enterPreview, localPreviewEnabled, session]);

  useEffect(() => {
    if (isPreviewSession || (localPreviewEnabled && isLocalPreviewRoute())) {
      return;
    }

    void ensureApiAvailable();
  }, [ensureApiAvailable, isPreviewSession, localPreviewEnabled]);

  useEffect(() => {
    if (isPreviewSession || (localPreviewEnabled && isLocalPreviewRoute())) {
      return undefined;
    }

    if (!apiConnection.nextRetryAt || apiConnection.status === "online") {
      return undefined;
    }

    const delay = Math.max(250, apiConnection.nextRetryAt - Date.now());
    const timer = window.setTimeout(() => {
      void ensureApiAvailable();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    apiConnection.nextRetryAt,
    apiConnection.status,
    ensureApiAvailable,
    isPreviewSession,
    localPreviewEnabled
  ]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

  useEffect(() => {
    if (!error) {
      return undefined;
    }

    const timer = window.setTimeout(() => setError(null), 5200);
    return () => window.clearTimeout(timer);
  }, [error, setError]);

  useEffect(() => {
    if (session && !lastSyncAt) {
      setLastSyncAt(new Date().toISOString());
    }
  }, [lastSyncAt, session, setLastSyncAt]);

  useEffect(() => {
    if (!currentRole) return;
    if (hasScreenAccess(currentRole, tab)) return;
    setTab(ROLE_HOME_SCREEN[currentRole] || "dashboard");
  }, [currentRole, setTab, tab]);

  useEffect(() => {
    setMobileTasksOpen(false);
  }, [session?.user.username, setMobileTasksOpen, tab]);

  useEffect(() => {
    if (!session) return undefined;

    const frame = window.requestAnimationFrame(() => {
      appRootRef.current?.querySelector<HTMLElement>(".app-shell-content")?.scrollTo({ top: 0, left: 0 });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [appRootRef, session, tab]);

  useEffect(() => {
    if (isPreviewSession) {
      return undefined;
    }

    if (!session || !currentRole || !apiAvailable) {
      setHeaderNotificationCount(0);
      if (session && currentRole && !apiAvailable) {
        void ensureApiAvailable();
      }
      return;
    }

    let isCancelled = false;
    const syncHeaderNotifications = async (): Promise<void> => {
      await loadHeaderNotificationCount();
      if (isCancelled) return;
    };

    void syncHeaderNotifications();
    const timer = window.setInterval(() => {
      void syncHeaderNotifications();
    }, 45_000);

    return () => {
      isCancelled = true;
      window.clearInterval(timer);
    };
  }, [
    apiAvailable,
    currentRole,
    ensureApiAvailable,
    isPreviewSession,
    loadHeaderNotificationCount,
    session,
    setHeaderNotificationCount
  ]);
}
