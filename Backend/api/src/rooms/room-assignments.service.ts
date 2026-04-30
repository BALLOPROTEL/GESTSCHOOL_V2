import { Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import {
  CreateRoomAssignmentDto,
  ROOM_ASSIGNMENT_STATUS_VALUES,
  ROOM_ASSIGNMENT_TYPE_VALUES,
  UpdateRoomAssignmentDto
} from "./dto/rooms.dto";
import { RoomsSupportService } from "./rooms-support.service";
import {
  type AssignmentFilters,
  type RoomAssignmentView
} from "./rooms.types";

@Injectable()
export class RoomAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsSupportService: RoomsSupportService
  ) {}

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
      include: this.roomsSupportService.assignmentInclude(),
      orderBy: [{ schoolYear: { code: "desc" } }, { createdAt: "desc" }]
    });
    return rows.map((row) => this.roomsSupportService.assignmentView(row));
  }

  async createAssignment(tenantId: string, actorUserId: string, payload: CreateRoomAssignmentDto): Promise<RoomAssignmentView> {
    await this.roomsSupportService.assertAssignmentPayload(tenantId, payload);
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
          startDate: payload.startDate ? this.roomsSupportService.toDateOnly(payload.startDate) : null,
          endDate: payload.endDate ? this.roomsSupportService.toDateOnly(payload.endDate) : null,
          status: payload.status || "ACTIVE",
          comment: this.roomsSupportService.optionalTrim(payload.comment),
          updatedAt: new Date()
        },
        include: this.roomsSupportService.assignmentInclude()
      });
      await this.roomsSupportService.logAudit(tenantId, actorUserId, "ROOM_ASSIGNMENT_CREATED", "room_assignments", created.id, {
        roomId: created.roomId,
        track: created.track
      });
      return this.roomsSupportService.assignmentView(created);
    } catch (error: unknown) {
      this.roomsSupportService.handleKnownPrismaConflict(error, "Room assignment already exists for this exact scope.");
      throw error;
    }
  }

  async updateAssignment(
    tenantId: string,
    actorUserId: string,
    id: string,
    payload: UpdateRoomAssignmentDto
  ): Promise<RoomAssignmentView> {
    const existing = await this.roomsSupportService.requireAssignment(tenantId, id);
    await this.roomsSupportService.assertAssignmentPayload(
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
        startDate: payload.startDate ?? this.roomsSupportService.formatDate(existing.startDate),
        endDate: payload.endDate ?? this.roomsSupportService.formatDate(existing.endDate),
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
        startDate: payload.startDate ? this.roomsSupportService.toDateOnly(payload.startDate) : undefined,
        endDate: payload.endDate ? this.roomsSupportService.toDateOnly(payload.endDate) : undefined,
        status: payload.status,
        comment: payload.comment !== undefined ? this.roomsSupportService.optionalTrim(payload.comment) : undefined,
        updatedAt: new Date()
      },
      include: this.roomsSupportService.assignmentInclude()
    });
    await this.roomsSupportService.logAudit(tenantId, actorUserId, "ROOM_ASSIGNMENT_UPDATED", "room_assignments", updated.id);
    return this.roomsSupportService.assignmentView(updated);
  }

  async archiveAssignment(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.roomsSupportService.requireAssignment(tenantId, id);
    await this.prisma.roomAssignment.update({
      where: { id: existing.id },
      data: { status: "ARCHIVED", updatedAt: new Date() }
    });
    await this.roomsSupportService.logAudit(tenantId, actorUserId, "ROOM_ASSIGNMENT_ARCHIVED", "room_assignments", existing.id);
  }
}
