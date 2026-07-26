import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

import { IsAllowedTenantId } from "../../common/tenant-id.validator";

export class ForgotPasswordDto {
  @ApiProperty({ example: "parent@gestschool.local" })
  @IsString()
  @MinLength(3)
  username!: string;

  @ApiProperty({
    required: false,
    example: "00000000-0000-4000-8000-000000000001"
  })
  @IsOptional()
  @IsAllowedTenantId()
  tenantId?: string;
}
