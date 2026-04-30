import {
  AcademicTrack,
  Prisma,
  type Teacher,
  type TeacherAssignment,
  type TeacherDocument,
  type TeacherSkill
} from "@prisma/client";

export type TeacherFilters = {
  search?: string;
  status?: string;
  teacherType?: string;
  subjectId?: string;
  classId?: string;
  schoolYearId?: string;
  track?: AcademicTrack;
  includeArchived?: string;
};

export type AssignmentFilters = {
  teacherId?: string;
  schoolYearId?: string;
  classId?: string;
  subjectId?: string;
  track?: AcademicTrack;
  status?: string;
};

export type TeacherWithUser = Prisma.TeacherGetPayload<{ include: { user: true } }>;
export type SkillWithRelations = Prisma.TeacherSkillGetPayload<{
  include: { teacher: true; subject: true; cycle: true; level: true };
}>;
export type AssignmentWithRelations = Prisma.TeacherAssignmentGetPayload<{
  include: {
    teacher: true;
    schoolYear: true;
    classroom: { include: { level: { include: { cycle: true } } } };
    subject: true;
    academicPeriod: true;
  };
}>;
export type DocumentWithRelations = Prisma.TeacherDocumentGetPayload<{
  include: { teacher: true; uploadedByUser: true };
}>;

export type TeacherView = {
  id: string;
  tenantId: string;
  matricule: string;
  firstName: string;
  lastName: string;
  fullName: string;
  sex?: string;
  birthDate?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  email?: string;
  address?: string;
  photoUrl?: string;
  nationality?: string;
  identityDocumentType?: string;
  identityDocumentNumber?: string;
  hireDate?: string;
  teacherType: string;
  speciality?: string;
  mainDiploma?: string;
  teachingLanguage?: string;
  status: string;
  establishmentId?: string;
  userId?: string;
  userUsername?: string;
  internalNotes?: string;
  archivedAt?: string;
  activeAssignmentsCount: number;
  workloadHoursTotal: number;
  francophoneWorkloadHoursTotal: number;
  arabophoneWorkloadHoursTotal: number;
  createdAt: string;
  updatedAt: string;
};

export type TeacherSkillView = {
  id: string;
  teacherId: string;
  teacherName?: string;
  subjectId: string;
  subjectLabel?: string;
  track: AcademicTrack;
  cycleId?: string;
  cycleLabel?: string;
  levelId?: string;
  levelLabel?: string;
  qualification?: string;
  yearsExperience?: number;
  priority?: number;
  status: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};

export type TeacherAssignmentView = {
  id: string;
  teacherId: string;
  teacherName?: string;
  schoolYearId: string;
  schoolYearCode?: string;
  classId: string;
  classLabel?: string;
  levelId?: string;
  levelLabel?: string;
  subjectId: string;
  subjectLabel?: string;
  track: AcademicTrack;
  periodId?: string;
  periodLabel?: string;
  workloadHours?: number;
  coefficient?: number;
  isHomeroomTeacher: boolean;
  role?: string;
  startDate: string;
  endDate?: string;
  status: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};

export type TeacherDocumentView = {
  id: string;
  teacherId: string;
  teacherName?: string;
  documentType: string;
  fileUrl: string;
  originalName: string;
  mimeType?: string;
  size?: number;
  uploadedAt: string;
  uploadedBy?: string;
  uploadedByUsername?: string;
  status: string;
  archivedAt?: string;
};

export type TeacherDetailView = TeacherView & {
  skills: TeacherSkillView[];
  assignments: TeacherAssignmentView[];
  documents: TeacherDocumentView[];
};

export type TeacherWorkloadView = {
  teacherId: string;
  teacherName: string;
  matricule: string;
  status: string;
  assignmentsCount: number;
  workloadHoursTotal: number;
  francophoneHoursTotal: number;
  arabophoneHoursTotal: number;
  francophoneAssignmentsCount: number;
  arabophoneAssignmentsCount: number;
  classesCount: number;
  subjectsCount: number;
  classes: string[];
  subjects: string[];
};

export type TeacherWorkloadTotals = {
  assignmentsCount: number;
  workloadHoursTotal: number;
  francophoneWorkloadHoursTotal: number;
  arabophoneWorkloadHoursTotal: number;
};

export type TeacherScopedUser = Pick<Teacher, "firstName" | "lastName">;
export type TeacherEntity = Teacher;
export type TeacherSkillEntity = TeacherSkill;
export type TeacherAssignmentEntity = TeacherAssignment;
export type TeacherDocumentEntity = TeacherDocument;
