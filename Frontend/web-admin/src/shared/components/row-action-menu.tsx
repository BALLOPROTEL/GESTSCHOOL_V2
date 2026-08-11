import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";

type RowActionMenuProps = {
  children: ReactNode;
  label: string;
  menuClassName?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  triggerClassName?: string;
};

type MenuPosition = {
  left: number;
  top: number;
};

const VIEWPORT_GAP = 8;

export function RowActionMenu({
  children,
  label,
  menuClassName,
  onOpenChange,
  open,
  triggerClassName
}: RowActionMenuProps): JSX.Element {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<MenuPosition>({ left: VIEWPORT_GAP, top: VIEWPORT_GAP });
  const menuChildren = Children.map(children, (child) =>
    isValidElement<{ role?: string }>(child) && child.type === "button"
      ? cloneElement(child, { role: child.props.role || "menuitem" })
      : child
  );

  const close = useCallback((): void => onOpenChange(false), [onOpenChange]);

  const placeMenu = useCallback((): void => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const direction = getComputedStyle(trigger).direction;
    const preferredLeft = direction === "rtl" ? triggerRect.left : triggerRect.right - menuRect.width;
    const left = Math.min(
      window.innerWidth - menuRect.width - VIEWPORT_GAP,
      Math.max(VIEWPORT_GAP, preferredLeft)
    );
    const fitsBelow = triggerRect.bottom + VIEWPORT_GAP + menuRect.height <= window.innerHeight;
    const top = fitsBelow
      ? triggerRect.bottom + VIEWPORT_GAP
      : Math.max(VIEWPORT_GAP, triggerRect.top - menuRect.height - VIEWPORT_GAP);
    setPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    placeMenu();
    const menu = menuRef.current;
    const firstItem = menu?.querySelector<HTMLElement>("[role='menuitem']:not([disabled])");
    (firstItem || menu)?.focus();
  }, [open, placeMenu]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
      triggerRef.current?.focus();
    };
    const onViewportChange = (): void => close();
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [close, open]);

  return (
    <div className="v3-action-cell">
      <button
        ref={triggerRef}
        type="button"
        className={["v3-more-button", triggerClassName].filter(Boolean).join(" ")}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-haspopup="menu"
        onClick={() => onOpenChange(!open)}
      >
        <span aria-hidden="true">...</span>
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              className={["v3-action-menu", "v3-action-menu-portal", menuClassName].filter(Boolean).join(" ")}
              role="menu"
              tabIndex={-1}
              style={{ left: position.left, top: position.top }}
              onKeyDown={(event) => {
                if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                const items = Array.from(
                  menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']:not([disabled])") || []
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
              {menuChildren}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
