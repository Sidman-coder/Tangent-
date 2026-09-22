// lib/canvas-ics.ts
//
// New Canvas integration path: a per-student Canvas Calendar Feed (.ics) URL,
// polled read-only and turned into TANGENT tasks. This is separate from the
// legacy token-based client in lib/canvas.ts (still used by the agent tool
// loop) — do not merge the two paths.

import ical from "node-ical";
import type { CalendarResponse, ParameterValue, VEvent } from "node-ical";
import { addTask } from "./store";

function textValue(value: ParameterValue<string> | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.val ?? "";
}

export type IcsValidation =
  | { ok: true; icsText: string; eventCount: number }
  | { ok: false; error: string };

/** Fetches a candidate Canvas calendar-feed URL and confirms it is a real, parseable .ics feed. */
export async function fetchAndValidateIcs(rawUrl: string): Promise<IcsValidation> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "The calendar feed link must start with http:// or https://." };
  }

  let res: Response;
  try {
    res = await fetch(url.toString());
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

function toTaskDateTime(date: Date): { date: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export type SyncResult = { total: number; added: number; skipped: number };

/**
 * Re-fetches the feed and ingests VEVENT entries as Canvas-sourced tasks via the normal addTask path.
 * When `sinceDate` is given, events starting before it are left out entirely (not counted in `total`) —
 * used to keep both the initial connect and later re-syncs from pulling in a student's entire semester
 * history, only what's still ahead as of when they connected.
 */
export async function syncCanvasFeed(icsUrl: string, sinceDate?: string | Date): Promise<SyncResult> {
  const res = await fetch(icsUrl);
  if (!res.ok) {
    throw new Error(`Canvas feed returned ${res.status}`);
  }
  const icsText = await res.text();
  const parsed = ical.sync.parseICS(icsText);
  const cutoff = sinceDate ? new Date(sinceDate) : null;

  let total = 0;
  let added = 0;
  let skipped = 0;

  for (const item of Object.values(parsed)) {
    if (!item || item.type !== "VEVENT") continue;
    const event = item as VEvent;
    if (!event.start) continue;
    if (cutoff && event.start < cutoff) continue;
    total++;

    const { date, time } = toTaskDateTime(event.start);
    const title = textValue(event.summary).trim() || "Canvas assignment";
    const description = textValue(event.description).trim();

    const result = addTask({
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
