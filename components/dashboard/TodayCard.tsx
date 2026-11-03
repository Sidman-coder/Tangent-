"use client";

// Today: 1-3 steps with Done, Not today and Too big (lib/today-steps.ts). Fixed
// events stay in view under them; everything else waits behind one tap, so the
// steps are the only decision on the card. Fresh start sits at the bottom.

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowRight, MessageSquareText, Play, Redo2 } from "lucide-react";
import FreshStart from "@/components/dashboard/FreshStart";
import TodayStep, { estimate, shortDay } from "@/components/dashboard/TodayStep";
import TaskRow from "@/components/ui/TaskRow";
import type { Task } from "@/lib/types";
import { formatTime12, isDueOnly } from "@/lib/dates";
import { riseIn, rowPresence, spring } from "@/lib/motion";
import { NO_TIME_LABEL, timeOfDay } from "@/lib/task-filters";
import { canAskForHelp } from "@/lib/task-help";
import type { SmallerStep } from "@/lib/today-steps";
import { describeReason, tracksCompletion, type UrgencySummary } from "@/lib/urgency";

const ATTENTION_LIMIT = 5;

/** The short "Completed … · Undo" line after acting on a row. */
export type AttentionReceipt = {
  id: number;
  label: string;
  onUndo?: () => void;
};

export default function TodayCard({
  urgency,
  steps,
  todays,
  today,
  nextTask,
  questionTaskIds,
  colorForTask,
  busyTaskId,
  receipt,
  onToggle,
  onCompleteUrgent,
  onNotToday,
  onSplit,
  onOpen,
  onHelp,
  onSeeAll,
  freshStartCount,
  backlog,
  onFreshStart,
}: {
  urgency: UrgencySummary;
  /** The 1-3 steps for today. */
  steps: Task[];
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
  onNotToday: (task: Task) => void;
  onSplit: (task: Task, pieces: SmallerStep[]) => Promise<boolean>;
  onOpen: (task: Task) => void;
  onHelp: (task: Task) => void;
  onSeeAll: () => void;
  /** How many steps Fresh start would move. */
  freshStartCount: number;
  /** Too much slipped for the automatic re-plan, so say Fresh start is there. */
  backlog: boolean;
  onFreshStart: () => Promise<boolean>;
}) {
  const urgent = urgency.items.slice(0, ATTENTION_LIMIT);
  const hidden = urgency.items.length - urgent.length;
  const left = todays.filter((t) => !t.completed && tracksCompletion(t)).length + urgency.items.length;
  const empty = urgent.length === 0 && todays.length === 0;
  // With no steps left today, what's next on the calendar still has a place.
  const next = steps.length === 0 ? nextTask : null;
  const nextEstimate = next ? estimate(next) : null;
  // The steps are shown above, so the list below doesn't repeat them.
  const shown = new Set(steps.map((t) => t.id));
  if (next) shown.add(next.id);
  const allUrgent = urgent.filter((i) => !shown.has(i.task.id));
  const rest = todays.filter((t) => !shown.has(t.id));
  // What has no time yet goes last, under its own label.
  const allToday = [...rest.filter((t) => timeOfDay(t) !== null), ...rest.filter((t) => timeOfDay(t) === null)];
  // Hick's Law: the steps are the one decision. Fixed events stay in view,
  // because they shape the day; the rest is one tap away.
  const [expanded, setExpanded] = useState(false);
  const total = allUrgent.length + allToday.length;
  const listUrgent = expanded ? allUrgent : [];
  const listToday = expanded ? allToday : allToday.filter((t) => !tracksCompletion(t));
  const collapsedCount = total - listUrgent.length - listToday.length;

  const help = (task: Task) =>
    canAskForHelp(task) ? (
      <button type="button" className="ui-task-help" onClick={() => onHelp(task)} aria-label={`Ask about ${task.title}`}>
        <MessageSquareText size={13} aria-hidden="true" />
        <span>Ask</span>
      </button>
    ) : null;

  return (
    <m.section variants={riseIn} className="today-card" aria-labelledby="today-card-title">
      <header className="today-card-head">
        <h2 id="today-card-title">Today</h2>
        <span className="today-card-meta">
          {left > 0 && <span>{left} left</span>}
        </span>
      </header>

      {steps.length > 0 && (
        <ol className="today-steps">
          <AnimatePresence initial={false}>
            {steps.map((task) => (
              <TodayStep
                key={task.id}
                task={task}
                today={today}
                reason={urgency.items.find((i) => i.task.id === task.id)?.reason ?? null}
                busy={busyTaskId === task.id}
                help={help(task)}
                onDone={() => onCompleteUrgent(task)}
                onNotToday={() => onNotToday(task)}
                onSplit={(pieces) => onSplit(task, pieces)}
                onOpen={() => onOpen(task)}
              />
            ))}
          </AnimatePresence>
        </ol>
      )}

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
            </span>
          </div>
          <button type="button" className="today-next-start" onClick={() => onOpen(next)}>
            <Play size={14} strokeWidth={2.4} aria-hidden="true" /> Start
          </button>
        </div>
      )}

      {empty && steps.length === 0 ? (
        <p className="today-card-empty">
          {next ? "Nothing else on today." : "Nothing on today. Add something above whenever it comes to you."}
        </p>
      ) : total === 0 ? null : (
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
                        onClick={() => onNotToday(task)}
                        disabled={busyTaskId === task.id}
                        aria-label={`Not today: ${task.title}`}
                      >
                        <Redo2 size={13} aria-hidden="true" />
                        <span>Not today</span>
                      </button>
                    </>
                  }
                />
              </m.div>
            ))}
            {listToday.flatMap((task, i) => [
              ...(timeOfDay(task) === null && (i === 0 || timeOfDay(listToday[i - 1]) !== null)
                ? [<p key="no-time" className="task-filter-group">{NO_TIME_LABEL}</p>]
                : []),
              <m.div key={task.id} layout="position" transition={spring.layout} {...rowPresence} className="today-card-row">
                <TaskRow
                  task={task}
                  hasQuestions={questionTaskIds.has(task.id)}
                  kindColor={colorForTask(task)}
                  onComplete={tracksCompletion(task) ? () => onToggle(task) : undefined}
                  onOpen={() => onOpen(task)}
                  actions={help(task) ?? undefined}
                />
              </m.div>,
            ])}
          </AnimatePresence>
          {(collapsedCount > 0 || expanded) && (
            <button type="button" className="today-card-more" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Show less" : `Show ${collapsedCount} more`}
            </button>
          )}
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
                {receipt.onUndo && <button type="button" onClick={receipt.onUndo}>Undo</button>}
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
      <FreshStart count={freshStartCount} backlog={backlog} onConfirm={onFreshStart} />
    </m.section>
  );
}
