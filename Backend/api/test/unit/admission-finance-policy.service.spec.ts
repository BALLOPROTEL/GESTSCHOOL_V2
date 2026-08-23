import { Prisma } from "@prisma/client";

import { AdmissionFinancePolicyService } from "../../src/admissions/admission-finance-policy.service";
import { PrismaService } from "../../src/database/prisma.service";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_TENANT_ID = "90000000-0000-4000-8000-000000000001";
const YEAR_ID = "10000000-0000-4000-8000-000000000001";
const LEVEL_ID = "20000000-0000-4000-8000-000000000001";
const PLAN_ID = "30000000-0000-4000-8000-000000000001";

const academics = {
  schoolYearId: YEAR_ID,
  cycleId: "40000000-0000-4000-8000-000000000001",
  levelId: LEVEL_ID,
  classId: "50000000-0000-4000-8000-000000000001",
  track: "FRANCOPHONE" as const,
};

const plan = {
  id: PLAN_ID,
  schoolYearId: YEAR_ID,
  levelId: LEVEL_ID,
  label: "Standard",
  totalAmount: new Prisma.Decimal(125000),
  currency: "CFA",
};

const createService = () => {
  const prisma = {
    feePlan: {
      findMany: jest.fn().mockResolvedValue([plan]),
      findFirst: jest.fn().mockResolvedValue(plan),
    },
  };
  return {
    prisma,
    service: new AdmissionFinancePolicyService(
      prisma as unknown as PrismaService,
    ),
  };
};

describe("AdmissionFinancePolicyService", () => {
  it("defines an optional policy that accepts an unspecified or deferred intent", async () => {
    const { prisma, service } = createService();

    await expect(
      service.assertFinalIntent(TENANT_ID, undefined, academics, prisma as never),
    ).resolves.toMatchObject({
      policy: "OPTIONAL",
      mode: "UNSPECIFIED",
      invoiceGeneration: "DEFERRED",
    });
    await expect(
      service.assertFinalIntent(
        TENANT_ID,
        { mode: "DEFERRED" },
        academics,
        prisma as never,
      ),
    ).resolves.toMatchObject({
      mode: "DEFERRED",
      feePlanId: null,
      amount: null,
    });
    expect(prisma.feePlan.findFirst).not.toHaveBeenCalled();
  });

  it("returns only plans matching tenant, school year and level", async () => {
    const { prisma, service } = createService();

    await expect(
      service.listCompatiblePlans(TENANT_ID, academics),
    ).resolves.toEqual([
      expect.objectContaining({
        id: PLAN_ID,
        totalAmount: 125000,
        currency: "CFA",
      }),
    ]);
    expect(prisma.feePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: TENANT_ID,
          schoolYearId: YEAR_ID,
          levelId: LEVEL_ID,
        },
      }),
    );
  });

  it("revalidates and snapshots a compatible plan without creating an invoice", async () => {
    const { prisma, service } = createService();

    await expect(
      service.assertFinalIntent(
        TENANT_ID,
        { mode: "FEE_PLAN", feePlanId: PLAN_ID },
        academics,
        prisma as never,
      ),
    ).resolves.toEqual({
      policy: "OPTIONAL",
      mode: "FEE_PLAN",
      feePlanId: PLAN_ID,
      amount: 125000,
      currency: "CFA",
      invoiceGeneration: "DEFERRED",
    });
    expect(prisma.feePlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PLAN_ID, tenantId: TENANT_ID } }),
    );
  });

  it("rejects unavailable, cross-tenant and incompatible plans with stable codes", async () => {
    const { prisma, service } = createService();
    prisma.feePlan.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.assertDraftIntent(
        TENANT_ID,
        { mode: "FEE_PLAN", feePlanId: PLAN_ID },
        academics,
      ),
    ).rejects.toMatchObject({ response: { code: "FEE_PLAN_NOT_AVAILABLE" } });

    prisma.feePlan.findFirst.mockResolvedValueOnce({
      ...plan,
      schoolYearId: OTHER_TENANT_ID,
    });
    await expect(
      service.assertFinalIntent(
        TENANT_ID,
        { mode: "FEE_PLAN", feePlanId: PLAN_ID },
        academics,
        prisma as never,
      ),
    ).rejects.toMatchObject({ response: { code: "FEE_PLAN_NOT_COMPATIBLE" } });
  });

  it("rejects a fee plan on deferred intent and reports invalid readiness", async () => {
    const { service } = createService();
    await expect(
      service.assertDraftIntent(
        TENANT_ID,
        { mode: "DEFERRED", feePlanId: PLAN_ID },
        academics,
      ),
    ).rejects.toMatchObject({ response: { code: "FEE_PLAN_NOT_COMPATIBLE" } });

    expect(
      service.evaluateReadiness(
        { mode: "FEE_PLAN", feePlanId: PLAN_ID },
        academics,
        [],
      ),
    ).toEqual({
      complete: false,
      blockingIssue: { code: "FEE_PLAN_NOT_AVAILABLE", scope: "FINANCE" },
    });

    await expect(
      service.assertDraftIntent(
        TENANT_ID,
        { feePlanId: PLAN_ID },
        academics,
      ),
    ).rejects.toMatchObject({
      response: { code: "FEE_PLAN_NOT_COMPATIBLE" },
    });
    expect(
      service.evaluateReadiness({ feePlanId: PLAN_ID }, academics, [
        {
          ...plan,
          totalAmount: 125000,
        },
      ]),
    ).toEqual({
      complete: false,
      blockingIssue: { code: "FEE_PLAN_NOT_COMPATIBLE", scope: "FINANCE" },
    });

    await expect(
      service.assertDraftIntent(
        TENANT_ID,
        { mode: "FEE_PLAN", feePlanId: PLAN_ID },
        undefined,
      ),
    ).rejects.toMatchObject({
      response: { code: "FINANCE_ACADEMIC_CONTEXT_REQUIRED" },
    });
  });

  it("exposes RBAC capabilities without granting invoice creation", async () => {
    const { service } = createService();
    const result = await service.getOptions({
      tenantId: TENANT_ID,
      admissionCaseId: "60000000-0000-4000-8000-000000000001",
      academics,
      finance: { mode: "FEE_PLAN", feePlanId: PLAN_ID },
      capabilities: {
        canReadFeePlans: true,
        canSelectFeePlan: true,
        canDefer: true,
        canCreateInvoice: false,
        automaticInvoiceCreation: false,
      },
    });

    expect(result).toMatchObject({
      contractVersion: "1",
      policy: "OPTIONAL",
      supportedModes: ["FEE_PLAN", "DEFERRED"],
      schedule: { supported: false },
      services: { supported: false },
      discounts: { supported: false },
      exemptions: { supported: false },
      capabilities: {
        canSelectFeePlan: true,
        canCreateInvoice: false,
        automaticInvoiceCreation: false,
      },
      blockingIssues: [],
    });
  });
});
