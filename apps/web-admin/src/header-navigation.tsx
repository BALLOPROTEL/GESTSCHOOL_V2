import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

export type HeaderNavigationAction = {
  id: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  helperText?: string;
  onSelect: () => void;
};

export type HeaderPreferenceAction = {
  id: string;
  label: string;
  helperText?: string;
  iconSrc?: string;
  onSelect: () => void;
};

export type HeaderNavigationGroup = {
  id: string;
  label: string;
  helperText?: string;
  items: HeaderNavigationAction[];
};

type HeaderGlyphName =
  | "layout"
  | "apps"
  | "calendar"
  | "email"
  | "files"
  | "support"
  | "rocket"
  | "warning"
  | "check"
  | "theme"
  | "messages"
  | "notifications"
  | "profile"
  | "settings"
  | "activity"
  | "billing"
  | "logout";

type HeaderUserAction = {
  id: string;
  icon: HeaderGlyphName;
  label: string;
  onSelect: () => void;
};

type HeaderQuickAction = {
  id: string;
  icon: HeaderGlyphName;
  label: string;
  onSelect: () => void;
};

type HeaderFeedItemTone = "cyan" | "amber" | "green" | "indigo";

type HeaderFeedItem = {
  id: string;
  avatar?: string;
  description: string;
  icon?: HeaderGlyphName;
  onSelect: () => void;
  timeLabel: string;
  title: string;
  tone?: HeaderFeedItemTone;
};

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
    iconSrc: string;
    label: string;
    onSelect: () => void;
  };
  user: {
    avatar: string;
    contextLabel: string;
    roleLabel: string;
    secondaryLabel?: string;
    username: string;
    onLogout: () => void;
  };
};

function HeaderGlyph(props: { icon: HeaderGlyphName }): JSX.Element {
  const { icon } = props;

  switch (icon) {
    case "layout":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5.5 5.5h5.5v5.5H5.5zm7.5 0h5.5v13H13zm-7.5 7.5h5.5v5.5H5.5z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "apps":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 6h3v3H6zm4.5 0h3v3h-3zm4.5 0h3v3h-3zM6 10.5h3v3H6zm4.5 0h3v3h-3zm4.5 0h3v3h-3zM6 15h3v3H6zm4.5 0h3v3h-3zm4.5 0h3v3h-3z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7.5 4.5v2.2m9-2.2v2.2M5.5 8.2h13M7 6h10A1.5 1.5 0 0 1 18.5 7.5v9A1.5 1.5 0 0 1 17 18H7A1.5 1.5 0 0 1 5.5 16.5v-9A1.5 1.5 0 0 1 7 6Zm1.5 4h2v2h-2zm4 0h2v2h-2zm-4 4h2v2h-2z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "email":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5.5 7.5A1.5 1.5 0 0 1 7 6h10a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 17 18H7a1.5 1.5 0 0 1-1.5-1.5Zm1.2.6 5.3 4.2 5.3-4.2"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "files":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 6h3l1.4 1.6H17A1.5 1.5 0 0 1 18.5 9v7.5A1.5 1.5 0 0 1 17 18H7A1.5 1.5 0 0 1 5.5 16.5v-9A1.5 1.5 0 0 1 7 6Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "support":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8.4 9.4a3.6 3.6 0 1 1 7.2 0c0 1.4-.8 2.1-1.8 2.8-.8.5-1.4 1-1.4 1.8v.4M12 17.9v.1"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "rocket":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M14.8 5.2c1.6.1 3 .8 4 1.8-1 4.2-3.7 7.3-7.6 8.8l-2.5-2.5c1.5-3.9 4.6-6.6 8.8-7.6ZM9.2 14.8l-2 2c-.6.6-1.5 1-2.4 1H4v-.8c0-.9.4-1.8 1-2.4l2-2M13.6 10.4l0 .1M8.4 18.5l-2.9 1 .9-2.9"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "warning":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="m12 5.3 6.7 11.4a1 1 0 0 1-.9 1.5H6.2a1 1 0 0 1-.9-1.5L12 5.3Zm0 4.2v4.2m0 2.6v.1"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="m8 12.3 2.8 2.8L16.5 9.4M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "theme":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3.5v2.2m0 12.6v2.2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M3.5 12h2.2m12.6 0h2.2M4.9 19.1l1.5-1.5m11.2-11.2 1.5-1.5M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "messages":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 6.5h10A2.5 2.5 0 0 1 19.5 9v5A2.5 2.5 0 0 1 17 16.5h-4.4l-3.3 2.6V16.5H7A2.5 2.5 0 0 1 4.5 14V9A2.5 2.5 0 0 1 7 6.5Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "notifications":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 4.5a4 4 0 0 1 4 4V11c0 1 .3 2 .9 2.8l.8 1a1 1 0 0 1-.8 1.7H7.1a1 1 0 0 1-.8-1.7l.8-1A4.9 4.9 0 0 0 8 11V8.5a4 4 0 0 1 4-4Zm-1.8 13h3.6a1.8 1.8 0 0 1-3.6 0Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 6.2a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Zm0 9.1c3.4 0 6 1.7 6 3.8v.4H6v-.4c0-2.1 2.6-3.8 6-3.8Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4.5 8.4h4m4 0h7M8.5 8.4a2 2 0 1 0 0 .1m7 7.1h4m-15 0h7m4 0a2 2 0 1 0 0 .1"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "activity":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4.5 12h4l2.2-4 2.5 8 2.1-4H19.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "billing":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 7.5A1.5 1.5 0 0 1 6.5 6h11A1.5 1.5 0 0 1 19 7.5v9A1.5 1.5 0 0 1 17.5 18h-11A1.5 1.5 0 0 1 5 16.5Zm0 2.2h14"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "logout":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M10 7.5V6A1.5 1.5 0 0 1 11.5 4.5h6A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 10 18v-1.5M14 12H5.5m0 0 2.7-2.7M5.5 12l2.7 2.7"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
  }
}

function HeaderUtilityButton(props: {
  active?: boolean;
  badge?: number;
  className?: string;
  icon?: HeaderGlyphName;
  imageSrc?: string;
  label: string;
  onSelect: () => void;
}): JSX.Element {
  const { active, badge, className, icon, imageSrc, label, onSelect } = props;

  return (
    <button
      type="button"
      className={`header-icon-button ${active ? "is-active" : ""} ${className || ""}`.trim()}
      aria-label={label}
      onClick={onSelect}
      title={label}
    >
      {imageSrc ? (
        <img className="header-utility-image" src={imageSrc} alt="" aria-hidden="true" />
      ) : icon ? (
        <span className="header-icon-glyph">
          <HeaderGlyph icon={icon} />
        </span>
      ) : null}
      {typeof badge === "number" && badge > 0 ? (
        <span className="notification-badge" aria-live="polite">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

function HeaderUtilityDropdown(props: {
  active?: boolean;
  badge?: number;
  children: ReactNode;
  className?: string;
  icon?: HeaderGlyphName;
  id: string;
  imageSrc?: string;
  label: string;
  openId: string | null;
  onOpenChange: (value: string | null) => void;
}): JSX.Element {
  const { active, badge, children, className, icon, id, imageSrc, label, onOpenChange, openId } = props;
  const isOpen = openId === id;

  return (
    <div className={`header-dropdown header-utility-dropdown ${isOpen ? "is-open" : ""} ${className || ""}`.trim()}>
      <HeaderUtilityButton
        active={active || isOpen}
        badge={badge}
        icon={icon}
        imageSrc={imageSrc}
        label={label}
        onSelect={() => onOpenChange(isOpen ? null : id)}
      />
      <div className="header-dropdown-menu header-utility-panel" role="menu">
        {children}
      </div>
    </div>
  );
}

function HeaderQuickActionsPanel(props: {
  items: HeaderQuickAction[];
  onOpenChange: (value: string | null) => void;
}): JSX.Element {
  const { items, onOpenChange } = props;

  return (
    <div className="header-quick-panel">
      <div className="header-feed-header">
        <div>
          <strong>Acces rapides</strong>
          <span>Raccourcis du poste admin</span>
        </div>
      </div>
      <div className="header-quick-grid">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="header-quick-link"
            onClick={() => {
              item.onSelect();
              onOpenChange(null);
            }}
          >
            <span className="header-quick-icon">
              <HeaderGlyph icon={item.icon} />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function HeaderFeedPanel(props: {
  actionLabel: string;
  footerLabel: string;
  items: HeaderFeedItem[];
  onActionSelect: () => void;
  onFooterSelect: () => void;
  title: string;
  unreadLabel: string;
}): JSX.Element {
  const { actionLabel, footerLabel, items, onActionSelect, onFooterSelect, title, unreadLabel } = props;

  return (
    <div className="header-feed-panel">
      <div className="header-feed-header">
        <div>
          <strong>{title}</strong>
          <span>{unreadLabel}</span>
        </div>
        <button type="button" className="header-panel-link" onClick={onActionSelect}>
          {actionLabel}
        </button>
      </div>
      <div className="header-feed-list">
        {items.map((item) => (
          <button key={item.id} type="button" className="header-feed-item" onClick={item.onSelect}>
            <span className="header-feed-marker" aria-hidden="true" />
            {item.avatar ? (
              <span className="header-feed-avatar">{item.avatar}</span>
            ) : item.icon ? (
              <span className={`header-feed-icon tone-${item.tone || "cyan"}`}>
                <HeaderGlyph icon={item.icon} />
              </span>
            ) : null}
            <span className="header-feed-copy">
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <span>{item.timeLabel}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="header-feed-footer">
        <button type="button" className="header-panel-link footer-link" onClick={onFooterSelect}>
          {footerLabel}
        </button>
      </div>
    </div>
  );
}

function HeaderSearchBar(props: {
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  value: string;
}): JSX.Element {
  const { onChange, onSubmit, placeholder, value } = props;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.();
  };

  return (
    <form className="header-searchbar" role="search" onSubmit={submit}>
      <span className="header-searchbar-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm9.2 11.8 1.4 1.4-3.1 3.1-1.4-1.4 3.1-3.1Z" />
        </svg>
      </span>
      <input
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <span className="header-searchbar-shortcut" aria-hidden="true">
        /
      </span>
    </form>
  );
}

function HeaderActionButton(props: {
  action: HeaderNavigationAction;
  className?: string;
}): JSX.Element {
  const { action, className } = props;

  return (
    <button
      type="button"
      className={`header-nav-button ${action.active ? "is-active" : ""} ${className || ""}`.trim()}
      disabled={action.disabled}
      onClick={action.onSelect}
    >
      <span>{action.label}</span>
    </button>
  );
}

function HeaderDropdownMenu(props: {
  id: string;
  label: string;
  items: HeaderNavigationAction[];
  openId: string | null;
  onOpenChange: (value: string | null) => void;
  extraGroups?: HeaderNavigationGroup[];
  preferences?: HeaderPreferenceAction[];
}): JSX.Element {
  const { id, label, items, openId, onOpenChange, extraGroups = [], preferences = [] } = props;
  const isOpen = openId === id;
  const isActive =
    items.some((item) => item.active) ||
    extraGroups.some((group) => group.items.some((item) => item.active));
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setOpenGroupId(null);
      return;
    }

    const activeGroup = extraGroups.find((group) => group.items.some((item) => item.active));
    setOpenGroupId(activeGroup?.id ?? null);
  }, [extraGroups, isOpen]);

  return (
    <div className={`header-dropdown ${isOpen ? "is-open" : ""}`.trim()}>
      <button
        type="button"
        className={`header-nav-button header-nav-button-with-caret ${
          isActive ? "is-active" : ""
        }`.trim()}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => onOpenChange(isOpen ? null : id)}
      >
        <span>{label}</span>
        <span className={`header-nav-caret ${isOpen ? "is-open" : ""}`.trim()} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="m6.7 9.3 5.3 5.4 5.3-5.4 1.4 1.4-6.7 6.6-6.7-6.6 1.4-1.4Z" />
          </svg>
        </span>
      </button>

      <div className="header-dropdown-menu" role="menu">
        <div className="header-dropdown-section">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={`header-dropdown-item ${item.active ? "is-active" : ""}`.trim()}
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                onOpenChange(null);
              }}
            >
              <span>{item.label}</span>
              {item.helperText ? <small>{item.helperText}</small> : null}
            </button>
          ))}
        </div>

        {extraGroups.map((group) => (
          <div key={group.id} className="header-dropdown-section">
            <button
              type="button"
              className={`header-dropdown-group-toggle ${
                openGroupId === group.id ? "is-open" : ""
              } ${group.items.some((item) => item.active) ? "is-active" : ""}`.trim()}
              aria-expanded={openGroupId === group.id}
              onClick={() => setOpenGroupId((current) => (current === group.id ? null : group.id))}
            >
              <span>{group.label}</span>
              <span
                className={`header-group-caret ${openGroupId === group.id ? "is-open" : ""}`.trim()}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24">
                  <path d="m9.2 6.8 1.4-1.4 6.6 6.6-6.6 6.6-1.4-1.4 5.2-5.2-5.2-5.2Z" />
                </svg>
              </span>
            </button>
            {openGroupId === group.id ? (
              <div className="header-dropdown-submenu">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={`header-dropdown-item ${item.active ? "is-active" : ""}`.trim()}
                    disabled={item.disabled}
                    onClick={() => {
                      item.onSelect();
                      onOpenChange(null);
                    }}
                  >
                    <span>{item.label}</span>
                    {item.helperText ? <small>{item.helperText}</small> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}

        {preferences.length > 0 ? (
          <div className="header-dropdown-section header-dropdown-preferences">
            <div className="header-dropdown-title">
              <span>Preferences</span>
              <small>Langue et theme</small>
            </div>
            <div className="header-preferences-grid">
              {preferences.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="header-preference-button"
                  onClick={() => {
                    item.onSelect();
                    onOpenChange(null);
                  }}
                >
                  {item.iconSrc ? <img src={item.iconSrc} alt="" aria-hidden="true" /> : null}
                  <span>{item.label}</span>
                  {item.helperText ? <small>{item.helperText}</small> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HeaderUserMenu(props: {
  actions: HeaderUserAction[];
  openId: string | null;
  onOpenChange: (value: string | null) => void;
  user: HeaderNavigationProps["user"];
}): JSX.Element {
  const { actions, openId, onOpenChange, user } = props;
  const isOpen = openId === "user";

  return (
    <div className={`header-dropdown header-user-menu ${isOpen ? "is-open" : ""}`.trim()}>
      <button
        type="button"
        className={`header-user-trigger ${isOpen ? "is-active" : ""}`.trim()}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => onOpenChange(isOpen ? null : "user")}
      >
        <span className="header-user-avatar">{user.avatar}</span>
        <span className="header-user-copy">
          <strong>{user.username}</strong>
          <small>{user.roleLabel}</small>
        </span>
        <span className={`header-nav-caret ${isOpen ? "is-open" : ""}`.trim()} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="m6.7 9.3 5.3 5.4 5.3-5.4 1.4 1.4-6.7 6.6-6.7-6.6 1.4-1.4Z" />
          </svg>
        </span>
      </button>

      <div className="header-dropdown-menu header-user-dropdown" role="menu">
        <div className="header-user-summary">
          <span className="header-user-avatar large">{user.avatar}</span>
          <div>
            <strong>{user.username}</strong>
            <p>{user.roleLabel}</p>
            <small>{user.secondaryLabel || user.contextLabel}</small>
          </div>
        </div>
        <div className="header-user-links">
          {actions.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="header-user-link"
              onClick={() => {
                item.onSelect();
                onOpenChange(null);
              }}
            >
              <span className="header-user-link-icon">
                <HeaderGlyph icon={item.icon} />
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          role="menuitem"
          className="header-logout-button"
          onClick={() => {
            user.onLogout();
            onOpenChange(null);
          }}
        >
          <span className="header-user-link-icon">
            <HeaderGlyph icon="logout" />
          </span>
          <span>Se deconnecter</span>
        </button>
      </div>
    </div>
  );
}

export function HeaderNavigation(props: HeaderNavigationProps): JSX.Element {
  const {
    brandName,
    dashboard,
    logoAlt,
    logoSrc,
    messages,
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
    user
  } = props;
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const languagePreference = preferences.find((item) => item.id === "language") ?? preferences[0];
  const themePreference =
    preferences.find((item) => item.id === "theme") ??
    preferences.find((item) => item.id !== languagePreference?.id);
  const billingAction = scolarite.find((item) => item.id === "finance") ?? dashboard;
  const activityAction =
    settings.find((item) => item.id === "reports") ??
    schoolLife.find((item) => item.id === "schoolLifeNotifications") ??
    dashboard;
  const studentsAction = scolarite.find((item) => item.id === "students") ?? dashboard;
  const enrollmentAction = scolarite.find((item) => item.id === "enrollments") ?? dashboard;
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
  const userMenuActions: HeaderUserAction[] = [
    {
      id: "profile",
      icon: "profile",
      label: "Mon profil",
      onSelect: dashboard.onSelect
    },
    {
      id: "preferences",
      icon: "settings",
      label: "Preferences",
      onSelect: settingsAction.onSelect
    },
    {
      id: "activity",
      icon: "activity",
      label: "Journal d'activite",
      onSelect: activityAction.onSelect
    },
    {
      id: "billing",
      icon: "billing",
      label: "Facturation",
      onSelect: billingAction.onSelect
    }
  ];
  const quickActions: HeaderQuickAction[] = [
    { id: "quick-timetable", icon: "calendar", label: "Emploi du temps", onSelect: timetableAction.onSelect },
    { id: "quick-chat", icon: "messages", label: messagesDisabled ? "Messagerie (apercu)" : "Messagerie", onSelect: messages.onSelect },
    { id: "quick-alerts", icon: "email", label: "Notifications", onSelect: notificationCenterAction.onSelect },
    { id: "quick-finance", icon: "billing", label: "Finance", onSelect: billingAction.onSelect },
    { id: "quick-files", icon: "files", label: "Rapports", onSelect: reportsAction.onSelect },
    { id: "quick-support", icon: "support", label: "Support", onSelect: settingsAction.onSelect }
  ];
  const messageItems: HeaderFeedItem[] = messagesDisabled
    ? [
        {
          id: "message-guardrail",
          icon: "warning",
          tone: "amber",
          title: "Messagerie en garde-fou",
          description: "Module UI-only: aucun message n'est lu ni enregistre en base pour le moment.",
          timeLabel: "Lot 0",
          onSelect: messages.onSelect
        }
      ]
    : [
        {
          id: "message-1",
          avatar: "AD",
          title: "Awa Diallo",
          description: "Peux-tu verifier les dossiers d'inscription de la 6e A aujourd'hui ?",
          timeLabel: "2 min",
          onSelect: messages.onSelect
        },
        {
          id: "message-2",
          avatar: "VP",
          title: "Vie scolaire",
          description: "Le lot d'absences du jour est pret pour validation.",
          timeLabel: "12 min",
          onSelect: messages.onSelect
        },
        {
          id: "message-3",
          avatar: "SC",
          title: "Scolarite centrale",
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
      title: "Bulletins prets",
      description: "Le lot du trimestre 2 est disponible pour publication.",
      timeLabel: "5 min",
      onSelect: gradesAction.onSelect
    },
    {
      id: "notification-2",
      avatar: "MD",
      title: "Mia a laisse un retour",
      description: "Une relecture est demandee sur le tableau de bord finance.",
      timeLabel: "21 min",
      onSelect: dashboard.onSelect
    },
    {
      id: "notification-3",
      icon: "warning",
      tone: "amber",
      title: "Seuil d'impayes atteint",
      description: "Le niveau 4e B depasse 81% d'encours a recouvrer.",
      timeLabel: "58 min",
      onSelect: billingAction.onSelect
    },
    {
      id: "notification-4",
      icon: "check",
      tone: "green",
      title: "Paiement recu",
      description: "La facture INV-3921 a ete reglee avec succes.",
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
      { id: "scolarite", label: "Scolarite", items: scolarite },
      { id: "school-life", label: "Vie scolaire", items: schoolLife },
      { id: "settings", label: "Parametres", items: settings, groups: settingsGroups }
    ],
    [dashboard, schoolLife, scolarite, settings, settingsGroups]
  );

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenId(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenId(null);
        setMobileOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header ref={rootRef} className="panel app-shell-header global-header-shell">
      <div className="global-header-row">
        <button type="button" className="global-brand" onClick={dashboard.onSelect}>
          <span className="global-brand-logo">
            <img src={logoSrc} alt={logoAlt} />
          </span>
          <span className="global-brand-copy">
            <strong>GestSchool</strong>
            <small>{brandName}</small>
          </span>
        </button>

        <div className="global-header-center">
          <HeaderUtilityButton
            active={sidebarCollapsed}
            className="header-workspace-toggle"
            icon="layout"
            label={sidebarCollapsed ? "Afficher le menu lateral" : "Masquer le menu lateral"}
            onSelect={() => {
              setOpenId(null);
              onToggleSidebar();
            }}
          />

          <div className="global-header-search">
            <HeaderSearchBar
              value={searchValue}
              placeholder={searchPlaceholder}
              onChange={onSearchChange}
              onSubmit={onSearchSubmit}
            />
          </div>

          <nav className="global-header-nav" aria-label="Navigation principale">
            <HeaderActionButton action={dashboard} />
            <HeaderDropdownMenu
              id="scolarite"
              label="Scolarite"
              items={scolarite}
              openId={openId}
              onOpenChange={setOpenId}
            />
            <HeaderDropdownMenu
              id="school-life"
              label="Vie scolaire"
              items={schoolLife}
              openId={openId}
              onOpenChange={setOpenId}
            />
            <HeaderDropdownMenu
              id="settings"
              label="Parametres"
              items={settings}
              extraGroups={settingsGroups}
              preferences={preferences}
              openId={openId}
              onOpenChange={setOpenId}
            />
          </nav>
        </div>

        <div className="global-header-actions">
          <div className="header-utility-actions">
            {languagePreference ? (
              <HeaderUtilityButton
                imageSrc={languagePreference.iconSrc}
                label={languagePreference.label}
                onSelect={languagePreference.onSelect}
              />
            ) : null}
            <HeaderUtilityDropdown
              className="header-quick-dropdown"
              id="quick-actions"
              icon="apps"
              label="Acces rapides"
              openId={openId}
              onOpenChange={setOpenId}
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
            <HeaderUtilityDropdown
              active={messages.active}
              badge={messageUnreadCount}
              className="header-messages-dropdown"
              id="messages"
              icon="messages"
              label={messages.label}
              openId={openId}
              onOpenChange={setOpenId}
            >
              <HeaderFeedPanel
                title={messagesDisabled ? "Messagerie non branchee" : "Messages"}
                unreadLabel={
                  messagesDisabled
                    ? messages.statusLabel || "Aucune donnee persistante pour le moment"
                    : `${messageUnreadCount} nouveau(x) message(s)`
                }
                actionLabel={messagesDisabled ? "Voir l'apercu gele" : "Ouvrir le chat"}
                footerLabel={messagesDisabled ? "Ouvrir la page de cadrage" : "Voir tous les messages"}
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
            <HeaderUtilityDropdown
              active={notifications.active}
              badge={notificationUnreadCount}
              className="header-notifications-dropdown"
              id="notifications"
              icon="notifications"
              label={notifications.label}
              openId={openId}
              onOpenChange={setOpenId}
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
          <span className="header-actions-separator" aria-hidden="true" />
          <HeaderUserMenu
            actions={userMenuActions}
            user={user}
            openId={openId}
            onOpenChange={setOpenId}
          />
          <button
            type="button"
            className={`header-mobile-toggle ${mobileOpen ? "is-open" : ""}`.trim()}
            aria-expanded={mobileOpen}
            aria-controls="header-mobile-panel"
            onClick={() => {
              setOpenId(null);
              setMobileOpen((previous) => !previous);
            }}
          >
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 7h16v2H4V7Zm0 7h16v2H4v-2Z" />
              </svg>
            </span>
            <span>Menu</span>
          </button>
        </div>
      </div>

      <div
        id="header-mobile-panel"
        className={`header-mobile-panel ${mobileOpen ? "is-open" : ""}`.trim()}
      >
        <HeaderSearchBar
          value={searchValue}
          placeholder={searchPlaceholder}
          onChange={onSearchChange}
          onSubmit={onSearchSubmit}
        />

        <div className="header-mobile-sections">
          {mobileSections.map((section) => (
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
                      setMobileOpen(false);
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
                          setMobileOpen(false);
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
                    setMobileOpen(false);
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
            className={`header-mobile-link ${notifications.active ? "is-active" : ""}`.trim()}
            onClick={() => {
              notifications.onSelect();
              setMobileOpen(false);
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
            <button type="button" className="header-logout-button" onClick={user.onLogout}>
              <span>Deconnexion</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
