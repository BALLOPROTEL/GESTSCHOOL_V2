import type {
  AcademicTrack,
  ClassSummary,
  GradeEntry,
  ReportCard
} from "../../../shared/types/app";

export type GradesApiClient = (path: string, init?: RequestInit) => Promise<Response>;

export type GradeFilters = {
  schoolYearId: string;
  classId: string;
  subjectId: string;
  academicPeriodId: string;
  track: AcademicTrack | "MIXED";
  studentId: string;
};

export type GradeForm = {
  classId: string;
  subjectId: string;
  academicPeriodId: string;
  track: AcademicTrack | "MIXED";
  assessmentLabel: string;
  assessmentType: "DEVOIR" | "INTERROGATION" | "COMPOSITION" | "EXAMEN" | "PROJET" | "PARTICIPATION";
  assessmentDate: string;
  scoreMax: string;
  coefficient: string;
  comment: string;
};

export type GradeGridRow = {
  studentId: string;
  placementId?: string;
  score: string;
  absent: boolean;
  exempted: boolean;
  comment: string;
};

export type ReportForm = {
  schoolYearId: string;
  studentId: string;
  classId: string;
  academicPeriodId: string;
  track: AcademicTrack | "MIXED";
  mode: "student" | "class";
  regenerateExisting: boolean;
  publish: boolean;
};

export type GradesData = {
  grades: GradeEntry[];
  classSummary: ClassSummary | null;
  reportCards: ReportCard[];
};
