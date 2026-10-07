// Pipeline V2 eval: runs every case in lib/pipeline/fixtures/requests.json
// through the real typed-chat pipeline (handleVoiceText with preview on) and
// grades the drafted ChangeSet with lib/pipeline/grade.ts.
//
//   npm run eval:pipeline -- --check   validate fixtures + modules, print the
//                                      cost estimate; no database, no AI
//   npm run eval:pipeline              the real run (calls the AI, writes to
//                                      the eval account's rows only)
//
// The real run needs TANGENT_EVAL_USER_ID in .env.local: a dedicated account
// whose email contains "+eval". It wipes that account's tasks and plans before
// every case, so it refuses any other account and asks before starting.

import type { ChangeOp, ChangeSet } from "@/lib/pipeline/changeset";
import type { FixtureCase, FixtureFile } from "@/lib/pipeline/grade";
import type { FastRoute } from "@/lib/ai/router";
import type { Task } from "@/lib/types";

type Graded = Pick<ChangeSet, "intent" | "target_plan_id" | "ops">;
type Row = { id: string; pass: boolean; intent: string; target: string; ops: string; reason: string };

// Rough per-call token budgets for the estimate (input / output).
const VOICE_CALL = { input_tokens: 4000, output_tokens: 400 };
const PLAN_OUTLINE = { input_tokens: 3000, output_tokens: 300 };
const PLAN_DETAIL = { input_tokens: 3000, output_tokens: 2048 };
const PLAN_DETAIL_CALLS = 3;
const MARGIN = 1.5;

async function main() {
  const check = process.argv.includes("--check");
  // Drafting is gated on the flag, read when lib/pipeline/flags.ts loads.
  process.env.TANGENT_PIPELINE_V2 = "true";

  const { FixtureFileSchema, gradeCase } = await import("@/lib/pipeline/grade");
  const { estimateCostUsd, modelFor } = await import("@/lib/ai/models");
  const { routeCommand } = await import("@/lib/ai/router");
  const raw = (await import("@/lib/pipeline/fixtures/requests.json")).default as unknown;

  const parsed = FixtureFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("Fixture file is invalid:\n" + parsed.error.message);
    process.exit(1);
  }
  const fixtures: FixtureFile = parsed.data;
  const cases = fixtures.cases;
  const ai = cases.filter((c) => !c.no_ai);
  const plans = ai.filter((c) => c.expected.intent === "new_plan");

  const fast = modelFor("FAST");
  const smart = modelFor("SMART");
  const voice = estimateCostUsd(fast, VOICE_CALL);
  const plan = voice + estimateCostUsd(smart, PLAN_OUTLINE) + PLAN_DETAIL_CALLS * estimateCostUsd(fast, PLAN_DETAIL);
  const cost = MARGIN * ((ai.length - plans.length) * voice + plans.length * plan);

  console.log(`Fixtures: ${cases.length} cases (${ai.length} call the AI, ${plans.length} plan, ${cases.length - ai.length} fast path)`);
  console.log(`Models: FAST ${fast}, SMART ${smart}`);
  console.log(`Estimated cost: about $${cost.toFixed(2)} (×${MARGIN} margin)`);

  // Load the pipeline itself so --check also proves the modules resolve.
  const { handleVoiceText } = await import("@/lib/voice-handler");
  const store = await import("@/lib/store");
  const { runAsUser } = await import("@/lib/request-context");
  const { createAdminClient } = await import("@/lib/supabase/admin");

  if (check) {
    console.log("Check OK: fixtures valid, modules load. No database or AI calls made.");
    return;
  }

  const userId = process.env.TANGENT_EVAL_USER_ID?.trim();
  if (!userId) throw new Error("Set TANGENT_EVAL_USER_ID in .env.local (see docs/tangent-pipeline-final-checks.md, section D).");
  const { data: profile, error } = await createAdminClient().from("profiles").select("email").eq("user_id", userId).single();
  if (error || !profile) throw new Error(`No profile for TANGENT_EVAL_USER_ID (${error?.message ?? "not found"}). Sign in once with the eval account.`);
  const email = String(profile.email ?? "");
  if (!email.includes("+eval")) throw new Error(`Refusing: ${email || "this account"} is not a +eval account. The eval wipes its tasks and plans.`);

  console.log(`\nAccount: ${email}`);
  console.log(`This deletes every task and plan on that account, then runs ${cases.length} cases (about $${cost.toFixed(2)}).`);
  if (!(await ask("Type y to continue: "))) {
    console.log("Stopped. Nothing was changed.");
    return;
  }

  const rows: Row[] = [];
  for (const c of cases) {
    const row = await runAsUser(userId, () => runCase(c, fixtures.timezone)).catch(
      (e: unknown): Row => ({ id: c.id, pass: false, intent: "-", target: "-", ops: "-", reason: `error: ${e instanceof Error ? e.message : String(e)}` })
    );
    rows.push(row);
    console.log(`${row.pass ? "PASS" : "FAIL"}  ${c.id}${row.pass ? "" : `  (${row.reason})`}`);
  }
  // Leave the eval account empty.
  await runAsUser(userId, () => reset());

  printTable(rows);
  const passed = rows.filter((r) => r.pass).length;
  console.log(`\n${passed}/${rows.length} passed`);

  async function reset() {
    await store.clearAllTasks();
    const existing = await store.getAllPlans();
    for (const p of existing) await store.deletePlan(p.id);
  }

  async function runCase(c: FixtureCase, tz: string): Promise<Row> {
    await reset();

    // Seed: plans with their tasks, then loose tasks. Seed ids → real ids.
    const ids: Record<string, string> = {};
    for (const p of c.seed.plans) {
      const tasks = c.seed.tasks.filter((t) => t.planId === p.id).map(seedTask);
      const made = await store.addPlanWithTasks({ title: p.title }, tasks);
      ids[p.id] = made.plan.id;
    }
    for (const t of c.seed.tasks.filter((t) => !t.planId)) await store.addTask(seedTask(t));
    const seedPlans = c.seed.plans.map((p) => ({ id: ids[p.id], title: p.title }));

    const res = await handleVoiceText(c.text, { preview: true });
    const data = (await res.json()) as Record<string, unknown>;
    const action = String(data.action ?? "");

    let graded: Graded | null = null;
    let reason = "";
    if (action === "preview" && data.changeSet) {
      const cs = data.changeSet as ChangeSet;
      graded = cs;
      // Leave nothing behind as an open draft.
      await store.markChangeSet(cs.id, "discarded", { from: "draft" });
    } else if (action === "confirm_required") {
      graded = { intent: "clarify", target_plan_id: null, ops: [] };
    } else {
      const route = routeCommand(c.text, tz);
      if (route && data.actionId) graded = fastStandIn(route);
      else if (!data.actionId && action !== "error") graded = { intent: "question", target_plan_id: null, ops: [] };
      else reason = `wrote directly (action=${action || "none"}), not drafted`;
    }

    const grade = graded ? gradeCase(c.expected, graded, { plans: seedPlans }) : { pass: false, failures: [reason] };
    const target = graded?.target_plan_id ? seedPlans.find((p) => p.id === graded!.target_plan_id)?.title ?? "other plan" : graded?.ops.some((o) => o.op === "create_plan") ? "NEW" : "none";
    return {
      id: c.id,
      pass: grade.pass,
      intent: graded?.intent ?? "-",
      target,
      ops: graded ? graded.ops.map((o) => o.op).join(",") || "0" : "-",
      reason: grade.failures.join("; "),
    };
  }
}

function seedTask(t: FixtureCase["seed"]["tasks"][number]): Omit<Task, "id" | "planId"> {
  return { title: t.title, date: t.date, time: t.time, completed: t.completed ?? false };
}

/** A fast path wrote directly (by design: no AI). Grade what it did. */
function fastStandIn(route: FastRoute): Graded {
  const op = (o: Record<string, unknown>) => o as unknown as ChangeOp;
  switch (route.op) {
    case "add":
      return { intent: "add_task", target_plan_id: null, ops: [op({ op: "add_task", title: route.title, date: route.date, time: route.time })] };
    case "complete":
    case "uncomplete":
      return { intent: "complete_task", target_plan_id: null, ops: [op({ op: "complete_task", task_id: "fast" })] };
    case "reschedule":
      return { intent: "change_task", target_plan_id: null, ops: [op({ op: "move_task", task_id: "fast", date: route.date ?? "" })] };
    case "delete":
      return { intent: "delete_task", target_plan_id: null, ops: [op({ op: "delete_task", task_id: "fast" })] };
    case "due":
      return { intent: "question", target_plan_id: null, ops: [] };
  }
}

function ask(question: string): Promise<boolean> {
  return import("node:readline").then(
    ({ createInterface }) =>
      new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => {
          rl.close();
          resolve(answer.trim().toLowerCase() === "y");
        });
      })
  );
}

function printTable(rows: Row[]) {
  const head: Row = { id: "case", pass: true, intent: "intent", target: "target plan", ops: "ops", reason: "fail reason" };
  const cells = (r: Row, isHead = false) => [r.id, isHead ? "result" : r.pass ? "pass" : "FAIL", r.intent, r.target, r.ops, r.reason];
  const all = [cells(head, true), ...rows.map((r) => cells(r))];
  const widths = all[0].slice(0, 5).map((_, i) => Math.max(...all.map((row) => row[i].length)));
  console.log("");
  for (const row of all) console.log(row.map((cell, i) => (i < 5 ? cell.padEnd(widths[i]) : cell)).join("  "));
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
