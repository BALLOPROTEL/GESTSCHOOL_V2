import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type FormHTMLAttributes,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";

import { useI18n } from "../i18n-context";
import { useConfirmDialog } from "./confirm-dialog";
import { useDialogFocus } from "./dialog-focus";

const RESPONSIVE_FORM_QUERY = "(max-width: 1023px)";

const readResponsiveMode = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(RESPONSIVE_FORM_QUERY).matches
    : false;

export type ResponsiveFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "title"> & {
  children: ReactNode;
  description?: string;
  formTitle: string;
  openOnMount?: boolean;
  triggerLabel?: string;
};

export function ResponsiveForm({
  children,
  className,
  description,
  formTitle,
  openOnMount = false,
  onChangeCapture,
  onInputCapture,
  onSubmit,
  triggerLabel,
  ...formProps
}: ResponsiveFormProps): JSX.Element {
  const { meta, t } = useI18n();
  const confirm = useConfirmDialog();
  const titleId = useId();
  const descriptionId = useId();
  const formId = useId();
  const [responsiveMode, setResponsiveMode] = useState(readResponsiveMode);
  const [open, setOpen] = useState(() => readResponsiveMode() && openOnMount);
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(RESPONSIVE_FORM_QUERY);
    const update = (): void => setResponsiveMode(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (responsiveMode && openOnMount) setOpen(true);
  }, [openOnMount, responsiveMode]);

  const close = useCallback(async (): Promise<void> => {
    if (dirty) {
      const accepted = await confirm({
        title: t("Modifications non enregistrées"),
        description: t("Abandonner les modifications en cours ?"),
        cancelLabel: t("Continuer la modification"),
        confirmLabel: t("Abandonner"),
        tone: "danger"
      });
      if (!accepted) return;
    }
    setDirty(false);
    setOpen(false);
  }, [confirm, dirty, t]);

  useDialogFocus({
    active: responsiveMode && open,
    containerRef: formRef,
    initialFocusRef: closeRef,
    onEscape: () => void close(),
    restoreFocusRef: triggerRef
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    setDirty(false);
    onSubmit?.(event);
  };

  const form = (
    <form
      {...formProps}
      id={formId}
      dir={meta.dir}
      ref={formRef}
      className={[className, "responsive-form-surface", open ? "is-open" : ""].filter(Boolean).join(" ")}
      aria-labelledby={responsiveMode ? titleId : undefined}
      aria-describedby={responsiveMode && description ? descriptionId : undefined}
      aria-modal={responsiveMode ? "true" : undefined}
      role={responsiveMode ? "dialog" : undefined}
      tabIndex={responsiveMode ? -1 : undefined}
      onChangeCapture={(event) => {
        setDirty(true);
        onChangeCapture?.(event);
      }}
      onInputCapture={(event) => {
        setDirty(true);
        onInputCapture?.(event);
      }}
      onSubmit={handleSubmit}
    >
      {responsiveMode ? (
        <header className="responsive-form-header">
          <div>
            <h2 id={titleId}>{formTitle}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="responsive-form-close button-ghost"
            aria-label={t("Fermer le formulaire")}
            onClick={() => void close()}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
      ) : null}
      {children}
    </form>
  );

  return (
    <div className="responsive-form-boundary">
      {responsiveMode ? (
        <button
          ref={triggerRef}
          type="button"
          className="responsive-form-trigger"
          aria-expanded={open}
          aria-controls={formId}
          onClick={() => setOpen(true)}
        >
          {triggerLabel || formTitle || t("Ouvrir le formulaire")}
        </button>
      ) : null}
      {responsiveMode
        ? open
          ? createPortal(
              <div className="responsive-form-layer">
                <div className="responsive-form-backdrop" />
                {form}
              </div>,
              document.body
            )
          : null
        : form}
    </div>
  );
}
