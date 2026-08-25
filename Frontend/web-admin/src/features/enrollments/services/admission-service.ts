import type { EnrollmentsApiClient } from "../types/enrollments";
import type {
  AdmissionAcademicOptions,
  AdmissionCase,
  AdmissionCasePage,
  AdmissionFinanceOptions,
  AdmissionFinalizationResult,
  AdmissionGuardianSearchQuery,
  AdmissionGuardianSearchResult,
  AdmissionMode,
  AdmissionPrerequisites,
  AdmissionSection,
  AdmissionStudentSearchQuery,
  AdmissionStudentSearchResult
} from "../types/admission";

export class AdmissionApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(code);
    this.name = "AdmissionApiError";
  }
}

const readJson = async <T>(response: Response): Promise<T> => {
  if (response.ok) return (await response.json()) as T;

  let code = `HTTP_${response.status}`;
  try {
    const payload = (await response.json()) as { code?: unknown };
    if (typeof payload.code === "string" && payload.code.trim()) code = payload.code.trim();
  } catch {
    // The status code remains a stable, non-sensitive fallback.
  }
  throw new AdmissionApiError(code, response.status);
};

const withQuery = (path: string, values: Record<string, string | number | undefined>): string => {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim()) query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
};

const jsonRequest = (method: "POST" | "PATCH", body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

export const getAdmissionPrerequisites = async (
  api: EnrollmentsApiClient
): Promise<AdmissionPrerequisites> => readJson(await api("/admission-prerequisites"));

export const createAdmissionCase = async (
  api: EnrollmentsApiClient,
  mode: AdmissionMode,
  studentId?: string
): Promise<AdmissionCase> =>
  readJson(await api("/admission-cases", jsonRequest("POST", { mode, ...(studentId ? { studentId } : {}) })));

export const listAdmissionCases = async (
  api: EnrollmentsApiClient,
  page = 1,
  limit = 25
): Promise<AdmissionCasePage> =>
  readJson(await api(withQuery("/admission-cases", { page, limit })));

export const getAdmissionCase = async (
  api: EnrollmentsApiClient,
  id: string
): Promise<AdmissionCase> => readJson(await api(`/admission-cases/${encodeURIComponent(id)}`));

export const saveAdmissionSection = async (
  api: EnrollmentsApiClient,
  admissionCase: Pick<AdmissionCase, "id" | "version">,
  section: AdmissionSection,
  data: Record<string, unknown>
): Promise<AdmissionCase> =>
  readJson(
    await api(
      `/admission-cases/${encodeURIComponent(admissionCase.id)}/sections/${section}`,
      jsonRequest("PATCH", { expectedVersion: admissionCase.version, data })
    )
  );

export const cancelAdmissionCase = async (
  api: EnrollmentsApiClient,
  admissionCase: Pick<AdmissionCase, "id" | "version">
): Promise<AdmissionCase> =>
  readJson(
    await api(
      `/admission-cases/${encodeURIComponent(admissionCase.id)}/cancel`,
      jsonRequest("POST", { expectedVersion: admissionCase.version })
    )
  );

export const reopenAdmissionCase = async (
  api: EnrollmentsApiClient,
  admissionCase: Pick<AdmissionCase, "id" | "version">
): Promise<AdmissionCase> =>
  readJson(
    await api(
      `/admission-cases/${encodeURIComponent(admissionCase.id)}/reopen`,
      jsonRequest("POST", { expectedVersion: admissionCase.version })
    )
  );

export const finalizeAdmissionCase = async (
  api: EnrollmentsApiClient,
  admissionCase: Pick<AdmissionCase, "id" | "version">,
  idempotencyKey: string
): Promise<AdmissionFinalizationResult> =>
  readJson(
    await api(
      `/admission-cases/${encodeURIComponent(admissionCase.id)}/finalize`,
      jsonRequest("POST", { expectedVersion: admissionCase.version, idempotencyKey })
    )
  );

export const searchAdmissionStudents = async (
  api: EnrollmentsApiClient,
  query: AdmissionStudentSearchQuery
): Promise<AdmissionStudentSearchResult> =>
  readJson(await api(withQuery("/admission-cases/search/students", query)));

export const searchAdmissionGuardians = async (
  api: EnrollmentsApiClient,
  query: AdmissionGuardianSearchQuery
): Promise<AdmissionGuardianSearchResult> =>
  readJson(await api(withQuery("/admission-cases/search/guardians", query)));

export const getAdmissionAcademicOptions = async (
  api: EnrollmentsApiClient,
  selection: Record<string, string | undefined>
): Promise<AdmissionAcademicOptions> =>
  readJson(await api(withQuery("/admission-cases/academic-options", selection)));

export const getAdmissionFinanceOptions = async (
  api: EnrollmentsApiClient,
  admissionCaseId: string
): Promise<AdmissionFinanceOptions> =>
  readJson(await api(withQuery("/admission-cases/finance-options", { admissionCaseId })));
