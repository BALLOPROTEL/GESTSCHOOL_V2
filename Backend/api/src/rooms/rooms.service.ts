import { Injectable } from "@nestjs/common";
import { AcademicTrack } from "@prisma/client";

import {
  CreateRoomAssignmentDto,
  CreateRoomAvailabilityDto,
  CreateRoomDto,
  CreateRoomTypeDto,
  UpdateRoomAssignmentDto,
  UpdateRoomAvailabilityDto,
  UpdateRoomDto,
  UpdateRoomTypeDto
} from "./dto/rooms.dto";
import { RoomAssignmentsService } from "./room-assignments.service";
import { RoomAvailabilitiesService } from "./room-availabilities.service";
import { RoomTypesService } from "./room-types.service";
import { RoomsCatalogService } from "./rooms-catalog.service";
import { type AssignmentFilters, type RoomFilters } from "./rooms.types";

@Injectable()
export class RoomsService {
  constructor(
    private readonly roomTypesService: RoomTypesService,
    private readonly roomsCatalogService: RoomsCatalogService,
    private readonly roomAssignmentsService: RoomAssignmentsService,
    private readonly roomAvailabilitiesService: RoomAvailabilitiesService
  ) {}

  listRoomTypes(tenantId: string) {
    return this.roomTypesService.listRoomTypes(tenantId);
  }

  createRoomType(tenantId: string, actorUserId: string, payload: CreateRoomTypeDto) {
    return this.roomTypesService.createRoomType(tenantId, actorUserId, payload);
  }

  updateRoomType(tenantId: string, actorUserId: string, id: string, payload: UpdateRoomTypeDto) {
    return this.roomTypesService.updateRoomType(tenantId, actorUserId, id, payload);
  }

  listRooms(tenantId: string, filters: RoomFilters = {}) {
    return this.roomsCatalogService.listRooms(tenantId, filters);
  }

  getRoomDetail(tenantId: string, id: string) {
    return this.roomsCatalogService.getRoomDetail(tenantId, id);
  }

  createRoom(tenantId: string, actorUserId: string, payload: CreateRoomDto) {
    return this.roomsCatalogService.createRoom(tenantId, actorUserId, payload);
  }

  updateRoom(tenantId: string, actorUserId: string, id: string, payload: UpdateRoomDto) {
    return this.roomsCatalogService.updateRoom(tenantId, actorUserId, id, payload);
  }

  archiveRoom(tenantId: string, actorUserId: string, id: string) {
    return this.roomsCatalogService.archiveRoom(tenantId, actorUserId, id);
  }

  listAssignments(tenantId: string, filters: AssignmentFilters = {}) {
    return this.roomAssignmentsService.listAssignments(tenantId, filters);
  }

  createAssignment(tenantId: string, actorUserId: string, payload: CreateRoomAssignmentDto) {
    return this.roomAssignmentsService.createAssignment(tenantId, actorUserId, payload);
  }

  updateAssignment(tenantId: string, actorUserId: string, id: string, payload: UpdateRoomAssignmentDto) {
    return this.roomAssignmentsService.updateAssignment(tenantId, actorUserId, id, payload);
  }

  archiveAssignment(tenantId: string, actorUserId: string, id: string) {
    return this.roomAssignmentsService.archiveAssignment(tenantId, actorUserId, id);
  }

  listAvailabilities(tenantId: string, roomId?: string) {
    return this.roomAvailabilitiesService.listAvailabilities(tenantId, roomId);
  }

  createAvailability(tenantId: string, actorUserId: string, payload: CreateRoomAvailabilityDto) {
    return this.roomAvailabilitiesService.createAvailability(tenantId, actorUserId, payload);
  }

  updateAvailability(tenantId: string, actorUserId: string, id: string, payload: UpdateRoomAvailabilityDto) {
    return this.roomAvailabilitiesService.updateAvailability(tenantId, actorUserId, id, payload);
  }

  deleteAvailability(tenantId: string, actorUserId: string, id: string) {
    return this.roomAvailabilitiesService.deleteAvailability(tenantId, actorUserId, id);
  }

  listOccupancy(tenantId: string, schoolYearId?: string, track?: AcademicTrack) {
    return this.roomsCatalogService.listOccupancy(tenantId, schoolYearId, track);
  }
}
