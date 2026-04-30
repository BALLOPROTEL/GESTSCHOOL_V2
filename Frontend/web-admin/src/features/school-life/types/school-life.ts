import type { WorkflowStepDef } from "../../../shared/types/app";

export type StudentRef = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
};

export type ClassRef = {
  id: string;
  code: string;
  label: string;
};

export type SubjectRef = {
  id: string;
  code: string;
  label: string;
};

export type AttendanceAttachment = {
  id: string;
  attendanceId: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  uploadedByUserId?: string;
  createdAt: string;
};

export type AttendanceRecord = {
  id: string;
  studentId: string;
  classId: string;
  schoolYearId: string;
  attendanceDate: string;
  status: string;
  reason?: string;
  justificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  validationComment?: string;
  validatedByUserId?: string;
  validatedAt?: string;
  attachments: AttendanceAttachment[];
  studentName?: string;
  classLabel?: string;
};

export type AttendanceSummary = {
  total: number;
  byStatus: {
    PRESENT: number;
    ABSENT: number;
    LATE: number;
    EXCUSED: number;
  };
  absenceRatePercent: number;
  topAbsentees: Array<{
    studentId: string;
    studentName: string;
    absentCount: number;
  }>;
};

export type TimetableSlot = {
  id: string;
  classId: string;
  subjectId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomId?: string;
  room?: string;
  teacherAssignmentId?: string;
  teacherName?: string;
  classLabel?: string;
  subjectLabel?: string;
};

export type RoomRef = {
  id: string;
  code: string;
  name: string;
  status: string;
};

export type TeacherAssignmentRef = {
  id: string;
  classId: string;
  classLabel?: string;
  schoolYearId: string;
  schoolYearCode?: string;
  subjectId: string;
  subjectLabel?: string;
  track: string;
  teacherName?: string;
  status: string;
};

export type TimetableGrid = {
  classId?: string;
  schoolYearId?: string;
  days: Array<{
    dayOfWeek: number;
    dayLabel: string;
    slots: TimetableSlot[];
  }>;
};

export type NotificationItem = {
  id: string;
  studentId?: string;
  audienceRole?: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  targetAddress?: string;
  provider?: string;
  providerMessageId?: string;
  deliveryStatus: string;
  attempts: number;
  lastError?: string;
  nextAttemptAt?: string;
  deliveredAt?: string;
  scheduledAt?: string;
  sentAt?: string;
  studentName?: string;
};

export type BulkAttendanceResponse = {
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  errors: Array<{
    studentId: string;
    message: string;
  }>;
};

export type DispatchResult = {
  dispatchedCount: number;
  notifications: NotificationItem[];
};

export type SchoolLifeFocus = "all" | "overview" | "attendance" | "timetable" | "notifications";

export type SchoolLifePanelProps = {
  api: (path: string, init?: RequestInit) => Promise<Response>;
  students: StudentRef[];
  classes: ClassRef[];
  subjects: SubjectRef[];
  locale: string;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
  focusSection?: SchoolLifeFocus;
  readOnly?: boolean;
};

export type SchoolLifeWorkflowState = {
  attendanceSteps: WorkflowStepDef[];
  timetableSteps: WorkflowStepDef[];
  notificationSteps: WorkflowStepDef[];
};
