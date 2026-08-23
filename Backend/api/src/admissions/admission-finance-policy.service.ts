import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import {
  type AdmissionAcademicsDraft,
  type AdmissionFinanceDraft,
} from "./admission-cases.types";
import {
  ADMISSION_FINANCE_CONTRACT_VERSION,
  ADMISSION_FINANCE_MODES,
  ADMISSION_FINANCE_POLICY,
  type AdmissionFinalFinanceResult,
  type AdmissionFinanceCapabilities,
  type AdmissionFinanceIssue,
  type AdmissionFinanceOptionsResponse,
  type AdmissionFinancePlanOption,
} from "./admission-finance-policy.types";

type FinanceClient = Pick<Prisma.TransactionClient, "feePlan">;

@Injectable()
export class AdmissionFinancePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async listCompatiblePlans(
    tenantId: string,
    academics: AdmissionAcademicsDraft | undefined,
    client: FinanceClient = this.prisma,
  ): Promise<AdmissionFinancePlanOption[]> {
    if (!academics?.schoolYearId || !academics.levelId) return [];

    const rows = await client.feePlan.findMany({
      where: {
        tenantId,
        schoolYearId: academics.schoolYearId,
        levelId: academics.levelId,
      },
      orderBy: [{ label: "asc" }, { id: "asc" }],
      select: {
        id: true,
        schoolYearId: true,
        levelId: true,
        label: true,
        totalAmount: true,
        currency: true,
      },
    });

    return rows.map((row) => this.toPlan(row));
  }

  async listPlansForLevels(
    tenantId: string,
    schoolYearId: string,
    levelIds: string[],
    client: FinanceClient = this.prisma,
  ): Promise<AdmissionFinancePlanOption[]> {
    if (levelIds.length === 0) return [];
    const rows = await client.feePlan.findMany({
      where: { tenantId, schoolYearId, levelId: { in: levelIds } },
      orderBy: [{ levelId: "asc" }, { label: "asc" }, { id: "asc" }],
      select: {
        id: true,
        schoolYearId: true,
        levelId: true,
        label: true,
        totalAmount: true,
        currency: true,
      },
    });
    return rows.map((row) => this.toPlan(row));
  }

  async getOptions(input: {
    tenantId: string;
    admissionCaseId: string;
    academics?: AdmissionAcademicsDraft;
    finance?: AdmissionFinanceDraft;
    capabilities: AdmissionFinanceCapabilities;
  }): Promise<AdmissionFinanceOptionsResponse> {
    const plans = input.capabilities.canReadFeePlans
      ? await this.listCompatiblePlans(input.tenantId, input.academics)
      : [];
    const blockingIssues: AdmissionFinanceIssue[] = [];
    const warnings: AdmissionFinanceIssue[] = [];

    if (!input.capabilities.canReadFeePlans) {
      warnings.push({ code: "FINANCE_PERMISSION_DENIED", scope: "FINANCE" });
    }
    if (
      input.finance?.mode === "FEE_PLAN" &&
      (!input.academics?.schoolYearId || !input.academics.levelId)
    ) {
      blockingIssues.push({
        code: "FINANCE_ACADEMIC_CONTEXT_REQUIRED",
        scope: "FINANCE",
      });
    } else if (
      input.finance?.mode === "FEE_PLAN" &&
      !plans.some((plan) => plan.id === input.finance?.feePlanId)
    ) {
      blockingIssues.push({
        code: "FEE_PLAN_NOT_AVAILABLE",
        scope: "FINANCE",
      });
    }

    return {
      contractVersion: ADMISSION_FINANCE_CONTRACT_VERSION,
      admissionCaseId: input.admissionCaseId,
      policy: ADMISSION_FINANCE_POLICY,
      supportedModes: [...ADMISSION_FINANCE_MODES],
      academicContext: input.academics ?? null,
      plans,
      selectedIntent: input.finance?.mode
        ? {
            mode: input.finance.mode,
            feePlanId: input.finance.feePlanId ?? null,
          }
        : null,
      schedule: { supported: false },
      services: { supported: false },
      discounts: { supported: false },
      exemptions: { supported: false },
      capabilities: input.capabilities,
      blockingIssues,
      warnings,
    };
  }

  async assertDraftIntent(
    tenantId: string,
    finance: AdmissionFinanceDraft | undefined,
    academics: AdmissionAcademicsDraft | undefined,
  ): Promise<void> {
    await this.resolveIntent(tenantId, finance, academics, this.prisma, false);
  }

  async assertFinalIntent(
    tenantId: string,
    finance: AdmissionFinanceDraft | undefined,
    academics: AdmissionAcademicsDraft,
    client: FinanceClient,
  ): Promise<AdmissionFinalFinanceResult> {
    return this.resolveIntent(tenantId, finance, academics, client, true);
  }

  evaluateReadiness(
    finance: AdmissionFinanceDraft | undefined,
    academics: AdmissionAcademicsDraft | undefined,
    availablePlans: AdmissionFinancePlanOption[],
  ): { complete: boolean; blockingIssue: AdmissionFinanceIssue | null } {
    if (!finance?.mode && finance?.feePlanId) {
      return {
        complete: false,
        blockingIssue: {
          code: "FEE_PLAN_NOT_COMPATIBLE",
          scope: "FINANCE",
        },
      };
    }
    if (!finance?.mode || finance.mode === "DEFERRED") {
      return { complete: true, blockingIssue: null };
    }
    if (!academics?.schoolYearId || !academics.levelId) {
      return {
        complete: false,
        blockingIssue: {
          code: "FINANCE_ACADEMIC_CONTEXT_REQUIRED",
          scope: "FINANCE",
        },
      };
    }
    const plan = availablePlans.find((item) => item.id === finance.feePlanId);
    if (!plan) {
      return {
        complete: false,
        blockingIssue: { code: "FEE_PLAN_NOT_AVAILABLE", scope: "FINANCE" },
      };
    }
    if (
      plan.schoolYearId !== academics.schoolYearId ||
      plan.levelId !== academics.levelId
    ) {
      return {
        complete: false,
        blockingIssue: { code: "FEE_PLAN_NOT_COMPATIBLE", scope: "FINANCE" },
      };
    }
    return { complete: true, blockingIssue: null };
  }

  private async resolveIntent(
    tenantId: string,
    finance: AdmissionFinanceDraft | undefined,
    academics: AdmissionAcademicsDraft | undefined,
    client: FinanceClient,
    finalization: boolean,
  ): Promise<AdmissionFinalFinanceResult> {
    if (!finance?.mode) {
      if (finance?.feePlanId) {
        throw this.error(
          finalization,
          "FEE_PLAN_NOT_COMPATIBLE",
          "A fee plan requires the FEE_PLAN finance mode.",
        );
      }
      return {
        policy: ADMISSION_FINANCE_POLICY,
        mode: "UNSPECIFIED",
        feePlanId: null,
        amount: null,
        currency: null,
        invoiceGeneration: "DEFERRED",
      };
    }
    if (finance.mode === "DEFERRED") {
      if (finance.feePlanId) {
        throw this.error(
          finalization,
          "FEE_PLAN_NOT_COMPATIBLE",
          "A deferred finance intent cannot reference a fee plan.",
        );
      }
      return {
        policy: ADMISSION_FINANCE_POLICY,
        mode: "DEFERRED",
        feePlanId: null,
        amount: null,
        currency: null,
        invoiceGeneration: "DEFERRED",
      };
    }
    if (!finance.feePlanId) {
      throw this.error(
        finalization,
        "FEE_PLAN_NOT_AVAILABLE",
        "A fee plan must be selected.",
      );
    }
    if (!academics?.schoolYearId || !academics.levelId) {
      throw this.error(
        finalization,
        "FINANCE_ACADEMIC_CONTEXT_REQUIRED",
        "Academic context is required before selecting a fee plan.",
      );
    }

    const plan = await client.feePlan.findFirst({
      where: { id: finance.feePlanId, tenantId },
      select: {
        id: true,
        schoolYearId: true,
        levelId: true,
        totalAmount: true,
        currency: true,
      },
    });
    if (!plan) {
      throw this.error(
        finalization,
        "FEE_PLAN_NOT_AVAILABLE",
        "Fee plan is not available.",
      );
    }
    if (
      plan.schoolYearId !== academics.schoolYearId ||
      plan.levelId !== academics.levelId
    ) {
      throw this.error(
        finalization,
        "FEE_PLAN_NOT_COMPATIBLE",
        "Fee plan is not compatible with the academic selection.",
      );
    }

    return {
      policy: ADMISSION_FINANCE_POLICY,
      mode: "FEE_PLAN",
      feePlanId: plan.id,
      amount: Number(plan.totalAmount.toString()),
      currency: plan.currency,
      invoiceGeneration: "DEFERRED",
    };
  }

  private error(
    finalization: boolean,
    code:
      | "FINANCE_ACADEMIC_CONTEXT_REQUIRED"
      | "FEE_PLAN_NOT_AVAILABLE"
      | "FEE_PLAN_NOT_COMPATIBLE",
    message: string,
  ): BadRequestException | ConflictException {
    const payload = { code, message };
    return finalization
      ? new ConflictException(payload)
      : new BadRequestException(payload);
  }

  private toPlan(row: {
    id: string;
    schoolYearId: string;
    levelId: string;
    label: string;
    totalAmount: Prisma.Decimal;
    currency: string;
  }): AdmissionFinancePlanOption {
    return {
      id: row.id,
      schoolYearId: row.schoolYearId,
      levelId: row.levelId,
      label: row.label,
      totalAmount: Number(row.totalAmount.toString()),
      currency: row.currency,
    };
  }
}
