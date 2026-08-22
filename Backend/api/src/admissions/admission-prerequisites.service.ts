import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import {
  hasPermission,
  type PermissionRequirement,
} from "../security/permissions.types";
import { UserRole } from "../security/roles.enum";
import {
  ADMISSION_MODES,
  ADMISSION_PREREQUISITES_CONTRACT_VERSION,
  type AdmissionClassPrerequisite,
  type AdmissionFeePlanPrerequisite,
  type AdmissionLevelPrerequisite,
  type AdmissionMode,
  type AdmissionPermissionKey,
  type AdmissionPrerequisiteIssue,
  type AdmissionPrerequisitePermissions,
  type AdmissionPrerequisitesResponse,
} from "./admission-prerequisites.types";

type AdmissionPermissionRequirement = PermissionRequirement & {
  key: AdmissionPermissionKey;
};

const PERMISSION_REQUIREMENTS: AdmissionPermissionRequirement[] = [
  { key: "students:read", resource: "students", action: "read" },
  { key: "students:create", resource: "students", action: "create" },
  { key: "parents:read", resource: "parents", action: "read" },
  { key: "parents:create", resource: "parents", action: "create" },
  { key: "enrollments:create", resource: "enrollments", action: "create" },
  { key: "enrollments:update", resource: "enrollments", action: "update" },
  { key: "reference:read", resource: "reference", action: "read" },
  { key: "reference:create", resource: "reference", action: "create" },
  { key: "finance:read", resource: "finance", action: "read" },
  { key: "finance:create", resource: "finance", action: "create" },
];

const MODE_REQUIREMENTS: Record<AdmissionMode, AdmissionPermissionKey[]> = {
  NEW_ADMISSION: [
    "students:read",
    "students:create",
    "parents:read",
    "parents:create",
    "enrollments:create",
    "reference:read",
  ],
  RE_ENROLLMENT: [
    "students:read",
    "parents:read",
    "enrollments:create",
    "reference:read",
  ],
};

@Injectable()
export class AdmissionPrerequisitesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPrerequisites(
    tenantId: string,
    role: UserRole,
  ): Promise<AdmissionPrerequisitesResponse> {
    const [activeSchoolYears, permissions] = await Promise.all([
      this.prisma.schoolYear.findMany({
        where: { tenantId, status: "ACTIVE", isActive: true },
        orderBy: [{ isDefault: "desc" }, { startDate: "desc" }],
        select: {
          id: true,
          code: true,
          label: true,
          startDate: true,
          endDate: true,
        },
      }),
      this.resolvePermissions(tenantId, role),
    ]);

    const blockingIssues: AdmissionPrerequisiteIssue[] = [];
    const warnings: AdmissionPrerequisiteIssue[] = [];
    const schoolYear = activeSchoolYears[0] ?? null;

    if (!schoolYear) {
      blockingIssues.push({
        code: "ADMISSION_ACTIVE_SCHOOL_YEAR_MISSING",
        scope: "ACADEMIC",
      });
    } else if (activeSchoolYears.length > 1) {
      blockingIssues.push({
        code: "ADMISSION_MULTIPLE_ACTIVE_SCHOOL_YEARS",
        scope: "ACADEMIC",
      });
    }

    const allowedModeCount = ADMISSION_MODES.filter(
      (mode) => permissions.modes[mode].allowed,
    ).length;
    if (allowedModeCount === 0) {
      blockingIssues.push({
        code: "ADMISSION_PERMISSION_DENIED",
        scope: "PERMISSIONS",
      });
    } else if (allowedModeCount < ADMISSION_MODES.length) {
      warnings.push({
        code: "ADMISSION_MODE_PERMISSION_LIMITED",
        scope: "PERMISSIONS",
      });
    }

    if (!schoolYear) {
      return this.buildResponse({
        tenantId,
        permissions,
        blockingIssues,
        warnings,
      });
    }

    const levelRows = await this.prisma.level.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        cycle: {
          is: {
            tenantId,
            schoolYearId: schoolYear.id,
            status: "ACTIVE",
          },
        },
      },
      orderBy: [{ cycle: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      select: {
        id: true,
        cycleId: true,
        code: true,
        label: true,
        track: true,
        sortOrder: true,
        cycle: {
          select: { code: true, label: true },
        },
      },
    });
    const levels: AdmissionLevelPrerequisite[] = levelRows.map((level) => ({
      id: level.id,
      cycleId: level.cycleId,
      cycleCode: level.cycle.code,
      cycleLabel: level.cycle.label,
      code: level.code,
      label: level.label,
      track: level.track,
      sortOrder: level.sortOrder,
    }));
    const levelById = new Map(levels.map((level) => [level.id, level]));

    const classRows = await this.prisma.classroom.findMany({
      where: {
        tenantId,
        schoolYearId: schoolYear.id,
        status: "ACTIVE",
        levelId: { in: levels.map((level) => level.id) },
      },
      orderBy: [{ label: "asc" }],
      select: {
        id: true,
        schoolYearId: true,
        levelId: true,
        code: true,
        label: true,
        track: true,
        capacity: true,
        actualCapacity: true,
      },
    });
    const invalidClassCount = classRows.filter(
      (classroom) =>
        levelById.get(classroom.levelId)?.track !== classroom.track,
    ).length;
    const classes: AdmissionClassPrerequisite[] = classRows
      .filter(
        (classroom) =>
          levelById.get(classroom.levelId)?.track === classroom.track,
      )
      .map((classroom) => ({
        id: classroom.id,
        schoolYearId: classroom.schoolYearId,
        levelId: classroom.levelId,
        code: classroom.code,
        label: classroom.label,
        track: classroom.track,
        capacity: classroom.capacity ?? undefined,
        actualCapacity: classroom.actualCapacity ?? undefined,
      }));

    const feePlans = permissions.canReadFeePlans
      ? await this.listFeePlans(
          tenantId,
          schoolYear.id,
          levels.map((level) => level.id),
        )
      : [];

    if (levels.length === 0) {
      blockingIssues.push({
        code: "ADMISSION_ACTIVE_LEVEL_MISSING",
        scope: "ACADEMIC",
      });
    }
    if (classes.length === 0) {
      blockingIssues.push({
        code: "ADMISSION_ACTIVE_CLASS_MISSING",
        scope: "ACADEMIC",
      });
    }
    if (invalidClassCount > 0) {
      warnings.push({
        code: "ADMISSION_REFERENCE_INCONSISTENCY",
        scope: "ACADEMIC",
      });
    }
    if (!permissions.canReadFeePlans) {
      warnings.push({
        code: "ADMISSION_FINANCE_PERMISSION_LIMITED",
        scope: "FINANCE",
      });
    } else if (feePlans.length === 0) {
      warnings.push({
        code: "ADMISSION_FEE_PLAN_NOT_AVAILABLE",
        scope: "FINANCE",
      });
    }

    const tracks = [
      ...new Set(classes.map((classroom) => classroom.track)),
    ].sort();

    return this.buildResponse({
      tenantId,
      permissions,
      blockingIssues,
      warnings,
      schoolYear: {
        ...schoolYear,
        startDate: this.toDateOnly(schoolYear.startDate),
        endDate: this.toDateOnly(schoolYear.endDate),
      },
      tracks,
      levels,
      classes,
      feePlans,
    });
  }

  private async resolvePermissions(
    tenantId: string,
    role: UserRole,
  ): Promise<AdmissionPrerequisitePermissions> {
    const customPermissions = await this.prisma.rolePermission.findMany({
      where: {
        tenantId,
        role,
        OR: PERMISSION_REQUIREMENTS.map(({ resource, action }) => ({
          resource,
          action,
        })),
      },
      select: { resource: true, action: true, allowed: true },
    });
    const customMap = new Map(
      customPermissions.map((permission) => [
        `${permission.resource}:${permission.action}`,
        permission.allowed,
      ]),
    );
    const allowed = new Map<AdmissionPermissionKey, boolean>();

    for (const requirement of PERMISSION_REQUIREMENTS) {
      const customKey = `${requirement.resource}:${requirement.action}`;
      allowed.set(
        requirement.key,
        customMap.has(customKey)
          ? customMap.get(customKey) === true
          : hasPermission(role, requirement),
      );
    }

    const has = (key: AdmissionPermissionKey): boolean =>
      allowed.get(key) === true;
    const modes = Object.fromEntries(
      ADMISSION_MODES.map((mode) => {
        const missingPermissions = MODE_REQUIREMENTS[mode].filter(
          (key) => !has(key),
        );
        return [
          mode,
          { allowed: missingPermissions.length === 0, missingPermissions },
        ];
      }),
    ) as AdmissionPrerequisitePermissions["modes"];
    const financeWriteRole =
      role === UserRole.ADMIN || role === UserRole.COMPTABLE;

    return {
      canReadStudents: has("students:read"),
      canCreateStudent: has("students:create"),
      canReadGuardians: has("parents:read"),
      canCreateGuardianAndLink: has("parents:create"),
      canCreatePlacement: has("enrollments:create"),
      canUpdatePlacement: has("enrollments:update"),
      canReadReference: has("reference:read"),
      canQuickCreateClass: has("reference:create"),
      canReadFeePlans: has("finance:read"),
      canCreateFeePlan: financeWriteRole && has("finance:create"),
      canCreateInvoice: financeWriteRole && has("finance:create"),
      modes,
    };
  }

  private async listFeePlans(
    tenantId: string,
    schoolYearId: string,
    levelIds: string[],
  ): Promise<AdmissionFeePlanPrerequisite[]> {
    if (levelIds.length === 0) return [];

    const rows = await this.prisma.feePlan.findMany({
      where: {
        tenantId,
        schoolYearId,
        levelId: { in: levelIds },
      },
      orderBy: [{ levelId: "asc" }, { label: "asc" }],
      select: {
        id: true,
        schoolYearId: true,
        levelId: true,
        label: true,
        totalAmount: true,
        currency: true,
      },
    });

    return rows.map((feePlan) => ({
      id: feePlan.id,
      schoolYearId: feePlan.schoolYearId,
      levelId: feePlan.levelId,
      label: feePlan.label,
      totalAmount: this.decimalToNumber(feePlan.totalAmount),
      currency: feePlan.currency,
    }));
  }

  private buildResponse(
    input: Pick<
      AdmissionPrerequisitesResponse,
      "permissions" | "blockingIssues" | "warnings"
    > &
      Partial<
        Pick<
          AdmissionPrerequisitesResponse,
          "schoolYear" | "tracks" | "levels" | "classes" | "feePlans"
        >
      > & { tenantId: string },
  ): AdmissionPrerequisitesResponse {
    return {
      contractVersion: ADMISSION_PREREQUISITES_CONTRACT_VERSION,
      tenant: {
        id: input.tenantId,
        eligibilitySource: "AUTHENTICATED_ACTIVE_ACCOUNT",
      },
      supportedModes: [...ADMISSION_MODES],
      schoolYear: input.schoolYear ?? null,
      tracks: input.tracks ?? [],
      levels: input.levels ?? [],
      classes: input.classes ?? [],
      feePlans: input.feePlans ?? [],
      financePolicy: "UNCONFIGURED",
      permissions: input.permissions,
      blockingIssues: input.blockingIssues,
      warnings: input.warnings,
      ready: input.blockingIssues.length === 0,
    };
  }

  private decimalToNumber(value: Prisma.Decimal): number {
    return Number(value.toString());
  }

  private toDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
