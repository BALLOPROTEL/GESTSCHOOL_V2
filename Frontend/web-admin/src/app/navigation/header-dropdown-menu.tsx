import { useEffect, useRef, useState } from "react";

import { HeaderFloatingPanel } from "./header-floating-panel";
import type {
  HeaderNavigationAction,
  HeaderNavigationGroup,
  HeaderPreferenceAction
} from "./header-navigation-types";

export function HeaderActionButton(props: {
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

export function HeaderDropdownMenu(props: {
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
  const anchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setOpenGroupId(null);
      return;
    }

    const activeGroup = extraGroups.find((group) => group.items.some((item) => item.active));
    setOpenGroupId(activeGroup?.id ?? null);
  }, [extraGroups, isOpen]);

  return (
    <div ref={anchorRef} className={`header-dropdown ${isOpen ? "is-open" : ""}`.trim()}>
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

      <HeaderFloatingPanel
        anchorRef={anchorRef}
        className="header-dropdown-menu"
        isOpen={isOpen}
        role="menu"
      >
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
      </HeaderFloatingPanel>
    </div>
  );
}
