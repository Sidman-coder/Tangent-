// Overnight 2, Phase 3: "Because you said…". Each plan step's reason already
// points at what it leaned on (the brief's why_ref: a fact by id, a day in the
// week, or the topic). This turns that pointer into the fact itself, in the
// student's terms: "you said you focus best at night", "Soccer ends at 5:30 PM
// on Tue, Nov 17". It rides on the step as a BECAUSE: note line
// (lib/note-parts.ts), so the brief card, task detail and the Calendar day
// panel all show it. Pure.

import { formatTime12 } from "./dates";
import { taskEndTime } from "./task-when";
import type { WhyRef } from "./ai/plan-guard";
import { usSchoolHolidays } from "./holidays";

type Fact = { id: string; text: string };
type DayTask = {
  title: string;
  date: string;
  time?: string | null;
  notes?: string | null;
  completed?: boolean;
  kind?: string | null;
  recurring?: { enabled?: boolean } | null;
};

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${DAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${MONTH[m - 1]} ${d}`;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** "You focus best at night." → "you said you focus best at night"; "I'm in band" → "you said you're in band". */
export function saidLine(fact: string): string {
  // Overnight 2 (3.4 live): a round-review answer is stored as
  // `<project> round 1, asked "<question>": <answer>` (lib/round-review.ts).
  // Quoted whole, the brief showed the app's own record. Say the answer.
  const review = fact.trim().match(/^(.+?) round (\d+), asked "[^"]*": (.+)$/);
  if (review) return `you said “${clip(review[3].trim().replace(/[.!]+$/, ""), 80)}” in your ${clip(review[1].trim(), 48)} round ${review[2]} review`;
  const t = clip(fact.trim().replace(/[.!]+$/, ""), 140);
  if (!t) return "";
  const second = t
    .replace(/^I'm\b/i, "you're")
    .replace(/^I am\b/i, "you are")
    .replace(/^I\b/, "you")
    .replace(/^My\b/i, "your");
  if (/^(you|your|you're)\b/i.test(second)) return `you said ${second.charAt(0).toLowerCase()}${second.slice(1)}`;
  return `you said “${t}”`;
}

/** What was on that day: "Soccer ends at 5:30 PM on Tue, Nov 17" or "Tue, Nov 17 is free on your calendar". */
export function calendarLine(date: string, tasks: readonly DayTask[]): string {
  const day = dayLabel(date);
  // Overnight 2 (R2-L2): on Thanksgiving the step said "School ends at 3:00 PM"
  // next to a why that said school is closed. A holiday wins over class blocks.
  const holiday = usSchoolHolidays(Number(date.slice(0, 4))).find((h) => h.date === date);
  if (holiday) return `${day} is ${holiday.name}, so most schools are closed`;
  const onDay = tasks
    .filter((t) => !t.completed && t.date === date)
    .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  if (onDay.length === 0) return `${day} is free on your calendar`;
  // Overnight 2 (AI-JUDGMENT-1 #5): the earliest timed item was often a stray
  // to-do ("Find club rules… ends at 8:05 AM"). A fixed thing the day is built
  // around (a class, practice, a shift) explains the slot; the latest one wins.
  const isTimed = (t: DayTask) => Boolean(t.time && t.time !== "23:59");
  const fixed = onDay.filter((t) => isTimed(t) && (t.kind === "school" || t.kind === "commitment" || t.recurring?.enabled));
  const timed = fixed[fixed.length - 1] ?? onDay.find(isTimed) ?? onDay[0];
  const name = clip(timed.title.trim(), 48);
  const end = timed.time && timed.time !== "23:59" ? taskEndTime({ time: timed.time, notes: timed.notes ?? undefined }) : null;
  const what = end
    ? `${name} ends at ${formatTime12(end)}`
    : timed.time && timed.time !== "23:59"
      ? `${name} is at ${formatTime12(timed.time)}`
      : `${name} is due`;
  const more = onDay.length > 1 ? `, plus ${onDay.length - 1} more` : "";
  return `${what} on ${day}${more}`;
}

/**
 * The fact a step's reason used, in the student's terms, or "" when there is
 * nothing concrete to show (no pointer, or a fact id that isn't known).
 */
export function becauseLine(ref: WhyRef | null | undefined, facts: readonly Fact[], tasks: readonly DayTask[]): string {
  if (!ref) return "";
  if (ref.kind === "fact") {
    const fact = facts.find((f) => f.id === ref.ref);
    return fact ? saidLine(fact.text) : "";
  }
  if (ref.kind === "calendar") return /^\d{4}-\d{2}-\d{2}$/.test(ref.ref) ? calendarLine(ref.ref, tasks) : "";
  const topic = clip(ref.ref.trim(), 60);
  return topic ? `you asked about “${topic}”` : "";
}
