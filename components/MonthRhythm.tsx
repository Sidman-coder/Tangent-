"use client";

import { useRouter } from "next/navigation";
import * as m from "motion/react-m";
import type { Task } from "@/lib/types";
import { getMonthGrid, toYMD } from "@/lib/dates";
import { press, riseIn } from "@/lib/motion";
import { getMonthDensity } from "@/lib/schedule-insights";

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

export default function MonthRhythm({
  tasks,
  year,
  monthIndex,
  today,
}: {
  tasks: Task[];
  year: number;
  monthIndex: number;
  today: string;
}) {
  const router = useRouter();
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(year, monthIndex, 1));
  const cells = getMonthGrid(year, monthIndex);
  const density = getMonthDensity(tasks, year, monthIndex);

  return (
    <m.section variants={riseIn} className="dash-card month-rhythm" aria-labelledby="month-rhythm-title">
      <div className="today-section-heading dash-card-heading">
        <div>
          <span className="today-section-label">Monthly rhythm</span>
          <h2 id="month-rhythm-title">{monthName}</h2>
        </div>
        <span className="month-rhythm-legend" aria-hidden="true">
          Less
          <i className="level-0" /><i className="level-1" /><i className="level-2" /><i className="level-3" />
          More
        </span>
      </div>
      <div className="month-rhythm-weekdays" aria-hidden="true">
        {WEEKDAY_INITIALS.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
      <div className="month-rhythm-grid">
        {cells.map((date) => {
          const key = toYMD(date);
          const count = density.get(key) ?? 0;
          const outside = date.getMonth() !== monthIndex;
          const level = Math.min(3, count);
          const label = `${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}: ${count} open task${count === 1 ? "" : "s"}`;
          return (
            <m.button
              key={key}
              type="button"
              className={`month-rhythm-day level-${level}${outside ? " is-outside" : ""}${key === today ? " is-today" : ""}${key < today ? " is-past" : ""}`}
              onClick={() => router.push(`/calendar?date=${key}`)}
              aria-label={label}
              title={label}
              tabIndex={outside ? -1 : undefined}
              {...press}
              whileHover={{ scale: 1.14 }}
            >
              {date.getDate()}
            </m.button>
          );
        })}
      </div>
    </m.section>
  );
}
