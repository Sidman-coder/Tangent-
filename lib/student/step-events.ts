import "server-only";

// Layer 2 of the context engine: the observation log. Records what the
// student does with a step (created, done, skipped, "Not today" and why, too
// big, rescheduled, check-in answers) as small rows in `step_events`, so
// lib/student/observations.ts can learn their real pace, best hours and step
// size. Never the task's title or notes: only kind, local hour and weekday, the
// estimate, and a short code.
//
// Best effort everywhere: logging never blocks or breaks the action it
// describes. Before 20261110010000_step_events.sql runs, writes are skipped
// with one server warning and reads return nothing.

import { getRequestContext, trackPending } from "@/lib/request-context";
import { createColumnMemo, schemaErrorKind, warnSchemaOnce } from "@/lib/schema-compat";
import { getUserTimezone } from "@/lib/store";
import { localNow, weekdayOf } from "@/lib/time";
import { minutesFromNotes } from "@/lib/load";
import type { Task } from "@/lib/types";
import { isBehaviourKind, isStepEventKind, type StepEvent, type StepEventKind } from "./observations";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^[a-z_]{1,24}$/;

// Remembered for a minute, not forever, so running a migration takes effect
// without a restart.
const missing = createColumnMemo();
const tableMissing = () => missing.isMissing("table");
const behaviourKindsMissing = () => missing.isMissing("behaviour_kinds");

function noteMissing(error: { code?: string; message?: string }): boolean {
  if (schemaErrorKind(error) !== "missing_table") return false;
  if (!tableMissing()) missing.markMissing("table");
  warnSchemaOnce("step_events", "step_events table missing; apply 20261110010000_step_events.sql (docs/MANUAL-STEPS.md). Tangent plans without the observation log until then.");
  return true;
}

export type StepEventInput = {
  kind: StepEventKind;
  task?: Pick<Task, "id" | "planId" | "notes" | "date" | "time"> | null;
  code?: string | null;
  actualMinutes?: number | null;
};

const minutes = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(1440, Math.round(n))) : null);

async function insert(events: StepEventInput[]): Promise<void> {
  if (tableMissing() || !events.length) return;
  const { db, userId } = getRequestContext();
  const tz = await getUserTimezone().catch(() => "UTC");
  const now = localNow(tz);
  const nowWeekday = weekdayOf(now.date);
  const rows = events
    .filter((e) => isStepEventKind(e.kind))
    .slice(0, 50)
    .map((e) => {
      // "created" is about when the step is planned for; everything else
      // about when the student acted.
      const planned = e.kind === "created" && e.task?.date && e.task?.time;
      const hour = planned ? Number(e.task!.time.slice(0, 2)) : now.hour;
      return {
        user_id: userId,
        task_id: e.task?.id && UUID_RE.test(e.task.id) ? e.task.id : null,
        plan_id: e.task?.planId && UUID_RE.test(e.task.planId) ? e.task.planId : null,
        kind: e.kind,
        hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null,
        weekday: planned ? weekdayOf(e.task!.date) : nowWeekday,
        minutes: minutes(minutesFromNotes(e.task?.notes)),
        actual_minutes: minutes(e.actualMinutes),
        code: e.code && CODE_RE.test(e.code) ? e.code : null,
      };
    });
  const kept = behaviourKindsMissing() ? rows.filter((r) => !isBehaviourKind(r.kind)) : rows;
  if (!kept.length) return;
  const { error } = await db.from("step_events").insert(kept);
  if (!error || noteMissing(error)) return;
  // 23514: the old kind check, before 20261111000000_step_events_behaviour.sql.
  // Drop the behaviour kinds from now on and keep the step rows.
  // Two inserts can fail on this at once, so the second one must still retry.
  if (error.code === "23514" && kept.some((r) => isBehaviourKind(r.kind))) {
    if (!behaviourKindsMissing()) missing.markMissing("behaviour_kinds");
    warnSchemaOnce("step_events_behaviour", "step_events can't take the behaviour kinds yet; apply 20261111000000_step_events_behaviour.sql (docs/MANUAL-STEPS.md). Tangent logs steps only until then.");
    const steps = kept.filter((r) => !isBehaviourKind(r.kind));
    if (steps.length) await db.from("step_events").insert(steps);
    return;
  }
  console.warn("[step-events] not recorded:", error.code ?? "unknown");
}

/** Logs what happened to one or more steps. Never throws, never blocks. */
export function logStepEvents(events: StepEventInput[]): void {
  if (tableMissing() || !events.length) return;
  let p: Promise<void>;
  try {
    p = insert(events).catch(() => undefined);
  } catch {
    return; // no request context (a script): nothing to log
  }
  try {
    trackPending(p);
  } catch {
    // Not inside a tracked request: it still finishes on its own.
  }
}

export function logStepEvent(event: StepEventInput): void {
  logStepEvents([event]);
}

/** The student's recent observations, newest first (the last 120 days, up to
 *  500). Empty before the migration. */
export async function readStepEvents(): Promise<StepEvent[]> {
  if (tableMissing()) return [];
  try {
    const { db, userId } = getRequestContext();
    const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
    const { data, error } = await db
      .from("step_events")
      .select("kind, hour, weekday, minutes, actual_minutes, code")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      if (!noteMissing(error)) console.warn("[step-events] could not read:", error.code ?? "unknown");
      return [];
    }
    return (data ?? [])
      .filter((r: { kind: unknown }) => isStepEventKind(r.kind))
      .map((r: { kind: StepEventKind; hour: number | null; weekday: number | null; minutes: number | null; actual_minutes: number | null; code: string | null }) => ({
        kind: r.kind,
        hour: r.hour,
        weekday: r.weekday,
        minutes: r.minutes,
        actualMinutes: r.actual_minutes,
        code: r.code,
      }));
  } catch {
    return [];
  }
}

/** Round 4 §3.4: one project's check-in and "Not today" codes since a date,
 *  for the round review. Codes only, grouped by step. Empty before the
 *  migration or on any error. */
export async function readPlanStepCodes(planId: string, sinceYmd: string): Promise<{ taskId: string | null; kind: StepEventKind; code: string }[]> {
  if (tableMissing() || !UUID_RE.test(planId)) return [];
  try {
    const { db, userId } = getRequestContext();
    const { data, error } = await db
      .from("step_events")
      .select("task_id, kind, code")
      .eq("user_id", userId)
      .eq("plan_id", planId)
      .in("kind", ["check_in", "not_today"])
      .gte("created_at", `${sinceYmd}T00:00:00Z`)
      .not("code", "is", null)
      .limit(300);
    if (error) {
      if (!noteMissing(error)) console.warn("[step-events] could not read project codes:", error.code ?? "unknown");
      return [];
    }
    return (data ?? [])
      .filter((r: { kind: unknown; code: unknown }) => isStepEventKind(r.kind) && typeof r.code === "string")
      .map((r: { task_id: string | null; kind: StepEventKind; code: string }) => ({ taskId: r.task_id, kind: r.kind, code: r.code }));
  } catch {
    return [];
  }
}
