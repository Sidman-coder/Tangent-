// Settings is split into pages. Old links (/settings#ai-activity,
// /settings?activity=…, /settings?reset=1#security) still have to land on the
// right page. The server never sees a #hash, so this runs in the browser.

// Your Tangent (what Tangent knows, your week, getting to know you) is the
// main page; Connectors holds everywhere Tangent learns from. They replaced
// Schedule and What Tangent knows, whose URLs still forward here.
export type SettingsPage = "your-tangent" | "connectors" | "account" | "security" | "notifications" | "activity" | "data";

export const SETTINGS_PAGES: readonly SettingsPage[] = ["your-tangent", "connectors", "account", "security", "notifications", "activity", "data"];

/** Retired pages and where their links go now. */
export const LEGACY_SETTINGS_PAGES: Record<string, SettingsPage> = {
  schedule: "your-tangent",
  context: "your-tangent",
};

const HASH_TARGETS: Record<string, SettingsPage> = {
  "ai-activity": "activity",
  activity: "activity",
  onboarding: "your-tangent",
  "what-tangent-knows": "your-tangent",
  context: "your-tangent",
  "your-tangent": "your-tangent",
  security: "security",
  connections: "connectors",
  connectors: "connectors",
  schedule: "your-tangent",
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

/** Where /settings itself lands: an old link's page, else Your Tangent on a
 *  laptop. A phone stays on the section list (null). */
export function settingsLanding(isDesktop: boolean, search: string, hash: string): string | null {
  return legacySettingsTarget(search, hash) ?? (isDesktop ? "/settings/your-tangent" : null);
}
