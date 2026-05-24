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
  Put,
  Req,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";

import { resolveTenantContext } from "../common/tenant-context.util";
import { type AuthenticatedUser } from "../security/authenticated-user.interface";
import { RequirePermission } from "../security/permissions.decorator";
import { RateLimit } from "../security/rate-limit.decorator";
import { Roles } from "../security/roles.decorator";
import { UserRole } from "../security/roles.enum";
import { CreateUserDto } from "./dto/create-user.dto";
import { ChangeMyPasswordDto, UpdateMyProfileDto } from "./dto/me-profile.dto";
import { UpdateRolePermissionsDto } from "./dto/update-role-permissions.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import {
  UsersService,
  type MyProfileView,
  type RolePermissionView,
  type UserActivityView,
  type UserView
} from "./users.service";

type UploadedAvatarFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@ApiTags("users")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Tenant context. Cannot override authenticated tenant."
})
@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService
  ) {}

  @Get("roles/:role/permissions")
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "read")
  @ApiOperation({ summary: "List effective permissions for one role" })
  async listRolePermissions(
    @Req() request: { user?: AuthenticatedUser },
    @Param("role") role: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<RolePermissionView[]> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.usersService.listRolePermissions(tenantId, this.parseRole(role));
  }

  @Put("roles/:role/permissions")
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "update")
  @ApiOperation({ summary: "Upsert custom role permissions for current tenant" })
  async updateRolePermissions(
    @Req() request: { user?: AuthenticatedUser },
    @Param("role") role: string,
    @Body() body: UpdateRolePermissionsDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<RolePermissionView[]> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    return this.usersService.updateRolePermissions(
      tenantId,
      actorUserId,
      this.parseRole(role),
      body
    );
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "read")
  @ApiOperation({ summary: "List users for current tenant" })
  async list(
    @Req() request: { user?: AuthenticatedUser },
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<UserView[]> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.usersService.list(tenantId);
  }

  @Get("me")
  @RateLimit({ bucket: "users-me", max: 60, windowMs: 60_000 })
  @ApiOperation({ summary: "Get the authenticated user profile" })
  async me(
    @Req() request: { user?: AuthenticatedUser },
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<MyProfileView> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    return this.usersService.getMyProfile(tenantId, actorUserId);
  }

  @Patch("me/profile")
  @RateLimit({ bucket: "users-me-profile", max: 20, windowMs: 60_000 })
  @ApiOperation({ summary: "Update the authenticated user's personal profile" })
  async updateMyProfile(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: UpdateMyProfileDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<MyProfileView> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    return this.usersService.updateMyProfile(tenantId, actorUserId, body);
  }

  @Post("me/change-password")
  @RateLimit({ bucket: "users-me-change-password", max: 5, windowMs: 600_000 })
  @ApiOperation({ summary: "Change the authenticated user's password" })
  async changeMyPassword(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: ChangeMyPasswordDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<{ message: string }> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    return this.usersService.changeMyPassword(tenantId, actorUserId, body);
  }

  @Post("me/avatar")
  @RateLimit({ bucket: "users-me-avatar", max: 10, windowMs: 600_000 })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }))
  @ApiOperation({ summary: "Upload the authenticated user's avatar" })
  async uploadMyAvatar(
    @Req() request: { user?: AuthenticatedUser },
    @UploadedFile() file: UploadedAvatarFile | undefined,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<MyProfileView> {
    if (!file) {
      throw new BadRequestException("Fichier image requis.");
    }
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    return this.usersService.uploadMyAvatar(tenantId, actorUserId, file);
  }

  @Delete("me/avatar")
  @RateLimit({ bucket: "users-me-avatar-delete", max: 10, windowMs: 600_000 })
  @ApiOperation({ summary: "Remove the authenticated user's avatar" })
  async removeMyAvatar(
    @Req() request: { user?: AuthenticatedUser },
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<MyProfileView> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    return this.usersService.removeMyAvatar(tenantId, actorUserId);
  }

  @Get("me/activity")
  @RateLimit({ bucket: "users-me-activity", max: 60, windowMs: 60_000 })
  @ApiOperation({ summary: "List recent activity for the authenticated user" })
  async myActivity(
    @Req() request: { user?: AuthenticatedUser },
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<UserActivityView[]> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    return this.usersService.listMyActivity(tenantId, actorUserId);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "create")
  @ApiOperation({ summary: "Create a user in current tenant" })
  async create(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateUserDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<UserView> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    return this.usersService.create(tenantId, actorUserId, body);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "update")
  @ApiOperation({ summary: "Update one user" })
  async update(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateUserDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<UserView> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    return this.usersService.update(tenantId, actorUserId, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "delete")
  @ApiOperation({ summary: "Soft delete one user and revoke tokens" })
  async remove(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<void> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    await this.usersService.remove(tenantId, actorUserId, id);
  }

  @Post(":id/send-activation")
  @Roles(UserRole.ADMIN)
  @RequirePermission("users", "update")
  @ApiOperation({ summary: "Resend activation email for a pending user" })
  async sendActivation(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<{ message: string; sent: boolean }> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    const actorUserId = this.getActorUserId(request.user);
    return this.usersService.sendActivation(tenantId, actorUserId, id);
  }

  private parseRole(role: string): UserRole {
    const normalized = role.trim().toUpperCase() as UserRole;
    if (!Object.values(UserRole).includes(normalized)) {
      throw new BadRequestException("Invalid role.");
    }
    return normalized;
  }

  private getActorUserId(user: AuthenticatedUser | undefined): string {
    if (!user?.sub) {
      throw new BadRequestException("Missing authenticated user context.");
    }
    return user.sub;
  }

  private getTenantId(
    user: AuthenticatedUser | undefined,
    tenantHeader?: string
  ): string {
    return resolveTenantContext(this.configService, user, tenantHeader);
  }
}
