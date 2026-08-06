import type {
  Enrollment,
  FeePlan,
  Invoice,
  PaymentRecord,
  RecoveryDashboard,
  ReportCard,
  Role,
  ScreenId,
  Student,
  UserAccount
} from "../shared/types/app";
import { UI_MESSAGES } from "../shared/i18n";
import { fetchReferenceData } from "../features/reference/services/reference-service";
import type { ReferenceData } from "../features/reference/types/reference";
import { hasScreenAccess } from "./navigation/screen-registry";
import { parseError } from "./app-formatters";

export type AppApiClient = (
  path: string,
  init?: RequestInit,
  retry?: boolean,
  options?: { background?: boolean; forceProbe?: boolean }
) => Promise<Response>;

type LoadResult<T> = {
  data: T;
  error?: string;
};

type EnrollmentFilters = {
  classId?: string;
  schoolYearId?: string;
  studentId?: string;
  track?: string;
};

type FinanceBootstrapData = {
  feePlans: FeePlan[];
  invoices: Invoice[];
  payments: PaymentRecord[];
  recovery: RecoveryDashboard;
};

type BootstrapNeeds = {
  needReference: boolean;
  needStudents: boolean;
};

type NotificationSummaryRow = {
  deliveryStatus?: string;
  status?: string;
};

const STUDENT_BOOTSTRAP_SCREENS: ScreenId[] = [
  "iam",
  "students",
  "parents",
  "enrollments",
  "grades",
  "schoolLifeAttendance"
];

const REFERENCE_BOOTSTRAP_SCREENS: ScreenId[] = [
  "reference",
  "teachers",
  "rooms",
  "enrollments",
  "grades",
  "schoolLifeAttendance",
  "schoolLifeTimetable",
  "teacherPortal"
];

const readListResponse = async <T>(
  response: Response,
  fallbackMessage: string,
  silentForbidden = false
): Promise<LoadResult<T[]>> => {
  if (!response.ok) {
    return {
      data: [],
      error: silentForbidden && response.status === 403 ? undefined : await parseError(response)
    };
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(payload)) {
    return { data: [], error: fallbackMessage };
  }

  return { data: payload as T[] };
};

const enrollmentSuffix = (filters: EnrollmentFilters): string => {
  const query = new URLSearchParams();
  if (filters.schoolYearId) query.set("schoolYearId", filters.schoolYearId);
  if (filters.classId) query.set("classId", filters.classId);
  if (filters.studentId) query.set("studentId", filters.studentId);
  if (filters.track) query.set("track", filters.track);
  return query.toString() ? `?${query.toString()}` : "";
};

export const resolveBootstrapNeeds = (role: Role): BootstrapNeeds => ({
  needReference: REFERENCE_BOOTSTRAP_SCREENS.some((screen) => hasScreenAccess(role, screen)),
  needStudents: STUDENT_BOOTSTRAP_SCREENS.some((screen) => hasScreenAccess(role, screen))
});

export const loadStudentsData = async (api: AppApiClient): Promise<LoadResult<Student[]>> =>
  readListResponse<Student>(
    await api("/students"),
    UI_MESSAGES.loadError
  );

export const loadUsersData = async (
  api: AppApiClient,
  currentRole: Role
): Promise<LoadResult<UserAccount[]>> =>
  readListResponse<UserAccount>(
    await api("/users", {}, true, { background: currentRole !== "ADMIN" }),
    UI_MESSAGES.loadError,
    currentRole !== "ADMIN"
  );

export const loadReferenceData = async (
  api: AppApiClient
): Promise<LoadResult<ReferenceData>> => {
  const { data, errors } = await fetchReferenceData(api);
  return {
    data,
    error: errors[0]
  };
};

export const loadEnrollmentsData = async (
  api: AppApiClient,
  filters: EnrollmentFilters = {}
): Promise<LoadResult<Enrollment[]>> =>
  readListResponse<Enrollment>(
    await api(`/enrollments${enrollmentSuffix(filters)}`),
    UI_MESSAGES.loadError
  );

export const loadFinanceData = async (api: AppApiClient): Promise<LoadResult<FinanceBootstrapData | null>> => {
  const responses = await Promise.all([
    api("/fee-plans"),
    api("/invoices"),
    api("/payments"),
    api("/finance/recovery")
  ]);

  const failed = responses.find((item) => !item.ok);
  if (failed) {
    return { data: null, error: await parseError(failed) };
  }

  const [feePlans, invoices, payments, recovery] = await Promise.all([
    responses[0].json() as Promise<FeePlan[]>,
    responses[1].json() as Promise<Invoice[]>,
    responses[2].json() as Promise<PaymentRecord[]>,
    responses[3].json() as Promise<RecoveryDashboard>
  ]);

  return {
    data: {
      feePlans,
      invoices,
      payments,
      recovery
    }
  };
};

export const loadReportCardsData = async (api: AppApiClient): Promise<LoadResult<ReportCard[]>> =>
  readListResponse<ReportCard>(
    await api("/report-cards"),
    UI_MESSAGES.loadError
  );

export const loadHeaderNotificationRows = async (
  api: AppApiClient
): Promise<LoadResult<NotificationSummaryRow[]>> =>
  readListResponse<NotificationSummaryRow>(
    await api("/notifications", {}, false, { background: true }),
    UI_MESSAGES.loadError,
    true
  );

export const countActionableNotifications = (
  rows: NotificationSummaryRow[]
): number => {
  const liveItems = rows.filter((item) => {
    const status = (item.status || "").toUpperCase();
    const deliveryStatus = (item.deliveryStatus || "").toUpperCase();
    return (
      status === "PENDING" ||
      status === "PROCESSING" ||
      status === "FAILED_RETRYABLE" ||
      deliveryStatus === "PENDING" ||
      deliveryStatus === "PROCESSING" ||
      deliveryStatus === "FAILED_RETRYABLE"
    );
  });

  return liveItems.length || rows.length;
};
