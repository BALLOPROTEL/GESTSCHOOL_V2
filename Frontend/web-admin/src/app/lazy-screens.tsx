import { lazy } from "react";
import { useI18n } from "../shared/i18n-context";

export const AuthScreen = lazy(() =>
  import("../features/auth-screen").then((module) => ({ default: module.AuthScreen }))
);
export const DashboardScreen = lazy(() =>
  import("../features/dashboard-screen").then((module) => ({ default: module.DashboardScreen }))
);
export const MessagesScreen = lazy(() =>
  import("../features/messages-screen").then((module) => ({ default: module.MessagesScreen }))
);
export const ParentsScreen = lazy(() =>
  import("../features/parents-screen").then((module) => ({ default: module.ParentsScreen }))
);
export const StudentPortalPlaceholderScreen = lazy(() =>
  import("../features/student-portal-placeholder-screen").then((module) => ({
    default: module.StudentPortalPlaceholderScreen
  }))
);
export const StudentsScreen = lazy(() =>
  import("../features/students/students-screen").then((module) => ({ default: module.StudentsScreen }))
);
export const TeachersScreen = lazy(() =>
  import("../features/teachers-screen").then((module) => ({ default: module.TeachersScreen }))
);
export const RoomsScreen = lazy(() =>
  import("../features/rooms-screen").then((module) => ({ default: module.RoomsScreen }))
);
export const IamScreen = lazy(() =>
  import("../features/iam/iam-screen").then((module) => ({ default: module.IamScreen }))
);
export const ReportsScreen = lazy(() =>
  import("../features/reports/reports-screen").then((module) => ({ default: module.ReportsScreen }))
);
export const EnrollmentsScreen = lazy(() =>
  import("../features/enrollments/enrollments-screen").then((module) => ({
    default: module.EnrollmentsScreen
  }))
);
export const FinanceScreen = lazy(() =>
  import("../features/finance/finance-screen").then((module) => ({ default: module.FinanceScreen }))
);
export const ProfileScreen = lazy(() =>
  import("../features/profile/profile-screen").then((module) => ({ default: module.ProfileScreen }))
);
export const PilotageScreen = lazy(() =>
  import("../features/pilotage/pilotage-screen").then((module) => ({ default: module.PilotageScreen }))
);
export const PreferencesScreen = lazy(() =>
  import("../features/profile/account-destination-screens").then((module) => ({
    default: module.PreferencesScreen
  }))
);
export const ActivityScreen = lazy(() =>
  import("../features/profile/account-destination-screens").then((module) => ({
    default: module.ActivityScreen
  }))
);
export const BillingScreen = lazy(() =>
  import("../features/profile/account-destination-screens").then((module) => ({
    default: module.BillingScreen
  }))
);
export const GradesScreen = lazy(() =>
  import("../features/grades/grades-screen").then((module) => ({ default: module.GradesScreen }))
);
export const PortalTeacherScreen = lazy(() =>
  import("../features/portal/portal-teacher-screen").then((module) => ({
    default: module.PortalTeacherScreen
  }))
);
export const PortalParentScreen = lazy(() =>
  import("../features/portal/portal-parent-screen").then((module) => ({
    default: module.PortalParentScreen
  }))
);
export const ReferenceScreen = lazy(() =>
  import("../features/reference/reference-screen").then((module) => ({ default: module.ReferenceScreen }))
);
export const SchoolLifePanel = lazy(() =>
  import("../features/school-life/school-life-panel").then((module) => ({
    default: module.SchoolLifePanel
  }))
);
export const ConstructionPageMosquee = lazy(() =>
  import("../features/mosquee/construction-page").then((module) => ({
    default: module.ConstructionPageMosquee
  }))
);

export const ScreenLoadingFallback = (): JSX.Element => {
  const { t } = useI18n();
  return (
    <section className="panel table-panel screen-loading" aria-live="polite">
      <span className="mini-loader" />
      <div>
        <strong>{t("Chargement du module")}</strong>
        <p className="subtle">{t("Preparation de l'ecran demande...")}</p>
      </div>
    </section>
  );
};
