import { HeaderSearchBar } from "./header-search-bar";
import type {
  HeaderNavigationAction,
  HeaderNavigationGroup,
  HeaderNavigationUser,
  HeaderPreferenceAction
} from "./header-navigation-types";

type HeaderMobileSection = {
  id: string;
  label: string;
  items: HeaderNavigationAction[];
  groups?: HeaderNavigationGroup[];
};

export function HeaderMobilePanel(props: {
  brandLogoSrc: string;
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
}): JSX.Element {
  const {
    brandLogoSrc,
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
    user
  } = props;

  return (
    <div
      id="header-mobile-panel"
      className={`header-mobile-panel ${isOpen ? "is-open" : ""}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
      aria-label="Navigation mobile GestSchool"
    >
      <div className="header-mobile-panel-head">
        <div className="header-mobile-brand">
          <span className="global-brand-logo mobile">
            <img src={brandLogoSrc} alt={logoAlt || ""} aria-hidden={!logoAlt} />
          </span>
          <div>
            <strong>GestSchool</strong>
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
            <div className="header-mobile-links">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`header-mobile-link ${item.active ? "is-active" : ""}`.trim()}
                  disabled={item.disabled}
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                >
                  <span>{item.label}</span>
                  {item.helperText ? <small>{item.helperText}</small> : null}
                </button>
              ))}
            </div>
            {section.groups?.map((group) => (
              <div key={group.id} className="header-mobile-subsection">
                <p>{group.label}</p>
                <div className="header-mobile-links">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`header-mobile-link ${item.active ? "is-active" : ""}`.trim()}
                      disabled={item.disabled}
                      onClick={() => {
                        item.onSelect();
                        onClose();
                      }}
                    >
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
          <p>Preferences</p>
          <div className="header-preferences-grid mobile">
            {preferences.map((item) => (
              <button
                key={item.id}
                type="button"
                className="header-preference-button"
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
        <button
          type="button"
          className={`header-mobile-link ${messages.active ? "is-active" : ""}`.trim()}
          disabled={messages.disabled}
          onClick={() => {
            messages.onSelect();
            onClose();
          }}
        >
          <span>{messages.label}</span>
          <small>{messages.disabled ? messages.statusLabel || "Non finalise" : `${messages.count} message(s)`}</small>
        </button>
        <button
          type="button"
          className={`header-mobile-link ${notifications.active ? "is-active" : ""}`.trim()}
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
            <small>{user.roleLabel}</small>
          </div>
          <button
            type="button"
            className="header-logout-button"
            onClick={() => {
              onClose();
              user.onLogout();
            }}
          >
            <span>Deconnexion</span>
          </button>
        </div>
      </div>
    </div>
  );
}
