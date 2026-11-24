/** Where the student's day stands, so the greeting never contradicts the page
 *  ("Nice work today" above "1 needs attention"). */
export type DayStanding = {
  /** Things still open today, attention items included. */
  left: number;
  /** Overdue, missed, starting soon or due within the attention window. */
  urgent: number;
  /** Finished today. */
  done: number;
  /** Open steps still coming up this week. Praise waits until this is 0, so a
   *  tap on Done for a step that was not started never earns a victory lap (overnight C08). */
  ahead?: number;
};

const OPENERS: Record<string, string[]> = {
  morning: ["Good morning", "Morning"],
  afternoon: ["Good afternoon", "Afternoon"],
  evening: ["Good evening", "Evening"],
  late: ["Hey", "Hi"],
};

/** `hour` is the student's local hour (see localNow in lib/time). Praise only
 *  when the day is actually clear; otherwise a calm greeting. The choice is
 *  stable through the day (seeded by the date), not re-rolled on every load. */
export function getGreeting(name: string, hour: number = new Date().getHours(), day?: DayStanding, seed = new Date().getDate()): string {
  const bucket = hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : hour >= 17 && hour < 21 ? "evening" : "late";
  if (day && day.urgent === 0 && day.left === 0 && day.done > 0 && (day.ahead ?? 0) === 0) {
    const praise = [`Nice work today, ${name}.`, `All done for today, ${name}.`, `Day's clear, ${name}.`];
    return praise[seed % praise.length];
  }
  const openers = OPENERS[bucket];
  const opener = openers[seed % openers.length];
  return `${opener}, ${name}.`;
}
