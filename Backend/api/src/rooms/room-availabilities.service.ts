import { Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import {
  CreateRoomAvailabilityDto,
  ROOM_AVAILABILITY_TYPE_VALUES,
  UpdateRoomAvailabilityDto
} from "./dto/rooms.dto";
import { RoomsSupportService } from "./rooms-support.service";
import { type RoomAvailabilityView } from "./rooms.types";

@Injectable()
export class RoomAvailabilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsSupportService: RoomsSupportService
  ) {}

  async listAvailabilities(tenantId: string, roomId?: string): Promise<RoomAvailabilityView[]> {
    const rows = await this.prisma.roomAvailability.findMany({
      where: { tenantId, roomId },
      include: this.roomsSupportService.availabilityInclude(),
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
    });
    return rows.map((row) => this.roomsSupportService.availabilityView(row));
  }

  async createAvailability(
    tenantId: string,
    actorUserId: string,
    payload: CreateRoomAvailabilityDto
  ): Promise<RoomAvailabilityView> {
    await this.roomsSupportService.assertAvailabilityPayload(tenantId, payload);
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
        comment: this.roomsSupportService.optionalTrim(payload.comment),
        updatedAt: new Date()
      },
      include: this.roomsSupportService.availabilityInclude()
    });
    await this.roomsSupportService.logAudit(tenantId, actorUserId, "ROOM_AVAILABILITY_CREATED", "room_availabilities", created.id);
    return this.roomsSupportService.availabilityView(created);
  }

  async updateAvailability(
    tenantId: string,
    actorUserId: string,
    id: string,
    payload: UpdateRoomAvailabilityDto
  ): Promise<RoomAvailabilityView> {
    const existing = await this.roomsSupportService.requireAvailability(tenantId, id);
    await this.roomsSupportService.assertAvailabilityPayload(tenantId, {
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
        comment: payload.comment !== undefined ? this.roomsSupportService.optionalTrim(payload.comment) : undefined,
        updatedAt: new Date()
      },
      include: this.roomsSupportService.availabilityInclude()
    });
    await this.roomsSupportService.logAudit(tenantId, actorUserId, "ROOM_AVAILABILITY_UPDATED", "room_availabilities", updated.id);
    return this.roomsSupportService.availabilityView(updated);
  }

  async deleteAvailability(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.roomsSupportService.requireAvailability(tenantId, id);
    await this.prisma.roomAvailability.delete({ where: { id: existing.id } });
    await this.roomsSupportService.logAudit(tenantId, actorUserId, "ROOM_AVAILABILITY_DELETED", "room_availabilities", existing.id);
  }
}
