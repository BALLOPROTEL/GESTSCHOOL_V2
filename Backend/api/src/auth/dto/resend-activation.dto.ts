import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class ResendActivationDto {
  @ApiProperty({ example: "parent@gestschool.local" })
  @IsString()
  @MinLength(3)
  username!: string;

  @ApiPropertyOptional({
    example: "00000000-0000-0000-0000-000000000001"
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  tenantId?: string;
}
