"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { DEFAULT_SCHOOL_HOURS, formatSchoolHours, parseSchoolHours, type SchoolHours } from "@/lib/onboarding";

const DAYS: { day: number; short: string; name: string }[] = [
  { day: 1, short: "Mon", name: "Monday" },
  { day: 2, short: "Tue", name: "Tuesday" },
  { day: 3, short: "Wed", name: "Wednesday" },
  { day: 4, short: "Thu", name: "Thursday" },
  { day: 5, short: "Fri", name: "Friday" },
  { day: 6, short: "Sat", name: "Saturday" },
  { day: 0, short: "Sun", name: "Sunday" },
];

type Msg = { tone: "success" | "error"; text: string } | null;

/** School hours: the one School block Tangent never plans inside. Saving
 *  replaces the block; clearing removes it. */
export default function SchoolHoursEditor({ current, onSaved }: { current: SchoolHours | null | undefined; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SchoolHours>(current ?? DEFAULT_SCHOOL_HOURS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    if (!editing) setDraft(current ?? DEFAULT_SCHOOL_HOURS);
  }, [current, editing]);

  const valid = parseSchoolHours(draft);

  const save = async (hours: SchoolHours | null) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolHours: hours }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMsg({ tone: "error", text: data.error ?? "Couldn't save school hours. Try again." });
        return;
      }
      await onSaved();
      setEditing(false);
      setMsg({ tone: "success", text: hours ? "School hours saved." : "School hours cleared." });
    } catch {
      setMsg({ tone: "error", text: "Couldn't reach Tangent. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  const toggleDay = (day: number) =>
    setDraft((d) => ({ ...d, days: d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day].sort((a, b) => a - b) }));

  return (
    <div className={`settings-row${editing ? " is-stacked" : ""}`}>
      <div className="settings-row-copy">
        <strong>School hours</strong>
        <span>{current ? formatSchoolHours(current) : "Not set"}. Tangent never plans work inside them.</span>
        {msg && <FormMessage tone={msg.tone}>{msg.text}</FormMessage>}
      </div>
      {!editing ? (
        <Button size="sm" onClick={() => { setMsg(null); setEditing(true); }}>{current ? "Edit" : "Set"}</Button>
      ) : (
        <form
          className="settings-edit-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) void save(valid);
          }}
        >
          <fieldset className="settings-fieldset">
            <legend className="settings-legend">Days</legend>
            <div className="settings-days">
              {DAYS.map(({ day, short, name }) => (
                <button key={day} type="button" className="settings-day" aria-pressed={draft.days.includes(day)} aria-label={name} onClick={() => toggleDay(day)}>
                  {short}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="settings-times">
            <label htmlFor="school-start">From</label>
            <input id="school-start" type="time" className="settings-input" value={draft.start} onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))} required />
            <label htmlFor="school-end">to</label>
            <input id="school-end" type="time" className="settings-input" value={draft.end} onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))} required />
          </div>
          {!valid && <FormMessage tone="error">Pick at least one day, and an end after the start.</FormMessage>}
          <div className="settings-edit-actions">
            <Button type="submit" size="sm" variant="primary" disabled={!valid} loading={busy} loadingLabel="Saving…">Save</Button>
            {current && (
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void save(null)}>No school hours</Button>
            )}
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
