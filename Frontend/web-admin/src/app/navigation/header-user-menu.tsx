import { useRef } from "react";

import { HeaderFloatingPanel } from "./header-floating-panel";
import { HeaderGlyph } from "./header-glyph";
import type { HeaderNavigationUser, HeaderUserAction } from "./header-navigation-types";

export function HeaderUserMenu(props: {
  actions: HeaderUserAction[];
  openId: string | null;
  onOpenChange: (value: string | null) => void;
  user: HeaderNavigationUser;
}): JSX.Element {
  const { actions, openId, onOpenChange, user } = props;
  const isOpen = openId === "user";
  const anchorRef = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={anchorRef} className={`header-dropdown header-user-menu ${isOpen ? "is-open" : ""}`.trim()}>
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

      <HeaderFloatingPanel
        align="end"
        anchorRef={anchorRef}
        className="header-dropdown-menu header-user-dropdown"
        isOpen={isOpen}
        role="menu"
      >
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
      </HeaderFloatingPanel>
    </div>
  );
}
