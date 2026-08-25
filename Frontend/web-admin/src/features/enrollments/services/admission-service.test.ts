import { describe, expect, it, vi } from "vitest";

import { makeAdmissionCase } from "../admission/admission-test-fixtures";
import {
  AdmissionApiError,
  cancelAdmissionCase,
  createAdmissionCase,
  finalizeAdmissionCase,
  getAdmissionAcademicOptions,
  getAdmissionCase,
  getAdmissionFinanceOptions,
  getAdmissionPrerequisites,
  listAdmissionCases,
  reopenAdmissionCase,
  saveAdmissionSection,
  searchAdmissionGuardians,
  searchAdmissionStudents
} from "./admission-service";

const ok = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 });

describe("admission service", () => {
  it("encapsule les endpoints de prérequis, création, liste et lecture", async () => {
    const admissionCase = makeAdmissionCase();
    const api = vi.fn(async (_path: string, _init?: RequestInit) => ok(admissionCase));

    await getAdmissionPrerequisites(api);
    await createAdmissionCase(api, "RE_ENROLLMENT", "student-1");
    await listAdmissionCases(api, 2, 10);
    await getAdmissionCase(api, admissionCase.id);

    expect(api.mock.calls.map(([path]) => path)).toEqual([
      "/admission-prerequisites",
      "/admission-cases",
      "/admission-cases?page=2&limit=10",
      "/admission-cases/case-1"
    ]);
    expect(JSON.parse(String(api.mock.calls[1]?.[1]?.body))).toEqual({ mode: "RE_ENROLLMENT", studentId: "student-1" });
  });

  it("envoie expectedVersion et une clé stable aux mutations", async () => {
    const admissionCase = makeAdmissionCase({ version: 7 });
    const api = vi.fn(async (_path: string, _init?: RequestInit) => ok(admissionCase));

    await saveAdmissionSection(api, admissionCase, "STUDENT", { firstName: "Awa" });
    await cancelAdmissionCase(api, admissionCase);
    await reopenAdmissionCase(api, admissionCase);
    await finalizeAdmissionCase(api, admissionCase, "admission-finalize:case-1");

    expect(api.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { expectedVersion: 7, data: { firstName: "Awa" } },
      { expectedVersion: 7 },
      { expectedVersion: 7 },
      { expectedVersion: 7, idempotencyKey: "admission-finalize:case-1" }
    ]);
  });

  it("encode les recherches et options sans charger les référentiels globaux", async () => {
    const api = vi.fn(async (_path: string, _init?: RequestInit) => ok({ matches: [] }));

    await searchAdmissionStudents(api, { lastName: "Di allo", limit: 10 });
    await searchAdmissionGuardians(api, { email: "mariam@example.test" });
    await getAdmissionAcademicOptions(api, { schoolYearId: "year-1", track: "FRANCOPHONE" });
    await getAdmissionFinanceOptions(api, "case-1");

    expect(api.mock.calls.map(([path]) => path)).toEqual([
      "/admission-cases/search/students?lastName=Di+allo&limit=10",
      "/admission-cases/search/guardians?email=mariam%40example.test",
      "/admission-cases/academic-options?schoolYearId=year-1&track=FRANCOPHONE",
      "/admission-cases/finance-options?admissionCaseId=case-1"
    ]);
  });

  it("préserve le code d'erreur backend stable sans exposer son message", async () => {
    const api = vi.fn(async (_path: string, _init?: RequestInit) => new Response(JSON.stringify({ code: "ADMISSION_VERSION_CONFLICT", message: "technical detail" }), { status: 409 }));

    await expect(getAdmissionCase(api, "case-1")).rejects.toEqual(
      expect.objectContaining<Partial<AdmissionApiError>>({ code: "ADMISSION_VERSION_CONFLICT", status: 409 })
    );
  });
});
