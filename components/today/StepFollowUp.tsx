"use client";

// Round 4 §3.4: two small questions that teach Tangent how the student works,
// both one tap and both skippable. After Done: how did it go, and how long did
// it take? The second time a step gets Not today: why? Codes only go to the
// server's step events; the optional words stay on the student's own step.

import { useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import type { Task } from "@/lib/types";
import { SAVED_MS, SAVE_FAILED, saveCheckIn, savedLine } from "@/lib/check-in-save";
// Also opened from Calendar (overnight 2), so it brings its own styles.
import "./today.css";

export type FollowUp =
  /** `next`: what comes after it, already worded ("Practice dict frequency counting · Tue 3:30 PM"). */
  | { kind: "check_in"; task: Task; next?: string | null }
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
  // Overnight 2 (AI-JUDGMENT-1 #2): a step that's too big gets smaller, not just later.
  { id: "too_big", label: "Too big" },
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
  // Round 6 item 1: Save always says what happened.
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus({ preventScroll: true }), [followUp]);

  // The confirmation shows briefly, then the card closes itself. A reply from
  // Tangent stays until the student closes it.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!saved || reply) return;
    const timer = window.setTimeout(() => closeRef.current(), SAVED_MS);
    return () => window.clearTimeout(timer);
  }, [saved, reply]);

  const send = async () => {
    if (!feel && !time && !note.trim()) return onClose();
    setSaving(true);
    setFailed(false);
    const result = await saveCheckIn(fetch, {
      action: "check_in",
      taskId: followUp.task.id,
      feel,
      time,
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (result.status === "failed") {
      // The card stays open with the student's choices, ready to try again.
      setFailed(true);
      return;
    }
    setReply(result.reply);
    setSaved(true);
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

  if (saved) {
    return (
      <m.div className="step-follow" role="status" aria-live="polite" {...motionProps}>
        <div className="step-follow-head">
          <p className="step-follow-saved">
            <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>{reply ? "Saved." : savedLine(followUp.next)}</span>
          </p>
          <button type="button" className="step-follow-x" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        {reply && <p className="step-follow-reply">{reply}</p>}
        {reply && <button type="button" className="step-follow-quiet" onClick={onClose}>Close</button>}
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
      {followUp.next && <p className="step-follow-next">Next: {followUp.next}</p>}
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
      {feel && (
        <div className="step-follow-chips" role="radiogroup" aria-label="How long it took">
          {TIMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={time === t.id} className="step-follow-chip" onClick={() => setTime(time === t.id ? null : t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {feel && (
        <input
          className="step-follow-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder="Anything to remember? (optional)"
          maxLength={280}
          aria-label="Anything to remember (optional)"
        />
      )}
      {failed && (
        <p className="step-follow-failed" role="alert">
          <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>{SAVE_FAILED}</span>
        </p>
      )}
      <div className="step-follow-actions">
        <button type="button" className="step-follow-quiet" onClick={onClose}>Skip</button>
        {feel && (
          <button type="button" className="step-follow-save" onClick={() => void send()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        )}
      </div>
    </m.div>
  );
}
