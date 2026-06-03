import type { AcademicTrack } from "../../../shared/types/app";

export type EnrollmentsApiClient = (path: string, init?: RequestInit) => Promise<Response>;

export type EnrollmentFilters = {
  schoolYearId: string;
  classId: string;
  studentId: string;
  track: string;
  enrollmentStatus: string;
};

export type EnrollmentForm = {
  schoolYearId: string;
  classId: string;
  studentId: string;
  track: AcademicTrack;
  enrollmentDate: string;
  enrollmentStatus: string;
};

export type EnrollmentPlacementPayload = {
  studentId: string;
  schoolYearId: string;
  track: AcademicTrack;
  levelId: string;
  classId?: string;
  placementStatus?: "ACTIVE" | "INACTIVE" | "COMPLETED" | "SUSPENDED";
  isPrimary?: boolean;
  startDate?: string;
};
