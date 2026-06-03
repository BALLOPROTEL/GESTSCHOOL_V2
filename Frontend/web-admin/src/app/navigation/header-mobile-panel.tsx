import { HeaderSearchBar } from "./header-search-bar";
import { ModuleIcon } from "../../shared/components/module-icon";
import type {
  HeaderNavigationAction,
  HeaderNavigationGroup,
  HeaderNavigationUser,
  HeaderPreferenceAction,
  HeaderUserAction
} from "./header-navigation-types";
import type { ModuleIconName } from "../../shared/types/app";

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
    preferences,
    searchPlaceholder,
    searchValue,
    sections,
    user,
    userActions = []
  } = props;

  return (
    <div
      id="header-mobile-panel"
      className={`header-mobile-panel ${isOpen ? "is-open" : ""}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
      aria-label={`Navigation mobile ${brandName}`}
    >
      <div className="header-mobile-panel-head">
        <div className="header-mobile-brand">
          <span className="global-brand-logo mobile">
            <img src={brandLogoSrc} alt={logoAlt || ""} aria-hidden={!logoAlt} />
          </span>
          <div>
            <strong>{brandName}</strong>
            <small>{user.roleLabel}</small>
          </div>
        </div>
        <button
          type="button"
          className="header-mobile-close"
          aria-label="Fermer le menu mobile"
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
            <p>{section.label}</p>
            <div className="header-mobile-links" role="menu" aria-label={section.label}>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`header-mobile-link ${item.active ? "is-active" : ""}`.trim()}
                  disabled={item.disabled}
                  role="menuitem"
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                >
                  <span className="header-mobile-link-icon" aria-hidden="true">
                    <ModuleIcon name={resolveMobileIcon(item.id)} />
                  </span>
                  <span>{item.label}</span>
                  {item.helperText ? <small>{item.helperText}</small> : null}
                </button>
              ))}
            </div>
            {section.groups?.map((group) => (
              <div key={group.id} className="header-mobile-subsection">
                <p>{group.label}</p>
                <div className="header-mobile-links" role="menu" aria-label={group.label}>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`header-mobile-link ${item.active ? "is-active" : ""}`.trim()}
                      disabled={item.disabled}
                      role="menuitem"
                      onClick={() => {
                        item.onSelect();
                        onClose();
                      }}
                    >
                      <span className="header-mobile-link-icon" aria-hidden="true">
                        <ModuleIcon name={resolveMobileIcon(item.id)} />
                      </span>
                      <span>{item.label}</span>
                      {item.helperText ? <small>{item.helperText}</small> : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}

        <section className="header-mobile-section">
          <p>Préférences</p>
          <div className="header-preferences-grid mobile" role="menu" aria-label="Préférences">
            {preferences.map((item) => (
              <button
                key={item.id}
                type="button"
                className="header-preference-button"
                role="menuitem"
                onClick={() => {
                  item.onSelect();
                  onClose();
                }}
              >
                {item.iconSrc ? <img src={item.iconSrc} alt="" aria-hidden="true" /> : null}
                <span>{item.label}</span>
                {item.helperText ? <small>{item.helperText}</small> : null}
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
            <span>{messages.label}</span>
            <small>{`${messages.count} message(s)`}</small>
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
          <span>{notifications.label}</span>
          <small>{notifications.count} notification(s)</small>
        </button>
        <div className="header-mobile-user">
          <div>
            <strong>{user.username}</strong>
            <small>{user.email || user.roleLabel}</small>
          </div>
        </div>
        {userActions.length > 0 ? (
          <div className="header-mobile-links user-actions" role="menu" aria-label="Menu profil">
            {userActions.map((item) => (
              <button
                key={item.id}
                type="button"
                className="header-mobile-link"
                aria-label={item.label}
                role="menuitem"
                onClick={() => {
                  item.onSelect();
                  onClose();
                }}
              >
                <span>{item.label}</span>
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
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>
    </div>
  );
}
