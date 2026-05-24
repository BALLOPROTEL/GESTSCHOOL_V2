import { useCallback, useEffect, useRef, useState } from "react";

import type { ThemeMode } from "../shared/types/app";
import { UI_LANGUAGE_META, type UiLanguage } from "../shared/i18n";
import { readLanguagePreference, readThemePreference } from "../shared/services/session-storage";
import { LANGUAGE_STORAGE_KEY, THEME_STORAGE_KEY } from "./app-config";
import { getIconToggleAnimationDuration, getNextThemeMode, getNextUiLanguage } from "./app-formatters";

export const useAppPreferences = () => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readThemePreference());
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(() => readLanguagePreference());
  const [themeFlipTarget, setThemeFlipTarget] = useState<ThemeMode | null>(null);
  const [languageFlipTarget, setLanguageFlipTarget] = useState<UiLanguage | null>(null);
  const themeFlipTimeoutRef = useRef<number | null>(null);
  const languageFlipTimeoutRef = useRef<number | null>(null);

  const currentLanguageMeta = UI_LANGUAGE_META[uiLanguage];
  const nextLanguage = languageFlipTarget || getNextUiLanguage(uiLanguage);
  const nextLanguageMeta = UI_LANGUAGE_META[nextLanguage];

  useEffect(() => {
    return () => {
      if (themeFlipTimeoutRef.current !== null) {
        window.clearTimeout(themeFlipTimeoutRef.current);
      }
      if (languageFlipTimeoutRef.current !== null) {
        window.clearTimeout(languageFlipTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.lang = uiLanguage;
    document.documentElement.dir = currentLanguageMeta.dir;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, uiLanguage);
  }, [currentLanguageMeta.dir, uiLanguage]);

  const selectThemeMode = useCallback(
    (nextThemeMode: ThemeMode): void => {
      if (nextThemeMode === themeMode || themeFlipTarget) return;

      const animationDuration = getIconToggleAnimationDuration();
      if (animationDuration === 0) {
        setThemeMode(nextThemeMode);
        return;
      }

      if (themeFlipTimeoutRef.current !== null) {
        window.clearTimeout(themeFlipTimeoutRef.current);
      }

      setThemeFlipTarget(nextThemeMode);
      themeFlipTimeoutRef.current = window.setTimeout(() => {
        setThemeMode(nextThemeMode);
        setThemeFlipTarget(null);
        themeFlipTimeoutRef.current = null;
      }, animationDuration);
    },
    [themeFlipTarget, themeMode]
  );

  const toggleThemeMode = useCallback((): void => {
    selectThemeMode(getNextThemeMode(themeMode));
  }, [selectThemeMode, themeMode]);

  const selectLanguage = useCallback(
    (nextUiLanguage: UiLanguage): void => {
      if (nextUiLanguage === uiLanguage || languageFlipTarget) return;

      const animationDuration = getIconToggleAnimationDuration();
      if (animationDuration === 0) {
        setUiLanguage(nextUiLanguage);
        return;
      }

      if (languageFlipTimeoutRef.current !== null) {
        window.clearTimeout(languageFlipTimeoutRef.current);
      }

      setLanguageFlipTarget(nextUiLanguage);
      languageFlipTimeoutRef.current = window.setTimeout(() => {
        setUiLanguage(nextUiLanguage);
        setLanguageFlipTarget(null);
        languageFlipTimeoutRef.current = null;
      }, animationDuration);
    },
    [languageFlipTarget, uiLanguage]
  );

  const cycleLanguage = useCallback((): void => {
    selectLanguage(getNextUiLanguage(uiLanguage));
  }, [selectLanguage, uiLanguage]);

  return {
    currentLanguageMeta,
    cycleLanguage,
    languageFlipTarget,
    nextLanguageMeta,
    selectLanguage,
    selectThemeMode,
    themeFlipTarget,
    themeMode,
    toggleThemeMode,
    uiLanguage
  };
};
