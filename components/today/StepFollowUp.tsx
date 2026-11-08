"use client";

// Round 4 §3.4: two small questions that teach Tangent how the student works,
// both one tap and both skippable. After Done: how did it go, and how long did
// it take? The second time a step gets Not today: why? Codes only go to the
// server's step events; the optional words stay on the student's own step.

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import type { Task } from "@/lib/types";

export type FollowUp =
  | { kind: "check_in"; task: Task }
  | { kind: "why_not"; task: Task };

type Feel = "nailed" | "okay" | "struggled";
type Time = "less" | "about" | "more";

const FEELS: { id: Feel; label: string }[] = [
  { id: "nailed", label: "Nailed it" },
  { id: "okay", label: "Okay" },
  { id: "struggled", label: "Struggled" },
];
const TIMES: { id: Time; label: string }[] = [
  { id: "less", label: "Less time" },
  { id: "about", label: "About right" },
  { id: "more", label: "More time" },
];
export const WHY_NOT: { id: string; label: string }[] = [
  { id: "no_time", label: "No time" },
  { id: "unclear", label: "Unclear" },
  { id: "not_feeling_it", label: "Not feeling it" },
  { id: "blocked", label: "Blocked" },
];

type Props = {
  followUp: FollowUp;
  /** The student's reason (or null for Skip) for the Not today that's waiting. */
  onWhyNot: (task: Task, reason: string | null) => void;
  onClose: () => void;
};

export default function StepFollowUp({ followUp, onWhyNot, onClose }: Props) {
  const reduce = useReducedMotion();
  const [feel, setFeel] = useState<Feel | null>(null);
  const [time, setTime] = useState<Time | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus({ preventScroll: true }), [followUp]);

  const send = async () => {
    if (!feel && !time && !note.trim()) return onClose();
    setSaving(true);
    try {
      const res = await fetch("/api/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_in", taskId: followUp.task.id, feel, time, note: note.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string | null };
      if (data.reply) {
        setReply(data.reply);
        return;
      }
    } catch {
      /* a lost check-in only means a little less to learn from */
    } finally {
      setSaving(false);
    }
    onClose();
  };

  const motionProps = reduce
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] as const } };

  if (followUp.kind === "why_not") {
    return (
      <m.div className="step-follow" role="dialog" aria-label="Why not today?" {...motionProps}>
        <div className="step-follow-head">
          <p>What&apos;s getting in the way of “{followUp.task.title}”?</p>
          <button type="button" className="step-follow-x" onClick={() => onWhyNot(followUp.task, null)} aria-label="Skip">
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div className="step-follow-chips">
          {WHY_NOT.map((r, i) => (
            <button key={r.id} ref={i === 0 ? first : undefined} type="button" className="step-follow-chip" onClick={() => onWhyNot(followUp.task, r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <button type="button" className="step-follow-quiet" onClick={() => onWhyNot(followUp.task, null)}>Skip</button>
      </m.div>
    );
  }

  if (reply) {
    return (
      <m.div className="step-follow" role="dialog" aria-label="A note from Tangent" {...motionProps}>
        <p className="step-follow-reply">{reply}</p>
        <button type="button" className="step-follow-quiet" onClick={onClose}>Close</button>
      </m.div>
    );
  }

  return (
    <m.div className="step-follow" role="dialog" aria-label="How did it go?" {...motionProps}>
      <div className="step-follow-head">
        <p>How did “{followUp.task.title}” go?</p>
        <button type="button" className="step-follow-x" onClick={onClose} aria-label="Skip">
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <div className="step-follow-chips" role="radiogroup" aria-label="How it went">
        {FEELS.map((f, i) => (
          <button
            key={f.id}
            ref={i === 0 ? first : undefined}
            type="button"
            role="radio"
            aria-checked={feel === f.id}
            className="step-follow-chip"
            onClick={() => setFeel(feel === f.id ? null : f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="step-follow-chips" role="radiogroup" aria-label="How long it took">
        {TIMES.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={time === t.id} className="step-follow-chip" onClick={() => setTime(time === t.id ? null : t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <input
        className="step-follow-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void send()}
        placeholder="Anything to remember? (optional)"
        maxLength={280}
        aria-label="Anything to remember (optional)"
      />
      <div className="step-follow-actions">
        <button type="button" className="step-follow-quiet" onClick={onClose}>Skip</button>
        <button type="button" className="step-follow-save" onClick={() => void send()} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </m.div>
  );
}
