import { ROLE_LABELS } from "../shared/constants/domain";
import type { ThemeMode } from "../shared/types/app";
import { UI_LANGUAGE_ORDER, type UiLanguage } from "../shared/i18n";
import { parseApiError } from "../shared/services/api-errors";
import { ICON_TOGGLE_ANIMATION_MS, STRONG_PASSWORD_REGEX } from "./app-config";

export const isStrongPassword = (value: string): boolean => STRONG_PASSWORD_REGEX.test(value);

export const getNextThemeMode = (mode: ThemeMode): ThemeMode => (mode === "light" ? "dark" : "light");

export const getNextUiLanguage = (language: UiLanguage): UiLanguage => {
  const currentIndex = UI_LANGUAGE_ORDER.indexOf(language);
  return UI_LANGUAGE_ORDER[(currentIndex + 1) % UI_LANGUAGE_ORDER.length] || "fr";
};

export const getIconToggleAnimationDuration = (): number =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : ICON_TOGGLE_ANIMATION_MS;

export const formatLookupLabel = (map: Record<string, string>, value?: string): string => {
  const normalized = (value || "").trim().toUpperCase();
  return map[normalized] || value || "-";
};

export const formatRoleLabel = (value?: string): string => formatLookupLabel(ROLE_LABELS, value);

export const formatAccountStatusLabel = (value?: string): string =>
  formatLookupLabel(
    {
      ACTIVE: "Actif",
      ARCHIVED: "Archivé",
      DISABLED: "Désactivé",
      INACTIVE: "Inactif",
      PENDING_ACTIVATION: "En attente d’activation"
    },
    value
  );

export const getInitials = (value?: string): string => {
  const parts = (value || "").trim().split(/\s+/u).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || "U").toUpperCase();
};

export const parseError = (response: Response): Promise<string> => parseApiError(response);
