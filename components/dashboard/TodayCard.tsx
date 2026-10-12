"use client";

// Today, in one list. What needs attention (overdue, missed, starting soon,
// Canvas deadlines - lib/urgency.ts) sits at the top with a chip saying why
// and a Tomorrow button; the rest of today follows. One row style throughout
// (TaskRow), so the two never read as different things.

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowRight, MessageSquareText, Play, Redo2 } from "lucide-react";
import TaskRow from "@/components/ui/TaskRow";
import type { Task } from "@/lib/types";
import { formatTime12, isDueOnly } from "@/lib/dates";
import { riseIn, rowPresence, spring } from "@/lib/motion";
import { canAskForHelp } from "@/lib/task-help";
import { describeReason, tracksCompletion, type UrgencySummary } from "@/lib/urgency";

const ATTENTION_LIMIT = 5;

/** The short "Completed … · Undo" line after acting on a row. */
export type AttentionReceipt = {
  id: number;
  label: string;
  onUndo: () => void;
};

/** "30 mins" from Tangent's "GOAL: … TIME: 30 mins." notes, if it wrote one. */
function estimate(task: Task): string | null {
  const m = /TIME:\s*([^\n.]+)/i.exec(task.notes ?? "");
  return m ? m[1].trim().replace(/\s+total$/i, "") : null;
}

function shortDay(ymd: string, today: string): string {
  if (ymd === today) return "today";
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function TodayCard({
  urgency,
  todays,
  today,
  nextTask,
  questionTaskIds,
  colorForTask,
  busyTaskId,
  receipt,
  onToggle,
  onCompleteUrgent,
  onTomorrow,
  onOpen,
  onHelp,
  onSeeAll,
}: {
  urgency: UrgencySummary;
  /** Today's tasks, minus anything already in the attention list. */
  todays: Task[];
  today: string;
  nextTask: Task | null;
  questionTaskIds: Set<string>;
  colorForTask: (task: Task) => string;
  busyTaskId: string | null;
  receipt: AttentionReceipt | null;
  onToggle: (task: Task) => void;
  onCompleteUrgent: (task: Task) => void;
  onTomorrow: (task: Task) => void;
  onOpen: (task: Task) => void;
  onHelp: (task: Task) => void;
  onSeeAll: () => void;
}) {
  const urgent = urgency.items.slice(0, ATTENTION_LIMIT);
  const hidden = urgency.items.length - urgent.length;
  const left = todays.filter((t) => !t.completed && tracksCompletion(t)).length + urgency.items.length;
  const empty = urgent.length === 0 && todays.length === 0;
  // The one thing to do now: the most pressing attention item, else the next
  // open thing today, else what's next on the calendar.
  const next =
    urgent[0]?.task ??
    todays.find((t) => !t.completed && tracksCompletion(t)) ??
    nextTask ??
    null;
  const nextEstimate = next ? estimate(next) : null;
  const nextReason = next ? urgency.items.find((i) => i.task.id === next.id)?.reason ?? null : null;
  // It's shown above, so the list below doesn't repeat it.
  const listUrgent = next ? urgent.filter((i) => i.task.id !== next.id) : urgent;
  const listToday = next ? todays.filter((t) => t.id !== next.id) : todays;

  const help = (task: Task) =>
    canAskForHelp(task) ? (
      <button type="button" className="ui-task-help" onClick={() => onHelp(task)} aria-label={`Get help with ${task.title}`}>
        <MessageSquareText size={13} aria-hidden="true" />
        <span>Help</span>
      </button>
    ) : null;

  return (
    <m.section variants={riseIn} className="today-card" aria-labelledby="today-card-title">
      <header className="today-card-head">
        <h2 id="today-card-title">Today</h2>
        <span className="today-card-meta">
          {urgency.items.length > 0 && (
            <span className="today-card-urgent">
              {urgency.items.length} need{urgency.items.length === 1 ? "s" : ""} attention
            </span>
          )}
          {left > 0 && <span>{left} left</span>}
        </span>
      </header>

      {next && (
        <div className="today-next">
          <div className="today-next-copy">
            <span className="today-next-label">Next up</span>
            <button type="button" className="today-next-title" onClick={() => onOpen(next)}>
              {next.title.replace(/\s*\[[^\]]*\]?\s*$/, "")}
            </button>
            <span className="today-next-meta">
              {isDueOnly(next) ? `Due ${shortDay(next.date, today)}` : `${shortDay(next.date, today)} at ${formatTime12(next.time)}`}
              {nextEstimate && ` · about ${nextEstimate}`}
              {nextReason && <span className={`attention-chip attention-chip--${nextReason.type}`}>{describeReason(nextReason)}</span>}
            </span>
          </div>
          <button type="button" className="today-next-start" onClick={() => onOpen(next)}>
            <Play size={14} strokeWidth={2.4} aria-hidden="true" /> Start
          </button>
        </div>
      )}

      {empty ? (
        <p className="today-card-empty">
          {next ? "Nothing else on today." : "Nothing on today. Add something above whenever it comes to you."}
        </p>
      ) : listUrgent.length + listToday.length === 0 ? null : (
        <div className="today-card-list">
          <AnimatePresence initial={false}>
            {listUrgent.map(({ task, reason }) => (
              <m.div key={task.id} layout="position" transition={spring.layout} {...rowPresence} className="today-card-row is-urgent">
                <TaskRow
                  task={task}
                  showDate={task.date !== today}
                  hasQuestions={questionTaskIds.has(task.id)}
                  kindColor={colorForTask(task)}
                  flag={<span className={`attention-chip attention-chip--${reason.type}`}>{describeReason(reason)}</span>}
                  onComplete={() => onCompleteUrgent(task)}
                  onOpen={() => onOpen(task)}
                  actions={
                    <>
                      {help(task)}
                      <button
                        type="button"
                        className="attention-defer"
                        onClick={() => onTomorrow(task)}
                        disabled={busyTaskId === task.id}
                        aria-label={`Move ${task.title} to tomorrow`}
                      >
                        <Redo2 size={13} aria-hidden="true" />
                        <span>Tomorrow</span>
                      </button>
                    </>
                  }
                />
              </m.div>
            ))}
            {listToday.map((task) => (
              <m.div key={task.id} layout="position" transition={spring.layout} {...rowPresence} className="today-card-row">
                <TaskRow
                  task={task}
                  hasQuestions={questionTaskIds.has(task.id)}
                  kindColor={colorForTask(task)}
                  onComplete={tracksCompletion(task) ? () => onToggle(task) : undefined}
                  onOpen={() => onOpen(task)}
                  actions={help(task) ?? undefined}
                />
              </m.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {(receipt || hidden > 0) && (
        <footer className="today-card-foot">
          <AnimatePresence mode="popLayout">
            {receipt && (
              <m.div
                key={receipt.id}
                className="attention-receipt"
                role="status"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: spring.soft }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
              >
                <span>{receipt.label}</span>
                <button type="button" onClick={receipt.onUndo}>Undo</button>
              </m.div>
            )}
          </AnimatePresence>
          {hidden > 0 && (
            <button type="button" className="attention-more" onClick={onSeeAll}>
              {hidden} more <ArrowRight size={13} aria-hidden="true" />
            </button>
          )}
        </footer>
      )}
    </m.section>
  );
}
