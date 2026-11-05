"use client";

// The stats panel, for a project or for School. All the math is in
// lib/project-stats.ts; this only lays it out.

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useAppState } from "@/components/AppStateProvider";
import { openTask } from "@/components/TaskDetail";
import { splitCourse } from "@/lib/course";
import {
  bottleneckStep,
  nextDeadline,
  nextSteps,
  paceOf,
  progressOf,
  recommendedPace,
  schoolFocus,
  shortDate,
  workloadByWeek,
  type PaceStatus,
  type StatTask,
  type WeekLoad,
} from "@/lib/project-stats";
import "./project-stats.css";

const PACE_ICON: Record<PaceStatus, typeof CheckCircle2> = {
  "On track": CheckCircle2,
  "Slightly behind": Clock,
  Behind: AlertCircle,
};
const PACE_CLASS: Record<PaceStatus, string> = {
  "On track": "is-good",
  "Slightly behind": "is-warn",
  Behind: "is-bad",
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} hr${hours === 1 ? "" : "s"}`;
}

export default function ProjectStats({ tasks, today, school = false }: { tasks: StatTask[]; today: string; school?: boolean }) {
  const weekStart = useAppState().state?.user.weekStart ?? 0;
  const stats = useMemo(() => {
    const open = tasks.filter((t) => !t.completed);
    return {
      progress: progressOf(tasks),
      pace: paceOf(tasks, today),
      deadline: nextDeadline(tasks, today),
      next: nextSteps(open),
      focus: school ? schoolFocus(tasks, today) : bottleneckStep(tasks, today),
      sentence: recommendedPace(tasks, today),
      weeks: workloadByWeek(tasks, today, 4, weekStart),
    };
  }, [tasks, today, school, weekStart]);
  const { progress, pace, deadline, next, focus, sentence, weeks } = stats;
  const label = (t: StatTask) => splitCourse(t).title;
  const PaceIcon = PACE_ICON[pace.status];

  return (
    <section className="pstats" aria-label={school ? "School stats" : "Project stats"}>
      <div className="pstats-block">
        <div className="pstats-row">
          <h3>Progress</h3>
          <span className="pstats-figure">{progress.percent}%</span>
        </div>
        <div className="pstats-bar" aria-hidden="true">
          <span style={{ width: `${progress.percent}%` }} />
        </div>
        <p className="pstats-note">
          {progress.done} of {progress.total} done
        </p>
      </div>

      <div className="pstats-block">
        <div className="pstats-row">
          <h3>Pace</h3>
          <span className={`pstats-chip ${PACE_CLASS[pace.status]}`}>
            <PaceIcon size={13} aria-hidden="true" />
            {pace.status}
          </span>
        </div>
        <p className="pstats-note">
          {pace.remaining === 0
            ? "Nothing left to do."
            : `${plural(pace.neededThisWeek, "step")} needed this week. ${pace.doneLast7} done in the last 7 days.`}
          {pace.overdue > 0 && ` ${pace.overdue} overdue.`}
        </p>
        <p className="pstats-sentence">{sentence}</p>
      </div>

      {(deadline || next.length > 0) && (
        <div className="pstats-block">
          <h3>Coming up</h3>
          {deadline && (
            <p className="pstats-note">
              Next deadline: <strong>{label(deadline)}</strong>, {shortDate(deadline.date)}
            </p>
          )}
          {next.length > 0 && (
            <ol className="pstats-steps">
              {next.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => openTask(t.id)}>
                    <span>{label(t)}</span>
                    <time dateTime={t.date}>{shortDate(t.date)}</time>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {focus && (
        <div className="pstats-block">
          <h3>Focus</h3>
          <p className="pstats-focus">{focus.title}</p>
          <p className="pstats-note">{focus.why}</p>
        </div>
      )}

      <div className="pstats-block">
        <h3 id="pstats-weeks">Workload by week</h3>
        <WorkloadChart weeks={weeks} />
      </div>
    </section>
  );
}

const CHART = { width: 320, height: 124, top: 20, bottom: 22, bar: 30, radius: 4 };

/** A bar with its data end rounded, anchored to the baseline. */
function barPath(x: number, y: number, w: number, base: number, r: number): string {
  const radius = Math.min(r, base - y);
  return `M${x},${base}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + w - radius}Q${x + w},${y} ${x + w},${y + radius}V${base}Z`;
}

function WorkloadChart({ weeks }: { weeks: WeekLoad[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...weeks.map((w) => w.minutes), 1);
  const base = CHART.height - CHART.bottom;
  const column = CHART.width / weeks.length;
  const peak = weeks.findIndex((w) => w.minutes === max);
  const shown = active ?? (weeks[peak]?.minutes ? peak : null);

  return (
    <div className="pstats-chart" role="group" aria-labelledby="pstats-weeks" onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`}>
        <line x1={0} x2={CHART.width} y1={base} y2={base} className="pstats-axis" />
        {weeks.map((w, i) => {
          const h = w.minutes > 0 ? Math.max(4, ((base - CHART.top) * w.minutes) / max) : 0;
          const x = column * i + (column - CHART.bar) / 2;
          const on = shown === i;
          return (
            <g key={w.start}>
              {h > 0 && <path d={barPath(x, base - h, CHART.bar, base, CHART.radius)} className={`pstats-mark${active === i ? " is-on" : ""}`} />}
              {on && (
                <text x={x + CHART.bar / 2} y={base - h - 6} textAnchor="middle" className="pstats-value">
                  {duration(w.minutes)}
                </text>
              )}
              <text x={column * i + column / 2} y={CHART.height - 6} textAnchor="middle" className="pstats-tick">
                {w.label}
              </text>
              {/* Bigger than the bar: hover, tap or tab to it, empty weeks included. */}
              <rect
                x={column * i}
                y={0}
                width={column}
                height={CHART.height}
                fill="transparent"
                role="img"
                tabIndex={0}
                aria-label={`${w.label}: ${w.minutes > 0 ? `${duration(w.minutes)}, ${plural(w.count, "step")}` : "nothing planned"}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(i)}
              />
            </g>
          );
        })}
      </svg>
      <p className="pstats-note" aria-hidden="true">
        {active !== null
          ? `${weeks[active].label}: ${weeks[active].minutes > 0 ? `${duration(weeks[active].minutes)}, ${plural(weeks[active].count, "step")}` : "nothing planned"}`
          : "Estimated time on open steps."}
      </p>
    </div>
  );
}

/** The School card's small version: shape only, the card says the numbers. */
export function MiniWorkload({ weeks }: { weeks: WeekLoad[] }) {
  const max = Math.max(...weeks.map((w) => w.minutes), 1);
  return (
    <span className="pstats-mini" aria-hidden="true">
      {weeks.map((w) => (
        <span key={w.start} style={{ height: `${w.minutes > 0 ? Math.max(14, (w.minutes / max) * 100) : 6}%` }} className={w.minutes > 0 ? "" : "is-empty"} />
      ))}
    </span>
  );
}
