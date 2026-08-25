import type { EnrollmentsApiClient } from "../types/enrollments";
import type {
  AdmissionAcademicOptions,
  AdmissionCase,
  AdmissionFinanceOptions,
  AdmissionPrerequisites
} from "../types/admission";

export const admissionPrerequisites: AdmissionPrerequisites = {
  contractVersion: "1",
  tenant: { id: "tenant-1", eligibilitySource: "AUTHENTICATED_ACTIVE_ACCOUNT" },
  supportedModes: ["NEW_ADMISSION", "RE_ENROLLMENT"],
  schoolYear: {
    id: "year-1",
    code: "2026-2027",
    label: "Année 2026-2027",
    startDate: "2026-09-01",
    endDate: "2027-06-30"
  },
  tracks: ["FRANCOPHONE"],
  levels: [],
  classes: [],
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
    canQuickCreateClass: false,
    canReadFeePlans: true,
    canCreateFeePlan: false,
    canCreateInvoice: false,
    modes: {
      NEW_ADMISSION: { allowed: true, missingPermissions: [] },
      RE_ENROLLMENT: { allowed: true, missingPermissions: [] }
    }
  },
  blockingIssues: [],
  warnings: [],
  ready: true
};

export const academicOptions: AdmissionAcademicOptions = {
  contractVersion: "1",
  selectionPolicy: {
    schoolYear: "SINGLE_ACTIVE",
    classCapacity: "INFORMATIONAL",
    automaticClassSelection: false,
    automaticStudentSelection: false
  },
  selected: {},
  schoolYears: [admissionPrerequisites.schoolYear!],
  tracks: ["FRANCOPHONE"],
  levels: [{
    id: "level-1",
    cycleId: "cycle-1",
    cycleCode: "PRIMAIRE",
    cycleLabel: "Primaire",
    code: "CM2",
    label: "CM2",
    track: "FRANCOPHONE",
    sortOrder: 1
  }],
  classes: [{
    id: "class-1",
    schoolYearId: "year-1",
    cycleId: "cycle-1",
    levelId: "level-1",
    code: "CM2-A",
    label: "CM2 A",
    track: "FRANCOPHONE",
    capacity: 30,
    actualCapacity: 30,
    currentEnrollmentCount: 29,
    placesRemaining: 1,
    capacityStatus: "AVAILABLE"
  }]
};

export const financeOptions: AdmissionFinanceOptions = {
  contractVersion: "1",
  admissionCaseId: "case-1",
  policy: "OPTIONAL",
  supportedModes: ["FEE_PLAN", "DEFERRED"],
  academicContext: {
    schoolYearId: "year-1",
    track: "FRANCOPHONE",
    cycleId: "cycle-1",
    levelId: "level-1",
    classId: "class-1"
  },
  plans: [{
    id: "plan-1",
    schoolYearId: "year-1",
    levelId: "level-1",
    label: "Plan CM2",
    totalAmount: 150000,
    currency: "XOF"
  }],
  selectedIntent: null,
  schedule: { supported: false },
  services: { supported: false },
  discounts: { supported: false },
  exemptions: { supported: false },
  capabilities: {
    canReadFeePlans: true,
    canSelectFeePlan: true,
    canDefer: true,
    canCreateInvoice: false,
    automaticInvoiceCreation: false
  },
  blockingIssues: [],
  warnings: []
};

export const makeAdmissionCase = (overrides: Partial<AdmissionCase> = {}): AdmissionCase => ({
  contractVersion: "1",
  payloadVersion: 1,
  id: "case-1",
  mode: "NEW_ADMISSION",
  status: "DRAFT",
  version: 1,
  studentId: null,
  schoolYearId: null,
  sections: { DOCUMENTS: null },
  completion: { STUDENT: false, GUARDIANS: false, ACADEMICS: false, FINANCE: false, DOCUMENTS: false },
  ready: false,
  blockingIssues: [],
  warnings: [],
  finalizationResult: null,
  confirmedAt: null,
  failedAt: null,
  failureCode: null,
  recoveryAction: null,
  cancelledAt: null,
  createdAt: "2026-08-23T08:00:00.000Z",
  updatedAt: "2026-08-23T08:00:00.000Z",
  ...overrides
});

type AdmissionApiOptions = {
  prerequisites?: AdmissionPrerequisites;
  initialCase?: AdmissionCase;
  failFinalizeCode?: string;
  conflictSection?: string;
};

export const createAdmissionApi = (options: AdmissionApiOptions = {}): {
  api: EnrollmentsApiClient;
  calls: Array<{ path: string; init?: RequestInit; body?: Record<string, unknown> }>;
  currentCase: () => AdmissionCase;
} => {
  let current = options.initialCase || makeAdmissionCase();
  const calls: Array<{ path: string; init?: RequestInit; body?: Record<string, unknown> }> = [];
  const response = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  const api: EnrollmentsApiClient = async (path, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    calls.push({ path, init, body });

    if (path === "/admission-prerequisites") return response(options.prerequisites || admissionPrerequisites);
    if (path.startsWith("/admission-cases?page=")) return response({ contractVersion: "1", items: [current], page: 1, pageSize: 25, total: 1, totalPages: 1 });
    if (path === "/admission-cases" && init?.method === "POST") {
      const mode = body?.mode === "RE_ENROLLMENT" ? "RE_ENROLLMENT" : "NEW_ADMISSION";
      current = makeAdmissionCase({
        mode,
        studentId: typeof body?.studentId === "string" ? body.studentId : null,
        completion: {
          STUDENT: mode === "RE_ENROLLMENT",
          GUARDIANS: mode === "RE_ENROLLMENT",
          ACADEMICS: false,
          FINANCE: false,
          DOCUMENTS: false
        }
      });
      return response(current, 201);
    }
    if (path === `/admission-cases/${current.id}`) return response(current);
    if (path.includes("/search/students")) return response({
      matchKind: "POSSIBLE_MATCH",
      code: "STUDENT_DUPLICATE_SUSPECTED",
      matches: [{
        id: "student-existing",
        matchKind: "POSSIBLE_MATCH",
        signals: ["NAME"],
        blocksCreation: false,
        matricule: "GS-001",
        firstName: "Awa",
        lastName: "Diallo",
        birthDate: "2015-04-10",
        status: "ACTIVE",
        phoneHint: null,
        emailHint: null
      }]
    });
    if (path.includes("/search/guardians")) return response({
      matchKind: "POSSIBLE_MATCH",
      code: "GUARDIAN_DUPLICATE_SUSPECTED",
      matches: [{
        id: "guardian-existing",
        matchKind: "POSSIBLE_MATCH",
        signals: ["NAME"],
        blocksCreation: false,
        firstName: "Mariam",
        lastName: "Diallo",
        parentalRole: "MERE",
        status: "ACTIVE",
        phoneHint: "***42",
        emailHint: "m***@example.test",
        identityDocumentType: null,
        identityDocumentHint: null
      }]
    });
    if (path.startsWith("/admission-cases/academic-options")) return response(academicOptions);
    if (path.startsWith("/admission-cases/finance-options")) return response({ ...financeOptions, admissionCaseId: current.id });
    if (path.endsWith("/cancel")) {
      current = { ...current, status: "CANCELLED", version: current.version + 1, cancelledAt: "2026-08-23T09:00:00.000Z" };
      return response(current);
    }
    if (path.endsWith("/reopen")) {
      current = { ...current, status: "READY", version: current.version + 1, failedAt: null, failureCode: null, recoveryAction: null };
      return response(current);
    }
    if (path.endsWith("/finalize")) {
      if (options.failFinalizeCode) {
        current = {
          ...current,
          status: "FAILED",
          version: current.version + 1,
          failedAt: "2026-08-23T09:00:00.000Z",
          failureCode: options.failFinalizeCode,
          recoveryAction: options.failFinalizeCode === "PLACEMENT_CONFLICT" ? "EDIT_AND_REVALIDATE" : "RETRY"
        };
        return response({ code: options.failFinalizeCode }, 409);
      }
      current = {
        ...current,
        status: "CONFIRMED",
        version: current.version + 1,
        confirmedAt: "2026-08-23T09:00:00.000Z",
        finalizationResult: {
          admissionCaseId: current.id,
          status: "CONFIRMED",
          studentId: "student-created",
          studentMatricule: "GS-2026-001",
          placementId: "placement-created",
          enrollmentId: "enrollment-created",
          guardianIds: ["guardian-created"],
          parentStudentLinkIds: ["link-created"],
          finance: { policy: "OPTIONAL", mode: "DEFERRED", feePlanId: null, amount: null, currency: null, invoiceGeneration: "DEFERRED" },
          invoiceIds: [],
          confirmedAt: "2026-08-23T09:00:00.000Z",
          version: current.version + 1
        }
      };
      return response({ ...current.finalizationResult }, 201);
    }
    const sectionMatch = path.match(/\/sections\/(STUDENT|GUARDIANS|ACADEMICS|FINANCE)$/u);
    if (sectionMatch) {
      const section = sectionMatch[1] as "STUDENT" | "GUARDIANS" | "ACADEMICS" | "FINANCE";
      if (options.conflictSection === section) return response({ code: "ADMISSION_VERSION_CONFLICT" }, 409);
      const data = (body?.data || {}) as Record<string, unknown>;
      const sections = { ...current.sections, [section]: data };
      const completion = { ...current.completion, [section]: true };
      const ready = completion.STUDENT && completion.GUARDIANS && completion.ACADEMICS && completion.FINANCE;
      current = { ...current, sections, completion, ready, status: ready ? "READY" : "DRAFT", version: current.version + 1 };
      return response(current);
    }
    return response({ code: "NOT_MOCKED" }, 500);
  };

  return { api, calls, currentCase: () => current };
};
