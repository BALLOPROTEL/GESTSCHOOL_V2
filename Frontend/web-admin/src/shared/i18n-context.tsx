import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  translateUiString,
  UI_LANGUAGE_META,
  type UiLanguage,
  type UiLanguageMeta
} from "./i18n";

type I18nContextValue = {
  language: UiLanguage;
  meta: UiLanguageMeta;
  t: (source: string) => string;
};

const DEFAULT_I18N_VALUE: I18nContextValue = {
  language: "fr",
  meta: UI_LANGUAGE_META.fr,
  t: (source) => source
};

const I18nContext = createContext<I18nContextValue>(DEFAULT_I18N_VALUE);

export function I18nProvider(props: {
  children: ReactNode;
  language: UiLanguage;
}): JSX.Element {
  const value = useMemo<I18nContextValue>(
    () => ({
      language: props.language,
      meta: UI_LANGUAGE_META[props.language],
      t: (source) => translateUiString(props.language, source)
    }),
    [props.language]
  );

  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
