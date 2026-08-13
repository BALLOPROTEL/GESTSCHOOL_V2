import { HeaderSearchBar } from "./header-search-bar";
import type { RefObject } from "react";
import { ModuleIcon } from "../../shared/components/module-icon";
import type {
  HeaderNavigationAction,
  HeaderNavigationGroup,
  HeaderNavigationUser,
  HeaderPreferenceAction,
  HeaderUserAction
} from "./header-navigation-types";
import type { ModuleIconName } from "../../shared/types/app";
import { useI18n } from "../../shared/i18n-context";

type HeaderMobileSection = {
  id: string;
  label: string;
  items: HeaderNavigationAction[];
  groups?: HeaderNavigationGroup[];
};

const MOBILE_ICON_BY_ACTION: Record<string, ModuleIconName> = {
  dashboard: "chart",
  enrollments: "clipboard",
  iam: "shield",
  teachers: "teacher",
  rooms: "room",
  students: "users",
  parentPortal: "users",
  finance: "wallet",
  grades: "book",
  schoolLifeOverview: "chart",
  schoolLifeAttendance: "bell",
  schoolLifeTimetable: "calendar",
  schoolLifeNotifications: "bell",
  reference: "settings",
  reports: "chart",
  mosquee: "calendar",
  messages: "messages"
};

const resolveMobileIcon = (actionId: string): ModuleIconName => MOBILE_ICON_BY_ACTION[actionId] || "settings";

export function HeaderMobilePanel(props: {
  brandLogoSrc: string;
  brandName: string;
  isOpen: boolean;
  logoAlt?: string;
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
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: () => void;
  preferences: HeaderPreferenceAction[];
  searchPlaceholder: string;
  searchValue: string;
  sections: HeaderMobileSection[];
  user: HeaderNavigationUser;
  userActions?: HeaderUserAction[];
  panelRef?: RefObject<HTMLDivElement>;
}): JSX.Element {
  const {
    brandLogoSrc,
    brandName,
    isOpen,
    logoAlt,
    messages,
    notifications,
    onClose,
    onSearchChange,
    onSearchSubmit,
    panelRef,
    preferences,
    searchPlaceholder,
    searchValue,
    sections,
    user,
    userActions = []
  } = props;
  const { t } = useI18n();

  return (
    <div
      ref={panelRef}
      id="header-mobile-panel"
      className={`header-mobile-panel ${isOpen ? "is-open" : ""}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
      aria-label={`${t("Navigation principale")} - ${brandName}`}
      tabIndex={-1}
    >
      <div className="header-mobile-panel-head">
        <div className="header-mobile-brand">
          <span className="global-brand-logo mobile">
            <img
              src={brandLogoSrc}
              alt={logoAlt || ""}
              aria-hidden={!logoAlt}
              width="256"
              height="221"
              loading="lazy"
            />
          </span>
          <div>
            <strong>{brandName}</strong>
            <small>{t(user.roleLabel)}</small>
          </div>
        </div>
        <button
          type="button"
          className="header-mobile-close"
          aria-label={t("Fermer le menu")}
          data-navigation-drawer-initial-focus
          onClick={onClose}
        >
          <span aria-hidden="true">X</span>
        </button>
      </div>

      <HeaderSearchBar
        value={searchValue}
        placeholder={searchPlaceholder}
        onChange={onSearchChange}
        onSubmit={() => {
          onSearchSubmit?.();
          onClose();
        }}
      />

      <div className="header-mobile-sections">
        {sections.map((section) => (
          <section key={section.id} className="header-mobile-section">
            <p>{t(section.label)}</p>
            <div className="header-mobile-links" role="menu" aria-label={t(section.label)}>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-navigation-id={item.id}
                  className={`header-mobile-link ${item.active ? "is-active" : ""}`.trim()}
                  disabled={item.disabled}
                  role="menuitem"
                  aria-current={item.active ? "page" : undefined}
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                >
                  <span className="header-mobile-link-icon" aria-hidden="true">
                    <ModuleIcon name={resolveMobileIcon(item.id)} />
                  </span>
                  <span>{t(item.label)}</span>
                  {item.helperText ? <small>{t(item.helperText)}</small> : null}
                </button>
              ))}
            </div>
            {section.groups?.map((group) => (
              <div key={group.id} className="header-mobile-subsection">
                <p>{t(group.label)}</p>
                <div className="header-mobile-links" role="menu" aria-label={t(group.label)}>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-navigation-id={item.id}
                      className={`header-mobile-link ${item.active ? "is-active" : ""}`.trim()}
                      disabled={item.disabled}
                      role="menuitem"
                      aria-current={item.active ? "page" : undefined}
                      onClick={() => {
                        item.onSelect();
                        onClose();
                      }}
                    >
                      <span className="header-mobile-link-icon" aria-hidden="true">
                        <ModuleIcon name={resolveMobileIcon(item.id)} />
                      </span>
                      <span>{t(item.label)}</span>
                      {item.helperText ? <small>{t(item.helperText)}</small> : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}

        <section className="header-mobile-section">
          <p>{t("Préférences")}</p>
          <div className="header-preferences-grid mobile" role="menu" aria-label={t("Préférences")}>
            {preferences.map((item) => (
              <button
                key={item.id}
                type="button"
                data-preference-id={item.id}
                className="header-preference-button"
                role="menuitem"
                onClick={() => {
                  item.onSelect();
                  onClose();
                }}
              >
                {item.iconSrc ? (
                  <img src={item.iconSrc} alt="" aria-hidden="true" width="64" height="64" />
                ) : null}
                <span>{t(item.label)}</span>
                {item.helperText ? <small>{t(item.helperText)}</small> : null}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="header-mobile-footer">
        {!messages.disabled ? (
          <button
            type="button"
            className={`header-mobile-link ${messages.active ? "is-active" : ""}`.trim()}
            role="menuitem"
            onClick={() => {
              messages.onSelect();
              onClose();
            }}
          >
            <span>{t(messages.label)}</span>
            <small>{t(`${messages.count} message(s)`)}</small>
          </button>
        ) : null}
        <button
          type="button"
          className={`header-mobile-link ${notifications.active ? "is-active" : ""}`.trim()}
          role="menuitem"
          onClick={() => {
            notifications.onSelect();
            onClose();
          }}
        >
          <span>{t(notifications.label)}</span>
          <small>{t(`${notifications.count} notification(s)`)}</small>
        </button>
        <div className="header-mobile-user">
          <div>
            <strong>{user.username}</strong>
            <small>{user.email || user.roleLabel}</small>
          </div>
        </div>
        {userActions.length > 0 ? (
          <div className="header-mobile-links user-actions" role="menu" aria-label={t("Menu profil")}>
            {userActions.map((item) => (
              <button
                key={item.id}
                type="button"
                data-user-action-id={item.id}
                className="header-mobile-link"
                aria-label={t(item.label)}
                role="menuitem"
                onClick={() => {
                  item.onSelect();
                  onClose();
                }}
              >
                <span>{t(item.label)}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="header-mobile-user logout-row">
          <button
            type="button"
            className="header-logout-button"
            role="menuitem"
            onClick={() => {
              onClose();
              user.onLogout();
            }}
          >
            <span>{t("Se déconnecter")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
