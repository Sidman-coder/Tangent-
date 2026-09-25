"use client";

// Lightweight, deliberately plain popover for a chat's task: a color strip and
// legend naming the task, then a small month calendar with the task's session
// dates filled in its color. No gradients, glow or spinners.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatTime12, getMonthGrid, toYMD } from "@/lib/dates";
import type { ChatTask } from "@/components/console/chatTask";

const WEEKDAY_INITIAL = ["S", "M", "T", "W", "T", "F", "S"];
const WIDTH = 264;

type Props = {
  task: ChatTask;
  anchor: DOMRect;
  onClose: () => void;
};

function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function TaskColorPopover({ task, anchor, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const today = toYMD(new Date());

  const upcoming = task.sessions.find((s) => s.date >= today && !s.completed) ?? null;
  const focus = upcoming ?? task.sessions[task.sessions.length - 1];
  const start = focus ? parseYMD(focus.date) : new Date();
  const [month, setMonth] = useState({ y: start.getFullYear(), m: start.getMonth() });

  const sessionDates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of task.sessions) counts.set(s.date, (counts.get(s.date) ?? 0) + 1);
    return counts;
  }, [task.sessions]);

  const cells = getMonthGrid(month.y, month.m);
  const inMonth = task.sessions.filter((s) => {
    const d = parseYMD(s.date);
    return d.getFullYear() === month.y && d.getMonth() === month.m;
  }).length;

  // Sit beside the anchor; flip/clamp to stay inside the viewport.
  const [pos, setPos] = useState({ top: anchor.top, left: anchor.right + 10 });
  useLayoutEffect(() => {
    const el = ref.current;
    const h = el?.offsetHeight ?? 320;
    let left = anchor.right + 10;
    if (left + WIDTH > window.innerWidth - 8) left = Math.max(8, anchor.left - WIDTH - 10);
    const top = Math.min(Math.max(8, anchor.top - 12), window.innerHeight - h - 8);
    setPos({ top, left });
  }, [anchor, month]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element;
      // Swatch buttons toggle the popover themselves.
      if (target.closest?.(".tg-chat-swatch")) return;
      if (ref.current && !ref.current.contains(target)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const shift = (delta: number) =>
    setMonth(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const monthLabel = new Date(month.y, month.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div
      ref={ref}
      className="tg-pop"
      role="dialog"
      aria-label={`${task.name} sessions`}
      style={{ top: pos.top, left: pos.left, width: WIDTH, ["--chat-color" as string]: task.color }}
    >
      <div className="tg-pop-strip" aria-hidden="true" />
      <div className="tg-pop-legend">
        <span className="tg-pop-swatch" aria-hidden="true" />
        <div className="tg-pop-legend-text">
          <span className="tg-pop-name">{task.name}</span>
          <span className="tg-pop-detail">{task.detail}</span>
        </div>
      </div>

      <div className="tg-pop-cal">
        <div className="tg-pop-cal-head">
          <span className="tg-pop-month">{monthLabel}</span>
          <div className="tg-pop-nav">
            <button type="button" aria-label="Previous month" onClick={() => shift(-1)}>
              <ChevronLeft size={14} strokeWidth={2} />
            </button>
            <button type="button" aria-label="Next month" onClick={() => shift(1)}>
              <ChevronRight size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="tg-pop-grid" role="grid">
          {WEEKDAY_INITIAL.map((d, i) => (
            <span key={i} className="tg-pop-dow">{d}</span>
          ))}
          {cells.map((d) => {
            const ymd = toYMD(d);
            const count = sessionDates.get(ymd) ?? 0;
            const outside = d.getMonth() !== month.m;
            const cls = [
              "tg-pop-day",
              outside && "is-outside",
              count > 0 && "is-session",
              ymd === today && "is-today",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <span
                key={ymd}
                className={cls}
                title={count > 0 ? `${count} session${count === 1 ? "" : "s"}` : undefined}
              >
                {d.getDate()}
              </span>
            );
          })}
        </div>
        <p className="tg-pop-count">
          {inMonth === 0 ? "No sessions this month" : `${inMonth} session${inMonth === 1 ? "" : "s"} this month`}
        </p>
      </div>

      <div className="tg-pop-foot">
        <span className="tg-pop-next">
          {upcoming
            ? `Next: ${parseYMD(upcoming.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${formatTime12(upcoming.time)}`
            : "No upcoming sessions"}
        </span>
        <Link href="/calendar" className="tg-pop-link" onClick={onClose}>
          Open calendar
        </Link>
      </div>
    </div>
  );
}
