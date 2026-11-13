// Run with `npm test`. Round 5A, 1.3: what the store does with facts.
//   - the same fact written twice is saved once, and shown once
//   - a vague answer is not saved; the question that would fix it is queued
//   - facts said while a project was being set up move onto the project
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FAKE_CONTEXT =
  "data:text/javascript," +
  encodeURIComponent(
    "export const getRequestContext = () => globalThis.__factsCtx;" +
      "export const requestMemo = (_k, f) => f();" +
      "export const forgetMemo = () => {};" +
      "export const trackPending = (p) => { (globalThis.__factsPending ??= []).push(p); };" +
      "export const factsUsedThisRequest = () => [];" +
      "export const currentUserIsOwner = () => false;"
  );
const ADMIN = "data:text/javascript," + encodeURIComponent("export const createAdminClient = () => { throw new Error('no admin client in tests'); };");
const ROOT = path.resolve(import.meta.dirname, "..");

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (/(^|\/)request-context$/.test(specifier)) return { url: FAKE_CONTEXT, shortCircuit: true };
    if (/supabase\/admin$/.test(specifier)) return { url: ADMIN, shortCircuit: true };
    let s = specifier;
    if (s.startsWith("@/")) s = pathToFileURL(path.join(ROOT, s.slice(2))).href;
    if ((s.startsWith(".") || s.startsWith("file:")) && !/\.[cm]?[jt]s$/.test(s)) {
      try {
        return next(`${s}.ts`, context);
      } catch {
        /* fall through */
      }
    }
    return next(s, context);
  },
});

type Row = Record<string, unknown>;
type Result = { data: unknown; error: { code: string; message: string } | null };
type Call = { table: string; op: string; payload: unknown; filters: [string, unknown][] };

/** A small in-memory Supabase: just enough of select / insert / update with
 *  eq, is, gte, in, order, limit, single, to run the fact paths. */
function memoryDb(tables: Record<string, Row[]>, calls: Call[]) {
  let nextId = 1;
  return {
    from(table: string) {
      const rows = (tables[table] ??= []);
      let op = "select";
      let payload: unknown = null;
      const filters: [string, unknown][] = [];
      const matches = (r: Row) =>
        filters.every(([kind, arg]) => {
          const [col, val] = arg as [string, unknown];
          if (kind === "eq") return r[col] === val;
          if (kind === "is") return (r[col] ?? null) === val;
          if (kind === "gte") return String(r[col]) >= String(val);
          if (kind === "in") return (val as unknown[]).includes(r[col]);
          return true;
        });
      const run = (single: boolean): Result => {
        calls.push({ table, op, payload, filters: [...filters] });
        if (op === "insert") {
          const list = (Array.isArray(payload) ? payload : [payload]) as Row[];
          const made = list.map((p) => ({ id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`, created_at: new Date().toISOString(), ...p }));
          rows.push(...made);
          return { data: single ? made[0] : made, error: null };
        }
        if (op === "update") {
          const hit = rows.filter(matches);
          for (const r of hit) Object.assign(r, payload);
          return { data: hit.map((r) => ({ id: r.id })), error: null };
        }
        const hit = rows.filter(matches);
        return { data: single ? (hit[0] ?? null) : hit, error: null };
      };
      const settle = (single: boolean) => Promise.resolve().then(() => run(single));
      const withTypes = (p: Promise<Result>) => Object.assign(p, { overrideTypes: () => p });
      const q: Record<string, unknown> = {
        select: () => q,
        insert: (p: unknown) => ((op = "insert"), (payload = p), q),
        update: (p: unknown) => ((op = "update"), (payload = p), q),
        eq: (c: string, v: unknown) => (filters.push(["eq", [c, v]]), q),
        is: (c: string, v: unknown) => (filters.push(["is", [c, v]]), q),
        gte: (c: string, v: unknown) => (filters.push(["gte", [c, v]]), q),
        in: (c: string, v: unknown) => (filters.push(["in", [c, v]]), q),
        order: () => q,
        limit: () => q,
        range: (from: number, to: number) => {
          const all = rows.filter(matches);
          return Promise.resolve({ data: all.slice(from, to + 1), error: null });
        },
        maybeSingle: () => withTypes(settle(true)),
        single: () => withTypes(settle(true)),
        then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => settle(false).then(ok, bad),
      };
      return q;
    },
  };
}

const ME = "11111111-1111-4111-8111-111111111111";
const PLAN = "22222222-2222-4222-8222-222222222222";
const PROFILE = { id: ME, user_id: ME, display_name: "Sam", email: "sam@school.org", timezone: "UTC", weekly_plan: null, context_summary: "", context_interactions: 0, context_updated_at: null };

function install(tables: Record<string, Row[]> = {}) {
  const calls: Call[] = [];
  const all: Record<string, Row[]> = { profiles: [PROFILE], context_entries: [], grill_questions: [], ...tables };
  (globalThis as unknown as { __factsCtx: unknown }).__factsCtx = { db: memoryDb(all, calls), userId: ME };
  return { tables: all, calls };
}

type STORE = typeof import("./store");

void (import("./store") as Promise<STORE>).then((store) => {
  test("1.3 the same fact saved twice (worded two ways) is stored once", async () => {
    const { tables } = install();
    const first = await store.addContextEntry({ category: "commitment", fact: "You can give 4 hrs a week", source: "manual", factSource: "said" });
    const second = await store.addContextEntry({ category: "commitment", fact: "You can give 4 hours a week.", source: "manual", factSource: "said" });
    assert.ok(first && second);
    assert.equal(tables.context_entries.length, 1, "one row");
    assert.equal(second.id, first.id, "the second save confirmed the first");
  });

  test("1.3 the same fact for two different projects is kept for each", async () => {
    const { tables } = install();
    const A = "33333333-3333-4333-8333-333333333333";
    const B = "44444444-4444-4444-8444-444444444444";
    await store.addContextEntry({ category: "commitment", fact: "You can give 4 hrs a week", source: "manual", factSource: "said", projectId: A });
    await store.addContextEntry({ category: "commitment", fact: "You can give 4 hrs a week", source: "manual", factSource: "said", projectId: B });
    await store.addContextEntry({ category: "commitment", fact: "You can give 4 hrs a week", source: "manual", factSource: "said", projectId: A });
    assert.equal(tables.context_entries.length, 2);
  });

  test("1.3 rows that are already stored twice are shown once", async () => {
    install({
      context_entries: [
        { id: "a", user_id: ME, category: "commitment", fact: "You can give 4 hrs a week", display_text: "You can give 4 hrs a week", source: "manual", created_at: "2026-11-01T00:00:00Z", project_id: null },
        { id: "b", user_id: ME, category: "commitment", fact: "You can give 4 hours a week", display_text: "You can give 4 hours a week", source: "manual", created_at: "2026-11-02T00:00:00Z", project_id: null },
      ],
    });
    const ctx = await store.getUserContext();
    assert.equal(ctx.entries.length, 1);
    assert.equal(ctx.entries[0].id, "a", "the first one is kept");
  });

  test("1.3 a vague answer is not saved; its follow-up question is queued once", async () => {
    const { tables } = install();
    const saved = await store.addContextEntry({ category: "goal", fact: "Goal for SAT prep: a top result", source: "manual", factSource: "said" });
    assert.equal(saved, null, "nothing saved");
    assert.equal(tables.context_entries.length, 0);
    assert.equal(tables.grill_questions.length, 1, "one question queued");
    assert.equal(tables.grill_questions[0].question, "What would a top result look like for SAT prep: a score, a place, a rank?");
    assert.equal(tables.grill_questions[0].kind, "followup");
    assert.equal(tables.grill_questions[0].user_id, ME);
    // Saying it again doesn't queue it again.
    await store.addContextEntry({ category: "goal", fact: "Goal for SAT prep: a top result", source: "manual", factSource: "said" });
    assert.equal(tables.grill_questions.length, 1);
  });

  test("1.3 sensitive facts are still dropped, with no question queued", async () => {
    const { tables } = install();
    assert.equal(await store.addContextEntry({ category: "general", fact: "I have anxiety before tests", source: "chat" }), null);
    assert.equal(tables.context_entries.length, 0);
    assert.equal(tables.grill_questions.length, 0);
  });

  test("1.3 facts said while the project was being set up move onto it", async () => {
    const recent = new Date().toISOString();
    const { tables } = install({
      context_entries: [
        // About the project: deadline and hours, said during the flow.
        { id: "d1", user_id: ME, category: "commitment", fact: "Due by end of term", display_text: "Due by end of term", slot_key: "deadline", project_id: null, created_at: recent },
        { id: "h1", user_id: ME, category: "commitment", fact: "You can give 4 hrs a week to Science fair", display_text: "You can give 4 hrs a week to Science fair", slot_key: "hoursPerWeek", project_id: null, created_at: recent },
        // About the student: stays global.
        { id: "g1", user_id: ME, category: "habit", fact: "You like to work in the evening", display_text: "You like to work in the evening", slot_key: "preferredWorkTimes", project_id: null, created_at: recent },
        { id: "s1", user_id: ME, category: "work", fact: "You post on Instagram", display_text: "You post on Instagram", slot_key: "platform", project_id: null, created_at: recent },
        // No slot: a plain fact, never touched.
        { id: "n1", user_id: ME, category: "general", fact: "Science fair is my favourite", display_text: "Science fair is my favourite", slot_key: null, project_id: null, created_at: recent },
        // Too old to be from this flow.
        { id: "o1", user_id: ME, category: "commitment", fact: "Science fair needs to be done by June", display_text: "Science fair needs to be done by June", slot_key: "deadline", project_id: null, created_at: "2020-01-01T00:00:00Z" },
      ],
    });
    const moved = await store.attachFlowFacts(PLAN, "Science fair");
    const projectOf = (id: string) => tables.context_entries.find((r) => r.id === id)?.project_id ?? null;
    // The one that names the project moves; the title-less deadline doesn't ride along
    // when another fact names the project.
    assert.equal(moved, 1);
    assert.equal(projectOf("h1"), PLAN);
    assert.equal(projectOf("g1"), null, "a fact about how you work stays global");
    assert.equal(projectOf("s1"), null, "a student slot stays global");
    assert.equal(projectOf("n1"), null, "a fact with no slot is left alone");
    assert.equal(projectOf("o1"), null, "an old fact is left alone");
  });

  test("1.3 with no fact naming the project, the flow's recent slot facts move onto it", async () => {
    const { tables } = install({
      context_entries: [
        { id: "d1", user_id: ME, category: "commitment", fact: "Due by end of term", display_text: "Due by end of term", slot_key: "deadline", project_id: null, created_at: new Date().toISOString() },
        { id: "g1", user_id: ME, category: "habit", fact: "You can focus for about 30 minutes", display_text: "You can focus for about 30 minutes", slot_key: "focusLength", project_id: null, created_at: new Date().toISOString() },
      ],
    });
    assert.equal(await store.attachFlowFacts(PLAN, "Science fair"), 1);
    assert.equal(tables.context_entries.find((r) => r.id === "d1")?.project_id, PLAN);
    assert.equal(tables.context_entries.find((r) => r.id === "g1")?.project_id ?? null, null);
  });

  test("1.3 attaching only touches the signed-in user's rows", async () => {
    const { calls } = install({
      context_entries: [{ id: "d1", user_id: ME, category: "commitment", fact: "Due by end of term", slot_key: "deadline", project_id: null, created_at: new Date().toISOString() }],
    });
    await store.attachFlowFacts(PLAN, "Science fair");
    const writes = calls.filter((c) => c.table === "context_entries" && c.op === "update");
    assert.ok(writes.length > 0);
    for (const w of writes) assert.ok(w.filters.some(([k, a]) => k === "eq" && (a as [string, unknown])[0] === "user_id" && (a as [string, unknown])[1] === ME), "scoped to the user");
  });
});
