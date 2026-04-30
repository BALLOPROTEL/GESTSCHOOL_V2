import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min
} from "class-validator";

export const ROOM_STATUS_VALUES = ["ACTIVE", "INACTIVE", "MAINTENANCE", "ARCHIVED"] as const;
export const ROOM_TYPE_STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const;
export const ROOM_ASSIGNMENT_STATUS_VALUES = ["ACTIVE", "INACTIVE", "COMPLETED", "ARCHIVED"] as const;
export const ROOM_ASSIGNMENT_TYPE_VALUES = [
  "CLASS_HOME_ROOM",
  "SUBJECT_ROOM",
  "CURRICULUM_DEDICATED",
  "EXAM_ROOM",
  "SHARED_ROOM",
  "TEMPORARY_ASSIGNMENT"
] as const;
export const ROOM_AVAILABILITY_TYPE_VALUES = ["AVAILABLE", "UNAVAILABLE", "MAINTENANCE", "RESERVED"] as const;
export const ACADEMIC_TRACK_VALUES = ["FRANCOPHONE", "ARABOPHONE"] as const;

export class CreateRoomTypeDto {
  @ApiProperty({ example: "CLASSROOM" })
  @IsString()
  @MaxLength(40)
  code!: string;

  @ApiProperty({ example: "Salle de classe" })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: ROOM_TYPE_STATUS_VALUES, default: "ACTIVE" })
  @IsOptional()
  @IsIn(ROOM_TYPE_STATUS_VALUES)
  status?: (typeof ROOM_TYPE_STATUS_VALUES)[number];
}

export class UpdateRoomTypeDto extends PartialType(CreateRoomTypeDto) {}

export class CreateRoomDto {
  @ApiProperty({ example: "A-101" })
  @IsString()
  @MaxLength(40)
  code!: string;

  @ApiProperty({ example: "Salle A 101" })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: "Batiment A" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  building?: string;

  @ApiPropertyOptional({ example: "1er" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  floor?: string;

  @ApiPropertyOptional({ example: "Bloc nord" })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty()
  @IsUUID("all")
  roomTypeId!: string;

  @ApiProperty({ example: 36 })
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsInt()
  @Min(1)
  examCapacity?: number;

  @ApiPropertyOptional({ enum: ROOM_STATUS_VALUES, default: "ACTIVE" })
  @IsOptional()
  @IsIn(ROOM_STATUS_VALUES)
  status?: (typeof ROOM_STATUS_VALUES)[number];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isSharedBetweenCurricula?: boolean;

  @ApiPropertyOptional({ enum: ACADEMIC_TRACK_VALUES })
  @IsOptional()
  @IsIn(ACADEMIC_TRACK_VALUES)
  defaultTrack?: (typeof ACADEMIC_TRACK_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  establishmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateRoomDto extends PartialType(CreateRoomDto) {}

export class CreateRoomAssignmentDto {
  @ApiProperty()
  @IsUUID("all")
  roomId!: string;

  @ApiProperty()
  @IsUUID("all")
  schoolYearId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  classId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  levelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  cycleId?: string;

  @ApiPropertyOptional({ enum: ACADEMIC_TRACK_VALUES })
  @IsOptional()
  @IsIn(ACADEMIC_TRACK_VALUES)
  track?: (typeof ACADEMIC_TRACK_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  subjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  periodId?: string;

  @ApiProperty({ enum: ROOM_ASSIGNMENT_TYPE_VALUES, example: "CLASS_HOME_ROOM" })
  @IsIn(ROOM_ASSIGNMENT_TYPE_VALUES)
  assignmentType!: (typeof ROOM_ASSIGNMENT_TYPE_VALUES)[number];

  @ApiPropertyOptional({ example: "2025-09-01" })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: "2026-06-30" })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: ROOM_ASSIGNMENT_STATUS_VALUES, default: "ACTIVE" })
  @IsOptional()
  @IsIn(ROOM_ASSIGNMENT_STATUS_VALUES)
  status?: (typeof ROOM_ASSIGNMENT_STATUS_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class UpdateRoomAssignmentDto extends PartialType(CreateRoomAssignmentDto) {}

export class CreateRoomAvailabilityDto {
  @ApiProperty()
  @IsUUID("all")
  roomId!: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  dayOfWeek?: number;

  @ApiPropertyOptional({ example: "08:00" })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  startTime?: string;

  @ApiPropertyOptional({ example: "10:00" })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  endTime?: string;

  @ApiProperty({ enum: ROOM_AVAILABILITY_TYPE_VALUES, example: "AVAILABLE" })
  @IsIn(ROOM_AVAILABILITY_TYPE_VALUES)
  availabilityType!: (typeof ROOM_AVAILABILITY_TYPE_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  schoolYearId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("all")
  periodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class UpdateRoomAvailabilityDto extends PartialType(CreateRoomAvailabilityDto) {}
