import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AcademicTrack,
  ClassItem,
  Cycle,
  Enrollment,
  FeePlan,
  GradeEntry,
  Invoice,
  Level,
  MosqueeDashboard,
  ParentChild,
  ParentOverview,
  ParentRecord,
  ParentStudentRelation,
  PaymentRecord,
  Period,
  PortalNotification,
  RecoveryDashboard,
  ReportCard,
  Role,
  SchoolYear,
  ScreenId,
  Session,
  Student,
  Subject,
  TeacherClass,
  TeacherOverview,
  TeacherStudent,
  UserAccount,
  UserSelfProfile
} from "../shared/types/app";
import { AppSidebar } from "../shared/components/app-sidebar";
import {
  HeaderNavigation,
  type HeaderNavigationAction,
  type HeaderNavigationGroup,
  type HeaderPreferenceAction,
  type HeaderUserAction
} from "./navigation/header-navigation";
import {
  ROLE_CONTEXT_LABELS,
  ROLE_HOME_SCREEN,
  SCREEN_DEFS,
  hasScreenAccess
} from "./navigation/screen-registry";
import { decorateResponsiveTables } from "./shell/responsive-tables";
import { GlobalToastLayer } from "./shell/global-toast-layer";
import { useAuthSession } from "../shared/hooks/use-auth-session-resilient";
import { useDomTranslation } from "../shared/i18n";
import { API_BASE_URLS } from "../shared/services/api-config";
import { readRememberedLogin } from "../shared/services/session-storage";
import { AppContextBar, AppFooter, PreviewLocalNotice } from "./app-shell-panels";
import {
  applyReferenceDataToState,
  countActionableNotifications,
  loadEnrollmentsData,
  loadFinanceData,
  loadHeaderNotificationRows,
  loadReferenceData,
  loadReportCardsData,
  loadStudentsData,
  loadUsersData,
  resolveBootstrapNeeds
} from "./app-data-loaders";
import {
  DEFAULT_CURRENCY,
  DEFAULT_TENANT,
  SCHOOL_NAME
} from "./app-config";
import {
  formatAccountStatusLabel,
  formatRoleLabel,
  getInitials
} from "./app-formatters";
import {
  ActivityScreen,
  AuthScreen,
  BillingScreen,
  ConstructionPageMosquee,
  DashboardScreen,
  EnrollmentsScreen,
  FinanceScreen,
  GradesScreen,
  IamScreen,
  MessagesScreen,
  ParentsScreen,
  PilotageScreen,
  PortalParentScreen,
  PortalTeacherScreen,
  PreferencesScreen,
  ProfileScreen,
  ReferenceScreen,
  RoomsScreen,
  SchoolLifePanel,
  ScreenLoadingFallback,
  StudentPortalPlaceholderScreen,
  StudentsScreen,
  TeachersScreen,
  ReportsScreen
} from "./lazy-screens";
import { useAppPreferences } from "./use-app-preferences";
import { isLocalPreviewEnabled, isLocalPreviewRoute, isLocalPreviewSession } from "./preview/preview-mode";
import { useAuthFlows } from "./use-auth-flows";

export function App(): JSX.Element {
  const [tab, setTab] = useState<ScreenId>("dashboard");
  const appRootRef = useRef<HTMLElement | null>(null);
  const rememberedLogin = useMemo(() => readRememberedLogin(DEFAULT_TENANT), []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileTasksOpen, setMobileTasksOpen] = useState(false);
  const [headerNotificationCount, setHeaderNotificationCount] = useState(0);
  const localPreviewEnabled = isLocalPreviewEnabled();
  const {
    currentLanguageMeta,
    cycleLanguage,
    languageFlipTarget,
    nextLanguageMeta,
    selectLanguage,
    selectThemeMode,
    themeFlipTarget,
    themeMode,
    toggleThemeMode,
    uiLanguage
  } = useAppPreferences();

  useDomTranslation(appRootRef, uiLanguage);

  const [students, setStudents] = useState<Student[]>([]);

  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const [feePlans, setFeePlans] = useState<FeePlan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [recovery, setRecovery] = useState<RecoveryDashboard | null>(null);

  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [currentProfile, setCurrentProfile] = useState<UserSelfProfile | null>(null);

  const [teacherOverview, setTeacherOverview] = useState<TeacherOverview | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [teacherStudents, setTeacherStudents] = useState<TeacherStudent[]>([]);
  const [teacherGrades, setTeacherGrades] = useState<GradeEntry[]>([]);
  const [teacherTimetable, setTeacherTimetable] = useState<
    Array<{
      id: string;
      classId: string;
      classLabel?: string;
      schoolYearId: string;
      schoolYearCode?: string;
      track: AcademicTrack;
      rotationGroup?: "GROUP_A" | "GROUP_B";
      subjectId: string;
      subjectLabel?: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      room?: string;
      teacherName?: string;
    }>
  >([]);
  const [teacherNotifications, setTeacherNotifications] = useState<PortalNotification[]>([]);

  const [parentOverview, setParentOverview] = useState<ParentOverview | null>(null);
  const [parentRecords, setParentRecords] = useState<ParentRecord[]>([]);
  const [parentRelations, setParentRelations] = useState<ParentStudentRelation[]>([]);
  const [parentChildren, setParentChildren] = useState<ParentChild[]>([]);
  const [parentGrades, setParentGrades] = useState<
    Array<
      GradeEntry & {
        classLabel?: string;
        periodLabel?: string;
      }
    >
  >([]);
  const [parentReportCards, setParentReportCards] = useState<ReportCard[]>([]);
  const [parentAttendance, setParentAttendance] = useState<
    Array<{
      id: string;
      studentId: string;
      studentName?: string;
      classId: string;
      classLabel?: string;
      placementId?: string;
      track: AcademicTrack;
      attendanceDate: string;
      status: string;
      reason?: string;
      justificationStatus: string;
    }>
  >([]);
  const [parentInvoices, setParentInvoices] = useState<Invoice[]>([]);
  const [parentPayments, setParentPayments] = useState<PaymentRecord[]>([]);
  const [parentTimetable, setParentTimetable] = useState<
    Array<{
      slotId: string;
      studentId: string;
      studentName: string;
      classId: string;
      classLabel: string;
      schoolYearId: string;
      schoolYearCode?: string;
      placementId?: string;
      track: AcademicTrack;
      rotationGroup?: "GROUP_A" | "GROUP_B";
      subjectLabel: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      room?: string;
      teacherName?: string;
    }>
  >([]);
  const [parentNotifications, setParentNotifications] = useState<PortalNotification[]>([]);

  const [MosqueeDashboard, setMosqueeDashboard] = useState<MosqueeDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [moduleQueryInput, setModuleQueryInput] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const applyReferenceData = useCallback((data: Parameters<typeof applyReferenceDataToState>[0]): void => {
    applyReferenceDataToState(data, {
      setClasses,
      setCycles,
      setLevels,
      setPeriods,
      setSchoolYears,
      setSubjects
    });
  }, []);

  const clearData = useCallback(() => {
    setStudents([]);
    setSchoolYears([]);
    setCycles([]);
    setLevels([]);
    setClasses([]);
    setSubjects([]);
    setPeriods([]);
    setEnrollments([]);
    setFeePlans([]);
    setInvoices([]);
    setPayments([]);
    setRecovery(null);
    setReportCards([]);
    setUsers([]);
    setCurrentProfile(null);
    setTeacherOverview(null);
    setTeacherClasses([]);
    setTeacherStudents([]);
    setTeacherGrades([]);
    setTeacherTimetable([]);
    setTeacherNotifications([]);
    setParentOverview(null);
    setParentRecords([]);
    setParentRelations([]);
    setParentChildren([]);
    setParentGrades([]);
    setParentReportCards([]);
    setParentAttendance([]);
    setParentInvoices([]);
    setParentPayments([]);
    setParentTimetable([]);
    setParentNotifications([]);
    setMosqueeDashboard(null);
    setHeaderNotificationCount(0);
    setLastSyncAt(null);
    setModuleQueryInput("");
  }, []);
  const handleAuthClearData = useCallback(() => {
    clearData();
  }, [clearData]);
  const handleAuthRefreshSuccess = useCallback(() => {
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
    onClearData: handleAuthClearData,
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
  const bootstrapSessionKeyRef = useRef<string | null>(null);
  const bootstrapSessionInFlightRef = useRef<string | null>(null);

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
  }, [session, tab, uiLanguage]);

  const enterPreview = useCallback(async () => {
    if (!localPreviewEnabled) {
      setError("Le mode aperçu local est désactivé en production.");
      return;
    }

    const { createPreviewAppData } = await import("./preview/preview-data");
    const preview = createPreviewAppData(DEFAULT_TENANT, DEFAULT_CURRENCY);
    clearData();
    setSchoolYears(preview.schoolYears);
    setCycles(preview.cycles);
    setLevels(preview.levels);
    setClasses(preview.classes);
    setSubjects(preview.subjects);
    setPeriods(preview.periods);
    setStudents(preview.students);
    setEnrollments(preview.enrollments);
    setFeePlans(preview.feePlans);
    setInvoices(preview.invoices);
    setPayments(preview.payments);
    setRecovery(preview.recovery);
    setReportCards(preview.reportCards);
    setUsers(preview.users);
    setParentRecords(preview.parents);
    setParentRelations(preview.parentRelations);
    setMosqueeDashboard(preview.mosqueeDashboard);
    setHeaderNotificationCount(preview.headerNotificationCount);
    setLastSyncAt(preview.lastSyncAt);
    saveSession(preview.session);
    setTab("dashboard");
    setError(null);
    setNotice(null);
  }, [clearData, localPreviewEnabled, saveSession]);
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
        parentChildren.find((item) => item.schoolYearCode)?.schoolYearCode ||
        parentTimetable.find((item) => item.schoolYearCode)?.schoolYearCode ||
        "2025-2026"
      );
    }

    if (currentRole === "ENSEIGNANT") {
      return teacherClasses.find((item) => item.schoolYearCode)?.schoolYearCode || "2025-2026";
    }

    const activeYear = schoolYears.find((item) => item.isActive) || schoolYears[0];
    return activeYear?.label || activeYear?.code || "2025-2026";
  }, [currentRole, parentChildren, parentTimetable, schoolYears, teacherClasses]);

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
  }, [apiConnection.nextRetryAt, apiConnection.status, ensureApiAvailable, isPreviewSession, localPreviewEnabled]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) {
      return undefined;
    }

    const timer = window.setTimeout(() => setError(null), 5200);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (session && !lastSyncAt) {
      setLastSyncAt(new Date().toISOString());
    }
  }, [lastSyncAt, session]);

  useEffect(() => {
    if (!currentRole) return;
    if (hasScreenAccess(currentRole, tab)) return;
    setTab(ROLE_HOME_SCREEN[currentRole] || "dashboard");
  }, [currentRole, tab]);

  useEffect(() => {
    setMobileTasksOpen(false);
  }, [session?.user.username, tab]);

  useEffect(() => {
    if (!session) return undefined;

    const frame = window.requestAnimationFrame(() => {
      appRootRef.current?.querySelector<HTMLElement>(".app-shell-content")?.scrollTo({ top: 0, left: 0 });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [session, tab]);

  const loadStudents = useCallback(async () => {
    if (!sessionRef.current) return;
    const { data, error: loadError } = await loadStudentsData(api);
    setStudents(data);
    if (loadError) setError(loadError);
  }, [api]);

  const loadUsers = useCallback(async () => {
    if (!sessionRef.current || !currentRole) return;
    const { data, error: loadError } = await loadUsersData(api, currentRole);
    setUsers(data);
    if (loadError) setError(loadError);
  }, [api, currentRole]);

  const loadReference = useCallback(async () => {
    if (!sessionRef.current) return;
    const { data, error: loadError } = await loadReferenceData(api);
    applyReferenceData(data);
    if (loadError) setError(loadError);
  }, [api, applyReferenceData, sessionRef]);

  const loadEnrollments = useCallback(
    async (filters = { schoolYearId: "", classId: "", studentId: "", track: "" }) => {
      if (!sessionRef.current) return;
      const { data, error: loadError } = await loadEnrollmentsData(api, filters);
      setEnrollments(data);
      if (loadError) setError(loadError);
    },
    [api]
  );

  const loadFinance = useCallback(async () => {
    if (!sessionRef.current) return;
    const { data, error: loadError } = await loadFinanceData(api);
    if (!data) {
      if (loadError) setError(loadError);
      return;
    }

    setFeePlans(data.feePlans);
    setInvoices(data.invoices);
    setPayments(data.payments);
    setRecovery(data.recovery);
  }, [api]);

  const loadReportCards = useCallback(async () => {
    if (!sessionRef.current) return;
    const { data, error: loadError } = await loadReportCardsData(api);
    setReportCards(data);
    if (loadError) setError(loadError);
  }, [api]);

  const loadHeaderNotificationCount = useCallback(async () => {
    if (!sessionRef.current || !currentRole) {
      setHeaderNotificationCount(0);
      return;
    }

    if (currentRole === "ENSEIGNANT") {
      setHeaderNotificationCount(teacherOverview?.notificationsCount ?? teacherNotifications.length);
      return;
    }

    if (currentRole === "PARENT") {
      setHeaderNotificationCount(parentOverview?.notificationsCount ?? parentNotifications.length);
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
  }, [
    api,
    currentRole,
    parentNotifications.length,
    parentOverview?.notificationsCount,
    teacherNotifications.length,
    teacherOverview?.notificationsCount
  ]);

  useEffect(() => {
    if (!session || !currentRole) {
      bootstrapSessionKeyRef.current = null;
      bootstrapSessionInFlightRef.current = null;
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
      bootstrapSessionKeyRef.current === sessionKey ||
      bootstrapSessionInFlightRef.current === sessionKey
    ) {
      return;
    }

    bootstrapSessionInFlightRef.current = sessionKey;
    let cancelled = false;

    const bootstrapData = async (): Promise<void> => {
      try {
        if (needReference) await loadReference();
        if (needStudents) await loadStudents();
        if (
          currentRole === "ADMIN" &&
          (hasScreenAccess(currentRole, "iam") ||
            hasScreenAccess(currentRole, "parents") ||
            hasScreenAccess(currentRole, "reports"))
        ) {
          await loadUsers();
        } else {
          setUsers([]);
        }
        if (hasScreenAccess(currentRole, "enrollments")) await loadEnrollments();
        if (hasScreenAccess(currentRole, "finance")) await loadFinance();
        if (hasScreenAccess(currentRole, "grades")) {
          await loadReportCards();
        }
        if (!cancelled) {
          bootstrapSessionKeyRef.current = sessionKey;
        }
      } finally {
        if (bootstrapSessionInFlightRef.current === sessionKey) {
          bootstrapSessionInFlightRef.current = null;
        }
      }
    };

    void bootstrapData();

    return () => {
      cancelled = true;
      if (bootstrapSessionInFlightRef.current === sessionKey) {
        bootstrapSessionInFlightRef.current = null;
      }
    };
  }, [
    apiAvailable,
    clearData,
    currentRole,
    ensureApiAvailable,
    loadEnrollments,
    loadFinance,
    loadReference,
    loadReportCards,
    loadStudents,
    loadUsers,
    localPreviewEnabled,
    session,
    isPreviewSession
  ]);

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
  }, [apiAvailable, currentRole, ensureApiAvailable, loadHeaderNotificationCount, session, isPreviewSession]);

  const formatAmount = (value: number): string =>
    new Intl.NumberFormat(currentLanguageMeta.locale, { maximumFractionDigits: 0 }).format(value);
  const formatCurrencyLabel = (currency?: string): string => {
    const normalized = (currency || DEFAULT_CURRENCY).trim().toUpperCase();
    return normalized === "XOF" || normalized === "CFA" ? "F CFA" : normalized;
  };
  const formatMoney = (value: number, currency?: string): string =>
    `${formatAmount(value)} ${formatCurrencyLabel(currency)}`;
  const financeInitialData = useMemo(
    () => ({ feePlans, invoices, payments, recovery }),
    [feePlans, invoices, payments, recovery]
  );
  const teacherPortalInitialData = useMemo(
    () => ({
      overview: teacherOverview,
      classes: teacherClasses,
      students: teacherStudents,
      grades: teacherGrades,
      timetable: teacherTimetable,
      notifications: teacherNotifications
    }),
    [teacherClasses, teacherGrades, teacherNotifications, teacherOverview, teacherStudents, teacherTimetable]
  );
  const parentPortalInitialData = useMemo(
    () => ({
      overview: parentOverview,
      children: parentChildren,
      grades: parentGrades,
      reportCards: parentReportCards,
      attendance: parentAttendance,
      invoices: parentInvoices,
      payments: parentPayments,
      timetable: parentTimetable,
      notifications: parentNotifications
    }),
    [
      parentAttendance,
      parentChildren,
      parentGrades,
      parentInvoices,
      parentNotifications,
      parentOverview,
      parentPayments,
      parentReportCards,
      parentTimetable
    ]
  );
  const renderStudents = (): JSX.Element => (
    <StudentsScreen
      api={api}
      initialStudents={students}
      remoteEnabled={!isPreviewSession}
      onStudentsChange={setStudents}
      onReloadEnrollments={loadEnrollments}
      onError={setError}
      onNotice={setNotice}
    />
  );
  const renderFinance = (): JSX.Element => (
    <FinanceScreen
      api={api}
      initialData={financeInitialData}
      schoolYears={schoolYears}
      levels={levels}
      students={students}
      locale={currentLanguageMeta.locale}
      defaultCurrency={DEFAULT_CURRENCY}
      remoteEnabled={!isPreviewSession}
      onFinanceDataChange={(nextData) => {
        setFeePlans(nextData.feePlans);
        setInvoices(nextData.invoices);
        setPayments(nextData.payments);
        setRecovery(nextData.recovery);
      }}
      onError={setError}
      onNotice={setNotice}
    />
  );
  const renderMosquee = (): JSX.Element => <ConstructionPageMosquee />;

  const renderGrades = (): JSX.Element => (
    <GradesScreen
      api={api}
      initialReportCards={reportCards}
      classes={classes}
      students={students}
      subjects={subjects}
      periods={periods}
      schoolYears={schoolYears}
      remoteEnabled={!isPreviewSession}
      onReportCardsChange={setReportCards}
      onError={setError}
      onNotice={setNotice}
    />
  );
  const renderReports = (): JSX.Element => (
    <ReportsScreen
      api={api}
      schoolYears={schoolYears}
      users={users}
      locale={currentLanguageMeta.locale}
      remoteEnabled={!isPreviewSession}
      formatMoney={formatMoney}
      onError={setError}
      onNotice={setNotice}
    />
  );
  const handleProfileChange = useCallback(
    (profile: UserSelfProfile): void => {
      setCurrentProfile(profile);
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
      if (!sessionUserChanged && currentSession.tenantId === nextTenantId) {
        return;
      }

      saveSession({
        ...currentSession,
        tenantId: nextTenantId,
        user: nextSessionUser
      });
    },
    [saveSession, sessionRef]
  );
  const renderProfile = (): JSX.Element => {
    if (!session) return renderForbidden();
    return (
      <ProfileScreen
        api={api}
        currentRoleLabel={currentRoleLabel}
        locale={currentLanguageMeta.locale}
        onError={setError}
        onLanguageChange={selectLanguage}
        onLogoutAllDevices={logout}
        onNotice={setNotice}
        onProfileChange={handleProfileChange}
        onThemeChange={selectThemeMode}
        remoteEnabled={!isPreviewSession}
        schoolName={SCHOOL_NAME}
        schoolYears={schoolYears}
        session={session}
        themeMode={themeMode}
        uiLanguage={uiLanguage}
        users={users}
      />
    );
  };
  const renderPreferences = (): JSX.Element => {
    if (!session) return renderForbidden();
    return (
      <PreferencesScreen
        api={api}
        onError={setError}
        onLanguageChange={selectLanguage}
        onNotice={setNotice}
        onThemeChange={selectThemeMode}
        remoteEnabled={!isPreviewSession}
        schoolName={SCHOOL_NAME}
        schoolYears={schoolYears}
        session={session}
        themeMode={themeMode}
        uiLanguage={uiLanguage}
        users={users}
      />
    );
  };
  const renderActivity = (): JSX.Element => {
    if (!session) return renderForbidden();
    return (
      <ActivityScreen
        api={api}
        onError={setError}
        onNotice={setNotice}
        remoteEnabled={!isPreviewSession}
        schoolName={SCHOOL_NAME}
        schoolYears={schoolYears}
        session={session}
        uiLanguage={uiLanguage}
        users={users}
      />
    );
  };
  const renderBilling = (): JSX.Element => {
    if (!session) return renderForbidden();
    return (
      <BillingScreen
        api={api}
        onError={setError}
        onNotice={setNotice}
        remoteEnabled={!isPreviewSession}
        schoolName={SCHOOL_NAME}
        schoolYears={schoolYears}
        session={session}
        uiLanguage={uiLanguage}
        users={users}
      />
    );
  };
  const renderDashboard = (): JSX.Element => {
    return (
      <DashboardScreen
        currentRole={currentRole}
        invoices={invoices}
        classesCount={classes.length}
        reportCards={reportCards}
        recovery={recovery}
        students={students}
        enrollments={enrollments}
        MosqueeDashboard={MosqueeDashboard}
        parentOverview={parentOverview}
        parentChildren={parentChildren}
        parentInvoices={parentInvoices}
        parentNotifications={parentNotifications}
        teacherOverview={teacherOverview}
        teacherClasses={teacherClasses}
        teacherStudentsCount={teacherStudents.length}
        teacherGradesCount={teacherGrades.length}
        teacherNotifications={teacherNotifications}
        mobileTasksOpen={mobileTasksOpen}
        onSelectScreen={setTab}
        onToggleMobileTasks={() => setMobileTasksOpen((prev) => !prev)}
        formatMoney={formatMoney}
        hasScreenAccess={hasScreenAccess}
      />
    );
  };

  const renderMessages = (): JSX.Element => {
    return <MessagesScreen currentRoleLabel={currentRoleLabel} onSelectScreen={setTab} />;
  };

  const renderStudentPortal = (): JSX.Element => <StudentPortalPlaceholderScreen />;

  const renderTeacherPortal = (): JSX.Element => (
    <PortalTeacherScreen
      api={api}
      initialData={teacherPortalInitialData}
      subjects={subjects}
      periods={periods}
      locale={currentLanguageMeta.locale}
      remoteEnabled={!isPreviewSession}
      onDataChange={(nextData) => {
        setTeacherOverview(nextData.overview);
        setTeacherClasses(nextData.classes);
        setTeacherStudents(nextData.students);
        setTeacherGrades(nextData.grades);
        setTeacherTimetable(nextData.timetable);
        setTeacherNotifications(nextData.notifications);
      }}
      onError={setError}
      onNotice={setNotice}
    />
  );
  const renderIam = (): JSX.Element => (
    <IamScreen
      api={api}
      initialUsers={users}
      students={students}
      remoteEnabled={!isPreviewSession}
      locale={currentLanguageMeta.locale}
      language={uiLanguage}
      onError={setError}
      onNotice={setNotice}
      onUsersChange={setUsers}
    />
  );
  const renderParentPortal = (): JSX.Element => (
    <PortalParentScreen
      api={api}
      initialData={parentPortalInitialData}
      locale={currentLanguageMeta.locale}
      defaultCurrency={DEFAULT_CURRENCY}
      remoteEnabled={!isPreviewSession}
      onDataChange={(nextData) => {
        setParentOverview(nextData.overview);
        setParentChildren(nextData.children);
        setParentGrades(nextData.grades);
        setParentReportCards(nextData.reportCards);
        setParentAttendance(nextData.attendance);
        setParentInvoices(nextData.invoices);
        setParentPayments(nextData.payments);
        setParentTimetable(nextData.timetable);
        setParentNotifications(nextData.notifications);
      }}
      onError={setError}
    />
  );
  const referenceData = useMemo(
    () => ({ schoolYears, cycles, levels, classes, subjects, periods }),
    [classes, cycles, levels, periods, schoolYears, subjects]
  );

  const renderReferenceScreen = (): JSX.Element => (
    <ReferenceScreen
      api={api}
      data={referenceData}
      schoolName={SCHOOL_NAME}
      remoteEnabled={!isPreviewSession}
      onDataChange={applyReferenceData}
      onReloadEnrollments={() => loadEnrollments()}
      onError={setError}
      onNotice={setNotice}
    />
  );
  const renderForbidden = (): JSX.Element => (
    <section className="panel table-panel">
      <h2>Acces refuse</h2>
      <p className="subtle">Votre profil ({currentRoleLabel}) n'a pas acces a cet ecran.</p>
    </section>
  );

  const renderActiveScreen = (): JSX.Element => {
    if (!currentRole || !hasScreenAccess(currentRole, tab)) {
      return renderForbidden();
    }

    if (tab === "dashboard") return renderDashboard();
    if (tab === "iam") return renderIam();
    if (tab === "teachers") {
      return (
        <TeachersScreen
          api={api}
          classes={classes}
          cycles={cycles}
          levels={levels}
          periods={periods}
          schoolYears={schoolYears}
          subjects={subjects}
          users={users}
          language={uiLanguage}
          remoteEnabled={!isPreviewSession}
          onError={setError}
          onNotice={setNotice}
        />
      );
    }
    if (tab === "rooms") {
      return (
        <RoomsScreen
          api={api}
          classes={classes}
          cycles={cycles}
          levels={levels}
          periods={periods}
          schoolYears={schoolYears}
          subjects={subjects}
          remoteEnabled={!isPreviewSession}
          onError={setError}
          onNotice={setNotice}
        />
      );
    }
    if (tab === "students") return renderStudents();
    if (tab === "parents") {
      return (
        <ParentsScreen
          api={api}
          initialParents={parentRecords}
          initialRelations={parentRelations}
          remoteEnabled={!isPreviewSession}
          students={students}
          users={users}
          onError={setError}
          onNotice={setNotice}
          onParentsChanged={loadStudents}
        />
      );
    }
    if (tab === "reference") return renderReferenceScreen();

    if (tab === "enrollments") {
      return (
        <EnrollmentsScreen
          api={api}
          initialEnrollments={enrollments}
          schoolYears={schoolYears}
          classes={classes}
          students={students}
          remoteEnabled={!isPreviewSession}
          language={uiLanguage}
          locale={currentLanguageMeta.locale}
          onEnrollmentsChange={setEnrollments}
          onError={setError}
          onNotice={setNotice}
        />
      );
    }
    if (tab === "finance") return renderFinance();
    if (tab === "profile") return renderProfile();
    if (tab === "preferences") return renderPreferences();
    if (tab === "activity") return renderActivity();
    if (tab === "billing") return renderBilling();
    if (tab === "messages") return renderMessages();
    if (tab === "reports") return renderReports();
    if (tab === "mosquee") return renderMosquee();
    if (tab === "grades") return renderGrades();
    if (tab === "schoolLifeOverview") {
      return (
        <PilotageScreen
          api={api}
          students={students}
          enrollments={enrollments}
          classes={classes}
          levels={levels}
          schoolYears={schoolYears}
          periods={periods}
          invoices={invoices}
          recovery={recovery}
          reportCards={reportCards}
          locale={currentLanguageMeta.locale}
          remoteEnabled={!isPreviewSession}
          formatMoney={formatMoney}
          onSelectScreen={setTab}
        />
      );
    }
    if (tab === "schoolLifeAttendance") {
      return (
        <SchoolLifePanel
          api={api}
          students={students}
          classes={classes}
          subjects={subjects}
          locale={currentLanguageMeta.locale}
          onError={setError}
          onNotice={setNotice}
          focusSection="attendance"
          readOnly={!currentRole || currentRole === "PARENT"}
        />
      );
    }
    if (tab === "schoolLifeTimetable") {
      return (
        <SchoolLifePanel
          api={api}
          students={students}
          classes={classes}
          subjects={subjects}
          locale={currentLanguageMeta.locale}
          onError={setError}
          onNotice={setNotice}
          focusSection="timetable"
          readOnly={currentRole === "PARENT"}
        />
      );
    }
    if (tab === "schoolLifeNotifications") {
      return (
        <SchoolLifePanel
          api={api}
          students={students}
          classes={classes}
          subjects={subjects}
          locale={currentLanguageMeta.locale}
          onError={setError}
          onNotice={setNotice}
          focusSection="notifications"
          readOnly={currentRole === "PARENT"}
        />
      );
    }
    if (tab === "teacherPortal") return renderTeacherPortal();
    if (tab === "parentPortal") return renderParentPortal();
    if (tab === "studentPortal") return renderStudentPortal();

    return renderDashboard();
  };

  const activeScreen = SCREEN_DEFS.find((entry) => entry.id === tab) ?? SCREEN_DEFS[0];
  const isEnrollmentsContext = tab === "enrollments";
  const sessionUserAccount =
    users.find((item) => item.id === session?.user.id) ||
    users.find((item) => item.username === session?.user.username) ||
    users.find((item) => Boolean(item.email && item.email === session?.user.username));
  const headerAccount = currentProfile?.user || sessionUserAccount;
  const headerDisplayName =
    headerAccount?.displayName ||
    session?.user.displayName ||
    session?.user.username ||
    "Utilisateur";
  const headerEmail =
    headerAccount?.email ||
    session?.user.email ||
    (session?.user.username?.includes("@") ? session.user.username : undefined);
  const profileInitial = getInitials(headerDisplayName || headerEmail);
  const profileContextLabel = currentRole ? ROLE_CONTEXT_LABELS[currentRole] : "Session";
  const headerTenantLabel = currentProfile?.context.tenantName || SCHOOL_NAME;
  const headerStatusLabel = formatAccountStatusLabel(headerAccount?.status || session?.user.status || "ACTIVE");
  const lastSyncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString(currentLanguageMeta.locale)
    : "Non synchronise";
  const dashboardTarget =
    currentRole && hasScreenAccess(currentRole, "dashboard")
      ? "dashboard"
      : currentRole
        ? ROLE_HOME_SCREEN[currentRole] || "dashboard"
        : "dashboard";
  const buildHeaderAction = (screen: ScreenId, label: string): HeaderNavigationAction => {
    const allowed = currentRole ? hasScreenAccess(currentRole, screen) : false;
    return {
      id: screen,
      label,
      active: tab === screen,
      disabled: !allowed,
      helperText: allowed ? undefined : "Accès restreint",
      onSelect: () => {
        if (!allowed) return;
        setTab(screen);
      }
    };
  };
  const dashboardAction: HeaderNavigationAction = {
    id: dashboardTarget,
    label: "Tableau de bord",
    active: tab === dashboardTarget,
    disabled: !currentRole,
    onSelect: () => setTab(dashboardTarget)
  };
  const messagingEnabled = false;
  const scolariteActions: HeaderNavigationAction[] = [
    buildHeaderAction("enrollments", "Inscriptions"),
    buildHeaderAction("iam", "Utilisateurs & droits"),
    buildHeaderAction("teachers", "Enseignants"),
    buildHeaderAction("rooms", "Salles"),
    buildHeaderAction("students", "Élèves"),
    buildHeaderAction("parents", "Parents"),
    buildHeaderAction("finance", "Comptabilité")
  ];
  const schoolLifeActions: HeaderNavigationAction[] = [
    buildHeaderAction("grades", "Notes & bulletins"),
    messagingEnabled ? buildHeaderAction("messages", "Messagerie") : null,
    buildHeaderAction("schoolLifeOverview", "Pilotage"),
    buildHeaderAction("schoolLifeAttendance", "Absences"),
    buildHeaderAction("schoolLifeTimetable", "Emploi du temps"),
    buildHeaderAction("schoolLifeNotifications", "Notifications")
  ].filter((item): item is HeaderNavigationAction => item !== null);
  const settingsActions: HeaderNavigationAction[] = [
    buildHeaderAction("reference", "Référentiel"),
    buildHeaderAction("reports", "Rapports & conformité")
  ];
  const settingsGroups: HeaderNavigationGroup[] = [
    {
      id: "mosquee-management",
      label: "Gestion mosquée",
      items: [buildHeaderAction("mosquee", "Mosquée")]
    }
  ];
  const portalActions: HeaderNavigationAction[] = [
    currentRole === "ENSEIGNANT" ? buildHeaderAction("teacherPortal", "Portail enseignant") : null,
    currentRole === "PARENT" ? buildHeaderAction("parentPortal", "Portail parent") : null,
    currentRole === "STUDENT" ? buildHeaderAction("studentPortal", "Portail élève") : null
  ].filter((item): item is HeaderNavigationAction => item !== null);
  const isTeachersContext = tab === "teachers";
  const sidebarGroups =
    currentRole === "ENSEIGNANT" || currentRole === "PARENT" || currentRole === "STUDENT"
      ? [{ id: "portal", title: "Accès rapide", items: portalActions }]
      : [
          { id: "pilotage", title: "Pilotage", items: [dashboardAction] },
          { id: "scolarite", title: "Scolarité", items: scolariteActions },
          { id: "school-life", title: "Vie scolaire", items: schoolLifeActions },
          {
            id: "settings",
            title: "Paramètres",
            items: [...settingsActions, ...settingsGroups.flatMap((group) => group.items)]
          }
        ];
  const preferenceActions: HeaderPreferenceAction[] = [
    {
      id: "language",
      label: "Changer la langue",
      helperText: `Passer de ${currentLanguageMeta.label} à ${nextLanguageMeta.label}`,
      iconSrc: currentLanguageMeta.iconSrc,
      onSelect: cycleLanguage
    },
    {
      id: "theme",
      label: "Changer le mode",
      helperText: themeMode === "dark" ? "Activer le mode clair" : "Activer le mode sombre",
      iconSrc: themeMode === "light" ? "/mode-clair.png" : "/mode-sombre.png",
      onSelect: toggleThemeMode
    }
  ];
  const headerUserActions: HeaderUserAction[] = [
    {
      id: "profile",
      icon: "profile",
      label: "Mon profil",
      onSelect: () => setTab("profile")
    },
    {
      id: "preferences",
      icon: "settings",
      label: "Préférences",
      onSelect: () => setTab("preferences")
    },
    {
      id: "activity",
      icon: "activity",
      label: "Journal d’activité",
      onSelect: () => setTab("activity")
    },
    {
      id: "billing",
      icon: "billing",
      label: "Facturation",
      onSelect: () => setTab("billing")
    }
  ];
  const notificationTarget: ScreenId =
    currentRole === "ENSEIGNANT"
      ? "teacherPortal"
      : currentRole === "PARENT"
        ? "parentPortal"
        : currentRole === "STUDENT"
          ? "studentPortal"
          : currentRole && hasScreenAccess(currentRole, "schoolLifeNotifications")
            ? "schoolLifeNotifications"
            : dashboardTarget;
  const messageTarget: ScreenId =
    currentRole && hasScreenAccess(currentRole, "messages") ? "messages" : dashboardTarget;
  const headerMessageCount =
    currentRole && hasScreenAccess(currentRole, "messages")
      ? 0
      : 0;
  const notificationActive =
    notificationTarget === "schoolLifeNotifications"
      ? tab === "schoolLifeNotifications"
      : tab === notificationTarget;
  const messageActive = messageTarget === "messages" ? tab === "messages" : tab === messageTarget;
  const headerSearchSubmit = (): void => {
    if (!moduleQueryInput.trim()) return;
    if (currentRole && hasScreenAccess(currentRole, "dashboard")) {
      setTab("dashboard");
    }
  };
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
            onLoginFormChange={(patch) => setLoginForm((prev) => ({ ...prev, ...patch }))}
            rememberMe={rememberMe}
            onRememberMeChange={setRememberMe}
            loadingAuth={loadingAuth}
            onSubmitLogin={(event) => void login(event)}
            authAssistMode={authAssistMode}
            onShowLogin={showLoginPanel}
            onShowForgotPassword={showForgotPasswordPanel}
            onShowFirstConnection={showFirstConnectionPanel}
            forgotPasswordForm={forgotPasswordForm}
            onForgotPasswordChange={(patch) => setForgotPasswordForm((prev) => ({ ...prev, ...patch }))}
            resetPasswordForm={resetPasswordForm}
            onResetPasswordChange={(patch) => setResetPasswordForm((prev) => ({ ...prev, ...patch }))}
            firstConnectionForm={firstConnectionForm}
            onFirstConnectionChange={(patch) => setFirstConnectionForm((prev) => ({ ...prev, ...patch }))}
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
              groups={sidebarGroups}
              logoAlt={`Logo ${SCHOOL_NAME}`}
              logoSrc="/logo.png"
              onBrandSelect={dashboardAction.onSelect}
              user={{
                avatar: profileInitial,
                avatarUrl: headerAccount?.avatarUrl,
                email: headerEmail,
                roleLabel: currentRoleLabel,
                username: headerDisplayName
              }}
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
                onSearchSubmit={headerSearchSubmit}
                onToggleSidebar={() => setSidebarCollapsed((previous) => !previous)}
                dashboard={dashboardAction}
                scolarite={scolariteActions}
                schoolLife={schoolLifeActions}
                settings={settingsActions}
                settingsGroups={settingsGroups}
                preferences={preferenceActions}
                userActions={headerUserActions}
                messages={{
                  active: messageActive,
                  count: headerMessageCount,
                  disabled: true,
                  label: "Messagerie en aperçu",
                  statusLabel: "Service indisponible pour le moment",
                  onSelect: () => setTab(messageTarget)
                }}
                notifications={{
                  active: notificationActive,
                  count: headerNotificationCount,
                  label: "Notifications en temps reel",
                  onSelect: () => setTab(notificationTarget)
                }}
                user={{
                  avatar: profileInitial,
                  avatarUrl: headerAccount?.avatarUrl,
                  contextLabel: profileContextLabel,
                  email: headerEmail,
                  roleLabel: currentRoleLabel,
                  schoolYearLabel,
                  secondaryLabel: `Année : ${schoolYearLabel}`,
                  statusLabel: headerStatusLabel,
                  tenantLabel: headerTenantLabel,
                  username: headerDisplayName,
                  onLogout: () => void logout()
                }}
              />

              <div className="app-shell-content">
                {isPreviewSession ? <PreviewLocalNotice uiLanguage={uiLanguage} /> : null}

                <AppContextBar
                  activeLabel={activeScreen.label}
                  isEnrollmentsContext={isEnrollmentsContext}
                  isTeachersContext={isTeachersContext}
                  onBackToDashboard={() => setTab("dashboard")}
                  tab={tab}
                />

                <section key={tab} className="screen-host">
                  <Suspense fallback={<ScreenLoadingFallback />}>{renderActiveScreen()}</Suspense>
                </section>

                <AppFooter
                  apiConnectionStatus={apiConnection.status}
                  apiStatusText={apiStatusText}
                  lastSyncLabel={lastSyncLabel}
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
