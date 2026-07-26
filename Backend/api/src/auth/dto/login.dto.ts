import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

import { IsAllowedTenantId } from "../../common/tenant-id.validator";

export class LoginDto {
  @ApiProperty({ example: "admin@gestschool.local" })
  @IsString()
  username!: string;

  @ApiProperty({ example: "change-me-strong-password" })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    example: "00000000-0000-4000-8000-000000000001",
    description: "Optional tenant UUID. Defaults to DEFAULT_TENANT_ID."
  })
  @IsOptional()
  @IsAllowedTenantId()
  tenantId?: string;
}
