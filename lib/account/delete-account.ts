// Delete my account (Round 5A, 1.4). Pure and dependency-injected so a test can
// prove that only the signed-in student is touched: the user id and email come
// from the session, never from the request body.
//
// Order: the student's data through the session client (RLS-enforced, the same
// path as "Delete all my data") → what only the service role may delete → the
// waitlist row → the auth user. A failure stops the run before the next step, so
// the account is never removed while data is still left behind; running it
// again is safe (every delete is idempotent).

export const DELETE_WORD = "DELETE";

/** Tables only the service role can delete from (no delete policy for the
 *  student). Every one is filtered by user_id. profiles and calendars go last:
 *  they are what the app reads to know who this is. */
export const ADMIN_TABLES_BY_USER = ["events", "ai_usage", "pen_devices", "calendars", "profiles"] as const;

type DbError = { code?: string; message: string } | null;
type Deleter = { delete(): { eq(column: string, value: string): PromiseLike<{ error: DbError }> } };

export type AdminClient = {
  from(table: string): Deleter;
  auth: { admin: { deleteUser(id: string): PromiseLike<{ error: { message: string } | null }> } };
};

export type DeleteAccountDeps = {
  session: { userId: string; email: string };
  /** resetUserData: every table the student owns, through the session client. */
  resetData: () => Promise<void>;
  admin: AdminClient;
};

export type DeleteAccountResult = { status: 200 | 400 | 500; body: { ok: boolean; error?: string } };

/** A table that isn't there yet (migration not run) is nothing to delete. */
const isMissingTable = (e: NonNullable<DbError>) => e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message);

export async function deleteAccount({ session, resetData, admin }: DeleteAccountDeps): Promise<void> {
  const { userId, email } = session;
  if (!userId) throw new Error("deleteAccount: no signed-in student");
  await resetData();
  for (const table of ADMIN_TABLES_BY_USER) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error && !isMissingTable(error)) throw new Error(`deleteAccount ${table}: ${error.message}`);
  }
  if (email) {
    const { error } = await admin.from("waitlist").delete().eq("email", email.trim().toLowerCase());
    if (error && !isMissingTable(error)) throw new Error(`deleteAccount waitlist: ${error.message}`);
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`deleteAccount auth user: ${error.message}`);
}

/** The route's whole job. `body` is whatever the client sent: only `confirm`
 *  is read, so an `id` or `userId` in it changes nothing. */
export async function runAccountDelete(body: unknown, deps: DeleteAccountDeps): Promise<DeleteAccountResult> {
  const confirm = body && typeof body === "object" ? (body as { confirm?: unknown }).confirm : undefined;
  if (confirm !== DELETE_WORD) return { status: 400, body: { ok: false, error: "Type DELETE to confirm." } };
  try {
    await deleteAccount(deps);
    return { status: 200, body: { ok: true } };
  } catch (e) {
    console.error("[api/account/delete] error:", e instanceof Error ? e.message : e);
    return { status: 500, body: { ok: false, error: "Couldn't delete your account. Nothing about your sign-in changed. Try again." } };
  }
}
