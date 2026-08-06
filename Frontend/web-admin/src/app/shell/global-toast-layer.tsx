import { createPortal } from "react-dom";
import type { CSSProperties } from "react";

import { translateUiString, UI_MESSAGES, type UiLanguage } from "../../shared/i18n";

type GlobalToastLayerProps = {
  error: string | null;
  language?: UiLanguage;
  notice: string | null;
  onDismissError: () => void;
  onDismissNotice: () => void;
};

const GLOBAL_TOAST_LAYER_STYLE = {
  position: "fixed",
  zIndex: "var(--shell-z-toast, 6500)"
} satisfies CSSProperties;

export function GlobalToastLayer(props: GlobalToastLayerProps): JSX.Element | null {
  const { error, language = "fr", notice, onDismissError, onDismissNotice } = props;

  if (!error && !notice) {
    return null;
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="toast-stack global-toast-layer"
      data-global-toast-layer="true"
      data-testid="global-toast-stack"
      aria-live="polite"
      aria-atomic="true"
      style={GLOBAL_TOAST_LAYER_STYLE}
    >
      {error ? (
        <div className="toast-pop toast-pop-error" data-testid="global-toast-error" role="alert">
          <div>
            <strong>{translateUiString(language, UI_MESSAGES.toastAttention)}</strong>
            <p>{translateUiString(language, error)}</p>
          </div>
          <button
            type="button"
            aria-label={translateUiString(language, UI_MESSAGES.toastCloseError)}
            onClick={onDismissError}
          >
            {translateUiString(language, UI_MESSAGES.toastClose)}
          </button>
        </div>
      ) : null}
      {notice ? (
        <div className="toast-pop toast-pop-success" data-testid="global-toast-notice" role="status">
          <div>
            <strong>{translateUiString(language, UI_MESSAGES.toastInformation)}</strong>
            <p>{translateUiString(language, notice)}</p>
          </div>
          <button
            type="button"
            aria-label={translateUiString(language, UI_MESSAGES.toastCloseNotification)}
            onClick={onDismissNotice}
          >
            {translateUiString(language, UI_MESSAGES.toastClose)}
          </button>
        </div>
      ) : null}
    </div>,
    document.body
  );
}
