import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AcademicTrack, Prisma } from "@prisma/client";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import {
  CreateRoomAssignmentDto,
  CreateRoomAvailabilityDto,
  CreateRoomDto
} from "./dto/rooms.dto";
import {
  type AssignmentWithRelations,
  type AvailabilityWithRelations,
  type RoomAssignmentEntity,
  type RoomAssignmentView,
  type RoomAvailabilityEntity,
  type RoomAvailabilityView,
  type RoomEntity,
  type RoomTypeEntity,
  type RoomTypeView,
  type RoomView,
  type RoomWithRelations
} from "./rooms.types";

@Injectable()
export class RoomsSupportService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async assertRoomPayload(
    tenantId: string,
    payload: Partial<CreateRoomDto>,
    ignoreId?: string,
    existing?: RoomEntity
  ): Promise<void> {
    if (payload.roomTypeId) await this.requireRoomType(tenantId, payload.roomTypeId);
    if (payload.capacity !== undefined && payload.capacity <= 0) {
      throw new BadRequestException("Room capacity must be greater than zero.");
    }
    if (payload.examCapacity !== undefined && payload.examCapacity <= 0) {
      throw new BadRequestException("Room exam capacity must be greater than zero.");
    }
    const shared = payload.isSharedBetweenCurricula ?? existing?.isSharedBetweenCurricula ?? true;
    const defaultTrack = payload.defaultTrack ?? existing?.defaultTrack ?? undefined;
    if (!shared && !defaultTrack) {
      throw new BadRequestException("A non-shared room must define a default curriculum.");
    }
    if (payload.code?.trim()) {
      const duplicate = await this.prisma.room.findFirst({
        where: { tenantId, id: ignoreId ? { not: ignoreId } : undefined, code: payload.code.trim().toUpperCase() }
      });
      if (duplicate) throw new ConflictException("Room code already exists for this establishment.");
    }
  }

  async assertAssignmentPayload(
    tenantId: string,
    payload: CreateRoomAssignmentDto,
    ignoreId?: string
  ): Promise<void> {
    const room = await this.requireRoom(tenantId, payload.roomId);
    if (room.status !== "ACTIVE" || room.archivedAt) {
      throw new ConflictException("Room must be active before assignment.");
    }
    const schoolYear = await this.requireSchoolYear(tenantId, payload.schoolYearId);
    const [classroom, level, cycle, subject, period] = await Promise.all([
      payload.classId ? this.requireClassroom(tenantId, payload.classId) : Promise.resolve(undefined),
      payload.levelId ? this.requireLevel(tenantId, payload.levelId) : Promise.resolve(undefined),
      payload.cycleId ? this.requireCycle(tenantId, payload.cycleId) : Promise.resolve(undefined),
      payload.subjectId ? this.requireSubject(tenantId, payload.subjectId) : Promise.resolve(undefined),
      payload.periodId ? this.requirePeriod(tenantId, payload.periodId) : Promise.resolve(undefined)
    ]);
    if (classroom && classroom.schoolYearId !== schoolYear.id) {
      throw new ConflictException("Class must belong to the selected school year.");
    }
    if (level && classroom && classroom.levelId !== level.id) {
      throw new ConflictException("Room assignment level must match the selected class.");
    }
    if (cycle && level && level.cycleId !== cycle.id) {
      throw new ConflictException("Room assignment level must belong to the selected cycle.");
    }
    if (period && period.schoolYearId !== schoolYear.id) {
      throw new ConflictException("Period must belong to the selected school year.");
    }
    if (subject && payload.track) this.assertSubjectMatchesTrack(subject, payload.track);
    if (!room.isSharedBetweenCurricula && room.defaultTrack && payload.track && payload.track !== room.defaultTrack) {
      throw new ConflictException("This room is dedicated to another curriculum.");
    }
    const requiresTarget = ["CLASS_HOME_ROOM", "SUBJECT_ROOM", "CURRICULUM_DEDICATED", "EXAM_ROOM"].includes(payload.assignmentType);
    if (requiresTarget && !payload.classId && !payload.levelId && !payload.cycleId && !payload.track && !payload.subjectId) {
      throw new BadRequestException("Room assignment requires at least one pedagogical target.");
    }
    const startDate = payload.startDate ? this.toDateOnly(payload.startDate) : undefined;
    const endDate = payload.endDate ? this.toDateOnly(payload.endDate) : undefined;
    if (startDate && (startDate < schoolYear.startDate || startDate > schoolYear.endDate)) {
      throw new ConflictException("Room assignment start date must stay within the school year.");
    }
    if (endDate && (endDate < schoolYear.startDate || endDate > schoolYear.endDate)) {
      throw new ConflictException("Room assignment end date must stay within the school year.");
    }
    if (startDate && endDate && endDate <= startDate) {
      throw new BadRequestException("Room assignment end date must be after start date.");
    }
    const duplicate = await this.prisma.roomAssignment.findFirst({
      where: {
        tenantId,
        id: ignoreId ? { not: ignoreId } : undefined,
        roomId: payload.roomId,
        schoolYearId: payload.schoolYearId,
        classId: payload.classId || null,
        levelId: payload.levelId || null,
        cycleId: payload.cycleId || null,
        track: payload.track || null,
        subjectId: payload.subjectId || null,
        periodId: payload.periodId || null,
        assignmentType: payload.assignmentType
      }
    });
    if (duplicate) throw new ConflictException("Room assignment already exists for this exact scope.");
  }

  async assertAvailabilityPayload(tenantId: string, payload: CreateRoomAvailabilityDto): Promise<void> {
    await this.requireRoom(tenantId, payload.roomId);
    if (payload.schoolYearId) await this.requireSchoolYear(tenantId, payload.schoolYearId);
    if (payload.periodId) {
      const period = await this.requirePeriod(tenantId, payload.periodId);
      if (payload.schoolYearId && period.schoolYearId !== payload.schoolYearId) {
        throw new ConflictException("Availability period must belong to the selected school year.");
      }
    }
    if (payload.dayOfWeek !== undefined && payload.dayOfWeek > 7) {
      throw new BadRequestException("Day of week must be between 1 and 7.");
    }
    if ((payload.startTime && !payload.endTime) || (!payload.startTime && payload.endTime)) {
      throw new BadRequestException("Availability start and end times must be provided together.");
    }
    if (payload.startTime && payload.endTime && payload.endTime <= payload.startTime) {
      throw new BadRequestException("Availability end time must be after start time.");
    }
  }

  assertSubjectMatchesTrack(subject: { nature: string }, track: AcademicTrack): void {
    if (
      (subject.nature === AcademicTrack.FRANCOPHONE || subject.nature === AcademicTrack.ARABOPHONE) &&
      subject.nature !== track
    ) {
      throw new ConflictException("Subject curriculum must match the selected room assignment curriculum.");
    }
  }

  async requireRoomType(tenantId: string, id: string): Promise<RoomTypeEntity> {
    const row = await this.prisma.roomType.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Room type not found.");
    return row;
  }

  async requireRoom(tenantId: string, id: string): Promise<RoomEntity> {
    const row = await this.prisma.room.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Room not found.");
    return row;
  }

  async requireAssignment(tenantId: string, id: string): Promise<RoomAssignmentEntity> {
    const row = await this.prisma.roomAssignment.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Room assignment not found.");
    return row;
  }

  async requireAvailability(tenantId: string, id: string): Promise<RoomAvailabilityEntity> {
    const row = await this.prisma.roomAvailability.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Room availability not found.");
    return row;
  }

  async requireSchoolYear(tenantId: string, id: string) {
    const row = await this.prisma.schoolYear.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("School year not found.");
    return row;
  }

  async requireClassroom(tenantId: string, id: string) {
    const row = await this.prisma.classroom.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Class not found.");
    return row;
  }

  async requireLevel(tenantId: string, id: string) {
    const row = await this.prisma.level.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Level not found.");
    return row;
  }

  async requireCycle(tenantId: string, id: string) {
    const row = await this.prisma.cycle.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Cycle not found.");
    return row;
  }

  async requireSubject(tenantId: string, id: string) {
    const row = await this.prisma.subject.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Subject not found.");
    return row;
  }

  async requirePeriod(tenantId: string, id: string) {
    const row = await this.prisma.academicPeriod.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Period not found.");
    return row;
  }

  assignmentInclude() {
    return {
      room: true,
      schoolYear: true,
      classroom: true,
      level: true,
      cycle: true,
      subject: true,
      academicPeriod: true
    } satisfies Prisma.RoomAssignmentInclude;
  }

  availabilityInclude() {
    return {
      room: true,
      schoolYear: true,
      academicPeriod: true
    } satisfies Prisma.RoomAvailabilityInclude;
  }

  roomTypeView(row: RoomTypeEntity): RoomTypeView {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description || undefined,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  roomView(row: RoomWithRelations): RoomView {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      building: row.building || undefined,
      floor: row.floor || undefined,
      location: row.location || undefined,
      description: row.description || undefined,
      roomTypeId: row.roomTypeId,
      roomTypeName: row.roomType.name,
      capacity: row.capacity,
      examCapacity: row.examCapacity ?? undefined,
      status: row.status,
      isSharedBetweenCurricula: row.isSharedBetweenCurricula,
      defaultTrack: row.defaultTrack ?? undefined,
      establishmentId: row.establishmentId || undefined,
      notes: row.notes || undefined,
      activeAssignmentsCount: row.assignments.filter((item) => item.status === "ACTIVE").length,
      archivedAt: row.archivedAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  assignmentView(row: AssignmentWithRelations): RoomAssignmentView {
    return {
      id: row.id,
      roomId: row.roomId,
      roomLabel: `${row.room.code} - ${row.room.name}`,
      schoolYearId: row.schoolYearId,
      schoolYearCode: row.schoolYear.code,
      classId: row.classId || undefined,
      classLabel: row.classroom?.label,
      levelId: row.levelId || undefined,
      levelLabel: row.level?.label,
      cycleId: row.cycleId || undefined,
      cycleLabel: row.cycle?.label,
      track: row.track ?? undefined,
      subjectId: row.subjectId || undefined,
      subjectLabel: row.subject?.label,
      periodId: row.periodId || undefined,
      periodLabel: row.academicPeriod?.label,
      assignmentType: row.assignmentType,
      startDate: this.formatDate(row.startDate),
      endDate: this.formatDate(row.endDate),
      status: row.status,
      comment: row.comment || undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  availabilityView(row: AvailabilityWithRelations): RoomAvailabilityView {
    return {
      id: row.id,
      roomId: row.roomId,
      roomLabel: `${row.room.code} - ${row.room.name}`,
      dayOfWeek: row.dayOfWeek ?? undefined,
      startTime: row.startTime || undefined,
      endTime: row.endTime || undefined,
      availabilityType: row.availabilityType,
      schoolYearId: row.schoolYearId || undefined,
      schoolYearCode: row.schoolYear?.code,
      periodId: row.periodId || undefined,
      periodLabel: row.academicPeriod?.label,
      comment: row.comment || undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  toDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  formatDate(value?: Date | null): string | undefined {
    return value ? value.toISOString().slice(0, 10) : undefined;
  }

  optionalTrim(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  async logAudit(
    tenantId: string,
    actorUserId: string,
    action: string,
    resource: string,
    resourceId?: string,
    payload?: Prisma.InputJsonValue
  ): Promise<void> {
    await this.auditService.enqueueLog({ tenantId, userId: actorUserId, action, resource, resourceId, payload });
  }

  handleKnownPrismaConflict(error: unknown, message: string): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictException(message);
    }
  }
}
