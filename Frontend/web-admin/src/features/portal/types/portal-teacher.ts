import type {
  AcademicTrack,
  GradeEntry,
  PortalNotification,
  TeacherClass,
  TeacherOverview,
  TeacherStudent
} from "../../../shared/types/app";

export type PortalApiClient = (path: string, init?: RequestInit) => Promise<Response>;

export type TeacherTimetableSlot = {
  id: string;
  classId: string;
  classLabel?: string;
  schoolYearId: string;
  schoolYearCode?: string;
  track: AcademicTrack;
  rotationGroup?: "GROUP_A" | "GROUP_B";
  subjectId: string;
  subjectLabel?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  teacherName?: string;
};

export type TeacherPortalFilters = {
  classId: string;
  subjectId: string;
  academicPeriodId: string;
  studentId: string;
};

export type TeacherGradeForm = {
  studentId: string;
  classId: string;
  subjectId: string;
  academicPeriodId: string;
  assessmentLabel: string;
  assessmentType: string;
  score: string;
  scoreMax: string;
  comment: string;
};

export type TeacherAttendanceForm = {
  classId: string;
  attendanceDate: string;
  defaultStatus: string;
  reason: string;
};

export type TeacherNotificationForm = {
  classId: string;
  studentId: string;
  title: string;
  message: string;
  channel: string;
};

export type TeacherPortalData = {
  overview: TeacherOverview | null;
  classes: TeacherClass[];
  students: TeacherStudent[];
  grades: GradeEntry[];
  timetable: TeacherTimetableSlot[];
  notifications: PortalNotification[];
};
