import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX
} from "../../common/password-policy";

export const USER_LANGUAGE_VALUES = ["fr", "en", "ar"] as const;
export const USER_THEME_VALUES = ["light", "dark"] as const;

export type UserLanguagePreference = (typeof USER_LANGUAGE_VALUES)[number];
export type UserThemePreference = (typeof USER_THEME_VALUES)[number];

export class UpdateMyProfileDto {
  @ApiPropertyOptional({ example: "Seydou Ballo" })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  displayName?: string;

  @ApiPropertyOptional({ example: "Seydou" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: "Ballo" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: "+22370000000" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ enum: USER_LANGUAGE_VALUES })
  @IsOptional()
  @IsIn(USER_LANGUAGE_VALUES)
  language?: UserLanguagePreference;

  @ApiPropertyOptional({ enum: USER_THEME_VALUES })
  @IsOptional()
  @IsIn(USER_THEME_VALUES)
  theme?: UserThemePreference;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNotificationsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  systemNotificationsEnabled?: boolean;
}

export class ChangeMyPasswordDto {
  @ApiPropertyOptional()
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiPropertyOptional()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  newPassword!: string;

  @ApiPropertyOptional()
  @IsString()
  confirmPassword!: string;
}
