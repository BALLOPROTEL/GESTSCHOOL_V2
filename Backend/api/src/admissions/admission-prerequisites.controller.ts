import { Controller, Get, Headers, Req } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { resolveTenantContext } from "../common/tenant-context.util";
import { type AuthenticatedUser } from "../security/authenticated-user.interface";
import { RequirePermissions } from "../security/permissions.decorator";
import { Roles } from "../security/roles.decorator";
import { UserRole } from "../security/roles.enum";
import { AdmissionPrerequisitesService } from "./admission-prerequisites.service";
import { type AdmissionPrerequisitesResponse } from "./admission-prerequisites.types";

@ApiTags("Admissions")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Tenant context. Cannot override authenticated tenant.",
})
@Controller("admission-prerequisites")
export class AdmissionPrerequisitesController {
  constructor(
    private readonly service: AdmissionPrerequisitesService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermissions(
    { resource: "enrollments", action: "read" },
    { resource: "reference", action: "read" },
  )
  @ApiOperation({
    summary: "Read prerequisites for the future admission assistant",
  })
  async getPrerequisites(
    @Req() request: { user?: AuthenticatedUser },
    @Headers("x-tenant-id") tenantHeader?: string,
  ): Promise<AdmissionPrerequisitesResponse> {
    const user = request.user;
    const tenantId = resolveTenantContext(
      this.configService,
      user,
      tenantHeader,
    );
    return this.service.getPrerequisites(tenantId, user!.role);
  }
}
