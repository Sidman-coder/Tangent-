"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, useDragControls, type PanInfo } from "motion/react";
import * as m from "motion/react-m";
import { X } from "lucide-react";
import IconButton from "@/components/ui/IconButton";
import { duration, ease } from "@/lib/motion";
import { PHONE_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";

export type SheetVariant = "side" | "modal";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  /** Visible title in the sheet header. */
  title?: ReactNode;
  /** id of the element naming the sheet: the header title, or one inside children. */
  titleId?: string;
  /** Name for a sheet with no visible title. */
  ariaLabel?: string;
  /** Desktop shape: a 440px right side sheet, or a centered 560px modal. Phones always get a bottom sheet. */
  variant?: SheetVariant;
  /** Sticky actions under the content. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  /** Focused on open; defaults to the close button. */
  initialFocus?: RefObject<HTMLElement | null>;
};

const FOCUSABLE = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

// Open sheets, oldest first. Escape closes only the top one.
const stack: symbol[] = [];
let scrollLocks = 0;
let savedOverflow = "";

const enter = { duration: duration.slow, ease: ease.out };
const exit = { duration: duration.base, ease: ease.in };

const MOTION = {
  bottom: {
    initial: { y: "100%" },
    animate: { y: 0, transition: enter },
    exit: { y: "100%", transition: exit },
  },
  side: {
    initial: { x: "100%" },
    animate: { x: 0, transition: enter },
    exit: { x: "100%", transition: exit },
  },
  modal: {
    initial: { opacity: 0, scale: 0.98, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0, transition: enter },
    exit: { opacity: 0, scale: 0.98, y: 8, transition: exit },
  },
} as const;

/**
 * docs/design/TANGENT-STYLE.md §8 Sheet / modal. A bottom sheet on phones
 * (drag the grabber down to dismiss), a side sheet or modal on larger screens.
 * Focus is trapped, Esc and the scrim close it, focus returns to the opener.
 */
export default function Sheet(props: SheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<AnimatePresence>{props.open && <SheetPanel key="sheet" {...props} />}</AnimatePresence>, document.body);
}

function SheetPanel({
  onClose,
  title,
  titleId,
  ariaLabel,
  variant = "side",
  footer,
  children,
  className = "",
  closeLabel = "Close",
  initialFocus,
}: SheetProps) {
  const isPhone = useMediaQuery(PHONE_QUERY, { sync: true });
  const layout = isPhone ? "bottom" : variant;
  const autoTitleId = useId();
  const headingId = title ? (titleId ?? `sheet-title${autoTitleId.replace(/:/g, "")}`) : titleId;

  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dragControls = useDragControls();

  // Focus trap, Escape, scroll lock and focus return: once per open.
  useEffect(() => {
    const token = Symbol("sheet");
    stack.push(token);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => (initialFocus?.current ?? closeRef.current)?.focus());

    if (scrollLocks === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    scrollLocks += 1;

    const onKeyDown = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!panelRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      const i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
      scrollLocks = Math.max(0, scrollLocks - 1);
      if (scrollLocks === 0) document.body.style.overflow = savedOverflow;
      // Hand focus back, unless another sheet opened in this one's place
      // (task → its chat) and now holds it.
      if (opener && opener.isConnected && stack.length === 0) opener.focus();
    };
    // initialFocus is read once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onCloseRef.current();
  };

  const closeButton = (
    <IconButton
      ref={closeRef}
      label={closeLabel}
      icon={<X strokeWidth={1.75} aria-hidden="true" />}
      onClick={() => onCloseRef.current()}
      tooltipSide="left"
      noTooltip
      className={title ? "ui-sheet-close" : "ui-sheet-close ui-sheet-close-float"}
    />
  );

  return (
    <div className={`ui-sheet-layer is-${layout}`}>
      <m.div
        className="ui-sheet-scrim"
        aria-hidden="true"
        onClick={() => onCloseRef.current()}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: duration.base, ease: ease.out } }}
        exit={{ opacity: 0, transition: { duration: duration.base, ease: ease.in } }}
      />
      <m.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-label={headingId ? undefined : ariaLabel}
        className={`ui-sheet ui-sheet--${layout} ${className}`.trim()}
        {...MOTION[layout]}
        {...(layout === "bottom"
          ? {
              drag: "y" as const,
              dragControls,
              dragListener: false,
              dragConstraints: { top: 0, bottom: 0 },
              dragElastic: { top: 0, bottom: 1 },
              onDragEnd,
            }
          : {})}
      >
        {layout === "bottom" && (
          <div className="ui-sheet-grabber" aria-hidden="true" onPointerDown={(e) => dragControls.start(e)} />
        )}
        {title && (
          <header className="ui-sheet-header">
            <h2 className="ui-sheet-title" id={headingId}>
              {title}
            </h2>
            {closeButton}
          </header>
        )}
        <div className="ui-sheet-body">
          {!title && closeButton}
          {children}
        </div>
        {footer && <div className="ui-sheet-footer">{footer}</div>}
      </m.div>
    </div>
  );
}
