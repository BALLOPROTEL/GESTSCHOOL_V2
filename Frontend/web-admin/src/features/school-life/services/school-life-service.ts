import { parseApiError } from "../../../shared/services/api-errors";
import type {
  AttendanceAttachment,
  AttendanceRecord,
  AttendanceSummary,
  BulkAttendanceResponse,
  DispatchResult,
  NotificationItem,
  RoomRef,
  TeacherAssignmentRef,
  TimetableGrid,
  TimetableSlot
} from "../types/school-life";

export type SchoolLifeApiClient = (path: string, init?: RequestInit) => Promise<Response>;

export type AttendanceFilters = {
  classId: string;
  studentId: string;
  status: string;
  fromDate: string;
  toDate: string;
};

export type TimetableFilters = {
  classId: string;
  dayOfWeek: string;
};

export type NotificationFilters = {
  status: string;
  channel: string;
  deliveryStatus: string;
};

const readJson = async <T>(responseOrPromise: Response | Promise<Response>): Promise<T> => {
  const response = await responseOrPromise;
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as T;
};

const ensureOk = async (responseOrPromise: Response | Promise<Response>): Promise<void> => {
  const response = await responseOrPromise;
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
};

const suffixFrom = (entries: Array<[string, string | undefined]>): string => {
  const query = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value) query.set(key, value);
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
};

export const fetchAttendance = (api: SchoolLifeApiClient, filters: AttendanceFilters) =>
  readJson<AttendanceRecord[]>(
    api(
      `/attendance${suffixFrom([
        ["classId", filters.classId],
        ["studentId", filters.studentId],
        ["status", filters.status],
        ["fromDate", filters.fromDate],
        ["toDate", filters.toDate]
      ])}`
    )
  );

export const fetchAttendanceSummary = (api: SchoolLifeApiClient, filters: AttendanceFilters) =>
  readJson<AttendanceSummary>(
    api(
      `/attendance/summary${suffixFrom([
        ["classId", filters.classId],
        ["fromDate", filters.fromDate],
        ["toDate", filters.toDate]
      ])}`
    )
  );

export const fetchAttendanceAttachments = (api: SchoolLifeApiClient, attendanceId: string) =>
  readJson<AttendanceAttachment[]>(api(`/attendance/${attendanceId}/attachments`));

export const createAttendance = (
  api: SchoolLifeApiClient,
  payload: Record<string, unknown>
) =>
  readJson<AttendanceRecord>(
    api("/attendance", {
      method: "POST",
      body: JSON.stringify(payload)
    })
  );

export const deleteAttendanceById = async (
  api: SchoolLifeApiClient,
  attendanceId: string
): Promise<void> => {
  await ensureOk(api(`/attendance/${attendanceId}`, { method: "DELETE" }));
};

export const createAttendanceAttachment = (
  api: SchoolLifeApiClient,
  attendanceId: string,
  payload: Record<string, unknown>
) =>
  readJson<AttendanceAttachment>(
    api(`/attendance/${attendanceId}/attachments`, {
      method: "POST",
      body: JSON.stringify(payload)
    })
  );

export const deleteAttendanceAttachment = async (
  api: SchoolLifeApiClient,
  attendanceId: string,
  attachmentId: string
): Promise<void> => {
  await ensureOk(api(`/attendance/${attendanceId}/attachments/${attachmentId}`, { method: "DELETE" }));
};

export const updateAttendanceValidation = (
  api: SchoolLifeApiClient,
  attendanceId: string,
  payload: Record<string, unknown>
) =>
  readJson<AttendanceRecord>(
    api(`/attendance/${attendanceId}/validation`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    })
  );

export const createBulkAttendance = (
  api: SchoolLifeApiClient,
  payload: Record<string, unknown>
) =>
  readJson<BulkAttendanceResponse>(
    api("/attendance/bulk", {
      method: "POST",
      body: JSON.stringify(payload)
    })
  );

export const fetchTimetableSlots = (api: SchoolLifeApiClient, filters: TimetableFilters) =>
  readJson<TimetableSlot[]>(
    api(
      `/timetable-slots${suffixFrom([
        ["classId", filters.classId],
        ["dayOfWeek", filters.dayOfWeek]
      ])}`
    )
  );

export const fetchTimetableGrid = (api: SchoolLifeApiClient, filters: TimetableFilters) =>
  readJson<TimetableGrid>(
    api(`/timetable-slots/grid${suffixFrom([["classId", filters.classId]])}`)
  );

export const fetchTimetableReferences = async (api: SchoolLifeApiClient) => {
  const [roomsResponse, assignmentsResponse] = await Promise.all([
    api("/rooms"),
    api("/teachers/assignments")
  ]);

  const rooms = await readJson<RoomRef[]>(roomsResponse);
  const teacherAssignments = await readJson<TeacherAssignmentRef[]>(assignmentsResponse);
  return { rooms, teacherAssignments };
};

export const createTimetableSlot = async (
  api: SchoolLifeApiClient,
  payload: Record<string, unknown>
): Promise<void> => {
  await ensureOk(
    api("/timetable-slots", {
      method: "POST",
      body: JSON.stringify(payload)
    })
  );
};

export const deleteTimetableSlotById = async (
  api: SchoolLifeApiClient,
  timetableSlotId: string
): Promise<void> => {
  await ensureOk(api(`/timetable-slots/${timetableSlotId}`, { method: "DELETE" }));
};

export const fetchNotifications = (api: SchoolLifeApiClient, filters: NotificationFilters) =>
  readJson<NotificationItem[]>(
    api(
      `/notifications${suffixFrom([
        ["status", filters.status],
        ["channel", filters.channel],
        ["deliveryStatus", filters.deliveryStatus]
      ])}`
    )
  );

export const createNotification = async (
  api: SchoolLifeApiClient,
  payload: Record<string, unknown>
): Promise<void> => {
  await ensureOk(
    api("/notifications", {
      method: "POST",
      body: JSON.stringify(payload)
    })
  );
};

export const dispatchPendingNotifications = (api: SchoolLifeApiClient, limit: number) =>
  readJson<DispatchResult>(
    api("/notifications/dispatch-pending", {
      method: "POST",
      body: JSON.stringify({ limit })
    })
  );

export const markNotificationSent = async (
  api: SchoolLifeApiClient,
  notificationId: string
): Promise<void> => {
  await ensureOk(
    api(`/notifications/${notificationId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "SENT" })
    })
  );
};
