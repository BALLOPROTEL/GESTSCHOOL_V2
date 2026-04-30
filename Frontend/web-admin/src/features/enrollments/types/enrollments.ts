import type { AcademicTrack } from "../../../shared/types/app";

export type EnrollmentsApiClient = (path: string, init?: RequestInit) => Promise<Response>;

export type EnrollmentFilters = {
  schoolYearId: string;
  classId: string;
  studentId: string;
  track: string;
};

export type EnrollmentForm = {
  schoolYearId: string;
  classId: string;
  studentId: string;
  track: AcademicTrack;
  enrollmentDate: string;
  enrollmentStatus: string;
};
