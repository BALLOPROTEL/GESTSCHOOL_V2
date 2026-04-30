import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { MosqueeService } from "./mosquee.service";
import {
  CreateMosqueActivityDto,
  CreateMosqueDonationDto,
  CreateMosqueMemberDto,
  UpdateMosqueActivityDto,
  UpdateMosqueDonationDto,
  UpdateMosqueMemberDto
} from "./dto/mosquee.dto";

@ApiTags("mosquee")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Optional tenant UUID override for development."
})
@Controller("mosquee")
export class MosqueeController {
  constructor(
    private readonly mosqueeService: MosqueeService,
    private readonly configService: ConfigService
  ) {}

  @Get("dashboard")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "read")
  @ApiOperation({ summary: "mosquee dashboard" })
  async dashboard(
    @Req() request: { user?: AuthenticatedUser },
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueeService.dashboard(tenantId);
  }

  @Get("members")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "read")
  @ApiOperation({ summary: "List mosquee members" })
  async listMembers(
    @Req() request: { user?: AuthenticatedUser },
    @Query("status") status?: string,
    @Query("q") q?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueeService.listMembers(tenantId, { status, q });
  }

  @Get("members/export")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "read")
  @ApiOperation({ summary: "Export mosquee members (PDF/Excel)" })
  async exportMembers(
    @Req() request: { user?: AuthenticatedUser },
    @Query("status") status?: string,
    @Query("q") q?: string,
    @Query("format") format?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueeService.exportMembers(tenantId, { status, q }, this.parseExportFormat(format));
  }

  @Post("members")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "create")
  @ApiOperation({ summary: "Create mosquee member" })
  async createMember(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateMosqueMemberDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueeService.createMember(tenantId, body);
  }

  @Patch("members/:id")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "update")
  @ApiOperation({ summary: "Update mosquee member" })
  async updateMember(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateMosqueMemberDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueeService.updateMember(tenantId, id, body);
  }

  @Delete("members/:id")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "delete")
  @ApiOperation({ summary: "Delete mosquee member" })
  async deleteMember(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.mosqueeService.deleteMember(tenantId, id);
  }

  @Get("activities")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "read")
  @ApiOperation({ summary: "List mosquee activities" })
  async listActivities(
    @Req() request: { user?: AuthenticatedUser },
    @Query("category") category?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("q") q?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueeService.listActivities(tenantId, { category, from, to, q });
  }

  @Get("activities/export")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "read")
  @ApiOperation({ summary: "Export mosquee activities (PDF/Excel)" })
  async exportActivities(
    @Req() request: { user?: AuthenticatedUser },
    @Query("category") category?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("q") q?: string,
    @Query("format") format?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueeService.exportActivities(
      tenantId,
      { category, from, to, q },
      this.parseExportFormat(format)
    );
  }

  @Post("activities")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "create")
  @ApiOperation({ summary: "Create mosquee activity" })
  async createActivity(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateMosqueActivityDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueeService.createActivity(tenantId, body);
  }

  @Patch("activities/:id")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "update")
  @ApiOperation({ summary: "Update mosquee activity" })
  async updateActivity(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateMosqueActivityDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueeService.updateActivity(tenantId, id, body);
  }

  @Delete("activities/:id")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "delete")
  @ApiOperation({ summary: "Delete mosquee activity" })
  async deleteActivity(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.mosqueeService.deleteActivity(tenantId, id);
  }

  @Get("donations")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "read")
  @ApiOperation({ summary: "List mosquee donations" })
  async listDonations(
    @Req() request: { user?: AuthenticatedUser },
    @Query("memberId") memberId?: string,
    @Query("channel") channel?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueeService.listDonations(tenantId, {
      memberId,
      channel,
      from,
      to
    });
  }

  @Get("donations/export")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "read")
  @ApiOperation({ summary: "Export mosquee donations (PDF/Excel)" })
  async exportDonations(
    @Req() request: { user?: AuthenticatedUser },
    @Query("memberId") memberId?: string,
    @Query("channel") channel?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("format") format?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueeService.exportDonations(
      tenantId,
      { memberId, channel, from, to },
      this.parseExportFormat(format)
    );
  }

  @Post("donations")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "create")
  @ApiOperation({ summary: "Create mosquee donation" })
  async createDonation(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateMosqueDonationDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueeService.createDonation(tenantId, body);
  }

  @Get("donations/:id/receipt")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "read")
  @ApiOperation({ summary: "Generate donation receipt PDF" })
  async donationReceipt(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueeService.getDonationReceipt(tenantId, id);
  }

  @Patch("donations/:id")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "update")
  @ApiOperation({ summary: "Update mosquee donation" })
  async updateDonation(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateMosqueDonationDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.mosqueeService.updateDonation(tenantId, id, body);
  }

  @Delete("donations/:id")
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @RequirePermission("mosquee", "delete")
  @ApiOperation({ summary: "Delete mosquee donation" })
  async deleteDonation(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.mosqueeService.deleteDonation(tenantId, id);
  }

  private getTenantId(
    user: AuthenticatedUser | undefined,
    tenantHeader?: string
  ): string {
    return resolveTenantContext(this.configService, user, tenantHeader);
  }

  private parseExportFormat(value?: string): "PDF" | "EXCEL" {
    if (!value) return "PDF";
    const normalized = value.trim().toUpperCase();
    if (normalized === "PDF" || normalized === "EXCEL") {
      return normalized;
    }
    throw new BadRequestException("format must be one of: PDF, EXCEL.");
  }
}
