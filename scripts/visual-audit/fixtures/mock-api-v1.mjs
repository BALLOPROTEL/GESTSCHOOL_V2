// @ts-check

/** @typedef {import('../lib/audit-guard.mjs').MockRoute} MockRoute */

export const MOCK_FIXTURE_VERSION = "gestschool-visual-v1";
export const MOCK_TENANT_ID = "00000000-0000-4000-8000-000000000001";

const previewSession = {
  accessToken: "__preview__",
  refreshToken: "__preview__",
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    username: "visual.admin",
    displayName: "Administrateur visuel",
    email: "visual.admin@example.test",
    role: "ADMIN",
    status: "ACTIVE",
    tenantId: MOCK_TENANT_ID
  }
};

const visualAdmissionCase = {
  contractVersion: "1",
  payloadVersion: 1,
  id: "77777777-7777-4777-8777-777777777777",
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
  updatedAt: "2026-08-23T08:00:00.000Z"
};

const visualAdmissionPrerequisites = {
  contractVersion: "1",
  tenant: { id: MOCK_TENANT_ID, eligibilitySource: "AUTHENTICATED_ACTIVE_ACCOUNT" },
  supportedModes: ["NEW_ADMISSION", "RE_ENROLLMENT"],
  schoolYear: { id: "year-visual", code: "2026-2027", label: "Année 2026-2027", startDate: "2026-09-01", endDate: "2027-06-30" },
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

/** @type {MockRoute[]} */
export const mockApiV1Routes = [
  { method: "GET", path: "/api/v1/health/live", body: { status: "ok" } },
  { method: "GET", path: "/api/v1/attendance", body: [] },
  { method: "GET", path: "/api/v1/notifications", body: [] },
  { method: "GET", path: "/api/v1/rooms", body: [] },
  { method: "GET", path: "/api/v1/teachers/assignments", body: [] },
  { method: "GET", path: "/api/v1/timetable-slots", body: [] },
  { method: "GET", path: "/api/v1/timetable-slots/grid", body: { days: [] } },
  {
    method: "GET",
    path: "/api/v1/admission-cases?page=1&limit=25",
    body: { contractVersion: "1", items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 }
  },
  { method: "GET", path: "/api/v1/admission-prerequisites", body: visualAdmissionPrerequisites },
  { method: "POST", path: "/api/v1/admission-cases", status: 201, body: visualAdmissionCase },
  {
    method: "GET",
    path: `/api/v1/admission-cases/${visualAdmissionCase.id}`,
    body: visualAdmissionCase
  },
  { method: "POST", path: "/api/v1/auth/login", body: previewSession },
  {
    method: "POST",
    path: "/api/v1/auth/forgot-password",
    body: { message: "Instructions de reinitialisation envoyees." }
  },
  {
    method: "POST",
    path: "/api/v1/auth/resend-activation",
    body: { message: "Instructions d'activation envoyees." }
  },
  {
    method: "POST",
    path: "/api/v1/auth/activate",
    body: { message: "Compte active." }
  },
  {
    method: "POST",
    path: "/api/v1/auth/reset-password",
    body: { message: "Mot de passe reinitialise." }
  }
];
