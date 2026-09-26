"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowRight, Check, Redo2 } from "lucide-react";
import type { Task } from "@/lib/types";
import { formatTime12 } from "@/lib/dates";
import { press, riseIn, rowPresence, spring } from "@/lib/motion";
import { describeReason, type UrgencySummary } from "@/lib/urgency";
import UrgencyHero from "./UrgencyHero";
import { urgencyRgbVar } from "./urgency-palette";

const VISIBLE_LIMIT = 5;

export type AttentionReceipt = {
  id: number;
  label: string;
  onUndo: () => void;
};

function headlineFor(u: UrgencySummary): string {
  const parts: string[] = [];
  if (u.overdueCount) parts.push(`${u.overdueCount} overdue`);
  if (u.slippedCount) parts.push(`${u.slippedCount} missed earlier today`);
  if (u.soonCount) parts.push(`${u.soonCount} starting soon`);
  if (u.deadlineCount) parts.push(`${u.deadlineCount} Canvas deadline${u.deadlineCount === 1 ? "" : "s"}`);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

const GUIDANCE: Record<UrgencySummary["level"], string> = {
  clear: "",
  low: "Nothing is late — this is just what’s coming up next.",
  elevated: "A few minutes here clears the way for the rest of today.",
  high: "Start with the oldest. Everything else can wait until these are handled.",
};

function dayLabel(task: Task, today: string): string | null {
  if (task.date === today) return null;
  return new Date(`${task.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function AttentionSection({
  urgency,
  today,
  nextTask,
  colorForTask,
  busyTaskId,
  receipt,
  onComplete,
  onTomorrow,
  onOpen,
  onSeeAll,
}: {
  urgency: UrgencySummary;
  today: string;
  nextTask: Task | null;
  colorForTask: (task: Task) => string;
  busyTaskId: string | null;
  receipt: AttentionReceipt | null;
  onComplete: (task: Task) => void;
  onTomorrow: (task: Task) => void;
  onOpen: (task: Task) => void;
  onSeeAll: () => void;
}) {
  const clear = urgency.level === "clear";
  const visible = urgency.items.slice(0, VISIBLE_LIMIT);
  const hidden = urgency.items.length - visible.length;

  return (
    <m.section
      variants={riseIn}
      className={`attention attention--${urgency.level}`}
      style={{
        ["--urgency-rgb" as string]: urgencyRgbVar(urgency.score),
        ["--urgency" as string]: urgency.score.toFixed(3),
        // Faster breathing as pressure rises: ~5s when calm-ish, ~1.8s at the top.
        ["--urgency-pulse" as string]: `${(5 - 3.2 * urgency.score).toFixed(2)}s`,
      }}
      aria-labelledby="attention-title"
    >
      <div className="attention-body">
        <span className="today-section-label attention-label">
          {clear ? "All clear" : "Needs attention"}
          {!clear && <span className="attention-count">{urgency.items.length}</span>}
        </span>

        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={clear ? "clear" : headlineFor(urgency)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: spring.soft }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
          >
            <h2 id="attention-title" className="attention-title">
              {clear ? "Nothing needs you right now." : headlineFor(urgency)}
            </h2>
            <p className="attention-guidance">
              {clear
                ? nextTask
                  ? <>Next up: <strong>{nextTask.title}</strong> · {dayLabel(nextTask, today) ?? "today"} at {formatTime12(nextTask.time)}</>
                  : "Your schedule is open. Capture something when it comes to you."
                : GUIDANCE[urgency.level]}
            </p>
          </m.div>
        </AnimatePresence>

        {!clear && (
          <ul className="attention-list">
            <AnimatePresence initial={false}>
              {visible.map(({ task, reason }) => {
                const busy = busyTaskId === task.id;
                const day = dayLabel(task, today);
                return (
                  <m.li key={task.id} layout="position" transition={spring.layout} {...rowPresence} className="attention-row">
                    <m.button
                      type="button"
                      className="attention-check"
                      onClick={() => onComplete(task)}
                      disabled={busy}
                      aria-label={`Complete ${task.title}`}
                      {...press}
                    >
                      <Check size={13} strokeWidth={2.6} aria-hidden="true" />
                    </m.button>
                    <span className="attention-kind" style={{ background: colorForTask(task) }} aria-hidden="true" />
                    <div className="attention-copy">
                      <button type="button" className="attention-task-title" onClick={() => onOpen(task)}>
                        {task.title}
                      </button>
                      <span className="attention-meta">
                        {day ? `${day} · ` : ""}{formatTime12(task.time)}
                      </span>
                    </div>
                    <span className={`attention-chip attention-chip--${reason.type}`}>{describeReason(reason)}</span>
                    <m.button
                      type="button"
                      className="attention-defer"
                      onClick={() => onTomorrow(task)}
                      disabled={busy}
                      aria-label={`Move ${task.title} to tomorrow`}
                      {...press}
                    >
                      <Redo2 size={13} aria-hidden="true" />
                      <span>Tomorrow</span>
                    </m.button>
                  </m.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        <div className="attention-footer">
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
        </div>
      </div>

      <UrgencyHero score={urgency.score} />
    </m.section>
  );
}
