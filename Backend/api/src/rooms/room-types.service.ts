import { Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import {
  CreateRoomTypeDto,
  UpdateRoomTypeDto
} from "./dto/rooms.dto";
import { RoomsSupportService } from "./rooms-support.service";
import { type RoomTypeView } from "./rooms.types";

@Injectable()
export class RoomTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsSupportService: RoomsSupportService
  ) {}

  async listRoomTypes(tenantId: string): Promise<RoomTypeView[]> {
    const rows = await this.prisma.roomType.findMany({
      where: { tenantId },
      orderBy: [{ status: "asc" }, { name: "asc" }]
    });
    return rows.map((row) => this.roomsSupportService.roomTypeView(row));
  }

  async createRoomType(tenantId: string, actorUserId: string, payload: CreateRoomTypeDto): Promise<RoomTypeView> {
    try {
      const created = await this.prisma.roomType.create({
        data: {
          tenantId,
          code: payload.code.trim().toUpperCase(),
          name: payload.name.trim(),
          description: this.roomsSupportService.optionalTrim(payload.description),
          status: payload.status || "ACTIVE",
          updatedAt: new Date()
        }
      });
      await this.roomsSupportService.logAudit(tenantId, actorUserId, "ROOM_TYPE_CREATED", "room_types", created.id, { code: created.code });
      return this.roomsSupportService.roomTypeView(created);
    } catch (error: unknown) {
      this.roomsSupportService.handleKnownPrismaConflict(error, "Room type code already exists.");
      throw error;
    }
  }

  async updateRoomType(tenantId: string, actorUserId: string, id: string, payload: UpdateRoomTypeDto): Promise<RoomTypeView> {
    const existing = await this.roomsSupportService.requireRoomType(tenantId, id);
    try {
      const updated = await this.prisma.roomType.update({
        where: { id: existing.id },
        data: {
          code: payload.code?.trim().toUpperCase(),
          name: payload.name?.trim(),
          description: payload.description !== undefined ? this.roomsSupportService.optionalTrim(payload.description) : undefined,
          status: payload.status,
          updatedAt: new Date()
        }
      });
      await this.roomsSupportService.logAudit(tenantId, actorUserId, "ROOM_TYPE_UPDATED", "room_types", updated.id);
      return this.roomsSupportService.roomTypeView(updated);
    } catch (error: unknown) {
      this.roomsSupportService.handleKnownPrismaConflict(error, "Room type code already exists.");
      throw error;
    }
  }
}
