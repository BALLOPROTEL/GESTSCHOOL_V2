import { useEffect, useId, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useI18n } from "../i18n-context";
import { useDialogFocus } from "./dialog-focus";

const FILTER_DRAWER_QUERY = "(max-width: 1023px)";

const readDrawerMode = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(FILTER_DRAWER_QUERY).matches
    : false;

type ResponsiveFilterPanelProps = HTMLAttributes<HTMLElement> & {
  activeCount?: number;
  children: ReactNode;
  title: string;
};

export function ResponsiveFilterPanel({
  activeCount = 0,
  children,
  className,
  title,
  ...props
}: ResponsiveFilterPanelProps): JSX.Element {
  const { meta, t } = useI18n();
  const panelId = useId();
  const titleId = useId();
  const [drawerMode, setDrawerMode] = useState(readDrawerMode);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(FILTER_DRAWER_QUERY);
    const update = (): void => {
      setDrawerMode(media.matches);
      if (!media.matches) setOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useDialogFocus({
    active: drawerMode && open,
    containerRef: panelRef,
    initialFocusRef: closeRef,
    onEscape: () => setOpen(false),
    restoreFocusRef: triggerRef
  });

  const panel = (
    <section
      {...props}
      ref={panelRef}
      id={panelId}
      dir={meta.dir}
      className={[className, "responsive-filter-panel", open ? "is-open" : ""].filter(Boolean).join(" ")}
      role={drawerMode ? "dialog" : props.role}
      aria-modal={drawerMode ? "true" : undefined}
      aria-labelledby={drawerMode ? titleId : undefined}
    >
      {drawerMode ? (
        <header className="responsive-filter-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            <p>
              {activeCount > 0
                ? `${activeCount} ${t(activeCount === 1 ? "filtre actif" : "filtres actifs")}`
                : t("Aucun filtre actif")}
            </p>
          </div>
          <button ref={closeRef} type="button" className="button-ghost" onClick={() => setOpen(false)} aria-label={t("Fermer les filtres")}>
            <span aria-hidden="true">×</span>
          </button>
        </header>
      ) : null}
      {children}
    </section>
  );

  return (
    <div className="responsive-filter-boundary">
      {drawerMode ? (
        <button
          ref={triggerRef}
          type="button"
          className="responsive-filter-trigger button-ghost"
          aria-label={title}
          aria-controls={panelId}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span>{title}</span>
          {activeCount > 0 ? <strong>{activeCount}</strong> : null}
        </button>
      ) : null}
      {drawerMode
        ? open
          ? createPortal(
              <div className="responsive-filter-layer">
                <button type="button" className="responsive-filter-backdrop" aria-label={t("Fermer les filtres")} onClick={() => setOpen(false)} />
                {panel}
              </div>,
              document.body
            )
          : null
        : panel}
    </div>
  );
}
