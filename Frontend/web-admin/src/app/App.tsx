import { Suspense, useCallback, useMemo, useRef, useState } from "react";

import type { Role, ScreenId, Session, UserSelfProfile } from "../shared/types/app";
import { AppSidebar } from "../shared/components/app-sidebar";
import { useAuthSession } from "../shared/hooks/use-auth-session-resilient";
import { useDomTranslation } from "../shared/i18n";
import { API_BASE_URLS } from "../shared/services/api-config";
import { readRememberedLogin } from "../shared/services/session-storage";
import { HeaderNavigation } from "./navigation/header-navigation";
import { hasScreenAccess } from "./navigation/screen-registry";
import { GlobalToastLayer } from "./shell/global-toast-layer";
import {
  AppContextBar,
  AppFooter,
  PreviewLocalNotice
} from "./app-shell-panels";
import {
  countActionableNotifications,
  loadHeaderNotificationRows
} from "./app-data-loaders";
import { DEFAULT_CURRENCY, DEFAULT_TENANT, SCHOOL_NAME } from "./app-config";
import { formatRoleLabel } from "./app-formatters";
import { AuthScreen, ScreenLoadingFallback } from "./lazy-screens";
import { useAppPreferences } from "./use-app-preferences";
import { isLocalPreviewEnabled, isLocalPreviewSession } from "./preview/preview-mode";
import { useAuthFlows } from "./use-auth-flows";
import { useAppShellEffects } from "./use-app-shell-effects";
import { useAppBootstrap } from "./use-app-bootstrap";
import { createAppNavigationModel, createHeaderSessionModel } from "./app-navigation-model";
import { useAppDataLoaders, useAppDomainState } from "./use-app-data";
import { AppScreenRouter } from "./app-screen-router";

export function App(): JSX.Element {
  const [tab, setTab] = useState<ScreenId>("dashboard");
  const appRootRef = useRef<HTMLElement | null>(null);
  const rememberedLogin = useMemo(() => readRememberedLogin(DEFAULT_TENANT), []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileTasksOpen, setMobileTasksOpen] = useState(false);
  const [headerNotificationCount, setHeaderNotificationCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [moduleQueryInput, setModuleQueryInput] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const localPreviewEnabled = isLocalPreviewEnabled();
  const {
    currentLanguageMeta,
    languageFlipTarget,
    selectLanguage,
    selectThemeMode,
    themeFlipTarget,
    themeMode,
    toggleThemeMode,
    uiLanguage
  } = useAppPreferences();
  const { actions: dataActions, data } = useAppDomainState();

  useDomTranslation(appRootRef, uiLanguage);

  const clearData = useCallback((): void => {
    dataActions.clearData();
    setHeaderNotificationCount(0);
    setLastSyncAt(null);
    setModuleQueryInput("");
  }, [dataActions]);
  const handleAuthRefreshSuccess = useCallback((): void => {
    setLastSyncAt(new Date().toISOString());
  }, []);
  const {
    api,
    apiConnection,
    clearSession,
    ensureApiAvailable,
    markApiAvailable,
    markApiUnavailable,
    resolveApiUrl,
    saveSession,
    session,
    sessionRef
  } = useAuthSession({
    apiBaseUrls: API_BASE_URLS,
    onAuthError: setError,
    onClearData: clearData,
    onRefreshNotice: setNotice,
    onRefreshSuccess: handleAuthRefreshSuccess
  });
  const {
    authAssistLoading,
    authAssistMode,
    firstConnectionForm,
    forgotPasswordForm,
    loadingAuth,
    login,
    loginErrors,
    loginForm,
    logout,
    rememberMe,
    requestForgotPasswordToken,
    resetPasswordForm,
    setFirstConnectionForm,
    setForgotPasswordForm,
    setLoginForm,
    setRememberMe,
    setResetPasswordForm,
    showFirstConnectionPanel,
    showForgotPasswordPanel,
    showLoginPanel,
    submitFirstConnection,
    submitResetPassword
  } = useAuthFlows({
    clearData,
    clearSession,
    ensureApiAvailable,
    markApiAvailable,
    markApiUnavailable,
    onError: setError,
    onNotice: setNotice,
    onSyncNow: () => setLastSyncAt(new Date().toISOString()),
    rememberedLogin,
    resolveApiUrl,
    saveSession,
    sessionRef,
    setTab
  });
  const enterPreview = useCallback(async (): Promise<void> => {
    if (!localPreviewEnabled) {
      setError("Le mode aperçu local est désactivé en production.");
      return;
    }

    const { createPreviewAppData } = await import("./preview/preview-data");
    const preview = createPreviewAppData(DEFAULT_TENANT, DEFAULT_CURRENCY);
    clearData();
    dataActions.applyPreviewData(preview);
    setHeaderNotificationCount(preview.headerNotificationCount);
    setLastSyncAt(preview.lastSyncAt);
    saveSession(preview.session);
    setTab("dashboard");
    setError(null);
    setNotice(null);
  }, [clearData, dataActions, localPreviewEnabled, saveSession]);

  const currentRole = (session?.user.role as Role | undefined) || null;
  const isPreviewSession = isLocalPreviewSession(session);
  const currentRoleLabel = currentRole ? formatRoleLabel(currentRole) : "Visiteur";
  const apiAvailable = apiConnection.status === "online";
  const apiStatusText =
    isPreviewSession
      ? "Mode aperçu local - données de démonstration non persistées"
      : apiConnection.status === "checking"
        ? "Connexion à l'API..."
        : apiConnection.status === "online"
          ? "API disponible"
          : apiConnection.status === "reconnecting"
            ? "API indisponible. Reconnexion..."
            : "API indisponible";

  const schoolYearLabel = useMemo(() => {
    if (currentRole === "PARENT") {
      return (
        data.parentPortal.children.find((item) => item.schoolYearCode)?.schoolYearCode ||
        data.parentPortal.timetable.find((item) => item.schoolYearCode)?.schoolYearCode ||
        "2025-2026"
      );
    }

    if (currentRole === "ENSEIGNANT") {
      return (
        data.teacherPortal.classes.find((item) => item.schoolYearCode)?.schoolYearCode ||
        "2025-2026"
      );
    }

    const activeYear =
      data.reference.schoolYears.find((item) => item.isActive) || data.reference.schoolYears[0];
    return activeYear?.label || activeYear?.code || "2025-2026";
  }, [currentRole, data.parentPortal, data.reference.schoolYears, data.teacherPortal.classes]);

  const {
    loadEnrollments,
    loadFinance,
    loadReference,
    loadReportCards,
    loadStudents,
    loadUsers
  } = useAppDataLoaders({
    actions: dataActions,
    api,
    currentRole,
    onError: setError,
    sessionRef
  });
  const loadHeaderNotificationCount = useCallback(async (): Promise<void> => {
    if (!sessionRef.current || !currentRole) {
      setHeaderNotificationCount(0);
      return;
    }

    if (currentRole === "ENSEIGNANT") {
      setHeaderNotificationCount(
        data.teacherPortal.overview?.notificationsCount ?? data.teacherPortal.notifications.length
      );
      return;
    }

    if (currentRole === "PARENT") {
      setHeaderNotificationCount(
        data.parentPortal.overview?.notificationsCount ?? data.parentPortal.notifications.length
      );
      return;
    }

    if (!hasScreenAccess(currentRole, "schoolLifeNotifications")) {
      setHeaderNotificationCount(0);
      return;
    }

    const { data: rows, error: loadError } = await loadHeaderNotificationRows(api);
    if (loadError) {
      setHeaderNotificationCount(0);
      return;
    }

    setHeaderNotificationCount(countActionableNotifications(rows));
  }, [api, currentRole, data.parentPortal, data.teacherPortal, sessionRef]);

  useAppShellEffects({
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
  });

  useAppBootstrap({
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
    setUsers: dataActions.setUsers
  });

  const formatAmount = (value: number): string =>
    new Intl.NumberFormat(currentLanguageMeta.locale, { maximumFractionDigits: 0 }).format(value);
  const formatCurrencyLabel = (currency?: string): string => {
    const normalized = (currency || DEFAULT_CURRENCY).trim().toUpperCase();
    return normalized === "XOF" || normalized === "CFA" ? "F CFA" : normalized;
  };
  const formatMoney = (value: number, currency?: string): string =>
    `${formatAmount(value)} ${formatCurrencyLabel(currency)}`;
  const handleProfileChange = useCallback(
    (profile: UserSelfProfile): void => {
      dataActions.setCurrentProfile(profile);
      const currentSession = sessionRef.current;
      if (!currentSession) return;

      const nextSessionUser: Session["user"] = {
        ...currentSession.user,
        id: profile.user.id,
        username: profile.user.username,
        role: profile.user.role,
        tenantId: profile.user.tenantId,
        email: profile.user.email,
        phone: profile.user.phone,
        displayName: profile.user.displayName,
        avatarUrl: profile.user.avatarUrl,
        accountType: profile.user.accountType,
        status: profile.user.status
      };
      const nextTenantId = currentSession.tenantId || profile.context.tenantId;
      const sessionUserChanged = (
        [
          "id",
          "username",
          "role",
          "tenantId",
          "email",
          "phone",
          "displayName",
          "avatarUrl",
          "accountType",
          "status"
        ] as const
      ).some((key) => currentSession.user[key] !== nextSessionUser[key]);
      if (!sessionUserChanged && currentSession.tenantId === nextTenantId) return;

      saveSession({
        ...currentSession,
        tenantId: nextTenantId,
        user: nextSessionUser
      });
    },
    [dataActions, saveSession, sessionRef]
  );

  const navigation = createAppNavigationModel({
    currentLanguageMeta,
    currentRole,
    moduleQueryInput,
    selectLanguage,
    selectScreen: setTab,
    tab,
    themeMode,
    toggleThemeMode,
    uiLanguage
  });
  const headerSession = createHeaderSessionModel({
    currentProfile: data.currentProfile,
    currentRole,
    lastSyncAt,
    locale: currentLanguageMeta.locale,
    schoolName: SCHOOL_NAME,
    session,
    users: data.users
  });

  return (
    <main
      ref={appRootRef}
      className={`page ${!session ? "page-auth" : ""}`.trim()}
      data-theme={themeMode}
      data-lang={uiLanguage}
      dir={currentLanguageMeta.dir}
    >
      <div className="aurora aurora-left" />
      <div className="aurora aurora-right" />

      {!session ? (
        <Suspense fallback={<ScreenLoadingFallback />}>
          <AuthScreen
            schoolName={SCHOOL_NAME}
            themeMode={themeMode}
            themeBusy={Boolean(themeFlipTarget)}
            onSelectTheme={selectThemeMode}
            uiLanguage={uiLanguage}
            languageBusy={Boolean(languageFlipTarget)}
            onSelectLanguage={selectLanguage}
            apiStatus={apiConnection.status}
            apiStatusText={apiStatusText}
            loginForm={loginForm}
            loginUsernameError={loginErrors.username}
            loginPasswordError={loginErrors.password}
            onLoginFormChange={(patch) => setLoginForm((previous) => ({ ...previous, ...patch }))}
            rememberMe={rememberMe}
            onRememberMeChange={setRememberMe}
            loadingAuth={loadingAuth}
            onSubmitLogin={(event) => void login(event)}
            authAssistMode={authAssistMode}
            onShowLogin={showLoginPanel}
            onShowForgotPassword={showForgotPasswordPanel}
            onShowFirstConnection={showFirstConnectionPanel}
            forgotPasswordForm={forgotPasswordForm}
            onForgotPasswordChange={(patch) =>
              setForgotPasswordForm((previous) => ({ ...previous, ...patch }))
            }
            resetPasswordForm={resetPasswordForm}
            onResetPasswordChange={(patch) =>
              setResetPasswordForm((previous) => ({ ...previous, ...patch }))
            }
            firstConnectionForm={firstConnectionForm}
            onFirstConnectionChange={(patch) =>
              setFirstConnectionForm((previous) => ({ ...previous, ...patch }))
            }
            authAssistLoading={authAssistLoading}
            onSubmitForgotPassword={(event) => void requestForgotPasswordToken(event)}
            onSubmitResetPassword={(event) => void submitResetPassword(event)}
            onSubmitFirstConnection={(event) => void submitFirstConnection(event)}
            onEnterPreview={() => void enterPreview()}
            previewEnabled={localPreviewEnabled}
          />
        </Suspense>
      ) : (
        <section className="workspace fade-up">
          <div className={`app-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`.trim()}>
            <AppSidebar
              brandName={SCHOOL_NAME}
              groups={navigation.sidebarGroups}
              logoAlt={`Logo ${SCHOOL_NAME}`}
              logoSrc="/logo.png"
              onBrandSelect={navigation.dashboardAction.onSelect}
              onUserLogout={() => void logout()}
              user={{
                avatar: headerSession.avatarInitial,
                avatarUrl: headerSession.avatarUrl,
                email: headerSession.email,
                roleLabel: currentRoleLabel,
                username: headerSession.displayName
              }}
              userActions={navigation.headerUserActions}
            />
            <div className="app-shell-main">
              <HeaderNavigation
                brandName={SCHOOL_NAME}
                logoAlt={`Logo ${SCHOOL_NAME}`}
                logoSrc="/logo.png"
                sidebarCollapsed={sidebarCollapsed}
                searchPlaceholder="Rechercher un module, un écran, une action..."
                searchValue={moduleQueryInput}
                onSearchChange={setModuleQueryInput}
                onSearchSubmit={navigation.headerSearchSubmit}
                onToggleSidebar={() => setSidebarCollapsed((previous) => !previous)}
                dashboard={navigation.dashboardAction}
                scolarite={navigation.scolariteActions}
                schoolLife={navigation.schoolLifeActions}
                settings={navigation.settingsActions}
                settingsGroups={navigation.settingsGroups}
                preferences={navigation.preferenceActions}
                userActions={navigation.headerUserActions}
                messages={{
                  active: navigation.messageActive,
                  count: navigation.headerMessageCount,
                  disabled: !navigation.messagesEnabled,
                  label: "Messagerie",
                  onSelect: () => setTab(navigation.messageTarget)
                }}
                notifications={{
                  active: navigation.notificationActive,
                  count: headerNotificationCount,
                  label: "Notifications en temps reel",
                  onSelect: () => setTab(navigation.notificationTarget)
                }}
                user={{
                  avatar: headerSession.avatarInitial,
                  avatarUrl: headerSession.avatarUrl,
                  contextLabel: headerSession.contextLabel,
                  email: headerSession.email,
                  roleLabel: currentRoleLabel,
                  schoolYearLabel,
                  secondaryLabel: `Année : ${schoolYearLabel}`,
                  statusLabel: headerSession.statusLabel,
                  tenantLabel: headerSession.tenantLabel,
                  username: headerSession.displayName,
                  onLogout: () => void logout()
                }}
              />

              <div className="app-shell-content">
                {isPreviewSession ? <PreviewLocalNotice uiLanguage={uiLanguage} /> : null}

                <AppContextBar
                  activeLabel={navigation.activeScreen.label}
                  isEnrollmentsContext={navigation.isEnrollmentsContext}
                  isTeachersContext={navigation.isTeachersContext}
                  onBackToDashboard={() => setTab("dashboard")}
                  tab={tab}
                />

                <section key={tab} className="screen-host">
                  <Suspense fallback={<ScreenLoadingFallback />}>
                    <AppScreenRouter
                      activeScreenLabel={navigation.activeScreen.label}
                      api={api}
                      currentRole={currentRole}
                      currentRoleLabel={currentRoleLabel}
                      data={data}
                      dataActions={dataActions}
                      fallbackAction={navigation.dashboardAction}
                      formatMoney={formatMoney}
                      loadEnrollments={loadEnrollments}
                      loadStudents={loadStudents}
                      locale={currentLanguageMeta.locale}
                      mobileTasksOpen={mobileTasksOpen}
                      onError={setError}
                      onLogout={logout}
                      onMobileTasksToggle={() => setMobileTasksOpen((previous) => !previous)}
                      onNotice={setNotice}
                      onProfileChange={handleProfileChange}
                      onSelectLanguage={selectLanguage}
                      onSelectScreen={setTab}
                      onSelectTheme={selectThemeMode}
                      remoteEnabled={!isPreviewSession}
                      session={session}
                      tab={tab}
                      themeMode={themeMode}
                      uiLanguage={uiLanguage}
                    />
                  </Suspense>
                </section>

                <AppFooter
                  apiConnectionStatus={apiConnection.status}
                  apiStatusText={apiStatusText}
                  lastSyncLabel={headerSession.lastSyncLabel}
                  schoolName={SCHOOL_NAME}
                  schoolYearLabel={schoolYearLabel}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      <GlobalToastLayer
        error={error}
        language={uiLanguage}
        notice={notice}
        onDismissError={() => setError(null)}
        onDismissNotice={() => setNotice(null)}
      />
    </main>
  );
}
