"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import type { Task } from "@/lib/types";

// The week as a time grid: seven day columns, hours down the side, each task a
// block at its time. This is the view people now expect from a calendar - you
// see how the day is actually shaped, where the gaps are, and what collides.
//
// Tasks have a start time but no duration, so each block is drawn a fixed
// 45 minutes tall. Two tasks within that window of each other share the column
// side by side instead of stacking on top of one another.

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_PX = 56;
const BLOCK_MIN = 45;

type Props = {
  days: Date[];
  todayYmd: string;
  tasksForDay: (ymd: string) => Task[];
  colorFor: (task: Task) => string;
  onOpenDay: (ymd: string) => void;
  onAddAt: (ymd: string, time: string) => void;
  toYMD: (d: Date) => string;
};

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function label(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function time12(time: string): string {
  const mins = minutesOf(time);
  const h = Math.floor(mins / 60);
  const mm = mins % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

/** Side-by-side lanes for tasks that would overlap within one block's height. */
function lanes(tasks: Task[]): { task: Task; lane: number; of: number }[] {
  const sorted = [...tasks].sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
  const placed: { task: Task; lane: number; of: number }[] = [];
  let cluster: { task: Task; lane: number; of: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const of = cluster.reduce((m, c) => Math.max(m, c.lane + 1), 1);
    for (const c of cluster) c.of = of;
    placed.push(...cluster);
    cluster = [];
  };
  for (const task of sorted) {
    const start = minutesOf(task.time);
    if (start >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => minutesOf(c.task.time) + BLOCK_MIN > start).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ task, lane, of: 1 });
    clusterEnd = Math.max(clusterEnd, start + BLOCK_MIN);
  }
  if (cluster.length) flush();
  return placed;
}

export default function WeekView({ days, todayYmd, tasksForDay, colorFor, onOpenDay, onAddAt, toYMD }: Props) {
  const reduced = useReducedMotion() ?? false;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  // The "now" line moves with the clock.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Open on the part of the day that matters: an hour before now, or the
  // morning when viewing another week.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasToday = days.some((d) => toYMD(d) === todayYmd);
    const hour = hasToday ? Math.max(START_HOUR, new Date().getHours() - 1) : 8;
    el.scrollTop = (hour - START_HOUR) * HOUR_PX;
    // Only when the week changes, not on every task edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toYMD(days[0])]);

  const hours = useMemo(() => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i), []);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMins - START_HOUR * 60) / 60) * HOUR_PX;

  return (
    <div className="wk">
      <div className="wk-head">
        <span className="wk-gutter" aria-hidden="true" />
        {days.map((d) => {
          const ymd = toYMD(d);
          const isToday = ymd === todayYmd;
          const count = tasksForDay(ymd).length;
          return (
            <button key={ymd} type="button" className={`wk-day-head${isToday ? " is-today" : ""}`} onClick={() => onOpenDay(ymd)}>
              <span className="wk-dow">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
              <span className="wk-date">{d.getDate()}</span>
              {count > 0 && <span className="wk-count">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="wk-scroll" ref={scrollRef}>
        <div className="wk-body" style={{ height: hours.length * HOUR_PX }}>
          <div className="wk-hours" aria-hidden="true">
            {hours.map((h) => (
              <span key={h} className="wk-hour" style={{ top: (h - START_HOUR) * HOUR_PX }}>
                {h === START_HOUR ? "" : label(h)}
              </span>
            ))}
          </div>

          {days.map((d, col) => {
            const ymd = toYMD(d);
            const isToday = ymd === todayYmd;
            const placed = lanes(tasksForDay(ymd));
            return (
              <div key={ymd} className={`wk-col${isToday ? " is-today" : ""}`}>
                {/* Each hour is a slot: clicking empty time adds a task there. */}
                {hours.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="wk-slot"
                    style={{ top: (h - START_HOUR) * HOUR_PX, height: HOUR_PX }}
                    onClick={() => onAddAt(ymd, `${String(h).padStart(2, "0")}:00`)}
                    aria-label={`Add a task on ${d.toDateString()} at ${label(h)}`}
                    tabIndex={-1}
                  />
                ))}

                {placed.map(({ task, lane, of }, i) => {
                  const start = Math.max(minutesOf(task.time), START_HOUR * 60);
                  const top = ((start - START_HOUR * 60) / 60) * HOUR_PX;
                  const color = colorFor(task);
                  return (
                    <m.button
                      key={task.id}
                      type="button"
                      className={`wk-block${task.completed ? " is-done" : ""}`}
                      style={
                        {
                          top: top + 1,
                          height: (BLOCK_MIN / 60) * HOUR_PX - 3,
                          left: `calc(${(lane / of) * 100}% + 3px)`,
                          width: `calc(${100 / of}% - 6px)`,
                          "--block": color,
                        } as React.CSSProperties
                      }
                      onClick={() => onOpenDay(ymd)}
                      initial={reduced ? false : { opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", visualDuration: 0.35, bounce: 0.15, delay: Math.min(col * 0.03 + i * 0.02, 0.3) }}
                      title={`${time12(task.time)} ${task.title}`}
                    >
                      <span className="wk-block-title">{task.title}</span>
                      <span className="wk-block-time">{time12(task.time)}</span>
                    </m.button>
                  );
                })}

                {isToday && nowMins >= START_HOUR * 60 && (
                  <span className="wk-now" style={{ top: nowTop }} aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
