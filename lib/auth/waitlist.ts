// The waitlist (Round 5A, 1.5). Pure and dependency-injected: the admin client,
// the sign-in email and the owner check come in, so a test can run every path.
//
//   joinWaitlist     a signed-in account that isn't allowed in yet is added once
//   listWaitlist     the owner's page: who is waiting, who is approved, the counts
//   approveWaitlist  marks the row, flags the auth user (app_metadata.waitlist =
//                    "approved", which only the service role can write), then
//                    emails a sign-in link through Supabase's own SMTP

import { isOwnerEmail, normalizeEmail } from "./access";

export type WaitlistRow = { email: string; status: "waiting" | "approved"; created_at: string; approved_at: string | null };
export type WaitlistView = { waiting: WaitlistRow[]; approved: WaitlistRow[]; counts: { waiting: number; approved: number } };

type DbError = { code?: string; message: string } | null;
type Result<T = unknown> = PromiseLike<{ data: T; error: DbError }>;

/** The slice of the service-role client this file uses. */
export type WaitlistAdmin = {
  from(table: "waitlist"): {
    insert(row: Record<string, unknown>): PromiseLike<{ error: DbError }>;
    select(columns: string): {
      order(column: string, o: { ascending: boolean }): Result;
      eq(column: string, value: string): { maybeSingle(): Result };
    };
    update(row: Record<string, unknown>): { eq(column: string, value: string): PromiseLike<{ error: DbError }> };
  };
  auth: {
    admin: {
      getUserById(id: string): PromiseLike<{ data: { user: { user_metadata?: Record<string, unknown> } | null }; error: { message: string } | null }>;
      updateUserById(id: string, attrs: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

const missingTable = (e: NonNullable<DbError>) => e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message);
const duplicate = (e: NonNullable<DbError>) => e.code === "23505";

/** Adds an account that isn't allowed in yet. Once: a second sign-in changes
 *  nothing. Never throws, so a missing table can't break signing in. */
export async function joinWaitlist(
  admin: WaitlistAdmin,
  who: { email: string | null | undefined; userId?: string | null }
): Promise<"added" | "exists" | "unavailable"> {
  const email = normalizeEmail(who.email);
  if (!email) return "unavailable";
  try {
    const { error } = await admin.from("waitlist").insert({ email, user_id: who.userId ?? null });
    if (!error) return "added";
    if (duplicate(error)) return "exists";
    if (!missingTable(error)) console.warn("[waitlist] join failed:", error.code ?? "error");
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function listWaitlist(admin: WaitlistAdmin): Promise<WaitlistView> {
  const { data, error } = await admin.from("waitlist").select("email, status, created_at, approved_at").order("created_at", { ascending: true });
  if (error) {
    if (missingTable(error)) return { waiting: [], approved: [], counts: { waiting: 0, approved: 0 } };
    throw new Error(`waitlist list failed: ${error.code ?? "error"}`);
  }
  const rows = (data ?? []) as WaitlistRow[];
  const waiting = rows.filter((r) => r.status === "waiting");
  const approved = rows.filter((r) => r.status === "approved").reverse();
  return { waiting, approved, counts: { waiting: waiting.length, approved: approved.length } };
}

export type ApproveResult = { ok: true; emailed: boolean } | { ok: false; status: 400 | 404 | 500; error: string };

/** Approves one waiting email. `sendSignInLink` emails the sign-in link; if it
 *  fails the approval still stands (they can sign in with their address). */
export async function approveWaitlist(admin: WaitlistAdmin, rawEmail: unknown, sendSignInLink: (email: string) => Promise<boolean>): Promise<ApproveResult> {
  const email = typeof rawEmail === "string" ? normalizeEmail(rawEmail) : "";
  if (!email) return { ok: false, status: 400, error: "Which email?" };

  const found = await admin.from("waitlist").select("email, status, user_id").eq("email", email).maybeSingle();
  const row = found.data as { email: string; status: string; user_id: string | null } | null;
  if (found.error || !row) return { ok: false, status: 404, error: "That email isn't on the waitlist." };
  if (!row.user_id) return { ok: false, status: 500, error: "That row has no account behind it." };

  const meta = await admin.auth.admin.getUserById(row.user_id);
  if (meta.error || !meta.data.user) return { ok: false, status: 404, error: "That account no longer exists." };
  const userMeta = meta.data.user.user_metadata ?? {};

  // The flag the gate reads, plus a one-shot flag the Magic Link template can use
  // for a "You're in" line. user_metadata is read and written whole here, so
  // nothing depends on whether the API merges it.
  const flag = await admin.auth.admin.updateUserById(row.user_id, {
    app_metadata: { waitlist: "approved" },
    user_metadata: { ...userMeta, waitlist_approved: true },
  });
  if (flag.error) return { ok: false, status: 500, error: "Couldn't approve that account. Try again." };

  const marked = await admin.from("waitlist").update({ status: "approved", approved_at: new Date().toISOString() }).eq("email", email);
  if (marked.error) return { ok: false, status: 500, error: "Couldn't save the approval. Try again." };

  const emailed = await sendSignInLink(email).catch(() => false);
  // The "You're in" line is for this one email only.
  await admin.auth.admin.updateUserById(row.user_id, { user_metadata: userMeta }).then(undefined, () => undefined);
  return { ok: true, emailed };
}

/** What /api/waitlist does with a request. Owner only: everyone else gets 404,
 *  as if the route didn't exist. */
export async function runWaitlistAction(
  sessionEmail: string | null | undefined,
  body: unknown,
  deps: { admin: WaitlistAdmin; sendSignInLink: (email: string) => Promise<boolean> }
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!isOwnerEmail(sessionEmail)) return { status: 404, body: { ok: false, error: "Not found" } };
  const email = body && typeof body === "object" ? (body as { email?: unknown }).email : undefined;
  const result = await approveWaitlist(deps.admin, email, deps.sendSignInLink);
  if (!result.ok) return { status: result.status, body: { ok: false, error: result.error } };
  return { status: 200, body: { ok: true, emailed: result.emailed } };
}

/** Emails of approved accounts, for jobs that only know profile emails (cron). */
export async function approvedEmails(admin: WaitlistAdmin): Promise<Set<string>> {
  try {
    const view = await listWaitlist(admin);
    return new Set(view.approved.map((r) => r.email));
  } catch {
    return new Set();
  }
}
