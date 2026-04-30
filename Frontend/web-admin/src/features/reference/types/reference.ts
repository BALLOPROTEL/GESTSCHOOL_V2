import type {
  AcademicStage,
  AcademicTrack,
  ClassItem,
  Cycle,
  Level,
  Period,
  PeriodStatus,
  SchoolYear,
  SchoolYearStatus,
  Subject,
  SubjectNature
} from "../../../shared/types/app";

export type ReferenceApiClient = (path: string, init?: RequestInit) => Promise<Response>;

export type ReferenceData = {
  schoolYears: SchoolYear[];
  cycles: Cycle[];
  levels: Level[];
  classes: ClassItem[];
  subjects: Subject[];
  periods: Period[];
};

export type SchoolYearForm = {
  code: string;
  label: string;
  startDate: string;
  endDate: string;
  status: SchoolYearStatus;
  previousYearId: string;
  isDefault: boolean;
  sortOrder: string;
  comment: string;
};

export type CycleForm = {
  schoolYearId: string;
  code: string;
  label: string;
  academicStage: AcademicStage;
  sortOrder: number;
  description: string;
  theoreticalAgeMin: string;
  theoreticalAgeMax: string;
  status: "ACTIVE" | "INACTIVE";
};

export type LevelForm = {
  cycleId: string;
  code: string;
  label: string;
  sortOrder: number;
  track: AcademicTrack;
  alias: string;
  status: "ACTIVE" | "INACTIVE";
  theoreticalAge: string;
  description: string;
  defaultSection: string;
};

export type ClassForm = {
  schoolYearId: string;
  levelId: string;
  code: string;
  label: string;
  capacity: string;
  track: AcademicTrack;
  status: "ACTIVE" | "INACTIVE";
  homeroomTeacherName: string;
  mainRoom: string;
  actualCapacity: string;
  filiere: string;
  series: string;
  speciality: string;
  description: string;
  teachingMode: string;
};

export type SubjectForm = {
  code: string;
  label: string;
  status: "ACTIVE" | "INACTIVE";
  nature: SubjectNature;
  shortLabel: string;
  defaultCoefficient: string;
  category: string;
  description: string;
  color: string;
  weeklyHours: string;
  isGraded: boolean;
  isOptional: boolean;
  levelIds: string[];
};

export type PeriodForm = {
  schoolYearId: string;
  code: string;
  label: string;
  startDate: string;
  endDate: string;
  periodType: string;
  sortOrder: number;
  status: PeriodStatus;
  parentPeriodId: string;
  isGradeEntryOpen: boolean;
  gradeEntryDeadline: string;
  lockDate: string;
  comment: string;
};
