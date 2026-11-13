// Run with `npm test`. Round 5A, 1.4: Delete my account.
//   - only the signed-in student is touched (id and email come from the session)
//   - a missing or wrong confirm word does nothing
//   - a failure stops before the sign-in is deleted
//   - "Delete all my data" (resetUserData) now clears step_events too
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FAKE_CONTEXT =
  "data:text/javascript," +
  encodeURIComponent(
    "export const getRequestContext = () => globalThis.__acctCtx;" +
      "export const requestMemo = (_k, f) => f();" +
      "export const forgetMemo = () => {};" +
      "export const trackPending = () => {};" +
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

const ME = { userId: "11111111-1111-4111-8111-111111111111", email: "Sam@School.org" };
const SOMEONE_ELSE = "99999999-9999-4999-8999-999999999999";

type Delete = { table: string; column: string; value: string };

function fakeAdmin(opts: { failTable?: string; failAuth?: boolean; missing?: string[] } = {}) {
  const deletes: Delete[] = [];
  const authDeletes: string[] = [];
  const admin = {
    from(table: string) {
      return {
        delete: () => ({
          eq: (column: string, value: string) => {
            deletes.push({ table, column, value });
            if (opts.missing?.includes(table)) return Promise.resolve({ error: { code: "42P01", message: `relation "public.${table}" does not exist` } });
            if (table === opts.failTable) return Promise.resolve({ error: { message: "boom" } });
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
    auth: {
      admin: {
        deleteUser: (id: string) => {
          authDeletes.push(id);
          return Promise.resolve({ error: opts.failAuth ? { message: "auth boom" } : null });
        },
      },
    },
  };
  return { admin, deletes, authDeletes };
}

void Promise.all([import("./account/delete-account"), import("./store")]).then(([acct, store]) => {
  const run = (body: unknown, f: ReturnType<typeof fakeAdmin>, resets: string[] = []) =>
    acct.runAccountDelete(body, { session: ME, resetData: async () => void resets.push(ME.userId), admin: f.admin });

  test("1.4 deleting runs the data reset, the admin-only tables, the waitlist row and the auth user, in that order", async () => {
    const f = fakeAdmin();
    const order: string[] = [];
    const res = await acct.runAccountDelete(
      { confirm: "DELETE" },
      {
        session: ME,
        resetData: async () => void order.push("reset"),
        admin: {
          from: (t: string) => ({
            delete: () => ({
              eq: (c: string, v: string) => {
                order.push(`${t}:${c}`);
                return f.admin.from(t).delete().eq(c, v);
              },
            }),
          }),
          auth: { admin: { deleteUser: (id: string) => (order.push("auth"), f.admin.auth.admin.deleteUser(id)) } },
        },
      }
    );
    assert.deepEqual(res, { status: 200, body: { ok: true } });
    assert.deepEqual(order, ["reset", "events:user_id", "ai_usage:user_id", "pen_devices:user_id", "calendars:user_id", "profiles:user_id", "waitlist:email", "auth"]);
  });

  test("1.4 only the session user is affected: every delete is keyed to their id or email", async () => {
    const f = fakeAdmin();
    await run({ confirm: "DELETE" }, f);
    assert.ok(f.deletes.length > 0);
    for (const d of f.deletes) {
      if (d.table === "waitlist") assert.deepEqual([d.column, d.value], ["email", "sam@school.org"], "lower-cased session email");
      else assert.deepEqual([d.column, d.value], ["user_id", ME.userId], d.table);
    }
    assert.deepEqual(f.authDeletes, [ME.userId]);
  });

  test("1.4 an id in the request body is ignored", async () => {
    const f = fakeAdmin();
    await run({ confirm: "DELETE", userId: SOMEONE_ELSE, id: SOMEONE_ELSE, email: "victim@x.org", user_id: SOMEONE_ELSE }, f);
    assert.deepEqual(f.authDeletes, [ME.userId]);
    assert.ok(f.deletes.every((d) => d.value !== SOMEONE_ELSE && d.value !== "victim@x.org"));
  });

  test("1.4 without the DELETE word nothing is deleted (400)", async () => {
    for (const body of [{}, null, "DELETE", { confirm: "delete" }, { confirm: "RESET" }, { confirm: true }]) {
      const f = fakeAdmin();
      const resets: string[] = [];
      const res = await run(body, f, resets);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.ok, false);
      assert.equal(f.deletes.length + f.authDeletes.length + resets.length, 0, "nothing touched");
    }
  });

  test("1.4 an admin failure stops before the sign-in is deleted and says so (500)", async () => {
    const f = fakeAdmin({ failTable: "ai_usage" });
    const res = await run({ confirm: "DELETE" }, f);
    assert.equal(res.status, 500);
    assert.equal(res.body.ok, false);
    assert.match(res.body.error ?? "", /Couldn't delete your account/);
    assert.deepEqual(f.authDeletes, [], "the account is kept so the student can retry");
  });

  test("1.4 a failed data reset stops everything else (500)", async () => {
    const f = fakeAdmin();
    const res = await acct.runAccountDelete({ confirm: "DELETE" }, { session: ME, resetData: async () => Promise.reject(new Error("reset failed")), admin: f.admin });
    assert.equal(res.status, 500);
    assert.equal(f.deletes.length + f.authDeletes.length, 0);
  });

  test("1.4 a failed auth delete is reported (500)", async () => {
    const f = fakeAdmin({ failAuth: true });
    const res = await run({ confirm: "DELETE" }, f);
    assert.equal(res.status, 500);
  });

  test("1.4 a waitlist table that doesn't exist yet is not an error", async () => {
    const f = fakeAdmin({ missing: ["waitlist"] });
    const res = await run({ confirm: "DELETE" }, f);
    assert.equal(res.status, 200);
    assert.deepEqual(f.authDeletes, [ME.userId]);
  });

  test("1.4 no session user means nothing is deleted", async () => {
    const f = fakeAdmin();
    await assert.rejects(acct.deleteAccount({ session: { userId: "", email: "" }, resetData: async () => undefined, admin: f.admin }));
    assert.equal(f.deletes.length + f.authDeletes.length, 0);
  });

  test("1.4 'Delete all my data' now clears step_events, scoped to the session user", async () => {
    const calls: { table: string; op: string; column?: string; value?: unknown }[] = [];
    const chain = (table: string) => {
      let op = "select";
      const q: Record<string, unknown> = {
        delete: () => ((op = "delete"), q),
        update: () => ((op = "update"), q),
        select: () => q,
        not: () => q,
        eq: (column: string, value: unknown) => (calls.push({ table, op, column, value }), q),
        maybeSingle: () => q,
        single: () => q,
        overrideTypes: () => q,
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(ok),
      };
      return q;
    };
    (globalThis as unknown as { __acctCtx: unknown }).__acctCtx = { db: { from: chain }, userId: ME.userId };
    await store.resetUserData();
    const stepEvents = calls.filter((c) => c.table === "step_events" && c.op === "delete");
    assert.equal(stepEvents.length, 1, "step_events is cleared");
    assert.deepEqual([stepEvents[0].column, stepEvents[0].value], ["user_id", ME.userId]);
    for (const c of calls.filter((c) => c.op === "delete")) assert.equal(c.value, ME.userId, `${c.table} is scoped to the user`);
  });
});
