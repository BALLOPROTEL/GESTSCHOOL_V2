import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const DRAWER_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

const focusableElements = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(DRAWER_FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute("aria-hidden") !== "true"
  );

export type NavigationDrawerController = {
  close: () => void;
  isOpen: boolean;
  openFrom: (trigger: HTMLElement) => void;
  panelRef: RefObject<HTMLDivElement>;
  toggleFrom: (trigger: HTMLElement) => void;
};

export function useNavigationDrawer(): NavigationDrawerController {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setIsOpen(false), []);
  const openFrom = useCallback((trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setIsOpen(true);
  }, []);
  const toggleFrom = useCallback((trigger: HTMLElement) => {
    setIsOpen((open) => {
      if (!open) triggerRef.current = trigger;
      return !open;
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const panel = panelRef.current;
    if (!panel) return undefined;

    document.documentElement.classList.add("mobile-shell-open");
    const focusFrame = window.requestAnimationFrame(() => {
      const initialFocus =
        panel.querySelector<HTMLElement>("[data-navigation-drawer-initial-focus]") ??
        focusableElements(panel)[0] ??
        panel;
      initialFocus.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusableElements(panel);
      if (elements.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.documentElement.classList.remove("mobile-shell-open");
      const trigger = triggerRef.current;
      if (trigger?.isConnected) {
        window.requestAnimationFrame(() => trigger.focus());
      }
    };
  }, [close, isOpen]);

  return { close, isOpen, openFrom, panelRef, toggleFrom };
}
