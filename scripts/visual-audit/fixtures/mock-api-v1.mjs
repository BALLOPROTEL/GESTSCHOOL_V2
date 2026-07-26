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

/** @type {MockRoute[]} */
export const mockApiV1Routes = [
  { method: "GET", path: "/api/v1/health/live", body: { status: "ok" } },
  { method: "GET", path: "/api/v1/attendance", body: [] },
  { method: "GET", path: "/api/v1/notifications", body: [] },
  { method: "GET", path: "/api/v1/rooms", body: [] },
  { method: "GET", path: "/api/v1/teachers/assignments", body: [] },
  { method: "GET", path: "/api/v1/timetable-slots", body: [] },
  { method: "GET", path: "/api/v1/timetable-slots/grid", body: { days: [] } },
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
