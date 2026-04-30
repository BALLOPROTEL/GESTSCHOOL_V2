import {
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

import { resolveTenantContext } from "../common/tenant-context.util";
import { type AuthenticatedUser } from "../security/authenticated-user.interface";
import { RequirePermission } from "../security/permissions.decorator";
import { Roles } from "../security/roles.decorator";
import { UserRole } from "../security/roles.enum";
import {
  CreateParentDto,
  CreateParentStudentLinkDto,
  UpdateParentDto,
  UpdateParentStudentLinkDto
} from "./dto/parents.dto";
import { ParentsService } from "./parents.service";

@ApiTags("parents")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Tenant context. Cannot override authenticated tenant."
})
@Controller("parents")
export class ParentsController {
  constructor(
    private readonly parentsService: ParentsService,
    private readonly configService: ConfigService
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("parents", "read")
  @ApiOperation({ summary: "List business parent profiles" })
  async listParents(
    @Req() request: { user?: AuthenticatedUser },
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("parentalRole") parentalRole?: string,
    @Query("studentId") studentId?: string,
    @Query("includeArchived") includeArchived?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.parentsService.listParents(tenantId, {
      search,
      status,
      parentalRole,
      studentId,
      includeArchived
    });
  }

  @Get("links")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("parents", "read")
  @ApiOperation({ summary: "List parent/student business relations" })
  async listLinks(
    @Req() request: { user?: AuthenticatedUser },
    @Query("parentId") parentId?: string,
    @Query("studentId") studentId?: string,
    @Query("relationType") relationType?: string,
    @Query("isPrimaryContact") isPrimaryContact?: string,
    @Query("legalGuardian") legalGuardian?: string,
    @Query("financialResponsible") financialResponsible?: string,
    @Query("emergencyContact") emergencyContact?: string,
    @Query("status") status?: string,
    @Query("includeArchived") includeArchived?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.parentsService.listLinks(tenantId, {
      parentId,
      studentId,
      relationType,
      isPrimaryContact,
      legalGuardian,
      financialResponsible,
      emergencyContact,
      status,
      includeArchived
    });
  }

  @Post("links")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("parents", "create")
  @ApiOperation({ summary: "Create parent/student business relation" })
  async createLink(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateParentStudentLinkDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.parentsService.createLink(
      tenantId,
      this.getActorUserId(request.user),
      body
    );
  }

  @Patch("links/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("parents", "update")
  @ApiOperation({ summary: "Update parent/student business relation" })
  async updateLink(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateParentStudentLinkDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.parentsService.updateLink(
      tenantId,
      this.getActorUserId(request.user),
      id,
      body
    );
  }

  @Delete("links/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("parents", "delete")
  @ApiOperation({ summary: "Archive parent/student business relation" })
  async archiveLink(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<void> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.parentsService.archiveLink(tenantId, this.getActorUserId(request.user), id);
  }

  @Get("students/:studentId/parents")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("parents", "read")
  @ApiOperation({ summary: "List parents linked to one student" })
  async listStudentParents(
    @Req() request: { user?: AuthenticatedUser },
    @Param("studentId", new ParseUUIDPipe()) studentId: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.parentsService.listStudentParents(tenantId, studentId);
  }

  @Get(":id/students")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("parents", "read")
  @ApiOperation({ summary: "List students linked to one parent" })
  async listParentChildren(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.parentsService.listParentChildren(tenantId, id);
  }

  @Get(":id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("parents", "read")
  @ApiOperation({ summary: "Get one business parent profile" })
  async getParent(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.parentsService.getParent(tenantId, id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("parents", "create")
  @ApiOperation({ summary: "Create business parent profile" })
  async createParent(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateParentDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.parentsService.createParent(
      tenantId,
      this.getActorUserId(request.user),
      body
    );
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("parents", "update")
  @ApiOperation({ summary: "Update business parent profile" })
  async updateParent(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateParentDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.parentsService.updateParent(
      tenantId,
      this.getActorUserId(request.user),
      id,
      body
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("parents", "delete")
  @ApiOperation({ summary: "Archive business parent profile" })
  async archiveParent(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<void> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.parentsService.archiveParent(tenantId, this.getActorUserId(request.user), id);
  }

  private getTenantId(
    user: AuthenticatedUser | undefined,
    tenantHeader?: string
  ): string {
    return resolveTenantContext(this.configService, user, tenantHeader);
  }

  private getActorUserId(user: AuthenticatedUser | undefined): string {
    return user?.sub || "system";
  }
}
