import { parseApiError } from "../../../shared/services/api-errors";
import type { Enrollment } from "../../../shared/types/app";
import type {
  EnrollmentPlacementPayload,
  EnrollmentFilters,
  EnrollmentsApiClient
} from "../types/enrollments";

export const parseEnrollmentsError = parseApiError;

export const fetchEnrollments = async (
  api: EnrollmentsApiClient,
  filters: EnrollmentFilters
): Promise<Enrollment[]> => {
  const query = new URLSearchParams();
  if (filters.schoolYearId) query.set("schoolYearId", filters.schoolYearId);
  if (filters.classId) query.set("classId", filters.classId);
  if (filters.studentId) query.set("studentId", filters.studentId);
  if (filters.track) query.set("track", filters.track);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await api(`/enrollments${suffix}`);
  if (!response.ok) {
    throw new Error(await parseEnrollmentsError(response));
  }
  return (await response.json()) as Enrollment[];
};

export const createEnrollment = async (
  api: EnrollmentsApiClient,
  payload: Record<string, unknown>
): Promise<Enrollment> => {
  const response = await api("/enrollments", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parseEnrollmentsError(response));
  }
  return (await response.json()) as Enrollment;
};

export const upsertEnrollmentPlacement = async (
  api: EnrollmentsApiClient,
  payload: EnrollmentPlacementPayload
): Promise<Enrollment> => {
  const response = await api("/enrollments/placements", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parseEnrollmentsError(response));
  }
  return (await response.json()) as Enrollment;
};

export const removeEnrollment = async (
  api: EnrollmentsApiClient,
  id: string
): Promise<void> => {
  const response = await api(`/enrollments/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await parseEnrollmentsError(response));
  }
};
