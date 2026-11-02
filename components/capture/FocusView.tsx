"use client";

// "Do it now": the top task, its first step and a 25-minute ring, in the same
// lavender takeover as the mic. Done completes the task; Stop just leaves.
// The session lives in localStorage (lib/focus-timer.ts) so a reload resumes.

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { canFireDesktopNotifications } from "@/lib/desktop-notifications";
import { FOCUS_KEY, FOCUS_MINUTES, extendFocus, firstStep, remainingMs, type FocusSession } from "@/lib/focus-timer";
import { revealCircle, type Point } from "@/lib/reveal-circle";
import type { Task } from "@/lib/types";

const R = 88;
const CIRC = 2 * Math.PI * R;

export function saveFocus(s: FocusSession | null): void {
  try {
    if (s) localStorage.setItem(FOCUS_KEY, JSON.stringify(s));
    else localStorage.removeItem(FOCUS_KEY);
  } catch {
    /* private window: the session just won't survive a reload */
  }
}

function clock(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Props = {
  task: Task;
  session: FocusSession;
  origin: Point;
  onSession: (s: FocusSession) => void;
  onDone: () => void;
  onStop: () => void;
};

export default function FocusView({ task, session, origin, onSession, onDone, onStop }: Props) {
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const left = remainingMs(session, now);
  const over = left === 0;
  // The ring is a 25-minute dial; an extra 10 starts it partway round.
  const total = FOCUS_MINUTES * 60_000;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Time's up: one gentle nudge, if the student already allowed them.
  useEffect(() => {
    if (!over) return;
    try {
      if (canFireDesktopNotifications()) new Notification("Done, or 10 more minutes?", { body: task.title, tag: `focus-${task.id}` });
    } catch {
      /* the in-page prompt is enough */
    }
  }, [over, task.id, task.title]);

  const progress = Math.min(1, left / total);
  const wash = revealCircle(origin, { width: window.innerWidth, height: window.innerHeight });

  return (
    <m.div
      className="capture-wash focus-view"
      role="dialog"
      aria-modal="true"
      aria-label={`Focus: ${task.title}`}
      initial={reduced ? { opacity: 0 } : { clipPath: wash.from }}
      animate={reduced ? { opacity: 1 } : { clipPath: wash.to, transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] } }}
      exit={reduced ? { opacity: 0 } : { clipPath: wash.from, transition: { duration: 0.55, ease: [0.5, 0, 0.75, 0] } }}
    >
      {!reduced && (
        <>
          <span className="capture-blob is-one" />
          <span className="capture-blob is-two" />
        </>
      )}
      <div className="focus-body">
        <p className="capture-listening">Do it now</p>
        <h2 className="focus-title">{task.title}</h2>
        <p className="focus-step">{firstStep(task)}</p>

        <div className={`focus-ring${over ? " is-over" : ""}`}>
          <svg viewBox="0 0 200 200" width="200" height="200" aria-hidden="true">
            <circle cx="100" cy="100" r={R} className="focus-ring-track" />
            {/* Rotated in SVG, not CSS: transform-origin resolves against the viewBox corner otherwise. */}
            <circle
              cx="100"
              cy="100"
              r={R}
              className="focus-ring-fill"
              transform="rotate(-90 100 100)"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
            />
          </svg>
          <span className="focus-clock" role="timer" aria-live="off">{clock(left)}</span>
        </div>

        {over && <p className="focus-step">Done, or 10 more minutes?</p>}
        <div className="focus-actions">
          <button type="button" className="capture-chip is-primary focus-btn" onClick={onDone}>Done</button>
          {over ? (
            <button type="button" className="capture-chip focus-btn" onClick={() => onSession(extendFocus(session, Date.now()))}>+10 min</button>
          ) : (
            <button type="button" className="capture-chip focus-btn" onClick={onStop}>Stop</button>
          )}
        </div>
      </div>
    </m.div>
  );
}
