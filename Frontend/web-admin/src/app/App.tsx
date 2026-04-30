import { FormEvent, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AcademicTrack,
  AuthMessageResponse,
  ClassItem,
  Cycle,
  Enrollment,
  FeePlan,
  FieldErrors,
  ForgotPasswordResponse,
  GradeEntry,
  Invoice,
  Level,
  ModuleTile,
  MosqueeDashboard,
  ParentChild,
  ParentOverview,
  PaymentRecord,
  Period,
  PortalNotification,
  RecoveryDashboard,
  RememberedLogin,
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
  ThemeMode,
  UserAccount
} from "../shared/types/app";
import { AppSidebar } from "../shared/components/app-sidebar";
import {
  HeaderNavigation,
  type HeaderNavigationAction,
  type HeaderNavigationGroup,
  type HeaderPreferenceAction
} from "./navigation/header-navigation";
import {
  HERO_SLIDES,
  MODULE_TILES,
  ROLE_CONTEXT_LABELS,
  ROLE_HOME_SCREEN,
  SCREEN_DEFS,
  hasScreenAccess
} from "./navigation/screen-registry";
import { ROLE_LABELS } from "../shared/constants/domain";
import { decorateResponsiveTables } from "./shell/responsive-tables";
import { useAuthSession } from "../shared/hooks/use-auth-session-resilient";
import { UI_LANGUAGE_META, UI_LANGUAGE_ORDER, UiLanguage, useDomTranslation } from "../shared/i18n";
import { fetchReferenceData } from "../features/reference/services/reference-service";
import type { ReferenceData } from "../features/reference/types/reference";
import { createPreviewAppData, PREVIEW_ACCESS_TOKEN } from "./preview/preview-data";
import { API_BASE_URLS } from "../shared/services/api-config";
import { parseApiError } from "../shared/services/api-errors";
import {
  readLanguagePreference,
  readRememberedLogin,
  readThemePreference
} from "../shared/services/session-storage";
import { focusFirstInlineErrorField, hasFieldErrors } from "../shared/utils/form-ui";

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";
const DEFAULT_CURRENCY = "CFA";
const SCHOOL_NAME = "Al Manarat Islamiyat";
const PREVIEW_MODE_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_PREVIEW === "true";
const THEME_STORAGE_KEY = "gestschool.web-admin.theme";
const LANGUAGE_STORAGE_KEY = "gestschool.web-admin.language";
const LOGIN_HINT_STORAGE_KEY = "gestschool.web-admin.login-hint";
const ICON_TOGGLE_ANIMATION_MS = 460;
const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{12,128}$/;
const STRONG_PASSWORD_HINT =
  "Le mot de passe doit contenir au moins 12 caracteres, avec majuscule, minuscule, chiffre et caractere special.";

const AuthScreen = lazy(() =>
  import("../features/auth-screen").then((module) => ({ default: module.AuthScreen }))
);
const DashboardScreen = lazy(() =>
  import("../features/dashboard-screen").then((module) => ({ default: module.DashboardScreen }))
);
const MessagesScreen = lazy(() =>
  import("../features/messages-screen").then((module) => ({ default: module.MessagesScreen }))
);
const ParentsScreen = lazy(() =>
  import("../features/parents-screen").then((module) => ({ default: module.ParentsScreen }))
);
const StudentPortalPlaceholderScreen = lazy(() =>
  import("../features/student-portal-placeholder-screen").then((module) => ({
    default: module.StudentPortalPlaceholderScreen
  }))
);
const StudentsScreen = lazy(() =>
  import("../features/students/students-screen").then((module) => ({ default: module.StudentsScreen }))
);
const TeachersScreen = lazy(() =>
  import("../features/teachers-screen").then((module) => ({ default: module.TeachersScreen }))
);
const RoomsScreen = lazy(() =>
  import("../features/rooms-screen").then((module) => ({ default: module.RoomsScreen }))
);
const IamScreen = lazy(() =>
  import("../features/iam/iam-screen").then((module) => ({ default: module.IamScreen }))
);
const ReportsScreen = lazy(() =>
  import("../features/reports/reports-screen").then((module) => ({ default: module.ReportsScreen }))
);
const EnrollmentsScreen = lazy(() =>
  import("../features/enrollments/enrollments-screen").then((module) => ({
    default: module.EnrollmentsScreen
  }))
);
const FinanceScreen = lazy(() =>
  import("../features/finance/finance-screen").then((module) => ({ default: module.FinanceScreen }))
);
const GradesScreen = lazy(() =>
  import("../features/grades/grades-screen").then((module) => ({ default: module.GradesScreen }))
);
const PortalTeacherScreen = lazy(() =>
  import("../features/portal/portal-teacher-screen").then((module) => ({
    default: module.PortalTeacherScreen
  }))
);
const PortalParentScreen = lazy(() =>
  import("../features/portal/portal-parent-screen").then((module) => ({
    default: module.PortalParentScreen
  }))
);
const ReferenceScreen = lazy(() =>
  import("../features/reference/reference-screen").then((module) => ({ default: module.ReferenceScreen }))
);
const SchoolLifePanel = lazy(() =>
  import("../features/school-life/school-life-panel").then((module) => ({
    default: module.SchoolLifePanel
  }))
);
const ConstructionPageMosquee = lazy(() =>
  import("../features/mosquee/construction-page").then((module) => ({
    default: module.ConstructionPageMosquee
  }))
);

const ScreenLoadingFallback = (): JSX.Element => (
  <section className="panel table-panel screen-loading" aria-live="polite">
    <span className="mini-loader" />
    <div>
      <strong>Chargement du module</strong>
      <p className="subtle">Preparation de l'ecran demande...</p>
    </div>
  </section>
);

const isStrongPassword = (value: string): boolean => STRONG_PASSWORD_REGEX.test(value);
const getNextThemeMode = (mode: ThemeMode): ThemeMode => (mode === "light" ? "dark" : "light");
const getNextUiLanguage = (language: UiLanguage): UiLanguage => {
  const currentIndex = UI_LANGUAGE_ORDER.indexOf(language);
  return UI_LANGUAGE_ORDER[(currentIndex + 1) % UI_LANGUAGE_ORDER.length] || "fr";
};
const getIconToggleAnimationDuration = (): number =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : ICON_TOGGLE_ANIMATION_MS;
const formatLookupLabel = (map: Record<string, string>, value?: string): string => {
  const normalized = (value || "").trim().toUpperCase();
  return map[normalized] || value || "-";
};
const formatRoleLabel = (value?: string): string => formatLookupLabel(ROLE_LABELS, value);
const parseError = (response: Response): Promise<string> =>
  parseApiError(response, {
    localApiHint: ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? "Erreur API locale. Verifie que `pnpm dev:api` tourne puis redemarre `pnpm dev:web` pour recharger le proxy."
      : undefined
  });

export function App(): JSX.Element {
  const [tab, setTab] = useState<ScreenId>("dashboard");
  const appRootRef = useRef<HTMLElement | null>(null);
  const rememberedLogin = useMemo(() => readRememberedLogin(DEFAULT_TENANT), []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readThemePreference());
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(() => readLanguagePreference());
  const [themeFlipTarget, setThemeFlipTarget] = useState<ThemeMode | null>(null);
  const [languageFlipTarget, setLanguageFlipTarget] = useState<UiLanguage | null>(null);
  const currentLanguageMeta = UI_LANGUAGE_META[uiLanguage];
  const [mobileTasksOpen, setMobileTasksOpen] = useState(false);
  const [headerNotificationCount, setHeaderNotificationCount] = useState(0);
  const themeFlipTimeoutRef = useRef<number | null>(null);
  const languageFlipTimeoutRef = useRef<number | null>(null);

  useDomTranslation(appRootRef, uiLanguage);

  const [loginForm, setLoginForm] = useState({
    username: rememberedLogin?.username || "",
    password: "",
    tenantId: rememberedLogin?.tenantId || DEFAULT_TENANT
  });
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [rememberMe, setRememberMe] = useState(Boolean(rememberedLogin?.remember));
  const [authAssistMode, setAuthAssistMode] = useState<"none" | "forgot" | "first">("none");
  const [authAssistLoading, setAuthAssistLoading] = useState(false);
  const [forgotPasswordForm, setForgotPasswordForm] = useState({
    username: rememberedLogin?.username || "",
    tenantId: rememberedLogin?.tenantId || DEFAULT_TENANT
  });
  const [resetPasswordForm, setResetPasswordForm] = useState({
    token: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [firstConnectionForm, setFirstConnectionForm] = useState({
    username: rememberedLogin?.username || "",
    tenantId: rememberedLogin?.tenantId || DEFAULT_TENANT,
    temporaryPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
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
  const [moduleQuery, setModuleQuery] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const [loginErrors, setLoginErrors] = useState<FieldErrors>({});
  const applyReferenceData = useCallback((data: ReferenceData): void => {
    setSchoolYears(data.schoolYears);
    setCycles(data.cycles);
    setLevels(data.levels);
    setClasses(data.classes);
    setSubjects(data.subjects);
    setPeriods(data.periods);
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
    setTeacherOverview(null);
    setTeacherClasses([]);
    setTeacherStudents([]);
    setTeacherGrades([]);
    setTeacherTimetable([]);
    setTeacherNotifications([]);
    setParentOverview(null);
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
    setModuleQuery("");
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

  const enterPreview = useCallback(() => {
    if (!PREVIEW_MODE_ENABLED) {
      setError("Le mode apercu local est desactive en production.");
      return;
    }

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
    setMosqueeDashboard(preview.mosqueeDashboard);
    setHeaderNotificationCount(preview.headerNotificationCount);
    setLastSyncAt(preview.lastSyncAt);
    saveSession(preview.session);
    setTab("dashboard");
    setError(null);
    setNotice("Mode apercu local active : donnees de demonstration non persistees.");
  }, [clearData, saveSession]);
  const currentRole = (session?.user.role as Role | undefined) || null;
  const isPreviewSession = PREVIEW_MODE_ENABLED && session?.accessToken === PREVIEW_ACCESS_TOKEN;
  const currentRoleLabel = currentRole ? formatRoleLabel(currentRole) : "Visiteur";
  const apiAvailable = apiConnection.status === "online";
  const apiStatusText =
    isPreviewSession
      ? "Mode apercu local - donnees demo non persistees"
      : apiConnection.status === "checking"
      ? "Connexion a l'API..."
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

  const homeTiles = useMemo(() => {
    if (!currentRole) return [] as ModuleTile[];

    return MODULE_TILES.filter((tile) => hasScreenAccess(currentRole, tile.screen));
  }, [currentRole]);

  const filteredTiles = useMemo(() => {
    const query = moduleQuery.trim().toLowerCase();
    if (!query) return homeTiles;

    return homeTiles.filter((tile) => {
      const haystack = [tile.title, tile.subtitle, ...tile.tags].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [homeTiles, moduleQuery]);

  const currentSlide = HERO_SLIDES[2];

  useEffect(() => {
    if (!PREVIEW_MODE_ENABLED || session || window.location.hash !== "#preview-admin") {
      return;
    }

    enterPreview();
  }, [enterPreview, session]);

  useEffect(() => {
    if (isPreviewSession) {
      return;
    }

    void ensureApiAvailable();
  }, [ensureApiAvailable, isPreviewSession]);

  useEffect(() => {
    if (isPreviewSession) {
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
  }, [apiConnection.nextRetryAt, apiConnection.status, ensureApiAvailable, isPreviewSession]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setModuleQuery(moduleQueryInput);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [moduleQueryInput]);

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
    return () => {
      if (themeFlipTimeoutRef.current !== null) {
        window.clearTimeout(themeFlipTimeoutRef.current);
      }
      if (languageFlipTimeoutRef.current !== null) {
        window.clearTimeout(languageFlipTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.lang = uiLanguage;
    document.documentElement.dir = currentLanguageMeta.dir;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, uiLanguage);
  }, [currentLanguageMeta.dir, uiLanguage]);

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
      appRootRef.current?.querySelector<HTMLElement>(".app-shell-main")?.scrollTo({ top: 0, left: 0 });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [session, tab]);

  const loadStudents = useCallback(async () => {
    if (!sessionRef.current) return;
    const response = await api("/students");
    setStudents((await response.json()) as Student[]);
  }, [api]);

  const loadUsers = useCallback(async () => {
    if (!sessionRef.current) return;
    const response = await api("/users");
    setUsers((await response.json()) as UserAccount[]);
  }, [api]);

  const loadReference = useCallback(async () => {
    if (!sessionRef.current) return;
    const { data, errors } = await fetchReferenceData(api);
    applyReferenceData(data);
    if (errors.length > 0) {
      setError(errors.join(" | "));
    }
  }, [api, applyReferenceData, sessionRef]);

  const loadEnrollments = useCallback(
    async (filters = { schoolYearId: "", classId: "", studentId: "", track: "" }) => {
      if (!sessionRef.current) return;
      const query = new URLSearchParams();
      if (filters.schoolYearId) query.set("schoolYearId", filters.schoolYearId);
      if (filters.classId) query.set("classId", filters.classId);
      if (filters.studentId) query.set("studentId", filters.studentId);
      if (filters.track) query.set("track", filters.track);
      const suffix = query.toString() ? `?${query.toString()}` : "";
      const response = await api(`/enrollments${suffix}`);
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }
      setEnrollments((await response.json()) as Enrollment[]);
    },
    [api]
  );

  const loadFinance = useCallback(async () => {
    if (!sessionRef.current) return;

    const responses = await Promise.all([
      api("/fee-plans"),
      api("/invoices"),
      api("/payments"),
      api("/finance/recovery")
    ]);

    const failed = responses.find((item) => !item.ok);
    if (failed) {
      setError(await parseError(failed));
      return;
    }

    const [feePlanRows, invoiceRows, paymentRows, recoveryView] = await Promise.all([
      responses[0].json() as Promise<FeePlan[]>,
      responses[1].json() as Promise<Invoice[]>,
      responses[2].json() as Promise<PaymentRecord[]>,
      responses[3].json() as Promise<RecoveryDashboard>
    ]);

    setFeePlans(feePlanRows);
    setInvoices(invoiceRows);
    setPayments(paymentRows);
    setRecovery(recoveryView);
  }, [api]);

  const loadReportCards = useCallback(async () => {
    if (!sessionRef.current) return;
    const response = await api("/report-cards");
    if (!response.ok) {
      setError(await parseError(response));
      return;
    }

    setReportCards((await response.json()) as ReportCard[]);
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

    const response = await api("/notifications", {}, false, { background: true });
    if (!response.ok) {
      setHeaderNotificationCount(0);
      return;
    }

    const rows = (await response.json()) as Array<{
      deliveryStatus?: string;
      status?: string;
    }>;

    const liveItems = rows.filter((item) => {
      const status = (item.status || "").toUpperCase();
      const deliveryStatus = (item.deliveryStatus || "").toUpperCase();
      return (
        status === "PENDING" ||
        status === "SCHEDULED" ||
        deliveryStatus === "QUEUED" ||
        deliveryStatus === "RETRYING"
      );
    });

    setHeaderNotificationCount(liveItems.length || rows.length);
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
      clearData();
      return;
    }

    if (isPreviewSession) {
      return;
    }

    if (!apiAvailable) {
      void ensureApiAvailable();
      return;
    }

    const needStudents = ["iam", "students", "parents", "enrollments", "grades", "schoolLifeAttendance"].some(
      (screen) => hasScreenAccess(currentRole, screen as ScreenId)
    );
    const needReference = ["reference", "teachers", "rooms", "enrollments", "grades", "schoolLifeAttendance", "schoolLifeTimetable", "teacherPortal"].some(
      (screen) => hasScreenAccess(currentRole, screen as ScreenId)
    );

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
          hasScreenAccess(currentRole, "iam") ||
          hasScreenAccess(currentRole, "parents") ||
          hasScreenAccess(currentRole, "reports")
        ) {
          await loadUsers();
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

  const toggleThemeMode = (): void => {
    const nextThemeMode = getNextThemeMode(themeMode);
    if (themeFlipTarget || nextThemeMode === themeMode) return;
    const animationDuration = getIconToggleAnimationDuration();
    if (animationDuration === 0) {
      setThemeMode(nextThemeMode);
      return;
    }

    if (themeFlipTimeoutRef.current !== null) {
      window.clearTimeout(themeFlipTimeoutRef.current);
    }

    setThemeFlipTarget(nextThemeMode);
    themeFlipTimeoutRef.current = window.setTimeout(() => {
      setThemeMode(nextThemeMode);
      setThemeFlipTarget(null);
      themeFlipTimeoutRef.current = null;
    }, animationDuration);
  };

  const selectThemeMode = (nextThemeMode: ThemeMode): void => {
    if (nextThemeMode === themeMode || themeFlipTarget) return;

    const animationDuration = getIconToggleAnimationDuration();
    if (animationDuration === 0) {
      setThemeMode(nextThemeMode);
      return;
    }

    if (themeFlipTimeoutRef.current !== null) {
      window.clearTimeout(themeFlipTimeoutRef.current);
    }

    setThemeFlipTarget(nextThemeMode);
    themeFlipTimeoutRef.current = window.setTimeout(() => {
      setThemeMode(nextThemeMode);
      setThemeFlipTarget(null);
      themeFlipTimeoutRef.current = null;
    }, animationDuration);
  };

  const cycleLanguage = (): void => {
    const nextLanguage = getNextUiLanguage(uiLanguage);
    if (languageFlipTarget || nextLanguage === uiLanguage) return;
    const animationDuration = getIconToggleAnimationDuration();
    if (animationDuration === 0) {
      setUiLanguage(nextLanguage);
      return;
    }

    if (languageFlipTimeoutRef.current !== null) {
      window.clearTimeout(languageFlipTimeoutRef.current);
    }

    setLanguageFlipTarget(nextLanguage);
    languageFlipTimeoutRef.current = window.setTimeout(() => {
      setUiLanguage(nextLanguage);
      setLanguageFlipTarget(null);
      languageFlipTimeoutRef.current = null;
    }, animationDuration);
  };

  const selectLanguage = (nextLanguage: UiLanguage): void => {
    if (nextLanguage === uiLanguage || languageFlipTarget) return;

    const animationDuration = getIconToggleAnimationDuration();
    if (animationDuration === 0) {
      setUiLanguage(nextLanguage);
      return;
    }

    if (languageFlipTimeoutRef.current !== null) {
      window.clearTimeout(languageFlipTimeoutRef.current);
    }

    setLanguageFlipTarget(nextLanguage);
    languageFlipTimeoutRef.current = window.setTimeout(() => {
      setUiLanguage(nextLanguage);
      setLanguageFlipTarget(null);
      languageFlipTimeoutRef.current = null;
    }, animationDuration);
  };

  const showLoginPanel = (): void => {
    setAuthAssistMode("none");
    setError(null);
    setNotice(null);
  };

  const showForgotPasswordPanel = (): void => {
    setAuthAssistMode("forgot");
    setError(null);
    setNotice(null);
  };

  const showFirstConnectionPanel = (): void => {
    setAuthAssistMode("first");
    setError(null);
    setNotice(null);
  };

  const performPublicRequest = useCallback(
    async (
      path: string,
      init: RequestInit,
      options: { forceProbe?: boolean; suppressError?: boolean } = {}
    ): Promise<Response | null> => {
      const { forceProbe = true, suppressError = false } = options;
      const ready = await ensureApiAvailable(forceProbe);
      if (!ready) {
        if (!suppressError) {
          setError("API indisponible. Reconnexion...");
        }
        return null;
      }

      try {
        const response = await fetch(resolveApiUrl(path), init);
        markApiAvailable();
        return response;
      } catch {
        markApiUnavailable();
        if (!suppressError) {
          setError("API indisponible. Reconnexion...");
        }
        return null;
      }
    },
    [ensureApiAvailable, markApiAvailable, markApiUnavailable, resolveApiUrl]
  );

  const requestForgotPasswordToken = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!forgotPasswordForm.username.trim()) {
      setError("Renseigner votre identifiant pour demander un token de reinitialisation.");
      return;
    }

    setAuthAssistLoading(true);
    try {
      const response = await performPublicRequest("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: forgotPasswordForm.username.trim(),
          tenantId: DEFAULT_TENANT
        })
      });
      if (!response) return;
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      const payload = (await response.json()) as ForgotPasswordResponse;
      setNotice(payload.message || "Demande de reinitialisation enregistree.");
    } finally {
      setAuthAssistLoading(false);
    }
  };

  const submitResetPassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!resetPasswordForm.token.trim()) {
      setError("Token de reinitialisation requis.");
      return;
    }
    if (!isStrongPassword(resetPasswordForm.newPassword)) {
      setError(STRONG_PASSWORD_HINT);
      return;
    }
    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      setError("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setAuthAssistLoading(true);
    try {
      const response = await performPublicRequest("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: resetPasswordForm.token.trim(),
          newPassword: resetPasswordForm.newPassword
        })
      });
      if (!response) return;
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      const payload = (await response.json()) as AuthMessageResponse;
      setNotice(payload.message || "Mot de passe reinitialise.");
      setLoginForm((prev) => ({
        ...prev,
        username: forgotPasswordForm.username.trim() || prev.username,
        tenantId: DEFAULT_TENANT,
        password: ""
      }));
      setResetPasswordForm({ token: "", newPassword: "", confirmPassword: "" });
      setAuthAssistMode("none");
    } finally {
      setAuthAssistLoading(false);
    }
  };

  const submitFirstConnection = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!firstConnectionForm.username.trim()) {
      setError("Identifiant requis.");
      return;
    }
    if (!firstConnectionForm.temporaryPassword || firstConnectionForm.temporaryPassword.length < 8) {
      setError("Mot de passe temporaire invalide.");
      return;
    }
    if (!isStrongPassword(firstConnectionForm.newPassword)) {
      setError(STRONG_PASSWORD_HINT);
      return;
    }
    if (firstConnectionForm.newPassword !== firstConnectionForm.confirmPassword) {
      setError("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setAuthAssistLoading(true);
    try {
      const response = await performPublicRequest("/auth/first-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: firstConnectionForm.username.trim(),
          tenantId: DEFAULT_TENANT,
          temporaryPassword: firstConnectionForm.temporaryPassword,
          newPassword: firstConnectionForm.newPassword
        })
      });
      if (!response) return;
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }

      const payload = (await response.json()) as AuthMessageResponse;
      setNotice(payload.message || "Premiere connexion finalisee.");
      setLoginForm((prev) => ({
        ...prev,
        username: firstConnectionForm.username.trim(),
        tenantId: DEFAULT_TENANT,
        password: firstConnectionForm.newPassword
      }));
      setFirstConnectionForm((prev) => ({
        ...prev,
        temporaryPassword: "",
        newPassword: "",
        confirmPassword: ""
      }));
      setAuthAssistMode("none");
    } finally {
      setAuthAssistLoading(false);
    }
  };

  const login = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const errors: FieldErrors = {};
    if (!loginForm.username.trim()) errors.username = "Nom utilisateur requis.";
    if (!loginForm.password || loginForm.password.length < 8) errors.password = "Minimum 8 caracteres.";
    setLoginErrors(errors);
    if (hasFieldErrors(errors)) {
      focusFirstInlineErrorField();
      return;
    }
    setLoadingAuth(true);
    try {
      const response = await performPublicRequest("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginForm.username.trim(),
          password: loginForm.password,
          tenantId: DEFAULT_TENANT
        })
      });
      if (!response) return;
      if (!response.ok) {
        setError(await parseError(response));
        return;
      }
      const payload = (await response.json()) as Omit<Session, "tenantId"> & { user: Session["user"] };
      const nextSession = { ...payload, tenantId: payload.user.tenantId || DEFAULT_TENANT };
      const role = (nextSession.user.role as Role) || "ADMIN";
      const cleanUsername = loginForm.username.trim();
      const cleanTenant = payload.user.tenantId || DEFAULT_TENANT;
      setLoginErrors({});
      saveSession(nextSession);
      setLastSyncAt(new Date().toISOString());
      setAuthAssistMode("none");
      if (rememberMe) {
        localStorage.setItem(
          LOGIN_HINT_STORAGE_KEY,
          JSON.stringify({
            username: cleanUsername,
            tenantId: cleanTenant,
            remember: true
          } as RememberedLogin)
        );
      } else {
        localStorage.removeItem(LOGIN_HINT_STORAGE_KEY);
      }
      setNotice("Connexion reussie.");
      setTab(ROLE_HOME_SCREEN[role] || "dashboard");
    } finally {
      setLoadingAuth(false);
    }
  };

  const logout = async (): Promise<void> => {
    const current = sessionRef.current;
    if (current?.refreshToken && (await ensureApiAvailable())) {
      await performPublicRequest("/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken })
      }, { forceProbe: false, suppressError: true });
    }
    clearSession();
    setAuthAssistMode("none");
    setResetPasswordForm({ token: "", newPassword: "", confirmPassword: "" });
    clearData();
    setNotice("Deconnexion reussie.");
    setError(null);
  };
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
  const renderDashboard = (): JSX.Element => {
    return (
      <DashboardScreen
        currentRole={currentRole}
        currentSlide={currentSlide}
        defaultActionScreen={ROLE_HOME_SCREEN[currentRole || "ADMIN"] || "dashboard"}
        filteredTiles={filteredTiles}
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
        moduleQuery={moduleQuery}
        mobileTasksOpen={mobileTasksOpen}
        onClearModuleFilter={() => {
          setModuleQueryInput("");
          setModuleQuery("");
        }}
        onSelectScreen={setTab}
        onToggleMobileTasks={() => setMobileTasksOpen((prev) => !prev)}
        formatMoney={formatMoney}
        hasScreenAccess={hasScreenAccess}
        currentRoleLabel={currentRoleLabel}
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
      isStrongPassword={isStrongPassword}
      strongPasswordHint={STRONG_PASSWORD_HINT}
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
          onEnrollmentsChange={setEnrollments}
          onError={setError}
          onNotice={setNotice}
        />
      );
    }
    if (tab === "finance") return renderFinance();
    if (tab === "messages") return renderMessages();
    if (tab === "reports") return renderReports();
    if (tab === "mosquee") return renderMosquee();
    if (tab === "grades") return renderGrades();
    if (tab === "schoolLifeOverview") {
      return (
        <SchoolLifePanel
          api={api}
          students={students}
          classes={classes}
          subjects={subjects}
          locale={currentLanguageMeta.locale}
          onError={setError}
          onNotice={setNotice}
          focusSection="overview"
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
  const profileInitial = session?.user.username?.charAt(0)?.toUpperCase() || "U";
  const profileContextLabel = currentRole ? ROLE_CONTEXT_LABELS[currentRole] : "Session";
  const quickLinks = homeTiles.filter((tile) => tile.screen !== tab).slice(0, 4);
  const nextLanguage = languageFlipTarget || getNextUiLanguage(uiLanguage);
  const nextLanguageMeta = UI_LANGUAGE_META[nextLanguage];
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
      helperText: allowed ? undefined : "Acces restreint",
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
  const scolariteActions: HeaderNavigationAction[] = [
    buildHeaderAction("enrollments", "Inscriptions"),
    buildHeaderAction("iam", "Utilisateurs & droits"),
    buildHeaderAction("teachers", "Enseignants"),
    buildHeaderAction("rooms", "Salles"),
    buildHeaderAction("students", "Eleves"),
    buildHeaderAction("parents", "Parents"),
    buildHeaderAction("finance", "Comptabilite")
  ];
  const schoolLifeActions: HeaderNavigationAction[] = [
    buildHeaderAction("grades", "Notes & bulletins"),
    buildHeaderAction("messages", "Messagerie"),
    buildHeaderAction("schoolLifeOverview", "Pilotage"),
    buildHeaderAction("schoolLifeAttendance", "Absences"),
    buildHeaderAction("schoolLifeTimetable", "Emploi du temps"),
    buildHeaderAction("schoolLifeNotifications", "Notifications")
  ];
  const settingsActions: HeaderNavigationAction[] = [
    buildHeaderAction("reference", "Referentiel"),
    buildHeaderAction("reports", "Rapports & conformite")
  ];
  const settingsGroups: HeaderNavigationGroup[] = [
    {
      id: "mosquee-management",
      label: "Gestion mosquee",
      items: [buildHeaderAction("mosquee", "Mosquee")]
    }
  ];
  const portalActions: HeaderNavigationAction[] = [
    currentRole === "ENSEIGNANT" ? buildHeaderAction("teacherPortal", "Portail enseignant") : null,
    currentRole === "PARENT" ? buildHeaderAction("parentPortal", "Portail parent") : null,
    currentRole === "STUDENT" ? buildHeaderAction("studentPortal", "Portail eleve") : null
  ].filter((item): item is HeaderNavigationAction => item !== null);
  const sidebarGroups =
    currentRole === "ENSEIGNANT" || currentRole === "PARENT" || currentRole === "STUDENT"
      ? [{ id: "portal", title: "Acces rapide", items: portalActions }]
      : [
          { id: "pilotage", title: "Pilotage", items: [dashboardAction] },
          { id: "scolarite", title: "Scolarite", items: scolariteActions },
          { id: "school-life", title: "Vie scolaire", items: schoolLifeActions },
          {
            id: "settings",
            title: "Parametres",
            items: [...settingsActions, ...settingsGroups.flatMap((group) => group.items)]
          }
        ];
  const preferenceActions: HeaderPreferenceAction[] = [
    {
      id: "language",
      label: "Changer la langue",
      helperText: `${currentLanguageMeta.label} -> ${nextLanguageMeta.label}`,
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
            onRememberMeChange={(next) => {
              setRememberMe(next);
              if (!next) localStorage.removeItem(LOGIN_HINT_STORAGE_KEY);
            }}
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
            onEnterPreview={enterPreview}
            previewEnabled={PREVIEW_MODE_ENABLED}
          />
        </Suspense>
      ) : (
        <section className="workspace fade-up">
          <HeaderNavigation
            brandName={SCHOOL_NAME}
            logoAlt={`Logo ${SCHOOL_NAME}`}
            logoSrc="/logo.png"
            sidebarCollapsed={sidebarCollapsed}
            searchPlaceholder="Rechercher un module, un ecran, une action..."
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
            messages={{
              active: messageActive,
              count: headerMessageCount,
              disabled: true,
              label: "Messagerie en apercu",
              statusLabel: "Module UI-only, backend messagerie non branche",
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
              contextLabel: profileContextLabel,
              roleLabel: currentRoleLabel,
              secondaryLabel: `Annee: ${schoolYearLabel}`,
              username: session.user.username,
              onLogout: () => void logout()
            }}
          />

          <div className={`app-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`.trim()}>
            <AppSidebar
              brandName={SCHOOL_NAME}
              currentRoleLabel={currentRoleLabel}
              groups={sidebarGroups}
            />
            <div className="app-shell-main">
              {isPreviewSession ? (
                <section className="notice-card notice-warning" role="status">
                  <strong>Mode apercu local</strong>
                  <p>
                    Les donnees affichees sont des donnees de demonstration chargees dans le navigateur.
                    Elles ne sont pas persistees dans l'API ni dans PostgreSQL.
                  </p>
                </section>
              ) : null}

              {tab !== "dashboard" ? (
                <section key={`context-${tab}`} className="panel context-bar">
                  <div className="context-copy">
                    <p className="eyebrow">Module actif</p>
                    <h2>{activeScreen.label}</h2>
                  </div>
                  <div className="context-actions">
                    <button type="button" className="button-ghost" onClick={() => setTab("dashboard")}>
                      Retour accueil
                    </button>
                    {quickLinks.slice(0, 2).map((tile) => (
                      <button
                        key={`shortcut-${tile.screen}`}
                        type="button"
                        className="mini-link"
                        onClick={() => setTab(tile.screen)}
                      >
                        {tile.title}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section key={tab} className="screen-host">
                <Suspense fallback={<ScreenLoadingFallback />}>{renderActiveScreen()}</Suspense>
              </section>

              <footer className="panel app-footer app-footer-minimal">
                <div className="footer-head">
                  <strong>{SCHOOL_NAME}</strong>
                  <div className="footer-meta">
                    <span>Annee: {schoolYearLabel}</span>
                    <span>Derniere sync: {lastSyncLabel}</span>
                    {apiConnection.status !== "online" ? <span>{apiStatusText}</span> : null}
                  </div>
                </div>
              </footer>
            </div>
          </div>
        </section>
      )}

      {error || notice ? (
        <div className="toast-stack" aria-live="polite" aria-atomic="true">
          {error ? (
            <div className="toast-pop toast-pop-error" role="alert">
              <div>
                <strong>Attention</strong>
                <p>{error}</p>
              </div>
              <button type="button" aria-label="Fermer la notification d'erreur" onClick={() => setError(null)}>
                Fermer
              </button>
            </div>
          ) : null}
          {notice ? (
            <div className="toast-pop toast-pop-success" role="status">
              <div>
                <strong>Information</strong>
                <p>{notice}</p>
              </div>
              <button type="button" aria-label="Fermer la notification" onClick={() => setNotice(null)}>
                Fermer
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
