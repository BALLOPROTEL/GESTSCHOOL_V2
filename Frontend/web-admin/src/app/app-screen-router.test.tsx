import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Role, Session } from "../shared/types/app";
import { AppScreenRouter, type AppScreenRouterProps } from "./app-screen-router";
import { createEmptyAppDomainData, type AppDomainActions } from "./use-app-data";

vi.mock("./lazy-screens", () => {
  const marker = (name: string) => () => <div data-testid={`screen-${name}`}>{name}</div>;
  return {
    ActivityScreen: marker("activity"),
    BillingScreen: marker("billing"),
    ConstructionPageMosquee: marker("mosquee"),
    DashboardScreen: marker("dashboard"),
    EnrollmentsScreen: marker("enrollments"),
    FinanceScreen: marker("finance"),
    GradesScreen: marker("grades"),
    IamScreen: marker("iam"),
    MessagesScreen: marker("messages"),
    ParentsScreen: marker("parents"),
    PilotageScreen: marker("pilotage"),
    PortalParentScreen: marker("parent-portal"),
    PortalTeacherScreen: marker("teacher-portal"),
    PreferencesScreen: marker("preferences"),
    ProfileScreen: marker("profile"),
    ReferenceScreen: marker("reference"),
    ReportsScreen: marker("reports"),
    RoomsScreen: marker("rooms"),
    SchoolLifePanel: marker("school-life"),
    StudentPortalPlaceholderScreen: marker("student-portal"),
    StudentsScreen: marker("students"),
    TeachersScreen: marker("teachers")
  };
});

const makeSession = (role: Role): Session => ({
  accessToken: "a".repeat(40),
  refreshToken: "r".repeat(40),
  tenantId: "tenant-1",
  user: {
    username: `${role.toLowerCase()}@gestschool.local`,
    role,
    tenantId: "tenant-1"
  }
});

const actions: AppDomainActions = {
  applyPreviewData: vi.fn(),
  clearData: vi.fn(),
  setCurrentProfile: vi.fn(),
  setEnrollments: vi.fn(),
  setFinance: vi.fn(),
  setMosqueeDashboard: vi.fn(),
  setParentDirectory: vi.fn(),
  setParentPortal: vi.fn(),
  setReference: vi.fn(),
  setReportCards: vi.fn(),
  setStudents: vi.fn(),
  setTeacherPortal: vi.fn(),
  setUsers: vi.fn()
};

const propsFor = (
  role: Role,
  tab: AppScreenRouterProps["tab"]
): AppScreenRouterProps => ({
  activeScreenLabel: tab,
  api: vi.fn(async () => new Response(null, { status: 200 })),
  currentRole: role,
  currentRoleLabel: role,
  data: createEmptyAppDomainData(),
  dataActions: actions,
  fallbackAction: { id: "dashboard", onSelect: vi.fn() },
  formatMoney: (value) => `${value} F CFA`,
  loadEnrollments: vi.fn(async () => undefined),
  loadStudents: vi.fn(async () => undefined),
  locale: "fr-FR",
  mobileTasksOpen: false,
  onError: vi.fn(),
  onLogout: vi.fn(async () => undefined),
  onMobileTasksToggle: vi.fn(),
  onNotice: vi.fn(),
  onProfileChange: vi.fn(),
  onSelectLanguage: vi.fn(),
  onSelectScreen: vi.fn(),
  onSelectTheme: vi.fn(),
  remoteEnabled: true,
  session: makeSession(role),
  tab,
  themeMode: "light",
  uiLanguage: "fr"
});

afterEach(cleanup);

describe("AppScreenRouter", () => {
  it.each([
    ["ADMIN", "dashboard", "dashboard"],
    ["SCOLARITE", "teachers", "teachers"],
    ["SCOLARITE", "schoolLifeAttendance", "school-life"],
    ["COMPTABLE", "finance", "finance"],
    ["ADMIN", "reports", "reports"],
    ["ADMIN", "profile", "profile"],
    ["ENSEIGNANT", "teacherPortal", "teacher-portal"],
    ["PARENT", "parentPortal", "parent-portal"]
  ] as const)("rend la destination %s/%s autorisée", (role, tab, marker) => {
    render(<AppScreenRouter {...propsFor(role, tab)} />);
    expect(screen.getByTestId(`screen-${marker}`)).toBeInTheDocument();
  });

  it("refuse une route hors du périmètre du rôle", () => {
    render(<AppScreenRouter {...propsFor("COMPTABLE", "students")} />);

    expect(screen.getByRole("heading", { name: "Acces refuse" })).toBeInTheDocument();
    expect(screen.queryByTestId("screen-students")).not.toBeInTheDocument();
  });

  it("bloque une fonctionnalité désactivée avant de charger son écran", () => {
    render(<AppScreenRouter {...propsFor("STUDENT", "studentPortal")} />);

    expect(screen.getByRole("status")).toHaveTextContent("Fonctionnalité désactivée");
    expect(screen.queryByTestId("screen-student-portal")).not.toBeInTheDocument();
  });
});
