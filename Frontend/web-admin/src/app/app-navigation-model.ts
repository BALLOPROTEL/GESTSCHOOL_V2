import type {
  Role,
  ScreenId,
  Session,
  ThemeMode,
  UserAccount,
  UserSelfProfile
} from "../shared/types/app";
import {
  UI_LANGUAGE_META,
  UI_LANGUAGE_ORDER,
  type UiLanguage,
  type UiLanguageMeta
} from "../shared/i18n";
import {
  formatAccountStatusLabel,
  getInitials
} from "./app-formatters";
import type {
  HeaderNavigationAction,
  HeaderNavigationGroup,
  HeaderPreferenceAction,
  HeaderUserAction
} from "./navigation/header-navigation";
import {
  ROLE_CONTEXT_LABELS,
  ROLE_HOME_SCREEN,
  SCREEN_DEFS,
  hasScreenRoleAccess
} from "./navigation/screen-registry";
import {
  FEATURE_FLAGS,
  isScreenFeatureEnabled,
  type FeatureFlags
} from "../shared/config/feature-flags";

type NavigationModelInput = {
  currentLanguageMeta: UiLanguageMeta;
  currentRole: Role | null;
  moduleQueryInput: string;
  selectLanguage: (language: UiLanguage) => void;
  selectScreen: (screen: ScreenId) => void;
  tab: ScreenId;
  themeMode: ThemeMode;
  toggleThemeMode: () => void;
  uiLanguage: UiLanguage;
  featureFlags?: FeatureFlags;
};

export function createAppNavigationModel(input: NavigationModelInput) {
  const {
    currentLanguageMeta,
    currentRole,
    moduleQueryInput,
    selectLanguage,
    selectScreen,
    tab,
    themeMode,
    toggleThemeMode,
    uiLanguage,
    featureFlags = FEATURE_FLAGS
  } = input;
  const screenEnabled = (screen: ScreenId): boolean =>
    isScreenFeatureEnabled(screen, featureFlags);
  const canAccess = (role: Role, screen: ScreenId): boolean =>
    screenEnabled(screen) && hasScreenRoleAccess(role, screen);
  const activeScreen = SCREEN_DEFS.find((entry) => entry.id === tab) ?? SCREEN_DEFS[0];
  const roleHomeTarget = currentRole ? ROLE_HOME_SCREEN[currentRole] || "dashboard" : "dashboard";
  const dashboardTarget: ScreenId =
    currentRole && canAccess(currentRole, "dashboard")
      ? "dashboard"
      : currentRole && canAccess(currentRole, roleHomeTarget)
        ? roleHomeTarget
        : currentRole && canAccess(currentRole, "profile")
          ? "profile"
          : "dashboard";

  const buildAction = (screen: ScreenId, label: string): HeaderNavigationAction => {
    const allowed = currentRole ? canAccess(currentRole, screen) : false;
    return {
      id: screen,
      label,
      active: tab === screen,
      disabled: !allowed,
      helperText: allowed ? undefined : "Accès restreint",
      onSelect: () => {
        if (allowed) selectScreen(screen);
      }
    };
  };

  const dashboardAction: HeaderNavigationAction = {
    id: dashboardTarget,
    label: "Tableau de bord",
    active: tab === dashboardTarget,
    disabled: !currentRole,
    onSelect: () => selectScreen(dashboardTarget)
  };
  const scolariteActions = [
    buildAction("enrollments", "Inscriptions"),
    buildAction("iam", "Utilisateurs & droits"),
    buildAction("teachers", "Enseignants"),
    buildAction("rooms", "Salles"),
    buildAction("students", "Élèves"),
    buildAction("parents", "Parents"),
    buildAction("finance", "Comptabilité")
  ].filter((item) => screenEnabled(item.id as ScreenId));
  const schoolLifeActions = [
    buildAction("grades", "Notes & bulletins"),
    buildAction("schoolLifeOverview", "Pilotage"),
    buildAction("schoolLifeAttendance", "Absences"),
    buildAction("schoolLifeTimetable", "Emploi du temps"),
    buildAction("schoolLifeNotifications", "Notifications")
  ].filter((item) => screenEnabled(item.id as ScreenId));
  const settingsActions = [
    buildAction("reference", "Référentiel"),
    buildAction("reports", "Rapports & conformité")
  ].filter((item) => screenEnabled(item.id as ScreenId));
  const settingsGroups: HeaderNavigationGroup[] = [
    {
      id: "mosquee-management",
      label: "Gestion mosquée",
      items: [buildAction("mosquee", "Mosquée")]
    }
  ].filter((group) => group.items.some((item) => screenEnabled(item.id as ScreenId)))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => screenEnabled(item.id as ScreenId))
    }));
  const portalActions = [
    currentRole === "ENSEIGNANT" ? buildAction("teacherPortal", "Portail enseignant") : null,
    currentRole === "PARENT" ? buildAction("parentPortal", "Portail parent") : null,
    currentRole === "STUDENT" ? buildAction("studentPortal", "Portail élève") : null
  ].filter((item): item is HeaderNavigationAction =>
    item !== null && screenEnabled(item.id as ScreenId)
  );
  const sidebarGroups =
    currentRole === "ENSEIGNANT" || currentRole === "PARENT" || currentRole === "STUDENT"
      ? [{ id: "portal", title: "Accès rapide", items: portalActions }]
      : [
          { id: "pilotage", title: "Pilotage", items: [dashboardAction] },
          { id: "scolarite", title: "Scolarité", items: scolariteActions },
          { id: "school-life", title: "Vie scolaire", items: schoolLifeActions },
          {
            id: "settings",
            title: "Paramètres",
            items: [...settingsActions, ...settingsGroups.flatMap((group) => group.items)]
          }
        ];
  const preferenceActions: HeaderPreferenceAction[] = [
    {
      id: "language",
      label: "Sélectionner la langue",
      helperText: `Langue active : ${currentLanguageMeta.label}`,
      iconSrc: currentLanguageMeta.iconSrc,
      onSelect: () => selectLanguage(uiLanguage),
      options: UI_LANGUAGE_ORDER.map((language) => ({
        id: language,
        label: UI_LANGUAGE_META[language].label,
        active: language === uiLanguage,
        helperText: language === uiLanguage ? "Langue active" : "Changer la langue",
        iconSrc: UI_LANGUAGE_META[language].iconSrc,
        onSelect: () => selectLanguage(language)
      }))
    },
    {
      id: "theme",
      label: "Changer le mode",
      helperText: themeMode === "dark" ? "Activer le mode clair" : "Activer le mode sombre",
      iconSrc: themeMode === "light" ? "/mode-clair.png" : "/mode-sombre.png",
      onSelect: toggleThemeMode
    }
  ];
  const headerUserActions = ([
    { id: "profile", icon: "profile", label: "Mon profil", onSelect: () => selectScreen("profile") },
    { id: "preferences", icon: "settings", label: "Préférences", onSelect: () => selectScreen("preferences") },
    { id: "activity", icon: "activity", label: "Journal d’activité", onSelect: () => selectScreen("activity") },
    { id: "billing", icon: "billing", label: "Facturation", onSelect: () => selectScreen("billing") }
  ] satisfies HeaderUserAction[]).filter((item) => screenEnabled(item.id as ScreenId));
  const notificationTarget: ScreenId =
    currentRole === "ENSEIGNANT"
      ? "teacherPortal"
      : currentRole === "PARENT"
        ? "parentPortal"
        : currentRole === "STUDENT"
          ? "studentPortal"
          : currentRole && canAccess(currentRole, "schoolLifeNotifications")
            ? "schoolLifeNotifications"
            : dashboardTarget;
  const messageTarget: ScreenId =
    currentRole && canAccess(currentRole, "messages") ? "messages" : dashboardTarget;

  return {
    activeScreen,
    dashboardAction,
    headerMessageCount: 0,
    headerSearchSubmit: () => {
      if (moduleQueryInput.trim() && currentRole && canAccess(currentRole, "dashboard")) {
        selectScreen("dashboard");
      }
    },
    headerUserActions,
    isEnrollmentsContext: tab === "enrollments",
    isTeachersContext: tab === "teachers",
    messageActive: messageTarget === "messages" ? tab === "messages" : tab === messageTarget,
    messagesEnabled: screenEnabled("messages"),
    messageTarget,
    notificationActive:
      notificationTarget === "schoolLifeNotifications"
        ? tab === "schoolLifeNotifications"
        : tab === notificationTarget,
    notificationTarget,
    preferenceActions,
    schoolLifeActions,
    scolariteActions,
    settingsActions,
    settingsGroups,
    sidebarGroups
  };
}

type HeaderSessionModelInput = {
  currentProfile: UserSelfProfile | null;
  currentRole: Role | null;
  lastSyncAt: string | null;
  locale: string;
  schoolName: string;
  session: Session | null;
  users: UserAccount[];
};

export function createHeaderSessionModel(input: HeaderSessionModelInput) {
  const { currentProfile, currentRole, lastSyncAt, locale, schoolName, session, users } = input;
  const sessionUserAccount =
    users.find((item) => item.id === session?.user.id) ||
    users.find((item) => item.username === session?.user.username) ||
    users.find((item) => Boolean(item.email && item.email === session?.user.username));
  const account = currentProfile?.user || sessionUserAccount;
  const displayName =
    account?.displayName || session?.user.displayName || session?.user.username || "Utilisateur";
  const email =
    account?.email ||
    session?.user.email ||
    (session?.user.username?.includes("@") ? session.user.username : undefined);

  return {
    avatarInitial: getInitials(displayName || email),
    avatarUrl: account?.avatarUrl,
    contextLabel: currentRole ? ROLE_CONTEXT_LABELS[currentRole] : "Session",
    displayName,
    email,
    lastSyncLabel: lastSyncAt ? new Date(lastSyncAt).toLocaleString(locale) : "Non synchronise",
    statusLabel: formatAccountStatusLabel(account?.status || session?.user.status || "ACTIVE"),
    tenantLabel: currentProfile?.context.tenantName || schoolName
  };
}
