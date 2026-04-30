import {
  useEffect,
  useLayoutEffect,
  useState,
  type AriaRole,
  type CSSProperties,
  type ReactNode,
  type RefObject
} from "react";
import { createPortal } from "react-dom";

type HeaderFloatingPanelProps = {
  align?: "start" | "end";
  anchorRef: RefObject<Element>;
  children: ReactNode;
  className: string;
  isOpen: boolean;
  role?: AriaRole;
};

type FloatingStyle = CSSProperties;

const MIN_PANEL_HEIGHT = 180;
const OVERLAY_GAP = 18;
const VIEWPORT_MARGIN = 12;

function computeFloatingStyle(anchor: Element, align: "start" | "end"): FloatingStyle {
  const rect = anchor.getBoundingClientRect();
  const headerRect = anchor.closest(".global-header-shell")?.getBoundingClientRect();
  const lowerEdge = Math.max(rect.bottom, headerRect?.bottom ?? 0);
  const top = Math.max(VIEWPORT_MARGIN, Math.min(lowerEdge + OVERLAY_GAP, window.innerHeight - VIEWPORT_MARGIN));
  const maxHeight = Math.max(MIN_PANEL_HEIGHT, window.innerHeight - top - VIEWPORT_MARGIN);

  if (align === "end") {
    return {
      maxHeight: `${maxHeight}px`,
      right: `${Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.right)}px`,
      top: `${top}px`
    };
  }

  return {
    left: `${Math.min(Math.max(VIEWPORT_MARGIN, rect.left), window.innerWidth - VIEWPORT_MARGIN)}px`,
    maxHeight: `${maxHeight}px`,
    top: `${top}px`
  };
}

export function HeaderFloatingPanel(props: HeaderFloatingPanelProps): JSX.Element | null {
  const { align = "start", anchorRef, children, className, isOpen, role } = props;
  const [style, setStyle] = useState<FloatingStyle | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) {
      setStyle(null);
      return;
    }

    setStyle(computeFloatingStyle(anchorRef.current, align));
  }, [align, anchorRef, isOpen]);

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
      className={`${className} header-floating-panel`.trim()}
      data-align={align}
      data-header-floating-panel="true"
      role={role}
      style={style}
    >
      {children}
    </div>,
    document.body
  );
}
