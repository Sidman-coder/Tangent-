import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailAllowed, isOwnerEmail } from "@/lib/auth/access";

// Request-scoped "who is this for" context. lib/store.ts reads it on every call
// so store functions keep their signatures without taking a user id.
//
// There is deliberately NO fallback: code that touches student data outside
// withUser() or runAsUser() throws instead of silently using the service role
// or some default student.

export type RequestContext = {
  userId: string;
  email: string;
  /** Session client (RLS-enforced) for requests; service-role client for cron. */
  db: SupabaseClient;
  /** Per-request read cache (see requestMemo). Dies with the request. */
  memo?: Map<string, Promise<unknown>>;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      "No user context: student data was accessed outside withUser()/runAsUser(). Refusing to guess which student this is for."
    );
  }
  return ctx;
}

/** Runs `load` once per request for `key` and shares the result, e.g. the
 *  student's calendars, which one voice command used to read five times.
 *  Scoped to the current student's context, so it can never leak across
 *  students. A failed load is not cached. Writers call forgetMemo(key). */
export function requestMemo<T>(key: string, load: () => Promise<T>): Promise<T> {
  const ctx = getRequestContext();
  ctx.memo ??= new Map();
  const hit = ctx.memo.get(key);
  if (hit) return hit as Promise<T>;
  const p = load();
  ctx.memo.set(key, p);
  p.catch(() => ctx.memo?.delete(key));
  return p;
}

/** Drops a cached read after a write that changes it. */
export function forgetMemo(key: string): void {
  getRequestContext().memo?.delete(key);
}

/** Whether the current student may use the owner's Google (Gmail / Calendar)
 *  credentials. Everyone else gets a "coming soon" response from those tools. */
export function currentUserIsOwner(): boolean {
  return isOwnerEmail(getRequestContext().email);
}

/** Wraps a Route Handler so it runs as the signed-in, allowlisted student.
 *  Responds 401/403 itself otherwise. The middleware already enforces this;
 *  checking again here keeps each route safe on its own. */
export function withUser(
  handler: (req: Request) => Promise<Response> | Response
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
    }
    if (!isEmailAllowed(user.email)) {
      return NextResponse.json({ ok: false, error: "TANGENT is invite-only right now" }, { status: 403 });
    }
    return storage.run({ userId: user.id, email: user.email ?? "", db }, () => handler(req));
  };
}

/** Runs fn as a given student using the service-role client. For trusted
 *  server jobs only (cron), which have no session. */
export async function runAsUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const db = createAdminClient();
  const { data, error } = await db.from("profiles").select("email").eq("user_id", userId).single();
  if (error || !data) throw new Error(`runAsUser: no profile for user ${userId}`);
  return storage.run({ userId, email: data.email ?? "", db }, fn);
}
