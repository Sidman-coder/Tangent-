"use client";

import type { ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { duration, ease } from "@/lib/motion";

export type WeekSession = "done" | "planned" | "missed";

type ProgressPaceProps = {
  done: number;
  total: number;
  /** "steps done" */
  unit?: string;
  /** One entry per session planned this week. */
  week?: WeekSession[];
  /** One sentence of pace copy, whole numbers only. */
  sentence?: ReactNode;
  className?: string;
};

const numberTransition = { duration: duration.base, ease: ease.out };

/** docs/design/TANGENT-STYLE.md §8 Progress / pace. */
export default function ProgressPace({ done, total, unit = "steps done", week, sentence, className = "" }: ProgressPaceProps) {
  const safeTotal = Math.max(0, Math.round(total));
  const safeDone = Math.min(safeTotal, Math.max(0, Math.round(done)));
  const pct = safeTotal === 0 ? 0 : Math.round((safeDone / safeTotal) * 100);
  const weekDone = week?.filter((s) => s === "done").length ?? 0;

  return (
    <div className={`ui-pace${safeTotal > 0 && pct === 100 ? " is-complete" : ""} ${className}`.trim()}>
      <div className="ui-pace-head">
        <span className="ui-pace-number">
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={safeDone}
              style={{ display: "inline-block" }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={numberTransition}
            >
              {safeDone}
            </m.span>
          </AnimatePresence>{" "}
          of {safeTotal}
        </span>
        <span className="ui-pace-unit">{unit}</span>
      </div>
      <div
        className="ui-pace-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={safeDone}
        aria-label={`${safeDone} of ${safeTotal} ${unit}`}
      >
        <div className="ui-pace-fill" style={{ width: `${pct}%` }} />
      </div>
      {week && week.length > 0 && (
        <div className="ui-pace-week">
          <span aria-hidden="true">This week</span>
          <ul className="ui-pace-dots" role="img" aria-label={`${weekDone} of ${week.length} sessions done this week`}>
            {week.map((s, i) => (
              <li key={i} className={`ui-pace-dot is-${s}`} />
            ))}
          </ul>
        </div>
      )}
      {sentence && <p className="ui-pace-sentence">{sentence}</p>}
    </div>
  );
}
