import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AriaRole,
  type CSSProperties,
  type ReactNode,
  type RefObject
} from "react";
import { createPortal } from "react-dom";

type HeaderFloatingPanelProps = {
  align?: "start" | "end";
  ariaLabel?: string;
  anchorRef: RefObject<Element>;
  children: ReactNode;
  className: string;
  isOpen: boolean;
  onRequestClose?: () => void;
  role?: AriaRole;
};

type FloatingStyle = CSSProperties;

const MIN_PANEL_HEIGHT = 180;
const OVERLAY_GAP = 8;
const VIEWPORT_MARGIN = 12;

function computeFloatingStyle(anchor: Element, align: "start" | "end"): FloatingStyle {
  const trigger = anchor.querySelector("button") ?? anchor;
  const rect = trigger.getBoundingClientRect();
  const headerRect = anchor.closest(".global-header-shell")?.getBoundingClientRect();
  const rawTop = Math.max(rect.bottom + OVERLAY_GAP, (headerRect?.bottom ?? 0) + OVERLAY_GAP, VIEWPORT_MARGIN);
  const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - VIEWPORT_MARGIN - MIN_PANEL_HEIGHT);
  const top = Math.min(rawTop, maxTop);
  const maxHeight = Math.max(MIN_PANEL_HEIGHT, window.innerHeight - top - VIEWPORT_MARGIN);
  const baseStyle = {
    maxHeight: `${maxHeight}px`,
    position: "fixed",
    top: `${top}px`,
    zIndex: "var(--shell-z-dropdown, 10000)"
  } satisfies FloatingStyle;

  if (window.innerWidth <= 640) {
    return {
      ...baseStyle,
      left: `${VIEWPORT_MARGIN}px`,
      right: `${VIEWPORT_MARGIN}px`,
      width: "auto",
      maxWidth: "none"
    };
  }

  if (align === "end") {
    return {
      ...baseStyle,
      right: `${Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.right)}px`
    };
  }

  return {
    ...baseStyle,
    left: `${Math.min(Math.max(VIEWPORT_MARGIN, rect.left), window.innerWidth - VIEWPORT_MARGIN)}px`,
  };
}

export function HeaderFloatingPanel(props: HeaderFloatingPanelProps): JSX.Element | null {
  const { align = "start", ariaLabel, anchorRef, children, className, isOpen, onRequestClose, role } = props;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<FloatingStyle | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) {
      setStyle(null);
      return;
    }

    setStyle(computeFloatingStyle(anchorRef.current, align));
  }, [align, anchorRef, isOpen]);

  useEffect(() => {
    if (!isOpen || !style) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      const firstItem = panelRef.current?.querySelector<HTMLElement>(
        "[role='menuitem']:not([disabled]), button:not([disabled]), [href], input:not([disabled]), select:not([disabled])"
      );
      firstItem?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen, style]);

  useEffect(() => {
    if (!isOpen || !anchorRef.current) {
      return undefined;
    }

    let frameId = 0;
    const updatePosition = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        if (anchorRef.current) {
          setStyle(computeFloatingStyle(anchorRef.current, align));
        }
      });
    };

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, anchorRef, isOpen]);

  if (!isOpen || typeof document === "undefined" || !style) {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      className={`${className} header-floating-panel`.trim()}
      data-align={align}
      data-header-floating-panel="true"
      aria-label={ariaLabel}
      role={role}
      style={style}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onRequestClose?.();
          window.requestAnimationFrame(() => {
            (anchorRef.current?.querySelector("button") as HTMLButtonElement | null)?.focus();
          });
          return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        const items = Array.from(
          panelRef.current?.querySelectorAll<HTMLElement>(
            "[role='menuitem']:not([disabled]), button:not([disabled]), [href], input:not([disabled]), select:not([disabled])"
          ) || []
        );
        if (items.length === 0) return;
        event.preventDefault();
        const currentIndex = Math.max(0, items.indexOf(document.activeElement as HTMLElement));
        const nextIndex =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : event.key === "ArrowDown"
                ? (currentIndex + 1) % items.length
                : (currentIndex - 1 + items.length) % items.length;
        items[nextIndex]?.focus();
      }}
    >
      {children}
    </div>,
    document.body
  );
}
