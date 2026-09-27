// Decides how a voice/chat command is handled before any model is called.
//
//   No AI    — commands whose meaning is fixed by their wording:
//              "mark X done", "reopen X", "delete X on friday",
//              "move X to monday at 4pm", "what's due this week",
//              "dentist tomorrow at 3pm". Parsed here, run against the store
//              by lib/voice-handler.ts.
//   FAST     — everything else that fits one structured reply: fuzzy dates,
//              extraction, short commands (voiceCommand).
//   SMART    — plans, the multi-step Gmail/Canvas agent, and FAST replies
//              that came back unusable ("smart-escalation").
//
// The parsers are deliberately strict: anything they aren't sure of returns
// null and goes to the model. A parse that matches but can't be carried out
// (no task by that name, two tasks match) falls back to the model with route
// "fast-path-miss" rather than guessing.

import { addDaysYMD, getUserToday, resolveRelativeDate, singleRelativeDay, weekRange, currentInstant } from "@/lib/time";

export type FastRoute =
  | { op: "complete"; title: string }
  | { op: "uncomplete"; title: string }
  | { op: "delete"; title: string; date: string; time?: string }
  | { op: "reschedule"; title: string; fromDate?: string; date?: string; time?: string }
  | { op: "due"; range: "today" | "tomorrow" | "week"; start: string; end: string }
  | { op: "add"; title: string; date: string; time: string };

/** ai_usage.route values. Fast paths record `fast:<op>` with model "none". */
export const ROUTES = {
  fastMiss: "fast-path-miss",
  fast: "fast",
  smart: "smart",
  escalation: "smart-escalation",
} as const;

// ─── Dates and times ────────────────────────────────────────────────────────

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)(?=\s|$|[.,!?])|\b([01]?\d|2[0-3]):([0-5]\d)\b|\b(noon|midnight)\b/i;
const ISO_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const SLASH_RE = /\b(\d{1,2})\/(\d{1,2})\b/;
const MONTH_DAY_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i;
const RELATIVE_RE = /\b(day after tomorrow|tomorrow|tmrw|tmr|today|tonight|this (?:morning|afternoon|evening)|in \d{1,3} days?|(?:next|this|on|coming)\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi;

/** "3pm", "3:30 pm", "15:30", "noon" → "HH:MM". A bare "at 3" is ambiguous → null. */
export function parseTime(text: string): string | null {
  const m = text.match(TIME_RE);
  if (!m) return null;
  if (m[6]) return m[6].toLowerCase() === "noon" ? "12:00" : "00:00";
  if (m[4]) return `${m[4].padStart(2, "0")}:${m[5]}`;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h < 1 || h > 12 || min > 59) return null;
  const pm = m[3].toLowerCase().startsWith("p");
  if (pm && h !== 12) h += 12;
  if (!pm && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function validYMD(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** A month/day with no year means the next one on or after today. */
function upcoming(today: string, mo: number, d: number): string | null {
  const year = Number(today.slice(0, 4));
  const thisYear = validYMD(year, mo, d);
  if (!thisYear) return null;
  return thisYear >= today ? thisYear : validYMD(year + 1, mo, d);
}

/** The one day a phrase names: an ISO date, "10/3", "Oct 3rd", or one
 *  relative day ("tomorrow", "friday"). Null when it names none or several. */
export function parseDay(text: string, tz: string, at: Date = currentInstant()): string | null {
  const today = getUserToday(tz, at);
  const explicit = [ISO_RE, SLASH_RE, MONTH_DAY_RE].filter((re) => re.test(text)).length;
  const relative = (text.match(RELATIVE_RE) ?? []).length;
  if (explicit + relative !== 1) return null;
  const iso = text.match(ISO_RE);
  if (iso) return validYMD(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const slash = text.match(SLASH_RE);
  if (slash) return upcoming(today, Number(slash[1]) - 1, Number(slash[2]));
  const md = text.match(MONTH_DAY_RE);
  if (md) return upcoming(today, MONTHS.indexOf(md[1].toLowerCase().slice(0, 3)), Number(md[2]));
  return singleRelativeDay(text, tz, at) ?? resolveRelativeDate(text, tz, at);
}

/** Removes date and time words, then dangling connectors, from a phrase. */
function stripWhen(text: string): string {
  let s = text
    .replace(new RegExp(TIME_RE.source, "gi"), " ")
    .replace(new RegExp(ISO_RE.source, "g"), " ")
    .replace(new RegExp(SLASH_RE.source, "g"), " ")
    .replace(new RegExp(MONTH_DAY_RE.source, "gi"), " ")
    .replace(RELATIVE_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  const CONNECTOR = /^(?:at|on|for|by|this|next|the|from|to|,)(?:\s+|$)|\s+(?:at|on|for|by|this|next|the|from|to|,)$/i;
  while (CONNECTOR.test(s)) s = s.replace(CONNECTOR, "").trim();
  return s;
}

/** A tail that is only a day and/or a time ("friday at 4pm", "4pm", "10/3"). */
function parseWhen(tail: string, tz: string, at: Date): { date?: string; time?: string } | null {
  if (/\b(calendar|every|each|daily|weekly)\b/i.test(tail)) return null;
  const time = parseTime(tail) ?? undefined;
  const date = parseDay(tail, tz, at) ?? undefined;
  if (!time && !date) return null;
  if (stripWhen(tail).length > 0) return null; // something besides a day/time
  return { date, time };
}

// ─── Titles ─────────────────────────────────────────────────────────────────

const PRONOUN = /^(it|that|this|them|those|these|everything|all|all (?:my )?tasks|the last one|last one|my tasks|tasks)$/i;

function cleanTitle(raw: string): string | null {
  const t = raw
    .replace(/^(?:my|the|a|an)\s+/i, "")
    .replace(/\s+(?:task|todo|to-do)$/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  if (t.length < 2 || t.length > 80 || PRONOUN.test(t)) return null;
  return t;
}

// ─── The router ─────────────────────────────────────────────────────────────

const COMPLETE_PATTERNS = [
  /^(?:please\s+)?(?:mark|set)\s+(.+?)\s+(?:as\s+)?(?:done|complete|completed|finished)$/i,
  /^(?:please\s+)?(?:check|tick)\s+off\s+(.+)$/i,
  /^(?:i\s+|i'm\s+|im\s+)?(?:just\s+)?(?:finished|completed|done with)\s+(.+?)(?:\s+(?:today|just now|now))?$/i,
  /^(.+?)\s+is\s+(?:done|finished|complete)$/i,
];
const UNCOMPLETE_PATTERNS = [
  /^(?:please\s+)?(?:mark|set)\s+(.+?)\s+(?:as\s+)?(?:not done|undone|incomplete|not finished|not complete)$/i,
  /^(?:please\s+)?(?:uncheck|unmark|reopen)\s+(.+)$/i,
];
const DUE_RE = /^(?:what(?:'s|’s| is)|whats|what do i have|what have i got|anything)\s+due\s+(today|tonight|tomorrow|this week)$/i;
const DELETE_RE = /^(?:please\s+)?(?:delete|remove|cancel)\s+(.+?)\s+(?:on|at|for|from)\s+(.+)$/i;
const RESCHEDULE_RE = /^(?:please\s+)?(?:move|reschedule|push|shift)\s+(.+?)\s+to\s+(.+)$/i;
const ADD_VERB = /^(?:please\s+)?(?:add|schedule|put|create|book|remind me to)\s+/i;

/** Words that make a task worth the model's notes, start action and resources
 *  (or that signal something other than one simple task). */
const NEEDS_AI = /\b(plan|study|studying|homework|exam|test|quiz|essay|project|practice|review|learn|prepare|prep|research|read|chapter|assignment|every|each|daily|weekly|monthly|recurring|calendar|and then)\b/i;

/** How to handle `text`: a no-AI fast route, or null for the model. */
export function routeCommand(text: string, tz: string, at: Date = currentInstant()): FastRoute | null {
  const s = text.trim().replace(/\s+/g, " ").replace(/[.!]+$/, "");
  if (!s || s.length > 120 || /\n/.test(text)) return null;

  const due = s.replace(/\?+$/, "").match(DUE_RE);
  if (due) {
    const today = getUserToday(tz, at);
    const word = due[1].toLowerCase();
    if (word === "tomorrow") {
      const d = addDaysYMD(today, 1);
      return { op: "due", range: "tomorrow", start: d, end: d };
    }
    if (word === "this week") return { op: "due", range: "week", start: today, end: weekRange(today).end };
    return { op: "due", range: "today", start: today, end: today };
  }
  if (s.includes("?")) return null;

  for (const re of UNCOMPLETE_PATTERNS) {
    const m = s.match(re);
    if (m) {
      const title = cleanTitle(m[1]);
      return title ? { op: "uncomplete", title } : null;
    }
  }
  for (const re of COMPLETE_PATTERNS) {
    const m = s.match(re);
    if (m) {
      const title = cleanTitle(m[1]);
      return title ? { op: "complete", title } : null;
    }
  }

  const del = s.match(DELETE_RE);
  if (del) {
    if (/^all\b/i.test(del[1])) return null;
    const when = parseWhen(del[2], tz, at);
    const title = cleanTitle(del[1]);
    if (!when?.date || !title) return null;
    return { op: "delete", title, date: when.date, time: when.time };
  }

  const move = s.match(RESCHEDULE_RE);
  if (move) {
    const when = parseWhen(move[2], tz, at);
    if (!when) return null;
    // "move dentist from friday to monday"
    const from = move[1].match(/^(.+?)\s+from\s+(.+)$/i);
    const fromDate = from ? parseDay(from[2], tz, at) : null;
    if (from && (!fromDate || stripWhen(from[2]).length > 0)) return null;
    const title = cleanTitle(from ? from[1] : move[1]);
    if (!title) return null;
    return { op: "reschedule", title, fromDate: fromDate ?? undefined, date: when.date, time: when.time };
  }

  // One simple task with a clear time: "dentist tomorrow at 3pm", "add call mom at 7pm".
  if (NEEDS_AI.test(s) || /,|;|\band\b/i.test(s)) return null;
  if ((s.match(new RegExp(TIME_RE.source, "gi")) ?? []).length !== 1) return null;
  const time = parseTime(s);
  if (!time) return null;
  const hasDayWords = (s.match(RELATIVE_RE) ?? []).length > 0 || ISO_RE.test(s) || SLASH_RE.test(s) || MONTH_DAY_RE.test(s);
  const date = hasDayWords ? parseDay(s, tz, at) : getUserToday(tz, at);
  if (!date) return null;
  const title = cleanTitle(stripWhen(s.replace(ADD_VERB, "")));
  if (!title || title.split(" ").length > 8) return null;
  if (/^(?:delete|remove|cancel|move|reschedule|push|shift|mark|what|show|list|clear)\b/i.test(title)) return null;
  return { op: "add", title: title.charAt(0).toUpperCase() + title.slice(1), date, time };
}

// ─── Matching a spoken title to a task ──────────────────────────────────────

type Matchable = { id: string; title: string; date: string; time: string; completed: boolean };

function norm(s: string): string {
  return s.toLowerCase().replace(/\s*\(\d{1,2}:\d{2}\)$/, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

/** The one task a spoken title refers to, or null when none or several do.
 *  Exact titles beat partial ones; `prefer` narrows ties (e.g. to incomplete
 *  tasks for "done"); a tie across recurring copies resolves to today's. */
export function matchTask<T extends Matchable>(
  tasks: T[],
  spoken: string,
  opts: { prefer?: (t: T) => boolean; date?: string; time?: string; today?: string } = {}
): T | null {
  const n = norm(spoken);
  if (n.length < 2) return null;
  let pool = tasks;
  if (opts.date) pool = pool.filter((t) => t.date === opts.date);
  if (opts.time) pool = pool.filter((t) => t.time === opts.time);
  const exact = pool.filter((t) => norm(t.title) === n);
  const partial = pool.filter((t) => {
    const title = norm(t.title);
    return title.length >= 3 && (title.includes(n) || (n.length >= 3 && n.includes(title)));
  });
  for (const set of [exact, partial]) {
    if (set.length === 0) continue;
    const preferred = opts.prefer ? set.filter(opts.prefer) : set;
    const pick = preferred.length > 0 ? preferred : set;
    if (pick.length === 1) return pick[0];
    const todays = opts.today ? pick.filter((t) => t.date === opts.today) : [];
    if (todays.length === 1) return todays[0];
    return null; // ambiguous
  }
  return null;
}
