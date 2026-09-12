"use client";

import { useEffect, useRef, useState } from "react";
import { toYMD, formatTime12 } from "@/lib/dates";
import { getGreeting } from "@/lib/greetings";

type Step = "login" | "schedule" | "confirm" | "splash";

const SCHOOL_DAYS = [
  { label: "M", value: 1 },
  { label: "T", value: 2 },
  { label: "W", value: 3 },
  { label: "T", value: 4 },
  { label: "F", value: 5 },
];

// Monday-first order, matching the week-strip pattern on the home page.
const CONFIRM_DAYS = [
  { label: "M", value: 1 },
  { label: "T", value: 2 },
  { label: "W", value: 3 },
  { label: "T", value: 4 },
  { label: "F", value: 5 },
  { label: "S", value: 6 },
  { label: "S", value: 0 },
];

const SPLASH_DURATION_MS = 2600; // 0.6s fade in + 1.4s hold + 0.6s fade out
const OVERLAY_LEAVE_MS = 500;

export default function FirstRun({ onComplete }: { onComplete: () => Promise<void> | void }) {
  const [step, setStep] = useState<Step>("login");
  const [leaving, setLeaving] = useState(false);

  const [name, setName] = useState("");
  const [isHS, setIsHS] = useState<boolean | null>(null);

  const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("15:00");
  const [creating, setCreating] = useState(false);

  const greetingRef = useRef<string | null>(null);
  if (step === "splash" && greetingRef.current === null) {
    greetingRef.current = getGreeting(name.trim());
  }

  useEffect(() => {
    if (step !== "splash") return;
    const t = setTimeout(() => {
      localStorage.setItem("tangent-onboarded", "true");
      setLeaving(true);
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => {
      void onComplete();
    }, OVERLAY_LEAVE_MS);
    return () => clearTimeout(t);
  }, [leaving, onComplete]);

  const toggleDay = (value: number) => {
    setActiveDays((prev) => (prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]));
  };

  const canContinueLogin = name.trim().length > 0 && isHS !== null;

  const handleLoginContinue = () => {
    if (!canContinueLogin) return;
    const trimmed = name.trim();
    localStorage.setItem("tangent-user-name", trimmed);
    localStorage.setItem("tangent-is-hs", String(isHS));
    setStep(isHS ? "schedule" : "splash");
  };

  const handleScheduleContinue = () => {
    setStep("confirm");
  };

  const handleConfirmNext = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const today = new Date();
      const end = new Date(today);
      end.setDate(end.getDate() + 16 * 7);
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_recurring_task",
          title: "School",
          date: toYMD(today),
          time: startTime,
          kind: "school",
          calendarId: "cal_personal",
          frequency: "weekly",
          daysOfWeek: activeDays,
          endDate: toYMD(end),
          notes: `Until ${formatTime12(endTime)}`,
        }),
      });
    } finally {
      setCreating(false);
    }
    setStep("splash");
  };

  return (
    <div className={`firstrun-overlay${leaving ? " is-leaving" : ""}`}>
      {step === "login" && (
        <div className="card-md firstrun-card">
          <div className="firstrun-meta"><span className="firstrun-brand-mark">T</span><span>Step 1 of 3</span></div>
          <div className="firstrun-heading-group">
            <h1 className="firstrun-h1">Make Tangent yours</h1>
            <p>A few details help us shape your day around what matters.</p>
          </div>
          <input
            type="text"
            className="neu-inset-input firstrun-input"
            placeholder="What's your name?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div>
            <p className="firstrun-question-label">Are you a high school student?</p>
            <div className="firstrun-choice-row">
              <button
                type="button"
                className={`card-sm firstrun-choice-btn${isHS === true ? " is-active" : ""}`}
                aria-pressed={isHS === true}
                onClick={() => setIsHS(true)}
              >
                Yes
              </button>
              <button
                type="button"
                className={`card-sm firstrun-choice-btn${isHS === false ? " is-active" : ""}`}
                aria-pressed={isHS === false}
                onClick={() => setIsHS(false)}
              >
                No
              </button>
            </div>
          </div>
          <button
            type="button"
            className="neu-btn-primary firstrun-continue-btn"
            disabled={!canContinueLogin}
            onClick={handleLoginContinue}
          >
            Continue
          </button>
        </div>
      )}

      {step === "schedule" && (
        <div className="card-md firstrun-card">
          <div className="firstrun-meta"><span className="firstrun-brand-mark">T</span><span>Step 2 of 3</span></div>
          <div className="firstrun-heading-group">
            <h2 className="firstrun-h2">When are you at school?</h2>
            <p>We’ll protect this time and plan the rest of your work around it.</p>
          </div>
          <div className="firstrun-day-row">
            {SCHOOL_DAYS.map((d, i) => {
              const active = activeDays.includes(d.value);
              return (
                <button
                  key={i}
                  type="button"
                  className={`card-sm firstrun-day-btn${active ? " is-active" : ""}`}
                  aria-pressed={active}
                  aria-label={`Toggle ${d.label}`}
                  onClick={() => toggleDay(d.value)}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <div className="firstrun-field">
            <label htmlFor="fr-start" className="firstrun-field-label">Starts at</label>
            <input
              id="fr-start"
              type="time"
              className="neu-inset-input firstrun-time-input"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="firstrun-field">
            <label htmlFor="fr-end" className="firstrun-field-label">Ends at</label>
            <input
              id="fr-end"
              type="time"
              className="neu-inset-input firstrun-time-input"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <button type="button" className="neu-btn-primary firstrun-continue-btn" onClick={handleScheduleContinue}>
            Continue
          </button>
        </div>
      )}

      {step === "confirm" && (
        <div className="card-md firstrun-card">
          <div className="firstrun-meta"><span className="firstrun-brand-mark">T</span><span>Step 3 of 3</span></div>
          <div className="firstrun-heading-group">
            <h2 className="firstrun-h2">Your starting rhythm</h2>
            <p>Here’s the first commitment Tangent will use to understand your capacity.</p>
          </div>
          <div className="firstrun-confirm-strip">
            {CONFIRM_DAYS.map((d, i) => (
              <div key={i} className="firstrun-confirm-day">
                <span className="firstrun-confirm-letter">{d.label}</span>
                {activeDays.includes(d.value) ? (
                  <div className="firstrun-confirm-bar" />
                ) : (
                  <div className="firstrun-confirm-bar-empty" />
                )}
              </div>
            ))}
          </div>
          <p className="firstrun-confirm-summary">
            School — {formatTime12(startTime)} to {formatTime12(endTime)}, {activeDays.length} days a week
          </p>
          <p className="firstrun-confirm-note">
            Add sports, clubs, or work anytime from Tasks or Calendar.
          </p>
          <button
            type="button"
            className="neu-btn-primary firstrun-continue-btn"
            disabled={creating}
            onClick={() => void handleConfirmNext()}
          >
            {creating ? "Setting up…" : "Next"}
          </button>
        </div>
      )}

      {step === "splash" && (
        <div className="firstrun-splash">
          <span className="firstrun-brand-mark">T</span>
          <p className="firstrun-splash-text">{greetingRef.current}</p>
        </div>
      )}
    </div>
  );
}
