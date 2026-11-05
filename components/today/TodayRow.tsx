"use client";

// One row on Today, the same in every section: a colored stripe, the title, one
// muted line for when, and the actions. Done is always there; flexible steps
// also get Not today and Too big. Color stays on the stripe, never on text.

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Check, Redo2, Scissors, X } from "lucide-react";
import { openTask } from "@/components/TaskDetail";
import TaskTitle from "@/components/ui/TaskTitle";
import { formatTime12 } from "@/lib/dates";
import { rowPresence, spring } from "@/lib/motion";
import { seriesColor, taskSeries } from "@/lib/task-colors";
import { commitmentOf } from "@/lib/task-kind";
import { formatTaskDay, formatTaskWhen, taskEndTime } from "@/lib/task-when";
import { overdueStyle } from "@/lib/today-sections";
import type { SmallerStep } from "@/lib/today-steps";
import type { Plan, Task } from "@/lib/types";

export type TodayRowActions = {
  onDone: (task: Task) => void;
  onNotToday: (task: Task) => void;
  onSplit: (task: Task, pieces: SmallerStep[]) => Promise<boolean>;
  onDismiss: (task: Task) => void;
};

type Props = TodayRowActions & {
  task: Task;
  plans: readonly Plan[];
  now: Date;
  today: string;
  timezone: string;
  busy?: boolean;
  hasQuestions?: boolean;
};

type Split =
  | { state: "closed" }
  | { state: "loading" }
  | { state: "failed" }
  | { state: "ready"; pieces: SmallerStep[]; saving: boolean };

export default function TodayRow({ task, plans, now, today, timezone, busy, hasQuestions, onDone, onNotToday, onSplit, onDismiss }: Props) {
  const [split, setSplit] = useState<Split>({ state: "closed" });
  const overdue = overdueStyle(task, now, timezone);
  const flexible = commitmentOf(task) === "flexible";
  const earlier = task.date < today;
  const project = task.planId ? plans.find((p) => p.id === task.planId)?.title : null;

  const preview = async () => {
    setSplit({ state: "loading" });
    try {
      const res = await fetch("/api/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "split_preview", taskId: task.id }),
      });
      const data = (await res.json()) as { ok?: boolean; steps?: SmallerStep[] };
      if (!res.ok || !data.ok || !data.steps?.length) throw new Error("no steps");
      setSplit({ state: "ready", pieces: data.steps, saving: false });
    } catch {
      setSplit({ state: "failed" });
    }
  };

  const use = async (pieces: SmallerStep[]) => {
    setSplit({ state: "ready", pieces, saving: true });
    if (!(await onSplit(task, pieces))) setSplit({ state: "ready", pieces, saving: false });
  };

  const when =
    overdue === "hard"
      ? `Overdue · was ${earlier || !task.time ? formatTaskDay(task.date, now, timezone) : formatTime12(task.time)}`
      : overdue === "soft"
        ? `Planned for ${formatTaskDay(task.date, now, timezone)}`
        : formatTaskWhen({ date: task.date, time: task.time, endTime: taskEndTime(task) }, now, timezone);

  return (
    <m.article
      layout="position"
      {...rowPresence}
      className={`today-row${overdue ? ` is-${overdue}` : ""}${flexible ? " is-flexible" : ""}`}
      style={{ "--row-color": overdue === "hard" ? "var(--red)" : seriesColor(taskSeries(task, plans)) } as React.CSSProperties}
    >
      <span className="today-row-stripe" aria-hidden="true" />
      <div className="today-row-body">
        <button type="button" className="today-row-open" onClick={() => openTask(task.id)}>
          <span className="today-row-title">
            <TaskTitle task={task} />
            {hasQuestions && <span className="task-question-dot" title="Tangent has a question about this" />}
          </span>
          <span className="today-row-meta">
            <span className={overdue ? "today-row-when" : undefined}>{when}</span>
            {project && <span className="today-row-project"> · {project}</span>}
          </span>
        </button>
        <div className="today-row-actions">
          {flexible && split.state === "closed" && (
            <>
              <button type="button" className="today-row-btn" onClick={() => onNotToday(task)} disabled={busy}>
                <Redo2 size={14} aria-hidden="true" /> Not today
              </button>
              <button type="button" className="today-row-btn" onClick={() => void preview()} disabled={busy}>
                <Scissors size={14} aria-hidden="true" /> Too big
              </button>
            </>
          )}
          {overdue === "hard" && earlier && (
            <button type="button" className="today-row-btn" onClick={() => onDismiss(task)} disabled={busy} aria-label={`Dismiss ${task.title}`}>
              <X size={14} aria-hidden="true" /> Dismiss
            </button>
          )}
          <button type="button" className="today-row-btn is-done" onClick={() => onDone(task)} disabled={busy} aria-label={`Done: ${task.title}`}>
            <Check size={15} aria-hidden="true" /> Done
          </button>
        </div>
        <AnimatePresence initial={false}>
          {split.state !== "closed" && (
            <m.div
              key="split"
              className="today-step-split"
              role="status"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto", transition: spring.soft }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.14 } }}
            >
              {split.state === "loading" && <p>Breaking it down…</p>}
              {split.state === "failed" && (
                <>
                  <p>Couldn&apos;t break it down right now.</p>
                  <div className="today-step-actions">
                    <button type="button" className="today-row-btn" onClick={() => void preview()}>Try again</button>
                    <button type="button" className="today-row-btn" onClick={() => setSplit({ state: "closed" })}>Keep as is</button>
                  </div>
                </>
              )}
              {split.state === "ready" && (
                <>
                  <ol>
                    {split.pieces.map((piece) => (
                      <li key={piece.title}>
                        <span>{piece.title}</span>
                        <time>{piece.minutes} min</time>
                      </li>
                    ))}
                  </ol>
                  <div className="today-step-actions">
                    <button type="button" className="today-row-btn is-done" disabled={split.saving} onClick={() => void use(split.pieces)}>
                      {split.saving ? "Saving…" : "Use these"}
                    </button>
                    <button type="button" className="today-row-btn" disabled={split.saving} onClick={() => setSplit({ state: "closed" })}>Keep as is</button>
                  </div>
                </>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </m.article>
  );
}
