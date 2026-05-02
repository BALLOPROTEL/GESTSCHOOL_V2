import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateUploadDescriptorDto {
  @ApiProperty({ example: "justificatif-absence.pdf" })
  @IsString()
  @MaxLength(180)
  fileName!: string;

  @ApiPropertyOptional({ example: "application/pdf" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @ApiPropertyOptional({ example: "attendance/justificatifs" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  folder?: string;

  @ApiPropertyOptional({
    enum: ["documents", "receipts", "report-cards", "avatars"],
    default: "documents"
  })
  @IsOptional()
  @IsIn(["documents", "receipts", "report-cards", "avatars"])
  bucket?: "documents" | "receipts" | "report-cards" | "avatars";

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  schoolYearId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
