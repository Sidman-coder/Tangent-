"use client";

// Overnight 2, Phase 5 (JUDGMENT-2 N06): the one focal thing on Home when
// nothing is left today. The next step: its title on up to two lines, when,
// a Done circle, one line of why when there is one, and Move it (task detail,
// where the date changes). "Not today" only shows for a step that is today.

import { openTask } from "@/components/TaskDetail";
import { formatTime12 } from "@/lib/dates";
import { noteParts } from "@/lib/note-parts";
import { seriesColor, taskSeries } from "@/lib/task-colors";
import { formatTaskDay } from "@/lib/task-when";
import type { Plan, Task } from "@/lib/types";

type Props = {
  task: Task;
  plans: readonly Plan[];
  now: Date;
  today: string;
  timezone: string;
  busy: boolean;
  onDone: (task: Task) => void;
  onNotToday: (task: Task) => void;
};

/** The step's reason, one line: the WHY: part of its notes. */
export function whyOf(task: Pick<Task, "notes">): string | null {
  const why = noteParts(task.notes ?? "")?.find((p) => p.label === "Why")?.text.trim();
  return why ? why : null;
}

export default function NextUpCard({ task, plans, now, today, timezone, busy, onDone, onNotToday }: Props) {
  const project = task.planId ? plans.find((p) => p.id === task.planId)?.title ?? null : null;
  const time = task.time && task.time !== "23:59" ? formatTime12(task.time) : null;
  const when = [formatTaskDay(task.date, now, timezone), time].filter(Boolean).join(" · ");
  const why = whyOf(task);
  return (
    <section
      className="today-nextup"
      aria-labelledby="today-nextup-title"
      style={{ "--row-tint": seriesColor(taskSeries(task, plans)) } as React.CSSProperties}
    >
      <p className="today-nextup-label">
        Next up{project ? <span className="today-nextup-project"> · {project}</span> : null}
      </p>
      <div className="today-nextup-main">
        <button
          type="button"
          className="ui-task-check today-nextup-check"
          aria-pressed={false}
          aria-label={`Done: ${task.title}`}
          disabled={busy}
          onClick={() => onDone(task)}
        />
        <div className="today-nextup-copy">
          <h2 id="today-nextup-title" className="today-nextup-title">
            <button type="button" className="ui-task-title-button" onClick={() => openTask(task.id)}>
              {task.title}
            </button>
          </h2>
          <p className="today-nextup-when">{when}</p>
          {why && <p className="today-nextup-why">{why}</p>}
        </div>
      </div>
      <div className="today-nextup-actions">
        <button type="button" className="today-nudge-go" disabled={busy} onClick={() => openTask(task.id)}>
          Move it
        </button>
        {task.date === today && (
          <button type="button" className="today-nudge-go today-daytwo-later" disabled={busy} onClick={() => onNotToday(task)}>
            Not today
          </button>
        )}
      </div>
    </section>
  );
}
