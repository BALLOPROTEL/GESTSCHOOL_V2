import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { AcademicTrack, RotationGroup } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { IsAllowedTenantId } from "../../common/tenant-id.validator";

export class CreateAttendanceDto {
  @ApiProperty()
  @IsUUID("all")
  studentId!: string;

  @ApiProperty()
  @IsUUID("all")
  classId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  placementId?: string;

  @ApiProperty({ example: "2026-09-12" })
  @IsDateString()
  attendanceDate!: string;

  @ApiPropertyOptional({
    example: "ABSENT",
    enum: ["PRESENT", "ABSENT", "LATE", "EXCUSED"],
    default: "PRESENT"
  })
  @IsOptional()
  @IsIn(["PRESENT", "ABSENT", "LATE", "EXCUSED"])
  status?: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class UpdateAttendanceDto extends PartialType(CreateAttendanceDto) {}

export class UpdateAttendanceValidationDto {
  @ApiProperty({ enum: ["PENDING", "APPROVED", "REJECTED"] })
  @IsIn(["PENDING", "APPROVED", "REJECTED"])
  status!: "PENDING" | "APPROVED" | "REJECTED";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  comment?: string;
}

export class BulkAttendanceEntryDto {
  @ApiProperty()
  @IsUUID("all")
  studentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  placementId?: string;

  @ApiPropertyOptional({
    example: "ABSENT",
    enum: ["PRESENT", "ABSENT", "LATE", "EXCUSED"]
  })
  @IsOptional()
  @IsIn(["PRESENT", "ABSENT", "LATE", "EXCUSED"])
  status?: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class BulkAttendanceDto {
  @ApiProperty()
  @IsUUID("all")
  classId!: string;

  @ApiProperty({ example: "2026-09-12" })
  @IsDateString()
  attendanceDate!: string;

  @ApiPropertyOptional({
    example: "ABSENT",
    enum: ["PRESENT", "ABSENT", "LATE", "EXCUSED"],
    default: "PRESENT"
  })
  @IsOptional()
  @IsIn(["PRESENT", "ABSENT", "LATE", "EXCUSED"])
  defaultStatus?: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

  @ApiProperty({ type: [BulkAttendanceEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkAttendanceEntryDto)
  entries!: BulkAttendanceEntryDto[];
}

export class CreateTimetableSlotDto {
  @ApiProperty()
  @IsUUID("all")
  classId!: string;

  @ApiProperty()
  @IsUUID("all")
  subjectId!: string;

  @ApiPropertyOptional({ enum: AcademicTrack })
  @IsOptional()
  @IsEnum(AcademicTrack)
  track?: AcademicTrack;

  @ApiPropertyOptional({ enum: RotationGroup })
  @IsOptional()
  @IsEnum(RotationGroup)
  rotationGroup?: RotationGroup;

  @ApiProperty({ example: 1, description: "1=Monday ... 7=Sunday" })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @ApiProperty({ example: "08:00" })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime!: string;

  @ApiProperty({ example: "09:00" })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime!: string;

  @ApiPropertyOptional({
    deprecated: true,
    description: "Legacy display mirror kept for historical rows. Use roomId for active writes.",
    example: "Salle B"
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  room?: string;

  @ApiPropertyOptional({ description: "Canonical room id from the Salles module." })
  @IsOptional()
  @IsUUID("all")
  roomId?: string;

  @ApiPropertyOptional({
    deprecated: true,
    description: "Legacy display mirror kept for historical rows. Use teacherAssignmentId for active writes.",
    example: "Mme Traore"
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  teacherName?: string;

  @ApiPropertyOptional({ description: "Canonical pedagogical assignment id from the Enseignants module." })
  @IsOptional()
  @IsUUID("all")
  teacherAssignmentId?: string;
}

export class UpdateTimetableSlotDto extends PartialType(CreateTimetableSlotDto) {}

export class CreateNotificationDto {
  @ApiPropertyOptional({ description: "Optional targeted student" })
  @IsOptional()
  @IsUUID("all")
  studentId?: string;

  @ApiPropertyOptional({
    enum: ["ADMIN", "SCOLARITE", "ENSEIGNANT", "COMPTABLE", "PARENT"]
  })
  @IsOptional()
  @IsIn(["ADMIN", "SCOLARITE", "ENSEIGNANT", "COMPTABLE", "PARENT"])
  audienceRole?: "ADMIN" | "SCOLARITE" | "ENSEIGNANT" | "COMPTABLE" | "PARENT";

  @ApiProperty({ example: "Retard de paiement" })
  @IsString()
  @MaxLength(160)
  title!: string;

  @ApiProperty({ example: "Merci de regulariser avant le 15/10." })
  @IsString()
  message!: string;

  @ApiPropertyOptional({ example: "IN_APP", enum: ["IN_APP", "EMAIL", "SMS"], default: "IN_APP" })
  @IsOptional()
  @IsIn(["IN_APP", "EMAIL", "SMS"])
  channel?: "IN_APP" | "EMAIL" | "SMS";

  @ApiPropertyOptional({
    description: "Optional explicit target address (email/phone). Required for EMAIL/SMS if not inferable."
  })
  @IsOptional()
  @IsString()
  @MaxLength(190)
  targetAddress?: string;

  @ApiPropertyOptional({ example: "2026-09-12T08:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateNotificationStatusDto {
  @ApiProperty({
    example: "CANCELLED",
    enum: ["PENDING", "CANCELLED"]
  })
  @IsIn(["PENDING", "CANCELLED"])
  status!: "PENDING" | "CANCELLED";

  @ApiPropertyOptional({ example: "2026-09-12T08:01:00.000Z" })
  @IsOptional()
  @IsDateString()
  sentAt?: string;
}

export class DispatchPendingNotificationsDto {
  @ApiPropertyOptional({ example: 100, minimum: 1, maximum: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class NotificationDeliveryEventDto {
  @ApiProperty({ format: "uuid" })
  @IsAllowedTenantId()
  tenantId!: string;

  @ApiProperty({ example: "webhook-email-9f0b2ab11e6a" })
  @IsString()
  @MaxLength(160)
  providerMessageId!: string;

  @ApiProperty({ example: "WEBHOOK_EMAIL" })
  @IsString()
  @MaxLength(40)
  provider!: string;

  @ApiProperty({
    example: "DELIVERED",
    enum: [
      "SENT",
      "DELIVERED",
      "FAILED_PERMANENT",
      "SENT_TO_PROVIDER",
      "FAILED",
      "UNDELIVERABLE"
    ]
  })
  @IsIn([
    "SENT",
    "DELIVERED",
    "FAILED_PERMANENT",
    "SENT_TO_PROVIDER",
    "FAILED",
    "UNDELIVERABLE"
  ])
  status!:
    | "SENT"
    | "DELIVERED"
    | "FAILED_PERMANENT"
    | "SENT_TO_PROVIDER"
    | "FAILED"
    | "UNDELIVERABLE";

  @ApiPropertyOptional({ example: "Mailbox rejected by provider" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorMessage?: string;

  @ApiPropertyOptional({ example: "2026-09-12T08:01:00.000Z" })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

export class BrevoNotificationDeliveryEventDto {
  @ApiPropertyOptional({ example: 26224 })
  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(80)
  id?: string;

  @ApiPropertyOptional({ example: "delivered" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  event?: string;

  @ApiPropertyOptional({ example: "201798300811.5787683@relay.domain.com" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  "message-id"?: string;

  @ApiPropertyOptional({ example: 1511882900100020 })
  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(160)
  messageId?: string;

  @ApiPropertyOptional({ example: "delivered" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  msg_status?: string;

  @ApiPropertyOptional({ example: "OK" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @ApiPropertyOptional({ example: "delivered" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 1728459617 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ts_event?: number;

  @ApiPropertyOptional({ example: 1728459617000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ts_epoch?: number;

  // Official Brevo callback fields accepted by the strict global whitelist.
  // Recipient/content fields are intentionally ignored by the mapper and never persisted.
  @IsOptional()
  email?: unknown;

  @IsOptional()
  to?: unknown;

  @IsOptional()
  date?: unknown;

  @IsOptional()
  ts?: unknown;

  @IsOptional()
  subject?: unknown;

  @IsOptional()
  tag?: unknown;

  @IsOptional()
  tags?: unknown;

  @IsOptional()
  reference?: unknown;

  @IsOptional()
  type?: unknown;

  @IsOptional()
  error_code?: unknown;

  @IsOptional()
  reply?: unknown;

  @IsOptional()
  bounce_type?: unknown;

  @IsOptional()
  sending_ip?: unknown;

  @IsOptional()
  template_id?: unknown;

  @IsOptional()
  mirror_link?: unknown;

  @IsOptional()
  contact_id?: unknown;

  @IsOptional()
  "X-Mailin-custom"?: unknown;

  @IsOptional()
  user_agent?: unknown;

  @IsOptional()
  device_used?: unknown;

  @IsOptional()
  link?: unknown;

  @IsOptional()
  reason?: unknown;
}

export class ReplayNotificationDto {
  @ApiProperty({ example: "Relance validée après correction de l'adresse fournisseur." })
  @IsString()
  @MaxLength(300)
  @Matches(/\S/)
  reason!: string;
}
