import {
  AcademicTrack,
  Prisma,
  RotationGroup,
  type AttendanceAttachment
} from "@prisma/client";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export type AttendanceJustificationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type AttendanceAttachmentView = {
  id: string;
  attendanceId: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  uploadedByUserId?: string;
  createdAt: string;
};

export type AttendanceView = {
  id: string;
  tenantId: string;
  studentId: string;
  classId: string;
  schoolYearId: string;
  placementId?: string;
  track: AcademicTrack;
  attendanceDate: string;
  status: string;
  reason?: string;
  justificationStatus: AttendanceJustificationStatus;
  validationComment?: string;
  validatedByUserId?: string;
  validatedAt?: string;
  attachments: AttendanceAttachmentView[];
  studentName?: string;
  classLabel?: string;
  schoolYearCode?: string;
};

export type AttendanceWithRelations = Prisma.AttendanceGetPayload<{
  include: {
    student: true;
    classroom: true;
    schoolYear: true;
    attachments: true;
  };
}>;

export type AttendanceSummaryView = {
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

export type BulkAttendanceResult = {
  classId: string;
  attendanceDate: string;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  errors: Array<{
    studentId: string;
    message: string;
  }>;
};

export type TimetableSlotView = {
  id: string;
  tenantId: string;
  classId: string;
  schoolYearId: string;
  subjectId: string;
  track: AcademicTrack;
  rotationGroup?: RotationGroup;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomId?: string;
  room?: string;
  teacherAssignmentId?: string;
  teacherName?: string;
  classLabel?: string;
  subjectLabel?: string;
  schoolYearCode?: string;
};

export type TimetableGridView = {
  classId?: string;
  schoolYearId?: string;
  days: Array<{
    dayOfWeek: number;
    dayLabel: string;
    slots: TimetableSlotView[];
  }>;
};

export type TimetableSlotWithRelations = Prisma.TimetableSlotGetPayload<{
  include: {
    classroom: true;
    subject: true;
    schoolYear: true;
    roomRef: true;
    teacherAssignment: {
      include: {
        teacher: true;
      };
    };
  };
}>;

export type NotificationView = {
  id: string;
  tenantId: string;
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

export type PaymentReceivedNotificationInput = {
  tenantId: string;
  invoiceNo: string;
  paidAmount: number;
  paidAt: string;
  receiptNo: string;
  studentId?: string;
  studentName?: string;
};

export const DAY_LABELS = new Map<number, string>([
  [1, "Lundi"],
  [2, "Mardi"],
  [3, "Mercredi"],
  [4, "Jeudi"],
  [5, "Vendredi"],
  [6, "Samedi"],
  [7, "Dimanche"]
]);

export const attendanceAttachmentView = (
  row: AttendanceAttachment
): AttendanceAttachmentView => ({
  id: row.id,
  attendanceId: row.attendanceId,
  fileName: row.fileName,
  fileUrl: row.fileUrl,
  mimeType: row.mimeType || undefined,
  uploadedByUserId: row.uploadedByUserId || undefined,
  createdAt: row.createdAt.toISOString()
});
