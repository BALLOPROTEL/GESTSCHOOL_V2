import { AdmissionCaseMode, AdmissionCaseStatus } from "@prisma/client";

import { AuditService } from "../../src/audit/audit.service";
import { AdmissionAcademicPolicyService } from "../../src/academic-structure/admission-academic-policy.service";
import { AdmissionCasesService } from "../../src/admissions/admission-cases.service";
import { AdmissionPrerequisitesService } from "../../src/admissions/admission-prerequisites.service";
import { AdmissionFinancePolicyService } from "../../src/admissions/admission-finance-policy.service";
import { type AdmissionPrerequisitesResponse } from "../../src/admissions/admission-prerequisites.types";
import { PrismaService } from "../../src/database/prisma.service";
import { UserRole } from "../../src/security/roles.enum";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const ACTOR_ID = "10000000-0000-4000-8000-000000000001";
const STUDENT_ID = "20000000-0000-4000-8000-000000000001";
const YEAR_ID = "30000000-0000-4000-8000-000000000001";
const CYCLE_ID = "40000000-0000-4000-8000-000000000001";
const LEVEL_ID = "50000000-0000-4000-8000-000000000001";
const CLASS_ID = "60000000-0000-4000-8000-000000000001";
const CASE_ID = "70000000-0000-4000-8000-000000000001";

const prerequisites: AdmissionPrerequisitesResponse = {
  contractVersion: "1",
  tenant: {
    id: TENANT_ID,
    eligibilitySource: "AUTHENTICATED_ACTIVE_ACCOUNT",
  },
  supportedModes: ["NEW_ADMISSION", "RE_ENROLLMENT"],
  schoolYear: {
    id: YEAR_ID,
    code: "2026-2027",
    label: "2026-2027",
    startDate: "2026-09-01",
    endDate: "2027-06-30",
  },
  tracks: ["FRANCOPHONE"],
  levels: [
    {
      id: LEVEL_ID,
      cycleId: CYCLE_ID,
      cycleCode: "PRIMARY",
      cycleLabel: "Primary",
      code: "CP1",
      label: "CP1",
      track: "FRANCOPHONE",
      sortOrder: 1,
    },
  ],
  classes: [
    {
      id: CLASS_ID,
      schoolYearId: YEAR_ID,
      cycleId: CYCLE_ID,
      levelId: LEVEL_ID,
      code: "CP1-A",
      label: "CP1 A",
      track: "FRANCOPHONE",
      currentEnrollmentCount: 0,
      capacityStatus: "UNBOUNDED",
    },
  ],
  feePlans: [],
  financePolicy: "OPTIONAL",
  permissions: {
    canReadStudents: true,
    canCreateStudent: true,
    canReadGuardians: true,
    canCreateGuardianAndLink: true,
    canCreatePlacement: true,
    canUpdatePlacement: true,
    canReadReference: true,
    canQuickCreateClass: true,
    canReadFeePlans: true,
    canCreateFeePlan: false,
    canCreateInvoice: false,
    modes: {
      NEW_ADMISSION: { allowed: true, missingPermissions: [] },
      RE_ENROLLMENT: { allowed: true, missingPermissions: [] },
    },
  },
  blockingIssues: [],
  warnings: [],
  ready: true,
};

const academics = {
  schoolYearId: YEAR_ID,
  cycleId: CYCLE_ID,
  levelId: LEVEL_ID,
  classId: CLASS_ID,
  track: "FRANCOPHONE" as const,
};

const row = (overrides: Record<string, unknown> = {}) => ({
  id: CASE_ID,
  tenantId: TENANT_ID,
  mode: AdmissionCaseMode.NEW_ADMISSION,
  status: AdmissionCaseStatus.DRAFT,
  version: 1,
  payloadVersion: 1,
  draftData: {},
  studentId: null,
  schoolYearId: null,
  cancelledAt: null,
  createdAt: new Date("2026-08-22T10:00:00.000Z"),
  updatedAt: new Date("2026-08-22T10:00:00.000Z"),
  student: null,
  ...overrides,
});

type PrismaMock = {
  admissionCase: {
    create: jest.Mock;
    findFirst: jest.Mock;
    updateMany: jest.Mock;
  };
  student: { findFirst: jest.Mock };
  parent: { count: jest.Mock };
  $transaction: jest.Mock;
};

const createMocks = () => {
  const prisma: PrismaMock = {
    admissionCase: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    student: { findFirst: jest.fn() },
    parent: { count: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (callback: (client: PrismaMock) => Promise<unknown>) =>
      callback(prisma),
  );
  const prerequisiteService = {
    getPrerequisites: jest.fn().mockResolvedValue(prerequisites),
  };
  const academicPolicy = {
    assertDraftSelection: jest.fn().mockResolvedValue(undefined),
    isCompleteSelectionAvailable: jest.fn(
      (section: typeof academics | undefined) =>
        Boolean(
          section?.schoolYearId === YEAR_ID &&
          section.cycleId === CYCLE_ID &&
          section.levelId === LEVEL_ID &&
          section.classId === CLASS_ID &&
          section.track === "FRANCOPHONE",
        ),
    ),
  };
  const auditService = { recordLog: jest.fn().mockResolvedValue(undefined) };
  const financePolicy = {
    assertDraftIntent: jest.fn().mockResolvedValue(undefined),
    evaluateReadiness: jest.fn().mockReturnValue({
      complete: true,
      blockingIssue: null,
    }),
    getOptions: jest.fn(),
  };
  const service = new AdmissionCasesService(
    prisma as unknown as PrismaService,
    prerequisiteService as unknown as AdmissionPrerequisitesService,
    academicPolicy as unknown as AdmissionAcademicPolicyService,
    financePolicy as unknown as AdmissionFinancePolicyService,
    auditService as unknown as AuditService,
  );
  return {
    prisma,
    prerequisiteService,
    academicPolicy,
    financePolicy,
    auditService,
    service,
  };
};

const actor = { id: ACTOR_ID, role: UserRole.ADMIN };

describe("AdmissionCasesService", () => {
  it("reads legacy finance intents without rewriting stored admission data", () => {
    const { service } = createMocks();

    expect(
      service.parseStoredDraftData({
        FINANCE: {
          disposition: "IMMEDIATE",
          feePlanId: "80000000-0000-4000-8000-000000000001",
        },
      }),
    ).toEqual({
      FINANCE: {
        mode: "FEE_PLAN",
        feePlanId: "80000000-0000-4000-8000-000000000001",
      },
    });
    expect(
      service.parseStoredDraftData({
        FINANCE: { disposition: "EXEMPT_OR_SPECIAL", note: "Legacy note" },
      }),
    ).toEqual({ FINANCE: { mode: "DEFERRED", note: "Legacy note" } });
  });

  it("creates NEW_ADMISSION as a draft without touching business models", async () => {
    const { prisma, auditService, service } = createMocks();
    prisma.admissionCase.create.mockResolvedValue(row());

    const result = await service.create(TENANT_ID, actor, {
      mode: AdmissionCaseMode.NEW_ADMISSION,
    });

    expect(result).toMatchObject({
      mode: AdmissionCaseMode.NEW_ADMISSION,
      status: AdmissionCaseStatus.DRAFT,
      version: 1,
    });
    expect(prisma.admissionCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          studentId: null,
        }),
      }),
    );
    expect(prisma.student.findFirst).not.toHaveBeenCalled();
    expect(auditService.recordLog).toHaveBeenCalledTimes(1);
  });

  it("requires a same-tenant selectable student for RE_ENROLLMENT", async () => {
    const { prisma, service } = createMocks();

    await expect(
      service.create(TENANT_ID, actor, {
        mode: AdmissionCaseMode.RE_ENROLLMENT,
      }),
    ).rejects.toMatchObject({ response: { code: "ADMISSION_MODE_INVALID" } });

    prisma.student.findFirst.mockResolvedValue(null);
    await expect(
      service.create(TENANT_ID, actor, {
        mode: AdmissionCaseMode.RE_ENROLLMENT,
        studentId: STUDENT_ID,
      }),
    ).rejects.toMatchObject({
      response: { code: "ADMISSION_EXISTING_STUDENT_UNAVAILABLE" },
    });
    expect(prisma.student.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: STUDENT_ID,
          tenantId: TENANT_ID,
        }),
      }),
    );
  });

  it("recalculates DRAFT to READY and updates with id+tenant+version atomically", async () => {
    const { prisma, service } = createMocks();
    const guardianSection = {
      guardians: [
        {
          source: "NEW_GUARDIAN" as const,
          parentalRole: "TUTEUR" as const,
          firstName: "Guardian",
          lastName: "Draft",
          primaryPhone: "+22370000000",
          relationType: "TUTEUR" as const,
          isPrimaryContact: true,
        },
      ],
    };
    const current = row({
      draftData: { ACADEMICS: academics, GUARDIANS: guardianSection },
    });
    const updated = row({
      version: 2,
      status: AdmissionCaseStatus.READY,
      schoolYearId: YEAR_ID,
      draftData: {
        ACADEMICS: academics,
        STUDENT: {
          matricule: "DRAFT-001",
          matriculeMode: "MANUAL",
          firstName: "Draft",
          lastName: "Student",
          sex: "F",
          birthDate: "2015-01-10",
        },
        GUARDIANS: guardianSection,
      },
    });
    prisma.admissionCase.findFirst
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(updated);
    prisma.admissionCase.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.saveSection(
      TENANT_ID,
      actor,
      CASE_ID,
      "STUDENT",
      {
        expectedVersion: 1,
        data: {
          matricule: "DRAFT-001",
          matriculeMode: "MANUAL",
          firstName: "Draft",
          lastName: "Student",
          sex: "F",
          birthDate: "2015-01-10",
        },
      },
    );

    expect(result).toMatchObject({
      status: AdmissionCaseStatus.READY,
      ready: true,
      version: 2,
    });
    expect(prisma.admissionCase.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: CASE_ID,
          tenantId: TENANT_ID,
          version: 1,
        }),
        data: expect.objectContaining({
          status: AdmissionCaseStatus.READY,
          version: { increment: 1 },
        }),
      }),
    );
  });

  it("returns a stable 409 for a stale expectedVersion", async () => {
    const { prisma, service } = createMocks();
    prisma.admissionCase.findFirst.mockResolvedValue(row({ version: 4 }));

    await expect(
      service.saveSection(TENANT_ID, actor, CASE_ID, "FINANCE", {
        expectedVersion: 3,
        data: {},
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: "ADMISSION_VERSION_CONFLICT" },
    });
    expect(prisma.admissionCase.updateMany).not.toHaveBeenCalled();
  });

  it("rejects fee plan selection when finance read permission is absent", async () => {
    const { prisma, prerequisiteService, financePolicy, service } =
      createMocks();
    prisma.admissionCase.findFirst.mockResolvedValue(
      row({ draftData: { ACADEMICS: academics } }),
    );
    prerequisiteService.getPrerequisites.mockResolvedValue({
      ...prerequisites,
      permissions: {
        ...prerequisites.permissions,
        canReadFeePlans: false,
      },
    });

    await expect(
      service.saveSection(TENANT_ID, actor, CASE_ID, "FINANCE", {
        expectedVersion: 1,
        data: {
          mode: "FEE_PLAN",
          feePlanId: "80000000-0000-4000-8000-000000000001",
        },
      }),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: "FINANCE_PERMISSION_DENIED" },
    });
    expect(financePolicy.assertDraftIntent).not.toHaveBeenCalled();
    expect(prisma.admissionCase.updateMany).not.toHaveBeenCalled();
  });

  it("rejects unknown fields in typed sections", async () => {
    const { prisma, service } = createMocks();
    prisma.admissionCase.findFirst.mockResolvedValue(row());

    await expect(
      service.saveSection(TENANT_ID, actor, CASE_ID, "STUDENT", {
        expectedVersion: 1,
        data: { status: "CONFIRMED" },
      }),
    ).rejects.toMatchObject({
      response: { code: "ADMISSION_SECTION_INVALID" },
    });
  });

  it("cancels DRAFT atomically and prevents further changes", async () => {
    const { prisma, auditService, service } = createMocks();
    const current = row();
    const cancelled = row({
      status: AdmissionCaseStatus.CANCELLED,
      version: 2,
      cancelledAt: new Date("2026-08-22T11:00:00.000Z"),
    });
    prisma.admissionCase.findFirst
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(cancelled);
    prisma.admissionCase.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.cancel(TENANT_ID, actor, CASE_ID, {
      expectedVersion: 1,
    });
    expect(result).toMatchObject({
      status: AdmissionCaseStatus.CANCELLED,
      version: 2,
      ready: false,
    });
    expect(auditService.recordLog).toHaveBeenCalledTimes(1);

    const cancelledService = createMocks();
    cancelledService.prisma.admissionCase.findFirst.mockResolvedValue(
      cancelled,
    );
    await expect(
      cancelledService.service.saveSection(
        TENANT_ID,
        actor,
        CASE_ID,
        "STUDENT",
        { expectedVersion: 2, data: {} },
      ),
    ).rejects.toMatchObject({
      response: { code: "ADMISSION_CASE_CANCELLED" },
    });
  });

  it("does not reveal a case from another tenant", async () => {
    const { prisma, service } = createMocks();
    prisma.admissionCase.findFirst.mockResolvedValue(null);

    await expect(
      service.get(TENANT_ID, UserRole.ADMIN, CASE_ID),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: "ADMISSION_CASE_NOT_FOUND" },
    });
    expect(prisma.admissionCase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CASE_ID, tenantId: TENANT_ID } }),
    );
  });
});
