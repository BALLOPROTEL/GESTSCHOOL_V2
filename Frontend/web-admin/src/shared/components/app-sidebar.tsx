import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import { createPortal } from "react-dom";

import { HeaderGlyph } from "../../app/navigation/header-glyph";
import type { ModuleIconName } from "../types/app";
import type { HeaderNavigationAction } from "../../app/navigation/header-navigation";
import type { HeaderNavigationUser, HeaderUserAction } from "../../app/navigation/header-navigation-types";
import { useI18n } from "../i18n-context";
import { ModuleIcon } from "./module-icon";

type AppSidebarGroup = {
  id: string;
  title: string;
  items: HeaderNavigationAction[];
};

type AppSidebarProps = {
  brandName?: string;
  groups: AppSidebarGroup[];
  logoAlt?: string;
  logoSrc?: string;
  navigationOpen?: boolean;
  onBrandSelect?: () => void;
  onOpenNavigation?: (trigger: HTMLButtonElement) => void;
  onUserLogout?: () => void;
  user?: Pick<HeaderNavigationUser, "avatar" | "avatarUrl" | "email" | "roleLabel" | "username">;
  userActions?: HeaderUserAction[];
};

const SIDEBAR_ICON_BY_ACTION: Record<string, ModuleIconName> = {
  dashboard: "chart",
  iam: "shield",
  teachers: "teacher",
  rooms: "room",
  students: "users",
  messages: "messages",
  reference: "settings",
  enrollments: "clipboard",
  finance: "wallet",
  reports: "chart",
  mosquee: "calendar",
  grades: "book",
  schoolLifeOverview: "chart",
  schoolLifeAttendance: "bell",
  schoolLifeTimetable: "calendar",
  schoolLifeNotifications: "bell",
  teacherPortal: "teacher",
  parentPortal: "users"
};

export function AppSidebar(props: AppSidebarProps): JSX.Element {
  const {
    brandName,
    groups,
    logoAlt,
    logoSrc,
    navigationOpen = false,
    onBrandSelect,
    onOpenNavigation,
    onUserLogout,
    user,
    userActions = []
  } = props;
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [railTooltip, setRailTooltip] = useState<{
    label: string;
    style: CSSProperties;
  } | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const { t } = useI18n();

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.disabled)
    }))
    .filter((group) => group.items.length > 0);

  const resolveIcon = (actionId: string): ModuleIconName =>
    SIDEBAR_ICON_BY_ACTION[actionId] || "settings";

  const showRailTooltip = (
    event: ReactMouseEvent<HTMLButtonElement> | ReactFocusEvent<HTMLButtonElement>,
    label: string
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const isRtl = document.documentElement.dir === "rtl";
    setRailTooltip({
      label,
      style: {
        left: isRtl ? rect.left - 8 : rect.right + 8,
        top: rect.top + rect.height / 2,
        transform: isRtl ? "translate(-100%, -50%)" : "translateY(-50%)"
      }
    });
  };

  useEffect(() => {
    if (!userMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && userMenuRef.current?.contains(target)) {
        return;
      }

      setUserMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
        userMenuTriggerRef.current?.focus();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [userMenuOpen]);

  const handleUserAction = (action: HeaderUserAction) => {
    action.onSelect();
    setUserMenuOpen(false);
  };

  const handleLogout = () => {
    onUserLogout?.();
    setUserMenuOpen(false);
  };

  return (
    <aside className="panel app-sidebar app-sidebar-v2" aria-label={t("Navigation principale")}>
      {brandName && logoSrc ? (
        <button type="button" className="sidebar-brand" onClick={onBrandSelect}>
          <span className="sidebar-brand-logo">
            <img src={logoSrc} alt={logoAlt || brandName} />
          </span>
          <span className="sidebar-brand-copy">
            <strong>{brandName}</strong>
            <small>{t("Administration scolaire")}</small>
          </span>
        </button>
      ) : null}

      {onOpenNavigation ? (
        <button
          type="button"
          className="sidebar-rail-navigation-trigger"
          aria-label={t("Ouvrir le menu")}
          aria-controls="header-mobile-panel"
          aria-expanded={navigationOpen}
          onBlur={() => setRailTooltip(null)}
          onClick={(event) => {
            setRailTooltip(null);
            onOpenNavigation(event.currentTarget);
          }}
          onFocus={(event) => showRailTooltip(event, t("Ouvrir le menu"))}
          onMouseEnter={(event) => showRailTooltip(event, t("Ouvrir le menu"))}
          onMouseLeave={() => setRailTooltip(null)}
        >
          <span aria-hidden="true">
            <HeaderGlyph icon="layout" />
          </span>
        </button>
      ) : null}

      <div className="sidebar-scroll-region">
        {visibleGroups.map((group) => (
          <div key={group.id} className="sidebar-group">
            <p className="sidebar-title">{t(group.title)}</p>
            <div className="sidebar-nav-list">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`sidebar-link ${item.active ? "is-active" : ""}`.trim()}
                  aria-current={item.active ? "page" : undefined}
                  aria-label={t(item.label)}
                  onBlur={() => setRailTooltip(null)}
                  onClick={() => {
                    setRailTooltip(null);
                    item.onSelect();
                  }}
                  onFocus={(event) => showRailTooltip(event, t(item.label))}
                  onMouseEnter={(event) => showRailTooltip(event, t(item.label))}
                  onMouseLeave={() => setRailTooltip(null)}
                >
                  <span className="sidebar-link-visual">
                    <span className="sidebar-link-icon" aria-hidden="true">
                      <ModuleIcon name={resolveIcon(item.id)} />
                    </span>
                    <span className="sidebar-link-copy">
                      <span>{t(item.label)}</span>
                      {item.helperText ? <small>{t(item.helperText)}</small> : null}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {user ? (
        <div ref={userMenuRef} className={`sidebar-user-menu ${userMenuOpen ? "is-open" : ""}`.trim()}>
          <button
            ref={userMenuTriggerRef}
            type="button"
            className="sidebar-user-card"
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            aria-label={t("Ouvrir le menu utilisateur")}
            onBlur={() => setRailTooltip(null)}
            onClick={() => {
              setRailTooltip(null);
              setUserMenuOpen((previous) => !previous);
            }}
            onFocus={(event) => showRailTooltip(event, t("Compte utilisateur"))}
            onMouseEnter={(event) => showRailTooltip(event, t("Compte utilisateur"))}
            onMouseLeave={() => setRailTooltip(null)}
          >
            <span className="sidebar-user-avatar" aria-hidden="true">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.avatar}
            </span>
            <span className="sidebar-user-copy">
              <strong>{user.username}</strong>
              <small>{user.roleLabel ? t(user.roleLabel) : user.email}</small>
            </span>
            <span className="sidebar-user-caret" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="m7 14 5-5 5 5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              </svg>
            </span>
          </button>
          {userMenuOpen ? (
            <div className="sidebar-user-dropdown" role="menu" aria-label={t("Compte utilisateur")}>
              <div className="sidebar-user-summary">
                <span className="sidebar-user-summary-avatar" aria-hidden="true">
                  {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.avatar}
                </span>
                <span>
                  <strong>{user.username}</strong>
                  {user.email ? <small>{user.email}</small> : null}
                  <small>{t(user.roleLabel)}</small>
                </span>
              </div>
              {userActions.length ? (
                <div className="sidebar-user-actions">
                  {userActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className="sidebar-user-action"
                      role="menuitem"
                      onClick={() => handleUserAction(action)}
                    >
                      <span className="sidebar-user-action-icon" aria-hidden="true">
                        <HeaderGlyph icon={action.icon} />
                      </span>
                      <span>{t(action.label)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <button type="button" className="sidebar-user-logout" role="menuitem" onClick={handleLogout}>
                <span className="sidebar-user-action-icon" aria-hidden="true">
                  <HeaderGlyph icon="logout" />
                </span>
                <span>{t("Se déconnecter")}</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {railTooltip && typeof document !== "undefined"
        ? createPortal(
            <span className="sidebar-rail-tooltip" role="tooltip" style={railTooltip.style}>
              {railTooltip.label}
            </span>,
            document.body
          )
        : null}
    </aside>
  );
}
