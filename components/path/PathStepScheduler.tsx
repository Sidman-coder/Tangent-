"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Check, Clock } from "lucide-react";
import ActionReceipt from "@/components/ActionReceipt";
import type { PathNode, PathNodeSchedule, SuggestedSlot } from "@/lib/types";
import { formatTime12, WEEKDAY_SHORT } from "@/lib/dates";
import { weekdayOf } from "@/lib/time";

// A kept branch's first step, on the calendar. Keeping a branch and scheduling
// it are separate choices: this only appears once the branch is kept, and
// nothing here changes the branch itself. "Not now" writes nothing.
//
// What it shows is derived from the tasks linked to the node (the server's
// `scheduled` map), so it always agrees with Calendar and Today.

type Props = {
  node: PathNode;
  schedule: PathNodeSchedule | undefined;
  /** Open the time picker straight away (right after "Keep this"). */
  autoOpen: boolean;
  /** Reload the path after anything changed. */
  onChanged: () => Promise<void> | void;
};

/** "Tue 4:30 PM" */
export function slotLabel(date: string, time: string): string {
  return `${WEEKDAY_SHORT[weekdayOf(date)]} ${formatTime12(time)}`;
}

async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch("/api/path", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error ?? "Couldn't do that just now."));
  return data;
}

export default function PathStepScheduler({ node, schedule, autoOpen, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<SuggestedSlot[] | null>(null);
  const [custom, setCustom] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ actionId: string; label: string } | null>(null);

  const canSchedule = node.kind === "idea" && node.status === "accepted";
  const active = schedule?.active;

  // A different node in the panel starts clean.
  useEffect(() => {
    setOpen(false);
    setSlots(null);
    setCustom(false);
    setError(null);
    setReceipt(null);
  }, [node.id]);

  const openPicker = async () => {
    setOpen(true);
    setCustom(false);
    setError(null);
    setSlots(null);
    try {
      const data = await call({ action: "suggestTimes", nodeId: node.id });
      setSlots((data.slots as SuggestedSlot[]) ?? []);
    } catch (e) {
      setSlots([]);
      setError(e instanceof Error ? e.message : "Couldn't find open times.");
    }
  };

  useEffect(() => {
    if (autoOpen && canSchedule && !active) void openPicker();
    // Only when the flag turns on for this node.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, node.id]);

  const schedule_ = async (date: string, time: string) => {
    // The chips are disabled while this runs, but the database is what
    // actually guarantees one open step per branch.
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const data = await call({ action: "scheduleStep", nodeId: node.id, date, time });
      setOpen(false);
      const actionId = data.actionId as string | null;
      if (actionId) setReceipt({ actionId, label: `On your calendar · ${slotLabel(date, time)}` });
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't put it on your calendar.");
      // "Already on your calendar": show the state that is actually there.
      await onChanged();
    } finally {
      setPending(false);
    }
  };

  // Nothing linked and not schedulable (a suggestion, a dismissed branch, a
  // piece of work): nothing to show.
  if (!canSchedule && !active && !schedule?.lastDone) return null;

  let status: React.ReactNode = null;
  let offer: string | null = null;
  if (active && !active.missed) {
    status = (
      <p className="path-step-status is-on">
        <CalendarPlus size={14} aria-hidden="true" />
        On your calendar · {slotLabel(active.date, active.time)}
      </p>
    );
  } else if (active) {
    status = (
      <p className="path-step-status is-missed">
        <Clock size={14} aria-hidden="true" />
        Missed · {slotLabel(active.date, active.time)}
      </p>
    );
    offer = "Put it on your calendar";
  } else if (schedule?.lastDone) {
    status = (
      <p className="path-step-status is-done">
        <Check size={14} aria-hidden="true" />
        Done · {slotLabel(schedule.lastDone.date, schedule.lastDone.time)}
      </p>
    );
    offer = "Put another on your calendar";
  } else {
    offer = "Put it on your calendar";
  }
  if (!canSchedule) offer = null;

  return (
    <section className="path-inspector-part path-step" aria-label="First step on your calendar">
      {receipt && active && !active.missed ? (
        <ActionReceipt actionId={receipt.actionId} label={receipt.label} onUndone={() => void onChanged()} />
      ) : (
        status
      )}
      {active && !active.missed && (
        <Link href="/calendar" className="path-step-link">
          See it in Calendar
        </Link>
      )}

      {offer && !open && (
        <button type="button" className="path-btn is-accent path-step-offer" onClick={() => void openPicker()}>
          <CalendarPlus size={15} aria-hidden="true" />
          {offer}
        </button>
      )}

      {open && (
        <div className="path-step-picker">
          <h3>When do you want to start?</h3>
          {slots === null ? (
            <p className="path-step-hint">Looking at your calendar…</p>
          ) : slots.length > 0 ? (
            <>
              <p className="path-step-hint">Open times on your calendar</p>
              <div className="path-step-chips" role="group" aria-label="Open times">
                {slots.map((s) => (
                  <button
                    key={`${s.date} ${s.time}`}
                    type="button"
                    className="path-step-chip"
                    disabled={pending}
                    onClick={() => void schedule_(s.date, s.time)}
                  >
                    <span>{slotLabel(s.date, s.time)}</span>
                    {s.afterSchool && <small>after school</small>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            !error && <p className="path-step-hint">No open times this week. Pick one yourself.</p>
          )}

          {custom && (
            <form
              className="path-step-custom"
              onSubmit={(e) => {
                e.preventDefault();
                if (customDate && customTime) void schedule_(customDate, customTime);
              }}
            >
              <input
                type="date"
                aria-label="Day"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                required
              />
              <input
                type="time"
                aria-label="Time"
                value={customTime}
                step={300}
                onChange={(e) => setCustomTime(e.target.value)}
                required
              />
              <button type="submit" className="path-btn is-primary" disabled={pending || !customDate || !customTime}>
                {pending ? "Adding…" : "Add"}
              </button>
            </form>
          )}

          <div className="path-step-row">
            {!custom && (
              <button type="button" className="path-btn" disabled={pending} onClick={() => setCustom(true)}>
                Pick a time
              </button>
            )}
            <button
              type="button"
              className="path-btn is-quiet"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="path-step-error" role="status">
          {error}
        </p>
      )}
    </section>
  );
}
