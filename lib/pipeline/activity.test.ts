// Run with `npm test`. Settings › AI Activity routes (step 3B): each student
// reads and deletes only their own rows, everything answers 404 with
// TANGENT_PIPELINE_V2 off, owner-only usage stays hidden from everyone else,
// and clearing the log never touches tasks, plans, projects or change_sets.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

// A stand-in request context: the db, the student and owner status come from globals.
const FAKE_CONTEXT =
  "data:text/javascript," +
  encodeURIComponent(
    "export const getRequestContext = () => globalThis.__aiaCtx;" +
      "export const requestMemo = (_k, f) => f();" +
      "export const forgetMemo = () => {};" +
      "export const trackPending = () => {};" +
      "export const currentUserIsOwner = () => !!globalThis.__aiaOwner;"
  );
// The service-role client: only the decision-write test hands one out.
const ADMIN =
  "data:text/javascript," +
  encodeURIComponent("export const createAdminClient = () => { if (!globalThis.__aiaAdmin) throw new Error('no admin client in tests'); return globalThis.__aiaAdmin; };");
// The flag as a live binding the tests can flip.
const FLAGS =
  "data:text/javascript," +
  encodeURIComponent("export let TANGENT_PIPELINE_V2 = true; globalThis.__aiaSetFlag = (v) => { TANGENT_PIPELINE_V2 = v; };");

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (specifier === "./request-context" || specifier === "../request-context") return { url: FAKE_CONTEXT, shortCircuit: true };
    if (specifier === "./supabase/admin") return { url: ADMIN, shortCircuit: true };
    if (specifier === "./flags") return { url: FLAGS, shortCircuit: true };
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        /* fall through */
      }
    }
    return next(specifier, context);
  },
});

// ─── A tiny in-memory Supabase: filters are applied, every call is recorded ──

type Row = Record<string, unknown>;
type Call = { table: string; op: "select" | "insert" | "delete" | "update"; filters: [string, string, unknown][] };

function fakeDb(tables: Record<string, Row[]>, calls: Call[]) {
  return {
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      calls.push(call);
      let limit = Infinity;
      let patch: Row = {};
      const matches = (r: Row) =>
        call.filters.every(([kind, col, v]) => {
          const x = r[col];
          if (kind === "eq") return x === v;
          if (kind === "in") return (v as unknown[]).includes(x);
          if (kind === "gte") return String(x) >= String(v);
          if (kind === "lte") return String(x) <= String(v);
          if (kind === "ilike") return String(x).toLowerCase().includes(String(v).replace(/%/g, "").toLowerCase());
          return true;
        });
      const run = () => {
        const rows = tables[table] ?? (tables[table] = []);
        if (call.op === "delete") {
          const gone = rows.filter(matches);
          tables[table] = rows.filter((r) => !matches(r));
          return { data: gone, error: null };
        }
        if (call.op === "insert") return { data: null, error: null };
        if (call.op === "update") {
          const hit = rows.filter(matches);
          for (const r of hit) Object.assign(r, patch);
          return { data: hit, error: null };
        }
        return {
          data: rows
            .filter(matches)
            .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
            .slice(0, limit),
          error: null,
        };
      };
      const q = {
        select: () => q,
        insert: (row: Row) => {
          call.op = "insert";
          (tables[table] ??= []).push(row);
          return q;
        },
        delete: () => ((call.op = "delete"), q),
        update: (p: Row) => ((call.op = "update"), (patch = p), q),
        eq: (c: string, v: unknown) => (call.filters.push(["eq", c, v]), q),
        in: (c: string, v: unknown[]) => (call.filters.push(["in", c, v]), q),
        gte: (c: string, v: unknown) => (call.filters.push(["gte", c, v]), q),
        lte: (c: string, v: unknown) => (call.filters.push(["lte", c, v]), q),
        ilike: (c: string, v: unknown) => (call.filters.push(["ilike", c, v]), q),
        order: () => q,
        limit: (n: number) => ((limit = n), q),
        range: (from: number, to: number) => ((limit = to - from + 1), q),
        maybeSingle: () => Promise.resolve({ data: run().data?.[0] ?? null, error: null }),
        single: () => Promise.resolve({ data: call.op === "insert" ? { id: "new-row" } : run().data?.[0] ?? null, error: null }),
        then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
      };
      return q;
    },
  };
}

const ME = "11111111-1111-4111-8111-111111111111";
const THEM = "22222222-2222-4222-8222-222222222222";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const recent = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();

function decision(id: string, userId: string, over: Row = {}): Row {
  return {
    id,
    user_id: userId,
    created_at: recent(10),
    updated_at: recent(10),
    source: "typed",
    request_text: "plan my SAT prep",
    route: "plan",
    intent: "new_plan",
    confidence: 0.92,
    via: "router",
    plan_match: null,
    chosen_plan_id: null,
    pending_question: null,
    change_set_id: null,
    action_id: null,
    models: ["router-model"],
    outcome: "answered",
    ...over,
  };
}

function setup(tables: Record<string, Row[]>, opts: { owner?: boolean } = {}) {
  const calls: Call[] = [];
  const g = globalThis as unknown as { __aiaCtx: unknown; __aiaOwner: boolean; __aiaSetFlag: (v: boolean) => void };
  g.__aiaCtx = { db: fakeDb(tables, calls), userId: ME };
  g.__aiaOwner = !!opts.owner;
  g.__aiaSetFlag?.(true);
  (globalThis as unknown as { __aiaAdmin: unknown }).__aiaAdmin = undefined;
  return { calls, setFlag: (v: boolean) => g.__aiaSetFlag(v) };
}

type ACT = typeof import("./activity");
type STORE = typeof import("../store");

void Promise.all([import("./activity") as Promise<ACT>, import("../store") as Promise<STORE>]).then(([
  { activityGet, activityDelete, activityClear, activityPost },
  { recordDecision, setDecisionOutcome },
]) => {
  const get = (qs = "") => activityGet(new Request(`http://t/api/ai-activity${qs}`));
  const del = (id: string) => activityDelete(new Request(`http://t/api/ai-activity/${id}`, { method: "DELETE" }));

  test("GET returns only the signed-in student's rows, and every query is scoped to them", async () => {
    const tables = { ai_decisions: [decision(uuid(1), ME), decision(uuid(2), THEM, { request_text: "their secret" })] };
    const { calls } = setup(tables);
    const res = await get("?days=90");
    assert.equal(res.status, 200);
    const body = (await res.json()) as { rows: { id: string; request: string }[]; owner: boolean };
    assert.deepEqual(body.rows.map((r) => r.id), [uuid(1)]);
    assert.ok(!JSON.stringify(body).includes("their secret"));
    for (const c of calls.filter((c) => c.op !== "insert")) {
      assert.ok(
        c.filters.some(([k, col, v]) => k === "eq" && col === "user_id" && v === ME),
        `${c.op} on ${c.table} is not scoped to the student`
      );
    }
  });

  test("DELETE of another student's row is a 404 and leaves it in place", async () => {
    const tables = { ai_decisions: [decision(uuid(1), ME), decision(uuid(2), THEM)] };
    setup(tables);
    const res = await del(uuid(2));
    assert.equal(res.status, 404);
    assert.equal(tables.ai_decisions.length, 2);
    const mine = await del(uuid(1));
    assert.equal(mine.status, 200);
    assert.deepEqual(tables.ai_decisions.map((r) => r.id), [uuid(2)]);
    assert.equal((await del("not-a-uuid")).status, 404);
  });

  test("clearing the log removes only my ai_decisions; tasks, plans, projects and change_sets stay", async () => {
    const tables: Record<string, Row[]> = {
      ai_decisions: [decision(uuid(1), ME), decision(uuid(3), ME), decision(uuid(2), THEM)],
      tasks: [{ id: uuid(10), user_id: ME }],
      plans: [{ id: uuid(11), user_id: ME }],
      projects: [{ id: uuid(12), user_id: ME }],
      change_sets: [{ id: uuid(13), user_id: ME }],
    };
    const { calls } = setup(tables);
    const res = await activityClear();
    assert.equal(res.status, 200);
    assert.equal(((await res.json()) as { removed: number }).removed, 2);
    assert.deepEqual(tables.ai_decisions.map((r) => r.id), [uuid(2)], "the other student's log is untouched");
    for (const t of ["tasks", "plans", "projects", "change_sets"]) assert.equal(tables[t].length, 1, `${t} changed`);
    const writes = calls.filter((c) => c.op === "delete" || c.op === "update");
    assert.deepEqual(Array.from(new Set(writes.map((c) => c.table))), ["ai_decisions"]);
    // The activity_cleared event is the only other write.
    assert.deepEqual(calls.filter((c) => c.op === "insert").map((c) => c.table), ["events"]);
  });

  test("with TANGENT_PIPELINE_V2 off every route is a 404 and nothing is read or deleted", async () => {
    const tables = { ai_decisions: [decision(uuid(1), ME)] };
    const { calls, setFlag } = setup(tables);
    setFlag(false);
    try {
      assert.equal((await get()).status, 404);
      assert.equal((await get("?only=action_ids")).status, 404);
      assert.equal((await del(uuid(1))).status, 404);
      assert.equal((await activityClear()).status, 404);
      const post = new Request("http://t/api/ai-activity", { method: "POST", body: JSON.stringify({ expanded: uuid(1) }) });
      assert.equal((await activityPost(post)).status, 404);
      assert.equal(tables.ai_decisions.length, 1);
      assert.equal(calls.length, 0);
    } finally {
      setFlag(true);
    }
  });

  test("owner-only usage is sent to the owner and to no one else", async () => {
    const tables = {
      ai_decisions: [decision(uuid(1), ME, { created_at: recent(5) })],
      ai_usage: [{ user_id: ME, created_at: recent(5.5), model: "router-model", input_tokens: 900, output_tokens: 120, est_cost_usd: 0.0004 }],
    };
    setup(tables);
    const student = (await (await get()).json()) as { owner: boolean; rows: { usage?: unknown }[] };
    assert.equal(student.owner, false);
    assert.equal(student.rows[0].usage, undefined);

    setup(tables, { owner: true });
    const owner = (await (await get()).json()) as { owner: boolean; rows: { usage?: { inputTokens: number; models: string[] } }[] };
    assert.equal(owner.owner, true);
    assert.equal(owner.rows[0].usage?.inputTokens, 900);
    assert.deepEqual(owner.rows[0].usage?.models, ["router-model"]);
  });

  test("a Details link finds its row by change set and opens the right page", async () => {
    const cs = uuid(50);
    const rows = Array.from({ length: 30 }, (_, i) => decision(uuid(100 + i), ME, { created_at: recent(i + 1) }));
    rows[27].change_set_id = cs;
    setup({ ai_decisions: rows });
    const body = (await (await get(`?focus=cs:${cs}`)).json()) as { page: number; focusId: string; rows: { id: string }[] };
    assert.equal(body.focusId, uuid(127));
    assert.equal(body.page, 2);
    assert.ok(body.rows.some((r) => r.id === uuid(127)));
  });

  test("only=action_ids lists the undo entries Tangent AI made, mine only", async () => {
    const a = uuid(60);
    setup({ ai_decisions: [decision(uuid(1), ME, { action_id: a }), decision(uuid(2), THEM, { action_id: uuid(61) })] });
    const body = (await (await get("?only=action_ids")).json()) as { actionIds: string[] };
    assert.deepEqual(body.actionIds, [a]);
  });

  test("a decision write that names another student is written for the session student", async () => {
    const tables: Record<string, Row[]> = { ai_decisions: [decision(uuid(2), THEM, { outcome: "asked" })] };
    setup(tables);
    const adminCalls: Call[] = [];
    (globalThis as unknown as { __aiaAdmin: unknown }).__aiaAdmin = fakeDb(tables, adminCalls);
    // As if a request body had smuggled a user id into the input.
    const input = { source: "typed", requestText: "plan my SAT prep", route: "plan", intent: "new_plan", confidence: 0.9, via: "router", outcome: "asked", user_id: THEM, userId: THEM };
    assert.equal(await recordDecision(input as unknown as Parameters<STORE["recordDecision"]>[0]), "new-row");
    const written = tables.ai_decisions[1];
    assert.equal(written.user_id, ME, "user_id comes from the session, not the input");
    assert.ok(!("userId" in written), "unknown input fields are dropped");
    // Moving the other student's row by its id finds nothing and changes nothing.
    assert.equal(await setDecisionOutcome({ id: uuid(2) }, "confirmed"), false);
    assert.equal(tables.ai_decisions[0].outcome, "asked");
    for (const c of adminCalls.filter((c) => c.op !== "insert")) {
      assert.ok(c.filters.some(([k, col, v]) => k === "eq" && col === "user_id" && v === ME), `admin ${c.op} is not scoped to the student`);
    }
    assert.deepEqual(Array.from(new Set(adminCalls.map((c) => c.table))), ["ai_decisions"]);
  });
});
