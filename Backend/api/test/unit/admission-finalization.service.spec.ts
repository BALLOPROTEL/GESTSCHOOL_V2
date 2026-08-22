import {
  AdmissionCaseMode,
  AdmissionCaseStatus,
  type Prisma,
} from "@prisma/client";

import { AdmissionFinalizationService } from "../../src/admissions/admission-finalization.service";
import {
  ADMISSION_FINALIZATION_RESULT_VERSION,
  type AdmissionFinalizationResult,
} from "../../src/admissions/admission-cases.types";
import { UserRole } from "../../src/security/roles.enum";

const result: AdmissionFinalizationResult = {
  contractVersion: ADMISSION_FINALIZATION_RESULT_VERSION,
  admissionCaseId: "10000000-0000-4000-8000-000000000001",
  status: "CONFIRMED",
  studentId: "10000000-0000-4000-8000-000000000002",
  studentMatricule: "GST-2026-000001",
  placementId: "10000000-0000-4000-8000-000000000003",
  enrollmentId: "10000000-0000-4000-8000-000000000004",
  guardianIds: [],
  parentStudentLinkIds: [],
  invoiceIds: [],
  confirmedAt: "2026-08-22T12:00:00.000Z",
  version: 3,
};

type TestFinalizationRow = {
  id: string;
  tenantId: string;
  mode: AdmissionCaseMode;
  status: AdmissionCaseStatus;
  version: number;
  payloadVersion: number;
  draftData: Prisma.JsonValue;
  studentId: string | null;
  finalizationIdempotencyKey: string | null;
  finalizationPayloadHash: string | null;
  finalizationResult: Prisma.JsonValue | null;
  finalizationLeaseToken: string | null;
  finalizationLeaseExpiresAt: Date | null;
};

const baseRow: TestFinalizationRow = {
  id: result.admissionCaseId,
  tenantId: "00000000-0000-4000-8000-000000000001",
  mode: AdmissionCaseMode.NEW_ADMISSION,
  status: AdmissionCaseStatus.CONFIRMED,
  version: 3,
  payloadVersion: 1,
  draftData: {
    STUDENT: {
      matricule: "UNIT-001",
      firstName: "Unit",
      lastName: "Test",
      sex: "F",
    },
    ACADEMICS: { schoolYearId: "year", classId: "class" },
  } as Prisma.JsonValue,
  studentId: null,
  finalizationIdempotencyKey: "unit-idempotency-key",
  finalizationPayloadHash: "",
  finalizationResult: result as unknown as Prisma.JsonValue,
  finalizationLeaseToken: null,
  finalizationLeaseExpiresAt: null,
};

type FinalizationInternals = {
  hashLogicalPayload(row: TestFinalizationRow): string;
};

function createService(row: TestFinalizationRow) {
  const transaction = {
    admissionCase: {
      findFirst: jest.fn().mockResolvedValue(row),
    },
  };
  const prisma = {
    admissionCase: {
      findFirst: jest.fn().mockResolvedValue({ mode: row.mode }),
    },
    $transaction: jest.fn(
      async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    ),
  };
  const prerequisites = {
    getPrerequisites: jest.fn().mockResolvedValue({
      permissions: {
        modes: {
          NEW_ADMISSION: { allowed: true },
          RE_ENROLLMENT: { allowed: true },
        },
      },
    }),
  };
  return new AdmissionFinalizationService(
    prisma as never,
    {} as never,
    prerequisites as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe("AdmissionFinalizationService", () => {
  it("hashes logical JSON canonically and changes the hash when the payload changes", () => {
    const service = createService(baseRow);
    const internals = service as unknown as FinalizationInternals;
    const first = internals.hashLogicalPayload(baseRow);
    const reordered = internals.hashLogicalPayload({
      ...baseRow,
      draftData: {
        ACADEMICS: { classId: "class", schoolYearId: "year" },
        STUDENT: {
          sex: "F",
          lastName: "Test",
          firstName: "Unit",
          matricule: "UNIT-001",
        },
      },
    });
    const changed = internals.hashLogicalPayload({
      ...baseRow,
      draftData: {
        ...(baseRow.draftData as Prisma.JsonObject),
        STUDENT: {
          matricule: "UNIT-002",
          firstName: "Unit",
          lastName: "Test",
          sex: "F",
        },
      },
    });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(reordered).toBe(first);
    expect(changed).not.toBe(first);
  });

  it("returns the exact persisted result for a confirmed idempotent retry", async () => {
    const initial = createService(baseRow);
    const hash = (
      initial as unknown as FinalizationInternals
    ).hashLogicalPayload(baseRow);
    const service = createService({
      ...baseRow,
      finalizationPayloadHash: hash,
    });

    await expect(
      service.finalize(
        baseRow.tenantId,
        { id: "actor", role: UserRole.ADMIN },
        baseRow.id,
        { expectedVersion: 1, idempotencyKey: "unit-idempotency-key" },
      ),
    ).resolves.toEqual(result);
  });

  it("rejects a contradictory key after confirmation without domain writes", async () => {
    const initial = createService(baseRow);
    const hash = (
      initial as unknown as FinalizationInternals
    ).hashLogicalPayload(baseRow);
    const service = createService({
      ...baseRow,
      finalizationPayloadHash: hash,
    });

    await expect(
      service.finalize(
        baseRow.tenantId,
        { id: "actor", role: UserRole.ADMIN },
        baseRow.id,
        { expectedVersion: 3, idempotencyKey: "contradictory-key" },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("refuses finalization while the draft is not READY", async () => {
    const service = createService({
      ...baseRow,
      status: AdmissionCaseStatus.DRAFT,
      finalizationIdempotencyKey: null,
      finalizationPayloadHash: null,
      finalizationResult: null,
    });

    await expect(
      service.finalize(
        baseRow.tenantId,
        { id: "actor", role: UserRole.ADMIN },
        baseRow.id,
        { expectedVersion: 3, idempotencyKey: "draft-finalize-key" },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
