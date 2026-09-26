"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import * as m from "motion/react-m";
import { ArrowRight } from "lucide-react";
import type { Task } from "@/lib/types";
import { toYMD } from "@/lib/dates";
import { riseIn, spring } from "@/lib/motion";
import type { ScheduleInsight } from "@/lib/schedule-insights";
import { tracksCompletion } from "@/lib/urgency";

const DAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];

/** Rolling seven days from today — on a Friday, "this week" should still
 *  show the weekend and Monday, not four days that already happened. */
export default function WeekAhead({ tasks, now, insight }: { tasks: Task[]; now: Date; insight: ScheduleInsight }) {
  const router = useRouter();

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        const ymd = toYMD(date);
        const dayTasks = tasks.filter((t) => t.date === ymd);
        return {
          date,
          ymd,
          open: dayTasks.filter((t) => !t.completed && tracksCompletion(t)).length,
          school: dayTasks.some((t) => t.kind === "school" && t.source !== "canvas"),
        };
      }),
    [now, tasks]
  );

  const total = days.reduce((sum, d) => sum + d.open, 0);
  const peak = Math.max(3, ...days.map((d) => d.open));
  const busiest = days.reduce((a, b) => (b.open > a.open ? b : a), days[0]);
  const { link } = insight;

  return (
    <m.section variants={riseIn} className="dash-card week-ahead" aria-labelledby="week-ahead-title">
      <div className="today-section-heading dash-card-heading">
        <div>
          <span className="today-section-label">Next 7 days</span>
          <h2 id="week-ahead-title">Week ahead</h2>
        </div>
        <span>{total} open task{total === 1 ? "" : "s"}</span>
      </div>

      <div className="week-ahead-bars">
        {days.map((day, index) => {
          const isToday = index === 0;
          const isPeak = day.open > 0 && day === busiest;
          const label = `${day.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}: ${day.open} open task${day.open === 1 ? "" : "s"}${day.school ? ", school day" : ""}`;
          return (
            <button
              key={day.ymd}
              type="button"
              className={`week-ahead-day${isToday ? " is-today" : ""}${isPeak ? " is-peak" : ""}`}
              onClick={() => router.push(`/calendar?date=${day.ymd}`)}
              aria-label={label}
              title={label}
            >
              <span className="week-ahead-track">
                <m.span
                  className="week-ahead-fill"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: day.open / peak }}
                  transition={{ ...spring.soft, delay: 0.12 + index * 0.03 }}
                />
              </span>
              <span className="week-ahead-count">{day.open || ""}</span>
              <span className="week-ahead-letter">{isToday ? "Today" : DAY_LETTER[day.date.getDay()]}</span>
            </button>
          );
        })}
      </div>

      <div className="week-ahead-insight">
        <p>
          <strong>{insight.title}.</strong> {insight.detail}
        </p>
        {link && (
          <button
            type="button"
            className="week-ahead-link"
            onClick={() => router.push(`/calendar?date=${link.date}${link.time ? `&add=1&time=${link.time}` : ""}`)}
          >
            {link.label} <ArrowRight size={12} aria-hidden="true" />
          </button>
        )}
      </div>
    </m.section>
  );
}
