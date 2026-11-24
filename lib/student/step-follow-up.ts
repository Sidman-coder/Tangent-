// Overnight 2, Phase 3: the daily bubble asks about something from the last one
// or two days ("How did “Draft club pitch” go yesterday?") before any profile
// question. Only finished plan steps that haven't been checked in on: a step
// that wasn't done is Home's to deal with (missed steps, Fresh start), and a
// check-in already given is never asked again. The answer is logged like the
// check-in sheet's (a feel code in step_events, the words as the step's HOW IT
// WENT line, never when sensitive). Pure and client-safe.

import { addDaysYMD } from "../time";
import type { FollowUp } from "./follow-ups";

export const STEP_FOLLOW_UP_PREFIX = "step-";

type Step = {
  id: string;
  title: string;
  date: string;
  time?: string | null;
  completed: boolean;
  planId?: string | null;
  notes?: string | null;
  kind?: string | null;
  recurring?: { enabled?: boolean } | null;
};

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "yesterday", or "on Saturday" for two days ago. */
export function recentDayWord(date: string, today: string): string {
  if (date === addDaysYMD(today, -1)) return "yesterday";
  const [y, m, d] = date.split("-").map(Number);
  return `on ${DAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
}

const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * A finished plan step from yesterday or the day before with no check-in yet,
 * as a follow-up question, or null. The most recent first.
 */
export function recentStepFollowUp(
  tasks: readonly Step[],
  today: string,
  asked: readonly string[],
  checkedIn: ReadonlySet<string> = new Set()
): FollowUp | null {
  const from = addDaysYMD(today, -2);
  const done = new Set(asked);
  const step = tasks
    .filter(
      (t) =>
        t.completed &&
        t.planId &&
        t.date >= from &&
        t.date < today &&
        !t.recurring?.enabled &&
        t.kind !== "school" &&
        t.kind !== "commitment" &&
        !/(?:^|\n)\s*HOW IT WENT:/i.test(t.notes ?? "") &&
        !checkedIn.has(t.id) &&
        !done.has(`${STEP_FOLLOW_UP_PREFIX}${t.id}`)
    )
    .sort((a, b) => `${b.date} ${b.time ?? ""}`.localeCompare(`${a.date} ${a.time ?? ""}`))[0];
  if (!step) return null;
  return {
    id: `${STEP_FOLLOW_UP_PREFIX}${step.id}`,
    ask: `How did “${short(step.title)}” go ${recentDayWord(step.date, today)}?`,
    why: "So the next steps are the right size.",
    placeholder: "e.g. went fine, took about 30 min",
    factCategory: "how_you_work",
    slotKey: "fuStep",
    lead: "",
  };
}

/** The task id inside a step follow-up's id, or null for any other follow-up. */
export function stepFollowUpTaskId(id: string): string | null {
  return id.startsWith(STEP_FOLLOW_UP_PREFIX) ? id.slice(STEP_FOLLOW_UP_PREFIX.length) || null : null;
}

/** What Tangent says back once the answer is logged. */
export function stepFollowUpReply(title: string, kept: boolean): string {
  return kept
    ? `Noted how “${short(title, 48)}” went. It helps size the next steps.`
    : `Thanks. Tangent will size the next steps with that.`;
}
