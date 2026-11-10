// "When are you already busy?" (Round 4 Phase 6): the times a student is
// already spoken for, such as school, practice, work, lessons or family. Each
// commitment has a repeat and one or more time blocks ("Mon–Fri 7:45–2:50
// plus Wed 3:30–5:30"), and goes on the calendar as recurring busy tasks with
// an "Until" note, so planning never puts work inside it (dayBusy in
// lib/schedule-slots.ts).
//
// No table: the tasks are the record. Each block's series id carries the
// commitment's kind and repeat (seriesIdFor), so Settings → Schedule can read
// the commitments back from the calendar exactly as they were saved. Pure, so
// it can be tested and used on the client.

import { CAL_OTHER, CAL_SCHOOL } from "./calendars";
import { formatTime12 } from "./dates";
import type { SchoolHours } from "./onboarding";
import { schoolEndFromNotes } from "./schedule-slots";
import { addDaysYMD, weekdayOf } from "./time";
import type { Task } from "./types";

export const COMMITMENT_KINDS = ["school", "practice", "work", "lessons", "family", "other"] as const;
export type CommitmentKind = (typeof COMMITMENT_KINDS)[number];

export const COMMITMENT_KIND_LABELS: Record<CommitmentKind, string> = {
  school: "School",
  practice: "Practice",
  work: "Work",
  lessons: "Tutoring/lessons",
  family: "Family",
  other: "Other",
};

/** Which week of the month a monthly commitment falls in; -1 is the last. */
export type MonthWeek = 1 | 2 | 3 | 4 | -1;

export type Repeat =
  | { kind: "weekdays" }
  | { kind: "weekly" }
  | { kind: "biweekly" }
  | { kind: "monthly"; week: MonthWeek }
  | { kind: "custom"; everyWeeks: number };

export type RepeatKind = Repeat["kind"];

export const REPEAT_OPTIONS: readonly { id: RepeatKind; label: string }[] = [
  { id: "weekdays", label: "Every weekday" },
  { id: "weekly", label: "Weekly on chosen days" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Monthly" },
  { id: "custom", label: "Custom" },
];

export const MONTH_WEEK_OPTIONS: readonly { id: MonthWeek; label: string }[] = [
  { id: 1, label: "1st" },
  { id: 2, label: "2nd" },
  { id: 3, label: "3rd" },
  { id: 4, label: "4th" },
  { id: -1, label: "Last" },
];

/** One time block: these days, from start to end ("HH:MM", 24-hour). */
export type TimeBlock = { days: number[]; start: string; end: string };

export type Commitment = {
  /** The series key once saved ("cmt_…"); absent for a new one. */
  id?: string;
  kind: CommitmentKind;
  name: string;
  repeat: Repeat;
  blocks: TimeBlock[];
};

export const MAX_COMMITMENTS = 12;
export const MAX_BLOCKS = 6;
/** How far ahead the busy blocks run, as the School block always has. */
export const COMMITMENT_WEEKS = 16;
export const WEEKDAYS = [1, 2, 3, 4, 5];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_EVERY_WEEKS = 8;

// ─── Parsing ────────────────────────────────────────────────────────────────

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function isCommitmentKind(v: unknown): v is CommitmentKind {
  return typeof v === "string" && (COMMITMENT_KINDS as readonly string[]).includes(v);
}

export function parseRepeat(raw: unknown): Repeat | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  switch (r.kind) {
    case "weekdays":
    case "weekly":
    case "biweekly":
      return { kind: r.kind };
    case "monthly": {
      const week = Number(r.week);
      return { kind: "monthly", week: week === -1 || (week >= 1 && week <= 4) ? (week as MonthWeek) : 1 };
    }
    case "custom": {
      const every = Math.round(Number(r.everyWeeks));
      if (!Number.isFinite(every)) return null;
      return { kind: "custom", everyWeeks: Math.min(MAX_EVERY_WEEKS, Math.max(1, every)) };
    }
    default:
      return null;
  }
}

export function parseBlock(raw: unknown): TimeBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (!Array.isArray(b.days) || typeof b.start !== "string" || typeof b.end !== "string") return null;
  const days = Array.from(new Set(b.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort((x, y) => x - y);
  if (days.length === 0 || !TIME.test(b.start) || !TIME.test(b.end)) return null;
  if (minutesOf(b.end) <= minutesOf(b.start)) return null;
  return { days, start: b.start, end: b.end };
}

/** One commitment as sent by the client, or null when it has no usable block. */
export function parseCommitment(raw: unknown): Commitment | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const kind = isCommitmentKind(c.kind) ? c.kind : "other";
  const repeat = parseRepeat(c.repeat) ?? { kind: "weekly" };
  const blocks = (Array.isArray(c.blocks) ? c.blocks : [])
    .map(parseBlock)
    .filter((b): b is TimeBlock => b !== null)
    .map((b) => (repeat.kind === "weekdays" ? { ...b, days: b.days.filter((d) => WEEKDAYS.includes(d)) } : b))
    .filter((b) => b.days.length > 0)
    .slice(0, MAX_BLOCKS);
  if (blocks.length === 0) return null;
  const name = (typeof c.name === "string" ? c.name : "").replace(/\s+/g, " ").trim().slice(0, 40) || COMMITMENT_KIND_LABELS[kind];
  const out: Commitment = { kind, name, repeat, blocks };
  if (typeof c.id === "string" && /^cmt_[a-z0-9_]{1,60}$/i.test(c.id)) out.id = c.id;
  return out;
}

/** A list from the client: invalid entries dropped, at most MAX_COMMITMENTS.
 *  Null when the value isn't a list at all. */
export function parseCommitments(raw: unknown): Commitment[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .map(parseCommitment)
    .filter((c): c is Commitment => c !== null)
    .slice(0, MAX_COMMITMENTS);
}

// ─── New commitments in the editor ──────────────────────────────────────────

const DEFAULT_BLOCK: Record<CommitmentKind, TimeBlock> = {
  school: { days: WEEKDAYS, start: "08:00", end: "15:00" },
  practice: { days: [1, 3], start: "15:30", end: "17:30" },
  work: { days: [6], start: "10:00", end: "14:00" },
  lessons: { days: [2], start: "16:00", end: "17:00" },
  family: { days: [0], start: "12:00", end: "14:00" },
  other: { days: [4], start: "16:00", end: "17:00" },
};

export function newCommitment(kind: CommitmentKind): Commitment {
  return {
    kind,
    name: kind === "other" ? "" : COMMITMENT_KIND_LABELS[kind],
    repeat: kind === "school" ? { kind: "weekdays" } : { kind: "weekly" },
    blocks: [{ ...DEFAULT_BLOCK[kind], days: [...DEFAULT_BLOCK[kind].days] }],
  };
}

/** Another block for the same commitment: an hour after the last one. */
export function nextBlock(c: Commitment): TimeBlock {
  const last = c.blocks[c.blocks.length - 1] ?? DEFAULT_BLOCK[c.kind];
  const start = Math.min(minutesOf(last.end) + 30, 22 * 60);
  return { days: [last.days[0] ?? 3], start: hhmm(start), end: hhmm(Math.min(start + 60, 23 * 60 + 30)) };
}

/** Why a commitment can't be saved yet, or null when it can. */
export function commitmentProblem(c: Commitment): string | null {
  if (c.kind === "other" && !c.name.trim()) return "Give it a name.";
  if (c.blocks.length === 0) return "Add a time.";
  for (const b of c.blocks) {
    if (b.days.length === 0) return "Pick at least one day.";
    if (!TIME.test(b.start) || !TIME.test(b.end) || minutesOf(b.end) <= minutesOf(b.start)) return "End after it starts.";
  }
  return null;
}

// ─── Dates ──────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/** The Sunday a date's week starts on. */
function weekOf(date: string): string {
  return addDaysYMD(date, -weekdayOf(date));
}

function daysInMonth(date: string): number {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function everyWeeksOf(r: Repeat): number {
  if (r.kind === "biweekly") return 2;
  if (r.kind === "custom") return r.everyWeeks;
  return 1;
}

/** The dates one block lands on from `from` through `to`. Every-N-weeks
 *  repeats count weeks from the week of `from`, the day it was saved. */
export function blockDates(repeat: Repeat, block: TimeBlock, from: string, to: string): string[] {
  const out: string[] = [];
  const anchor = weekOf(from);
  const every = everyWeeksOf(repeat);
  for (let d = from; d <= to; d = addDaysYMD(d, 1)) {
    const wd = weekdayOf(d);
    if (!block.days.includes(wd)) continue;
    if (repeat.kind === "weekdays" && !WEEKDAYS.includes(wd)) continue;
    if (repeat.kind === "monthly") {
      const day = Number(d.slice(8));
      const nth = Math.ceil(day / 7);
      const ok = repeat.week === -1 ? day + 7 > daysInMonth(d) : nth === repeat.week;
      if (!ok) continue;
    } else if (every > 1 && (daysBetween(anchor, weekOf(d)) / 7) % every !== 0) {
      continue;
    }
    out.push(d);
  }
  return out;
}

// ─── On the calendar ────────────────────────────────────────────────────────

const REPEAT_CODE = /^(wd|w[1-8]|m[1-4L])$/;

function repeatCode(r: Repeat): string {
  if (r.kind === "weekdays") return "wd";
  if (r.kind === "monthly") return `m${r.week === -1 ? "L" : r.week}`;
  return `w${everyWeeksOf(r)}`;
}

function repeatFromCode(code: string): Repeat {
  if (code === "wd") return { kind: "weekdays" };
  if (code.startsWith("m")) return { kind: "monthly", week: code === "mL" ? -1 : (Number(code.slice(1)) as MonthWeek) };
  const n = Number(code.slice(1));
  if (n === 1) return { kind: "weekly" };
  if (n === 2) return { kind: "biweekly" };
  return { kind: "custom", everyWeeks: n };
}

export const COMMITMENT_SERIES_PREFIX = "cmt_";

/** "cmt_<stamp>_<commitment>_<block>_<kind>_<repeat>", e.g.
 *  "cmt_lq3x9a_0_1_practice_w2". */
export function seriesIdFor(stamp: string, index: number, blockIndex: number, c: Commitment): string {
  return `${COMMITMENT_SERIES_PREFIX}${stamp}_${index}_${blockIndex}_${c.kind}_${repeatCode(c.repeat)}`;
}

type SeriesParts = { key: string; index: number; blockIndex: number; kind: CommitmentKind; repeat: Repeat };

export function parseSeriesId(id: string | undefined | null): SeriesParts | null {
  const m = /^cmt_([a-z0-9]+)_(\d+)_(\d+)_([a-z]+)_([a-zA-Z0-9]+)$/.exec(id ?? "");
  if (!m || !isCommitmentKind(m[4]) || !REPEAT_CODE.test(m[5])) return null;
  return {
    key: `cmt_${m[1]}_${m[2]}`,
    index: Number(m[2]),
    blockIndex: Number(m[3]),
    kind: m[4],
    repeat: repeatFromCode(m[5]),
  };
}

export function isCommitmentTask(t: Pick<Task, "recurring">): boolean {
  return parseSeriesId(t.recurring?.parentId) !== null;
}

export function untilNote(end: string): string {
  return `Until ${formatTime12(end)}`;
}

/** Every busy task for a list of commitments, from `today` for COMMITMENT_WEEKS. */
export function commitmentTasks(list: Commitment[], today: string, stamp: string): Omit<Task, "id">[] {
  const endDate = addDaysYMD(today, COMMITMENT_WEEKS * 7);
  const out: Omit<Task, "id">[] = [];
  list.forEach((c, index) => {
    c.blocks.forEach((block, blockIndex) => {
      const parentId = seriesIdFor(stamp, index, blockIndex, c);
      const school = c.kind === "school";
      for (const date of blockDates(c.repeat, block, today, endDate)) {
        out.push({
          title: c.name,
          date,
          time: block.start,
          completed: false,
          kind: school ? "school" : "commitment",
          commitment: "fixed",
          calendarId: school ? CAL_SCHOOL : CAL_OTHER,
          notes: untilNote(block.end),
          recurring: {
            enabled: true,
            frequency: c.repeat.kind === "monthly" ? "monthly" : "weekly",
            daysOfWeek: [...block.days],
            endDate,
            parentId,
          },
        });
      }
    });
  });
  return out;
}

/** The commitments the calendar holds, in the order they were saved. */
export function commitmentsFromTasks(tasks: Task[]): Commitment[] {
  const series = new Map<string, { parts: SeriesParts; sample: Task }>();
  for (const t of tasks) {
    const id = t.recurring?.parentId;
    const parts = parseSeriesId(id);
    if (!id || !parts) continue;
    const seen = series.get(id);
    if (!seen || t.date < seen.sample.date) series.set(id, { parts, sample: t });
  }
  const byKey = new Map<string, { index: number; c: Commitment; blocks: { i: number; b: TimeBlock }[] }>();
  for (const { parts, sample } of Array.from(series.values())) {
    const endMin = schoolEndFromNotes(sample.notes);
    const block = parseBlock({ days: sample.recurring?.daysOfWeek ?? [], start: sample.time, end: endMin === null ? "" : hhmm(endMin) });
    if (!block) continue;
    let entry = byKey.get(parts.key);
    if (!entry) {
      entry = { index: parts.index, c: { id: parts.key, kind: parts.kind, name: sample.title, repeat: parts.repeat, blocks: [] }, blocks: [] };
      byKey.set(parts.key, entry);
    }
    entry.blocks.push({ i: parts.blockIndex, b: block });
  }
  return Array.from(byKey.values())
    .sort((a, b) => (a.c.id! < b.c.id! ? -1 : a.c.id! > b.c.id! ? 1 : a.index - b.index))
    .map((e) => ({ ...e.c, blocks: e.blocks.sort((a, b) => a.i - b.i).map((x) => x.b) }));
}

/** The School block from before commitments existed, as a commitment. */
export function commitmentFromSchool(hours: SchoolHours): Commitment {
  const weekdays = hours.days.length === 5 && WEEKDAYS.every((d) => hours.days.includes(d));
  return {
    kind: "school",
    name: "School",
    repeat: weekdays ? { kind: "weekdays" } : { kind: "weekly" },
    blocks: [{ days: [...hours.days].sort((a, b) => a - b), start: hours.start, end: hours.end }],
  };
}

// ─── Words ──────────────────────────────────────────────────────────────────

/** "Mon–Fri", "Mon, Wed", "Weekends". */
export function formatDays(days: number[]): string {
  const sorted = Array.from(new Set(days)).sort((a, b) => a - b);
  if (sorted.length === 7) return "Every day";
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) return "Weekends";
  const consecutive = sorted.length >= 3 && sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (consecutive) return `${DAY_SHORT[sorted[0]]}–${DAY_SHORT[sorted[sorted.length - 1]]}`;
  return sorted.map((d) => DAY_SHORT[d]).join(", ");
}

/** "3:30 – 5:30 PM", "7:45 AM – 2:50 PM". */
export function formatSpan(start: string, end: string): string {
  const a = formatTime12(start);
  const b = formatTime12(end);
  const [aTime, aPart] = a.split(" ");
  return aPart === b.split(" ")[1] ? `${aTime} – ${b}` : `${a} – ${b}`;
}

export function formatBlock(b: TimeBlock): string {
  return `${formatDays(b.days)} ${formatSpan(b.start, b.end)}`;
}

export function formatRepeat(r: Repeat): string {
  switch (r.kind) {
    case "weekdays":
      return "Every weekday";
    case "weekly":
      return "Every week";
    case "biweekly":
      return "Every 2 weeks";
    case "monthly":
      return `The ${MONTH_WEEK_OPTIONS.find((o) => o.id === r.week)?.label.toLowerCase() ?? "1st"} week of the month`;
    case "custom":
      return r.everyWeeks === 1 ? "Every week" : `Every ${r.everyWeeks} weeks`;
  }
}

/** "Practice · Every 2 weeks · Mon, Wed 3:30 – 5:30 PM + Sat 9 – 11 AM". */
export function summarizeCommitment(c: Commitment): string {
  return [c.name, formatRepeat(c.repeat), c.blocks.map(formatBlock).join(" + ")].join(" · ");
}

/** The fact Tangent keeps: "You're busy with Practice every 2 weeks: Mon,
 *  Wed 3:30 – 5:30 PM." */
export function commitmentFact(c: Commitment): string {
  const when = c.blocks.map(formatBlock).join(" and ");
  const repeat = c.repeat.kind === "weekdays" || c.repeat.kind === "weekly" || (c.repeat.kind === "custom" && c.repeat.everyWeeks === 1) ? "" : ` ${formatRepeat(c.repeat).toLowerCase()}`;
  return `You're busy with ${c.name}${repeat}: ${when}.`;
}
