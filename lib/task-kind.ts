// What kind of promise a task is: a fixed appointment, a reminder, or a flexible
// step. Today's sections come from this, so a dentist visit and a chapter to
// read never sit in the same list. Rules first; below CLASSIFY_CONFIDENCE_FLOOR
// at capture, lib/task-kind-ai.ts asks Haiku.

import type { Task, TaskCommitment } from "./types";

export type TaskSource = "capture" | "calendar" | "canvas" | "plan" | "manual";

export type ClassifyInput = {
  title: string;
  hasFixedTime: boolean;
  source: TaskSource;
  projectId?: string | null;
};

export type TaskClassification = { kind: TaskCommitment; confidence: number };

export const CLASSIFY_CONFIDENCE_FLOOR = 0.7;

/** A clock time written in the title: "3pm", "at 5". */
const CLOCK_IN_TITLE = /\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\bat\s+\d/i;
const DURATION_IN_TITLE = /\b\d+\s*(min|mins|minutes|hr|hrs|hour|hours)\b/i;
/** "practice" alone is work to do; these uses are something you show up to. */
const PRACTICE_AS_EVENT = /^practice(\s+test\b|\s+at\b|\s+\d)/i;

const WORK_VERB =
  /^(study|read|review|practice|prep|prepare|write|finish|work on|draft|memorize|learn|outline|research|do|complete)\b/i;
const APPOINTMENT =
  /\b(appointment|appt|class|practice|meeting|game|lesson|dentist|doctor|ortho|orthodontist|therapy|exam|test|interview|rehearsal|tutoring|recital|match|flight)\b/i;
const REMINDER_START =
  /^(call|email|text|turn in|bring|pay|submit|sign|pick up|return|drop off|buy|renew|register|rsvp|schedule|book|print|send)\b/i;
const REMINDER_ANYWHERE = /\b(call|email|text|turn in|bring|pay|remind|submit|sign)\b/i;
const REMIND_ME = /^remind me\b/i;

const MAX_REMINDER_WORDS = 6;

function wordCount(title: string): number {
  const t = title.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function classifyTaskKind(input: ClassifyInput): TaskClassification {
  const title = input.title.trim();
  if (input.source === "canvas" || input.source === "calendar") return { kind: "fixed", confidence: 0.99 };
  if (input.source === "plan" || input.projectId) return { kind: "flexible", confidence: 0.95 };

  const timed = input.hasFixedTime || CLOCK_IN_TITLE.test(title);
  const short = wordCount(title) <= MAX_REMINDER_WORDS;

  if (REMIND_ME.test(title)) return { kind: "reminder", confidence: 0.95 };
  if (REMINDER_START.test(title) && short) return { kind: "reminder", confidence: 0.9 };
  if (PRACTICE_AS_EVENT.test(title)) return { kind: "fixed", confidence: 0.9 };
  if (WORK_VERB.test(title)) return { kind: "flexible", confidence: timed ? 0.75 : 0.88 };
  if (DURATION_IN_TITLE.test(title)) return { kind: "flexible", confidence: 0.85 };
  if (APPOINTMENT.test(title) && timed) return { kind: "fixed", confidence: 0.92 };
  if (REMINDER_ANYWHERE.test(title) && short) return { kind: "reminder", confidence: 0.72 };
  if (APPOINTMENT.test(title)) return { kind: "fixed", confidence: 0.65 };
  if (REMINDER_START.test(title)) return { kind: "flexible", confidence: 0.6 };
  if (timed) return { kind: "fixed", confidence: 0.6 };
  return { kind: "flexible", confidence: 0.55 };
}

/** Calendar imports carry no source marker, only the note they were saved with
 *  (components/settings/CalendarImport.tsx). Migration 20261105000000 reads the
 *  same pattern. */
export function isCalendarImport(task: Pick<Task, "notes">): boolean {
  return /(^|· )From [^·]+$/.test(task.notes ?? "");
}

function sourceOf(task: Task): TaskSource {
  if (task.source === "canvas") return "canvas";
  if (isCalendarImport(task)) return "calendar";
  if (task.planId) return "plan";
  return "manual";
}

/** The stored kind, or the rules' answer when the migration hasn't run or the
 *  task predates it. A guess below the floor reads as flexible: the calm
 *  default, and what the migration's backfill would have written. */
export function commitmentOf(task: Task): TaskCommitment {
  if (task.commitment) return task.commitment;
  if (task.kind === "commitment") return "fixed";
  const { kind, confidence } = classifyTaskKind({
    title: task.title,
    hasFixedTime: Boolean(task.time),
    source: sourceOf(task),
    projectId: task.planId,
  });
  return confidence >= CLASSIFY_CONFIDENCE_FLOOR ? kind : "flexible";
}

export type ClassifyCache = {
  get(key: string): TaskCommitment | undefined;
  set(key: string, kind: TaskCommitment): void;
};

/** A Map that forgets its oldest answer once it holds `max`. */
export function createClassifyCache(max: number): ClassifyCache {
  const entries = new Map<string, TaskCommitment>();
  return {
    get: (key) => entries.get(key),
    set(key, kind) {
      if (entries.size >= max && !entries.has(key)) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      entries.set(key, kind);
    },
  };
}

/** Rules first. Only an answer below the floor asks, once per title; a failed
 *  ask isn't cached, and reads as flexible the way commitmentOf does. */
export async function classifyWithAsk(
  input: ClassifyInput,
  ask: (input: ClassifyInput) => Promise<TaskCommitment | null>,
  cache: ClassifyCache
): Promise<TaskClassification> {
  const rules = classifyTaskKind(input);
  if (rules.confidence >= CLASSIFY_CONFIDENCE_FLOOR) return rules;
  const key = `${input.hasFixedTime ? "1" : "0"}:${input.title.trim().toLowerCase().replace(/\s+/g, " ")}`;
  const known = cache.get(key);
  if (known) return { kind: known, confidence: CLASSIFY_CONFIDENCE_FLOOR };
  const asked = await ask(input).catch(() => null);
  if (!asked) return { kind: "flexible", confidence: rules.confidence };
  cache.set(key, asked);
  return { kind: asked, confidence: CLASSIFY_CONFIDENCE_FLOOR };
}

/** The label on a preview row. */
export function commitmentLabel(kind: TaskCommitment): "Appointment" | "Reminder" | "Plan step" {
  if (kind === "fixed") return "Appointment";
  return kind === "reminder" ? "Reminder" : "Plan step";
}

/** The choices in the task detail's Type selector. */
export const COMMITMENT_OPTIONS: { value: TaskCommitment; label: string }[] = [
  { value: "fixed", label: "Fixed appointment" },
  { value: "reminder", label: "Reminder" },
  { value: "flexible", label: "Flexible step" },
];
