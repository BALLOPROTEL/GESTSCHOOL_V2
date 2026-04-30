import type {
  GradeEntry,
  PortalNotification,
  TeacherClass,
  TeacherOverview,
  TeacherStudent
} from "../../../shared/types/app";
import { parsePortalError } from "./portal-service";
import type {
  PortalApiClient,
  TeacherPortalData,
  TeacherPortalFilters,
  TeacherTimetableSlot
} from "../types/portal-teacher";

export const fetchTeacherPortalData = async (
  api: PortalApiClient,
  filters: TeacherPortalFilters
): Promise<TeacherPortalData> => {
  const query = new URLSearchParams();
  if (filters.classId) query.set("classId", filters.classId);
  if (filters.subjectId) query.set("subjectId", filters.subjectId);
  if (filters.academicPeriodId) query.set("academicPeriodId", filters.academicPeriodId);
  if (filters.studentId) query.set("studentId", filters.studentId);
  const suffix = query.toString() ? `?${query.toString()}` : "";

  const responses = await Promise.all([
    api("/portal/teacher/overview"),
    api("/portal/teacher/classes"),
    api(`/portal/teacher/students${filters.classId ? `?classId=${encodeURIComponent(filters.classId)}` : ""}`),
    api(`/portal/teacher/grades${suffix}`),
    api(`/portal/teacher/timetable${filters.classId ? `?classId=${encodeURIComponent(filters.classId)}` : ""}`),
    api(`/portal/teacher/notifications${filters.classId ? `?classId=${encodeURIComponent(filters.classId)}` : ""}`)
  ]);

  const failed = responses.find((item) => !item.ok);
  if (failed) {
    throw new Error(await parsePortalError(failed));
  }

  const [overview, classes, students, grades, timetable, notifications] = await Promise.all([
    responses[0].json() as Promise<TeacherOverview>,
    responses[1].json() as Promise<TeacherClass[]>,
    responses[2].json() as Promise<TeacherStudent[]>,
    responses[3].json() as Promise<GradeEntry[]>,
    responses[4].json() as Promise<TeacherTimetableSlot[]>,
    responses[5].json() as Promise<PortalNotification[]>
  ]);

  return { overview, classes, students, grades, timetable, notifications };
};

export const createTeacherPortalGrade = async (
  api: PortalApiClient,
  payload: Record<string, unknown>
): Promise<GradeEntry> => {
  const response = await api("/portal/teacher/grades", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parsePortalError(response));
  }
  return (await response.json()) as GradeEntry;
};

export const createTeacherAttendanceBulk = async (
  api: PortalApiClient,
  payload: Record<string, unknown>
): Promise<void> => {
  const response = await api("/portal/teacher/attendance/bulk", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parsePortalError(response));
  }
};

export const createTeacherNotification = async (
  api: PortalApiClient,
  payload: Record<string, unknown>
): Promise<PortalNotification> => {
  const response = await api("/portal/teacher/notifications", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await parsePortalError(response));
  }
  return (await response.json()) as PortalNotification;
};
