import { Injectable, NotFoundException } from "@nestjs/common";
import { AcademicTrack, Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import {
  CreateRoomDto,
  UpdateRoomDto
} from "./dto/rooms.dto";
import { RoomsSupportService } from "./rooms-support.service";
import {
  type RoomDetailView,
  type RoomFilters,
  type RoomOccupancyView,
  type RoomView
} from "./rooms.types";

@Injectable()
export class RoomsCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsSupportService: RoomsSupportService
  ) {}

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
    return rows.map((row) => this.roomsSupportService.roomView(row));
  }

  async getRoomDetail(tenantId: string, id: string): Promise<RoomDetailView> {
    const room = await this.prisma.room.findFirst({
      where: { tenantId, id },
      include: {
        roomType: true,
        assignments: { include: this.roomsSupportService.assignmentInclude(), orderBy: [{ createdAt: "desc" }] },
        availabilities: { include: this.roomsSupportService.availabilityInclude(), orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }
      }
    });
    if (!room) throw new NotFoundException("Room not found.");
    return {
      ...this.roomsSupportService.roomView(room),
      assignments: room.assignments.map((row) => this.roomsSupportService.assignmentView(row)),
      availabilities: room.availabilities.map((row) => this.roomsSupportService.availabilityView(row))
    };
  }

  async createRoom(tenantId: string, actorUserId: string, payload: CreateRoomDto): Promise<RoomView> {
    await this.roomsSupportService.assertRoomPayload(tenantId, payload);
    try {
      const created = await this.prisma.room.create({
        data: {
          tenantId,
          code: payload.code.trim().toUpperCase(),
          name: payload.name.trim(),
          building: this.roomsSupportService.optionalTrim(payload.building),
          floor: this.roomsSupportService.optionalTrim(payload.floor),
          location: this.roomsSupportService.optionalTrim(payload.location),
          description: this.roomsSupportService.optionalTrim(payload.description),
          roomTypeId: payload.roomTypeId,
          capacity: payload.capacity,
          examCapacity: payload.examCapacity,
          status: payload.status || "ACTIVE",
          isSharedBetweenCurricula: payload.isSharedBetweenCurricula ?? true,
          defaultTrack: payload.isSharedBetweenCurricula === false ? payload.defaultTrack : null,
          establishmentId: payload.establishmentId,
          notes: this.roomsSupportService.optionalTrim(payload.notes),
          archivedAt: payload.status === "ARCHIVED" ? new Date() : null,
          updatedAt: new Date()
        },
        include: { roomType: true, assignments: true }
      });
      await this.roomsSupportService.logAudit(tenantId, actorUserId, "ROOM_CREATED", "rooms", created.id, { code: created.code });
      return this.roomsSupportService.roomView(created);
    } catch (error: unknown) {
      this.roomsSupportService.handleKnownPrismaConflict(error, "Room code already exists.");
      throw error;
    }
  }

  async updateRoom(tenantId: string, actorUserId: string, id: string, payload: UpdateRoomDto): Promise<RoomView> {
    const existing = await this.roomsSupportService.requireRoom(tenantId, id);
    await this.roomsSupportService.assertRoomPayload(tenantId, payload, existing.id, existing);
    try {
      const nextShared = payload.isSharedBetweenCurricula ?? existing.isSharedBetweenCurricula;
      const updated = await this.prisma.room.update({
        where: { id: existing.id },
        data: {
          code: payload.code?.trim().toUpperCase(),
          name: payload.name?.trim(),
          building: payload.building !== undefined ? this.roomsSupportService.optionalTrim(payload.building) : undefined,
          floor: payload.floor !== undefined ? this.roomsSupportService.optionalTrim(payload.floor) : undefined,
          location: payload.location !== undefined ? this.roomsSupportService.optionalTrim(payload.location) : undefined,
          description: payload.description !== undefined ? this.roomsSupportService.optionalTrim(payload.description) : undefined,
          roomTypeId: payload.roomTypeId,
          capacity: payload.capacity,
          examCapacity: payload.examCapacity,
          status: payload.status,
          isSharedBetweenCurricula: payload.isSharedBetweenCurricula,
          defaultTrack: nextShared ? null : payload.defaultTrack ?? existing.defaultTrack,
          establishmentId: payload.establishmentId,
          notes: payload.notes !== undefined ? this.roomsSupportService.optionalTrim(payload.notes) : undefined,
          archivedAt: payload.status === "ARCHIVED" ? existing.archivedAt ?? new Date() : payload.status ? null : undefined,
          updatedAt: new Date()
        },
        include: { roomType: true, assignments: true }
      });
      await this.roomsSupportService.logAudit(tenantId, actorUserId, "ROOM_UPDATED", "rooms", updated.id);
      return this.roomsSupportService.roomView(updated);
    } catch (error: unknown) {
      this.roomsSupportService.handleKnownPrismaConflict(error, "Room code already exists.");
      throw error;
    }
  }

  async archiveRoom(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.roomsSupportService.requireRoom(tenantId, id);
    await this.prisma.room.update({
      where: { id: existing.id },
      data: { status: "ARCHIVED", archivedAt: existing.archivedAt ?? new Date(), updatedAt: new Date() }
    });
    await this.roomsSupportService.logAudit(tenantId, actorUserId, "ROOM_ARCHIVED", "rooms", existing.id, { code: existing.code });
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
}
