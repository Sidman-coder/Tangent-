// lib/canvas-ics.ts
//
// Canvas integration: a per-student Canvas Calendar Feed (.ics) URL, polled
// read-only and turned into TANGENT tasks with source "canvas". The agent
// answers Canvas questions from those tasks (get_canvas_deadlines).

import ical from "node-ical";
import type { CalendarResponse, ParameterValue, VEvent } from "node-ical";
import { addTask, getAllTasks, getUserTimezone, updateTask } from "./store";
import { addDaysYMD, getUserToday } from "./time";
import { CanvasFeedError, fetchCanvasFeedText, parseCanvasFeedUrl, type FetchDeps } from "./canvas-feed-security";

function textValue(value: ParameterValue<string> | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.val ?? "";
}

export type IcsValidation =
  | { ok: true; url: string; icsText: string; eventCount: number }
  | { ok: false; error: string };

/** Parses feed text, or throws a student-friendly CanvasFeedError. */
function parseFeed(icsText: string): CalendarResponse {
  try {
    return ical.sync.parseICS(icsText);
  } catch {
    throw new CanvasFeedError("That calendar feed couldn't be read. Copy a fresh Calendar Feed link from Canvas and try again.");
  }
}

/** Fetches a candidate Canvas calendar-feed link under the rules in
 *  canvas-feed-security.ts and confirms it is a real, parseable .ics feed.
 *  `url` is the normalized link (webcal:// → https://) to store. */
export async function fetchAndValidateIcs(rawUrl: string, deps?: FetchDeps): Promise<IcsValidation> {
  try {
    const url = parseCanvasFeedUrl(rawUrl).toString();
    const icsText = await fetchCanvasFeedText(url, deps);
    const parsed = parseFeed(icsText);
    const eventCount = Object.values(parsed).filter((item) => item?.type === "VEVENT").length;
    return { ok: true, url, icsText, eventCount };
  } catch (e) {
    if (e instanceof CanvasFeedError) return { ok: false, error: e.message };
    console.error("[canvas-ics] validation failed:", e instanceof Error ? e.name : "error");
    return { ok: false, error: "Couldn't check that link. Try again in a minute." };
  }
}

/** Wall-clock date/time of an event in the student's timezone. The server
 *  runs on UTC, so using the Date's own local fields put an 11:59 pm Eastern
 *  deadline on the next day at 3:59 am. */
function toTaskDateTime(date: Date, timeZone: string): { date: string; time: string } {
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

/** How far back an import reaches, in days before the student's today.
 *  Anything older is not actionable; anything inside it still might be
 *  (overdue work the student can still turn in). */
export const IMPORT_WINDOW_DAYS = 21;

export type SyncResult = { total: number; added: number; updated: number; skipped: number };

/**
 * Fetches the feed (unless the text was just fetched by fetchAndValidateIcs) and ingests VEVENT entries as Canvas-sourced tasks via the normal addTask path.
 * Only events from the last IMPORT_WINDOW_DAYS (in the student's timezone) onward are imported
 * (earlier ones are not counted in `total`), so neither the first connect nor a re-sync pulls in a
 * semester of history. An event seen before (matched by its feed UID) is moved or renamed in place
 * instead of being added a second time, and the student's completion is left alone.
 */
export async function syncCanvasFeed(
  icsUrl: string,
  opts: { icsText?: string; deps?: FetchDeps } = {}
): Promise<SyncResult> {
  // Re-syncs go through the same checks as connecting (scheme, host, DNS, redirects, limits).
  const icsText = opts.icsText ?? (await fetchCanvasFeedText(icsUrl, opts.deps));
  const parsed = parseFeed(icsText);
  const timeZone = await getUserTimezone();
  const cutoff = addDaysYMD(getUserToday(timeZone), -IMPORT_WINDOW_DAYS);

  let total = 0;
  let added = 0;
  let updated = 0;
  let skipped = 0;

  // Canvas tasks already saved, by the event they came from. Tasks imported
  // before UIDs were recorded have none; they are matched by title below,
  // which is also what repairs ones imported at the wrong time.
  const existing = (await getAllTasks()).filter((t) => t.source === "canvas");
  const byUid = new Map(existing.filter((t) => t.externalId).map((t) => [t.externalId!, t]));
  const legacy = existing.filter((t) => !t.externalId);

  for (const item of Object.values(parsed)) {
    if (!item || item.type !== "VEVENT") continue;
    const event = item as VEvent;
    if (!event.start) continue;
    const { date, time } = isAllDay(event) ? allDayDateTime(event.start) : toTaskDateTime(event.start, timeZone);
    if (date < cutoff) continue;
    total++;

    const title = textValue(event.summary).trim() || "Canvas assignment";
    const description = textValue(event.description).trim();
    const uid = event.uid ? String(event.uid) : undefined;

    // Seen before: move or rename it in place when Canvas changed it.
    const known = uid ? byUid.get(uid) : undefined;
    const adopted = !known ? legacy.find((t) => t.title === title) : undefined;
    const match = known ?? adopted;
    if (match) {
      if (adopted) legacy.splice(legacy.indexOf(adopted), 1);
      if (match.date !== date || match.time !== time || match.title !== title || (uid && !match.externalId)) {
        await updateTask(match.id, { date, time, title, ...(uid ? { externalId: uid } : {}) });
        updated++;
      } else {
        skipped++;
      }
      continue;
    }

    const result = await addTask({
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
