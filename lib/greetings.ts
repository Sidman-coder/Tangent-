/** Where the student's day stands, so the greeting never contradicts the page
 *  ("Nice work today" above "1 needs attention"). */
export type DayStanding = {
  /** Things still open today, attention items included. */
  left: number;
  /** Overdue, missed, starting soon or due within the attention window. */
  urgent: number;
  /** Finished today. */
  done: number;
};

const OPENERS: Record<string, string[]> = {
  morning: ["Good morning", "Morning"],
  afternoon: ["Good afternoon", "Afternoon"],
  evening: ["Good evening", "Evening"],
  late: ["Still up", "Late one"],
};

/** `hour` is the student's local hour (see localNow in lib/time). Praise only
 *  when the day is actually clear; otherwise a calm greeting. The choice is
 *  stable through the day (seeded by the date), not re-rolled on every load. */
export function getGreeting(name: string, hour: number = new Date().getHours(), day?: DayStanding, seed = new Date().getDate()): string {
  const bucket = hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : hour >= 17 && hour < 21 ? "evening" : "late";
  if (day && day.urgent === 0 && day.left === 0 && day.done > 0) {
    const praise = [`Nice work today, ${name}.`, `All done for today, ${name}.`, `Day's clear, ${name}.`];
    return praise[seed % praise.length];
  }
  const openers = OPENERS[bucket];
  const opener = openers[seed % openers.length];
  // "Still up" asks; everything else states.
  return opener === "Still up" ? `${opener}, ${name}?` : `${opener}, ${name}.`;
}
