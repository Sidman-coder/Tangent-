// Pipeline V2: the ChangeSet, a typed list of proposed calendar changes.
//
// The AI will produce one of these instead of writing to the database. It is
// saved as a "draft", shown to the student as a preview (describeChangeSet),
// and only applied when they confirm (lib/pipeline/apply.ts). Its id is also
// the idempotency key: a confirmed ChangeSet can never be applied again.
//
// This file is pure (no store, no AI) so it can be unit tested with plain Node.

import { z } from "zod";
import { formatTime12 } from "../dates";

// Same loose shape the store accepts (lib/store.ts isUuid).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Id = z.string().regex(UUID_RE, "must be a uuid");
const Ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");
/** "HH:MM" 24-hour, or "" for no time (the tasks.time convention). */
const Hm = z.string().regex(/^(?:(?:[01]\d|2[0-3]):[0-5]\d)?$/, "must be HH:MM or empty");
const Title = z.string().trim().min(1).max(200);
const Notes = z.string().max(2000);
const Kind = z.enum(["school", "academic-ec", "side-ec", "personal", "commitment"]);
/** A name for a plan created earlier in the same ChangeSet, e.g. "p1". */
const Ref = z.string().regex(/^[a-z0-9_-]{1,32}$/i, "must be a short token");

// ─── Operations ─────────────────────────────────────────────────────────────
// Each op carries only the fields it needs; unknown keys are rejected.

export const CreatePlanOp = z.strictObject({
  op: z.literal("create_plan"),
  ref: Ref,
  title: Title,
  notes: Notes.optional(),
});

export const UpdatePlanOp = z
  .strictObject({
    op: z.literal("update_plan"),
    plan_id: Id,
    title: Title.optional(),
    notes: Notes.optional(),
  })
  .refine((o) => o.title !== undefined || o.notes !== undefined, "update_plan needs title or notes");

export const AddTaskOp = z
  .strictObject({
    op: z.literal("add_task"),
    title: Title,
    date: Ymd,
    time: Hm.optional(),
    calendarId: z.string().min(1).max(64).optional(),
    notes: Notes.optional(),
    kind: Kind.optional(),
    /** The first concrete step, as the plan generator writes it. */
    startAction: z.string().trim().min(1).max(300).optional(),
    resources: z.array(z.strictObject({ label: z.string().trim().min(1).max(200), url: z.url().max(2000) })).max(10).optional(),
    /** An existing plan to add to. */
    plan_id: Id.optional(),
    /** A plan created by a create_plan op earlier in this ChangeSet. */
    plan_ref: Ref.optional(),
  })
  .refine((o) => !(o.plan_id && o.plan_ref), "add_task takes plan_id or plan_ref, not both");

export const UpdateTaskOp = z
  .strictObject({
    op: z.literal("update_task"),
    task_id: Id,
    title: Title.optional(),
    date: Ymd.optional(),
    time: Hm.optional(),
    calendarId: z.string().min(1).max(64).optional(),
    notes: Notes.optional(),
    kind: Kind.optional(),
  })
  .refine(
    (o) => [o.title, o.date, o.time, o.calendarId, o.notes, o.kind].some((v) => v !== undefined),
    "update_task needs at least one field to change"
  );

export const MoveTaskOp = z.strictObject({
  op: z.literal("move_task"),
  task_id: Id,
  date: Ymd,
  time: Hm.optional(),
});

export const CompleteTaskOp = z.strictObject({ op: z.literal("complete_task"), task_id: Id });

export const DeleteTaskOp = z.strictObject({ op: z.literal("delete_task"), task_id: Id });

/** Removes a plan (or Project) itself. Its tasks are deleted by their own
 *  delete_task ops; tasks left out stay on the calendar, unlinked. Undo puts
 *  the plan back and relinks them. */
export const DeletePlanOp = z.strictObject({ op: z.literal("delete_plan"), plan_id: Id });

export const OpSchema = z.discriminatedUnion("op", [
  CreatePlanOp,
  UpdatePlanOp,
  AddTaskOp,
  UpdateTaskOp,
  MoveTaskOp,
  CompleteTaskOp,
  DeleteTaskOp,
  DeletePlanOp,
]);

export type ChangeOp = z.infer<typeof OpSchema>;
export type OpName = ChangeOp["op"];
export const OP_NAMES = ["create_plan", "update_plan", "add_task", "update_task", "move_task", "complete_task", "delete_task", "delete_plan"] as const satisfies readonly OpName[];

// ─── The ChangeSet ──────────────────────────────────────────────────────────

/** What the request was understood to be. question and clarify carry no ops:
 *  the first is answered in chat, the second asks the student to say more. */
export const INTENTS = [
  "new_plan",
  "add_to_plan",
  "change_plan",
  "add_task",
  "change_task",
  "complete_task",
  "delete_task",
  "question",
  "clarify",
] as const;
export type Intent = (typeof INTENTS)[number];

export const CHANGESET_STATUSES = ["draft", "confirmed", "discarded", "undone"] as const;
export type ChangeSetStatus = (typeof CHANGESET_STATUSES)[number];

export const ChangeSetSchema = z
  .strictObject({
    /** Also the idempotency key. */
    id: Id,
    user_id: Id,
    source: z.enum(["typed", "voice"]),
    request_text: z.string().max(4000),
    /** One short human sentence. */
    summary: z.string().trim().min(1).max(200),
    intent: z.enum(INTENTS),
    /** The existing plan this request is about, when it is about one. */
    target_plan_id: Id.nullable(),
    ops: z.array(OpSchema).max(400),
    /** Short strings shown to the student, e.g. "Assumed 4 PM since you didn't say". */
    assumptions: z.array(z.string().trim().min(1).max(200)).max(10),
    status: z.enum(CHANGESET_STATUSES),
    created_at: z.iso.datetime({ offset: true }),
    confirmed_at: z.iso.datetime({ offset: true }).nullable(),
    /** The single undo record (action_records.id) written when it was applied. */
    action_id: Id.nullable(),
    /** When apply finished (with or without an undo entry). Null while a
     *  confirm is still writing, so a second confirm knows whether to wait. */
    applied_at: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .superRefine((cs, ctx) => {
    const refs = new Set<string>();
    cs.ops.forEach((op, i) => {
      if (op.op === "create_plan") {
        if (refs.has(op.ref)) ctx.addIssue({ code: "custom", path: ["ops", i, "ref"], message: `duplicate plan ref "${op.ref}"` });
        refs.add(op.ref);
      }
      if (op.op === "add_task" && op.plan_ref && !refs.has(op.plan_ref)) {
        ctx.addIssue({ code: "custom", path: ["ops", i, "plan_ref"], message: `plan_ref "${op.plan_ref}" has no earlier create_plan` });
      }
    });
    if ((cs.intent === "question" || cs.intent === "clarify") && cs.ops.length > 0) {
      ctx.addIssue({ code: "custom", path: ["ops"], message: `a ${cs.intent} ChangeSet has no ops` });
    }
  });

export type ChangeSet = z.infer<typeof ChangeSetSchema>;

export function parseChangeSet(input: unknown): { ok: true; changeSet: ChangeSet } | { ok: false; error: string } {
  const r = ChangeSetSchema.safeParse(input);
  if (r.success) return { ok: true, changeSet: r.data };
  return { ok: false, error: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ") };
}

// ─── Preview lines ──────────────────────────────────────────────────────────

/** What describeChangeSet may know about the student's current calendar, so a
 *  line can name the task an op points at. Everything is optional. */
export type DescribeContext = {
  tasks?: ReadonlyArray<{ id: string; title: string }>;
  plans?: ReadonlyArray<{ id: string; title: string }>;
  /** The student's today (YYYY-MM-DD). Dates within the next 6 days show as a
   *  weekday alone ("Wed"); others, or all of them without it, add the date. */
  today?: string;
};

const DAY_MS = 86_400_000;
const utcNoon = (ymd: string) => new Date(`${ymd}T12:00:00Z`);

function when(date: string, time: string | undefined, today?: string): string {
  const d = utcNoon(date);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const ahead = today ? Math.round((d.getTime() - utcNoon(today).getTime()) / DAY_MS) : -1;
  const day =
    ahead >= 0 && ahead <= 6
      ? weekday
      : `${weekday} ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  return time ? `${day} ${formatTime12(time)}` : day;
}

/**
 * One preview line per op, e.g. "Add 'Draft ICF essay' · Wed 4:00 PM".
 * Pure: no AI, no store. Pass `known` to name tasks and plans by title.
 */
export function describeChangeSet(cs: Pick<ChangeSet, "ops">, known: DescribeContext = {}): string[] {
  const taskTitle = (id: string) => known.tasks?.find((t) => t.id === id)?.title;
  const planTitle = (id: string) => known.plans?.find((p) => p.id === id)?.title;
  const task = (id: string) => {
    const t = taskTitle(id);
    return t ? `'${t}'` : "a task";
  };
  const newPlans = new Map<string, string>();

  return cs.ops.map((op) => {
    switch (op.op) {
      case "create_plan":
        newPlans.set(op.ref, op.title);
        return `New plan '${op.title}'`;
      case "update_plan": {
        const current = planTitle(op.plan_id);
        const name = current ? `'${current}'` : "a plan";
        if (op.title !== undefined && op.title !== current) return `Rename plan ${name} to '${op.title}'`;
        return `Update notes on plan ${name}`;
      }
      case "add_task": {
        const plan = op.plan_ref ? newPlans.get(op.plan_ref) : op.plan_id ? planTitle(op.plan_id) : undefined;
        // Tasks of a plan created in this ChangeSet are obviously in it; say so only for existing plans.
        const into = op.plan_id && plan ? ` to '${plan}'` : "";
        return `Add '${op.title}'${into} · ${when(op.date, op.time, known.today)}`;
      }
      case "update_task": {
        const parts: string[] = [];
        if (op.title !== undefined) parts.push(`rename to '${op.title}'`);
        if (op.date !== undefined) parts.push(`move to ${when(op.date, op.time, known.today)}`);
        else if (op.time !== undefined) parts.push(op.time ? `time ${formatTime12(op.time)}` : "clear time");
        if (op.calendarId !== undefined) parts.push("change calendar");
        if (op.kind !== undefined) parts.push(`mark as ${op.kind}`);
        if (op.notes !== undefined) parts.push("edit notes");
        return `Change ${task(op.task_id)}: ${parts.join(", ")}`;
      }
      case "move_task":
        return `Move ${task(op.task_id)} → ${when(op.date, op.time, known.today)}`;
      case "complete_task":
        return `Complete ${task(op.task_id)}`;
      case "delete_task":
        return `Delete ${task(op.task_id)}`;
      case "delete_plan": {
        const name = planTitle(op.plan_id);
        return `Remove the plan ${name ? `'${name}'` : ""}`.trimEnd();
      }
    }
  });
}
