import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AcademicTrack } from "@prisma/client";

import { resolveTenantContext } from "../common/tenant-context.util";
import { type AuthenticatedUser } from "../security/authenticated-user.interface";
import { RequirePermission } from "../security/permissions.decorator";
import { Roles } from "../security/roles.decorator";
import { UserRole } from "../security/roles.enum";
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
import { RoomsService } from "./rooms.service";

@ApiTags("rooms")
@ApiBearerAuth("bearer")
@ApiHeader({ name: "x-tenant-id", required: false, description: "Tenant context." })
@Controller("rooms")
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly configService: ConfigService
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "read")
  @ApiOperation({ summary: "List rooms with filters" })
  async listRooms(
    @Req() request: { user?: AuthenticatedUser },
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("roomTypeId") roomTypeId?: string,
    @Query("track") track?: AcademicTrack,
    @Query("minCapacity") minCapacity?: string,
    @Query("schoolYearId") schoolYearId?: string,
    @Query("includeArchived") includeArchived?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.roomsService.listRooms(tenantId, {
      search,
      status,
      roomTypeId,
      track,
      minCapacity: minCapacity ? Number(minCapacity) : undefined,
      schoolYearId,
      includeArchived
    });
  }

  @Get("types")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "read")
  async listRoomTypes(@Req() request: { user?: AuthenticatedUser }, @Headers("x-tenant-id") tenantHeader?: string) {
    return this.roomsService.listRoomTypes(this.getTenantId(request.user, tenantHeader));
  }

  @Post("types")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "create")
  async createRoomType(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateRoomTypeDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.roomsService.createRoomType(tenantId, this.getActorUserId(request.user), body);
  }

  @Patch("types/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "update")
  async updateRoomType(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateRoomTypeDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.roomsService.updateRoomType(tenantId, this.getActorUserId(request.user), id, body);
  }

  @Get("assignments")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "read")
  async listAssignments(
    @Req() request: { user?: AuthenticatedUser },
    @Query("roomId") roomId?: string,
    @Query("schoolYearId") schoolYearId?: string,
    @Query("classId") classId?: string,
    @Query("subjectId") subjectId?: string,
    @Query("track") track?: AcademicTrack,
    @Query("status") status?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.roomsService.listAssignments(tenantId, { roomId, schoolYearId, classId, subjectId, track, status });
  }

  @Post("assignments")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "create")
  async createAssignment(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateRoomAssignmentDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.roomsService.createAssignment(tenantId, this.getActorUserId(request.user), body);
  }

  @Patch("assignments/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "update")
  async updateAssignment(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateRoomAssignmentDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.roomsService.updateAssignment(tenantId, this.getActorUserId(request.user), id, body);
  }

  @Delete("assignments/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "delete")
  async archiveAssignment(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<void> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.roomsService.archiveAssignment(tenantId, this.getActorUserId(request.user), id);
  }

  @Get("availabilities")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "read")
  async listAvailabilities(
    @Req() request: { user?: AuthenticatedUser },
    @Query("roomId") roomId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    return this.roomsService.listAvailabilities(this.getTenantId(request.user, tenantHeader), roomId);
  }

  @Post("availabilities")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "create")
  async createAvailability(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateRoomAvailabilityDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.roomsService.createAvailability(tenantId, this.getActorUserId(request.user), body);
  }

  @Patch("availabilities/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "update")
  async updateAvailability(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateRoomAvailabilityDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.roomsService.updateAvailability(tenantId, this.getActorUserId(request.user), id, body);
  }

  @Delete("availabilities/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "delete")
  async deleteAvailability(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<void> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.roomsService.deleteAvailability(tenantId, this.getActorUserId(request.user), id);
  }

  @Get("occupancy")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "read")
  async listOccupancy(
    @Req() request: { user?: AuthenticatedUser },
    @Query("schoolYearId") schoolYearId?: string,
    @Query("track") track?: AcademicTrack,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    return this.roomsService.listOccupancy(this.getTenantId(request.user, tenantHeader), schoolYearId, track);
  }

  @Get(":id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "read")
  async getRoom(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    return this.roomsService.getRoomDetail(this.getTenantId(request.user, tenantHeader), id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "create")
  async createRoom(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateRoomDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.roomsService.createRoom(tenantId, this.getActorUserId(request.user), body);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "update")
  async updateRoom(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateRoomDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.roomsService.updateRoom(tenantId, this.getActorUserId(request.user), id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("rooms", "delete")
  async archiveRoom(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<void> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.roomsService.archiveRoom(tenantId, this.getActorUserId(request.user), id);
  }

  private getActorUserId(user: AuthenticatedUser | undefined): string {
    if (!user?.sub) throw new BadRequestException("Missing authenticated user context.");
    return user.sub;
  }

  private getTenantId(user: AuthenticatedUser | undefined, tenantHeader?: string): string {
    return resolveTenantContext(this.configService, user, tenantHeader);
  }
}
