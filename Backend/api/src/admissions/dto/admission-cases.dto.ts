import { Type } from "class-transformer";
import {
  AdmissionCaseMode,
  AdmissionCaseStatus,
  AcademicTrack,
} from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  MinLength,
  Min,
  ValidateNested,
} from "class-validator";

import {
  type AdmissionAcademicsDraft,
  type AdmissionFinanceDraft,
  type AdmissionGuardianDraft,
  type AdmissionGuardiansDraft,
  type AdmissionStudentDraft,
} from "../admission-cases.types";
import { PARENT_RELATION_CODES } from "../../parents/parent-relations";

const PARENT_ROLE_VALUES = PARENT_RELATION_CODES;

export class CreateAdmissionCaseDto {
  @ApiProperty({ enum: AdmissionCaseMode })
  @IsEnum(AdmissionCaseMode)
  mode!: AdmissionCaseMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  studentId?: string;
}

export class AdmissionCaseListQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @ApiPropertyOptional({ enum: AdmissionCaseMode })
  @IsOptional()
  @IsEnum(AdmissionCaseMode)
  mode?: AdmissionCaseMode;

  @ApiPropertyOptional({ enum: AdmissionCaseStatus })
  @IsOptional()
  @IsEnum(AdmissionCaseStatus)
  status?: AdmissionCaseStatus;
}

export class UpdateAdmissionCaseSectionDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty({ type: Object })
  @IsObject()
  data!: Record<string, unknown>;
}

export class CancelAdmissionCaseDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ReopenAdmissionCaseDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class FinalizeAdmissionCaseDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty({ minLength: 8, maxLength: 200 })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  idempotencyKey!: string;
}

export class AdmissionStudentSectionDto implements AdmissionStudentDraft {
  @IsOptional()
  @IsIn(["AUTO", "MANUAL"])
  matriculeMode?: "AUTO" | "MANUAL";

  @IsOptional()
  @IsString()
  @MaxLength(30)
  matricule?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsIn(["M", "F"])
  sex?: "M" | "F";

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  birthPlace?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  internalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  birthCertificateNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialNeeds?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  primaryLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  administrativeNotes?: string;
}

export class AdmissionGuardianDraftDto implements AdmissionGuardianDraft {
  @IsOptional()
  @IsIn(["EXISTING_GUARDIAN", "NEW_GUARDIAN"])
  source?: "EXISTING_GUARDIAN" | "NEW_GUARDIAN";

  @IsOptional()
  @IsUUID("all")
  parentId?: string;

  @IsOptional()
  @IsIn(PARENT_ROLE_VALUES)
  parentalRole?: (typeof PARENT_ROLE_VALUES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsIn(["M", "F"])
  sex?: "M" | "F";

  @IsOptional()
  @IsString()
  @MaxLength(30)
  primaryPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  secondaryPhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  profession?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  identityDocumentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  identityDocumentNumber?: string;

  @IsOptional()
  @IsIn(PARENT_ROLE_VALUES)
  relationType?: (typeof PARENT_ROLE_VALUES)[number];

  @IsOptional()
  @IsBoolean()
  isPrimaryContact?: boolean;

  @IsOptional()
  @IsBoolean()
  livesWithStudent?: boolean;

  @IsOptional()
  @IsBoolean()
  pickupAuthorized?: boolean;

  @IsOptional()
  @IsBoolean()
  legalGuardian?: boolean;

  @IsOptional()
  @IsBoolean()
  financialResponsible?: boolean;

  @IsOptional()
  @IsBoolean()
  emergencyContact?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class AdmissionGuardiansSectionDto implements AdmissionGuardiansDraft {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AdmissionGuardianDraftDto)
  guardians?: AdmissionGuardianDraftDto[];
}

export class AdmissionAcademicsSectionDto implements AdmissionAcademicsDraft {
  @IsOptional()
  @IsUUID("all")
  schoolYearId?: string;

  @IsOptional()
  @IsUUID("all")
  cycleId?: string;

  @IsOptional()
  @IsUUID("all")
  levelId?: string;

  @IsOptional()
  @IsUUID("all")
  classId?: string;

  @IsOptional()
  @IsEnum(AcademicTrack)
  track?: AcademicTrack;
}

export class AdmissionFinanceSectionDto implements AdmissionFinanceDraft {
  @IsOptional()
  @IsIn(["IMMEDIATE", "DEFERRED", "EXEMPT_OR_SPECIAL"])
  disposition?: "IMMEDIATE" | "DEFERRED" | "EXEMPT_OR_SPECIAL";

  @IsOptional()
  @IsUUID("all")
  feePlanId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
