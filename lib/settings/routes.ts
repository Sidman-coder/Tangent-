// Settings is split into pages. Old links (/settings#ai-activity,
// /settings?activity=…, /settings?reset=1#security) still have to land on the
// right page. The server never sees a #hash, so this runs in the browser.

export type SettingsPage = "account" | "security" | "schedule" | "notifications" | "context" | "activity" | "data";

export const SETTINGS_PAGES: readonly SettingsPage[] = ["account", "security", "schedule", "notifications", "context", "activity", "data"];

const HASH_TARGETS: Record<string, SettingsPage> = {
  "ai-activity": "activity",
  activity: "activity",
  onboarding: "context",
  "what-tangent-knows": "context",
  context: "context",
  security: "security",
  connections: "schedule",
  schedule: "schedule",
  notifications: "notifications",
  "your-data": "data",
  data: "data",
  account: "account",
};

/** Where an old single-page Settings link goes now, or null if it isn't one. */
export function legacySettingsTarget(search: string, hash: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const activity = params.get("activity");
  if (activity) return `/settings/activity?activity=${encodeURIComponent(activity)}`;
  if (params.get("reset") === "1") return "/settings/security?reset=1";
  const key = hash.replace(/^#/, "").trim();
  const page = key ? HASH_TARGETS[key] : undefined;
  return page ? `/settings/${page}` : null;
}

/** Where /settings itself lands: an old link's page, else Account on a
 *  laptop. A phone stays on the section list (null). */
export function settingsLanding(isDesktop: boolean, search: string, hash: string): string | null {
  return legacySettingsTarget(search, hash) ?? (isDesktop ? "/settings/account" : null);
}
