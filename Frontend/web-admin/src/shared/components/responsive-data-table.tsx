import { useCallback, useEffect, useId, useRef, useState, type HTMLAttributes, type ReactNode } from "react";

import { useI18n } from "../i18n-context";

type ResponsiveDataTableProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: ReactNode;
  label?: string;
};

type ScrollState = {
  atEnd: boolean;
  atStart: boolean;
  scrollable: boolean;
};

const INITIAL_SCROLL_STATE: ScrollState = {
  atEnd: true,
  atStart: true,
  scrollable: false
};

export function ResponsiveDataTable({
  children,
  className,
  label,
  ...props
}: ResponsiveDataTableProps): JSX.Element {
  const { t } = useI18n();
  const hintId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollState, setScrollState] = useState(INITIAL_SCROLL_STATE);

  const updateScrollState = useCallback((): void => {
    const container = containerRef.current;
    if (!container) return;
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    const direction = getComputedStyle(container).direction;
    const logicalOffset = direction === "rtl" ? Math.abs(container.scrollLeft) : container.scrollLeft;
    const nextState = {
      atEnd: maxScroll - logicalOffset <= 2,
      atStart: logicalOffset <= 2,
      scrollable: maxScroll > 2
    };
    setScrollState((current) =>
      current.atEnd === nextState.atEnd &&
      current.atStart === nextState.atStart &&
      current.scrollable === nextState.scrollable
        ? current
        : nextState
    );
  }, []);

  useEffect(() => {
    updateScrollState();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(container);
    const table = container.querySelector("table");
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, [updateScrollState]);

  const accessibleLabel = label || t("Tableau de données défilant");
  const extraClassNames = className?.split(/\s+/u).filter((name) => name && name !== "table-wrap") || [];

  return (
    <div className="responsive-data-table-shell">
      <div
        {...props}
        ref={containerRef}
        className={["table-wrap", "responsive-data-table", ...extraClassNames].join(" ")}
        role="region"
        aria-label={accessibleLabel}
        aria-describedby={scrollState.scrollable ? hintId : undefined}
        tabIndex={scrollState.scrollable ? 0 : undefined}
        data-scrollable={scrollState.scrollable ? "true" : "false"}
        data-at-start={scrollState.atStart ? "true" : "false"}
        data-at-end={scrollState.atEnd ? "true" : "false"}
        onScroll={updateScrollState}
      >
        {children}
      </div>
      <p id={hintId} className="responsive-data-table-hint" aria-hidden={!scrollState.scrollable}>
        <span aria-hidden="true">↔</span>
        {t("Faites défiler le tableau horizontalement")}
      </p>
    </div>
  );
}
