// Run with `npm test`. Overnight 2, Phase 6 (Sid approved): Disconnect Canvas,
// "Forget everything" reaching step_events, and "Tangent noticed" → Forget.
// Every delete touches only the signed-in student's rows, and only the rows
// the student chose.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

const FAKE_CONTEXT =
  "data:text/javascript," +
  encodeURIComponent(
    "export const getRequestContext = () => globalThis.__privacyTestCtx;" +
      "export const requestMemo = (_k, f) => f();" +
      "export const forgetMemo = () => {};" +
      "export const factsUsedThisRequest = () => [];"
  );
const NO_ADMIN =
  "data:text/javascript," + encodeURIComponent("export const createAdminClient = () => { throw new Error('no admin client in tests'); };");

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (specifier === "./request-context") return { url: FAKE_CONTEXT, shortCircuit: true };
    if (specifier === "./supabase/admin") return { url: NO_ADMIN, shortCircuit: true };
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

type ST = typeof import("./store");
type OB = typeof import("./student/observations");
type Row = Record<string, unknown>;

/** Supabase stand-in over several in-memory tables. A delete really removes
 *  the matching rows, so a test can see what is left. */
function fakeDb(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const rows = (tables[table] ??= []);
      const preds: ((r: Row) => boolean)[] = [];
      let deleting = false;
      const q = {
        select: () => q,
        delete: () => ((deleting = true), q),
        eq: (col: string, v: unknown) => (preds.push((r) => r[col] === v), q),
        in: (col: string, vs: unknown[]) => (preds.push((r) => vs.includes(r[col])), q),
        then: (resolve: (v: { data: Row[]; error: null }) => unknown) => {
          const hit = rows.filter((r) => preds.every((p) => p(r)));
          if (deleting) tables[table] = rows.filter((r) => !hit.includes(r));
          return resolve({ data: hit, error: null });
        },
      };
      return q;
    },
  };
}

function useTables(tables: Record<string, Row[]>) {
  (globalThis as { __privacyTestCtx?: unknown }).__privacyTestCtx = { userId: "me", email: "me@example.test", db: fakeDb(tables) };
  return tables;
}

const task = (id: string, user_id: string, source: string) => ({ id, user_id, source });
const ev = (id: string, user_id: string, kind: string) => ({ id, user_id, kind });

void Promise.all([import("./store") as Promise<ST>, import("./student/observations") as Promise<OB>]).then(([store, ob]) => {
  test("countCanvasTasks counts only this student's Canvas items", async () => {
    useTables({
      tasks: [task("a", "me", "canvas"), task("b", "me", "canvas"), task("c", "me", "manual"), task("d", "them", "canvas")],
    });
    assert.equal(await store.countCanvasTasks(), 2);
  });

  test("Disconnect, keep the items: the feed link goes, every task stays", async () => {
    const t = useTables({
      canvas_feeds: [{ user_id: "me", ics_url: "enc:mine" }, { user_id: "them", ics_url: "enc:theirs" }],
      tasks: [task("a", "me", "canvas"), task("c", "me", "manual"), task("d", "them", "canvas")],
    });
    const out = await store.disconnectCanvas({ removeItems: false });
    assert.equal(out.removedItems, 0);
    assert.deepEqual(t.canvas_feeds.map((r) => r.user_id), ["them"], "only my feed link is deleted");
    assert.deepEqual(t.tasks.map((r) => r.id), ["a", "c", "d"], "no task is touched");
  });

  test("Disconnect, remove the items: only my Canvas items go", async () => {
    const t = useTables({
      canvas_feeds: [{ user_id: "me", ics_url: "enc:mine" }, { user_id: "them", ics_url: "enc:theirs" }],
      tasks: [task("a", "me", "canvas"), task("b", "me", "canvas"), task("c", "me", "manual"), task("d", "them", "canvas")],
    });
    const out = await store.disconnectCanvas({ removeItems: true });
    assert.equal(out.removedItems, 2);
    assert.deepEqual(t.canvas_feeds.map((r) => r.user_id), ["them"]);
    assert.deepEqual(t.tasks.map((r) => r.id), ["c", "d"], "my own tasks and theirs stay");
  });

  test("Forget everything clears all of my observed habits and none of theirs", async () => {
    const t = useTables({
      step_events: [ev("1", "me", "done"), ev("2", "me", "plan_accept"), ev("3", "me", "chat_ask"), ev("4", "them", "done")],
    });
    assert.equal(await store.forgetObservations(), 3);
    assert.deepEqual(t.step_events.map((r) => r.id), ["4"]);
  });

  test("Forget on one Tangent noticed row deletes only that row's kinds", async () => {
    const t = useTables({
      step_events: [ev("1", "me", "done"), ev("2", "me", "plan_reject"), ev("3", "me", "question_skip"), ev("4", "me", "chat_ask"), ev("5", "them", "plan_reject")],
    });
    assert.equal(await store.forgetObservations(ob.NOTICED_KINDS.planning), 2);
    assert.deepEqual(t.step_events.map((r) => r.id), ["1", "4", "5"]);
    // An empty kind list deletes nothing (never "everything").
    assert.equal(await store.forgetObservations([]), 0);
    assert.equal(t.step_events.length, 3);
  });

  // ─── What the student sees ───────────────────────────────────────────────
  const e = (kind: string, over: Partial<{ hour: number; weekday: number; minutes: number; actualMinutes: number; code: string }> = {}) =>
    ({ kind, hour: over.hour ?? null, weekday: over.weekday ?? null, minutes: over.minutes ?? null, actualMinutes: over.actualMinutes ?? null, code: over.code ?? null }) as Parameters<OB["noticedHabits"]>[0][number];

  test("Tangent noticed is empty until there is something to say", () => {
    assert.deepEqual(ob.noticedHabits([]), []);
    assert.deepEqual(ob.noticedHabits([e("done", { hour: 16 }), e("plan_accept")]), []);
  });

  test("every observed kind belongs to exactly one Tangent noticed row", () => {
    const all = [...ob.STEP_EVENT_KINDS, ...ob.BEHAVIOUR_EVENT_KINDS].sort();
    const mapped = Object.values(ob.NOTICED_KINDS).flat().sort();
    assert.deepEqual(mapped, all);
  });

  test("Tangent noticed says what the AI is told, and Forget on a row removes only it", () => {
    const steps = Array.from({ length: 8 }, (_, i) => e("done", { hour: 16, weekday: 2, minutes: 20, actualMinutes: 30 + (i % 2) }));
    const planning = [e("plan_reject"), e("plan_reject"), e("plan_edit"), e("plan_accept")];
    const asking = [e("chat_ask", { code: "stuck" }), e("chat_ask", { code: "stuck" }), e("chat_ask", { code: "stuck" })];
    const events = [...steps, ...planning, ...asking];

    const rows = ob.noticedHabits(events);
    assert.deepEqual(rows.map((r) => r.key), ["steps", "planning", "asking"]);
    // Same functions and thresholds as the context pack: a calibration line for
    // the AI means a line for the student, and the reverse.
    const aiLines = ob.calibrationLines(events).length + ob.behaviourLines(events).length;
    const shown = rows.reduce((n, r) => n + r.lines.length, 0);
    assert.equal(shown, aiLines);
    assert.match(rows[1].lines[0], /change or turn down plans/);
    assert.match(rows[2].lines[0], /getting unstuck/);

    // Forget "How you plan": its events go, the other rows are unchanged.
    const left = events.filter((x) => !ob.NOTICED_KINDS.planning.includes(x.kind));
    const after = ob.noticedHabits(left);
    assert.deepEqual(after.map((r) => r.key), ["steps", "asking"]);
    assert.deepEqual(after[0].lines, rows[0].lines);
  });
});
