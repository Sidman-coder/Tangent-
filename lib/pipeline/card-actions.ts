// Pipeline V2: the server side of the preview card's buttons. Each function
// backs one route under app/api/changesets/[id]/ and runs as the signed-in
// student (withUser), so getChangeSet only ever sees their own rows.

import "server-only";
import { NextResponse } from "next/server";
import { expireDraftChangeSets, getAppState, getChangeSet, getUserTimezone, listDraftChangeSets, markChangeSet, saveChangeSet, undoAction } from "../store";
import { localNow } from "../time";
import { applyChangeSet } from "./apply";
import { parseChangeSet, type ChangeSet } from "./changeset";
import { editOps, parseDraftEdit, summarize } from "./draft";
import { previewFor } from "./drafting";
import { logEvent } from "./events";
import { TANGENT_PIPELINE_V2 } from "./flags";
import { nextStep, type CardAction } from "./lifecycle";

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

/** The [id] segment: /api/changesets/<id>[/action]. */
function idFrom(req: Request): string {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  return parts[parts.indexOf("changesets") + 1] ?? "";
}

/** Shared preamble: flag on, change set found, and the action allowed in its status. */
async function load(req: Request, action: CardAction): Promise<{ cs: ChangeSet; step: ReturnType<typeof nextStep> } | NextResponse> {
  if (!TANGENT_PIPELINE_V2) return json({ ok: false, message: "Not found" }, 404);
  const cs = await getChangeSet(idFrom(req));
  if (!cs) return json({ ok: false, message: "That change could not be found." }, 404);
  const step = nextStep(action, cs);
  if (step.kind === "refuse") return json({ ok: false, status: cs.status, message: step.message }, 409);
  return { cs, step };
}

const failed = (e: unknown) => {
  console.error("[changesets]", e instanceof Error ? e.message : e);
  return json({ ok: false, message: "Something went wrong. Nothing was changed." }, 500);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** A second confirm (double click, retry) answers with the first one's result.
 *  applied_at is stamped when the first confirm finishes, even when it created
 *  nothing, so only a confirm that is still writing makes this one wait. */
async function confirmedResult(id: string): Promise<NextResponse> {
  let cs = await getChangeSet(id);
  for (let i = 0; i < 20 && cs?.status === "confirmed" && !cs.applied_at; i++) {
    await sleep(250);
    cs = await getChangeSet(id);
  }
  if (!cs) return json({ ok: false, message: "That change could not be found." }, 404);
  if (cs.status === "draft") return json({ ok: false, status: cs.status, message: "Those changes couldn't be saved. Try again." }, 409);
  if (cs.status !== "confirmed") {
    const step = nextStep("confirm", cs);
    return json({ ok: false, status: cs.status, message: step.kind === "refuse" ? step.message : "" }, 409);
  }
  if (!cs.applied_at) return json({ ok: false, message: "Those changes are still being saved. Check your calendar in a moment." }, 409);
  return json({
    ok: true,
    alreadyConfirmed: true,
    changeSet: cs,
    actionId: cs.action_id,
    // No undo entry means the first confirm added nothing (all duplicates).
    ...(cs.action_id ? {} : { createdTaskCount: 0 }),
    state: await getAppState(),
  });
}

export async function confirmChangeSet(req: Request): Promise<NextResponse> {
  try {
    const loaded = await load(req, "confirm");
    if (loaded instanceof NextResponse) return loaded;
    const { cs, step } = loaded;
    if (step.kind === "already") return await confirmedResult(cs.id);
    if (Date.parse(cs.created_at) < Date.now() - DRAFT_TTL_MS) {
      // Too old to trust against today's calendar (GET /api/changesets expires
      // these too, but a card can stay open in a tab for days).
      if (!(await markChangeSet(cs.id, "discarded", { from: "draft" }))) return await confirmedResult(cs.id);
      logEvent("changeset_discarded", { intent: cs.intent, ops: cs.ops.length, reason: "expired" }, { changeSetId: cs.id });
      return json({ ok: false, status: "discarded", reason: "expired", message: "This draft expired. Ask again for a fresh preview." }, 409);
    }

    const result = await applyChangeSet(cs);
    if (!result.ok) {
      if (result.reason === "already_confirmed") return await confirmedResult(cs.id);
      const status = result.reason === "failed" ? 500 : 409;
      return json({ ok: false, reason: result.reason, message: result.message }, status);
    }
    logEvent(
      "changeset_confirmed",
      {
        intent: cs.intent,
        ops: cs.ops.length,
        tasks_created: result.createdTaskIds.length,
        plans_created: result.createdPlanIds.length,
        duplicates_skipped: result.skipped_duplicates.count,
      },
      { changeSetId: cs.id, planId: result.createdPlanIds[0] ?? cs.target_plan_id }
    );
    return json({
      ok: true,
      changeSet: result.changeSet,
      actionId: result.actionId,
      createdTaskCount: result.createdTaskIds.length,
      planId: result.createdPlanIds[0] ?? null,
      skipped_duplicates: result.skipped_duplicates,
      state: await getAppState(),
    });
  } catch (e) {
    return failed(e);
  }
}

export async function discardChangeSet(req: Request): Promise<NextResponse> {
  try {
    const loaded = await load(req, "discard");
    if (loaded instanceof NextResponse) return loaded;
    const { cs, step } = loaded;
    if (step.kind === "already") return json({ ok: true, alreadyDiscarded: true });
    if (!(await markChangeSet(cs.id, "discarded", { from: "draft" }))) {
      // Lost a race with another button: report whatever won.
      const now = await getChangeSet(cs.id);
      if (now?.status === "discarded") return json({ ok: true, alreadyDiscarded: true });
      return json({ ok: false, status: now?.status, message: "Those changes were already added. Use Undo instead." }, 409);
    }
    // Optional body { reason: "just_chatting" }: the card's "Just talking" chip.
    const body = (await req.json().catch(() => null)) as { reason?: unknown } | null;
    const reason = body?.reason === "just_chatting" ? "just_chatting" : undefined;
    logEvent("changeset_discarded", { intent: cs.intent, ops: cs.ops.length, ...(reason ? { reason } : {}) }, { changeSetId: cs.id });
    return json({ ok: true });
  } catch (e) {
    return failed(e);
  }
}

export async function undoChangeSet(req: Request): Promise<NextResponse> {
  try {
    const loaded = await load(req, "undo");
    if (loaded instanceof NextResponse) return loaded;
    const { cs, step } = loaded;
    if (step.kind === "already") return json({ ok: true, alreadyUndone: true, state: await getAppState() });
    // The single undo entry reverses the whole batch and marks the change set undone (lib/store.ts applyUndo).
    const result = await undoAction(cs.action_id as string);
    if (!result.ok) return json({ ok: false, message: result.message }, 422);
    logEvent("changeset_undone", { intent: cs.intent, ops: cs.ops.length }, { changeSetId: cs.id });
    return json({ ok: true, message: result.message, state: await getAppState() });
  } catch (e) {
    return failed(e);
  }
}

export async function markShown(req: Request): Promise<NextResponse> {
  try {
    const loaded = await load(req, "shown");
    if (loaded instanceof NextResponse) return loaded;
    const { cs, step } = loaded;
    if (step.kind === "proceed") logEvent("preview_shown", { intent: cs.intent, ops: cs.ops.length }, { changeSetId: cs.id });
    return json({ ok: true });
  } catch (e) {
    return failed(e);
  }
}

/** PATCH: remove one change, or change one task's date or time. */
export async function editChangeSet(req: Request): Promise<NextResponse> {
  try {
    const loaded = await load(req, "edit");
    if (loaded instanceof NextResponse) return loaded;
    const { cs } = loaded;
    const edit = parseDraftEdit(await req.json().catch(() => null));
    if (!edit) return json({ ok: false, message: "That edit isn't supported." }, 400);
    const edited = editOps(cs.ops, edit);
    if (!edited.ok) return json({ ok: false, message: edited.error }, 422);
    const parsed = parseChangeSet({ ...cs, ops: edited.ops, summary: summarize(edited.ops, cs.summary) });
    if (!parsed.ok) return json({ ok: false, message: "That date or time isn't valid." }, 422);
    const saved = await saveChangeSet(parsed.changeSet);
    if (saved.status !== "draft") return json({ ok: false, status: saved.status, message: "That preview was already confirmed or discarded." }, 409);
    logEvent("preview_edited", { edit: edit.type, ops: saved.ops.length }, { changeSetId: saved.id });
    const today = localNow(await getUserTimezone()).date;
    return json({ ok: true, changeSet: saved, preview: await previewFor(saved, today) });
  } catch (e) {
    return failed(e);
  }
}

/**
 * GET /api/changesets: the student's open drafts from the last 24 hours, newest
 * first, with previews, so a reloaded chat or palette shows their cards again.
 * Older drafts are discarded first (changeset_discarded, reason "expired").
 */
export async function listOpenDrafts(): Promise<NextResponse> {
  if (!TANGENT_PIPELINE_V2) return json({ ok: false, message: "Not found" }, 404);
  try {
    const since = new Date(Date.now() - DRAFT_TTL_MS).toISOString();
    const expired = await expireDraftChangeSets(since);
    for (const cs of expired) logEvent("changeset_discarded", { intent: cs.intent, ops: cs.ops.length, reason: "expired" }, { changeSetId: cs.id });
    const drafts = await listDraftChangeSets(since);
    const today = localNow(await getUserTimezone()).date;
    const items = await Promise.all(drafts.map(async (changeSet) => ({ changeSet, preview: await previewFor(changeSet, today) })));
    return json({ ok: true, drafts: items });
  } catch (e) {
    return failed(e);
  }
}
