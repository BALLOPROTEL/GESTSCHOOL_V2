import type { JSX } from "react";

import type {
  AcademicStage,
  FieldErrors,
  SchoolYear,
  SchoolYearStatus,
  SubjectNature
} from "../../../shared/types/app";

export const hasFieldErrors = (errors: FieldErrors): boolean => Object.keys(errors).length > 0;

export const fieldError = (errors: FieldErrors, key: string): JSX.Element | null =>
  errors[key] ? (
    <span className="field-error" role="alert">
      {errors[key]}
    </span>
  ) : null;

export const renderFieldLabel = (
  label: string,
  options?: { required?: boolean; hint?: string }
): JSX.Element => (
  <span className="field-label-text">
    {label} {options?.required ? <span className="required-indicator">*</span> : null}
    {options?.hint ? <small>{options.hint}</small> : null}
  </span>
);

export const parseOptionalNumber = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const focusFirstInlineErrorField = (stepId?: string): void => {
  window.setTimeout(() => {
    const scope = stepId
      ? document.querySelector(`[data-step-id="${stepId}"][data-active-step="true"], [data-step-id="${stepId}"]`)
      : document;
    const errorNode = scope?.querySelector(".field-error");
    const input = errorNode?.closest("label")?.querySelector<HTMLElement>("input, select, textarea");
    input?.focus();
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 0);
};

export const formatAcademicTrackLabel = (value?: string): string =>
  value === "ARABOPHONE" ? "Arabophone" : "Francophone";

export const formatAcademicStageLabel = (value?: AcademicStage): string => {
  if (value === "PRIMARY") return "Primaire";
  if (value === "HIGHER") return "Superieur";
  return "Secondaire";
};

export const formatReferenceStatusLabel = (value?: string): string =>
  value === "INACTIVE" ? "Inactif" : value === "CLOSED" ? "Cloture" : value === "DRAFT" ? "Brouillon" : "Actif";

export const formatSchoolYearStatusLabel = (value?: SchoolYearStatus): string => formatReferenceStatusLabel(value);

export const formatPeriodTypeLabel = (value?: string): string => {
  if (value === "SEMESTER") return "Semestre";
  if (value === "BIMESTER") return "Bimestre";
  if (value === "CUSTOM") return "Libre";
  return "Trimestre";
};

export const formatSubjectNatureLabel = (value?: SubjectNature): string =>
  value === "ARABOPHONE" ? "Matiere Arabophone" : "Matiere Francophone";

export const formatSchoolYearOptionLabel = (item?: SchoolYear): string => {
  if (!item) return "-";
  return item.label && item.label !== item.code ? `${item.label} (${item.code})` : item.label || item.code;
};
