// The one way a task's date and time are written: "Tue, Nov 4 · 3:30 PM".
// Every list row and tooltip uses this, so a date never reads two ways.
//
// A task's date and time are already the student's wall clock, so the weekday
// comes from the date itself and a clock change can't shift it. The timezone
// only decides which year "now" is, for showing the year on far-off dates.

import { minutesFromNotes } from "./load";
import { schoolEndFromNotes } from "./schedule-slots";
import { getUserToday } from "./time";
import type { Task } from "./types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Minutes since midnight, or null when it isn't a clock time. */
function parseClock(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function clockParts(total: number): { label: string; period: "AM" | "PM" } {
  const hours = Math.floor(total / 60);
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return {
    label: `${twelve}:${String(total % 60).padStart(2, "0")}`,
    period: hours < 12 ? "AM" : "PM",
  };
}

/** "3:30 PM", "3:30–4:15 PM", "11:30 AM–12:15 PM". A time we can't read is shown as it is. */
function formatClock(time: string, endTime?: string | null): string {
  const start = parseClock(time);
  if (start === null) return time;
  const a = clockParts(start);
  const end = endTime ? parseClock(endTime) : null;
  if (end === null || end === start) return `${a.label} ${a.period}`;
  const b = clockParts(end);
  return a.period === b.period
    ? `${a.label}–${b.label} ${b.period}`
    : `${a.label} ${a.period}–${b.label} ${b.period}`;
}

/** "Tue, Nov 4", with the year when it isn't this year. */
export function formatTaskDay(date: string, now: Date, timezone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const label = `${weekday}, ${MONTHS[month - 1]} ${day}`;
  return getUserToday(timezone, now).slice(0, 4) === m[1] ? label : `${label}, ${year}`;
}

export function formatTaskWhen(
  task: { date: string; time: string; endTime?: string | null },
  now: Date,
  timezone: string
): string {
  const day = formatTaskDay(task.date, now, timezone);
  if (!task.time) return `${day} · Anytime`;
  return `${day} · ${formatClock(task.time, task.endTime)}`;
}

/** Tasks have no end-time column. A School Block's end is in its note and a
 *  step's length is in its TIME: note; anything else has only a start. */
export function taskEndTime(task: Pick<Task, "time" | "notes">): string | null {
  const start = parseClock(task.time);
  if (start === null) return null;
  const school = schoolEndFromNotes(task.notes);
  const length = minutesFromNotes(task.notes);
  const end = school ?? (length === null ? null : (start + length) % 1440);
  if (end === null) return null;
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}
