// Pipeline V2: grades a drafted ChangeSet against a fixture's expectations
// (lib/pipeline/fixtures/requests.json). Pure, so it runs under plain Node.
//
// The grader checks the shape of the answer, not its wording: the intent, which
// plan it targets, how many ops, and which ops must never appear.

import { z } from "zod";
import { INTENTS, OP_NAMES, type ChangeSet } from "./changeset";

// ─── Fixture file ───────────────────────────────────────────────────────────

const Ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const SeedSchema = z.strictObject({
  plans: z.array(z.strictObject({ id: z.string(), title: z.string().min(1) })),
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
  })
  .refine((e) => e.min_ops <= e.max_ops, "min_ops must be ≤ max_ops");
export type Expected = z.infer<typeof ExpectedSchema>;

export const FixtureCaseSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  text: z.string().min(1),
  source: z.enum(["typed", "voice"]),
  /** Handled by the existing code fast path (lib/ai/router.ts), with no AI call. */
  no_ai: z.boolean().optional(),
  note: z.string().optional(),
  seed: SeedSchema,
  expected: ExpectedSchema,
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
export function gradeCase(expected: Expected, changeSet: Graded | null | undefined, seed?: Pick<Seed, "plans">): Grade {
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
