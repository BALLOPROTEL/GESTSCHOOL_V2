import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength
} from "class-validator";

export const PARENT_ROLE_VALUES = ["PERE", "MERE", "TUTEUR", "AUTRE"] as const;
export const PARENT_STATUS_VALUES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const PARENT_LINK_STATUS_VALUES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

export class CreateParentDto {
  @ApiProperty({ enum: PARENT_ROLE_VALUES, example: "PERE" })
  @IsIn(PARENT_ROLE_VALUES)
  parentalRole!: (typeof PARENT_ROLE_VALUES)[number];

  @ApiProperty({ example: "Moussa" })
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: "Traore" })
  @IsString()
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional({ enum: ["M", "F"], example: "M" })
  @IsOptional()
  @IsIn(["M", "F"])
  sex?: "M" | "F";

  @ApiProperty({ example: "+223 70 00 00 00" })
  @IsString()
  @MaxLength(30)
  primaryPhone!: string;

  @ApiPropertyOptional({ example: "+223 76 00 00 00" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  secondaryPhone?: string;

  @ApiPropertyOptional({ example: "moussa.traore@example.com" })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ example: "Bamako, Magnambougou" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "Commercant" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  profession?: string;

  @ApiPropertyOptional({ example: "CNI" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  identityDocumentType?: string;

  @ApiPropertyOptional({ example: "CNI-0001" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  identityDocumentNumber?: string;

  @ApiPropertyOptional({ enum: PARENT_STATUS_VALUES, default: "ACTIVE" })
  @IsOptional()
  @IsIn(PARENT_STATUS_VALUES)
  status?: (typeof PARENT_STATUS_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  establishmentId?: string;

  @ApiPropertyOptional({ description: "Compte utilisateur portail parent optionnel." })
  @IsOptional()
  @IsUUID("all")
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateParentDto extends PartialType(CreateParentDto) {}

export class CreateParentStudentLinkDto {
  @ApiProperty()
  @IsUUID("all")
  parentId!: string;

  @ApiProperty()
  @IsUUID("all")
  studentId!: string;

  @ApiProperty({ enum: PARENT_ROLE_VALUES, example: "PERE" })
  @IsIn(PARENT_ROLE_VALUES)
  relationType!: (typeof PARENT_ROLE_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimaryContact?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  livesWithStudent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pickupAuthorized?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  legalGuardian?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  financialResponsible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emergencyContact?: boolean;

  @ApiPropertyOptional({ enum: PARENT_LINK_STATUS_VALUES, default: "ACTIVE" })
  @IsOptional()
  @IsIn(PARENT_LINK_STATUS_VALUES)
  status?: (typeof PARENT_LINK_STATUS_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class UpdateParentStudentLinkDto extends PartialType(CreateParentStudentLinkDto) {}
