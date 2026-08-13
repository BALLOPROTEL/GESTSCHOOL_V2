import type { ReactNode } from "react";
import { useRef } from "react";

import { useI18n } from "../../shared/i18n-context";
import { HeaderFloatingPanel } from "./header-floating-panel";
import { HeaderGlyph, type HeaderGlyphName } from "./header-glyph";
import type { HeaderFeedItem, HeaderPreferenceAction, HeaderQuickAction } from "./header-navigation-types";

export function HeaderUtilityButton(props: {
  active?: boolean;
  badge?: number;
  className?: string;
  icon?: HeaderGlyphName;
  imageSrc?: string;
  label: string;
  onSelect: () => void;
}): JSX.Element {
  const { active, badge, className, icon, imageSrc, label, onSelect } = props;
  const { t } = useI18n();
  const translatedLabel = t(label);

  return (
    <button
      type="button"
      className={`header-icon-button ${active ? "is-active" : ""} ${className || ""}`.trim()}
      aria-label={translatedLabel}
      onClick={onSelect}
      title={translatedLabel}
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

export function HeaderUtilityDropdown(props: {
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
  const { t } = useI18n();
  const isOpen = openId === id;
  const anchorRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={anchorRef}
      className={`header-dropdown header-utility-dropdown ${isOpen ? "is-open" : ""} ${className || ""}`.trim()}
    >
      <HeaderUtilityButton
        active={active || isOpen}
        badge={badge}
        icon={icon}
        imageSrc={imageSrc}
        label={label}
        onSelect={() => onOpenChange(isOpen ? null : id)}
      />
      <HeaderFloatingPanel
        align="end"
        ariaLabel={t(label)}
        anchorRef={anchorRef}
        className={`header-dropdown-menu header-utility-panel ${className || ""}`}
        isOpen={isOpen}
        onRequestClose={() => onOpenChange(null)}
        role="region"
      >
        {children}
      </HeaderFloatingPanel>
    </div>
  );
}

export function HeaderQuickActionsPanel(props: {
  items: HeaderQuickAction[];
  onOpenChange: (value: string | null) => void;
}): JSX.Element {
  const { items, onOpenChange } = props;
  const { t } = useI18n();

  return (
    <div className="header-quick-panel">
      <div className="header-feed-header">
        <div>
          <strong>{t("Accès rapides")}</strong>
          <span>{t("Raccourcis du poste admin")}</span>
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
            <span>{t(item.label)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function HeaderLanguagePanel(props: {
  preference: HeaderPreferenceAction;
  onOpenChange: (value: string | null) => void;
}): JSX.Element {
  const { onOpenChange, preference } = props;
  const { t } = useI18n();
  const options = preference.options?.length
    ? preference.options
    : [
        {
          id: preference.id,
          label: preference.label,
          active: true,
          helperText: preference.helperText,
          iconSrc: preference.iconSrc,
          onSelect: preference.onSelect
        }
      ];

  return (
    <div className="header-language-panel">
      <div className="header-feed-header">
        <div>
          <strong>{t("Langue")}</strong>
          {preference.helperText ? <span>{t(preference.helperText)}</span> : null}
        </div>
      </div>
      <div className="header-language-list">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`header-language-option ${option.active ? "is-active" : ""}`.trim()}
            aria-current={option.active ? "true" : undefined}
            onClick={() => {
              option.onSelect();
              onOpenChange(null);
            }}
          >
            <span className="header-language-icon" aria-hidden="true">
              {option.iconSrc ? <img src={option.iconSrc} alt="" /> : option.label.slice(0, 2).toUpperCase()}
            </span>
            <span className="header-language-copy">
              <strong>{t(option.label)}</strong>
              {option.helperText ? <small>{t(option.helperText)}</small> : null}
            </span>
            {option.active ? <span className="header-language-status">{t("Actif")}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function HeaderFeedPanel(props: {
  actionLabel: string;
  footerLabel: string;
  items: HeaderFeedItem[];
  onActionSelect: () => void;
  onFooterSelect: () => void;
  title: string;
  unreadLabel: string;
}): JSX.Element {
  const { actionLabel, footerLabel, items, onActionSelect, onFooterSelect, title, unreadLabel } = props;
  const { t } = useI18n();

  return (
    <div className="header-feed-panel">
      <div className="header-feed-header">
        <div>
          <strong>{t(title)}</strong>
          <span>{t(unreadLabel)}</span>
        </div>
        <button type="button" className="header-panel-link" onClick={onActionSelect}>
          {t(actionLabel)}
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
              <strong>{t(item.title)}</strong>
              <p>{t(item.description)}</p>
              <span>{t(item.timeLabel)}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="header-feed-footer">
        <button type="button" className="header-panel-link footer-link" onClick={onFooterSelect}>
          {t(footerLabel)}
        </button>
      </div>
    </div>
  );
}
