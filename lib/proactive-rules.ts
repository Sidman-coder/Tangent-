// Overnight 2, Phase 4: proactive notifications decided in plain code. A
// visit to Home or Calendar (or the daily cron) runs the check at most once
// per 4 hours per student. Only three things qualify: something overdue,
// something due within 48 hours, and a goal step that slipped and needs a new
// time. Overdue and due-soon are worded from templates here. Only the
// reschedule asks Haiku, to pick one of the open slots worked out in code.
// When nothing qualifies there is no model call at all.

import { isDueOnly } from "./dates";
import { addDaysYMD } from "./time";
import { toMinutes } from "./schedule-slots";
import { isCanvasCleared } from "./canvas-clear";
import type { Task } from "./types";

export const PROACTIVE_EVERY_MS = 4 * 60 * 60 * 1000;

/** True when the last run is older than 4 hours (or never happened). */
export function proactiveDue(lastIso: string | null | undefined, now: Date): boolean {
  if (!lastIso) return true;
  const last = Date.parse(lastIso);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= PROACTIVE_EVERY_MS;
}

/** Exams and tests are due work even with a start time. */
const GRADED = /\b(exam|test|quiz|midterm|final)\b/i;

export function isDeadline(t: Pick<Task, "source" | "time" | "title">): boolean {
  return isDueOnly(t) || GRADED.test(t.title);
}

export type ProactiveFindings = {
  /** Past its day, not done; due work and fixed items (not offered a move). */
  overdue: Task[];
  /** Deadlines in the next 48 hours, soonest first. */
  dueSoon: Task[];
  /** Goal steps that slipped: offered a new time. At most three, latest first. */
  reschedule: Task[];
};

export function proactiveFindings(
  tasks: readonly Task[],
  now: { date: string; minutes: number },
  isBusy: (t: Task) => boolean = () => false
): ProactiveFindings {
  const open = tasks.filter(
    (t) => !t.completed && t.date && !isBusy(t) && !t.recurring?.enabled && !isCanvasCleared(t, now.date)
  );
  const late = open.filter((t) => t.date < now.date);
  const movable = (t: Task) => !isDeadline(t) && t.kind !== "commitment" && t.commitment !== "fixed" && t.commitment !== "reminder";
  const reschedule = late
    .filter(movable)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const overdue = late.filter((t) => !reschedule.includes(t)).sort((a, b) => b.date.localeCompare(a.date));
  const dueSoon = open
    .filter((t) => isDeadline(t))
    .map((t) => ({ t, left: minutesUntil(t, now) }))
    .filter(({ left }) => left > 0 && left <= 48 * 60)
    .sort((a, b) => a.left - b.left)
    .map(({ t }) => t);
  return { overdue, dueSoon, reschedule };
}

export function hasFindings(f: ProactiveFindings): boolean {
  return f.overdue.length + f.dueSoon.length + f.reschedule.length > 0;
}

function minutesUntil(t: Pick<Task, "date" | "time">, now: { date: string; minutes: number }): number {
  const days = Math.round((Date.parse(`${t.date}T00:00:00Z`) - Date.parse(`${now.date}T00:00:00Z`)) / 86_400_000);
  const at = toMinutes(t.time) ?? 23 * 60 + 59;
  return days * 1440 + at - now.minutes;
}

export type Notice = {
  type: "overdue_task" | "upcoming_deadline" | "reschedule_offer";
  title: string;
  body: string;
  actionLabel?: string;
  actionData?: { taskId: string; suggestedDate?: string; suggestedTime?: string };
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const short = (s: string, n = 48) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * Overdue, worded in code. One item names it; several become one line that
 * names where to start ("3 steps are past due", which the bell merges with
 * any single ones: lib/notification-dedupe.ts). No guilt, no streaks.
 */
export function overdueNotice(overdue: readonly Task[], dayLabel: (date: string) => string): Notice | null {
  if (overdue.length === 0) return null;
  const first = overdue[0];
  if (overdue.length === 1) {
    return {
      type: "overdue_task",
      title: `Still open: ${short(first.title)}`,
      body: `It was for ${dayLabel(first.date)}. Do it when you can, or mark it done if it's handled.`,
      actionData: { taskId: first.id },
    };
  }
  return {
    type: "overdue_task",
    title: `${overdue.length} things are past due`,
    body: `Start with “${short(first.title)}” (it was for ${dayLabel(first.date)}). One at a time is fine.`,
  };
}

/** Due within 48 hours, worded in code; with what's planned for it, if anything. */
export function dueSoonNotices(
  dueSoon: readonly Task[],
  tasks: readonly Task[],
  now: { date: string },
  dayLabel: (date: string) => string,
  clock: (time: string) => string
): Notice[] {
  return dueSoon.slice(0, 2).map((t) => {
    const when = isDueOnly(t) ? `${dayLabel(t.date)}, end of day` : `${dayLabel(t.date)} at ${clock(t.time ?? "")}`;
    const prep = t.planId
      ? tasks
          .filter((o) => o.planId === t.planId && o.id !== t.id && !o.completed && o.date >= now.date && o.date <= t.date)
          .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")))[0]
      : undefined;
    const tail = prep ? `Next step for it: “${short(prep.title, 40)}”, ${dayLabel(prep.date)}.` : "Nothing else is planned for it before then.";
    return {
      type: "upcoming_deadline" as const,
      title: `Due soon: ${short(t.title)}`,
      body: `Due ${when}. ${tail}`,
      actionData: { taskId: t.id },
    };
  });
}

export type Slot = { date: string; time: string };

/** Code's own reschedule offer, used when Haiku is off, fails or picks badly. */
export function rescheduleNotice(t: Task, slot: Slot, dayLabel: (date: string) => string, clock: (time: string) => string, why?: string): Notice {
  return {
    type: "reschedule_offer",
    title: `Move “${short(t.title, 36)}”?`,
    body: why?.trim() || `It was for ${dayLabel(t.date)}. ${cap(dayLabel(slot.date))} at ${clock(slot.time)} is open.`,
    actionLabel: "Move it",
    actionData: { taskId: t.id, suggestedDate: slot.date, suggestedTime: slot.time },
  };
}

/** The window a slipped step may move into: from now to two days out. */
export function rescheduleWindow(today: string): string[] {
  return [today, addDaysYMD(today, 1), addDaysYMD(today, 2)];
}
