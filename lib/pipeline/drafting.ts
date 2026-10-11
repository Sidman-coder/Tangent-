// Pipeline V2: saves an AI-produced change as a draft instead of writing it.
// Used by lib/voice-handler.ts when TANGENT_PIPELINE_V2 is on and the caller
// can show a preview (opts.preview). The student confirms through
// app/api/changesets/[id]/confirm.

import "server-only";
import { NextResponse } from "next/server";
import { addVoiceLog, getAllPlans, getAllTasks, likelyDuplicateTitles, saveChangeSet } from "../store";
import { getRequestContext } from "../request-context";
import { describeChangeSet, type ChangeOp, type ChangeSet } from "./changeset";
import { buildDraft, type DraftInput, type PreviewPayload } from "./draft";
import { logEvent } from "./events";
import { emptiedPlans } from "../delete-scope";
import type { Plan, Task } from "../types";


/** describeChangeSet with the student's own task and plan titles, plus the
 *  duplicate estimate. Reads the calendar only when an op points at it. */
export async function previewFor(cs: Pick<ChangeSet, "ops">, today?: string): Promise<PreviewPayload> {
  const pointsAtExisting = cs.ops.some((o) => "task_id" in o || ("plan_id" in o && o.plan_id));
  const [tasks, plans] = pointsAtExisting ? await Promise.all([getAllTasks(), getAllPlans()]) : [undefined, undefined];
  const adds = cs.ops.filter((o): o is Extract<ChangeOp, { op: "add_task" }> => o.op === "add_task");
  const likelyDuplicates = await likelyDuplicateTitles(
    adds.map((o) => ({ title: o.title, date: o.date, time: o.time ?? "", completed: false }))
  ).catch(() => []);
  const payload: PreviewPayload = { lines: describeChangeSet(cs, { tasks, plans, today }), likelyDuplicates };
  const removals = planRemovalsFor(cs, tasks ?? [], plans ?? []);
  if (removals.length) payload.planRemovals = removals;
  return payload;
}

/** The "Also remove the plan" boxes: plans the draft's deletes leave empty,
 *  plus any it already removes. Checked while a delete_plan op is there. */
export function planRemovalsFor(cs: Pick<ChangeSet, "ops">, tasks: readonly Task[], plans: readonly Plan[]): NonNullable<PreviewPayload["planRemovals"]> {
  const deleting = new Set(cs.ops.flatMap((o) => (o.op === "delete_task" ? [o.task_id] : [])));
  if (deleting.size === 0) return [];
  const checked = new Set(cs.ops.flatMap((o) => (o.op === "delete_plan" ? [o.plan_id] : [])));
  const emptied = new Set(emptiedPlans(tasks.filter((t) => deleting.has(t.id)), tasks, plans).map((p) => p.id));
  return plans
    .filter((p) => emptied.has(p.id) || checked.has(p.id))
    .map((p) => ({ planId: p.id, title: p.title, checked: checked.has(p.id) }));
}

/**
 * Saves the draft, logs changeset_drafted and returns the voice-handler
 * response: { ok, action: "preview", changeSet, preview, response }.
 * Nothing on the calendar changes.
 */
export async function respondWithDraft(
  input: Omit<DraftInput, "id" | "userId" | "now">,
  meta: { text: string; today: string; route: string }
): Promise<NextResponse> {
  const built = buildDraft({ ...input, id: crypto.randomUUID(), userId: getRequestContext().userId, now: new Date().toISOString() });
  if (!built.ok) {
    console.error("[pipeline] draft rejected:", built.error);
    await addVoiceLog({ text: meta.text, response: "Draft rejected", action: "error", ok: false });
    return NextResponse.json({ ok: false, error: "Couldn't prepare that change.", response: "Sorry, I couldn't prepare that. Please try again." }, { status: 422 });
  }
  const changeSet = await saveChangeSet(built.changeSet);
  logEvent(
    "changeset_drafted",
    { source: changeSet.source, intent: changeSet.intent, ops: changeSet.ops.length, route: meta.route },
    { changeSetId: changeSet.id, planId: changeSet.target_plan_id }
  );
  const preview = await previewFor(changeSet, meta.today);
  await addVoiceLog({ text: meta.text, response: changeSet.summary, action: "preview", ok: true });
  return NextResponse.json({ ok: true, action: "preview", changeSet, preview, response: changeSet.summary });
}
