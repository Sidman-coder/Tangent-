"use client";

// The next seven days in one quiet row: each day, how many things are open,
// a thin bar for how full it is, and one line of advice underneath. Replaces
// the tall bar chart - the week is context for today, not a second headline.

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import * as m from "motion/react-m";
import { ArrowRight } from "lucide-react";
import type { Task } from "@/lib/types";
import { toYMD } from "@/lib/dates";
import { riseIn } from "@/lib/motion";
import type { ScheduleInsight } from "@/lib/schedule-insights";
import { tracksCompletion } from "@/lib/urgency";

export default function WeekStrip({ tasks, now, insight }: { tasks: Task[]; now: Date; insight: ScheduleInsight }) {
  const router = useRouter();
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        const ymd = toYMD(date);
        const open = tasks.filter((t) => t.date === ymd && !t.completed && tracksCompletion(t)).length;
        return { date, ymd, open };
      }),
    [now, tasks]
  );
  // A full day is about five things; a lighter week still shows its shape.
  const peak = Math.max(5, ...days.map((d) => d.open));
  const { link } = insight;

  return (
    <m.section variants={riseIn} className="week-strip" aria-labelledby="week-strip-title">
      <header className="week-strip-head">
        <h2 id="week-strip-title">This week</h2>
        <p>
          <strong>{insight.title}.</strong> {insight.detail}
          {link && (
            <button
              type="button"
              className="week-strip-link"
              onClick={() => router.push(`/calendar?date=${link.date}${link.time ? `&add=1&time=${link.time}` : ""}`)}
            >
              {link.label} <ArrowRight size={12} aria-hidden="true" />
            </button>
          )}
        </p>
      </header>
      <div className="week-strip-days">
        {days.map((day, i) => {
          const label = `${day.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}: ${day.open} open`;
          // How full the day is, 0-1: the cell's shade. Heavier days are darker.
          const load = day.open === 0 ? 0 : Math.max(0.18, day.open / peak);
          return (
            <button
              key={day.ymd}
              type="button"
              className={`week-strip-day${i === 0 ? " is-today" : ""}${load >= 0.55 ? " is-dark" : ""}`}
              style={{ "--load": load.toFixed(2) } as React.CSSProperties}
              onClick={() => router.push(`/calendar?date=${day.ymd}`)}
              aria-label={label}
              title={label}
            >
              <span className="week-strip-name">{i === 0 ? "Today" : day.date.toLocaleDateString("en-US", { weekday: "short" })}</span>
              <span className="week-strip-num">{day.date.getDate()}</span>
              <span className="week-strip-count">{day.open ? `${day.open} open` : "Free"}</span>
            </button>
          );
        })}
      </div>
    </m.section>
  );
}
