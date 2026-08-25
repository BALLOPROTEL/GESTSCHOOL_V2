import type { JSX } from "react";

import type {
  Role,
  ScreenId,
  Session,
  ThemeMode,
  UserSelfProfile
} from "../shared/types/app";
import type { UiLanguage } from "../shared/i18n";
import { useI18n } from "../shared/i18n-context";
import {
  ActivityScreen,
  BillingScreen,
  ConstructionPageMosquee,
  DashboardScreen,
  EnrollmentsScreen,
  FinanceScreen,
  GradesScreen,
  IamScreen,
  MessagesScreen,
  ParentsScreen,
  PilotageScreen,
  PortalParentScreen,
  PortalTeacherScreen,
  PreferencesScreen,
  ProfileScreen,
  ReferenceScreen,
  ReportsScreen,
  RoomsScreen,
  SchoolLifePanel,
  StudentPortalPlaceholderScreen,
  StudentsScreen,
  TeachersScreen
} from "./lazy-screens";
import { DEFAULT_CURRENCY, SCHOOL_NAME } from "./app-config";
import type { AppApiClient } from "./app-data-loaders";
import type { AppDomainActions, AppDomainData } from "./use-app-data";
import { FeatureUnavailableScreen } from "./app-shell-panels";
import { getScreenAccessDecision, hasScreenAccess } from "./navigation/screen-registry";

type AvailableScreenAction = {
  id: string;
  onSelect: () => void;
};

export type AppScreenRouterProps = {
  activeScreenLabel: string;
  api: AppApiClient;
  currentRole: Role | null;
  currentRoleLabel: string;
  data: AppDomainData;
  dataActions: AppDomainActions;
  fallbackAction: AvailableScreenAction;
  formatMoney: (value: number, currency?: string) => string;
  loadEnrollments: () => Promise<void>;
  loadStudents: () => Promise<void>;
  locale: string;
  mobileTasksOpen: boolean;
  onError: (message: string | null) => void;
  onLogout: () => Promise<void>;
  onMobileTasksToggle: () => void;
  onNotice: (message: string | null) => void;
  onProfileChange: (profile: UserSelfProfile) => void;
  onSelectLanguage: (language: UiLanguage) => void;
  onSelectScreen: (screen: ScreenId) => void;
  onSelectTheme: (theme: ThemeMode) => void;
  remoteEnabled: boolean;
  session: Session | null;
  tab: ScreenId;
  themeMode: ThemeMode;
  uiLanguage: UiLanguage;
};

const ForbiddenScreen = ({ currentRoleLabel }: { currentRoleLabel: string }): JSX.Element => {
  const { t } = useI18n();
  return (
    <section className="panel table-panel">
      <h2>{t("Acces refuse")}</h2>
      <p className="subtle">{t(`Votre profil (${currentRoleLabel}) n'a pas acces a cet ecran.`)}</p>
    </section>
  );
};

export function AppScreenRouter({
  activeScreenLabel,
  api,
  currentRole,
  currentRoleLabel,
  data,
  dataActions,
  fallbackAction,
  formatMoney,
  loadEnrollments,
  loadStudents,
  locale,
  mobileTasksOpen,
  onError,
  onLogout,
  onMobileTasksToggle,
  onNotice,
  onProfileChange,
  onSelectLanguage,
  onSelectScreen,
  onSelectTheme,
  remoteEnabled,
  session,
  tab,
  themeMode,
  uiLanguage
}: AppScreenRouterProps): JSX.Element {
  const accessDecision = getScreenAccessDecision(currentRole, tab);
  if (accessDecision === "feature-disabled") {
    return (
      <FeatureUnavailableScreen
        actionLabel={fallbackAction.id === "profile" ? "Ouvrir mon profil" : "Retour tableau de bord"}
        featureLabel={activeScreenLabel}
        onBackToAvailableScreen={fallbackAction.onSelect}
      />
    );
  }
  if (accessDecision !== "allowed") {
    return <ForbiddenScreen currentRoleLabel={currentRoleLabel} />;
  }

  const { finance, parentDirectory, parentPortal, reference, teacherPortal } = data;
  const sharedScreenCallbacks = { onError, onNotice };
  const renderDashboard = (): JSX.Element => (
    <DashboardScreen
      currentRole={currentRole}
      invoices={finance.invoices}
      classesCount={reference.classes.length}
      reportCards={data.reportCards}
      recovery={finance.recovery}
      students={data.students}
      enrollments={data.enrollments}
      MosqueeDashboard={data.mosqueeDashboard}
      parentOverview={parentPortal.overview}
      parentChildren={parentPortal.children}
      parentInvoices={parentPortal.invoices}
      parentNotifications={parentPortal.notifications}
      teacherOverview={teacherPortal.overview}
      teacherClasses={teacherPortal.classes}
      teacherStudentsCount={teacherPortal.students.length}
      teacherGradesCount={teacherPortal.grades.length}
      teacherNotifications={teacherPortal.notifications}
      language={uiLanguage}
      mobileTasksOpen={mobileTasksOpen}
      onSelectScreen={onSelectScreen}
      onToggleMobileTasks={onMobileTasksToggle}
      formatMoney={formatMoney}
      hasScreenAccess={hasScreenAccess}
    />
  );

  switch (tab) {
    case "dashboard":
      return renderDashboard();
    case "iam":
      return (
        <IamScreen
          api={api}
          initialUsers={data.users}
          students={data.students}
          remoteEnabled={remoteEnabled}
          locale={locale}
          language={uiLanguage}
          {...sharedScreenCallbacks}
          onUsersChange={dataActions.setUsers}
        />
      );
    case "teachers":
      return (
        <TeachersScreen
          api={api}
          classes={reference.classes}
          cycles={reference.cycles}
          levels={reference.levels}
          periods={reference.periods}
          schoolYears={reference.schoolYears}
          subjects={reference.subjects}
          users={data.users}
          language={uiLanguage}
          remoteEnabled={remoteEnabled}
          {...sharedScreenCallbacks}
        />
      );
    case "rooms":
      return (
        <RoomsScreen
          api={api}
          classes={reference.classes}
          cycles={reference.cycles}
          levels={reference.levels}
          periods={reference.periods}
          schoolYears={reference.schoolYears}
          subjects={reference.subjects}
          remoteEnabled={remoteEnabled}
          {...sharedScreenCallbacks}
        />
      );
    case "students":
      return (
        <StudentsScreen
          api={api}
          initialStudents={data.students}
          remoteEnabled={remoteEnabled}
          onStudentsChange={dataActions.setStudents}
          onReloadEnrollments={loadEnrollments}
          {...sharedScreenCallbacks}
        />
      );
    case "parents":
      return (
        <ParentsScreen
          api={api}
          initialParents={parentDirectory.records}
          initialRelations={parentDirectory.relations}
          remoteEnabled={remoteEnabled}
          students={data.students}
          users={data.users}
          onParentsChanged={loadStudents}
          {...sharedScreenCallbacks}
        />
      );
    case "reference":
      return (
        <ReferenceScreen
          api={api}
          data={reference}
          schoolName={SCHOOL_NAME}
          remoteEnabled={remoteEnabled}
          onDataChange={dataActions.setReference}
          onReloadEnrollments={loadEnrollments}
          {...sharedScreenCallbacks}
        />
      );
    case "enrollments":
      return (
        <EnrollmentsScreen
          api={api}
          initialEnrollments={data.enrollments}
          schoolYears={reference.schoolYears}
          classes={reference.classes}
          students={data.students}
          remoteEnabled={remoteEnabled}
          language={uiLanguage}
          locale={locale}
          currentRole={currentRole}
          onEnrollmentsChange={dataActions.setEnrollments}
          {...sharedScreenCallbacks}
        />
      );
    case "finance":
      return (
        <FinanceScreen
          api={api}
          initialData={finance}
          schoolYears={reference.schoolYears}
          levels={reference.levels}
          students={data.students}
          locale={locale}
          defaultCurrency={DEFAULT_CURRENCY}
          remoteEnabled={remoteEnabled}
          onFinanceDataChange={dataActions.setFinance}
          {...sharedScreenCallbacks}
        />
      );
    case "profile":
      return session ? (
        <ProfileScreen
          api={api}
          currentRoleLabel={currentRoleLabel}
          locale={locale}
          onLanguageChange={onSelectLanguage}
          onLogoutAllDevices={onLogout}
          onProfileChange={onProfileChange}
          onThemeChange={onSelectTheme}
          remoteEnabled={remoteEnabled}
          schoolName={SCHOOL_NAME}
          schoolYears={reference.schoolYears}
          session={session}
          themeMode={themeMode}
          uiLanguage={uiLanguage}
          users={data.users}
          {...sharedScreenCallbacks}
        />
      ) : (
        <ForbiddenScreen currentRoleLabel={currentRoleLabel} />
      );
    case "preferences":
      return session ? (
        <PreferencesScreen
          api={api}
          onLanguageChange={onSelectLanguage}
          onThemeChange={onSelectTheme}
          remoteEnabled={remoteEnabled}
          schoolName={SCHOOL_NAME}
          schoolYears={reference.schoolYears}
          session={session}
          themeMode={themeMode}
          uiLanguage={uiLanguage}
          users={data.users}
          {...sharedScreenCallbacks}
        />
      ) : (
        <ForbiddenScreen currentRoleLabel={currentRoleLabel} />
      );
    case "activity":
      return session ? (
        <ActivityScreen
          api={api}
          remoteEnabled={remoteEnabled}
          schoolName={SCHOOL_NAME}
          schoolYears={reference.schoolYears}
          session={session}
          uiLanguage={uiLanguage}
          users={data.users}
          {...sharedScreenCallbacks}
        />
      ) : (
        <ForbiddenScreen currentRoleLabel={currentRoleLabel} />
      );
    case "billing":
      return session ? (
        <BillingScreen
          api={api}
          remoteEnabled={remoteEnabled}
          schoolName={SCHOOL_NAME}
          schoolYears={reference.schoolYears}
          session={session}
          uiLanguage={uiLanguage}
          users={data.users}
          {...sharedScreenCallbacks}
        />
      ) : (
        <ForbiddenScreen currentRoleLabel={currentRoleLabel} />
      );
    case "messages":
      return <MessagesScreen currentRoleLabel={currentRoleLabel} onSelectScreen={onSelectScreen} />;
    case "reports":
      return (
        <ReportsScreen
          api={api}
          schoolYears={reference.schoolYears}
          users={data.users}
          locale={locale}
          remoteEnabled={remoteEnabled}
          formatMoney={formatMoney}
          {...sharedScreenCallbacks}
        />
      );
    case "mosquee":
      return <ConstructionPageMosquee />;
    case "grades":
      return (
        <GradesScreen
          api={api}
          initialReportCards={data.reportCards}
          classes={reference.classes}
          students={data.students}
          subjects={reference.subjects}
          periods={reference.periods}
          schoolYears={reference.schoolYears}
          remoteEnabled={remoteEnabled}
          onReportCardsChange={dataActions.setReportCards}
          {...sharedScreenCallbacks}
        />
      );
    case "schoolLifeOverview":
      return (
        <PilotageScreen
          api={api}
          students={data.students}
          enrollments={data.enrollments}
          classes={reference.classes}
          levels={reference.levels}
          schoolYears={reference.schoolYears}
          periods={reference.periods}
          invoices={finance.invoices}
          recovery={finance.recovery}
          reportCards={data.reportCards}
          locale={locale}
          remoteEnabled={remoteEnabled}
          formatMoney={formatMoney}
          onSelectScreen={onSelectScreen}
        />
      );
    case "schoolLifeAttendance":
    case "schoolLifeTimetable":
    case "schoolLifeNotifications": {
      const focusSection =
        tab === "schoolLifeAttendance"
          ? "attendance"
          : tab === "schoolLifeTimetable"
            ? "timetable"
            : "notifications";
      return (
        <SchoolLifePanel
          api={api}
          students={data.students}
          classes={reference.classes}
          subjects={reference.subjects}
          locale={locale}
          focusSection={focusSection}
          readOnly={
            tab === "schoolLifeAttendance"
              ? !currentRole || currentRole === "PARENT"
              : currentRole === "PARENT"
          }
          {...sharedScreenCallbacks}
        />
      );
    }
    case "teacherPortal":
      return (
        <PortalTeacherScreen
          api={api}
          initialData={teacherPortal}
          subjects={reference.subjects}
          periods={reference.periods}
          locale={locale}
          remoteEnabled={remoteEnabled}
          onDataChange={dataActions.setTeacherPortal}
          {...sharedScreenCallbacks}
        />
      );
    case "parentPortal":
      return (
        <PortalParentScreen
          api={api}
          initialData={parentPortal}
          locale={locale}
          defaultCurrency={DEFAULT_CURRENCY}
          remoteEnabled={remoteEnabled}
          onDataChange={dataActions.setParentPortal}
          onError={onError}
        />
      );
    case "studentPortal":
      return <StudentPortalPlaceholderScreen />;
    default:
      return renderDashboard();
  }
}
