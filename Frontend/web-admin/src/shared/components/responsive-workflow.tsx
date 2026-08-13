import { useEffect, useId, useState, type ReactNode } from "react";

import { useI18n } from "../i18n-context";

const COMPACT_WORKFLOW_QUERY = "(max-width: 767px)";

const readCompactMode = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(COMPACT_WORKFLOW_QUERY).matches
    : false;

export type WorkflowContextItem = {
  label: string;
  value: ReactNode;
};

type WorkflowContextBarProps = {
  title: string;
  items: WorkflowContextItem[];
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function WorkflowContextBar({
  title,
  items,
  actionLabel,
  onAction,
  className
}: WorkflowContextBarProps): JSX.Element {
  const { t } = useI18n();
  return (
    <aside className={["workflow-context-bar", className].filter(Boolean).join(" ")} aria-label={t(title)}>
      <div className="workflow-context-copy">
        <strong>{t(title)}</strong>
        <dl>
          {items.map((item) => (
            <div key={item.label}>
              <dt>{t(item.label)}</dt>
              <dd>{item.value || "-"}</dd>
            </div>
          ))}
        </dl>
      </div>
      {actionLabel && onAction ? (
        <button type="button" className="button-ghost" onClick={onAction}>
          {t(actionLabel)}
        </button>
      ) : null}
    </aside>
  );
}

type ResponsiveWorkflowDisclosureProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
};

export function ResponsiveWorkflowDisclosure({
  title,
  description,
  eyebrow,
  defaultOpen = false,
  className,
  children
}: ResponsiveWorkflowDisclosureProps): JSX.Element {
  const { t } = useI18n();
  const contentId = useId();
  const titleId = useId();
  const [compact, setCompact] = useState(readCompactMode);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(COMPACT_WORKFLOW_QUERY);
    const update = (): void => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const expanded = !compact || open;

  return (
    <section
      className={["workflow-disclosure", className, expanded ? "is-expanded" : "is-collapsed"]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={titleId}
    >
      <header className="workflow-disclosure-header">
        <div>
          {eyebrow ? <span className="workflow-disclosure-eyebrow">{t(eyebrow)}</span> : null}
          <h3 id={titleId}>{t(title)}</h3>
          {description ? <p>{t(description)}</p> : null}
        </div>
        {compact ? (
          <button
            type="button"
            className="button-ghost workflow-disclosure-toggle"
            aria-controls={contentId}
            aria-expanded={expanded}
            onClick={() => setOpen((value) => !value)}
          >
            {t(expanded ? "Réduire" : "Afficher")}
          </button>
        ) : null}
      </header>
      <div id={contentId} className="workflow-disclosure-body" hidden={!expanded}>
        {children}
      </div>
    </section>
  );
}
