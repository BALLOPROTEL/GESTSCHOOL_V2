import { type AcademicTrack } from "@prisma/client";

export const ADMISSION_ACADEMIC_OPTIONS_CONTRACT_VERSION = "1" as const;

export const ADMISSION_ACADEMIC_ERROR_CODES = [
  "ACADEMIC_CONTEXT_INVALID",
  "SCHOOL_YEAR_NOT_AVAILABLE",
  "TRACK_NOT_AVAILABLE",
  "LEVEL_NOT_AVAILABLE",
  "CLASS_NOT_AVAILABLE",
] as const;

export type AdmissionAcademicErrorCode =
  (typeof ADMISSION_ACADEMIC_ERROR_CODES)[number];

export type AdmissionAcademicSelection = {
  schoolYearId?: string;
  cycleId?: string;
  track?: AcademicTrack;
  levelId?: string;
  classId?: string;
};

export type CompleteAdmissionAcademicSelection =
  Required<AdmissionAcademicSelection>;

export type AdmissionAcademicSchoolYear = {
  id: string;
  code: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type AdmissionAcademicLevel = {
  id: string;
  cycleId: string;
  cycleCode: string;
  cycleLabel: string;
  code: string;
  label: string;
  track: AcademicTrack;
  sortOrder: number;
};

export type AdmissionAcademicClass = {
  id: string;
  schoolYearId: string;
  cycleId: string;
  levelId: string;
  code: string;
  label: string;
  track: AcademicTrack;
  capacity?: number;
  actualCapacity?: number;
  currentEnrollmentCount: number;
  placesRemaining?: number;
  capacityStatus: "UNBOUNDED" | "AVAILABLE" | "FULL";
};

export type AdmissionAcademicCatalog = {
  schoolYears: AdmissionAcademicSchoolYear[];
  schoolYear: AdmissionAcademicSchoolYear | null;
  tracks: AcademicTrack[];
  levels: AdmissionAcademicLevel[];
  classes: AdmissionAcademicClass[];
  invalidClassCount: number;
};

export type AdmissionAcademicOptionsResponse = {
  contractVersion: typeof ADMISSION_ACADEMIC_OPTIONS_CONTRACT_VERSION;
  selectionPolicy: {
    schoolYear: "SINGLE_ACTIVE";
    classCapacity: "INFORMATIONAL";
    automaticClassSelection: false;
    automaticStudentSelection: false;
  };
  selected: AdmissionAcademicSelection;
  schoolYears: AdmissionAcademicSchoolYear[];
  tracks: AcademicTrack[];
  levels: AdmissionAcademicLevel[];
  classes: AdmissionAcademicClass[];
};

export type ValidatedAdmissionAcademicContext = {
  selection: CompleteAdmissionAcademicSelection;
  schoolYear: {
    id: string;
    startDate: Date;
    endDate: Date;
  };
  level: {
    id: string;
    cycleId: string;
    track: AcademicTrack;
  };
  classroom: {
    id: string;
    schoolYearId: string;
    levelId: string;
    track: AcademicTrack;
  };
};
