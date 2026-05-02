import {
  AcademicStage,
  AcademicTrack,
  ReportCardMode
} from "@prisma/client";

export type GradeView = {
  id: string;
  tenantId: string;
  studentId: string;
  studentName?: string;
  classId: string;
  placementId?: string;
  track: AcademicTrack;
  subjectId: string;
  subjectLabel?: string;
  academicPeriodId: string;
  assessmentLabel: string;
  assessmentType: string;
  score: number;
  scoreMax: number;
  absent: boolean;
  comment?: string;
};

export type SubjectAverageView = {
  subjectId: string;
  subjectLabel: string;
  average: number;
};

export type StudentClassSummaryView = {
  studentId: string;
  placementId?: string;
  track: AcademicTrack;
  matricule: string;
  studentName: string;
  averageGeneral: number;
  classRank: number;
  noteCount: number;
  appreciation: string;
  subjectAverages: SubjectAverageView[];
};

export type ClassSummaryView = {
  classId: string;
  academicPeriodId: string;
  track: AcademicTrack;
  classAverage: number;
  students: StudentClassSummaryView[];
};

export type ReportCardSectionView = {
  placementId?: string;
  track: AcademicTrack;
  classId: string;
  classLabel?: string;
  levelCode?: string;
  levelLabel?: string;
  academicStage: AcademicStage;
  averageGeneral: number;
  classRank?: number;
  appreciation: string;
  subjectAverages: SubjectAverageView[];
};

export type ReportCardView = {
  id: string;
  tenantId: string;
  studentId: string;
  classId: string;
  placementId?: string;
  secondaryPlacementId?: string;
  track: AcademicTrack;
  mode: ReportCardMode;
  academicPeriodId: string;
  averageGeneral: number;
  classRank?: number;
  appreciation?: string;
  publishedAt?: string;
  pdfDataUrl?: string;
  studentName?: string;
  classLabel?: string;
  periodLabel?: string;
  secondaryClassLabel?: string;
  sections?: ReportCardSectionView[];
};

export type ReportCardDraft = {
  studentId: string;
  classId: string;
  placementId: string;
  secondaryPlacementId?: string;
  track: AcademicTrack;
  mode: ReportCardMode;
  academicPeriodId: string;
  averageGeneral: number;
  classRank?: number;
  appreciation?: string;
  pdfDataUrl?: string;
  summaryData: {
    mode: ReportCardMode;
    sections: ReportCardSectionView[];
  };
};
