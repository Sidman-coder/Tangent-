"use client";

import { m, useReducedMotion } from "motion/react";
import { CalendarPlus, Check } from "lucide-react";
import type { Task } from "@/lib/types";

// What's coming, as a list: every day in the range that has anything on it,
// with its tasks in time order. The fastest way to answer "what do I have this
// week" on a phone, where a month grid can only show dots.

type Props = {
  days: Date[];
  todayYmd: string;
  tasksForDay: (ymd: string) => Task[];
  colorFor: (task: Task) => string;
  onOpenDay: (ymd: string) => void;
  onToggle: (id: string) => void;
  onAdd: (ymd: string) => void;
  toYMD: (d: Date) => string;
};

function time12(time: string): string {
  const [h, mm] = time.split(":").map(Number);
  if (!Number.isFinite(h)) return "";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(mm || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export default function AgendaView({ days, todayYmd, tasksForDay, colorFor, onOpenDay, onToggle, onAdd, toYMD }: Props) {
  const reduced = useReducedMotion() ?? false;
  const withTasks = days
    .map((d) => ({ d, ymd: toYMD(d), tasks: [...tasksForDay(toYMD(d))].sort((a, b) => a.time.localeCompare(b.time)) }))
    .filter((x) => x.tasks.length > 0 || x.ymd === todayYmd);

  if (withTasks.every((x) => x.tasks.length === 0)) {
    return (
      <div className="ag-empty">
        <span className="ag-empty-icon" aria-hidden="true">
          <CalendarPlus size={20} />
        </span>
        <strong>Nothing coming up</strong>
        <span>The next three weeks are open. Add something, or connect Canvas to bring in your assignments.</span>
        <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => onAdd(todayYmd)}>
          Add a task
        </button>
      </div>
    );
  }

  return (
    <div className="ag">
      {withTasks.map(({ d, ymd, tasks }, i) => {
        const isToday = ymd === todayYmd;
        return (
          <m.section
            key={ymd}
            className={`ag-day${isToday ? " is-today" : ""}`}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: Math.min(i * 0.04, 0.4) }}
          >
            <button type="button" className="ag-day-head" onClick={() => onOpenDay(ymd)}>
              <span className="ag-date">{d.getDate()}</span>
              <span className="ag-day-label">
                <strong>{isToday ? "Today" : d.toLocaleDateString(undefined, { weekday: "long" })}</strong>
                <span>{d.toLocaleDateString(undefined, { month: "long" })}</span>
              </span>
            </button>
            <ul className="ag-list">
              {tasks.length === 0 && <li className="ag-none">Nothing scheduled.</li>}
              {tasks.map((t) => (
                <li key={t.id} className={`ag-item${t.completed ? " is-done" : ""}`} style={{ "--item": colorFor(t) } as React.CSSProperties}>
                  <button
                    type="button"
                    className="ag-check"
                    aria-pressed={t.completed}
                    aria-label={t.completed ? `Mark ${t.title} not done` : `Mark ${t.title} done`}
                    onClick={() => onToggle(t.id)}
                  >
                    {t.completed && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                  </button>
                  <span className="ag-time">{time12(t.time)}</span>
                  <button type="button" className="ag-title" onClick={() => onOpenDay(ymd)}>
                    {t.title}
                  </button>
                </li>
              ))}
            </ul>
          </m.section>
        );
      })}
    </div>
  );
}
