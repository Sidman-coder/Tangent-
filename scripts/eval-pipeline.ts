// Pipeline V2 eval: runs every case in lib/pipeline/fixtures/requests.json
// through the real typed-chat intake (lib/pipeline/intake.ts handleRequest: the
// routing rule, then handleVoiceText with preview on) and grades the drafted
// ChangeSet with lib/pipeline/grade.ts. A chat reply grades as "question".
//
//   npm run eval:pipeline -- --check   validate fixtures + modules, print the
//                                      cost estimate; no database, no AI
//   npm run eval:pipeline -- --quality [--check]   Round 5A plan specificity
//                                      (plan-quality.json; no database)
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
const ROUTER_CALL = { input_tokens: 1200, output_tokens: 120 };
const VOICE_CALL = { input_tokens: 4000, output_tokens: 400 };
const PLAN_OUTLINE = { input_tokens: 3000, output_tokens: 300 };
const PLAN_DETAIL = { input_tokens: 3000, output_tokens: 2048 };
const PLAN_DETAIL_CALLS = 3;
const MARGIN = 1.5;

async function main() {
  const check = process.argv.includes("--check");
  if (process.argv.includes("--round2")) return round2(check);
  if (process.argv.includes("--context")) return contextSwap(check);
  if (process.argv.includes("--quality")) return planQuality(check);
  // Drafting is gated on the flag, read when lib/pipeline/flags.ts loads.
  process.env.TANGENT_PIPELINE_V2 = "true";

  const { FixtureFileSchema, gradeCase } = await import("@/lib/pipeline/grade");
  const { estimateCostUsd, modelFor, FALLBACK_MODELS } = await import("@/lib/ai/models");
  const { routeCommand } = await import("@/lib/ai/router");
  const raw = (await import("@/lib/pipeline/fixtures/requests.json")).default as unknown;

  const parsed = FixtureFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("Fixture file is invalid:\n" + parsed.error.message);
    process.exit(1);
  }
  const fixtures: FixtureFile = parsed.data;
  // `--only id1,id2` reruns just those cases (overnight 2, to chase one flake).
  const onlyAt = process.argv.indexOf("--only");
  const only = onlyAt > 0 ? new Set((process.argv[onlyAt + 1] ?? "").split(",").filter(Boolean)) : null;
  const cases = only ? fixtures.cases.filter((c) => only.has(c.id)) : fixtures.cases;
  const ai = cases.filter((c) => !c.no_ai);
  const plans = ai.filter((c) => c.expected.intent === "new_plan");

  // Per request: a quick command is the router + one voice call; a new plan
  // adds the SMART outline and the parallel FAST detail calls.
  const perRequest = (fast: string, smart: string) => {
    const command = estimateCostUsd(fast, ROUTER_CALL) + estimateCostUsd(fast, VOICE_CALL);
    const plan = command + estimateCostUsd(smart, PLAN_OUTLINE) + PLAN_DETAIL_CALLS * estimateCostUsd(fast, PLAN_DETAIL);
    return { command, plan };
  };
  const fast = modelFor("FAST");
  const smart = modelFor("SMART");
  const { command: voice, plan } = perRequest(fast, smart);
  const cost = MARGIN * ((ai.length - plans.length) * voice + plans.length * plan);
  const before = perRequest(FALLBACK_MODELS.FAST, FALLBACK_MODELS.SMART);
  const usd = (n: number) => `$${n.toFixed(4)}`;

  console.log(`Fixtures: ${cases.length} cases (${ai.length} call the AI, ${plans.length} plan, ${cases.length - ai.length} fast path)`);
  console.log(`Models: FAST ${fast}, SMART ${smart}`);
  console.log(`Per request: command ${usd(voice)}, new plan ${usd(plan)} (on ${FALLBACK_MODELS.FAST} / ${FALLBACK_MODELS.SMART}: ${usd(before.command)}, ${usd(before.plan)})`);
  console.log(`Estimated cost: about $${cost.toFixed(2)} (×${MARGIN} margin)`);

  // Load the pipeline itself so --check also proves the modules resolve.
  const { handleRequest } = await import("@/lib/pipeline/intake");
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

  // Overnight 2: the live pipeline reads the real clock, so seeded tasks move
  // by whole weeks from reference_date to the first same weekday on or after
  // today ("this week", "friday" keep their meaning; weekdays don't change).
  seedShiftDays = shiftDaysFor(fixtures.reference_date, fixtures.timezone);
  console.log(`Seed dates shifted by ${seedShiftDays} days (reference ${fixtures.reference_date}).`);

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
      for (const alias of p.aliases ?? []) await store.savePlanAlias(made.plan.id, alias);
    }
    for (const t of c.seed.tasks.filter((t) => !t.planId)) await store.addTask(seedTask(t));
    const seedPlans = c.seed.plans.map((p) => ({ id: ids[p.id], title: p.title }));

    const data = await handleRequest([{ role: "user", content: c.text }], { source: c.source });
    const action = String(data.action ?? "");
    if (only) console.log(`  ${c.id} action=${action} reply=${JSON.stringify(String(data.response ?? data.message ?? "")).slice(0, 300)}`);

    let graded: Graded | null = null;
    let reason = "";
    if (action === "preview" && data.changeSet) {
      const cs = data.changeSet as ChangeSet;
      graded = cs;
      // Leave nothing behind as an open draft.
      await store.markChangeSet(cs.id, "discarded", { from: "draft" });
    } else if (action === "chat_reply" || action === "plan_reply") {
      graded = { intent: "question", target_plan_id: null, ops: [] };
    } else if (action === "confirm_required" && (graded = await pendingAsOps(data))) {
      // Overnight 2: a delete that asks "Delete X?" first is the safe, correct
      // route (every destructive action asks). Grade the ops it would run.
    } else if (action === "confirm_required" || action === "clarify") {
      // A question back (A1 "Which plan?", B1 "What did you mean?").
      graded = { intent: "clarify", target_plan_id: null, ops: [] };
    } else if (action === "route_tangent") {
      // Handed to Tangents: nothing changes here.
      graded = { intent: "question", target_plan_id: null, ops: [] };
    } else {
      const route = routeCommand(c.text, tz);
      if (route && data.actionId) graded = fastStandIn(route);
      else if (!data.actionId && action !== "error") graded = { intent: "question", target_plan_id: null, ops: [] };
      else reason = `wrote directly (action=${action || "none"}), not drafted`;
    }

    const seedTasks = c.expected.delete_from ? (await store.getAllTasks()).map((t) => ({ id: t.id, planId: t.planId })) : undefined;
    const grade = graded ? gradeCase(c.expected, graded, { plans: seedPlans, tasks: seedTasks }) : { pass: false, failures: [reason] };
    if (only && graded) console.log(`  ${c.id} ops:`, JSON.stringify(graded.ops).slice(0, 1500));
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

let seedShiftDays = 0;

/** Whole weeks (in days) from the fixture's reference date to the first same
 *  weekday on or after today in `tz`. 0 when the reference is today or later. */
export function shiftDaysFor(referenceDate: string, tz: string, now = new Date()): number {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const diff = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${referenceDate}T00:00:00Z`)) / 86_400_000);
  return diff > 0 ? Math.ceil(diff / 7) * 7 : 0;
}

function shiftDate(date: string | undefined): string | undefined {
  if (!date || !seedShiftDays || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date(Date.parse(`${date}T00:00:00Z`) + seedShiftDays * 86_400_000).toISOString().slice(0, 10);
}

function seedTask(t: FixtureCase["seed"]["tasks"][number]): Omit<Task, "id" | "planId"> {
  return { title: t.title, date: shiftDate(t.date) as string, time: t.time, completed: t.completed ?? false };
}

/** A "Delete X?" confirmation, read back as the ops it would run, then
 *  cleared so nothing is left waiting. Null for any other kind. */
async function pendingAsOps(data: Record<string, unknown>): Promise<Graded | null> {
  const store = await import("@/lib/store");
  const id = (data.pending as { id?: unknown } | undefined)?.id;
  if (typeof id !== "string") return null;
  const p = await store.getPendingConfirmation(id);
  await store.resolvePendingConfirmation(id);
  if (!p) return null;
  const pay = p.payload as { taskId?: unknown; taskIds?: unknown; planIds?: unknown; date?: unknown; time?: unknown; bulk?: unknown };
  // "Move "Dentist" to Fri?": the fast path's single reschedule, confirmed first.
  if (p.kind === "reschedule_task" && !pay.bulk && typeof pay.taskId === "string" && typeof pay.date === "string") {
    const move = { op: "move_task", task_id: pay.taskId, date: pay.date, ...(typeof pay.time === "string" && pay.time ? { time: pay.time } : {}) };
    return { intent: "change_task", target_plan_id: null, ops: [move as unknown as ChangeOp] };
  }
  if (p.kind !== "delete_task") return null;
  const taskIds = [...(typeof pay.taskId === "string" ? [pay.taskId] : []), ...(Array.isArray(pay.taskIds) ? pay.taskIds.filter((t): t is string => typeof t === "string") : [])];
  const planIds = Array.isArray(pay.planIds) ? pay.planIds.filter((t): t is string => typeof t === "string") : [];
  if (taskIds.length === 0) return null;
  const op = (o: Record<string, unknown>) => o as unknown as ChangeOp;
  return {
    intent: "delete_task",
    target_plan_id: null,
    ops: [...taskIds.map((task_id) => op({ op: "delete_task", task_id })), ...planIds.map((plan_id) => op({ op: "delete_plan", plan_id }))],
  };
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

/**
 * Round 5A (2.4): plan specificity, from lib/pipeline/fixtures/plan-quality.json.
 * Each case runs the brief-building call (plus at most one fix call) on its
 * fixture week and facts, then gradePlanQuality checks every kept step is
 * specific and on topic. No database, nothing saved. `--quality --check` is free.
 */
async function planQuality(check: boolean) {
  const { validateQualityFile, gradePlanQuality } = await import("@/lib/ai/plan-quality");
  const { estimateCostUsd, modelFor } = await import("@/lib/ai/models");
  const raw = (await import("@/lib/pipeline/fixtures/plan-quality.json")).default as unknown;
  const problems = validateQualityFile(raw);
  if (problems.length > 0) {
    console.error("plan-quality.json is invalid:\n" + problems.join("\n"));
    process.exit(1);
  }
  const file = raw as import("@/lib/ai/plan-quality").QualityFile;
  // Round 6: `--only id1,id2` runs just those cases (targeted before/after).
  const onlyAt = process.argv.indexOf("--only");
  const only = onlyAt > 0 ? new Set((process.argv[onlyAt + 1] ?? "").split(",").filter(Boolean)) : null;
  const cases = only ? file.cases.filter((c) => only.has(c.id)) : file.cases;
  const perCase = 2 * estimateCostUsd(modelFor("SMART"), PLAN_OUTLINE);
  const cost = MARGIN * cases.length * perCase;
  console.log(`Plan quality: ${cases.length} cases on ${modelFor("SMART")}`);
  console.log(`Estimated cost: at most about $${cost.toFixed(2)} (x${MARGIN} margin; a fix call only when a step fails)`);

  const { buildPlanBrief } = await import("@/lib/ai/plan-brief-call");
  const { PLAN_GUARD } = await import("@/lib/ai/plan-guard-config");
  const guard = await import("@/lib/ai/plan-guard");
  const { gradePlacement } = await import("@/lib/ai/placement-grade");
  const { promptDateContext } = await import("@/lib/time");
  if (check) {
    console.log("Check OK: plan-quality fixtures valid, modules load. No AI calls made.");
    return;
  }
  if (!(await ask(`This calls the AI for ${cases.length} cases (about $${cost.toFixed(2)}). Type y to continue: `))) {
    console.log("Stopped. Nothing was spent.");
    return;
  }
  // Real spend, from the [perf] claude lines each call prints (dev mode).
  let spent = 0;
  const log = console.log;
  console.log = (...args: unknown[]) => {
    const m = typeof args[0] === "string" ? /^\[perf\] claude [^:]+: (\S+) \| in (\d+) tok.*?, out (\d+) tok/.exec(args[0]) : null;
    if (m) spent += estimateCostUsd(m[1], { input_tokens: Number(m[2]), output_tokens: Number(m[3]) });
    else log(...args);
  };
  let passed = 0;
  for (const c of cases) {
    const before = spent;
    const at = new Date(`${c.reference_date ?? file.reference_date}T12:00:00Z`);
    const brief = await buildPlanBrief({
      request: c.request,
      dateContext: promptDateContext(file.timezone, at),
      weekSummary: c.weekSummary,
      facts: c.facts,
      dates: c.dates,
      times: c.times,
      noQuestion: true,
      guard: PLAN_GUARD,
    }).catch(() => null);
    const g = gradePlanQuality(c, brief, PLAN_GUARD, guard);
    const p = gradePlacement(c, brief, file.reference_date);
    const pass = g.pass && (p?.pass ?? true);
    if (pass) passed++;
    const failures = [...g.failures, ...(p?.failures ?? [])];
    console.log(`${pass ? "PASS" : "FAIL"}  ${c.id}  ($${(spent - before).toFixed(3)})${pass ? "" : `  (${failures.join("; ")})`}`);
    if (p) console.log(`        ${p.summary}`);
    // With a placement grade, the steps print at their final slot with the reason the student sees.
    for (const line of p?.lines ?? (brief?.steps ?? []).map((s) => `${s.what} | ${s.why}`)) console.log(`        - ${line}`);
  }
  console.log = log;
  console.log(`\n${passed}/${cases.length} passed · spent about $${spent.toFixed(3)} ($${(spent / Math.max(1, cases.length)).toFixed(3)} per plan brief)`);
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

/**
 * Round 2 (F.2): task kind, slot inference and question/task/plan routing,
 * from lib/pipeline/fixtures/round2.json. Each case is at most one FAST call
 * and writes nothing to the database. `--round2 --check` is free.
 */
async function round2(check: boolean) {
  const { Round2FileSchema, gradeKind, gradeSlots, gradeRoute, gradeTitle } = await import("@/lib/pipeline/grade");
  const { estimateCostUsd, modelFor } = await import("@/lib/ai/models");
  const raw = (await import("@/lib/pipeline/fixtures/round2.json")).default as unknown;
  const parsed = Round2FileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("round2.json is invalid:\n" + parsed.error.message);
    process.exit(1);
  }
  const file = parsed.data;
  const n = file.kinds.length + file.slots.length + file.routes.length + file.titles.length;
  const cost = MARGIN * n * estimateCostUsd(modelFor("FAST"), ROUTER_CALL);
  console.log(`Round 2: ${file.kinds.length} kind, ${file.slots.length} slot, ${file.routes.length} route, ${file.titles.length} title cases on ${modelFor("FAST")}`);
  console.log(`Estimated cost: at most about $${cost.toFixed(2)} (×${MARGIN} margin; clear cases skip the AI)`);

  const { classifyWithFallback } = await import("@/lib/task-kind-ai");
  const { inferSlotsWithFallback } = await import("@/lib/context/infer");
  const { classifyIntent } = await import("@/lib/pipeline/intent");
  const { callIntentRouter } = await import("@/lib/pipeline/understand");
  if (check) {
    console.log("Check OK: round2 fixtures valid, modules load. No AI calls made.");
    return;
  }
  if (!(await ask(`This calls the AI for up to ${n} cases (about $${cost.toFixed(2)}). Type y to continue: `))) {
    console.log("Stopped. Nothing was spent.");
    return;
  }

  const results: { id: string; pass: boolean; failures: string[] }[] = [];
  const run = async (id: string, grade: () => Promise<{ pass: boolean; failures: string[] }>) => {
    const g = await grade().catch((e: unknown) => ({ pass: false, failures: [`error: ${e instanceof Error ? e.message : String(e)}`] }));
    results.push({ id, ...g });
    console.log(`${g.pass ? "PASS" : "FAIL"}  ${id}${g.pass ? "" : `  (${g.failures.join("; ")})`}`);
  };
  for (const c of file.kinds) {
    await run(c.id, async () => gradeKind(c.kind, (await classifyWithFallback({ title: c.title, hasFixedTime: c.hasFixedTime, source: c.source })).kind));
  }
  for (const c of file.slots) {
    await run(c.id, async () => gradeSlots(c, Object.keys(await inferSlotsWithFallback(c.text, file.reference_date))));
  }
  for (const c of file.routes) {
    await run(c.id, async () =>
      gradeRoute(c.expect, await classifyIntent(c.text, { flag: true, tz: file.timezone, today: file.reference_date, planTitles: [], caller: callIntentRouter }))
    );
  }
  for (const c of file.titles) {
    await run(c.id, async () =>
      gradeTitle(c, (await classifyIntent(c.text, { flag: true, tz: file.timezone, today: file.reference_date, planTitles: c.project ? [c.project] : [], caller: callIntentRouter })).cleanTitle)
    );
  }
  for (const part of ["kind", "slot", "route", "title"]) {
    const rows = results.filter((r) => r.id.startsWith(`${part}-`));
    console.log(`${part}: ${rows.filter((r) => r.pass).length}/${rows.length}`);
  }
  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
}

/**
 * Round 4 (Phase 2.5): the swap test, from lib/pipeline/fixtures/context.json.
 * Each goal is planned twice, once per student profile (their facts ranked
 * into the same STUDENT CONTEXT block the app sends), and gradeSwap checks the
 * two plans differ and each fits its student. Calls generatePlan directly:
 * no database, nothing saved. `--context --check` is free; slot coverage is
 * rules-only and runs in `npm test`.
 */
async function contextSwap(check: boolean) {
  const { ContextEvalFileSchema, gradeSwap } = await import("@/lib/pipeline/grade");
  const { estimateCostUsd, modelFor } = await import("@/lib/ai/models");
  const { rankFacts, factLine } = await import("@/lib/student/context-pack");
  const { generatePlan, planDates } = await import("@/lib/ai/plan");
  const { promptDateContext, addDaysYMD } = await import("@/lib/time");
  const raw = (await import("@/lib/pipeline/fixtures/context.json")).default as unknown;
  const parsed = ContextEvalFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("context.json is invalid:\n" + parsed.error.message);
    process.exit(1);
  }
  const file = parsed.data;
  const plans = file.swaps.length * 2;
  const perPlan = estimateCostUsd(modelFor("SMART"), PLAN_OUTLINE) + PLAN_DETAIL_CALLS * estimateCostUsd(modelFor("FAST"), PLAN_DETAIL);
  const cost = MARGIN * plans * perPlan;
  console.log(`Context swap: ${file.swaps.length} goals × 2 students = ${plans} plans (${file.slot_coverage.length} slot coverage cases run free in npm test)`);
  console.log(`Estimated cost: at most about $${cost.toFixed(2)} (×${MARGIN} margin)`);
  if (check) {
    console.log("Check OK: context fixtures valid, modules load. No AI calls made.");
    return;
  }
  if (!(await ask(`This makes ${plans} plans with the AI (about $${cost.toFixed(2)}). Type y to continue: `))) {
    console.log("Stopped. Nothing was spent.");
    return;
  }

  const now = new Date(`${file.reference_date}T12:00:00Z`);
  let passed = 0;
  for (const s of file.swaps) {
    const start = addDaysYMD(file.reference_date, 1);
    const dates = planDates(start, addDaysYMD(start, s.sessions * 3)).slice(0, s.sessions);
    const made = await Promise.all(
      s.profiles.map(async (p) => {
        const facts = rankFacts(
          p.facts.map((f, i) => ({ id: `${p.id}-${i}`, text: f.text, factCategory: f.category as never, timestamp: now.toISOString() })),
          { purpose: "plan", query: s.goal, now },
        );
        const picture = `WHAT YOU KNOW ABOUT THEM (most relevant first):\n${facts.map(factLine).join("\n")}`;
        const plan = await generatePlan({
          request: `${s.goal}\n\nSTUDENT CONTEXT (fit the plan to this student):\n${picture}`,
          dateContext: promptDateContext(file.timezone, now),
          dates,
        });
        if (!plan.ok) console.log(`  ${p.id}: plan failed (${plan.error})`);
        return plan.ok ? plan.tasks : [];
      }),
    );
    const g = gradeSwap(s.profiles, made);
    if (g.pass) passed++;
    console.log(`${g.pass ? "PASS" : "FAIL"}  ${s.id}${g.pass ? "" : `  (${g.failures.join("; ")})`}`);
    s.profiles.forEach((p, i) => console.log(`  ${p.id}: ${made[i].slice(0, 3).map((t) => t.title).join(" | ")}`));
  }
  console.log(`\n${passed}/${file.swaps.length} passed`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
