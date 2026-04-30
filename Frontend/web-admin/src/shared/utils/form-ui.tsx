import type { JSX } from "react";

import type { FieldErrors } from "../types/app";

export const hasFieldErrors = (errors: FieldErrors): boolean => Object.keys(errors).length > 0;

export const fieldError = (errors: FieldErrors, key: string): JSX.Element | null =>
  errors[key] ? <span className="field-error">{errors[key]}</span> : null;

export const focusFirstInlineErrorField = (stepId?: string): void => {
  window.setTimeout(() => {
    const scope = stepId
      ? document.querySelector(`[data-step-id="${stepId}"][data-active-step="true"]`)
      : document;

    if (!scope) return;
    const errorNode = scope.querySelector(".field-error");
    if (!errorNode) return;

    const label = errorNode.closest("label");
    const input = label?.querySelector<HTMLElement>("input, select, textarea");
    if (!input) return;

    input.focus();
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 0);
};

export const today = (): string => new Date().toISOString().slice(0, 10);
