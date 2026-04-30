import type {
  Invoice,
  ParentChild,
  ParentOverview,
  PaymentRecord,
  PortalNotification,
  ReportCard
} from "../../../shared/types/app";
import { parsePortalError } from "./portal-service";
import type {
  ParentAttendanceEntry,
  ParentGradeEntry,
  ParentPortalData,
  ParentTimetableSlot,
  PortalApiClient
} from "../types/portal-parent";

export const fetchParentPortalData = async (
  api: PortalApiClient,
  studentId = ""
): Promise<ParentPortalData> => {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";

  const responses = await Promise.all([
    api("/portal/parent/overview"),
    api("/portal/parent/children"),
    api(`/portal/parent/grades${query}`),
    api(`/portal/parent/report-cards${query}`),
    api(`/portal/parent/attendance${query}`),
    api(`/portal/parent/invoices${query}`),
    api(`/portal/parent/payments${query}`),
    api(`/portal/parent/timetable${query}`),
    api(`/portal/parent/notifications${query}`)
  ]);

  const failed = responses.find((item) => !item.ok);
  if (failed) {
    throw new Error(await parsePortalError(failed));
  }

  const [
    overview,
    children,
    grades,
    reportCards,
    attendance,
    invoices,
    payments,
    timetable,
    notifications
  ] = await Promise.all([
    responses[0].json() as Promise<ParentOverview>,
    responses[1].json() as Promise<ParentChild[]>,
    responses[2].json() as Promise<ParentGradeEntry[]>,
    responses[3].json() as Promise<ReportCard[]>,
    responses[4].json() as Promise<ParentAttendanceEntry[]>,
    responses[5].json() as Promise<Invoice[]>,
    responses[6].json() as Promise<PaymentRecord[]>,
    responses[7].json() as Promise<ParentTimetableSlot[]>,
    responses[8].json() as Promise<PortalNotification[]>
  ]);

  return {
    overview,
    children,
    grades,
    reportCards,
    attendance,
    invoices,
    payments,
    timetable,
    notifications
  };
};
