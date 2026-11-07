"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import IconButton from "@/components/ui/IconButton";
import { duration as dur, ease } from "@/lib/motion";

export type ToastTone = "neutral" | "success" | "info" | "warning" | "error";

const REGION_ID = "ui-toast-region";

function getRegion(): HTMLElement {
  let region = document.getElementById(REGION_ID);
  if (!region) {
    region = document.createElement("div");
    region.id = REGION_ID;
    region.className = "ui-toast-region";
    document.body.appendChild(region);
  }
  return region;
}

/**
 * Renders toasts into the one shared region (bottom-left beside the rail on
 * desktop, above the bottom nav on phones). Put conditional toasts inside so
 * they animate out.
 */
export function ToastPortal({ children }: { children: ReactNode }) {
  const [region, setRegion] = useState<HTMLElement | null>(null);
  useEffect(() => setRegion(getRegion()), []);
  if (!region) return null;
  return createPortal(<AnimatePresence mode="popLayout">{children}</AnimatePresence>, region);
}

const TONE_ICON: Record<Exclude<ToastTone, "neutral">, ReactNode> = {
  success: <CheckCircle2 strokeWidth={1.75} aria-hidden="true" />,
  info: <Info strokeWidth={1.75} aria-hidden="true" />,
  warning: <AlertTriangle strokeWidth={1.75} aria-hidden="true" />,
  error: <XCircle strokeWidth={1.75} aria-hidden="true" />,
};

type ToastProps = {
  tone?: ToastTone;
  /** Overrides the tone's icon; pass null for none. */
  icon?: ReactNode;
  title?: ReactNode;
  /** Body text, or custom content such as an ActionReceipt. */
  children?: ReactNode;
  /** One action, usually a small secondary Button. */
  action?: ReactNode;
  /** Called by the timer, Escape, or the dismiss button. Without it the toast has no dismiss button. */
  onDismiss?: () => void;
  /** Auto-dismiss after this many ms (paused on hover or focus); null keeps it up. Read once, on mount. */
  duration?: number | null;
  dismissLabel?: string;
  className?: string;
};

/** docs/design/TANGENT-STYLE.md §8 Toast. Render inside a ToastPortal. */
export default function Toast({
  tone = "neutral",
  icon,
  title,
  children,
  action,
  onDismiss,
  duration = 5000,
  dismissLabel = "Dismiss",
  className = "",
}: ToastProps) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const timer = useRef<number | null>(null);
  const remaining = useRef(duration);
  const startedAt = useRef(0);
  const paused = useRef(false);

  const start = () => {
    if (remaining.current == null || !onDismissRef.current) return;
    if (timer.current) window.clearTimeout(timer.current);
    startedAt.current = Date.now();
    timer.current = window.setTimeout(() => onDismissRef.current?.(), remaining.current);
  };
  const pause = () => {
    if (paused.current || remaining.current == null) return;
    paused.current = true;
    if (timer.current) window.clearTimeout(timer.current);
    remaining.current = Math.max(1500, remaining.current - (Date.now() - startedAt.current));
  };
  const resume = (event: React.FocusEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    const card = event.currentTarget;
    // Stay paused while the pointer is over the toast or focus is inside it.
    if (event.type === "blur" && (card.contains((event as React.FocusEvent).relatedTarget as Node | null) || card.matches(":hover"))) return;
    if (event.type === "mouseleave" && card.contains(document.activeElement)) return;
    if (!paused.current) return;
    paused.current = false;
    start();
  };

  useEffect(() => {
    start();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // The timer is set up once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolvedIcon = icon === undefined ? (tone === "neutral" ? null : TONE_ICON[tone]) : icon;

  return (
    <m.div
      layout
      className={`ui-toast is-${tone} ${className}`.trim()}
      role={tone === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: dur.slow, ease: ease.out } }}
      exit={{ opacity: 0, y: 8, transition: { duration: dur.fast, ease: ease.in } }}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      onKeyDown={(event) => {
        if (event.key === "Escape" && onDismissRef.current) {
          event.stopPropagation();
          onDismissRef.current();
        }
      }}
    >
      {resolvedIcon && <span className="ui-toast-icon">{resolvedIcon}</span>}
      <div className="ui-toast-body">
        {title && <p className="ui-toast-title">{title}</p>}
        {children && (typeof children === "string" ? <p className={title ? "ui-toast-text" : "ui-toast-message"}>{children}</p> : children)}
      </div>
      {(action || onDismiss) && (
        <div className="ui-toast-actions">
          {action}
          {onDismiss && (
            <IconButton
              label={dismissLabel}
              size="sm"
              noTooltip
              icon={<X strokeWidth={1.75} aria-hidden="true" />}
              onClick={() => onDismissRef.current?.()}
            />
          )}
        </div>
      )}
    </m.div>
  );
}
