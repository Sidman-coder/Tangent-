"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PreviewWeek from "@/components/PreviewWeek";
import { buildMonthGrid, monthOf, previewRange, shiftMonth, startOfPreviewWeek, weekLabel, type WeekStart } from "@/lib/month-grid";
import type { ChangeSet } from "@/lib/pipeline/changeset";
import { previewMonthItems, previewWeeks } from "@/lib/preview-week";
import { addDaysYMD } from "@/lib/time";
import type { Plan, Task } from "@/lib/types";

const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });

type Props = { ops: ChangeSet["ops"]; tasks: Task[]; plans: Plan[]; weekStart: WeekStart; today: string };

export default function PlanCalendarPreview({ ops, tasks, plans, weekStart, today }: Props) {
  const items = useMemo(() => previewMonthItems(ops, tasks, plans), [ops, tasks, plans]);
  const range = useMemo(() => previewRange(items), [items]);
  const [mode, setMode] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState<string | null>(null);
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const day = anchor ?? range.first;
  const month = monthOf(day);
  const week = day ? startOfPreviewWeek(day, weekStart) : "";
  const grid = useMemo(() => month && day && mode === "month" ? buildMonthGrid(month, weekStart, items, today) : [], [month, day, mode, weekStart, items, today]);
  const weeks = useMemo(() => week && mode === "week" ? previewWeeks(ops, tasks, plans, { date: week, weekStart }) : [], [week, mode, ops, tasks, plans, weekStart]);

  useEffect(() => {
    if (sheetDate && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [sheetDate]);

  if (!range.first) return null;

  const previous = mode === "month" ? shiftMonth(month, -1) : addDaysYMD(week, -7);
  const next = mode === "month" ? shiftMonth(month, 1) : addDaysYMD(week, 7);
  const firstWeek = addDaysYMD(startOfPreviewWeek(range.first, weekStart), -7);
  const lastWeek = addDaysYMD(startOfPreviewWeek(range.last, weekStart), 7);
  const minimum = mode === "month" ? shiftMonth(range.minMonth, -1) : firstWeek;
  const maximum = mode === "month" ? shiftMonth(range.maxMonth, 1) : lastWeek;
  const openWeek = (date: string) => {
    const start = startOfPreviewWeek(date, weekStart);
    setAnchor(start < firstWeek ? firstWeek : start > lastWeek ? lastWeek : date);
    setMode("week");
  };
  const openDay = (date: string) => {
    if (window.matchMedia("(max-width: 599px)").matches) setSheetDate(date);
    else openWeek(date);
  };

  return (
    <div className="plan-calendar-preview">
      <div className="preview-week-toggle" role="group" aria-label="Preview layout">
        <button type="button" aria-pressed={mode === "month"} onClick={() => setMode("month")}>Month</button>
        <button type="button" aria-pressed={mode === "week"} onClick={() => openWeek(day)}>Week</button>
      </div>
      <div className="preview-week-nav">
        <button type="button" aria-label={`Previous ${mode}`} disabled={previous < minimum} onClick={() => setAnchor(previous)}><ChevronLeft size={16} aria-hidden="true" /></button>
        <span aria-live="polite">{mode === "month" ? monthLabel.format(new Date(month)) : weekLabel(week)}</span>
        <button type="button" aria-label={`Next ${mode}`} disabled={next > maximum} onClick={() => setAnchor(next)}><ChevronRight size={16} aria-hidden="true" /></button>
      </div>
      {mode === "week" && weeks.length > 0 && <PreviewWeek key={week} weeks={weeks} selectedDate={day} />}
      {mode === "month" && (
        <div className="plan-month-grid">
          {weekdayNames.map((_, index) => <div key={index} className="plan-month-weekday">{weekdayNames[(index + weekStart) % 7]}</div>)}
          {grid.flat().map((cell) => (
            <div key={cell.date} className={`plan-month-cell${cell.inMonth ? "" : " is-outside"}${cell.isToday ? " is-today" : ""}`}>
              <button type="button" className="plan-month-day" aria-label={`${dateLabel.format(new Date(cell.date))}, ${cell.newItems.length + cell.newOverflow} new steps, ${cell.existing.length + cell.existingOverflow} existing items`} aria-current={cell.isToday ? "date" : undefined} onClick={() => openDay(cell.date)}>{Number(cell.date.slice(-2))}</button>
              <div className="plan-month-items">
                {cell.newItems.map((item) => (
                  <button key={item.key} type="button" className="plan-month-step" style={{ "--step-color": item.color ?? "var(--accent)" } as React.CSSProperties} aria-label={`${item.title}, ${item.when}${item.why ? `. ${item.why}` : ""}`} onClick={() => setSheetDate(cell.date)}>
                    <span className="plan-month-tip" aria-hidden="true"><strong>{item.title}</strong><span>{item.when}</span>{item.label && <span>{item.label}</span>}{item.why && <span>{item.why}</span>}</span>
                  </button>
                ))}
                {cell.newOverflow > 0 && <span>+{cell.newOverflow}</span>}
              </div>
              <div className="plan-month-items is-existing" aria-hidden="true">
                {cell.existing.map((item) => <i key={item.key} />)}
                {cell.existingOverflow > 0 && <span>+{cell.existingOverflow}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      <dialog ref={dialog} className="plan-day-sheet" aria-labelledby={headingId} onClose={() => setSheetDate(null)} onKeyDown={(event) => event.stopPropagation()}>
        {sheetDate && <>
          <h3 id={headingId}>{dateLabel.format(new Date(sheetDate))}</h3>
          <ul>
            {items.filter((item) => item.date === sheetDate).map((item) => (
              <li key={item.key}><strong>{item.title}</strong><span>{item.label ?? (item.kind === "new" ? "New step" : "On your calendar")} · {item.when}</span>{item.why && <span>{item.why}</span>}</li>
            ))}
          </ul>
          {!items.some((item) => item.date === sheetDate) && <p>Nothing scheduled.</p>}
          <div className="preview-card-actions">
            <button type="button" className="preview-card-btn" onClick={() => { openWeek(sheetDate); dialog.current?.close(); }}>Open week</button>
            <button type="button" className="preview-card-btn" onClick={() => dialog.current?.close()}>Close</button>
          </div>
        </>}
      </dialog>
    </div>
  );
}
