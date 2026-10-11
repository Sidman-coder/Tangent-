import "server-only";

// The spacing brain (lib/load.ts) wired to the signed-in student's real data:
// their tasks, their capacity and their local clock. Everything that adds work
// on the student's behalf goes through placeNewTask, so nothing lands on a day
// that's already full without saying so.

import { getAllTasks, getCapacity, getUserTimezone } from "@/lib/store";
import {
  DEFAULT_CAPACITY,
  type Capacity,
  type Placement,
  type ReliefSuggestion,
  capacityOn,
  dayLoad,
  dayName,
  minutesFromNotes,
  placeTask,
  spreadSessions,
  suggestRelief,
} from "@/lib/load";
import { addDaysYMD, localNow } from "@/lib/time";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{1,2}:\d{2}$/;

export async function studentCapacity(): Promise<{ cap: Capacity; known: boolean }> {
  const saved = await getCapacity();
  return { cap: saved ?? DEFAULT_CAPACITY, known: saved !== null };
}

export async function studentNow() {
  return localNow(await getUserTimezone());
}

/**
 * When a new task should happen.
 * - day and time both said: exactly that.
 * - only a day: that day, at its first open time after school; a warning if
 *   it pushes the day over the student's usual load.
 * - neither: the lightest day with room before the deadline (or within the
 *   next week), at its first open time.
 */
export async function placeNewTask(input: {
  date?: string | null;
  time?: string | null;
  deadline?: string | null;
  notes?: string;
}): Promise<Placement> {
  const date = input.date && YMD.test(input.date) ? input.date : null;
  const time = input.time && HHMM.test(input.time) ? input.time.padStart(5, "0") : null;
  if (date && time) return { date, time };

  const [tasks, { cap }, now] = await Promise.all([getAllTasks(), studentCapacity(), studentNow()]);
  const minutes = minutesFromNotes(input.notes) ?? undefined;

  if (date) {
    const placed = placeTask(tasks, { now, cap, minutes, earliest: date, latest: date });
    const over = dayLoad(tasks, date) + (minutes ?? 45) > capacityOn(date, cap);
    return {
      date,
      time: placed?.time ?? "16:00",
      note: over ? `Heads up: ${dayName(date)} is now over your usual load.` : undefined,
    };
  }

  const deadline = input.deadline && YMD.test(input.deadline) ? input.deadline : null;
  // Work for something due on a day is done before that day.
  const latest = deadline && deadline > now.date ? addDaysYMD(deadline, -1) : undefined;
  return (
    placeTask(tasks, { now, cap, minutes, latest }) ?? { date: addDaysYMD(now.date, 1), time: "16:00" }
  );
}

/** One suggested move if the next week has an overloaded day, else null.
 *  Never applied here: the student accepts it (/api/reschedule, with Undo). */
export async function reliefSuggestion(): Promise<ReliefSuggestion | null> {
  try {
    const [tasks, { cap }, now] = await Promise.all([getAllTasks(), studentCapacity(), studentNow()]);
    return suggestRelief(tasks, { now, cap });
  } catch (e) {
    console.warn("[spacing] reliefSuggestion:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** A plan's evenly spaced session dates, moved off heavy days and given real
 *  open times (lib/load.ts spreadSessions). Same length and order as `dates`. */
export async function spreadPlanDates(dates: string[]): Promise<{ date: string; time: string }[]> {
  const [tasks, { cap }, now] = await Promise.all([getAllTasks(), studentCapacity(), studentNow()]);
  return spreadSessions(tasks, dates, { now, cap });
}
