"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import * as m from "motion/react-m";
import { duration, ease } from "@/lib/motion";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  /** id of the panel this tab shows (aria-controls). */
  controls?: string;
  disabled?: boolean;
};

type SegmentedTabsProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the tab list. */
  label: string;
  variant?: "pill" | "underline";
  /** Stretch to the container; tabs share the width. */
  full?: boolean;
  idPrefix?: string;
  className?: string;
};

const indicatorTransition = { duration: duration.base, ease: ease.out };
const KEY_STEP: Record<string, number | "first" | "last"> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
  Home: "first",
  End: "last",
};

/** docs/design/TANGENT-STYLE.md §8 SegmentedTabs: a sliding pill (or underline),
 *  role="tablist", arrow keys move between tabs. */
export default function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  variant = "pill",
  full = false,
  idPrefix,
  className = "",
}: SegmentedTabsProps<T>) {
  const autoId = useId();
  const id = idPrefix ?? `tabs${autoId.replace(/:/g, "")}`;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = KEY_STEP[e.key];
    if (step === undefined || enabled.length === 0) return;
    e.preventDefault();
    let target: number;
    if (step === "first") target = enabled[0];
    else if (step === "last") target = enabled[enabled.length - 1];
    else {
      const pos = Math.max(0, enabled.indexOf(index));
      target = enabled[(pos + step + enabled.length) % enabled.length];
    }
    onChange(options[target].value);
    refs.current[target]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`ui-tabs ui-tabs--${variant}${full ? " ui-tabs--full" : ""} ${className}`.trim()}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${o.value}`}
            aria-selected={active}
            aria-controls={o.controls}
            tabIndex={active ? 0 : -1}
            disabled={o.disabled}
            className="ui-tab"
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {active && (
              <m.span
                layoutId={`${id}-${variant}`}
                className={variant === "pill" ? "ui-tab-pill" : "ui-tab-underline"}
                transition={indicatorTransition}
                aria-hidden="true"
              />
            )}
            <span className="ui-tab-label">
              {o.icon}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
