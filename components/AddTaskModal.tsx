"use client";

import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { getUserToday } from "@/lib/time";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Sparkles } from "lucide-react";
import { putAsk } from "@/lib/ask-handoff";
import type { TaskCommitment } from "@/lib/types";

type Frequency = "daily" | "weekly" | "monthly" | "yearly";

interface Props {
  initialDate?: string;
  initialTime?: string;
  initialCalendarId?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
  onDuplicate?: () => void;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Round 4 Phase 4.2: what kind of task, in the student's words. */
const TYPES: { value: TaskCommitment; label: string; hint: string }[] = [
  { value: "fixed", label: "Must-do", hint: "Has to happen then" },
  { value: "flexible", label: "Goal step", hint: "Moves you toward something bigger" },
  { value: "reminder", label: "Reminder", hint: "Just a nudge" },
];

const NEW_PROJECT = "__new__";

/** "Don't ask again" for one project, kept on this device. */
const buildAskKey = (planId: string) => `tangent-build-ask-off:${planId}`;
function buildAskOff(planId: string): boolean {
  try {
    return window.localStorage.getItem(buildAskKey(planId)) === "1";
  } catch {
    return false;
  }
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

export default function AddTaskModal({ initialDate, initialTime, initialCalendarId = null, onClose, onSuccess, onDuplicate }: Props) {
  const tz = useUserTimezone();
  const router = useRouter();
  const { state } = useAppState();
  const plans = state?.plans ?? [];
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => initialDate ?? getUserToday(tz));
  const [time, setTime] = useState(initialTime ?? "09:00");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Round 4 Phase 4.2: which project, and what kind of task.
  const [projectId, setProjectId] = useState<string>("");
  const [newProject, setNewProject] = useState("");
  const [type, setType] = useState<TaskCommitment>("fixed");
  const [typeTouched, setTypeTouched] = useState(false);
  /** After adding to a project: "Want Tangent to build on this?" */
  const [buildAsk, setBuildAsk] = useState<{ planId: string; planTitle: string; taskTitle: string } | null>(null);
  const [dontAsk, setDontAsk] = useState(false);

  // Recurring
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [endDate, setEndDate] = useState(() => `${getUserToday(tz).slice(0, 4)}-12-31`);

  // A step in a project is usually a goal step, a Personal task a must-do,
  // until the student picks a type themself.
  useEffect(() => {
    if (!typeTouched) setType(projectId ? "flexible" : "fixed");
  }, [projectId, typeTouched]);

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
    if (projectId === NEW_PROJECT && !newProject.trim()) {
      setError("Name the new project, or pick Personal.");
      return;
    }
    setSubmitting(true);
    setError(null);
    let planId: string | null = projectId && projectId !== NEW_PROJECT ? projectId : null;
    let planTitle = plans.find((p) => p.id === planId)?.title ?? "";

    // Every one of these used to be fire-and-forget: the response was never
    // checked, so a failed request still closed the modal and reported success,
    // and the task simply didn't exist. Failures now keep the modal open and say
    // what happened.
    try {
      if (projectId === NEW_PROJECT) {
        const res = await fetch("/api/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", title: newProject.trim() }),
        });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; plan?: { id: string; title: string } } | null;
        if (!res.ok || !data?.plan) {
          setError(data?.error ?? `Couldn't make the project (${res.status}).`);
          return;
        }
        planId = data.plan.id;
        planTitle = data.plan.title;
        // A retry after a later failure uses this project, not a second one.
        setProjectId(planId);
        setNewProject("");
      }
      if (recurringEnabled) {
        if (frequency === "weekly" && daysOfWeek.length === 0) {
          setError("Pick at least one day of the week.");
          return;
        }
        const res = await fetch("/api/tasks", {
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
            planId,
            commitment: type,
          }),
        });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; count?: number } | null;
        if (!res.ok || data?.ok === false) {
          setError(data?.error ?? `Couldn't add the task (${res.status}).`);
          return;
        }
        if (data?.count === 0) {
          setError("That repeat rule produced no dates. Check the day and end date.");
          return;
        }
      } else {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add_task",
            title: title.trim(),
            date,
            time,
            calendarId: initialCalendarId,
            notes: notes.trim() || undefined,
            planId,
            commitment: type,
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string; wasDuplicate?: boolean }
          | null;
        if (!res.ok || data?.ok === false) {
          setError(data?.error ?? `Couldn't add the task (${res.status}).`);
          return;
        }
        if (data?.wasDuplicate) onDuplicate?.();
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      return;
    } finally {
      setSubmitting(false);
    }

    onSuccess?.();
    // Added to a project: offer to build on it, unless they said not to ask.
    if (planId && !buildAskOff(planId)) {
      setBuildAsk({ planId, planTitle, taskTitle: title.trim() });
      return;
    }
    onClose();
  };

  const answerBuild = (yes: boolean) => {
    if (!buildAsk) return;
    if (dontAsk) {
      try {
        window.localStorage.setItem(buildAskKey(buildAsk.planId), "1");
      } catch {
        /* storage blocked: it just asks again next time */
      }
    }
    if (yes) {
      // The project's own ask box shows the extend-plan preview, with Add and Undo.
      putAsk("ai", `I just added "${buildAsk.taskTitle}" to ${buildAsk.planTitle}. Build on it: suggest the next steps after it.`);
      router.push(`/projects/${encodeURIComponent(buildAsk.planId)}?ask=1`);
    }
    onClose();
  };

  if (buildAsk) {
    return (
      <div className="modal-overlay" onClick={() => answerBuild(false)}>
        <div
          className="modal add-build-ask"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-build-title"
          style={{ maxWidth: 420 }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="add-build-icon" aria-hidden="true">
            <Sparkles size={18} strokeWidth={1.75} />
          </span>
          <h3 id="add-build-title">Want Tangent to build on this in {buildAsk.planTitle}?</h3>
          <p className="add-build-copy">
            It suggests the next steps after &ldquo;{buildAsk.taskTitle}&rdquo;. You see them first; nothing is added until you say so.
          </p>
          <label className="add-build-dont">
            <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} />
            Don&apos;t ask again for this project
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-ghost surface-action-secondary" onClick={() => answerBuild(false)}>
              No thanks
            </button>
            <button type="button" className="btn surface-action-primary" autoFocus onClick={() => answerBuild(true)}>
              Yes, build on it
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal add-task-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-task-heading"
        style={{ maxWidth: 500 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="add-task-heading">Add a task</h3>

        <div className="field">
          <label htmlFor="add-task-title">Title</label>
          <input
            id="add-task-title"
            name="title"
            autoFocus
            placeholder="What needs doing?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !recurringEnabled) void handleSubmit(); }}
          />
        </div>

        <div className="add-task-when">
          <div className="field">
            <label htmlFor="add-task-date">{recurringEnabled ? "Start date" : "Date"}</label>
            <input id="add-task-date" name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="add-task-time">Time</label>
            <input id="add-task-time" name="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="add-task-project">Project</label>
          <select id="add-task-project" name="project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Personal</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
            <option value={NEW_PROJECT}>+ New project…</option>
          </select>
          {projectId === NEW_PROJECT && (
            <input
              className="add-task-new-project"
              name="new-project"
              autoFocus
              placeholder="Name the project"
              aria-label="New project name"
              maxLength={120}
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
            />
          )}
        </div>

        <fieldset className="field add-task-type">
          <legend>Type</legend>
          <div className="add-task-type-options">
            {TYPES.map((t) => (
              <label key={t.value} className={`add-task-type-option${type === t.value ? " is-on" : ""}`} title={t.hint}>
                <input
                  type="radio"
                  name="task-type"
                  value={t.value}
                  checked={type === t.value}
                  onChange={() => {
                    setType(t.value);
                    setTypeTouched(true);
                  }}
                />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label htmlFor="add-task-notes">Description (optional)</label>
          <textarea
            id="add-task-notes"
            name="notes"
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
              <label htmlFor="add-task-frequency">Frequency</label>
              <select id="add-task-frequency" name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            {frequency === "weekly" && (
              <div className="field">
                <label id="add-task-dow">Days of the week</label>
                <div className="dow-checkboxes" role="group" aria-labelledby="add-task-dow">
                  {DOW_LABELS.map((label, i) => (
                    <label key={i} className={`dow-chip${daysOfWeek.includes(i) ? " selected" : ""}`}>
                      <input
                        name="days-of-week"
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
              <label htmlFor="add-task-until">Repeat until</label>
              <input
                id="add-task-until"
                name="until"
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

        {error && (
          <div className="form-error" role="alert">
            {error}
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
                ? `Add ${occurrenceCount > 0 ? occurrenceCount : ""} task${occurrenceCount !== 1 ? "s" : ""}`
                : "Add task"}
          </button>
        </div>
      </div>
    </div>
  );
}
