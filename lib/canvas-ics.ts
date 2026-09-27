// lib/canvas-ics.ts
//
// New Canvas integration path: a per-student Canvas Calendar Feed (.ics) URL,
// polled read-only and turned into TANGENT tasks. This is separate from the
// legacy token-based client in lib/canvas.ts (still used by the agent tool
// loop) — do not merge the two paths.

import ical from "node-ical";
import type { CalendarResponse, ParameterValue, VEvent } from "node-ical";
import { addTask, getAllTasks, updateTask } from "./store";

function textValue(value: ParameterValue<string> | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.val ?? "";
}

/** Canvas shows the feed as a webcal:// link, which is what most people copy.
 *  It is the same file over https. */
export function normalizeFeedUrl(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.replace(/^webcals?:\/\//i, "https://");
}

/** Some school networks and CDNs turn away requests that look like bots. */
const FEED_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; TangentCalendarSync/1.0)",
  Accept: "text/calendar, text/plain;q=0.9, */*;q=0.5",
};

/** The zone used when none has been reported: the one the app shows times in. */
export const DEFAULT_TIME_ZONE = "America/New_York";

export function isValidTimeZone(zone: string | undefined | null): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export type IcsValidation =
  | { ok: true; icsText: string; eventCount: number }
  | { ok: false; error: string };

/** Fetches a candidate Canvas calendar-feed URL and confirms it is a real, parseable .ics feed. */
export async function fetchAndValidateIcs(rawUrl: string): Promise<IcsValidation> {
  let url: URL;
  try {
    url = new URL(normalizeFeedUrl(rawUrl));
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "The calendar feed link must start with http:// or https://." };
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), { headers: FEED_HEADERS, redirect: "follow", cache: "no-store" });
  } catch (e) {
    console.error("[canvas-ics] fetch failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "Couldn't reach that link. Check the URL and try again." };
  }
  if (!res.ok) {
    return { ok: false, error: `That link returned an error (${res.status}). Check the URL and try again.` };
  }

  const icsText = await res.text();
  if (!icsText.includes("BEGIN:VCALENDAR")) {
    return {
      ok: false,
      error: "That link didn't return a calendar feed. Make sure you copied the Calendar Feed link from Canvas.",
    };
  }

  let parsed: CalendarResponse;
  try {
    parsed = ical.sync.parseICS(icsText);
  } catch {
    return { ok: false, error: "That calendar feed couldn't be read. Check the URL and try again." };
  }

  const eventCount = Object.values(parsed).filter((item) => item?.type === "VEVENT").length;
  return { ok: true, icsText, eventCount };
}

/** A due time as the student would read it. The server runs on UTC, so using
 *  the Date's own local fields put an 11:59 pm Eastern deadline on the next
 *  day at 3:59 am. Convert into the student's zone instead. */
export function toTaskDateTime(date: Date, timeZone: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** An all-day event (DTSTART;VALUE=DATE) has a date and no time. node-ical
 *  builds it at the server's local midnight, so its local fields are the
 *  calendar date; converting it through a zone would slide it a day back. It
 *  gets an end-of-day time, which is what a date-only due date means. */
function allDayDateTime(date: Date): { date: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, time: "23:59" };
}

function isAllDay(event: VEvent): boolean {
  const start = event.start as Date & { dateOnly?: boolean };
  return event.datetype === "date" || Boolean(start?.dateOnly);
}

export type SyncResult = { total: number; added: number; updated: number; skipped: number };

/**
 * Re-fetches the feed and ingests VEVENT entries as Canvas-sourced tasks via the normal addTask path.
 * When `sinceDate` is given, events starting before it are left out entirely (not counted in `total`) —
 * used to keep both the initial connect and later re-syncs from pulling in a student's entire semester
 * history, only what's still ahead as of when they connected.
 */
/** How far back an import reaches. Anything older than this is not actionable;
 *  anything inside it still might be. Fixed window rather than "the moment you
 *  pressed connect", which dropped work due earlier the same day and could
 *  never be recovered, because every later sync reused that same instant. */
export const IMPORT_WINDOW_DAYS = 21;

export function importCutoff(): Date {
  const d = new Date();
  d.setDate(d.getDate() - IMPORT_WINDOW_DAYS);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function syncCanvasFeed(
  icsUrl: string,
  sinceDate?: string | Date,
  /** Already-downloaded feed text. Connecting validates the feed first, so
   *  passing it here saves fetching the same file a second time — which on a big
   *  feed was most of the time the request took. */
  prefetchedIcsText?: string,
  timeZone: string = DEFAULT_TIME_ZONE
): Promise<SyncResult> {
  let icsText = prefetchedIcsText;
  if (icsText === undefined) {
    const res = await fetch(normalizeFeedUrl(icsUrl), { headers: FEED_HEADERS, redirect: "follow", cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Canvas feed returned ${res.status}`);
    }
    icsText = await res.text();
  }
  const parsed = ical.sync.parseICS(icsText);
  const cutoff = sinceDate ? new Date(sinceDate) : null;

  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  let total = 0;
  let added = 0;
  let updated = 0;
  let skipped = 0;

  // Canvas tasks already in the workspace, by the event they came from. Tasks
  // imported before UIDs were recorded have none; they are matched by title
  // below, which is also what repairs ones imported at the wrong time.
  const existing = getAllTasks().filter((t) => t.source === "canvas");
  const byUid = new Map(existing.filter((t) => t.externalId).map((t) => [t.externalId!, t]));
  const legacy = existing.filter((t) => !t.externalId);

  for (const item of Object.values(parsed)) {
    if (!item || item.type !== "VEVENT") continue;
    const event = item as VEvent;
    if (!event.start) continue;
    if (cutoff && event.start < cutoff) continue;
    total++;

    const { date, time } = isAllDay(event) ? allDayDateTime(event.start) : toTaskDateTime(event.start, zone);
    const title = textValue(event.summary).trim() || "Canvas assignment";
    const description = textValue(event.description).trim();
    const uid = event.uid ? String(event.uid) : undefined;

    // Seen before: move or rename it in place when Canvas changed it, and
    // leave the student's completion alone.
    const known = uid ? byUid.get(uid) : undefined;
    const adopted = !known ? legacy.find((t) => t.title === title) : undefined;
    const match = known ?? adopted;
    if (match) {
      if (adopted) legacy.splice(legacy.indexOf(adopted), 1);
      if (match.date !== date || match.time !== time || match.title !== title || (uid && !match.externalId)) {
        updateTask(match.id, { date, time, title, ...(uid ? { externalId: uid } : {}) });
        updated++;
      } else {
        skipped++;
      }
      continue;
    }

    const result = addTask({
      title,
      date,
      time,
      completed: false,
      kind: "school",
      source: "canvas",
      ...(uid ? { externalId: uid } : {}),
      ...(description ? { notes: description.slice(0, 500) } : {}),
      ...(event.url ? { resources: [{ label: "View in Canvas", url: String(event.url) }] } : {}),
    });

    if (result.wasDuplicate) skipped++;
    else added++;
  }

  return { total, added, updated, skipped };
}
