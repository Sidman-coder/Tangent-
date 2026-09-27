// lib/canvas-ics.ts
//
// Canvas integration: a per-student Canvas Calendar Feed (.ics) URL, polled
// read-only and turned into TANGENT tasks with source "canvas". The agent
// answers Canvas questions from those tasks (get_canvas_deadlines).

import ical from "node-ical";
import type { CalendarResponse, ParameterValue, VEvent } from "node-ical";
import { addTask, getUserTimezone } from "./store";
import { getUserToday } from "./time";
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

/** Wall-clock date/time of an event in the student's timezone. All-day events
 *  (node-ical marks them dateOnly, at server-local midnight) keep their date. */
function toTaskDateTime(date: Date & { dateOnly?: boolean }, timeZone: string): { date: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (date.dateOnly) {
    return { date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, time: "00:00" };
  }
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

export type SyncResult = { total: number; added: number; skipped: number };

/**
 * Fetches the feed (unless the text was just fetched by fetchAndValidateIcs) and ingests VEVENT entries as Canvas-sourced tasks via the normal addTask path.
 * Only events on or after the student's local today are imported (earlier ones are not counted in
 * `total`), so neither the first connect nor a re-sync pulls in a semester of history.
 */
export async function syncCanvasFeed(
  icsUrl: string,
  opts: { icsText?: string; deps?: FetchDeps } = {}
): Promise<SyncResult> {
  // Re-syncs go through the same checks as connecting (scheme, host, DNS, redirects, limits).
  const icsText = opts.icsText ?? (await fetchCanvasFeedText(icsUrl, opts.deps));
  const parsed = parseFeed(icsText);
  const timeZone = await getUserTimezone();
  const today = getUserToday(timeZone);

  let total = 0;
  let added = 0;
  let skipped = 0;

  for (const item of Object.values(parsed)) {
    if (!item || item.type !== "VEVENT") continue;
    const event = item as VEvent;
    if (!event.start) continue;
    const { date, time } = toTaskDateTime(event.start, timeZone);
    if (date < today) continue;
    total++;

    const title = textValue(event.summary).trim() || "Canvas assignment";
    const description = textValue(event.description).trim();

    const result = await addTask({
      title,
      date,
      time,
      completed: false,
      kind: "school",
      source: "canvas",
      ...(description ? { notes: description.slice(0, 500) } : {}),
      ...(event.url ? { resources: [{ label: "View in Canvas", url: String(event.url) }] } : {}),
    });

    if (result.wasDuplicate) skipped++;
    else added++;
  }

  return { total, added, skipped };
}
