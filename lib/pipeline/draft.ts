// Pipeline V2: turns what the AI produced into a draft ChangeSet, and applies
// the small edits a student can make to a draft before confirming it.
//
// Pure (no store, no AI) so it can be unit tested with plain Node. The voice
// handler saves the result (lib/store.ts saveChangeSet); nothing here writes.

import { parseChangeSet, AddTaskOp, type ChangeOp, type ChangeSet, type Intent } from "./changeset";
import { cleanTitle } from "../quick-add";

/** A task as the plan generator or the single-task command returns it. */
export type DraftTask = {
  title: string;
  date: string;
  time?: string;
  calendarId?: string | null;
  notes?: string;
  kind?: string;
  startAction?: string;
  resources?: ReadonlyArray<{ label: string; url: string }>;
};

type AddTask = Extract<ChangeOp, { op: "add_task" }>;

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s);
const HM_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One add_task op from an AI task. Fields the schema would reject are trimmed
 * or dropped rather than failing the whole draft: an overlong title is cut, a
 * time that is not HH:MM is dropped, and a resource with a bad URL is left out.
 */
export function taskOp(t: DraftTask, link: { plan_ref?: string; plan_id?: string } = {}): AddTask {
  const op: AddTask = { op: "add_task", title: clip(cleanTitle(t.title) || "Untitled task", 200), date: t.date };
  if (t.time !== undefined) op.time = HM_RE.test(t.time) ? t.time : "";
  if (t.calendarId) op.calendarId = t.calendarId.slice(0, 64);
  const notes = t.notes?.trim();
  if (notes) op.notes = clip(notes, 2000);
  if (t.kind && ["school", "academic-ec", "side-ec", "personal", "commitment"].includes(t.kind)) op.kind = t.kind as AddTask["kind"];
  const start = t.startAction?.trim();
  if (start) op.startAction = clip(start, 300);
  const resources = (t.resources ?? [])
    .map((r) => ({ label: clip(r.label.trim(), 200), url: r.url.trim() }))
    .filter((r) => r.label && AddTaskOp.safeParse({ op: "add_task", title: "x", date: "2000-01-01", resources: [r] }).success)
    .slice(0, 10);
  if (resources.length) op.resources = resources;
  if (link.plan_ref) op.plan_ref = link.plan_ref;
  else if (link.plan_id) op.plan_id = link.plan_id;
  return op;
}

/** A new plan and its tasks: one create_plan, then an add_task per task. */
export function planOps(title: string, tasks: ReadonlyArray<DraftTask>, notes?: string): ChangeOp[] {
  const create: Extract<ChangeOp, { op: "create_plan" }> = { op: "create_plan", ref: "p1", title: clip(title.trim() || "New plan", 200) };
  if (notes?.trim()) create.notes = clip(notes.trim(), 2000);
  return [create, ...tasks.slice(0, 399).map((t) => taskOp(t, { plan_ref: "p1" }))];
}

export type DraftInput = {
  id: string;
  userId: string;
  source: "typed" | "voice";
  requestText: string;
  /** Used when summarize() has no headline for these ops. */
  summary: string;
  /** Overrides summarize(): "Updating ICF Prep · 6 tasks → 8 tasks" (B4). */
  headline?: string;
  intent: Intent;
  targetPlanId?: string | null;
  ops: ChangeOp[];
  assumptions?: string[];
  /** ISO timestamp; passed in so this stays pure. */
  now: string;
};

/** Assembles and validates a draft ChangeSet. */
export function buildDraft(d: DraftInput): { ok: true; changeSet: ChangeSet } | { ok: false; error: string } {
  return parseChangeSet({
    id: d.id,
    user_id: d.userId,
    source: d.source,
    request_text: d.requestText.slice(0, 4000),
    summary: d.headline?.trim() ? clip(d.headline.trim(), 200) : summarize(d.ops, clip(d.summary.trim() || "Proposed changes", 200)),
    intent: d.intent,
    target_plan_id: d.targetPlanId ?? null,
    ops: d.ops,
    assumptions: (d.assumptions ?? []).map((a) => clip(a.trim(), 200)).filter(Boolean).slice(0, 10),
    status: "draft",
    created_at: d.now,
    confirmed_at: null,
    action_id: null,
  });
}

/** The card's headline for these ops: `New plan "SAT Prep" with 9 tasks` or
 *  `Add "Dentist"`. Anything else keeps `fallback`. */
export function summarize(ops: ReadonlyArray<ChangeOp>, fallback: string): string {
  const plan = ops.find((o) => o.op === "create_plan");
  if (plan) {
    const n = ops.filter((o) => o.op === "add_task" && o.plan_ref === plan.ref).length;
    return clip(`New plan "${plan.title}" with ${n} task${n === 1 ? "" : "s"}`, 200);
  }
  if (ops.length === 1 && ops[0].op === "add_task") return clip(`Add "${ops[0].title}"`, 200);
  return fallback;
}

/** What the client needs to render a preview card (lib/pipeline/drafting.ts previewFor). */
export type PreviewPayload = {
  /** One line per op, in op order (describeChangeSet). */
  lines: string[];
  /** Titles addTask would skip as duplicates of open tasks, if confirmed now. */
  likelyDuplicates: string[];
  /** Plans this delete leaves with no tasks: the card's "Also remove the plan"
   *  box, checked while the draft has a delete_plan op for it. */
  planRemovals?: { planId: string; title: string; checked: boolean }[];
};

// ─── Preview edits (PATCH /api/changesets/[id]) ─────────────────────────────

export type DraftEdit =
  | { type: "remove"; index: number }
  /** The "Also remove the plan" box: adds or drops the delete_plan op. */
  | { type: "plan_removal"; plan_id: string; remove: boolean }
  | { type: "date"; index: number; date: string }
  | { type: "time"; index: number; time: string };

/**
 * Applies one preview edit to a draft's ops. Removing a new plan removes its
 * tasks; removing the last task of a new plan removes the plan. An edit that
 * would leave nothing is refused: that is what Discard is for.
 */
export function editOps(ops: ReadonlyArray<ChangeOp>, edit: DraftEdit): { ok: true; ops: ChangeOp[] } | { ok: false; error: string } {
  if (edit.type === "plan_removal") {
    if (!ops.some((o) => o.op === "delete_task")) return { ok: false, error: "Only a delete can remove a plan." };
    const rest = ops.filter((o) => !(o.op === "delete_plan" && o.plan_id === edit.plan_id));
    const next: ChangeOp[] = edit.remove ? [...rest, { op: "delete_plan", plan_id: edit.plan_id }] : rest;
    if (next.length === 0) return { ok: false, error: "That would leave nothing to change. Use Discard instead." };
    return { ok: true, ops: next };
  }
  const op = ops[edit.index];
  if (!Number.isInteger(edit.index) || !op) return { ok: false, error: "No such change." };

  if (edit.type === "remove") {
    let next = ops.filter((_, i) => i !== edit.index);
    if (op.op === "create_plan") next = next.filter((o) => !(o.op === "add_task" && o.plan_ref === op.ref));
    if (op.op === "add_task" && op.plan_ref && !next.some((o) => o.op === "add_task" && o.plan_ref === op.plan_ref)) {
      next = next.filter((o) => !(o.op === "create_plan" && o.ref === op.plan_ref));
    }
    if (next.length === 0) return { ok: false, error: "That would leave nothing to add. Use Discard instead." };
    return { ok: true, ops: next };
  }

  if (op.op !== "add_task" && op.op !== "move_task") return { ok: false, error: "Only a task's date or time can be changed." };
  const changed: ChangeOp =
    edit.type === "date" ? { ...op, date: edit.date } : { ...op, time: edit.time };
  const next = ops.map((o, i) => (i === edit.index ? changed : o));
  return { ok: true, ops: next };
}

/** The structured shape of an edit request body, or null when it is not one. */
export function parseDraftEdit(body: unknown): DraftEdit | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.type === "plan_removal") {
    return typeof b.plan_id === "string" && UUID_RE.test(b.plan_id) && typeof b.remove === "boolean"
      ? { type: "plan_removal", plan_id: b.plan_id, remove: b.remove }
      : null;
  }
  const index = b.index;
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= 400) return null;
  if (b.type === "remove") return { type: "remove", index };
  if (b.type === "date" && typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) return { type: "date", index, date: b.date };
  if (b.type === "time" && typeof b.time === "string" && /^(?:(?:[01]\d|2[0-3]):[0-5]\d)?$/.test(b.time)) return { type: "time", index, time: b.time };
  return null;
}
