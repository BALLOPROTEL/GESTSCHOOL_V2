import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";

import { useI18n } from "../i18n-context";
import { useDialogFocus } from "./dialog-focus";

export type ConfirmDialogOptions = {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  title?: string;
  tone?: "default" | "danger";
};

type PendingConfirmation = ConfirmDialogOptions & { resolve: (accepted: boolean) => void };
type ConfirmAction = (options: ConfirmDialogOptions) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmAction | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }): JSX.Element {
  const { meta, t } = useI18n();
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const settle = useCallback((accepted: boolean): void => {
    setPending((current) => {
      current?.resolve(accepted);
      return null;
    });
  }, []);

  useDialogFocus({
    active: Boolean(pending),
    containerRef: panelRef,
    initialFocusRef: cancelRef,
    onEscape: () => settle(false),
    restoreFocusRef
  });

  const confirm = useCallback<ConfirmAction>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending((current) => {
          current?.resolve(false);
          return { ...options, resolve };
        });
      }),
    []
  );
  const contextValue = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmDialogContext.Provider value={contextValue}>
      {children}
      {pending
        ? createPortal(
            <div className="confirm-dialog-layer" data-responsive-overlay="confirm">
              <div
                className="confirm-dialog-backdrop"
                aria-hidden="true"
                onClick={() => settle(false)}
              />
              <div
                ref={panelRef}
                className="confirm-dialog"
                dir={meta.dir}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-description"
                tabIndex={-1}
              >
                <div className="confirm-dialog-copy">
                  <h2 id="confirm-dialog-title">{pending.title || t("Confirmer l’action")}</h2>
                  <p id="confirm-dialog-description">{pending.description}</p>
                </div>
                <div className="confirm-dialog-actions">
                  <button ref={cancelRef} type="button" className="button-ghost" onClick={() => settle(false)}>
                    {pending.cancelLabel || t("Annuler")}
                  </button>
                  <button
                    type="button"
                    className={pending.tone === "danger" ? "button-danger" : undefined}
                    onClick={() => settle(true)}
                  >
                    {pending.confirmLabel || t("Confirmer")}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog(): ConfirmAction {
  const context = useContext(ConfirmDialogContext);
  if (context) return context;
  return async (options) => window.confirm(options.description);
}
