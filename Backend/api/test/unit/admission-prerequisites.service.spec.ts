import { Prisma } from "@prisma/client";

import { AdmissionPrerequisitesService } from "../../src/admissions/admission-prerequisites.service";
import { AdmissionAcademicPolicyService } from "../../src/academic-structure/admission-academic-policy.service";
import { AdmissionFinancePolicyService } from "../../src/admissions/admission-finance-policy.service";
import { PrismaService } from "../../src/database/prisma.service";
import { UserRole } from "../../src/security/roles.enum";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const ACTIVE_YEAR = {
  id: "10000000-0000-4000-8000-000000000001",
  code: "2026-2027",
  label: "2026-2027",
  startDate: new Date("2026-09-01T00:00:00.000Z"),
  endDate: new Date("2027-06-30T00:00:00.000Z"),
};
const ACTIVE_LEVEL = {
  id: "20000000-0000-4000-8000-000000000001",
  cycleId: "21000000-0000-4000-8000-000000000001",
  code: "6E",
  label: "Sixieme",
  track: "FRANCOPHONE" as const,
  sortOrder: 1,
  cycle: { code: "COLLEGE", label: "College" },
};
const ACTIVE_CLASS = {
  id: "30000000-0000-4000-8000-000000000001",
  schoolYearId: ACTIVE_YEAR.id,
  cycleId: ACTIVE_LEVEL.cycleId,
  levelId: ACTIVE_LEVEL.id,
  code: "6E-A",
  label: "Sixieme A",
  track: "FRANCOPHONE" as const,
  capacity: 35,
  actualCapacity: 20,
  currentEnrollmentCount: 20,
  placesRemaining: 15,
  capacityStatus: "AVAILABLE" as const,
  _count: { trackPlacements: 20 },
};
const FEE_PLAN = {
  id: "40000000-0000-4000-8000-000000000001",
  schoolYearId: ACTIVE_YEAR.id,
  levelId: ACTIVE_LEVEL.id,
  label: "Tarif standard",
  totalAmount: new Prisma.Decimal(125000),
  currency: "CFA",
};

type PrismaMock = {
  schoolYear: { findMany: jest.Mock };
  level: { findMany: jest.Mock };
  classroom: { findMany: jest.Mock };
  feePlan: { findMany: jest.Mock };
  rolePermission: { findMany: jest.Mock };
};

const createPrismaMock = (): PrismaMock => ({
  schoolYear: { findMany: jest.fn().mockResolvedValue([ACTIVE_YEAR]) },
  level: { findMany: jest.fn().mockResolvedValue([ACTIVE_LEVEL]) },
  classroom: { findMany: jest.fn().mockResolvedValue([ACTIVE_CLASS]) },
  feePlan: { findMany: jest.fn().mockResolvedValue([FEE_PLAN]) },
  rolePermission: { findMany: jest.fn().mockResolvedValue([]) },
});

const createService = (prisma: PrismaMock): AdmissionPrerequisitesService =>
  new AdmissionPrerequisitesService(
    prisma as unknown as PrismaService,
    new AdmissionAcademicPolicyService(prisma as unknown as PrismaService),
    new AdmissionFinancePolicyService(prisma as unknown as PrismaService),
  );

describe("AdmissionPrerequisitesService", () => {
  it("returns a compact, stable and ready payload for a configured tenant", async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);

    const result = await service.getPrerequisites(TENANT_ID, UserRole.ADMIN);

    expect(Object.keys(result)).toEqual([
      "contractVersion",
      "tenant",
      "supportedModes",
      "schoolYear",
      "tracks",
      "levels",
      "classes",
      "feePlans",
      "financePolicy",
      "permissions",
      "blockingIssues",
      "warnings",
      "ready",
    ]);
    expect(result).toMatchObject({
      contractVersion: "1",
      tenant: {
        id: TENANT_ID,
        eligibilitySource: "AUTHENTICATED_ACTIVE_ACCOUNT",
      },
      supportedModes: ["NEW_ADMISSION", "RE_ENROLLMENT"],
      schoolYear: {
        id: ACTIVE_YEAR.id,
        startDate: "2026-09-01",
        endDate: "2027-06-30",
      },
      tracks: ["FRANCOPHONE"],
      financePolicy: "OPTIONAL",
      blockingIssues: [],
      warnings: [],
      ready: true,
    });
    expect(result.levels).toHaveLength(1);
    expect(result.classes).toHaveLength(1);
    expect(result.feePlans).toEqual([
      expect.objectContaining({ id: FEE_PLAN.id, totalAmount: 125000 }),
    ]);
  });

  it("blocks when no active school year exists and avoids cascading queries", async () => {
    const prisma = createPrismaMock();
    prisma.schoolYear.findMany.mockResolvedValue([]);
    const service = createService(prisma);

    const result = await service.getPrerequisites(TENANT_ID, UserRole.ADMIN);

    expect(result.ready).toBe(false);
    expect(result.schoolYear).toBeNull();
    expect(result.blockingIssues).toEqual([
      { code: "ADMISSION_ACTIVE_SCHOOL_YEAR_MISSING", scope: "ACADEMIC" },
    ]);
    expect(prisma.level.findMany).not.toHaveBeenCalled();
    expect(prisma.classroom.findMany).not.toHaveBeenCalled();
    expect(prisma.feePlan.findMany).not.toHaveBeenCalled();
  });

  it("blocks when the active hierarchy has no available class", async () => {
    const prisma = createPrismaMock();
    prisma.classroom.findMany.mockResolvedValue([]);
    const service = createService(prisma);

    const result = await service.getPrerequisites(TENANT_ID, UserRole.ADMIN);

    expect(result.ready).toBe(false);
    expect(result.blockingIssues).toContainEqual({
      code: "ADMISSION_ACTIVE_CLASS_MISSING",
      scope: "ACADEMIC",
    });
    expect(result.levels).toHaveLength(1);
    expect(result.classes).toEqual([]);
    expect(result.tracks).toEqual(["FRANCOPHONE"]);
  });

  it("reports missing fee plans as a warning because finance policy is not modeled", async () => {
    const prisma = createPrismaMock();
    prisma.feePlan.findMany.mockResolvedValue([]);
    const service = createService(prisma);

    const result = await service.getPrerequisites(TENANT_ID, UserRole.ADMIN);

    expect(result.ready).toBe(true);
    expect(result.financePolicy).toBe("OPTIONAL");
    expect(result.warnings).toContainEqual({
      code: "ADMISSION_FEE_PLAN_NOT_AVAILABLE",
      scope: "FINANCE",
    });
  });

  it("exposes reduced custom permissions without granting finance writes to SCOLARITE", async () => {
    const prisma = createPrismaMock();
    prisma.rolePermission.findMany.mockResolvedValue([
      { resource: "students", action: "create", allowed: false },
      { resource: "parents", action: "create", allowed: false },
      { resource: "finance", action: "create", allowed: true },
    ]);
    const service = createService(prisma);

    const result = await service.getPrerequisites(
      TENANT_ID,
      UserRole.SCOLARITE,
    );

    expect(result.permissions.modes.NEW_ADMISSION).toEqual({
      allowed: false,
      missingPermissions: ["students:create", "parents:create"],
    });
    expect(result.permissions.modes.RE_ENROLLMENT.allowed).toBe(true);
    expect(result.permissions.canCreateFeePlan).toBe(false);
    expect(result.permissions.canCreateInvoice).toBe(false);
    expect(result.warnings).toContainEqual({
      code: "ADMISSION_MODE_PERMISSION_LIMITED",
      scope: "PERMISSIONS",
    });
  });

  it("blocks both admission modes when placement creation is denied", async () => {
    const prisma = createPrismaMock();
    prisma.rolePermission.findMany.mockResolvedValue([
      { resource: "enrollments", action: "create", allowed: false },
    ]);
    const service = createService(prisma);

    const result = await service.getPrerequisites(TENANT_ID, UserRole.ADMIN);

    expect(result.permissions.modes.NEW_ADMISSION.allowed).toBe(false);
    expect(result.permissions.modes.RE_ENROLLMENT.allowed).toBe(false);
    expect(result.blockingIssues).toContainEqual({
      code: "ADMISSION_PERMISSION_DENIED",
      scope: "PERMISSIONS",
    });
  });

  it("enforces tenant and active hierarchy filters on every catalog query", async () => {
    const prisma = createPrismaMock();
    const service = createService(prisma);

    await service.getPrerequisites(TENANT_ID, UserRole.ADMIN);

    expect(prisma.schoolYear.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, status: "ACTIVE", isActive: true },
      }),
    );
    expect(prisma.level.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_ID,
          status: "ACTIVE",
          cycle: {
            is: {
              tenantId: TENANT_ID,
              schoolYearId: ACTIVE_YEAR.id,
              status: "ACTIVE",
            },
          },
        }),
      }),
    );
    expect(prisma.classroom.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_ID,
          schoolYearId: ACTIVE_YEAR.id,
          status: "ACTIVE",
        }),
      }),
    );
    expect(prisma.feePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: TENANT_ID,
          schoolYearId: ACTIVE_YEAR.id,
          levelId: { in: [ACTIVE_LEVEL.id] },
        },
      }),
    );
    expect(prisma.rolePermission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_ID }),
      }),
    );
  });

  it("excludes a class whose track conflicts with its active level", async () => {
    const prisma = createPrismaMock();
    prisma.classroom.findMany.mockResolvedValue([
      { ...ACTIVE_CLASS, track: "ARABOPHONE" },
    ]);
    const service = createService(prisma);

    const result = await service.getPrerequisites(TENANT_ID, UserRole.ADMIN);

    expect(result.classes).toEqual([]);
    expect(result.warnings).toContainEqual({
      code: "ADMISSION_REFERENCE_INCONSISTENCY",
      scope: "ACADEMIC",
    });
    expect(result.blockingIssues).toContainEqual({
      code: "ADMISSION_ACTIVE_CLASS_MISSING",
      scope: "ACADEMIC",
    });
  });
});
