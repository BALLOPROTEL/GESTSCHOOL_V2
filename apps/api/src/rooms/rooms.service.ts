import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AcademicTrack, Prisma, type Room, type RoomAssignment, type RoomAvailability, type RoomType } from "@prisma/client";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import {
  CreateRoomAssignmentDto,
  CreateRoomAvailabilityDto,
  CreateRoomDto,
  CreateRoomTypeDto,
  ROOM_ASSIGNMENT_STATUS_VALUES,
  ROOM_ASSIGNMENT_TYPE_VALUES,
  ROOM_AVAILABILITY_TYPE_VALUES,
  UpdateRoomAssignmentDto,
  UpdateRoomAvailabilityDto,
  UpdateRoomDto,
  UpdateRoomTypeDto
} from "./dto/rooms.dto";

type RoomFilters = {
  search?: string;
  status?: string;
  roomTypeId?: string;
  track?: AcademicTrack;
  minCapacity?: number;
  schoolYearId?: string;
  includeArchived?: string;
};

type AssignmentFilters = {
  roomId?: string;
  schoolYearId?: string;
  classId?: string;
  subjectId?: string;
  track?: AcademicTrack;
  status?: string;
};

type RoomWithRelations = Prisma.RoomGetPayload<{ include: { roomType: true; assignments: true } }>;
type AssignmentWithRelations = Prisma.RoomAssignmentGetPayload<{
  include: {
    room: true;
    schoolYear: true;
    classroom: true;
    level: true;
    cycle: true;
    subject: true;
    academicPeriod: true;
  };
}>;
type AvailabilityWithRelations = Prisma.RoomAvailabilityGetPayload<{
  include: { room: true; schoolYear: true; academicPeriod: true };
}>;

export type RoomTypeView = {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type RoomView = {
  id: string;
  code: string;
  name: string;
  building?: string;
  floor?: string;
  location?: string;
  description?: string;
  roomTypeId: string;
  roomTypeName?: string;
  capacity: number;
  examCapacity?: number;
  status: string;
  isSharedBetweenCurricula: boolean;
  defaultTrack?: AcademicTrack;
  establishmentId?: string;
  notes?: string;
  activeAssignmentsCount: number;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type RoomAssignmentView = {
  id: string;
  roomId: string;
  roomLabel?: string;
  schoolYearId: string;
  schoolYearCode?: string;
  classId?: string;
  classLabel?: string;
  levelId?: string;
  levelLabel?: string;
  cycleId?: string;
  cycleLabel?: string;
  track?: AcademicTrack;
  subjectId?: string;
  subjectLabel?: string;
  periodId?: string;
  periodLabel?: string;
  assignmentType: string;
  startDate?: string;
  endDate?: string;
  status: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};

export type RoomAvailabilityView = {
  id: string;
  roomId: string;
  roomLabel?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  availabilityType: string;
  schoolYearId?: string;
  schoolYearCode?: string;
  periodId?: string;
  periodLabel?: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};

export type RoomDetailView = RoomView & {
  assignments: RoomAssignmentView[];
  availabilities: RoomAvailabilityView[];
};

export type RoomOccupancyView = {
  roomId: string;
  roomLabel: string;
  roomTypeName?: string;
  capacity: number;
  status: string;
  defaultTrack?: AcademicTrack;
  isSharedBetweenCurricula: boolean;
  assignmentsCount: number;
  francophoneAssignmentsCount: number;
  arabophoneAssignmentsCount: number;
  sharedAssignmentsCount: number;
  classes: string[];
  subjects: string[];
};

@Injectable()
export class RoomsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService
  ) {}

  async listRoomTypes(tenantId: string): Promise<RoomTypeView[]> {
    const rows = await this.prisma.roomType.findMany({
      where: { tenantId },
      orderBy: [{ status: "asc" }, { name: "asc" }]
    });
    return rows.map((row) => this.roomTypeView(row));
  }

  async createRoomType(tenantId: string, actorUserId: string, payload: CreateRoomTypeDto): Promise<RoomTypeView> {
    try {
      const created = await this.prisma.roomType.create({
        data: {
          tenantId,
          code: payload.code.trim().toUpperCase(),
          name: payload.name.trim(),
          description: this.optionalTrim(payload.description),
          status: payload.status || "ACTIVE",
          updatedAt: new Date()
        }
      });
      await this.logAudit(tenantId, actorUserId, "ROOM_TYPE_CREATED", "room_types", created.id, { code: created.code });
      return this.roomTypeView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Room type code already exists.");
      throw error;
    }
  }

  async updateRoomType(tenantId: string, actorUserId: string, id: string, payload: UpdateRoomTypeDto): Promise<RoomTypeView> {
    const existing = await this.requireRoomType(tenantId, id);
    try {
      const updated = await this.prisma.roomType.update({
        where: { id: existing.id },
        data: {
          code: payload.code?.trim().toUpperCase(),
          name: payload.name?.trim(),
          description: payload.description !== undefined ? this.optionalTrim(payload.description) : undefined,
          status: payload.status,
          updatedAt: new Date()
        }
      });
      await this.logAudit(tenantId, actorUserId, "ROOM_TYPE_UPDATED", "room_types", updated.id);
      return this.roomTypeView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Room type code already exists.");
      throw error;
    }
  }

  async listRooms(tenantId: string, filters: RoomFilters = {}): Promise<RoomView[]> {
    const where: Prisma.RoomWhereInput = {
      tenantId,
      status: filters.status || undefined,
      roomTypeId: filters.roomTypeId || undefined,
      capacity: filters.minCapacity ? { gte: filters.minCapacity } : undefined,
      archivedAt: filters.includeArchived === "true" || filters.status === "ARCHIVED" ? undefined : null,
      assignments: filters.schoolYearId ? { some: { schoolYearId: filters.schoolYearId } } : undefined
    };
    if (filters.track) {
      where.AND = [
        {
          OR: [
            { isSharedBetweenCurricula: true },
            { defaultTrack: filters.track },
            { assignments: { some: { track: filters.track, status: { not: "ARCHIVED" } } } }
          ]
        }
      ];
    }
    const search = filters.search?.trim();
    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { code: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { building: { contains: search, mode: "insensitive" } },
            { location: { contains: search, mode: "insensitive" } }
          ]
        }
      ];
    }
    const rows = await this.prisma.room.findMany({
      where,
      include: {
        roomType: true,
        assignments: { where: { status: "ACTIVE" } }
      },
      orderBy: [{ building: "asc" }, { code: "asc" }]
    });
    return rows.map((row) => this.roomView(row));
  }

  async getRoomDetail(tenantId: string, id: string): Promise<RoomDetailView> {
    const room = await this.prisma.room.findFirst({
      where: { tenantId, id },
      include: {
        roomType: true,
        assignments: { include: this.assignmentInclude(), orderBy: [{ createdAt: "desc" }] },
        availabilities: { include: this.availabilityInclude(), orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }
      }
    });
    if (!room) throw new NotFoundException("Room not found.");
    return {
      ...this.roomView(room),
      assignments: room.assignments.map((row) => this.assignmentView(row)),
      availabilities: room.availabilities.map((row) => this.availabilityView(row))
    };
  }

  async createRoom(tenantId: string, actorUserId: string, payload: CreateRoomDto): Promise<RoomView> {
    await this.assertRoomPayload(tenantId, payload);
    try {
      const created = await this.prisma.room.create({
        data: {
          tenantId,
          code: payload.code.trim().toUpperCase(),
          name: payload.name.trim(),
          building: this.optionalTrim(payload.building),
          floor: this.optionalTrim(payload.floor),
          location: this.optionalTrim(payload.location),
          description: this.optionalTrim(payload.description),
          roomTypeId: payload.roomTypeId,
          capacity: payload.capacity,
          examCapacity: payload.examCapacity,
          status: payload.status || "ACTIVE",
          isSharedBetweenCurricula: payload.isSharedBetweenCurricula ?? true,
          defaultTrack: payload.isSharedBetweenCurricula === false ? payload.defaultTrack : null,
          establishmentId: payload.establishmentId,
          notes: this.optionalTrim(payload.notes),
          archivedAt: payload.status === "ARCHIVED" ? new Date() : null,
          updatedAt: new Date()
        },
        include: { roomType: true, assignments: true }
      });
      await this.logAudit(tenantId, actorUserId, "ROOM_CREATED", "rooms", created.id, { code: created.code });
      return this.roomView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Room code already exists.");
      throw error;
    }
  }

  async updateRoom(tenantId: string, actorUserId: string, id: string, payload: UpdateRoomDto): Promise<RoomView> {
    const existing = await this.requireRoom(tenantId, id);
    await this.assertRoomPayload(tenantId, payload, existing.id, existing);
    try {
      const nextShared = payload.isSharedBetweenCurricula ?? existing.isSharedBetweenCurricula;
      const updated = await this.prisma.room.update({
        where: { id: existing.id },
        data: {
          code: payload.code?.trim().toUpperCase(),
          name: payload.name?.trim(),
          building: payload.building !== undefined ? this.optionalTrim(payload.building) : undefined,
          floor: payload.floor !== undefined ? this.optionalTrim(payload.floor) : undefined,
          location: payload.location !== undefined ? this.optionalTrim(payload.location) : undefined,
          description: payload.description !== undefined ? this.optionalTrim(payload.description) : undefined,
          roomTypeId: payload.roomTypeId,
          capacity: payload.capacity,
          examCapacity: payload.examCapacity,
          status: payload.status,
          isSharedBetweenCurricula: payload.isSharedBetweenCurricula,
          defaultTrack: nextShared ? null : payload.defaultTrack ?? existing.defaultTrack,
          establishmentId: payload.establishmentId,
          notes: payload.notes !== undefined ? this.optionalTrim(payload.notes) : undefined,
          archivedAt: payload.status === "ARCHIVED" ? existing.archivedAt ?? new Date() : payload.status ? null : undefined,
          updatedAt: new Date()
        },
        include: { roomType: true, assignments: true }
      });
      await this.logAudit(tenantId, actorUserId, "ROOM_UPDATED", "rooms", updated.id);
      return this.roomView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Room code already exists.");
      throw error;
    }
  }

  async archiveRoom(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.requireRoom(tenantId, id);
    await this.prisma.room.update({
      where: { id: existing.id },
      data: { status: "ARCHIVED", archivedAt: existing.archivedAt ?? new Date(), updatedAt: new Date() }
    });
    await this.logAudit(tenantId, actorUserId, "ROOM_ARCHIVED", "rooms", existing.id, { code: existing.code });
  }

  async listAssignments(tenantId: string, filters: AssignmentFilters = {}): Promise<RoomAssignmentView[]> {
    const rows = await this.prisma.roomAssignment.findMany({
      where: {
        tenantId,
        roomId: filters.roomId,
        schoolYearId: filters.schoolYearId,
        classId: filters.classId,
        subjectId: filters.subjectId,
        track: filters.track,
        status: filters.status
      },
      include: this.assignmentInclude(),
      orderBy: [{ schoolYear: { code: "desc" } }, { createdAt: "desc" }]
    });
    return rows.map((row) => this.assignmentView(row));
  }

  async createAssignment(tenantId: string, actorUserId: string, payload: CreateRoomAssignmentDto): Promise<RoomAssignmentView> {
    await this.assertAssignmentPayload(tenantId, payload);
    try {
      const created = await this.prisma.roomAssignment.create({
        data: {
          tenantId,
          roomId: payload.roomId,
          schoolYearId: payload.schoolYearId,
          classId: payload.classId || null,
          levelId: payload.levelId || null,
          cycleId: payload.cycleId || null,
          track: payload.track || null,
          subjectId: payload.subjectId || null,
          periodId: payload.periodId || null,
          assignmentType: payload.assignmentType,
          startDate: payload.startDate ? this.toDateOnly(payload.startDate) : null,
          endDate: payload.endDate ? this.toDateOnly(payload.endDate) : null,
          status: payload.status || "ACTIVE",
          comment: this.optionalTrim(payload.comment),
          updatedAt: new Date()
        },
        include: this.assignmentInclude()
      });
      await this.logAudit(tenantId, actorUserId, "ROOM_ASSIGNMENT_CREATED", "room_assignments", created.id, {
        roomId: created.roomId,
        track: created.track
      });
      return this.assignmentView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaConflict(error, "Room assignment already exists for this exact scope.");
      throw error;
    }
  }

  async updateAssignment(
    tenantId: string,
    actorUserId: string,
    id: string,
    payload: UpdateRoomAssignmentDto
  ): Promise<RoomAssignmentView> {
    const existing = await this.requireAssignment(tenantId, id);
    await this.assertAssignmentPayload(
      tenantId,
      {
        roomId: payload.roomId ?? existing.roomId,
        schoolYearId: payload.schoolYearId ?? existing.schoolYearId,
        classId: payload.classId ?? existing.classId ?? undefined,
        levelId: payload.levelId ?? existing.levelId ?? undefined,
        cycleId: payload.cycleId ?? existing.cycleId ?? undefined,
        track: payload.track ?? existing.track ?? undefined,
        subjectId: payload.subjectId ?? existing.subjectId ?? undefined,
        periodId: payload.periodId ?? existing.periodId ?? undefined,
        assignmentType: (payload.assignmentType ?? existing.assignmentType) as (typeof ROOM_ASSIGNMENT_TYPE_VALUES)[number],
        startDate: payload.startDate ?? this.formatDate(existing.startDate),
        endDate: payload.endDate ?? this.formatDate(existing.endDate),
        status: (payload.status ?? existing.status) as (typeof ROOM_ASSIGNMENT_STATUS_VALUES)[number],
        comment: payload.comment ?? existing.comment ?? undefined
      },
      existing.id
    );
    const updated = await this.prisma.roomAssignment.update({
      where: { id: existing.id },
      data: {
        roomId: payload.roomId,
        schoolYearId: payload.schoolYearId,
        classId: payload.classId,
        levelId: payload.levelId,
        cycleId: payload.cycleId,
        track: payload.track,
        subjectId: payload.subjectId,
        periodId: payload.periodId,
        assignmentType: payload.assignmentType,
        startDate: payload.startDate ? this.toDateOnly(payload.startDate) : undefined,
        endDate: payload.endDate ? this.toDateOnly(payload.endDate) : undefined,
        status: payload.status,
        comment: payload.comment !== undefined ? this.optionalTrim(payload.comment) : undefined,
        updatedAt: new Date()
      },
      include: this.assignmentInclude()
    });
    await this.logAudit(tenantId, actorUserId, "ROOM_ASSIGNMENT_UPDATED", "room_assignments", updated.id);
    return this.assignmentView(updated);
  }

  async archiveAssignment(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.requireAssignment(tenantId, id);
    await this.prisma.roomAssignment.update({
      where: { id: existing.id },
      data: { status: "ARCHIVED", updatedAt: new Date() }
    });
    await this.logAudit(tenantId, actorUserId, "ROOM_ASSIGNMENT_ARCHIVED", "room_assignments", existing.id);
  }

  async listAvailabilities(tenantId: string, roomId?: string): Promise<RoomAvailabilityView[]> {
    const rows = await this.prisma.roomAvailability.findMany({
      where: { tenantId, roomId },
      include: this.availabilityInclude(),
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
    });
    return rows.map((row) => this.availabilityView(row));
  }

  async createAvailability(
    tenantId: string,
    actorUserId: string,
    payload: CreateRoomAvailabilityDto
  ): Promise<RoomAvailabilityView> {
    await this.assertAvailabilityPayload(tenantId, payload);
    const created = await this.prisma.roomAvailability.create({
      data: {
        tenantId,
        roomId: payload.roomId,
        dayOfWeek: payload.dayOfWeek,
        startTime: payload.startTime,
        endTime: payload.endTime,
        availabilityType: payload.availabilityType,
        schoolYearId: payload.schoolYearId || null,
        periodId: payload.periodId || null,
        comment: this.optionalTrim(payload.comment),
        updatedAt: new Date()
      },
      include: this.availabilityInclude()
    });
    await this.logAudit(tenantId, actorUserId, "ROOM_AVAILABILITY_CREATED", "room_availabilities", created.id);
    return this.availabilityView(created);
  }

  async updateAvailability(
    tenantId: string,
    actorUserId: string,
    id: string,
    payload: UpdateRoomAvailabilityDto
  ): Promise<RoomAvailabilityView> {
    const existing = await this.requireAvailability(tenantId, id);
    await this.assertAvailabilityPayload(tenantId, {
      roomId: payload.roomId ?? existing.roomId,
      dayOfWeek: payload.dayOfWeek ?? existing.dayOfWeek ?? undefined,
      startTime: payload.startTime ?? existing.startTime ?? undefined,
      endTime: payload.endTime ?? existing.endTime ?? undefined,
      availabilityType: (payload.availabilityType ?? existing.availabilityType) as (typeof ROOM_AVAILABILITY_TYPE_VALUES)[number],
      schoolYearId: payload.schoolYearId ?? existing.schoolYearId ?? undefined,
      periodId: payload.periodId ?? existing.periodId ?? undefined,
      comment: payload.comment ?? existing.comment ?? undefined
    });
    const updated = await this.prisma.roomAvailability.update({
      where: { id: existing.id },
      data: {
        roomId: payload.roomId,
        dayOfWeek: payload.dayOfWeek,
        startTime: payload.startTime,
        endTime: payload.endTime,
        availabilityType: payload.availabilityType,
        schoolYearId: payload.schoolYearId,
        periodId: payload.periodId,
        comment: payload.comment !== undefined ? this.optionalTrim(payload.comment) : undefined,
        updatedAt: new Date()
      },
      include: this.availabilityInclude()
    });
    await this.logAudit(tenantId, actorUserId, "ROOM_AVAILABILITY_UPDATED", "room_availabilities", updated.id);
    return this.availabilityView(updated);
  }

  async deleteAvailability(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.requireAvailability(tenantId, id);
    await this.prisma.roomAvailability.delete({ where: { id: existing.id } });
    await this.logAudit(tenantId, actorUserId, "ROOM_AVAILABILITY_DELETED", "room_availabilities", existing.id);
  }

  async listOccupancy(tenantId: string, schoolYearId?: string, track?: AcademicTrack): Promise<RoomOccupancyView[]> {
    const rooms = await this.prisma.room.findMany({
      where: { tenantId, archivedAt: null },
      include: {
        roomType: true,
        assignments: {
          where: { schoolYearId, track, status: { not: "ARCHIVED" } },
          include: { classroom: true, subject: true }
        }
      },
      orderBy: [{ code: "asc" }]
    });

    return rooms.map((room) => {
      const francophone = room.assignments.filter((item) => item.track === AcademicTrack.FRANCOPHONE);
      const arabophone = room.assignments.filter((item) => item.track === AcademicTrack.ARABOPHONE);
      const shared = room.assignments.filter((item) => item.track === null);
      return {
        roomId: room.id,
        roomLabel: `${room.code} - ${room.name}`,
        roomTypeName: room.roomType.name,
        capacity: room.capacity,
        status: room.status,
        defaultTrack: room.defaultTrack ?? undefined,
        isSharedBetweenCurricula: room.isSharedBetweenCurricula,
        assignmentsCount: room.assignments.length,
        francophoneAssignmentsCount: francophone.length,
        arabophoneAssignmentsCount: arabophone.length,
        sharedAssignmentsCount: shared.length,
        classes: Array.from(new Set(room.assignments.map((item) => item.classroom?.label).filter(Boolean) as string[])),
        subjects: Array.from(new Set(room.assignments.map((item) => item.subject?.label).filter(Boolean) as string[]))
      };
    });
  }

  private async assertRoomPayload(
    tenantId: string,
    payload: Partial<CreateRoomDto>,
    ignoreId?: string,
    existing?: Room
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

  private async assertAssignmentPayload(
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

  private async assertAvailabilityPayload(tenantId: string, payload: CreateRoomAvailabilityDto): Promise<void> {
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

  private assertSubjectMatchesTrack(subject: { nature: string }, track: AcademicTrack): void {
    if (
      (subject.nature === AcademicTrack.FRANCOPHONE || subject.nature === AcademicTrack.ARABOPHONE) &&
      subject.nature !== track
    ) {
      throw new ConflictException("Subject curriculum must match the selected room assignment curriculum.");
    }
  }

  private async requireRoomType(tenantId: string, id: string): Promise<RoomType> {
    const row = await this.prisma.roomType.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Room type not found.");
    return row;
  }

  private async requireRoom(tenantId: string, id: string): Promise<Room> {
    const row = await this.prisma.room.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Room not found.");
    return row;
  }

  private async requireAssignment(tenantId: string, id: string): Promise<RoomAssignment> {
    const row = await this.prisma.roomAssignment.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Room assignment not found.");
    return row;
  }

  private async requireAvailability(tenantId: string, id: string): Promise<RoomAvailability> {
    const row = await this.prisma.roomAvailability.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Room availability not found.");
    return row;
  }

  private async requireSchoolYear(tenantId: string, id: string) {
    const row = await this.prisma.schoolYear.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("School year not found.");
    return row;
  }

  private async requireClassroom(tenantId: string, id: string) {
    const row = await this.prisma.classroom.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Class not found.");
    return row;
  }

  private async requireLevel(tenantId: string, id: string) {
    const row = await this.prisma.level.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Level not found.");
    return row;
  }

  private async requireCycle(tenantId: string, id: string) {
    const row = await this.prisma.cycle.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Cycle not found.");
    return row;
  }

  private async requireSubject(tenantId: string, id: string) {
    const row = await this.prisma.subject.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Subject not found.");
    return row;
  }

  private async requirePeriod(tenantId: string, id: string) {
    const row = await this.prisma.academicPeriod.findFirst({ where: { tenantId, id } });
    if (!row) throw new NotFoundException("Period not found.");
    return row;
  }

  private assignmentInclude() {
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

  private availabilityInclude() {
    return {
      room: true,
      schoolYear: true,
      academicPeriod: true
    } satisfies Prisma.RoomAvailabilityInclude;
  }

  private roomTypeView(row: RoomType): RoomTypeView {
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

  private roomView(row: RoomWithRelations): RoomView {
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

  private assignmentView(row: AssignmentWithRelations): RoomAssignmentView {
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

  private availabilityView(row: AvailabilityWithRelations): RoomAvailabilityView {
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

  private toDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private formatDate(value?: Date | null): string | undefined {
    return value ? value.toISOString().slice(0, 10) : undefined;
  }

  private optionalTrim(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private async logAudit(
    tenantId: string,
    actorUserId: string,
    action: string,
    resource: string,
    resourceId?: string,
    payload?: Prisma.InputJsonValue
  ): Promise<void> {
    await this.auditService.enqueueLog({ tenantId, userId: actorUserId, action, resource, resourceId, payload });
  }

  private handleKnownPrismaConflict(error: unknown, message: string): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictException(message);
    }
  }
}
