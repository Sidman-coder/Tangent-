// Pipeline V2: grades a drafted ChangeSet against a fixture's expectations
// (lib/pipeline/fixtures/requests.json). Pure, so it runs under plain Node.
//
// The grader checks the shape of the answer, not its wording: the intent, which
// plan it targets, how many ops, and which ops must never appear.

import { z } from "zod";
import { INTENTS, OP_NAMES, type ChangeSet } from "./changeset";
import { ROUTER_INTENTS } from "./intent";

// ─── Fixture file ───────────────────────────────────────────────────────────

const Ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const SeedSchema = z.strictObject({
  plans: z.array(
    z.strictObject({
      id: z.string(),
      title: z.string().min(1),
      /** Saved nicknames (plan_aliases.alias_normalized, B3). */
      aliases: z.array(z.string().min(1)).optional(),
      /** ISO time last created or changed, for the matcher's recency bonus. */
      activeAt: z.string().optional(),
    })
  ),
  tasks: z.array(
    z.strictObject({
      id: z.string(),
      title: z.string().min(1),
      date: Ymd,
      time: z.string(),
      completed: z.boolean().optional(),
      planId: z.string().optional(),
    })
  ),
});
export type Seed = z.infer<typeof SeedSchema>;

export const ExpectedSchema = z
  .strictObject({
    intent: z.enum(INTENTS),
    /** An existing plan's title, "NEW" for a plan this request creates, or
     *  null when the request is not about a plan. */
    target_plan: z.string().min(1).nullable(),
    min_ops: z.number().int().min(0),
    max_ops: z.number().int().min(0),
    /** Ops that must not appear, e.g. create_plan when the plan already exists. */
    must_not: z.array(z.enum(OP_NAMES)).optional(),
    /** Master fix: ops that must appear, e.g. delete_plan for "Also remove these plans". */
    must_have: z.array(z.enum(OP_NAMES)).optional(),
    /** Master fix (B6): the deletes (delete_task, delete_plan) touch exactly
     *  these seeded plans, each of them and no other, so a pick of two never
     *  takes the third. */
    delete_from: z.array(z.string().min(1)).optional(),
  })
  .refine((e) => e.min_ops <= e.max_ops, "min_ops must be ≤ max_ops");
export type Expected = z.infer<typeof ExpectedSchema>;

/**
 * Pipeline V2 step 3 (B6): what the router and matcher should do, checked
 * WITHOUT the AI by lib/pipeline/fixtures.test.ts. `answer` is the mocked
 * router's reply (skipped when the case takes a no-AI fast path); the rest
 * is what the code must then decide.
 */
export const RouterExpectSchema = z.strictObject({
  /** The mocked router's intent and confidence (default 0.95). */
  intent: z.enum(ROUTER_INTENTS),
  confidence: z.number().min(0).max(1).optional(),
  plan_mention: z.string().min(1).nullable().optional(),
  /** Where intake sends it (lib/pipeline/intent.ts IntakeRoute). */
  route: z.enum(["fast", "chat", "tangent", "clarify", "draft"]),
  /** The matcher's decision on plan_mention (or the text) against the seed. */
  match: z.enum(["sure", "unsure", "none"]).optional(),
  /** Sure: the target's title. Unsure: the candidate titles, best first. */
  match_titles: z.array(z.string().min(1)).optional(),
});
export type RouterExpect = z.infer<typeof RouterExpectSchema>;

/** A typed or tapped reply to the question the case raises (A1). */
export const AnswerExpectSchema = z.strictObject({
  text: z.string().min(1),
  resolves: z.enum(["pick", "cancel", "unrelated", "unclear", "scope", "closest", "another"]),
  /** For "pick": the titles chosen. */
  picks: z.array(z.string().min(1)).optional(),
  /** For "closest" (B5): the near title offered ("Delete that?"). */
  closest: z.string().min(1).optional(),
});

/** Master fix Phase 3: the plan brief the request reads as, checked with no AI. */
export const BriefExpectSchema = z.strictObject({
  /** lib/ai/plan-brief.ts GoalType, or null for "the model decides". */
  type: z.enum(["exam", "competition", "skill", "habit", "single"]).nullable(),
  /** How many questions the card may ask (inclusive). */
  min_questions: z.number().int().min(0).optional(),
  max_questions: z.number().int().min(0),
  /** The safety line is among the Just-do-it assumptions. */
  safety: z.boolean().optional(),
});

/** Master fix Phase 4: the chat around the request, checked with no AI. */
export const ChatExpectSchema = z.strictObject({
  /** The chat's earlier requests, oldest first. */
  previous: z.array(z.string().min(1)),
  /** The "new topic, start a new chat?" suggestion shows for this message. */
  new_topic: z.boolean(),
  /** The title the chat gets with no model (lib/chat-title.ts fallbackTitle). */
  title: z.string().min(1).optional(),
});

export const FixtureCaseSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  text: z.string().min(1),
  source: z.enum(["typed", "voice"]),
  /** Handled by the existing code fast path (lib/ai/router.ts), with no AI call. */
  no_ai: z.boolean().optional(),
  note: z.string().optional(),
  seed: SeedSchema,
  expected: ExpectedSchema,
  router: RouterExpectSchema.optional(),
  /** The pending question this case raises ("delete" plans or tasks, or a
   *  route "match"), and replies to it, each read on its own. */
  pending: z
    .strictObject({
      kind: z.enum(["task", "plan", "match"]),
      answers: z.array(AnswerExpectSchema).min(1),
      /** Master fix (B5): the question is the closest-match one ("You don't
       *  have an SAT writing plan. The closest is …"), offering the first
       *  candidate with [Delete …] [Pick another] [Cancel]. */
      closest: z.strictObject({ mention: z.string().min(1), note: z.string().optional() }).optional(),
    })
    .optional(),
  /** Master fix (B5): the text with typo'd intent words fixed ("deltet" → "delete"). */
  typo_fixed: z.string().min(1).optional(),
  brief: BriefExpectSchema.optional(),
  chat: ChatExpectSchema.optional(),
  /** The clean task title (A3) every capture path must produce. */
  title: z.string().min(1).optional(),
});
export type FixtureCase = z.infer<typeof FixtureCaseSchema>;

export const FixtureFileSchema = z.strictObject({
  version: z.literal(1),
  /** The "today" every relative date in the cases is read against. */
  reference_date: Ymd,
  timezone: z.string().min(1),
  cases: z.array(FixtureCaseSchema),
});
export type FixtureFile = z.infer<typeof FixtureFileSchema>;

// ─── Grading ────────────────────────────────────────────────────────────────

export type Grade = { pass: boolean; failures: string[] };

type Graded = Pick<ChangeSet, "intent" | "target_plan_id" | "ops">;

/**
 * Grades one drafted ChangeSet. `seed` resolves a target_plan title to the
 * seeded plan's id; without it a titled target only checks that some plan was
 * targeted. A missing ChangeSet (the pipeline produced nothing) fails.
 */
export function gradeCase(
  expected: Expected,
  changeSet: Graded | null | undefined,
  seed?: Pick<Seed, "plans"> & { tasks?: readonly { id: string; planId?: string | null }[] }
): Grade {
  const failures: string[] = [];
  if (!changeSet) return { pass: false, failures: ["no ChangeSet was produced"] };

  if (changeSet.intent !== expected.intent) {
    failures.push(`intent: expected ${expected.intent}, got ${changeSet.intent}`);
  }

  const n = changeSet.ops.length;
  if (n < expected.min_ops || n > expected.max_ops) {
    const range = expected.min_ops === expected.max_ops ? `${expected.min_ops}` : `${expected.min_ops}–${expected.max_ops}`;
    failures.push(`ops: expected ${range}, got ${n}`);
  }

  for (const name of expected.must_not ?? []) {
    const count = changeSet.ops.filter((o) => o.op === name).length;
    if (count > 0) failures.push(`must_not: has ${count} ${name} op${count === 1 ? "" : "s"}`);
  }

  for (const name of expected.must_have ?? []) {
    if (!changeSet.ops.some((o) => o.op === name)) failures.push(`must_have: no ${name} op`);
  }

  if (expected.delete_from) {
    const planOf = (taskId: string) => seed?.tasks?.find((t) => t.id === taskId)?.planId ?? "no plan";
    const touched = changeSet.ops.flatMap((o) => (o.op === "delete_plan" ? [o.plan_id] : o.op === "delete_task" ? [planOf(o.task_id)] : []));
    const title = (id: string) => seed?.plans.find((p) => p.id === id)?.title ?? id;
    const got = Array.from(new Set(touched.map(title))).sort();
    const want = [...expected.delete_from].sort();
    if (got.join("|") !== want.join("|")) {
      failures.push(`delete_from: expected ${want.map((t) => `'${t}'`).join(", ") || "none"}, got ${got.map((t) => `'${t}'`).join(", ") || "none"}`);
    }
  }

  const creates = changeSet.ops.some((o) => o.op === "create_plan");
  const target = expected.target_plan;
  if (target === null) {
    if (changeSet.target_plan_id !== null) failures.push(`target_plan: expected none, got ${changeSet.target_plan_id}`);
    if (creates) failures.push("target_plan: expected none, but a plan is created");
  } else if (target === "NEW") {
    if (!creates) failures.push("target_plan: expected a new plan, but none is created");
    if (changeSet.target_plan_id !== null) failures.push(`target_plan: expected a new plan, got existing ${changeSet.target_plan_id}`);
  } else {
    if (creates) failures.push(`target_plan: expected '${target}', but a new plan is created`);
    if (seed) {
      const want = seed.plans.find((p) => p.title === target);
      if (!want) failures.push(`target_plan: '${target}' is not in the seed`);
      else if (changeSet.target_plan_id !== want.id) {
        const got = seed.plans.find((p) => p.id === changeSet.target_plan_id);
        failures.push(`target_plan: expected '${target}', got ${got ? `'${got.title}'` : changeSet.target_plan_id ?? "none"}`);
      }
    } else if (changeSet.target_plan_id === null) {
      failures.push(`target_plan: expected '${target}', got none`);
    }
  }

  return { pass: failures.length === 0, failures };
}

// ─── Round 2 evals (lib/pipeline/fixtures/round2.json) ──────────────────────
// Task kind, slot inference and question/task/plan routing. Run with
// `npm run eval:pipeline -- --round2` (asks before spending; `--check` is free).

const KIND = z.enum(["fixed", "reminder", "flexible"]);
const SLOT = z.enum(["outcome", "deadline", "hoursPerWeek", "currentLevel", "hardestPart", "constraints", "bestTimeForThis"]);
export const ROUTE_KINDS = ["question", "task", "plan"] as const;
export type RouteKind = (typeof ROUTE_KINDS)[number];

export const Round2FileSchema = z.strictObject({
  version: z.literal(1),
  reference_date: Ymd,
  timezone: z.string().min(1),
  kinds: z.array(
    z.strictObject({
      id: z.string().regex(/^[a-z0-9-]+$/),
      title: z.string().min(1),
      hasFixedTime: z.boolean(),
      source: z.enum(["capture", "calendar", "canvas", "plan", "manual"]),
      kind: KIND,
    })
  ),
  slots: z.array(
    z.strictObject({
      id: z.string().regex(/^[a-z0-9-]+$/),
      text: z.string().min(1),
      /** Slots the text must fill. */
      has: z.array(SLOT),
      /** Slots it must leave empty (no guessing). */
      lacks: z.array(SLOT).optional(),
    })
  ),
  routes: z.array(
    z.strictObject({
      id: z.string().regex(/^[a-z0-9-]+$/),
      text: z.string().min(1),
      expect: z.enum(ROUTE_KINDS),
    })
  ),
  /** add_task captures whose clean_title should read as a short list item. */
  titles: z.array(
    z.strictObject({
      id: z.string().regex(/^[a-z0-9-]+$/),
      text: z.string().min(1),
      /** An existing project the title must not repeat. */
      project: z.string().min(1).optional(),
    })
  ),
});
export type Round2File = z.infer<typeof Round2FileSchema>;

const TITLE_EMOJI = /(?:[\uD83C-\uDBFF][\uDC00-\uDFFF]|[☀-➿])/;
const TITLE_LEAD_INS = /^(i |i'|remind me|need to|have to|add |put )/i;

/** A list-ready title: 2 to 6 words, no lead-in, no project name, no emoji, no trailing period. */
export function gradeTitle(expected: { project?: string }, got: string | null | undefined): Grade {
  const title = (got ?? "").trim();
  if (!title) return { pass: false, failures: ["title: none"] };
  const failures: string[] = [];
  const words = title.split(/\s+/).length;
  if (words < 2 || words > 6) failures.push(`title: ${words} words ("${title}")`);
  if (TITLE_LEAD_INS.test(title)) failures.push(`title: lead-in ("${title}")`);
  if (expected.project && title.toLowerCase().includes(expected.project.toLowerCase())) failures.push(`title: repeats project ("${title}")`);
  if (TITLE_EMOJI.test(title)) failures.push(`title: emoji ("${title}")`);
  if (/\.$/.test(title)) failures.push(`title: trailing period ("${title}")`);
  return { pass: failures.length === 0, failures };
}

export function gradeKind(expected: z.infer<typeof KIND>, got: string | null | undefined): Grade {
  return got === expected ? { pass: true, failures: [] } : { pass: false, failures: [`kind: expected ${expected}, got ${got ?? "nothing"}`] };
}

export function gradeSlots(expected: { has: readonly string[]; lacks?: readonly string[] }, filled: readonly string[]): Grade {
  const failures: string[] = [];
  for (const k of expected.has) if (!filled.includes(k)) failures.push(`slots: missing ${k}`);
  for (const k of expected.lacks ?? []) if (filled.includes(k)) failures.push(`slots: guessed ${k}`);
  return { pass: failures.length === 0, failures };
}

/** The router's answer as question / task / plan (null when it asked to clarify). */
export function routeKindOf(u: { route: string; intent: string | null }): RouteKind | null {
  if (u.route === "chat" || u.intent === "question") return "question";
  if (u.route === "fast") return "task";
  if (u.intent === "new_plan" || u.intent === "new_project" || u.intent === "add_to_plan" || u.intent === "change_plan") return "plan";
  if (u.intent === "add_task" || u.intent === "change_task" || u.intent === "complete_task") return "task";
  return null;
}

export function gradeRoute(expected: RouteKind, u: { route: string; intent: string | null }): Grade {
  const got = routeKindOf(u);
  return got === expected ? { pass: true, failures: [] } : { pass: false, failures: [`route: expected ${expected}, got ${got ?? `${u.route}/${u.intent ?? "none"}`}`] };
}

// ─── Round 4: the context engine ─────────────────────────────────────────────
// Slot coverage (free, rules only) and the swap test: the same goal for two
// students must give two different plans, each fitted to its student. Run with
// `npm run eval:pipeline -- --context` (asks before spending; `--check` is free).

const CaseId = z.string().regex(/^[a-z0-9-]+$/);

export const ContextEvalFileSchema = z.strictObject({
  version: z.literal(1),
  reference_date: Ymd,
  timezone: z.string().min(1),
  slot_coverage: z.array(
    z.strictObject({
      id: CaseId,
      text: z.string().min(1),
      type: z.enum(["general", "exam", "creator", "club", "essay"]),
      /** Slots Tangent must ask about. */
      asks: z.array(z.string().min(1)).min(1),
      /** Slots the words already answer, so it must not ask. */
      never: z.array(z.string().min(1)).optional(),
    })
  ),
  swaps: z.array(
    z.strictObject({
      id: CaseId,
      goal: z.string().min(1),
      sessions: z.number().int().min(2).max(14),
      profiles: z
        .array(
          z.strictObject({
            id: CaseId,
            facts: z.array(z.strictObject({ text: z.string().min(1), category: z.string().min(1) })).min(2),
            /** Word stems; the plan must mention at least one. */
            mentions: z.array(z.string().min(2)).min(1),
          })
        )
        .length(2),
    })
  ),
});
export type ContextEvalFile = z.infer<typeof ContextEvalFileSchema>;

/** Jaccard overlap of two sets of words (0–1). */
function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let both = 0;
  a.forEach((w) => {
    if (b.has(w)) both++;
  });
  return both / (a.size + b.size - both);
}

function planWords(tasks: readonly { title: string; notes?: string }[]): Set<string> {
  const out = new Set<string>();
  for (const t of tasks) for (const w of `${t.title} ${t.notes ?? ""}`.toLowerCase().match(/[a-z]{4,}/g) ?? []) out.add(w);
  return out;
}

/** Most this alike two plans for different students may be. */
export const SWAP_MAX_OVERLAP = 0.6;

/**
 * Two plans for the same goal and two different students: each must mention
 * something from its own student's facts, and together they must not be
 * near-copies.
 */
export function gradeSwap(
  profiles: readonly { id: string; mentions: readonly string[] }[],
  plans: readonly (readonly { title: string; notes?: string }[])[],
): Grade {
  const failures: string[] = [];
  profiles.forEach((p, i) => {
    const tasks = plans[i] ?? [];
    if (!tasks.length) {
      failures.push(`${p.id}: no plan`);
      return;
    }
    const text = tasks.map((t) => `${t.title} ${t.notes ?? ""}`).join(" ").toLowerCase();
    if (!p.mentions.some((m) => text.includes(m.toLowerCase()))) failures.push(`${p.id}: mentions none of ${p.mentions.join(", ")}`);
  });
  if (plans.length >= 2 && plans[0].length && plans[1].length) {
    const o = overlap(planWords(plans[0]), planWords(plans[1]));
    if (o > SWAP_MAX_OVERLAP) failures.push(`plans too alike (${Math.round(o * 100)}% shared words)`);
  }
  return { pass: failures.length === 0, failures };
}
