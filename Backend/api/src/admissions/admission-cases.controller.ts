import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { resolveTenantContext } from "../common/tenant-context.util";
import { type AuthenticatedUser } from "../security/authenticated-user.interface";
import { RequirePermissions } from "../security/permissions.decorator";
import { Roles } from "../security/roles.decorator";
import { UserRole } from "../security/roles.enum";
import { AdmissionCasesService } from "./admission-cases.service";
import { AdmissionFinalizationService } from "./admission-finalization.service";
import {
  AdmissionCaseSection,
  type AdmissionCaseMutableSection,
  type AdmissionCasePage,
  type AdmissionCaseView,
} from "./admission-cases.types";
import {
  AdmissionCaseListQueryDto,
  CancelAdmissionCaseDto,
  CreateAdmissionCaseDto,
  FinalizeAdmissionCaseDto,
  UpdateAdmissionCaseSectionDto,
} from "./dto/admission-cases.dto";

@ApiTags("Admissions")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Tenant context. Cannot override authenticated tenant.",
})
@Controller("admission-cases")
export class AdmissionCasesController {
  constructor(
    private readonly service: AdmissionCasesService,
    private readonly finalizationService: AdmissionFinalizationService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermissions(
    { resource: "enrollments", action: "create" },
    { resource: "reference", action: "read" },
  )
  @ApiOperation({ summary: "Create an admission draft" })
  create(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateAdmissionCaseDto,
    @Headers("x-tenant-id") tenantHeader?: string,
  ): Promise<AdmissionCaseView> {
    const user = request.user!;
    const tenantId = resolveTenantContext(
      this.configService,
      user,
      tenantHeader,
    );
    return this.service.create(
      tenantId,
      { id: user.sub, role: user.role },
      body,
    );
  }

  @Post(":id/finalize")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermissions(
    { resource: "enrollments", action: "create" },
    { resource: "reference", action: "read" },
  )
  @ApiOperation({ summary: "Finalize an admission case transactionally" })
  finalize(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: FinalizeAdmissionCaseDto,
    @Headers("x-tenant-id") tenantHeader?: string,
  ) {
    const user = request.user!;
    const tenantId = resolveTenantContext(
      this.configService,
      user,
      tenantHeader,
    );
    return this.finalizationService.finalize(
      tenantId,
      { id: user.sub, role: user.role },
      id,
      body,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermissions(
    { resource: "enrollments", action: "read" },
    { resource: "reference", action: "read" },
  )
  @ApiOperation({ summary: "List resumable admission drafts" })
  list(
    @Req() request: { user?: AuthenticatedUser },
    @Query() query: AdmissionCaseListQueryDto,
    @Headers("x-tenant-id") tenantHeader?: string,
  ): Promise<AdmissionCasePage> {
    const user = request.user!;
    const tenantId = resolveTenantContext(
      this.configService,
      user,
      tenantHeader,
    );
    return this.service.list(tenantId, user.role, query);
  }

  @Get(":id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermissions(
    { resource: "enrollments", action: "read" },
    { resource: "reference", action: "read" },
  )
  @ApiOperation({ summary: "Read an admission draft" })
  get(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string,
  ): Promise<AdmissionCaseView> {
    const user = request.user!;
    const tenantId = resolveTenantContext(
      this.configService,
      user,
      tenantHeader,
    );
    return this.service.get(tenantId, user.role, id);
  }

  @Patch(":id/sections/:section")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermissions(
    { resource: "enrollments", action: "create" },
    { resource: "reference", action: "read" },
  )
  @ApiParam({ name: "section", enum: AdmissionCaseSection })
  @ApiOperation({ summary: "Save one typed admission draft section" })
  saveSection(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("section", new ParseEnumPipe(AdmissionCaseSection))
    section: AdmissionCaseMutableSection,
    @Body() body: UpdateAdmissionCaseSectionDto,
    @Headers("x-tenant-id") tenantHeader?: string,
  ): Promise<AdmissionCaseView> {
    const user = request.user!;
    const tenantId = resolveTenantContext(
      this.configService,
      user,
      tenantHeader,
    );
    return this.service.saveSection(
      tenantId,
      { id: user.sub, role: user.role },
      id,
      section,
      body,
    );
  }

  @Post(":id/cancel")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermissions(
    { resource: "enrollments", action: "create" },
    { resource: "reference", action: "read" },
  )
  @ApiOperation({ summary: "Cancel an admission draft without deleting it" })
  cancel(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: CancelAdmissionCaseDto,
    @Headers("x-tenant-id") tenantHeader?: string,
  ): Promise<AdmissionCaseView> {
    const user = request.user!;
    const tenantId = resolveTenantContext(
      this.configService,
      user,
      tenantHeader,
    );
    return this.service.cancel(
      tenantId,
      { id: user.sub, role: user.role },
      id,
      body,
    );
  }
}
