// Run with `npm test`. "Last opened" for projects and Tangents, so the
// sidebar lists the ones a student actually uses. The column ships in
// supabase/migrations/20261114020000_last_opened.sql; until Sid runs it, opening
// still works and the lists fall back to newest-created.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FAKE_CONTEXT =
  "data:text/javascript," +
  encodeURIComponent(
    "export const getRequestContext = () => globalThis.__openCtx;" +
      "export const requestMemo = (_k, f) => f();" +
      "export const forgetMemo = () => {};" +
      "export const trackPending = (p) => { (globalThis.__openPending ??= []).push(p); };" +
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
  (globalThis as unknown as { __openCtx: unknown }).__openCtx = { db: fakeDb(handler, log), userId: ME };
  return log;
}

type STORE = typeof import("./store");

const PLAN = "22222222-2222-4222-8222-222222222222";
const PATH = "33333333-3333-4333-8333-333333333333";
const pathRow = { id: PATH, title: "Georgia Tech", kind: "college", target: "", current: "", deadline: null, hours_per_week: null, constraints: null, standing: null, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" };

void (import("./store") as Promise<STORE>).then((store) => {
  test("opening a project or a Tangent stamps last_opened_at on its row", async () => {
    const writes: { table: string; payload: unknown }[] = [];
    install((table, op, payload) => {
      if (op === "update") writes.push({ table, payload });
      return { data: [{ id: table === "plans" ? PLAN : PATH }], error: null };
    });
    assert.equal(await store.markOpened("project", PLAN), true);
    assert.equal(await store.markOpened("tangent", PATH), true);
    assert.deepEqual(writes.map((w) => w.table), ["plans", "paths"]);
    for (const w of writes) {
      const at = (w.payload as { last_opened_at?: string }).last_opened_at;
      assert.ok(at && !Number.isNaN(Date.parse(at)), "a real timestamp");
      assert.deepEqual(Object.keys(w.payload as object), ["last_opened_at"], "nothing else changes");
    }
  });

  test("before the migration, opening is a quiet no-op", async () => {
    install((_table, op) => (op === "update" ? { data: null, error: missing("last_opened_at") } : { data: [], error: null }));
    assert.equal(await store.markOpened("project", PLAN), false);
  });

  test("an id that isn't a uuid never reaches the database", async () => {
    const log = install(() => ({ data: [], error: null }));
    assert.equal(await store.markOpened("project", "school"), false);
    assert.equal(log.length, 0);
  });

  test("the Tangents list carries lastOpenedAt, and still loads before the migration", async () => {
    install((table, _op, _p, columns) => {
      if (table === "paths") return { data: [{ ...pathRow, ...(columns.includes("last_opened_at") ? { last_opened_at: "2026-11-14T09:00:00Z" } : {}) }], error: null };
      return { data: [], error: null };
    });
    const withColumn = await store.getPathSpace();
    assert.equal(withColumn.paths[0].lastOpenedAt, "2026-11-14T09:00:00.000Z");

    const log = install((table, _op, _p, columns) => {
      if (table === "paths") return columns.includes("last_opened_at") ? { data: null, error: missing("last_opened_at") } : { data: [pathRow], error: null };
      return { data: [], error: null };
    });
    const without = await store.getPathSpace();
    assert.equal(without.paths.length, 1, "the list still loads");
    assert.equal(without.paths[0].lastOpenedAt, undefined);
    const reads = log.filter((c) => c.table === "paths" && c.op === "select");
    assert.ok(reads.some((c) => !c.columns.includes("last_opened_at")), "retried without the column");
  });

  test("projects carry lastOpenedAt when the row has it", async () => {
    const plan = { id: PLAN, title: "Robotics", description: "", task_ids: [], task_count: 0, color: "teal", created_at: "2026-11-01T00:00:00Z" };
    install((table) => (table === "plans" ? { data: [{ ...plan, last_opened_at: "2026-11-14T10:00:00Z" }, { ...plan, id: "p2" }], error: null } : { data: [], error: null }));
    const plans = await store.getAllPlans();
    assert.equal(plans[0].lastOpenedAt, "2026-11-14T10:00:00.000Z");
    assert.equal(plans[1].lastOpenedAt, undefined);
  });
});
