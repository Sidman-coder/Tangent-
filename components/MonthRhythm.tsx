import type { Task } from "@/lib/types";
import { getMonthGrid, toYMD } from "@/lib/dates";
import { getMonthDensity } from "@/lib/schedule-insights";

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

export default function MonthRhythm({
  tasks,
  year,
  monthIndex,
}: {
  tasks: Task[];
  year: number;
  monthIndex: number;
}) {
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(year, monthIndex, 1));
  const cells = getMonthGrid(year, monthIndex);
  const density = getMonthDensity(tasks, year, monthIndex);

  return (
    <section className="month-rhythm" aria-labelledby="month-rhythm-title">
      <div className="month-rhythm-heading">
        <div>
          <span className="month-rhythm-label">Monthly rhythm</span>
          <h2 id="month-rhythm-title">{monthName}</h2>
        </div>
        <span className="month-rhythm-legend">Lighter to fuller</span>
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
          const label = `${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}: ${count} scheduled task${count === 1 ? "" : "s"}`;
          return (
            <span
              key={key}
              className={`month-rhythm-day level-${level}${outside ? " is-outside" : ""}`}
              aria-label={label}
              title={label}
            >
              {date.getDate()}
            </span>
          );
        })}
      </div>
    </section>
  );
}
