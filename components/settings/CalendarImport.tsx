"use client";

// Bring a calendar into Tangent from a file: Google Calendar, Apple Calendar
// and Outlook all export .ics. Parsed in the browser (lib/ics.ts), shown
// first, then added through the same add_task route as everything else; the
// server skips anything already there, so importing twice is harmless.
// Live two-way sync needs a server-side connection; this is the no-setup way.

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { parseIcs, type IcsEvent } from "@/lib/ics";
import { addDaysYMD, getUserToday } from "@/lib/time";

const WINDOW_DAYS = 60;
const MAX_EVENTS = 150;

const HOW: { app: string; steps: string }[] = [
  { app: "Google Calendar", steps: "Settings → Import & export → Export. Unzip it and pick the calendar's .ics file." },
  { app: "Apple Calendar", steps: "Select the calendar, then File → Export → Export…" },
  { app: "Outlook", steps: "File → Save Calendar (or on the web: Settings → Calendar → Shared calendars → Publish, then download)." },
];

function day(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function CalendarImport() {
  const { refresh } = useAppState();
  const tz = useUserTimezone();
  const fileRef = useRef<HTMLInputElement>(null);
  const [events, setEvents] = useState<IcsEvent[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState<{ done: number; added: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHow, setShowHow] = useState(false);

  const read = async (file: File) => {
    setError(null);
    setProgress(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("That isn't a calendar file. Look for one ending in .ics.");
      const today = getUserToday(tz);
      const found = parseIcs(text, today, addDaysYMD(today, WINDOW_DAYS), MAX_EVENTS);
      if (found.length === 0) throw new Error(`Nothing in the next ${WINDOW_DAYS} days in that file.`);
      setEvents(found);
    } catch (e) {
      setEvents(null);
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  };

  const add = async () => {
    if (!events) return;
    const tally = { done: 0, added: 0, skipped: 0 };
    setProgress({ ...tally });
    const queue = [...events];
    // A few at a time: quick, without flooding the server.
    const worker = async () => {
      for (let ev = queue.shift(); ev; ev = queue.shift()) {
        try {
          const res = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "add_task",
              title: ev.title.slice(0, 200),
              date: ev.date,
              time: ev.time,
              notes: [ev.allDay ? "All day" : "", ev.location ? `At ${ev.location}` : "", `From ${fileName || "your calendar"}`].filter(Boolean).join(" · "),
            }),
          });
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean; wasDuplicate?: boolean };
          if (data.ok && !data.wasDuplicate) tally.added++;
          else tally.skipped++;
        } catch {
          tally.skipped++;
        }
        tally.done++;
        setProgress({ ...tally });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    await refresh();
    setEvents(null);
  };

  const busy = progress !== null && events !== null && progress.done < events.length;

  return (
    <div className="cal-import">
      <input
        ref={fileRef}
        type="file"
        accept=".ics,text/calendar"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void read(file);
          e.target.value = "";
        }}
      />

      {!events && (
        <div className="cal-import-row">
          <Button size="sm" onClick={() => fileRef.current?.click()}>Choose .ics file</Button>
          <button type="button" className="cal-import-how" onClick={() => setShowHow((v) => !v)}>
            {showHow ? "Hide how" : "How do I get one?"}
          </button>
        </div>
      )}

      {showHow && !events && (
        <ul className="cal-import-steps">
          {HOW.map((h) => (
            <li key={h.app}>
              <strong>{h.app}:</strong> {h.steps}
            </li>
          ))}
        </ul>
      )}

      {events && (
        <div className="cal-import-preview">
          <p>
            <strong>{events.length} event{events.length === 1 ? "" : "s"}</strong> in the next {WINDOW_DAYS} days from {fileName}.
          </p>
          <ul>
            {events.slice(0, 5).map((ev, i) => (
              <li key={`${ev.date}-${ev.time}-${i}`}>
                <span>{ev.title}</span>
                <span>{day(ev.date)}{ev.allDay ? "" : ` · ${ev.time}`}</span>
              </li>
            ))}
            {events.length > 5 && <li className="is-more">and {events.length - 5} more</li>}
          </ul>
          <div className="cal-import-row">
            <Button size="sm" variant="primary" onClick={() => void add()} loading={busy} loadingLabel={progress ? `Adding ${progress.done} of ${events.length}…` : "Adding…"}>
              Add to my calendar
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setEvents(null)} disabled={busy}>Cancel</Button>
          </div>
        </div>
      )}

      {progress && !events && (
        <p className="cal-import-done" role="status">
          Added {progress.added}{progress.skipped ? `; ${progress.skipped} were already there` : ""}. They&apos;re on your calendar under Short-term.
        </p>
      )}
      {error && <p className="cal-import-error" role="alert">{error}</p>}
    </div>
  );
}
