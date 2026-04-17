import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min
} from "class-validator";

export const TEACHER_TYPE_VALUES = ["TITULAIRE", "VACATAIRE", "CONTRACTUEL", "STAGIAIRE"] as const;
export const TEACHER_STATUS_VALUES = ["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"] as const;
export const TEACHER_SKILL_STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const;
export const TEACHER_ASSIGNMENT_STATUS_VALUES = [
  "ACTIVE",
  "INACTIVE",
  "COMPLETED",
  "SUSPENDED",
  "ARCHIVED"
] as const;
export const TEACHER_DOCUMENT_TYPE_VALUES = [
  "CONTRAT",
  "DIPLOME",
  "PIECE_IDENTITE",
  "CV",
  "ATTESTATION",
  "AUTRE"
] as const;
export const TEACHER_DOCUMENT_STATUS_VALUES = ["ACTIVE", "ARCHIVED", "EXPIRED"] as const;
export const ACADEMIC_TRACK_VALUES = ["FRANCOPHONE", "ARABOPHONE"] as const;

export class CreateTeacherDto {
  @ApiProperty({ example: "ENS-0001" })
  @IsString()
  @MaxLength(40)
  matricule!: string;

  @ApiProperty({ example: "Aminata" })
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: "Diallo" })
  @IsString()
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional({ enum: ["M", "F"], example: "F" })
  @IsOptional()
  @IsIn(["M", "F"])
  sex?: "M" | "F";

  @ApiPropertyOptional({ example: "1988-05-18" })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: "+223 70 00 00 00" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  primaryPhone?: string;

  @ApiPropertyOptional({ example: "+223 76 00 00 00" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  secondaryPhone?: string;

  @ApiPropertyOptional({ example: "aminata.diallo@gestschool.local" })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ example: "Bamako, Magnambougou" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ example: "Malienne" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string;

  @ApiPropertyOptional({ example: "CNI" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  identityDocumentType?: string;

  @ApiPropertyOptional({ example: "CNI-123456" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  identityDocumentNumber?: string;

  @ApiPropertyOptional({ example: "2022-09-01" })
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiProperty({ enum: TEACHER_TYPE_VALUES, example: "TITULAIRE" })
  @IsIn(TEACHER_TYPE_VALUES)
  teacherType!: (typeof TEACHER_TYPE_VALUES)[number];

  @ApiPropertyOptional({ example: "Mathematiques" })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  speciality?: string;

  @ApiPropertyOptional({ example: "Licence mathematiques" })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  mainDiploma?: string;

  @ApiPropertyOptional({ example: "Francais" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  teachingLanguage?: string;

  @ApiProperty({ enum: TEACHER_STATUS_VALUES, example: "ACTIVE" })
  @IsIn(TEACHER_STATUS_VALUES)
  status!: (typeof TEACHER_STATUS_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  establishmentId?: string;

  @ApiPropertyOptional({ description: "Optional linked user account." })
  @IsOptional()
  @IsUUID("all")
  userId?: string;

  @ApiPropertyOptional({ example: "Disponible pour les classes d'examen." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  internalNotes?: string;
}

export class UpdateTeacherDto extends PartialType(CreateTeacherDto) {}

export class CreateTeacherSkillDto {
  @ApiProperty()
  @IsUUID("all")
  teacherId!: string;

  @ApiProperty()
  @IsUUID("all")
  subjectId!: string;

  @ApiProperty({ enum: ACADEMIC_TRACK_VALUES, example: "FRANCOPHONE" })
  @IsIn(ACADEMIC_TRACK_VALUES)
  track!: (typeof ACADEMIC_TRACK_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  cycleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  levelId?: string;

  @ApiPropertyOptional({ example: "Licence + CAP" })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  qualification?: string;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  yearsExperience?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ enum: TEACHER_SKILL_STATUS_VALUES, default: "ACTIVE" })
  @IsOptional()
  @IsIn(TEACHER_SKILL_STATUS_VALUES)
  status?: (typeof TEACHER_SKILL_STATUS_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class UpdateTeacherSkillDto extends PartialType(CreateTeacherSkillDto) {}

export class CreateTeacherAssignmentDto {
  @ApiProperty()
  @IsUUID("all")
  teacherId!: string;

  @ApiProperty()
  @IsUUID("all")
  schoolYearId!: string;

  @ApiProperty()
  @IsUUID("all")
  classId!: string;

  @ApiProperty()
  @IsUUID("all")
  subjectId!: string;

  @ApiProperty({ enum: ACADEMIC_TRACK_VALUES, example: "FRANCOPHONE" })
  @IsIn(ACADEMIC_TRACK_VALUES)
  track!: (typeof ACADEMIC_TRACK_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  periodId?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  workloadHours?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  coefficient?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isHomeroomTeacher?: boolean;

  @ApiPropertyOptional({ example: "Professeur principal" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  role?: string;

  @ApiProperty({ example: "2025-09-01" })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ example: "2026-06-30" })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: TEACHER_ASSIGNMENT_STATUS_VALUES, default: "ACTIVE" })
  @IsOptional()
  @IsIn(TEACHER_ASSIGNMENT_STATUS_VALUES)
  status?: (typeof TEACHER_ASSIGNMENT_STATUS_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class UpdateTeacherAssignmentDto extends PartialType(CreateTeacherAssignmentDto) {}

export class CreateTeacherDocumentDto {
  @ApiProperty()
  @IsUUID("all")
  teacherId!: string;

  @ApiProperty({ enum: TEACHER_DOCUMENT_TYPE_VALUES, example: "CONTRAT" })
  @IsIn(TEACHER_DOCUMENT_TYPE_VALUES)
  documentType!: (typeof TEACHER_DOCUMENT_TYPE_VALUES)[number];

  @ApiProperty({ example: "https://storage.local/teachers/contrat.pdf" })
  @IsString()
  fileUrl!: string;

  @ApiProperty({ example: "contrat-aminata-diallo.pdf" })
  @IsString()
  @MaxLength(180)
  originalName!: string;

  @ApiPropertyOptional({ example: "application/pdf" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @ApiPropertyOptional({ example: 238944 })
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;

  @ApiPropertyOptional({ enum: TEACHER_DOCUMENT_STATUS_VALUES, default: "ACTIVE" })
  @IsOptional()
  @IsIn(TEACHER_DOCUMENT_STATUS_VALUES)
  status?: (typeof TEACHER_DOCUMENT_STATUS_VALUES)[number];
}

export class UpdateTeacherDocumentDto extends PartialType(CreateTeacherDocumentDto) {}
