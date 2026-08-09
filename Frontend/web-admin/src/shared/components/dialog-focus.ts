import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";

const activeDialogStack: symbol[] = [];

const syncScrollLock = (): void => {
  document.documentElement.classList.toggle("responsive-form-overlay-open", activeDialogStack.length > 0);
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hidden && element.getAttribute("aria-hidden") !== "true"
  );

export function useDialogFocus(props: {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onEscape: () => void;
  restoreFocusRef: MutableRefObject<HTMLElement | null>;
}): void {
  const { active, containerRef, initialFocusRef, onEscape, restoreFocusRef } = props;
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;
    const dialogId = Symbol("responsive-dialog");
    activeDialogStack.push(dialogId);
    syncScrollLock();

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!restoreFocusRef.current) restoreFocusRef.current = previouslyFocused;

    const frame = window.requestAnimationFrame(() => {
      const target = initialFocusRef?.current || getFocusableElements(container)[0] || container;
      target.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (activeDialogStack[activeDialogStack.length - 1] !== dialogId) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      const stackIndex = activeDialogStack.lastIndexOf(dialogId);
      if (stackIndex >= 0) activeDialogStack.splice(stackIndex, 1);
      syncScrollLock();
      const restoreTarget = restoreFocusRef.current;
      restoreFocusRef.current = null;
      restoreTarget?.focus({ preventScroll: true });
    };
  }, [active, containerRef, initialFocusRef, restoreFocusRef]);
}
