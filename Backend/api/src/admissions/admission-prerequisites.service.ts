import { Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import { AdmissionAcademicPolicyService } from "../academic-structure/admission-academic-policy.service";
import { AdmissionFinancePolicyService } from "./admission-finance-policy.service";
import { ADMISSION_FINANCE_POLICY } from "./admission-finance-policy.types";
import {
  hasPermission,
  type PermissionRequirement,
} from "../security/permissions.types";
import { UserRole } from "../security/roles.enum";
import {
  ADMISSION_MODES,
  ADMISSION_PREREQUISITES_CONTRACT_VERSION,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly academicPolicy: AdmissionAcademicPolicyService,
    private readonly financePolicy: AdmissionFinancePolicyService,
  ) {}

  async getPrerequisites(
    tenantId: string,
    role: UserRole,
  ): Promise<AdmissionPrerequisitesResponse> {
    const [catalog, permissions] = await Promise.all([
      this.academicPolicy.getPrerequisiteCatalog(tenantId),
      this.resolvePermissions(tenantId, role),
    ]);

    const blockingIssues: AdmissionPrerequisiteIssue[] = [];
    const warnings: AdmissionPrerequisiteIssue[] = [];
    const schoolYear = catalog.schoolYear;

    if (catalog.schoolYears.length === 0) {
      blockingIssues.push({
        code: "ADMISSION_ACTIVE_SCHOOL_YEAR_MISSING",
        scope: "ACADEMIC",
      });
    } else if (catalog.schoolYears.length > 1) {
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

    const feePlans = permissions.canReadFeePlans
      ? await this.financePolicy.listPlansForLevels(
          tenantId,
          schoolYear.id,
          catalog.levels.map((level) => level.id),
        )
      : [];

    if (catalog.levels.length === 0) {
      blockingIssues.push({
        code: "ADMISSION_ACTIVE_LEVEL_MISSING",
        scope: "ACADEMIC",
      });
    }
    if (catalog.classes.length === 0) {
      blockingIssues.push({
        code: "ADMISSION_ACTIVE_CLASS_MISSING",
        scope: "ACADEMIC",
      });
    }
    if (catalog.invalidClassCount > 0) {
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

    return this.buildResponse({
      tenantId,
      permissions,
      blockingIssues,
      warnings,
      schoolYear,
      tracks: catalog.tracks,
      levels: catalog.levels,
      classes: catalog.classes,
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
      financePolicy: ADMISSION_FINANCE_POLICY,
      permissions: input.permissions,
      blockingIssues: input.blockingIssues,
      warnings: input.warnings,
      ready: input.blockingIssues.length === 0,
    };
  }

}
