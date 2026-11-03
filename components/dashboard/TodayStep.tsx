"use client";

// One of today's 1-3 steps. Too big opens a preview of smaller steps right here:
// nothing changes until the student picks Use these, and it can be undone.

import { useState } from "react";
import * as m from "motion/react-m";
import { Check, Redo2, Scissors } from "lucide-react";
import { formatTime12, isDueOnly } from "@/lib/dates";
import { rowPresence, spring } from "@/lib/motion";
import type { SmallerStep } from "@/lib/today-steps";
import type { Task } from "@/lib/types";
import { describeReason, type AttentionReason } from "@/lib/urgency";

type Split =
  | { state: "closed" }
  | { state: "loading" }
  | { state: "failed" }
  | { state: "ready"; pieces: SmallerStep[]; saving: boolean };

/** "30 mins" from Tangent's "GOAL: … TIME: 30 mins." notes, if it wrote one. */
export function estimate(task: Task): string | null {
  const m = /TIME:\s*([^\n.]+)/i.exec(task.notes ?? "");
  return m ? m[1].trim().replace(/\s+total$/i, "") : null;
}

export function shortDay(ymd: string, today: string): string {
  if (ymd === today) return "today";
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function TodayStep({
  task,
  today,
  reason,
  busy,
  help,
  onDone,
  onNotToday,
  onSplit,
  onOpen,
}: {
  task: Task;
  today: string;
  reason: AttentionReason | null;
  busy: boolean;
  help: React.ReactNode;
  onDone: () => void;
  onNotToday: () => void;
  onSplit: (pieces: SmallerStep[]) => Promise<boolean>;
  onOpen: () => void;
}) {
  const [split, setSplit] = useState<Split>({ state: "closed" });
  const time = estimate(task);
  const when = isDueOnly(task) ? `Due ${shortDay(task.date, today)}` : `${shortDay(task.date, today)} at ${formatTime12(task.time)}`;

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
    if (!(await onSplit(pieces))) setSplit({ state: "ready", pieces, saving: false });
  };

  return (
    <m.li layout="position" transition={spring.layout} {...rowPresence} className="today-step">
      <div className="today-step-copy">
        <button type="button" className="today-step-title" onClick={onOpen}>
          {task.title.replace(/\s*\[[^\]]*\]?\s*$/, "")}
        </button>
        <span className="today-step-meta">
          {when}
          {time && ` · about ${time}`}
          {reason && <span className={`attention-chip attention-chip--${reason.type}`}>{describeReason(reason)}</span>}
        </span>
      </div>

      <div className="today-step-actions">
        <button type="button" className="today-step-btn is-primary" onClick={onDone} disabled={busy}>
          <Check size={15} strokeWidth={2.4} aria-hidden="true" /> Done
        </button>
        <button type="button" className="today-step-btn" onClick={onNotToday} disabled={busy}>
          <Redo2 size={14} aria-hidden="true" /> Not today
        </button>
        <button
          type="button"
          className="today-step-btn"
          onClick={() => void preview()}
          disabled={busy || split.state !== "closed"}
          aria-expanded={split.state !== "closed"}
        >
          <Scissors size={14} aria-hidden="true" /> Too big
        </button>
        {help}
      </div>

      {split.state !== "closed" && (
        <div className="today-step-split" role="status">
          {split.state === "loading" && <p>Breaking it down…</p>}
          {split.state === "failed" && (
            <>
              <p>Couldn&apos;t break it down right now.</p>
              <div className="today-step-actions">
                <button type="button" className="today-step-btn" onClick={() => void preview()}>Try again</button>
                <button type="button" className="today-step-btn" onClick={() => setSplit({ state: "closed" })}>Keep as is</button>
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
                <button
                  type="button"
                  className="today-step-btn is-primary"
                  onClick={() => void use(split.pieces)}
                  disabled={split.saving}
                >
                  Use these
                </button>
                <button
                  type="button"
                  className="today-step-btn"
                  onClick={() => setSplit({ state: "closed" })}
                  disabled={split.saving}
                >
                  Keep as is
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </m.li>
  );
}
