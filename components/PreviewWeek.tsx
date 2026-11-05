"use client";

// The mini week inside a plan preview (lib/preview-week.ts lays it out). New
// tasks are in color, what's already there is grey, School Blocks fainter.
// Hover, tap or focus a block for its title, time and why.

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PreviewWeek as Week, WeekBlock } from "@/lib/preview-week";

const HOUR_MARKS = [
  { label: "7a", pct: 0 },
  { label: "11a", pct: 25 },
  { label: "3p", pct: 50 },
  { label: "7p", pct: 75 },
];

function tipStyle(b: WeekBlock): React.CSSProperties {
  const left = ((b.dayIndex + 0.5) / 7) * 100;
  const side = b.dayIndex <= 1 ? { left: "0" } : b.dayIndex >= 5 ? { right: "0" } : { left: `${left}%`, transform: "translateX(-50%)" };
  const top = b.topPct ?? 0;
  return top > 55 ? { ...side, bottom: `${100 - top + 1}%` } : { ...side, top: `${top + b.heightPct + 1}%` };
}

export default function PreviewWeek({ weeks, selectedDate }: { weeks: Week[]; selectedDate?: string }) {
  const [wanted, setWanted] = useState(0);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // Edits can take a week away.
  const index = Math.min(wanted, weeks.length - 1);
  const week = weeks[index];
  const strip = useMemo(() => week.blocks.filter((b) => b.topPct === null), [week]);
  const timed = useMemo(() => week.blocks.filter((b) => b.topPct !== null), [week]);
  const active = week.blocks.find((b) => b.key === activeKey) ?? null;

  const blockProps = (b: WeekBlock) => ({
    type: "button" as const,
    "aria-label": `${b.title}, ${b.when}${b.label ? `. ${b.label}` : ""}${b.why ? `. ${b.why}` : ""}`,
    onMouseEnter: () => setActiveKey(b.key),
    onMouseLeave: () => setActiveKey(null),
    onFocus: () => setActiveKey(b.key),
    onBlur: () => setActiveKey(null),
    onClick: () => setActiveKey((k) => (k === b.key ? null : b.key)),
    // Only the new work is a tab stop; the rest is backdrop.
    tabIndex: b.kind === "new" ? 0 : -1,
  });

  return (
    <div className="preview-week">
      {weeks.length > 1 && (
        <div className="preview-week-nav">
          <button type="button" aria-label="Previous week" disabled={index === 0} onClick={() => { setActiveKey(null); setWanted(index - 1); }}>
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          <span aria-live="polite">Week {index + 1} of {weeks.length}<small>{week.label}</small></span>
          <button type="button" aria-label="Next week" disabled={index === weeks.length - 1} onClick={() => { setActiveKey(null); setWanted(index + 1); }}>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="preview-week-frame">
        <div className="preview-week-head" aria-hidden="true">
          {week.days.map((d) => (
            <span key={d.ymd} className={d.ymd === selectedDate ? "is-selected" : undefined}>{d.label}<b>{Number(d.ymd.slice(8))}</b></span>
          ))}
        </div>
        {strip.length > 0 && (
          <div className="preview-week-strip">
            {week.days.map((d, i) => (
              <div key={d.ymd}>
                {strip.filter((b) => b.dayIndex === i).map((b) => (
                  <button key={b.key} {...blockProps(b)} className="preview-week-untimed" style={{ background: b.color ?? undefined }} />
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="preview-week-body">
          <div className="preview-week-hours" aria-hidden="true">
            {HOUR_MARKS.map((h) => (
              <span key={h.label} style={{ top: `${h.pct}%` }}><em>{h.label}</em></span>
            ))}
          </div>
          <div className="preview-week-cols" aria-hidden="true">
            {week.days.map((d) => <i key={d.ymd} />)}
          </div>
          {timed.map((b) => (
            <button
              key={b.key}
              {...blockProps(b)}
              className={`preview-week-block is-${b.kind}`}
              style={{
                left: `${(b.dayIndex / 7) * 100}%`,
                top: `${b.topPct}%`,
                height: `${b.heightPct}%`,
                ...(b.color ? ({ "--block": b.color } as React.CSSProperties) : {}),
              }}
            >
              {b.kind === "new" && <span>{b.title}</span>}
            </button>
          ))}
          {active && (
            <div className="preview-week-tip" role="tooltip" style={tipStyle(active)}>
              <strong>{active.title}</strong>
              <span>{active.when}</span>
              {active.label && <span>{active.label}</span>}
              {active.why && <span>{active.why}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
