import { useEffect, useMemo, useState } from "react";

import { useI18n } from "../../shared/i18n-context";
import { HeaderMobilePanel } from "./header-mobile-panel";
import type {
  HeaderFeedItem,
  HeaderNavigationAction,
  HeaderNavigationGroup,
  HeaderNavigationUser,
  HeaderPreferenceAction,
  HeaderQuickAction,
  HeaderUserAction
} from "./header-navigation-types";
import { HeaderSearchBar } from "./header-search-bar";
import {
  HeaderFeedPanel,
  HeaderLanguagePanel,
  HeaderQuickActionsPanel,
  HeaderUtilityButton,
  HeaderUtilityDropdown
} from "./header-utility-menu";
import { useNavigationDrawer, type NavigationDrawerController } from "./use-navigation-drawer";

export type {
  HeaderNavigationAction,
  HeaderNavigationGroup,
  HeaderPreferenceAction,
  HeaderUserAction
} from "./header-navigation-types";

type HeaderNavigationProps = {
  brandName: string;
  logoAlt: string;
  logoSrc: string;
  sidebarCollapsed: boolean;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: () => void;
  onToggleSidebar: () => void;
  dashboard: HeaderNavigationAction;
  scolarite: HeaderNavigationAction[];
  schoolLife: HeaderNavigationAction[];
  settings: HeaderNavigationAction[];
  settingsGroups?: HeaderNavigationGroup[];
  preferences: HeaderPreferenceAction[];
  messages: {
    active?: boolean;
    count: number;
    disabled?: boolean;
    label: string;
    statusLabel?: string;
    onSelect: () => void;
  };
  notifications: {
    active?: boolean;
    count: number;
    label: string;
    onSelect: () => void;
  };
  user: HeaderNavigationUser;
  userActions?: HeaderUserAction[];
  navigationDrawer?: NavigationDrawerController;
};

export function HeaderNavigation(props: HeaderNavigationProps): JSX.Element {
  const {
    brandName,
    dashboard,
    logoAlt,
    logoSrc,
    messages,
    navigationDrawer,
    notifications,
    onSearchChange,
    onSearchSubmit,
    onToggleSidebar,
    preferences,
    schoolLife,
    sidebarCollapsed,
    scolarite,
    searchPlaceholder,
    searchValue,
    settings,
    settingsGroups = [],
    user,
    userActions
  } = props;
  const { t } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);
  const fallbackNavigationDrawer = useNavigationDrawer();
  const drawer = navigationDrawer ?? fallbackNavigationDrawer;
  const languagePreference = preferences.find((item) => item.id === "language") ?? preferences[0];
  const themePreference =
    preferences.find((item) => item.id === "theme") ??
    preferences.find((item) => item.id !== languagePreference?.id);
  const billingAction = scolarite.find((item) => item.id === "finance") ?? dashboard;
  const activityAction =
    settings.find((item) => item.id === "reports") ??
    schoolLife.find((item) => item.id === "schoolLifeNotifications") ??
    dashboard;
  const gradesAction = schoolLife.find((item) => item.id === "grades") ?? dashboard;
  const timetableAction = schoolLife.find((item) => item.id === "schoolLifeTimetable") ?? dashboard;
  const notificationCenterAction =
    schoolLife.find((item) => item.id === "schoolLifeNotifications") ?? activityAction;
  const settingsAction = settings[0] ?? dashboard;
  const reportsAction = settings.find((item) => item.id === "reports") ?? activityAction;
  const messagesDisabled = messages.disabled === true;
  const initialMessageCount = messagesDisabled ? 0 : messages.count;
  const [messageUnreadCount, setMessageUnreadCount] = useState(initialMessageCount);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(notifications.count);
  const fallbackUserMenuActions: HeaderUserAction[] = [
    {
      id: "profile",
      icon: "profile",
      label: "Mon profil",
      onSelect: dashboard.onSelect
    },
    {
      id: "preferences",
      icon: "settings",
      label: "Préférences",
      onSelect: settingsAction.onSelect
    },
    {
      id: "activity",
      icon: "activity",
      label: "Journal d’activité",
      onSelect: activityAction.onSelect
    },
    {
      id: "billing",
      icon: "billing",
      label: "Facturation",
      onSelect: billingAction.onSelect
    }
  ];
  const userMenuActions = userActions ?? fallbackUserMenuActions;
  const quickActions: HeaderQuickAction[] = [
    { id: "quick-timetable", icon: "calendar", label: "Emploi du temps", onSelect: timetableAction.onSelect },
    messagesDisabled
      ? null
      : { id: "quick-chat", icon: "messages", label: "Messagerie", onSelect: messages.onSelect },
    { id: "quick-alerts", icon: "email", label: "Notifications", onSelect: notificationCenterAction.onSelect },
    { id: "quick-finance", icon: "billing", label: "Finance", onSelect: billingAction.onSelect },
    { id: "quick-files", icon: "files", label: "Rapports", onSelect: reportsAction.onSelect },
    { id: "quick-support", icon: "support", label: "Support", onSelect: settingsAction.onSelect }
  ].filter((item): item is HeaderQuickAction => item !== null);
  const messageItems: HeaderFeedItem[] = messagesDisabled
    ? [
        {
          id: "message-guardrail",
          icon: "warning",
          tone: "amber",
          title: "Messagerie bientôt disponible",
          description: "Ce service sera activé après validation du périmètre.",
          timeLabel: "Bientôt",
          onSelect: messages.onSelect
        }
      ]
    : [
        {
          id: "message-1",
          avatar: "AD",
          title: "Awa Diallo",
          description: "Peux-tu vérifier les dossiers d'inscription de la 6e A aujourd'hui ?",
          timeLabel: "2 min",
          onSelect: messages.onSelect
        },
        {
          id: "message-2",
          avatar: "VP",
          title: "Vie scolaire",
          description: "Le lot d'absences du jour est prêt pour validation.",
          timeLabel: "12 min",
          onSelect: messages.onSelect
        },
        {
          id: "message-3",
          avatar: "SC",
          title: "Scolarité centrale",
          description: "Le bulletin de AD-204 est en attente de relecture finale.",
          timeLabel: "35 min",
          onSelect: messages.onSelect
        }
      ];
  const notificationItems: HeaderFeedItem[] = [
    {
      id: "notification-1",
      icon: "rocket",
      tone: "cyan",
      title: "Bulletins prêts",
      description: "Le lot du trimestre 2 est disponible pour publication.",
      timeLabel: "5 min",
      onSelect: gradesAction.onSelect
    },
    {
      id: "notification-2",
      avatar: "MD",
      title: "Mia a laissé un retour",
      description: "Une relecture est demandée sur le tableau de bord finance.",
      timeLabel: "21 min",
      onSelect: dashboard.onSelect
    },
    {
      id: "notification-3",
      icon: "warning",
      tone: "amber",
      title: "Seuil d'impayés atteint",
      description: "Le niveau 4e B dépasse 81% d'encours à recouvrer.",
      timeLabel: "58 min",
      onSelect: billingAction.onSelect
    },
    {
      id: "notification-4",
      icon: "check",
      tone: "green",
      title: "Paiement reçu",
      description: "La facture INV-3921 a été réglée avec succès.",
      timeLabel: "2 h",
      onSelect: billingAction.onSelect
    }
  ];

  useEffect(() => {
    setMessageUnreadCount(initialMessageCount);
  }, [initialMessageCount]);

  useEffect(() => {
    setNotificationUnreadCount(notifications.count);
  }, [notifications.count]);

  const mobileSections = useMemo(
    () => [
      { id: "dashboard", label: "Tableau de bord", items: [dashboard] },
      { id: "scolarite", label: "Scolarité", items: scolarite },
      { id: "school-life", label: "Vie scolaire", items: schoolLife },
      { id: "settings", label: "Paramètres", items: settings, groups: settingsGroups }
    ],
    [dashboard, schoolLife, scolarite, settings, settingsGroups]
  );

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (target instanceof Element && target.closest("[data-header-floating-panel='true']")) {
        return;
      }

      if (target instanceof Element && target.closest(".header-dropdown")) {
        return;
      }

      setOpenId(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenId(null);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleOpenIdChange = (value: string | null) => {
    setOpenId(value);
    if (value) drawer.close();
  };

  return (
    <header className="panel app-shell-header global-header-shell">
      <div className="global-header-row">
        <button type="button" className="global-brand" onClick={dashboard.onSelect}>
          <span className="global-brand-logo">
            <img src={logoSrc} alt={logoAlt} />
          </span>
          <span className="global-brand-copy">
            <strong>{brandName}</strong>
            <small>{t("Administration scolaire")}</small>
          </span>
        </button>

        <div className="global-header-center">
          <HeaderUtilityButton
            active={sidebarCollapsed}
            className="header-workspace-toggle"
            icon="layout"
            label={sidebarCollapsed ? "Afficher le menu latéral" : "Masquer le menu latéral"}
            onSelect={() => {
              setOpenId(null);
              onToggleSidebar();
            }}
          />

          <div className="global-header-search">
            <HeaderSearchBar
              value={searchValue}
              placeholder={t(searchPlaceholder)}
              onChange={onSearchChange}
              onSubmit={onSearchSubmit}
            />
          </div>

        </div>

        <div className="global-header-actions">
          <div className="header-utility-actions">
            {languagePreference ? (
              <HeaderUtilityDropdown
                className="header-language-dropdown"
                id="language"
                imageSrc={languagePreference.iconSrc}
                label={languagePreference.label}
                openId={openId}
                onOpenChange={handleOpenIdChange}
              >
                <HeaderLanguagePanel preference={languagePreference} onOpenChange={setOpenId} />
              </HeaderUtilityDropdown>
            ) : null}
            <HeaderUtilityDropdown
              className="header-quick-dropdown"
              id="quick-actions"
              icon="apps"
              label="Accès rapides"
              openId={openId}
              onOpenChange={handleOpenIdChange}
            >
              <HeaderQuickActionsPanel items={quickActions} onOpenChange={setOpenId} />
            </HeaderUtilityDropdown>
            {themePreference ? (
              <HeaderUtilityButton
                icon="theme"
                label={themePreference.label}
                onSelect={themePreference.onSelect}
              />
            ) : null}
            {!messagesDisabled ? (
              <HeaderUtilityDropdown
                active={messages.active}
                badge={messageUnreadCount}
                className="header-messages-dropdown"
                id="messages"
                icon="messages"
                label={messages.label}
                openId={openId}
                onOpenChange={handleOpenIdChange}
              >
                <HeaderFeedPanel
                  title="Messages"
                  unreadLabel={`${messageUnreadCount} nouveau(x) message(s)`}
                  actionLabel="Ouvrir le chat"
                  footerLabel="Voir tous les messages"
                  items={messageItems.map((item) => ({
                    ...item,
                    onSelect: () => {
                      item.onSelect();
                      setMessageUnreadCount((count) => Math.max(0, count - 1));
                      setOpenId(null);
                    }
                  }))}
                  onActionSelect={() => {
                    setMessageUnreadCount(0);
                    setOpenId(null);
                    messages.onSelect();
                  }}
                  onFooterSelect={() => {
                    setMessageUnreadCount(0);
                    setOpenId(null);
                    messages.onSelect();
                  }}
                />
              </HeaderUtilityDropdown>
            ) : null}
            <HeaderUtilityDropdown
              active={notifications.active}
              badge={notificationUnreadCount}
              className="header-notifications-dropdown"
              id="notifications"
              icon="notifications"
              label={notifications.label}
              openId={openId}
              onOpenChange={handleOpenIdChange}
            >
              <HeaderFeedPanel
                title="Notifications"
                unreadLabel={`${notificationUnreadCount} non lue(s)`}
                actionLabel="Tout marquer lu"
                footerLabel="Ouvrir le centre"
                items={notificationItems.map((item) => ({
                  ...item,
                  onSelect: () => {
                    item.onSelect();
                    setNotificationUnreadCount((count) => Math.max(0, count - 1));
                    setOpenId(null);
                  }
                }))}
                onActionSelect={() => setNotificationUnreadCount(0)}
                onFooterSelect={() => {
                  setOpenId(null);
                  notificationCenterAction.onSelect();
                }}
              />
            </HeaderUtilityDropdown>
          </div>
          <button
            type="button"
            className={`header-mobile-toggle ${drawer.isOpen ? "is-open" : ""}`.trim()}
            aria-expanded={drawer.isOpen}
            aria-controls="header-mobile-panel"
            aria-label={t(drawer.isOpen ? "Fermer le menu" : "Ouvrir le menu")}
            onClick={(event) => {
              setOpenId(null);
              drawer.toggleFrom(event.currentTarget);
            }}
          >
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 7h16v2H4V7Zm0 7h16v2H4v-2Z" />
              </svg>
            </span>
            <span>{t("Menu")}</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        className={`header-mobile-backdrop ${drawer.isOpen ? "is-open" : ""}`.trim()}
        aria-hidden="true"
        tabIndex={-1}
        onClick={drawer.close}
      />

      <HeaderMobilePanel
        brandLogoSrc={logoSrc}
        brandName={brandName}
        isOpen={drawer.isOpen}
        logoAlt={logoAlt}
        messages={messages}
        notifications={notifications}
        onClose={drawer.close}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        preferences={preferences}
        searchPlaceholder={t(searchPlaceholder)}
        searchValue={searchValue}
        sections={mobileSections}
        user={user}
        userActions={userMenuActions}
        panelRef={drawer.panelRef}
      />
    </header>
  );
}
