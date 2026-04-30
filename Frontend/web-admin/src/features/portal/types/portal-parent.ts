import type {
  AcademicTrack,
  GradeEntry,
  Invoice,
  ParentChild,
  ParentOverview,
  PaymentRecord,
  PortalNotification,
  ReportCard
} from "../../../shared/types/app";

export type PortalApiClient = (path: string, init?: RequestInit) => Promise<Response>;

export type ParentGradeEntry = GradeEntry & {
  classLabel?: string;
  periodLabel?: string;
};

export type ParentAttendanceEntry = {
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
};

export type ParentTimetableSlot = {
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
};

export type ParentPortalData = {
  overview: ParentOverview | null;
  children: ParentChild[];
  grades: ParentGradeEntry[];
  reportCards: ReportCard[];
  attendance: ParentAttendanceEntry[];
  invoices: Invoice[];
  payments: PaymentRecord[];
  timetable: ParentTimetableSlot[];
  notifications: PortalNotification[];
};
