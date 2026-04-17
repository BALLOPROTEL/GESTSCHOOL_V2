import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf
} from "class-validator";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX
} from "../../common/password-policy";
import { UserRole } from "../../security/roles.enum";

export const ACCOUNT_TYPE_VALUES = ["STAFF", "TEACHER", "PARENT", "STUDENT"] as const;
export const PASSWORD_MODE_VALUES = ["AUTO", "MANUAL"] as const;

export type AccountType = (typeof ACCOUNT_TYPE_VALUES)[number];
export type PasswordMode = (typeof PASSWORD_MODE_VALUES)[number];

export class CreateUserDto {
  @ApiProperty({ example: "enseignant@gestschool.local" })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  username!: string;

  @ApiPropertyOptional({ example: "enseignant@gestschool.local" })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ example: "+22370000000" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ enum: PASSWORD_MODE_VALUES, default: "AUTO" })
  @IsOptional()
  @IsIn(PASSWORD_MODE_VALUES)
  passwordMode?: PasswordMode;

  @ApiPropertyOptional({ example: "Professeur2Mot!" })
  @ValidateIf((payload: CreateUserDto) => payload.passwordMode === "MANUAL" || Boolean(payload.password))
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  password?: string;

  @ApiPropertyOptional({ example: "Professeur2Mot!" })
  @ValidateIf((payload: CreateUserDto) => payload.passwordMode === "MANUAL" || Boolean(payload.confirmPassword))
  @IsString()
  confirmPassword?: string;

  @ApiPropertyOptional({ enum: ACCOUNT_TYPE_VALUES, example: "TEACHER" })
  @IsOptional()
  @IsIn(ACCOUNT_TYPE_VALUES)
  accountType?: AccountType;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.ENSEIGNANT, description: "Effective RBAC role stored in users.role." })
  @IsOptional()
  @IsIn(Object.values(UserRole))
  roleId?: UserRole;

  @ApiPropertyOptional({ enum: UserRole, deprecated: true, description: "Legacy alias kept for old clients. Prefer roleId." })
  @IsOptional()
  @IsIn(Object.values(UserRole))
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  autoFillIdentity?: boolean;

  @ApiPropertyOptional({ example: "Agent administratif" })
  @ValidateIf((payload: CreateUserDto) => payload.accountType === "STAFF")
  @IsString()
  @MaxLength(180)
  staffDisplayName?: string;

  @ApiPropertyOptional({ example: "Comptabilite" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  staffFunction?: string;

  @ApiPropertyOptional({ example: "Administration" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  establishmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  mustChangePasswordAtFirstLogin?: boolean;

  @ApiPropertyOptional({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
