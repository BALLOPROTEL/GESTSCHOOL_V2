import { Suspense, useCallback, useMemo, useRef, useState } from "react";

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
import { HeaderNavigation } from "./navigation/header-navigation";
import {
  hasScreenAccess
} from "./navigation/screen-registry";
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
  loadUsersData
} from "./app-data-loaders";
import {
  DEFAULT_CURRENCY,
  DEFAULT_TENANT,
  SCHOOL_NAME
} from "./app-config";
import {
  formatRoleLabel
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
import { isLocalPreviewEnabled, isLocalPreviewSession } from "./preview/preview-mode";
import { useAuthFlows } from "./use-auth-flows";
import { useAppShellEffects } from "./use-app-shell-effects";
import { useAppBootstrap } from "./use-app-bootstrap";
import { createAppNavigationModel, createHeaderSessionModel } from "./app-navigation-model";

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
    languageFlipTarget,
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
    setUsers
  });

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
        language={uiLanguage}
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

  const {
    activeScreen,
    dashboardAction,
    headerMessageCount,
    headerSearchSubmit,
    headerUserActions,
    isEnrollmentsContext,
    isTeachersContext,
    messageActive,
    messageTarget,
    notificationActive,
    notificationTarget,
    preferenceActions,
    schoolLifeActions,
    scolariteActions,
    settingsActions,
    settingsGroups,
    sidebarGroups
  } = createAppNavigationModel({
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
  const {
    avatarInitial: profileInitial,
    avatarUrl: headerAvatarUrl,
    contextLabel: profileContextLabel,
    displayName: headerDisplayName,
    email: headerEmail,
    lastSyncLabel,
    statusLabel: headerStatusLabel,
    tenantLabel: headerTenantLabel
  } = createHeaderSessionModel({
    currentProfile,
    currentRole,
    lastSyncAt,
    locale: currentLanguageMeta.locale,
    schoolName: SCHOOL_NAME,
    session,
    users
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
              onUserLogout={() => void logout()}
              user={{
                avatar: profileInitial,
                avatarUrl: headerAvatarUrl,
                email: headerEmail,
                roleLabel: currentRoleLabel,
                username: headerDisplayName
              }}
              userActions={headerUserActions}
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
                  avatarUrl: headerAvatarUrl,
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
