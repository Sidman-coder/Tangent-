// When Tangent may nudge: chosen nudge times and quiet hours, saved on the
// profile (profiles.notification_prefs, migration 20261105050000).

export type NotificationPrefs = { nudgeTimes?: string[]; quietHours?: { start: string; end: string } };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Keeps only well-formed fields; anything else reads as "not set". */
export function parseNotificationPrefs(raw: unknown): NotificationPrefs {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const prefs: NotificationPrefs = {};
  if (Array.isArray(src.nudgeTimes)) {
    const times = src.nudgeTimes.filter((t): t is string => typeof t === "string" && HHMM.test(t));
    prefs.nudgeTimes = Array.from(new Set(times)).sort().slice(0, 6);
  }
  const q = src.quietHours as Record<string, unknown> | null | undefined;
  if (q && typeof q === "object" && typeof q.start === "string" && typeof q.end === "string" && HHMM.test(q.start) && HHMM.test(q.end) && q.start !== q.end) {
    prefs.quietHours = { start: q.start, end: q.end };
  }
  return prefs;
}

/** True when localTime (HH:MM) falls inside quiet hours. Quiet hours may run
 *  past midnight (22:00–07:00). The end minute itself is no longer quiet. */
export function inQuietHours(prefs: NotificationPrefs, localTime: string): boolean {
  const q = prefs.quietHours;
  if (!q || !HHMM.test(localTime)) return false;
  const now = minutes(localTime);
  const start = minutes(q.start);
  const end = minutes(q.end);
  return start < end ? now >= start && now < end : now >= start || now < end;
}

/** HH:MM on the wall clock in an IANA timezone. */
export function localClock(timezone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}
