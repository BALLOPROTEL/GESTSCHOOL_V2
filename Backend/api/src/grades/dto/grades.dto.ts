import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AcademicTrack } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

const ASSESSMENT_TYPES = [
  "DEVOIR",
  "INTERROGATION",
  "COMPOSITION",
  "EXAMEN",
  "PROJET",
  "PARTICIPATION",
  "ORAL",
  "TP"
] as const;

type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export class CreateGradeDto {
  @ApiProperty()
  @IsUUID("all")
  studentId!: string;

  @ApiProperty()
  @IsUUID("all")
  classId!: string;

  @ApiProperty()
  @IsUUID("all")
  subjectId!: string;

  @ApiProperty()
  @IsUUID("all")
  academicPeriodId!: string;

  @ApiPropertyOptional({ enum: AcademicTrack })
  @IsOptional()
  @IsEnum(AcademicTrack)
  track?: AcademicTrack;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  placementId?: string;

  @ApiProperty({ example: "Devoir 1" })
  @IsString()
  @MaxLength(120)
  assessmentLabel!: string;

  @ApiPropertyOptional({
    example: "DEVOIR",
    enum: ASSESSMENT_TYPES
  })
  @IsOptional()
  @IsIn(ASSESSMENT_TYPES)
  assessmentType?: AssessmentType;

  @ApiPropertyOptional({ example: "2026-05-19" })
  @IsOptional()
  @IsDateString()
  assessmentDate?: string;

  @ApiProperty({ example: 15.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  scoreMax?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  coefficient?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  absent?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  exempted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class BulkGradeItemDto {
  @ApiProperty()
  @IsUUID("all")
  studentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  placementId?: string;

  @ApiProperty({ example: 14 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  absent?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  exempted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class BulkCreateGradesDto {
  @ApiProperty()
  @IsUUID("all")
  classId!: string;

  @ApiProperty()
  @IsUUID("all")
  subjectId!: string;

  @ApiProperty()
  @IsUUID("all")
  academicPeriodId!: string;

  @ApiPropertyOptional({ enum: AcademicTrack })
  @IsOptional()
  @IsEnum(AcademicTrack)
  track?: AcademicTrack;

  @ApiProperty({ example: "Devoir 2" })
  @IsString()
  @MaxLength(120)
  assessmentLabel!: string;

  @ApiPropertyOptional({
    example: "DEVOIR",
    enum: ASSESSMENT_TYPES
  })
  @IsOptional()
  @IsIn(ASSESSMENT_TYPES)
  assessmentType?: AssessmentType;

  @ApiPropertyOptional({ example: "2026-05-19" })
  @IsOptional()
  @IsDateString()
  assessmentDate?: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  scoreMax?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  coefficient?: number;

  @ApiProperty({ type: [BulkGradeItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkGradeItemDto)
  grades!: BulkGradeItemDto[];
}

export class GenerateReportCardDto {
  @ApiProperty()
  @IsUUID("all")
  studentId!: string;

  @ApiProperty()
  @IsUUID("all")
  classId!: string;

  @ApiProperty()
  @IsUUID("all")
  academicPeriodId!: string;

  @ApiPropertyOptional({ enum: AcademicTrack })
  @IsOptional()
  @IsEnum(AcademicTrack)
  track?: AcademicTrack;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  placementId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class GenerateBulkReportCardsDto {
  @ApiProperty()
  @IsUUID("all")
  classId!: string;

  @ApiProperty()
  @IsUUID("all")
  academicPeriodId!: string;

  @ApiPropertyOptional({ enum: AcademicTrack })
  @IsOptional()
  @IsEnum(AcademicTrack)
  track?: AcademicTrack;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
