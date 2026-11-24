// Round 5A Phase 6: short relative times for the notifications popover
// ("just now", "5m ago", "2h ago", "Yesterday", "Mon", "Nov 3") and the
// Today / Earlier split. Pure: the caller passes now and a day function in
// the student's time zone, so tests don't depend on the clock or the machine.

import { addDaysYMD, daysBetweenYMD } from "./time";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The YYYY-MM-DD day an instant falls on, in the student's zone. */
export type DayOf = (at: Date) => string;

/** A short label for when something happened. */
export function relativeTime(iso: string, now: Date, dayOf: DayOf): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const mins = Math.floor((now.getTime() - at.getTime()) / 60000);
  const today = dayOf(now);
  const day = dayOf(at);
  if (mins < 1) return "just now";
  if (day === today) return mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
  if (day === addDaysYMD(today, -1)) return "Yesterday";
  const [y, m, d] = day.split("-").map(Number);
  if (daysBetweenYMD(day, today) < 7) return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${MONTHS[m - 1]} ${d}`;
}

/** Splits a newest-first list into Today and Earlier, keeping the order. */
export function groupByDay<T extends { timestamp: string }>(list: readonly T[], now: Date, dayOf: DayOf): { today: T[]; earlier: T[] } {
  const today = dayOf(now);
  const out = { today: [] as T[], earlier: [] as T[] };
  for (const item of list) {
    const at = new Date(item.timestamp);
    (Number.isNaN(at.getTime()) || dayOf(at) !== today ? out.earlier : out.today).push(item);
  }
  return out;
}
