import { useId, type CSSProperties, type ReactNode } from "react";

import { useI18n } from "../i18n-context";

type KpiTone = "neutral" | "info" | "positive" | "warning" | "negative";
type KpiState = "ready" | "loading" | "empty" | "error";
type KpiPriority = "primary" | "secondary" | "detail";

type ResponsiveKpiGridProps = {
  children: ReactNode;
  className?: string;
  desktopColumns?: 2 | 3 | 4;
  label?: string;
  priority?: KpiPriority;
};

type ResponsiveKpiCardProps = {
  ariaLabel?: string;
  className?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  label: ReactNode;
  priority?: KpiPriority;
  state?: KpiState;
  stateLabel?: string;
  tone?: KpiTone;
  trend?: {
    direction: "up" | "down" | "stable";
    label: string;
  };
  value: ReactNode;
};

type ResponsiveDashboardCardProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
};

type ResponsiveChartCardProps = ResponsiveDashboardCardProps & {
  chartLabel: string;
  summary: Array<{ label: string; value: string }>;
};

const classNames = (...items: Array<string | false | null | undefined>): string =>
  items.filter(Boolean).join(" ");

export function ResponsiveKpiGrid({
  children,
  className,
  desktopColumns = 4,
  label,
  priority = "primary"
}: ResponsiveKpiGridProps): JSX.Element {
  const { meta } = useI18n();

  return (
    <div
      className={classNames("responsive-kpi-grid", className)}
      data-priority={priority}
      dir={meta.dir}
      role={label ? "group" : undefined}
      aria-label={label}
      style={{ "--responsive-kpi-desktop-columns": desktopColumns } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function ResponsiveKpiCard({
  ariaLabel,
  className,
  hint,
  icon,
  label,
  priority = "primary",
  state = "ready",
  stateLabel,
  tone = "neutral",
  trend,
  value
}: ResponsiveKpiCardProps): JSX.Element {
  const { meta, t } = useI18n();
  const unavailableLabel =
    stateLabel ??
    (state === "loading"
      ? t("Chargement...")
      : state === "empty"
        ? t("Non disponible")
        : t("Indisponible"));
  const renderedValue = state === "ready" ? value : unavailableLabel;
  const trendMeaning = trend
    ? t(
        trend.direction === "up"
          ? "Tendance positive"
          : trend.direction === "down"
            ? "Tendance négative"
            : "Tendance stable"
      )
    : null;

  return (
    <article
      className={classNames("responsive-kpi-card", className)}
      data-priority={priority}
      data-state={state}
      data-tone={tone}
      dir={meta.dir}
      aria-busy={state === "loading" ? "true" : undefined}
      aria-label={ariaLabel}
    >
      <div className="responsive-kpi-card__head">
        <span className="responsive-kpi-card__label">{label}</span>
        {icon ? <span className="responsive-kpi-card__icon" aria-hidden="true">{icon}</span> : null}
      </div>
      <strong className="responsive-kpi-card__value" aria-live={state === "loading" ? "polite" : undefined}>
        {renderedValue}
      </strong>
      {hint || trend ? (
        <div className="responsive-kpi-card__meta">
          {hint ? <small className="responsive-kpi-card__hint">{hint}</small> : null}
          {trend ? (
            <span className="responsive-kpi-card__trend" data-direction={trend.direction}>
              <span aria-hidden="true">
                {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "="}
              </span>
              <span>{trend.label}</span>
              <span className="visually-hidden"> ({trendMeaning})</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function ResponsiveDashboardCard({
  action,
  children,
  className,
  description,
  eyebrow,
  title
}: ResponsiveDashboardCardProps): JSX.Element {
  const titleId = useId();

  return (
    <article className={classNames("responsive-dashboard-card", className)} aria-labelledby={titleId}>
      <header className="responsive-dashboard-card__header">
        <div>
          {eyebrow ? <span className="responsive-dashboard-card__eyebrow">{eyebrow}</span> : null}
          <h3 id={titleId}>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="responsive-dashboard-card__action">{action}</div> : null}
      </header>
      <div className="responsive-dashboard-card__body">{children}</div>
    </article>
  );
}

export function ResponsiveChartCard({
  action,
  chartLabel,
  children,
  className,
  description,
  eyebrow,
  summary,
  title
}: ResponsiveChartCardProps): JSX.Element {
  return (
    <ResponsiveDashboardCard
      action={action}
      className={classNames("responsive-chart-card", className)}
      description={description}
      eyebrow={eyebrow}
      title={title}
    >
      <div className="responsive-chart-card__visual" role="img" aria-label={chartLabel}>
        {children}
      </div>
      <dl className="visually-hidden">
        {summary.map((item) => (
          <div key={`${item.label}-${item.value}`}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </ResponsiveDashboardCard>
  );
}
