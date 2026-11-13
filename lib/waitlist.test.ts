// Run with `npm test`. Round 5A, 1.5: the waitlist.
//   - joining twice leaves one row
//   - a missing table never breaks sign-in
//   - the list shows counts for waiting and approved
//   - only the owner can approve (everyone else gets 404, nothing is touched)
//   - approving flags the account, marks the row and emails the sign-in link
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
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

process.env.OWNER_EMAIL = "owner@school.org";
const UID = "22222222-2222-4222-8222-222222222222";

type Row = { email: string; user_id: string | null; status: "waiting" | "approved"; created_at: string; approved_at: string | null };

function fakeAdmin(opts: { missing?: boolean; authFails?: boolean } = {}) {
  const rows: Row[] = [];
  const authCalls: { id: string; attrs: Record<string, unknown> }[] = [];
  const missing = { code: "42P01", message: 'relation "public.waitlist" does not exist' };
  const admin = {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        if (opts.missing) return { error: missing };
        if (rows.some((r) => r.email === row.email)) return { error: { code: "23505", message: "duplicate key" } };
        rows.push({ email: row.email as string, user_id: (row.user_id as string | null) ?? null, status: "waiting", created_at: `2026-11-1${rows.length}T10:00:00Z`, approved_at: null });
        return { error: null };
      },
      select: () => ({
        order: async () => (opts.missing ? { data: null, error: missing } : { data: [...rows], error: null }),
        eq: (_c: string, v: string) => ({ maybeSingle: async () => ({ data: rows.find((r) => r.email === v) ?? null, error: null }) }),
      }),
      update: (patch: Partial<Row>) => ({
        eq: async (_c: string, v: string) => {
          Object.assign(rows.find((r) => r.email === v) ?? {}, patch);
          return { error: null };
        },
      }),
    }),
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: { user_metadata: { name: "Pat" } } }, error: null }),
        updateUserById: async (id: string, attrs: Record<string, unknown>) => {
          authCalls.push({ id, attrs });
          return { error: opts.authFails ? { message: "boom" } : null };
        },
      },
    },
  };
  return { admin, rows, authCalls };
}

void import("./auth/waitlist").then((w) => {
  test("1.5 joining the waitlist twice leaves one row", async () => {
    const f = fakeAdmin();
    assert.equal(await w.joinWaitlist(f.admin, { email: "  New@Else.COM ", userId: UID }), "added");
    assert.equal(await w.joinWaitlist(f.admin, { email: "new@else.com", userId: UID }), "exists");
    assert.equal(f.rows.length, 1);
    assert.equal(f.rows[0].email, "new@else.com", "stored lower-cased");
    assert.equal(f.rows[0].status, "waiting");
  });

  test("1.5 a missing waitlist table is not an error: sign-in goes on", async () => {
    const f = fakeAdmin({ missing: true });
    assert.equal(await w.joinWaitlist(f.admin, { email: "a@b.co", userId: UID }), "unavailable");
    assert.equal(await w.joinWaitlist(f.admin, { email: "", userId: UID }), "unavailable");
    assert.deepEqual((await w.listWaitlist(f.admin)).counts, { waiting: 0, approved: 0 });
  });

  test("1.5 the owner's list has waiting and approved counts", async () => {
    const f = fakeAdmin();
    for (const e of ["a@x.co", "b@x.co", "c@x.co"]) await w.joinWaitlist(f.admin, { email: e, userId: UID });
    f.rows[0].status = "approved";
    f.rows[0].approved_at = "2026-11-13T09:00:00Z";
    const view = await w.listWaitlist(f.admin);
    assert.deepEqual(view.counts, { waiting: 2, approved: 1 });
    assert.deepEqual(view.waiting.map((r) => r.email), ["b@x.co", "c@x.co"]);
  });

  test("1.5 approving flags app_metadata, marks the row and sends the sign-in link", async () => {
    const f = fakeAdmin();
    await w.joinWaitlist(f.admin, { email: "new@else.com", userId: UID });
    const sent: string[] = [];
    const res = await w.runWaitlistAction("Owner@School.org", { email: "New@Else.com" }, { admin: f.admin, sendSignInLink: async (e) => (sent.push(e), true) });
    assert.deepEqual(res, { status: 200, body: { ok: true, emailed: true } });
    assert.deepEqual(sent, ["new@else.com"]);
    assert.equal(f.rows[0].status, "approved");
    assert.ok(f.rows[0].approved_at);
    const flag = f.authCalls[0];
    assert.equal(flag.id, UID);
    assert.deepEqual(flag.attrs.app_metadata, { waitlist: "approved" });
    assert.deepEqual(flag.attrs.user_metadata, { name: "Pat", waitlist_approved: true }, "existing user_metadata kept, flag added");
    assert.deepEqual(f.authCalls[f.authCalls.length - 1].attrs.user_metadata, { name: "Pat" }, "the one-shot flag is cleared after the email");
  });

  test("1.5 an email that fails to send still leaves them approved", async () => {
    const f = fakeAdmin();
    await w.joinWaitlist(f.admin, { email: "new@else.com", userId: UID });
    const res = await w.runWaitlistAction("owner@school.org", { email: "new@else.com" }, { admin: f.admin, sendSignInLink: async () => false });
    assert.deepEqual(res, { status: 200, body: { ok: true, emailed: false } });
    assert.equal(f.rows[0].status, "approved");
  });

  test("1.5 only the owner can approve: anyone else gets 404 and nothing changes", async () => {
    for (const who of ["new@else.com", "sam@school.org", "", null, undefined]) {
      const f = fakeAdmin();
      await w.joinWaitlist(f.admin, { email: "new@else.com", userId: UID });
      let sent = 0;
      const res = await w.runWaitlistAction(who, { email: "new@else.com" }, { admin: f.admin, sendSignInLink: async () => (sent++, true) });
      assert.equal(res.status, 404, String(who));
      assert.equal(f.rows[0].status, "waiting");
      assert.equal(f.authCalls.length + sent, 0);
    }
  });

  test("1.5 approving an unknown email, or a failed flag, changes nothing", async () => {
    const f = fakeAdmin();
    const none = await w.runWaitlistAction("owner@school.org", { email: "ghost@x.co" }, { admin: f.admin, sendSignInLink: async () => true });
    assert.equal(none.status, 404);
    const bad = await w.runWaitlistAction("owner@school.org", {}, { admin: f.admin, sendSignInLink: async () => true });
    assert.equal(bad.status, 400);

    const g = fakeAdmin({ authFails: true });
    await w.joinWaitlist(g.admin, { email: "new@else.com", userId: UID });
    const res = await w.runWaitlistAction("owner@school.org", { email: "new@else.com" }, { admin: g.admin, sendSignInLink: async () => true });
    assert.equal(res.status, 500);
    assert.equal(g.rows[0].status, "waiting", "not marked approved when the account flag failed");
  });

  test("1.5 approvedEmails lists only approved rows", async () => {
    const f = fakeAdmin();
    for (const e of ["a@x.co", "b@x.co"]) await w.joinWaitlist(f.admin, { email: e, userId: UID });
    f.rows[1].status = "approved";
    f.rows[1].approved_at = "2026-11-13T09:00:00Z";
    assert.deepEqual(Array.from(await w.approvedEmails(f.admin)), ["b@x.co"]);
  });
});
