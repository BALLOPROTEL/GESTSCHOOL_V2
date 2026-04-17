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
  CreateTeacherAssignmentDto,
  CreateTeacherDocumentDto,
  CreateTeacherDto,
  CreateTeacherSkillDto,
  UpdateTeacherAssignmentDto,
  UpdateTeacherDocumentDto,
  UpdateTeacherDto,
  UpdateTeacherSkillDto
} from "./dto/teachers.dto";
import { TeachersService } from "./teachers.service";

@ApiTags("teachers")
@ApiBearerAuth("bearer")
@ApiHeader({
  name: "x-tenant-id",
  required: false,
  description: "Tenant context. Cannot override authenticated tenant."
})
@Controller("teachers")
export class TeachersController {
  constructor(
    private readonly teachersService: TeachersService,
    private readonly configService: ConfigService
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "read")
  @ApiOperation({ summary: "List teachers with filters and workload summary" })
  async listTeachers(
    @Req() request: { user?: AuthenticatedUser },
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("teacherType") teacherType?: string,
    @Query("subjectId") subjectId?: string,
    @Query("classId") classId?: string,
    @Query("schoolYearId") schoolYearId?: string,
    @Query("track") track?: AcademicTrack,
    @Query("includeArchived") includeArchived?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.teachersService.listTeachers(tenantId, {
      search,
      status,
      teacherType,
      subjectId,
      classId,
      schoolYearId,
      track,
      includeArchived
    });
  }

  @Get("workloads")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "read")
  @ApiOperation({ summary: "List teacher workload summaries" })
  async listWorkloads(
    @Req() request: { user?: AuthenticatedUser },
    @Query("schoolYearId") schoolYearId?: string,
    @Query("track") track?: AcademicTrack,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.teachersService.listWorkloads(tenantId, schoolYearId, track);
  }

  @Get("skills")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "read")
  @ApiOperation({ summary: "List teacher skills" })
  async listSkills(
    @Req() request: { user?: AuthenticatedUser },
    @Query("teacherId") teacherId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.teachersService.listSkills(tenantId, teacherId);
  }

  @Post("skills")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "create")
  @ApiOperation({ summary: "Create teacher skill" })
  async createSkill(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateTeacherSkillDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.teachersService.createSkill(tenantId, this.getActorUserId(request.user), body);
  }

  @Patch("skills/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "update")
  @ApiOperation({ summary: "Update teacher skill" })
  async updateSkill(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateTeacherSkillDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.teachersService.updateSkill(tenantId, this.getActorUserId(request.user), id, body);
  }

  @Delete("skills/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "delete")
  @ApiOperation({ summary: "Delete teacher skill" })
  async deleteSkill(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<void> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.teachersService.deleteSkill(tenantId, this.getActorUserId(request.user), id);
  }

  @Get("assignments")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "read")
  @ApiOperation({ summary: "List teacher assignments" })
  async listAssignments(
    @Req() request: { user?: AuthenticatedUser },
    @Query("teacherId") teacherId?: string,
    @Query("schoolYearId") schoolYearId?: string,
    @Query("classId") classId?: string,
    @Query("subjectId") subjectId?: string,
    @Query("track") track?: AcademicTrack,
    @Query("status") status?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.teachersService.listAssignments(tenantId, {
      teacherId,
      schoolYearId,
      classId,
      subjectId,
      track,
      status
    });
  }

  @Post("assignments")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "create")
  @ApiOperation({ summary: "Create teacher assignment" })
  async createAssignment(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateTeacherAssignmentDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.teachersService.createAssignment(tenantId, this.getActorUserId(request.user), body);
  }

  @Patch("assignments/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "update")
  @ApiOperation({ summary: "Update teacher assignment" })
  async updateAssignment(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateTeacherAssignmentDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.teachersService.updateAssignment(tenantId, this.getActorUserId(request.user), id, body);
  }

  @Delete("assignments/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "delete")
  @ApiOperation({ summary: "Archive teacher assignment" })
  async archiveAssignment(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<void> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.teachersService.archiveAssignment(tenantId, this.getActorUserId(request.user), id);
  }

  @Get("documents")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "read")
  @ApiOperation({ summary: "List teacher documents" })
  async listDocuments(
    @Req() request: { user?: AuthenticatedUser },
    @Query("teacherId") teacherId?: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.teachersService.listDocuments(tenantId, teacherId);
  }

  @Post("documents")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "create")
  @ApiOperation({ summary: "Create teacher document metadata" })
  async createDocument(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateTeacherDocumentDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.teachersService.createDocument(tenantId, this.getActorUserId(request.user), body);
  }

  @Patch("documents/:id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "update")
  @ApiOperation({ summary: "Update teacher document metadata" })
  async updateDocument(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateTeacherDocumentDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.teachersService.updateDocument(tenantId, this.getActorUserId(request.user), id, body);
  }

  @Delete("documents/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "delete")
  @ApiOperation({ summary: "Archive teacher document" })
  async archiveDocument(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<void> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.teachersService.archiveDocument(tenantId, this.getActorUserId(request.user), id);
  }

  @Get(":id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "read")
  @ApiOperation({ summary: "Get teacher detail" })
  async getTeacherDetail(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.teachersService.getTeacherDetail(tenantId, id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "create")
  @ApiOperation({ summary: "Create teacher" })
  async createTeacher(
    @Req() request: { user?: AuthenticatedUser },
    @Body() body: CreateTeacherDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.teachersService.createTeacher(tenantId, this.getActorUserId(request.user), body);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "update")
  @ApiOperation({ summary: "Update teacher" })
  async updateTeacher(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateTeacherDto,
    @Headers("x-tenant-id") tenantHeader?: string
  ) {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    return this.teachersService.updateTeacher(tenantId, this.getActorUserId(request.user), id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.SCOLARITE)
  @RequirePermission("teachers", "delete")
  @ApiOperation({ summary: "Archive teacher" })
  async archiveTeacher(
    @Req() request: { user?: AuthenticatedUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Headers("x-tenant-id") tenantHeader?: string
  ): Promise<void> {
    const tenantId = this.getTenantId(request.user, tenantHeader);
    await this.teachersService.archiveTeacher(tenantId, this.getActorUserId(request.user), id);
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
