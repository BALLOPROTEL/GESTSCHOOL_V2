import type {
  ClassSummary,
  GradeEntry,
  ReportCard
} from "../../../shared/types/app";
import type { GradeFilters, GradesApiClient } from "../types/grades";

export const parseGradesError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(payload.message)) return payload.message.join(", ");
    if (typeof payload.message === "string") return payload.message;
    if (typeof payload.error === "string") return payload.error;
  } catch {
    // Keep a stable fallback for non-JSON API errors.
  }
  return `Erreur HTTP ${response.status}`;
};

export const fetchGrades = async (
  api: GradesApiClient,
  filters: GradeFilters
): Promise<GradeEntry[]> => {
  const query = new URLSearchParams();
  if (filters.classId) query.set("classId", filters.classId);
  if (filters.subjectId) query.set("subjectId", filters.subjectId);
  if (filters.academicPeriodId) query.set("academicPeriodId", filters.academicPeriodId);
  if (filters.studentId) query.set("studentId", filters.studentId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await api(`/grades${suffix}`);
  if (!response.ok) {
    throw new Error(await parseGradesError(response));
  }
  return (await response.json()) as GradeEntry[];
};

export const fetchReportCards = async (api: GradesApiClient): Promise<ReportCard[]> => {
  const response = await api("/report-cards");
  if (!response.ok) {
    throw new Error(await parseGradesError(response));
  }
  return (await response.json()) as ReportCard[];
};

export const createGrade = async (
  api: GradesApiClient,
  payload: Record<string, unknown>
): Promise<GradeEntry> => {
  const response = await api("/grades", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parseGradesError(response));
  }
  return (await response.json()) as GradeEntry;
};

export const fetchClassSummary = async (
  api: GradesApiClient,
  classId: string,
  academicPeriodId: string
): Promise<ClassSummary> => {
  const response = await api(
    `/grades/class-summary?classId=${encodeURIComponent(classId)}&academicPeriodId=${encodeURIComponent(academicPeriodId)}`
  );
  if (!response.ok) {
    throw new Error(await parseGradesError(response));
  }
  return (await response.json()) as ClassSummary;
};

export const generateReportCard = async (
  api: GradesApiClient,
  payload: Record<string, unknown>
): Promise<ReportCard> => {
  const response = await api("/report-cards/generate", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parseGradesError(response));
  }
  return (await response.json()) as ReportCard;
};

export const fetchReportCardPdf = async (
  api: GradesApiClient,
  reportCardId: string
): Promise<string> => {
  const response = await api(`/report-cards/${reportCardId}/pdf`);
  if (!response.ok) {
    throw new Error(await parseGradesError(response));
  }
  const payload = (await response.json()) as { pdfDataUrl: string };
  return payload.pdfDataUrl;
};
