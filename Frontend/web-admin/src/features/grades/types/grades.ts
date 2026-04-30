import type {
  ClassSummary,
  GradeEntry,
  ReportCard
} from "../../../shared/types/app";

export type GradesApiClient = (path: string, init?: RequestInit) => Promise<Response>;

export type GradeFilters = {
  classId: string;
  subjectId: string;
  academicPeriodId: string;
  studentId: string;
};

export type GradeForm = {
  studentId: string;
  classId: string;
  subjectId: string;
  academicPeriodId: string;
  assessmentLabel: string;
  assessmentType: "DEVOIR" | "COMPOSITION" | "ORAL" | "TP";
  score: string;
  scoreMax: string;
};

export type ReportForm = {
  studentId: string;
  classId: string;
  academicPeriodId: string;
};

export type GradesData = {
  grades: GradeEntry[];
  classSummary: ClassSummary | null;
  reportCards: ReportCard[];
};
