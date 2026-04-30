import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength
} from "class-validator";

export const STUDENT_STATUS_VALUES = ["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"] as const;

export class CreateStudentDto {
  @ApiProperty({ example: "MAT-26-001" })
  @IsString()
  @MaxLength(30)
  matricule!: string;

  @ApiProperty({ example: "Mariam" })
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: "Traore" })
  @IsString()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ example: "F", enum: ["M", "F"] })
  @IsIn(["M", "F"])
  sex!: "M" | "F";

  @ApiPropertyOptional({ example: "2014-10-02" })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: "Bamako" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  birthPlace?: string;

  @ApiPropertyOptional({ example: "Malienne" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string;

  @ApiPropertyOptional({ example: "Bamako, Magnambougou" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "+223 70 00 00 00" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: "mariam.traore@example.com" })
  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  establishmentId?: string;

  @ApiPropertyOptional({ example: "2025-09-01" })
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @ApiPropertyOptional({ example: "ELEVE-INTERNE-001" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  internalId?: string;

  @ApiPropertyOptional({ example: "ACT-2025-001" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  birthCertificateNo?: string;

  @ApiPropertyOptional({ example: "Suivi pedagogique individualise." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialNeeds?: string;

  @ApiPropertyOptional({ example: "Francais" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  primaryLanguage?: string;

  @ApiPropertyOptional({ enum: STUDENT_STATUS_VALUES, default: "ACTIVE" })
  @IsOptional()
  @IsIn(STUDENT_STATUS_VALUES)
  status?: (typeof STUDENT_STATUS_VALUES)[number];

  @ApiPropertyOptional({ example: "Dossier a verifier a la rentree." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  administrativeNotes?: string;
}
