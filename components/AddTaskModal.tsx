"use client";

import { useEffect, useMemo, useState } from "react";
import { Repeat } from "lucide-react";

type Frequency = "daily" | "weekly" | "monthly" | "yearly";

interface Props {
  initialDate?: string;
  initialCalendarId?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function endOfYearStr() {
  return `${new Date().getFullYear()}-12-31`;
}

function countOccurrences(
  startDate: string,
  endDate: string,
  frequency: Frequency,
  daysOfWeek: number[]
): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  if (start > end) return 0;
  let count = 0;
  const current = new Date(start);
  const max = 365;
  while (current <= end && count < max) {
    if (frequency === "daily") {
      count++;
    } else if (frequency === "weekly") {
      if (daysOfWeek.includes(current.getDay())) count++;
    } else if (frequency === "monthly") {
      if (current.getDate() === start.getDate()) count++;
    } else if (frequency === "yearly") {
      if (current.getMonth() === start.getMonth() && current.getDate() === start.getDate()) count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export default function AddTaskModal({ initialDate, initialCalendarId = null, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate ?? todayStr());
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Recurring
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [endDate, setEndDate] = useState(endOfYearStr());

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleDow = (d: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const occurrenceCount = useMemo(() => {
    if (!recurringEnabled) return 0;
    return countOccurrences(date, endDate, frequency, daysOfWeek);
  }, [recurringEnabled, date, endDate, frequency, daysOfWeek]);

  const freqLabel = (f: Frequency): string => {
    if (f === "daily") return "Every day";
    if (f === "weekly") {
      if (daysOfWeek.length === 0) return "Weekly";
      if (daysOfWeek.length === 7) return "Every day of the week";
      return `Every ${daysOfWeek.map((d) => DOW_LABELS[d]).join(", ")}`;
    }
    if (f === "monthly") return "Every month";
    if (f === "yearly") return "Every year";
    return "";
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);

    try {
      if (recurringEnabled) {
        // Validate weekly needs at least one day selected
        if (frequency === "weekly" && daysOfWeek.length === 0) {
          alert("Please select at least one day of the week.");
          setSubmitting(false);
          return;
        }
        console.log("[AddTaskModal] Submitting recurring task:", title, frequency, daysOfWeek, date, endDate);
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add_recurring_task",
            title: title.trim(),
            date,
            time,
            calendarId: initialCalendarId,
            frequency,
            daysOfWeek: frequency === "weekly" ? daysOfWeek : undefined,
            endDate,
            notes: notes.trim() || undefined,
          }),
        });
      } else {
        console.log("[AddTaskModal] Submitting single task:", title, date, time);
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add_task",
            title: title.trim(),
            date,
            time,
            calendarId: initialCalendarId,
            notes: notes.trim() || undefined,
          }),
        });
      }
    } finally {
      setSubmitting(false);
    }

    onSuccess?.();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <h3>Add Task</h3>

        <div className="field">
          <label>Title</label>
          <input
            autoFocus
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !recurringEnabled) void handleSubmit(); }}
          />
        </div>

        <div className="field">
          <label>{recurringEnabled ? "Start date" : "Date"}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="field">
          <label>Time</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>

        <div className="field">
          <label>Description (optional)</label>
          <textarea
            rows={2}
            placeholder="Any details or guidance for this task…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ resize: "vertical", minHeight: "3.5rem" }}
          />
        </div>

        {/* Recurring toggle */}
        <div className="recurring-toggle-row">
          <label className="recurring-toggle-label">
            <span>Recurring task</span>
            <button
              type="button"
              role="switch"
              aria-checked={recurringEnabled}
              className={`toggle-switch${recurringEnabled ? " on" : ""}`}
              onClick={() => setRecurringEnabled((v) => !v)}
            >
              <span className="toggle-knob" />
            </button>
          </label>
        </div>

        {recurringEnabled && (
          <div className="recurring-section">
            <div className="field">
              <label>Frequency</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            {frequency === "weekly" && (
              <div className="field">
                <label>Days of the week</label>
                <div className="dow-checkboxes">
                  {DOW_LABELS.map((label, i) => (
                    <label key={i} className={`dow-chip${daysOfWeek.includes(i) ? " selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={daysOfWeek.includes(i)}
                        onChange={() => toggleDow(i)}
                        style={{ display: "none" }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="field">
              <label>Repeat until</label>
              <input
                type="date"
                value={endDate}
                min={date}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="recurring-preview">
              <span className="recurring-icon"><Repeat size={16} strokeWidth={1.75} /></span>
              {occurrenceCount > 0
                ? `${freqLabel(frequency)} — will create ${occurrenceCount} task${occurrenceCount !== 1 ? "s" : ""}`
                : frequency === "weekly" && daysOfWeek.length === 0
                  ? "Select at least one day"
                  : "No occurrences in range"}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-ghost surface-action-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn surface-action-primary"
            onClick={() => void handleSubmit()}
            disabled={submitting || !title.trim() || (recurringEnabled && frequency === "weekly" && daysOfWeek.length === 0)}
          >
            {submitting
              ? "Adding…"
              : recurringEnabled
                ? `Add ${occurrenceCount > 0 ? occurrenceCount : ""} Task${occurrenceCount !== 1 ? "s" : ""}`
                : "Add Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
