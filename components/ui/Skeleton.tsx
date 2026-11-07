"use client";

import { useEffect, useState } from "react";

type SkeletonProps = {
  /** "rows" mimics task rows; "block" is one rounded block. */
  variant?: "rows" | "block";
  rows?: number;
  /** Block height in px. */
  height?: number;
  /** Show only after this many ms, so fast loads never flash. */
  delay?: number;
  /** Announced to screen readers. */
  label?: string;
  className?: string;
};

const TITLE_WIDTHS = ["62%", "48%", "56%", "40%", "66%", "52%"];

/** docs/design/TANGENT-STYLE.md §8 Skeleton. Always takes its space, so nothing
 *  shifts when it appears; it fades in after `delay`. */
export default function Skeleton({ variant = "rows", rows = 3, height = 120, delay = 150, label = "Loading", className = "" }: SkeletonProps) {
  const [visible, setVisible] = useState(delay <= 0);
  useEffect(() => {
    if (delay <= 0) return;
    const t = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(t);
  }, [delay]);

  return (
    <div className={`ui-skeleton${visible ? " is-visible" : ""} ${className}`.trim()} role="status" aria-busy="true">
      <span className="ui-visually-hidden">{label}</span>
      {variant === "block" ? (
        <span className="ui-skeleton-bone is-block" style={{ height }} aria-hidden="true" />
      ) : (
        Array.from({ length: rows }, (_, i) => (
          <div className="ui-skeleton-row" key={i} aria-hidden="true">
            <span className="ui-skeleton-bone is-check" />
            <span className="ui-skeleton-bone is-title" style={{ flexBasis: TITLE_WIDTHS[i % TITLE_WIDTHS.length] }} />
            <span className="ui-skeleton-bone is-time" />
          </div>
        ))
      )}
    </div>
  );
}
