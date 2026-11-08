// Pilot analytics vocabulary (Round 2, F.3). Pure, so it is unit tested with
// plain Node; lib/analytics.ts writes the rows.
//
// An event is a name and a few structured facts: ids, counts, slot keys and
// kinds. Never anything a student wrote, no codes, tokens or passwords. The
// type below says which keys exist; pilotProps() enforces it at run time too.

import { sanitizeEventProps } from "./pipeline/event-types";

export const PILOT_EVENTS = [
  "signup",
  "first_capture",
  "capture",
  "first_plan_confirmed",
  "plan_confirmed",
  "task_done",
  "not_today",
  "too_big",
  "fresh_start",
  "auto_replan",
  "grill_answered",
  "grill_skipped",
  "grill_stopped",
  "chat_started",
  "week_two_return",
] as const;
export type PilotEvent = (typeof PILOT_EVENTS)[number];

/** Recorded at most once per student. */
export const ONCE_PER_USER: readonly PilotEvent[] = ["signup", "first_capture", "first_plan_confirmed", "week_two_return"];

/** The props a pilot event may carry. Ids are uuids; kinds and keys are short tokens. */
export type PilotProps = {
  plan_id?: string;
  task_id?: string;
  project_id?: string;
  chat_id?: string;
  count?: number;
  /** Task kind ("fixed" | "reminder" | "flexible"), chat scope, capture source… */
  kind?: string;
  source?: string;
  /** A context slot key, e.g. "deadline". */
  slot_key?: string;
  days?: number;
};

export const PILOT_PROP_KEYS: readonly (keyof PilotProps)[] = ["plan_id", "task_id", "project_id", "chat_id", "count", "kind", "source", "slot_key", "days"];

export function isPilotEvent(name: unknown): name is PilotEvent {
  return typeof name === "string" && (PILOT_EVENTS as readonly string[]).includes(name);
}

/** Only allowlisted keys, then the shared sanitizer (numbers, booleans and
 *  short machine tokens; free text is dropped). */
export function pilotProps(props: unknown): Record<string, string | number | boolean | null> {
  if (!props || typeof props !== "object" || Array.isArray(props)) return {};
  const kept: Record<string, unknown> = {};
  for (const key of PILOT_PROP_KEYS) {
    if (key in (props as Record<string, unknown>)) kept[key] = (props as Record<string, unknown>)[key];
  }
  return sanitizeEventProps(kept);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** True on an open between day 7 and day 14 after signup (inclusive). */
export function isWeek2Window(signupAt: string | Date, now: Date = new Date()): boolean {
  const start = new Date(signupAt).getTime();
  if (!Number.isFinite(start)) return false;
  const days = (now.getTime() - start) / DAY_MS;
  return days >= 7 && days < 15;
}
