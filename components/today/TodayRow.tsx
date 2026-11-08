"use client";

// One row on Today: a check circle, the title, the time on the right. Must-do
// items get a stripe and weight, never a tinted background; done items stay in
// place, faded. Not today, Too big and Dismiss show on hover or focus on
// desktop, and behind ⋯ on touch.

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Check, MoreHorizontal, Redo2, Scissors, X } from "lucide-react";
import { openTask } from "@/components/TaskDetail";
import TaskTitle from "@/components/ui/TaskTitle";
import { formatTime12, isDueOnly } from "@/lib/dates";
import { rowPresence, spring } from "@/lib/motion";
import { commitmentOf } from "@/lib/task-kind";
import { formatTaskDay } from "@/lib/task-when";
import { overdueStyle } from "@/lib/today-sections";
import type { SmallerStep } from "@/lib/today-steps";
import type { Plan, Task } from "@/lib/types";

export type TodayRowActions = {
  onDone: (task: Task) => void;
  onUndone: (task: Task) => void;
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

export default function TodayRow({ task, plans, now, today, timezone, busy, hasQuestions, onDone, onUndone, onNotToday, onSplit, onDismiss }: Props) {
  const [split, setSplit] = useState<Split>({ state: "closed" });
  const [moreOpen, setMoreOpen] = useState(false);
  const overdue = overdueStyle(task, now, timezone);
  const flexible = commitmentOf(task) === "flexible";
  const earlier = task.date < today;
  const done = task.completed;
  // Today's rows sit under their project header; elsewhere the project goes on a subline.
  const planTitle = task.planId ? plans.find((p) => p.id === task.planId)?.title ?? null : null;
  const project = task.date !== today ? planTitle : null;

  const preview = async () => {
    setMoreOpen(false);
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

  const time = task.time ? (isDueOnly(task) ? `Due ${formatTime12(task.time)}` : formatTime12(task.time)) : "";
  const when =
    overdue === "soft"
      ? `Planned for ${formatTaskDay(task.date, now, timezone)}`
      : earlier
        ? formatTaskDay(task.date, now, timezone)
        : time;

  const showNotToday = !done && flexible && split.state === "closed";
  const showDismiss = !done && overdue === "hard" && earlier;
  const hasActions = showNotToday || showDismiss;
  const emphasis = !done && !flexible ? (overdue === "hard" ? "deadline" : "must") : undefined;

  return (
    <m.article
      layout="position"
      {...rowPresence}
      className={`ui-task-row today-row${done ? " is-complete" : ""}${overdue ? ` is-${overdue}` : ""}${project ? " has-subline" : ""}`}
      data-emphasis={emphasis}
    >
      <div className="ui-task-row-main">
        <button
          type="button"
          className="ui-task-check"
          aria-pressed={done}
          aria-label={done ? `Mark not done: ${task.title}` : `Done: ${task.title}`}
          disabled={busy}
          onClick={() => (done ? onUndone(task) : onDone(task))}
        >
          {done && <Check size={14} strokeWidth={2.5} className="ui-task-check-mark" aria-hidden="true" />}
        </button>
        <div className="ui-task-copy">
          <button type="button" className="ui-task-title-button today-row-title" onClick={() => openTask(task.id)}>
            <TaskTitle task={task} projectName={planTitle} />
            {hasQuestions && <span className="task-question-dot" title="Tangent has a question about this" />}
          </button>
          {project && <span className="ui-task-meta">{project}</span>}
        </div>
        {when && (
          <span className="today-row-when">
            {overdue === "hard" && <span className="today-row-late-dot" aria-hidden="true" />}
            {overdue === "hard" && <span className="sr-only">Past due, </span>}
            {when}
          </span>
        )}
        {hasActions && (
          <>
            <div className="ui-task-actions today-row-actions" data-reveal="hover" data-open={moreOpen || undefined}>
              {showNotToday && (
                <>
                  <button type="button" className="today-row-btn" onClick={() => { setMoreOpen(false); onNotToday(task); }} disabled={busy}>
                    <Redo2 size={14} strokeWidth={1.75} aria-hidden="true" /> Not today
                  </button>
                  <button type="button" className="today-row-btn" onClick={() => void preview()} disabled={busy}>
                    <Scissors size={14} strokeWidth={1.75} aria-hidden="true" /> Too big
                  </button>
                </>
              )}
              {showDismiss && (
                <button type="button" className="today-row-btn" onClick={() => { setMoreOpen(false); onDismiss(task); }} disabled={busy} aria-label={`Dismiss ${task.title}`}>
                  <X size={14} strokeWidth={1.75} aria-hidden="true" /> Dismiss
                </button>
              )}
            </div>
            <button
              type="button"
              className="today-row-more"
              aria-expanded={moreOpen}
              aria-label={`More for ${task.title}`}
              onClick={() => setMoreOpen((o) => !o)}
            >
              <MoreHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </>
        )}
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
    </m.article>
  );
}
