import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { AcademicStage, AcademicTrack, PedagogicalRuleType, RotationGroup } from "@prisma/client";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsHexColor,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min
} from "class-validator";

export const SCHOOL_YEAR_STATUS_VALUES = ["DRAFT", "ACTIVE", "CLOSED"] as const;
export const REFERENCE_STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const;
export const PERIOD_STATUS_VALUES = ["DRAFT", "ACTIVE", "CLOSED"] as const;
export const PERIOD_TYPE_VALUES = ["TRIMESTER", "SEMESTER", "BIMESTER", "CUSTOM"] as const;
export const SUBJECT_NATURE_VALUES = ["FRANCOPHONE", "ARABOPHONE"] as const;
export const TEACHING_MODE_VALUES = ["PRESENTIAL", "HYBRID", "REMOTE", "BLENDED"] as const;

export class CreateSchoolYearDto {
  @ApiPropertyOptional({ example: "AS-2026-2027" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @ApiProperty({ example: "2026-2027" })
  @IsString()
  @MaxLength(40)
  label!: string;

  @ApiProperty({ example: "2026-09-01" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: "2027-06-30" })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ enum: SCHOOL_YEAR_STATUS_VALUES, example: "ACTIVE" })
  @IsIn(SCHOOL_YEAR_STATUS_VALUES)
  status!: (typeof SCHOOL_YEAR_STATUS_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  previousYearId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: "Annee de bascule vers le nouveau decoupage." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class UpdateSchoolYearDto extends PartialType(CreateSchoolYearDto) {}

export class CreateCycleDto {
  @ApiProperty()
  @IsUUID("all")
  schoolYearId!: string;

  @ApiProperty({ example: "PRIMARY" })
  @IsString()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: "Primary" })
  @IsString()
  @MaxLength(100)
  label!: string;

  @ApiProperty({ enum: AcademicStage, default: AcademicStage.PRIMARY })
  @IsEnum(AcademicStage)
  academicStage!: AcademicStage;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @ApiPropertyOptional({ example: "Cycle du primaire francophone." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  theoreticalAgeMin?: number;

  @ApiPropertyOptional({ example: 11 })
  @IsOptional()
  @IsInt()
  @Min(0)
  theoreticalAgeMax?: number;

  @ApiPropertyOptional({ enum: REFERENCE_STATUS_VALUES, default: "ACTIVE" })
  @IsOptional()
  @IsIn(REFERENCE_STATUS_VALUES)
  status?: (typeof REFERENCE_STATUS_VALUES)[number];
}

export class UpdateCycleDto extends PartialType(CreateCycleDto) {}

export class CreateLevelDto {
  @ApiProperty()
  @IsUUID("all")
  cycleId!: string;

  @ApiProperty({ example: "CP1" })
  @IsString()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ enum: AcademicTrack, default: AcademicTrack.FRANCOPHONE })
  @IsEnum(AcademicTrack)
  track!: AcademicTrack;

  @ApiProperty({ example: "Cours Preparatoire 1" })
  @IsString()
  @MaxLength(100)
  label!: string;

  @ApiPropertyOptional({ example: "CP1" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  alias?: string;

  @ApiPropertyOptional({ enum: RotationGroup })
  @IsOptional()
  @IsEnum(RotationGroup)
  rotationGroup?: RotationGroup;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @ApiProperty({ enum: REFERENCE_STATUS_VALUES, example: "ACTIVE" })
  @IsIn(REFERENCE_STATUS_VALUES)
  status!: (typeof REFERENCE_STATUS_VALUES)[number];

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  theoreticalAge?: number;

  @ApiPropertyOptional({ example: "Niveau d'entree dans le cycle primaire." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: "Section generale" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultSection?: string;
}

export class UpdateLevelDto extends PartialType(CreateLevelDto) {}

export class CreateClassroomDto {
  @ApiProperty()
  @IsUUID("all")
  schoolYearId!: string;

  @ApiProperty()
  @IsUUID("all")
  levelId!: string;

  @ApiProperty({ enum: AcademicTrack })
  @IsEnum(AcademicTrack)
  track!: AcademicTrack;

  @ApiProperty({ example: "CP1-A" })
  @IsString()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: "CP1 A" })
  @IsString()
  @MaxLength(100)
  label!: string;

  @ApiProperty({ example: 35 })
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiProperty({ enum: REFERENCE_STATUS_VALUES, example: "ACTIVE" })
  @IsIn(REFERENCE_STATUS_VALUES)
  status!: (typeof REFERENCE_STATUS_VALUES)[number];

  @ApiPropertyOptional({ enum: RotationGroup })
  @IsOptional()
  @IsEnum(RotationGroup)
  rotationGroup?: RotationGroup;

  @ApiPropertyOptional({ example: "Mme Diallo" })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  homeroomTeacherName?: string;

  @ApiPropertyOptional({ example: "Salle B12" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  mainRoom?: string;

  @ApiPropertyOptional({ example: 32 })
  @IsOptional()
  @IsInt()
  @Min(1)
  actualCapacity?: number;

  @ApiPropertyOptional({ example: "Scientifique" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  filiere?: string;

  @ApiPropertyOptional({ example: "D" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  series?: string;

  @ApiPropertyOptional({ example: "Maths-Physique" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  speciality?: string;

  @ApiPropertyOptional({ example: "Classe pilote du second cycle." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: TEACHING_MODE_VALUES, example: "PRESENTIAL" })
  @IsOptional()
  @IsIn(TEACHING_MODE_VALUES)
  teachingMode?: (typeof TEACHING_MODE_VALUES)[number];
}

export class UpdateClassroomDto extends PartialType(CreateClassroomDto) {}

export class CreateSubjectDto {
  @ApiProperty({ example: "MATH" })
  @IsString()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: "Mathematiques" })
  @IsString()
  @MaxLength(120)
  label!: string;

  @ApiProperty({ enum: REFERENCE_STATUS_VALUES, example: "ACTIVE" })
  @IsIn(REFERENCE_STATUS_VALUES)
  status!: (typeof REFERENCE_STATUS_VALUES)[number];

  @ApiProperty({ enum: SUBJECT_NATURE_VALUES, example: "FRANCOPHONE" })
  @IsIn(SUBJECT_NATURE_VALUES)
  nature!: (typeof SUBJECT_NATURE_VALUES)[number];

  @ApiPropertyOptional({ example: "Maths" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  shortLabel?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  defaultCoefficient?: number;

  @ApiPropertyOptional({ example: "Scientifique" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ example: "Matiere principale du tronc commun." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: "#22c55e" })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  weeklyHours?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isGraded?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("all", { each: true })
  levelIds?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isArabic?: boolean;
}

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}

export class CreateAcademicPeriodDto {
  @ApiProperty()
  @IsUUID("all")
  schoolYearId!: string;

  @ApiProperty({ example: "T1" })
  @IsString()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: "Trimestre 1" })
  @IsString()
  @MaxLength(100)
  label!: string;

  @ApiProperty({ example: "2026-09-01" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: "2026-12-20" })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ enum: PERIOD_TYPE_VALUES, example: "TRIMESTER" })
  @IsIn(PERIOD_TYPE_VALUES)
  periodType!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @ApiProperty({ enum: PERIOD_STATUS_VALUES, example: "ACTIVE" })
  @IsIn(PERIOD_STATUS_VALUES)
  status!: (typeof PERIOD_STATUS_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  parentPeriodId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isGradeEntryOpen?: boolean;

  @ApiPropertyOptional({ example: "2026-12-10" })
  @IsOptional()
  @IsDateString()
  gradeEntryDeadline?: string;

  @ApiPropertyOptional({ example: "2026-12-20" })
  @IsOptional()
  @IsDateString()
  lockDate?: string;

  @ApiPropertyOptional({ example: "Periode de controle continu." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class UpdateAcademicPeriodDto extends PartialType(CreateAcademicPeriodDto) {}

export class CreatePedagogicalRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  schoolYearId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  cycleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  levelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  classId?: string;

  @ApiProperty({ example: "SECOND_CYCLE_TRACK_DAYS" })
  @IsString()
  @MaxLength(40)
  code!: string;

  @ApiProperty({ example: "Second cycle weekly track split" })
  @IsString()
  @MaxLength(140)
  label!: string;

  @ApiProperty({ enum: PedagogicalRuleType })
  @IsEnum(PedagogicalRuleType)
  ruleType!: PedagogicalRuleType;

  @ApiPropertyOptional({ enum: AcademicTrack })
  @IsOptional()
  @IsEnum(AcademicTrack)
  track?: AcademicTrack;

  @ApiPropertyOptional({ enum: RotationGroup })
  @IsOptional()
  @IsEnum(RotationGroup)
  rotationGroup?: RotationGroup;

  @ApiProperty({ type: Object })
  @IsObject()
  config!: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
