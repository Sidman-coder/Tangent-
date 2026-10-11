// Pipeline V2 (B4): the pure half of adding to an existing plan or project
// (lib/pipeline/extend-plan.ts calls the model and the spacing brain). Turns
// the model's new tasks plus their placements into ChangeSet ops, the card's
// header ("Updating ICF Prep · 6 tasks → 8 tasks") and the notes on any day or
// time that spacing chose. No store, no AI: unit tested in extend-plan.test.ts.

import type { ChangeOp } from "./changeset";
import { taskOp } from "./draft";
import { addDaysYMD } from "../time";
import { formatTime12 } from "../dates";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** What extend-plan's model returns (EXTEND_JSON_SCHEMA). `date` and `time`
 *  are set only when the student said them; spacing places the rest. */
export type ExtendTask = { title: string; date: string | null; time: string | null; notes: string; startAction: string };
export type ExtendOutput = { tasks: ExtendTask[]; new_title: string | null };

export const EXTEND_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tasks", "new_title"],
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "date", "time", "notes", "startAction"],
        properties: {
          title: { type: "string" },
          date: { type: ["string", "null"] },
          time: { type: ["string", "null"] },
          notes: { type: "string" },
          startAction: { type: "string" },
        },
      },
    },
    new_title: { type: ["string", "null"] },
  },
} as const;

/** At most this many new tasks per request. */
export const MAX_NEW_TASKS = 12;

/** The model's answer, checked: bad dates and times dropped, titles that
 *  repeat an existing task left out, at most MAX_NEW_TASKS. */
export function readExtendOutput(raw: unknown, existingTitles: readonly string[]): ExtendOutput {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const seen = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  const tasks: ExtendTask[] = [];
  for (const item of Array.isArray(r.tasks) ? r.tasks : []) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const title = typeof t.title === "string" ? t.title.trim() : "";
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    const date = typeof t.date === "string" && YMD.test(t.date) ? t.date : null;
    const time = typeof t.time === "string" && HHMM.test(t.time.padStart(5, "0")) ? t.time.padStart(5, "0") : null;
    tasks.push({
      title,
      date,
      time: date ? time : null,
      notes: typeof t.notes === "string" ? t.notes.trim() : "",
      startAction: typeof t.startAction === "string" ? t.startAction.trim() : "",
    });
    if (tasks.length >= MAX_NEW_TASKS) break;
  }
  const newTitle = typeof r.new_title === "string" && r.new_title.trim() ? r.new_title.trim().slice(0, 200) : null;
  return { tasks, new_title: newTitle };
}

/**
 * The dates spacing should aim for, one per task that needs placing: the day
 * the student said, else every other day after the later of tomorrow and the
 * plan's last open task.
 */
export function targetDates(tasks: readonly ExtendTask[], today: string, lastPlanDate: string | null): string[] {
  let next = [addDaysYMD(today, 1), lastPlanDate ? addDaysYMD(lastPlanDate, 1) : ""].sort().pop()!;
  return tasks.map((t) => {
    if (t.date) return t.date;
    const d = next;
    next = addDaysYMD(next, 2);
    return d;
  });
}

export type Placed = ExtendTask & { date: string; time: string; spacedDay: boolean; spacedTime: boolean };

/** Merges the spacing brain's placements into the tasks: a date and time the
 *  student said are kept exactly; anything else is spacing's, and marked. */
export function applyPlacements(tasks: readonly ExtendTask[], placements: readonly { date: string; time: string }[]): Placed[] {
  return tasks.map((t, i) => {
    const p = placements[i];
    if (t.date && t.time) return { ...t, date: t.date, time: t.time, spacedDay: false, spacedTime: false };
    const date = t.date ?? p?.date ?? "";
    const time = p?.time ?? "16:00";
    return { ...t, date, time, spacedDay: !t.date, spacedTime: true };
  });
}

/** add_task ops (plan_id set), plus update_plan when the student renamed it.
 *  Never create_plan. */
export function extendOps(planId: string, placed: readonly Placed[], newTitle: string | null, calendarId?: string | null): ChangeOp[] {
  const ops: ChangeOp[] = [];
  if (newTitle) ops.push({ op: "update_plan", plan_id: planId, title: newTitle });
  for (const t of placed) {
    ops.push(taskOp({ title: t.title, date: t.date, time: t.time, notes: t.notes, startAction: t.startAction, calendarId }, { plan_id: planId }));
  }
  return ops;
}

/** "Updating ICF Prep · 6 tasks → 8 tasks". */
export function extendHeader(title: string, before: number, added: number): string {
  const n = (k: number) => `${k} task${k === 1 ? "" : "s"}`;
  return `Updating ${title} · ${n(before)} → ${n(before + added)}`;
}

const SHORT_DAY = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** The card's notes on what spacing chose: "Spacing picked Tue, Oct 13 at
 *  4:30 PM for Checkpoint 1". At most three, then "and N more". */
export function spacingNotes(placed: readonly Placed[]): string[] {
  const chosen = placed.filter((t) => t.spacedDay || t.spacedTime);
  const notes = chosen.slice(0, 3).map((t) =>
    t.spacedDay
      ? `Spacing picked ${SHORT_DAY(t.date)} at ${formatTime12(t.time)} for ${t.title}`
      : `Spacing picked ${formatTime12(t.time)} for ${t.title} (the day you said)`
  );
  if (chosen.length > 3) notes.push(`Spacing also placed ${chosen.length - 3} more around your busy days`);
  return notes;
}
