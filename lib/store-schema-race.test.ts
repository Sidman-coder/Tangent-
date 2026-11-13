// Run with `npm test`. Round 5A, 1.2: the missing-column fallback holds up when
// two requests hit the same missing column at the same moment. The first one to
// fail remembers the column is missing; the second one used to see that memory,
// decide "not my problem", and throw. Both must retry and succeed.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FAKE_CONTEXT =
  "data:text/javascript," +
  encodeURIComponent(
    "export const getRequestContext = () => globalThis.__raceCtx;" +
      "export const requestMemo = (_k, f) => f();" +
      "export const forgetMemo = () => {};" +
      "export const trackPending = (p) => { (globalThis.__racePending ??= []).push(p); };" +
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

type DbError = { code: string; message: string };
type Result = { data: unknown; error: DbError | null };
type Handler = (table: string, op: string, payload: unknown, columns: string) => Result;

// supabase-js lets you chain .overrideTypes() onto a single-row query.
const withTypes = (p: Promise<Result>) => Object.assign(p, { overrideTypes: () => p });

/** A Supabase stand-in whose answers are decided per call. Every answer arrives
 *  a few ticks late, so two parallel requests are both in flight before either
 *  one sees its error. */
function fakeDb(handler: Handler, log: { table: string; op: string; columns: string }[]) {
  return {
    from(table: string) {
      let op = "select";
      let columns = "";
      let payload: unknown = null;
      const settle = (single: boolean): Promise<Result> =>
        new Promise((resolve) =>
          setTimeout(() => {
            log.push({ table, op, columns });
            const r = handler(table, op, payload, columns);
            if (single && Array.isArray(r.data)) resolve({ ...r, data: r.data[0] ?? null });
            else resolve(r);
          }, 5)
        );
      const q: Record<string, unknown> = {
        select: (c?: string) => {
          if (typeof c === "string") columns = c;
          return q;
        },
        insert: (p: unknown) => ((op = "insert"), (payload = p), q),
        update: (p: unknown) => ((op = "update"), (payload = p), q),
        delete: () => ((op = "delete"), q),
        eq: () => q,
        is: () => q,
        in: () => q,
        gte: () => q,
        lte: () => q,
        or: () => q,
        order: () => q,
        limit: () => q,
        range: () => q,
        maybeSingle: () => withTypes(settle(true)),
        single: () => withTypes(settle(true)),
        then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => settle(false).then(ok, bad),
      };
      return q;
    },
  };
}

const ME = "11111111-1111-4111-8111-111111111111";
const missing = (column: string): DbError => ({ code: "42703", message: `column "${column}" does not exist` });
const PROFILE = { display_name: "Sam", email: "sam@school.org", timezone: "UTC", weekly_plan: null, context_summary: "", context_interactions: 0, context_updated_at: null };

function install(handler: Handler) {
  const log: { table: string; op: string; columns: string }[] = [];
  (globalThis as unknown as { __raceCtx: unknown }).__raceCtx = { db: fakeDb(handler, log), userId: ME };
  return log;
}

type STORE = typeof import("./store");
type EVENTS = typeof import("./student/step-events");

void Promise.all([import("./store") as Promise<STORE>, import("./student/step-events") as Promise<EVENTS>]).then(([store, events]) => {
  test("two parallel context reads on a database without the fact columns both succeed", async () => {
    const log = install((table, _op, _p, columns) => {
      if (table === "profiles") return { data: PROFILE, error: null };
      if (table === "context_entries") {
        if (columns.includes("fact_category")) return { data: null, error: missing("fact_category") };
        return { data: [{ id: "a", category: "work", fact: "You have a chem test", source: "chat", created_at: "2026-11-01T00:00:00Z" }], error: null };
      }
      return { data: [], error: null };
    });
    const [one, two] = await Promise.all([store.getUserContext(), store.getUserContext()]);
    assert.equal(one.entries.length, 1, "first read");
    assert.equal(two.entries.length, 1, "second read");
    // Both asked for the new columns, both got the error, both retried without them.
    const reads = log.filter((c) => c.table === "context_entries" && c.op === "select");
    assert.equal(reads.filter((c) => c.columns.includes("fact_category")).length, 2, "both tried the full columns");
    assert.equal(reads.filter((c) => !c.columns.includes("fact_category")).length, 2, "both retried with the base columns");
    // A read after that doesn't even try the missing columns.
    const three = await store.getUserContext();
    assert.equal(three.entries.length, 1, "third read");
    const last = log.filter((c) => c.table === "context_entries" && c.op === "select").at(-1);
    assert.ok(last && !last.columns.includes("fact_category"), "remembered as missing");
  });

  test("two parallel task reads on a database without completed_at both succeed", async () => {
    const taskRow = { id: "t1", title: "Read ch. 4", date: "2026-11-14", time: "16:00", completed: false, kind: null, plan_id: null, notes: null, recurring: null, resources: null, start_action: null, source: null, external_id: null, path_node_id: null };
    const log = install((table, _op, _p, columns) => {
      if (table !== "tasks") return { data: [], error: null };
      if (columns.includes("completed_at")) return { data: null, error: missing("completed_at") };
      return { data: [taskRow], error: null };
    });
    const [one, two] = await Promise.all([store.getAllTasks(), store.getAllTasks()]);
    assert.equal(one.length, 1, "first read");
    assert.equal(two.length, 1, "second read");
    const reads = log.filter((c) => c.table === "tasks" && c.op === "select");
    assert.equal(reads.filter((c) => c.columns.includes("completed_at")).length, 2, "both tried the full columns");
    assert.equal(reads.filter((c) => !c.columns.includes("completed_at")).length, 2, "both retried without completed_at");
  });

  test("a real error is not swallowed by the fallback", async () => {
    install((table) => (table === "tasks" ? { data: null, error: { code: "XX000", message: "boom" } } : { data: [], error: null }));
    await assert.rejects(() => store.getAllTasks(), /boom/);
  });

  test("two parallel step-event writes on the old kind check both keep their step rows", async () => {
    const kept: string[][] = [];
    install((table, op, payload) => {
      if (table === "profiles") return { data: PROFILE, error: null };
      if (table === "step_events" && op === "insert") {
        const kinds = (payload as { kind: string }[]).map((r) => r.kind);
        // The old check constraint refuses the behaviour kinds.
        if (kinds.includes("chat_ask")) return { data: null, error: { code: "23514", message: "violates check constraint" } };
        kept.push(kinds);
        return { data: null, error: null };
      }
      return { data: [], error: null };
    });
    const g = globalThis as unknown as { __racePending?: Promise<void>[] };
    g.__racePending = [];
    events.logStepEvents([{ kind: "created" }, { kind: "chat_ask" }]);
    events.logStepEvents([{ kind: "done" }, { kind: "chat_ask" }]);
    await Promise.all(g.__racePending);
    assert.deepEqual(kept.map((k) => k.join()).sort(), ["created", "done"], "each request's step row was saved after the fallback");
  });
});
