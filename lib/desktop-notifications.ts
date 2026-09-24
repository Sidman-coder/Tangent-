// Foreground-only OS desktop notifications for the notification bell.
//
// Scope is deliberate: this only ever fires from inside a running tab, in
// response to data components/NotificationBell.tsx already fetched on its
// existing 60s poll (app/api/notifications). There is no Service Worker, no
// Web Push, and no background delivery — closing every Tangent tab means
// nothing can fire again until a tab is reopened and polls. That is a
// feature, not a gap: it makes the mechanism impossible to "run away."
//
// Everything here is browser-only (localStorage + the Notification API) and
// must only be imported from "use client" components.

import type { Notification as TangentNotification } from "@/lib/types";

const SETTING_KEY = "tangent-desktop-notifs-enabled";
const PROMPTED_KEY = "tangent-desktop-notifs-prompted";
const SHOWN_IDS_KEY = "tangent-desktop-notifs-shown-ids";
const MAX_TRACKED_IDS = 500;

// When several new notifications arrive in one poll, this decides which one
// becomes the headline of the single collapsed OS notification.
const TYPE_PRIORITY: TangentNotification["type"][] = [
  "overdue_task",
  "reschedule_offer",
  "upcoming_deadline",
  "proactive_suggestion",
  "daily_brief",
];

export function isDesktopNotifSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getDesktopNotifPermission(): NotificationPermission | null {
  if (!isDesktopNotifSupported()) return null;
  return Notification.permission;
}

export function getDesktopNotifSetting(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SETTING_KEY) === "true";
}

export function setDesktopNotifSetting(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTING_KEY, String(enabled));
}

export function hasPromptedForDesktopNotifs(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(PROMPTED_KEY) === "true";
}

export function markPromptedForDesktopNotifs(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROMPTED_KEY, "true");
}

function getShownIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SHOWN_IDS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveShownIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  const arr = Array.from(ids);
  const trimmed = arr.length > MAX_TRACKED_IDS ? arr.slice(arr.length - MAX_TRACKED_IDS) : arr;
  try {
    localStorage.setItem(SHOWN_IDS_KEY, JSON.stringify(trimmed));
  } catch {}
}

/** True only when the student opted in AND the browser permission is actually granted. */
export function canFireDesktopNotifications(): boolean {
  return isDesktopNotifSupported() && Notification.permission === "granted" && getDesktopNotifSetting();
}

/**
 * Requests native notification permission. Only call this from a direct user
 * gesture (a button click) — browsers ignore or auto-reject calls otherwise.
 * On grant, also turns the in-app setting on so the feature is immediately live.
 * Always marks the student as "prompted" so callers never re-show their own
 * explanation after this resolves, regardless of the outcome.
 */
export async function requestDesktopNotifPermission(): Promise<NotificationPermission> {
  if (!isDesktopNotifSupported()) return "denied";
  const result = await Notification.requestPermission();
  if (result === "granted") setDesktopNotifSetting(true);
  markPromptedForDesktopNotifs();
  return result;
}

/**
 * Given the full notification list from the bell's existing poll, fires at
 * most one native OS notification for whatever is new since the last poll.
 *
 * Anti-spam guarantees:
 *  - Each notification id can only ever cause one native notification, ever —
 *    shown ids persist in localStorage across refreshes and tab reopens.
 *  - A burst of many new items never becomes a burst of native notifications:
 *    they collapse into a single "<headline> +N more" notification, and the
 *    shared `tag` also makes the OS itself replace rather than stack any that
 *    slip through in the same instant.
 *
 * No-op if the feature is off, unsupported, or nothing is new — this makes no
 * network calls of its own, it only reads what the caller already fetched.
 */
export function notifyNewDesktopNotifications(current: TangentNotification[]): void {
  if (!canFireDesktopNotifications()) return;
  const shown = getShownIds();
  const unseen = current.filter((n) => !shown.has(n.id));
  if (unseen.length === 0) return;

  const sorted = [...unseen].sort(
    (a, b) => TYPE_PRIORITY.indexOf(a.type) - TYPE_PRIORITY.indexOf(b.type)
  );
  const primary = sorted[0];
  const extra = sorted.length - 1;

  try {
    const native = new Notification(primary.title, {
      body: extra > 0 ? `${primary.body}\n+${extra} more update${extra === 1 ? "" : "s"}` : primary.body,
      tag: "tangent-notification",
    });
    native.onclick = () => {
      window.focus();
      native.close();
    };
  } catch {
    // Permission can theoretically change between the canFire check and here — ignore.
  }

  unseen.forEach((n) => shown.add(n.id));
  saveShownIds(shown);
}
