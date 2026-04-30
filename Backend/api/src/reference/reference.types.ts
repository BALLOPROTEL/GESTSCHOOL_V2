import {
  AcademicStage,
  AcademicTrack,
  Prisma,
  RotationGroup,
  type AcademicPeriod,
  type Classroom,
  type Cycle,
  type Level,
  type SchoolYear,
} from "@prisma/client";

export type SubjectWithLevelScopes = Prisma.SubjectGetPayload<{
  include: { levelScopes: true };
}>;

export type SchoolYearView = {
  id: string;
  tenantId: string;
  code: string;
  label: string;
  startDate: string;
  endDate: string;
  status: string;
  previousYearId?: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder?: number;
  comment?: string;
};

export type CycleView = {
  id: string;
  tenantId: string;
  schoolYearId: string;
  code: string;
  label: string;
  academicStage: AcademicStage;
  sortOrder: number;
  description?: string;
  theoreticalAgeMin?: number;
  theoreticalAgeMax?: number;
  status: string;
};

export type LevelView = {
  id: string;
  tenantId: string;
  cycleId: string;
  track: AcademicTrack;
  code: string;
  label: string;
  alias?: string;
  sortOrder: number;
  status: string;
  theoreticalAge?: number;
  description?: string;
  defaultSection?: string;
  rotationGroup?: RotationGroup;
};

export type ClassroomView = {
  id: string;
  tenantId: string;
  schoolYearId: string;
  levelId: string;
  track: AcademicTrack;
  code: string;
  label: string;
  capacity?: number;
  status: string;
  homeroomTeacherName?: string;
  mainRoom?: string;
  actualCapacity?: number;
  filiere?: string;
  series?: string;
  speciality?: string;
  description?: string;
  teachingMode?: string;
  rotationGroup?: RotationGroup;
};

export type SubjectView = {
  id: string;
  tenantId: string;
  code: string;
  label: string;
  status: string;
  nature: string;
  isArabic: boolean;
  shortLabel?: string;
  defaultCoefficient?: number;
  category?: string;
  description?: string;
  color?: string;
  weeklyHours?: number;
  isGraded: boolean;
  isOptional: boolean;
  levelIds: string[];
};

export type AcademicPeriodView = {
  id: string;
  tenantId: string;
  schoolYearId: string;
  code: string;
  label: string;
  startDate: string;
  endDate: string;
  periodType: string;
  sortOrder: number;
  status: string;
  parentPeriodId?: string;
  isGradeEntryOpen: boolean;
  gradeEntryDeadline?: string;
  lockDate?: string;
  comment?: string;
};

export const schoolYearView = (row: SchoolYear): SchoolYearView => ({
  id: row.id,
  tenantId: row.tenantId,
  code: row.code,
  label: row.label,
  startDate: row.startDate.toISOString().slice(0, 10),
  endDate: row.endDate.toISOString().slice(0, 10),
  status: row.status,
  previousYearId: row.previousYearId || undefined,
  isActive: row.isActive,
  isDefault: row.isDefault,
  sortOrder: row.sortOrder === null ? undefined : row.sortOrder,
  comment: row.comment || undefined
});

export const cycleView = (row: Cycle): CycleView => ({
  id: row.id,
  tenantId: row.tenantId,
  schoolYearId: row.schoolYearId,
  code: row.code,
  label: row.label,
  academicStage: row.academicStage,
  sortOrder: row.sortOrder,
  description: row.description || undefined,
  theoreticalAgeMin: row.theoreticalAgeMin === null ? undefined : row.theoreticalAgeMin,
  theoreticalAgeMax: row.theoreticalAgeMax === null ? undefined : row.theoreticalAgeMax,
  status: row.status
});

export const levelView = (row: Level): LevelView => ({
  id: row.id,
  tenantId: row.tenantId,
  cycleId: row.cycleId,
  track: row.track,
  code: row.code,
  label: row.label,
  alias: row.alias || undefined,
  sortOrder: row.sortOrder,
  status: row.status,
  theoreticalAge: row.theoreticalAge === null ? undefined : row.theoreticalAge,
  description: row.description || undefined,
  defaultSection: row.defaultSection || undefined,
  rotationGroup: row.rotationGroup || undefined
});

export const classroomView = (row: Classroom): ClassroomView => ({
  id: row.id,
  tenantId: row.tenantId,
  schoolYearId: row.schoolYearId,
  levelId: row.levelId,
  track: row.track,
  code: row.code,
  label: row.label,
  capacity: row.capacity === null ? undefined : row.capacity,
  status: row.status,
  homeroomTeacherName: row.homeroomTeacherName || undefined,
  mainRoom: row.mainRoom || undefined,
  actualCapacity: row.actualCapacity === null ? undefined : row.actualCapacity,
  filiere: row.filiere || undefined,
  series: row.series || undefined,
  speciality: row.speciality || undefined,
  description: row.description || undefined,
  teachingMode: row.teachingMode || undefined,
  rotationGroup: row.rotationGroup || undefined
});

export const subjectView = (row: SubjectWithLevelScopes): SubjectView => ({
  id: row.id,
  tenantId: row.tenantId,
  code: row.code,
  label: row.label,
  status: row.status,
  nature: row.nature,
  isArabic: row.isArabic,
  shortLabel: row.shortLabel || undefined,
  defaultCoefficient:
    row.defaultCoefficient === null ? undefined : Number(row.defaultCoefficient),
  category: row.category || undefined,
  description: row.description || undefined,
  color: row.color || undefined,
  weeklyHours: row.weeklyHours === null ? undefined : Number(row.weeklyHours),
  isGraded: row.isGraded,
  isOptional: row.isOptional,
  levelIds: row.levelScopes.map((item) => item.levelId)
});

export const academicPeriodView = (row: AcademicPeriod): AcademicPeriodView => ({
  id: row.id,
  tenantId: row.tenantId,
  schoolYearId: row.schoolYearId,
  code: row.code,
  label: row.label,
  startDate: row.startDate.toISOString().slice(0, 10),
  endDate: row.endDate.toISOString().slice(0, 10),
  periodType: row.periodType,
  sortOrder: row.sortOrder,
  status: row.status,
  parentPeriodId: row.parentPeriodId || undefined,
  isGradeEntryOpen: row.isGradeEntryOpen,
  gradeEntryDeadline: row.gradeEntryDeadline
    ? row.gradeEntryDeadline.toISOString().slice(0, 10)
    : undefined,
  lockDate: row.lockDate ? row.lockDate.toISOString().slice(0, 10) : undefined,
  comment: row.comment || undefined
});
