// In-app notification popups (toasts). Browser-only helpers used by
// components/NotificationBell.tsx, which already polls /api/notifications —
// popups ride on that data and never fetch on their own schedule.
//
// Anti-spam rules:
//  - An id pops at most once, ever. The server claims it atomically
//    (notifications.shown_at); until that migration is applied, a
//    per-student record in localStorage stands in.
//  - At most MAX_VISIBLE_POPUPS on screen; a bigger burst collapses into a
//    single "N new notifications — view all" summary.
//  - Nothing pops while the inbox is open or with popups turned off; those
//    notifications are still claimed, so they never pop later.

import type { Notification } from "@/lib/types";

export const MAX_VISIBLE_POPUPS = 3;
export const POPUP_AUTO_DISMISS_MS = 8000;
const MAX_TRACKED_IDS = 500;

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): KeyValueStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function userKey(prefix: string, email: string): string {
  return `${prefix}:${email.trim().toLowerCase()}`;
}

/** "In-app popups" setting, per student on this browser. Default ON. */
export function getInAppPopupsEnabled(email: string, storage: KeyValueStore | null = browserStorage()): boolean {
  try {
    return storage?.getItem(userKey("tangent-inapp-popups", email)) !== "false";
  } catch {
    return true;
  }
}

export function setInAppPopupsEnabled(email: string, enabled: boolean, storage: KeyValueStore | null = browserStorage()): void {
  try {
    storage?.setItem(userKey("tangent-inapp-popups", email), String(enabled));
  } catch {}
}

/** Fallback "already popped" record, namespaced by student. Returns the ids
 *  not seen before on this browser and records them. */
export function claimLocally(email: string, ids: string[], storage: KeyValueStore | null = browserStorage()): string[] {
  if (!storage) return [];
  const key = userKey("tangent-popups-shown", email);
  let seen: string[] = [];
  try {
    seen = JSON.parse(storage.getItem(key) ?? "[]") as string[];
  } catch {}
  const known = new Set(seen);
  const fresh = ids.filter((id) => !known.has(id));
  if (fresh.length > 0) {
    const next = [...seen, ...fresh];
    try {
      storage.setItem(key, JSON.stringify(next.slice(-MAX_TRACKED_IDS)));
    } catch {}
  }
  return fresh;
}

/** Notifications that could still pop: live and unread. */
export function popupCandidates(list: Notification[]): Notification[] {
  return list.filter((n) => !n.read && !n.dismissed);
}

export type ClaimPost = (ids: string[]) => Promise<{ claimed: string[] | null }>;

/** Asks the server which ids have never popped (and marks them shown);
 *  falls back to the browser's per-student record if the server can't say. */
export async function claimPopups(ids: string[], email: string, post: ClaimPost, storage: KeyValueStore | null = browserStorage()): Promise<string[]> {
  if (ids.length === 0) return [];
  const { claimed } = await post(ids);
  return claimed ?? claimLocally(email, ids, storage);
}

export type Toast =
  | { kind: "notification"; key: string; notification: Notification }
  | { kind: "summary"; key: string; count: number };

/** Adds newly claimed notifications to what's on screen, keeping at most
 *  `max` toasts: a bigger stack becomes one summary counting all of them. */
export function planToasts(current: Toast[], incoming: Notification[], max = MAX_VISIBLE_POPUPS): Toast[] {
  if (incoming.length === 0) return current;
  const summary = current.find((t): t is Extract<Toast, { kind: "summary" }> => t.kind === "summary");
  const singles = current.filter((t) => t.kind === "notification");
  const added: Toast[] = incoming.map((n) => ({ kind: "notification", key: n.id, notification: n }));
  const stack = [...singles, ...added];
  if (!summary && stack.length <= max) return stack;
  return [{ kind: "summary", key: `summary-${incoming[0].id}`, count: (summary?.count ?? 0) + stack.length }];
}
