// Run with `npm test`. Undo that survives navigation (safety hotfix): a
// reopened chat restores each saved change's Undo with its current status,
// Recent changes lists only undoable ones, newest first, and the store only
// ever returns the signed-in student's own action records.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

// A stand-in request context the store reads its { db, userId } from.
const FAKE_CONTEXT =
  "data:text/javascript," +
  encodeURIComponent(
    "export const getRequestContext = () => globalThis.__undoTestCtx;" +
      "export const requestMemo = (_k, f) => f();" +
      "export const forgetMemo = () => {};"
  );

const NO_ADMIN =
  "data:text/javascript," + encodeURIComponent("export const createAdminClient = () => { throw new Error('no admin client in tests'); };");

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    if (specifier === "./request-context") return { url: FAKE_CONTEXT, shortCircuit: true };
    // Decision records (lib/store.ts → ai_decisions) use the service-role
    // client; here it is absent, and the store carries on without a record.
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

type UE = typeof import("./undo-events");
type TU = typeof import("../components/console/turns");
type ST = typeof import("./store");

void Promise.all([import("./undo-events") as Promise<UE>, import("../components/console/turns") as Promise<TU>]).then(([ue, tu]) => {
  const { recentUndoable, undoStatusOf, withUndoStatus, actionIdsOf, isExpiredUndoMessage } = ue;
  const { turnsFromMessages } = tu;

  const rec = (id: string, createdAt: string, over: Partial<{ undoable: boolean; undone: boolean; summary: string }> = {}) => ({
    id,
    summary: over.summary ?? `Change ${id}`,
    createdAt,
    undoable: over.undoable ?? true,
    undone: over.undone ?? false,
  });

  test("Undo survives navigation: a reopened chat restores Undo from the saved action id", () => {
    // What the chat saved: the assistant message carries the action id.
    const turns = turnsFromMessages([
      { role: "user", content: "remove the SAT tasks" },
      { role: "assistant", content: "Removed 12 SAT tasks.", actionId: "a1" },
      { role: "user", content: "add gym tomorrow" },
      { role: "assistant", content: "Added Gym.", actionId: "a2" },
      { role: "user", content: "thanks" },
      { role: "assistant", content: "Anytime." },
    ]);
    assert.deepEqual(actionIdsOf(turns), ["a1", "a2"]);

    // Re-checked on load: a1 still undoable, a2 already undone.
    const records = [rec("a1", "2026-10-11T10:00:00Z", { summary: "Removed 12 tasks" }), rec("a2", "2026-10-11T10:05:00Z", { undone: true })];
    const restored = withUndoStatus(turns, records);
    assert.equal(restored[0].undoStatus, "undoable");
    assert.equal(restored[0].actionLabel, "Removed 12 tasks");
    assert.equal(restored[1].undoStatus, "undone");
    assert.equal(restored[2].undoStatus, undefined, "no action, no Undo");
  });

  test("an action trimmed away, not undoable, or not returned shows as expired", () => {
    assert.equal(undoStatusOf("gone", []), "expired");
    assert.equal(undoStatusOf("x", [rec("x", "2026-10-11T10:00:00Z", { undoable: false })]), "expired");
    const [t] = withUndoStatus([{ actionId: "gone" } as { actionId?: string; actionLabel?: string; undoStatus?: "undoable" | "undone" | "expired" }], []);
    assert.equal(t.undoStatus, "expired");
    assert.equal(t.actionLabel, "Change applied");
    assert.ok(isExpiredUndoMessage("That action could not be found."));
    assert.ok(isExpiredUndoMessage("This action can't be undone."));
    assert.ok(!isExpiredUndoMessage("Network error"));
  });

  test("Recent changes: last 10 undoable, newest first", () => {
    const records = Array.from({ length: 14 }, (_, i) => rec(`r${i}`, `2026-10-11T10:${String(i).padStart(2, "0")}:00Z`));
    records.push(rec("undone", "2026-10-11T11:00:00Z", { undone: true }), rec("locked", "2026-10-11T11:01:00Z", { undoable: false }));
    const list = recentUndoable(records);
    assert.equal(list.length, 10);
    assert.equal(list[0].id, "r13");
    assert.equal(list[9].id, "r4");
    assert.ok(!list.some((r) => r.id === "undone" || r.id === "locked"));
  });

  /** Minimal Supabase query stand-in over one in-memory table, applying the
   *  filters the store actually sends (eq, in, order, limit). */
  function fakeDb(rows: Record<string, unknown>[]) {
    return {
      from() {
        let out = rows.slice();
        const q = {
          select: () => q,
          eq: (col: string, v: unknown) => ((out = out.filter((r) => r[col] === v)), q),
          in: (col: string, vs: unknown[]) => ((out = out.filter((r) => vs.includes(r[col]))), q),
          order: (col: string, o: { ascending: boolean }) => (
            (out = out.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (o.ascending ? 1 : -1))), q
          ),
          limit: (n: number) => ((out = out.slice(0, n)), q),
          then: (resolve: (v: { data: unknown; error: null }) => unknown) => resolve({ data: out, error: null }),
        };
        return q;
      },
    };
  }

  test("Recent changes and the reload re-check return only the student's own actions", async () => {
    const row = (id: string, user_id: string, created_at: string) => ({
      id, user_id, created_at, kind: "add_task", summary: `${user_id} ${id}`, undoable: true, undone: false, snapshot: {},
    });
    const rows = [row("mine-1", "me", "2026-10-11T10:00:00Z"), row("theirs-1", "them", "2026-10-11T10:01:00Z"), row("mine-2", "me", "2026-10-11T10:02:00Z")];
    (globalThis as { __undoTestCtx?: unknown }).__undoTestCtx = { userId: "me", email: "me@example.test", db: fakeDb(rows) };
    const store = (await import("./store")) as ST;

    const recent = await store.getRecentActions(50);
    assert.deepEqual(recent.map((a) => a.id), ["mine-2", "mine-1"]);

    // Asking for someone else's id by name still returns nothing for it.
    const byId = await store.getActionsByIds(["mine-1", "theirs-1"]);
    assert.deepEqual(byId.map((a) => a.id), ["mine-1"]);
  });
});
