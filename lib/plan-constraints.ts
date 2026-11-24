// Round 6 (item 2): the hard facts in a request, read in code. Busy times the
// student typed ("I work at the bakery Wed 4-9pm and Sat-Sun 8am-2pm", "not
// tue 3:30-5 (debate)") and the deadline ("test Friday", "final is Thu Dec
// 17", "ready before Jan 5"). They go to the placer as structured blocks, so
// no step lands in them, whatever the model writes. Pure.
//
// Sims (2026-11-22): Priya's step landed in her bakery shift, Leo's after his
// Friday test, Maya's in debate and on the day of her final.

import { avoidWindows, type AvoidWindow } from "./avoid-times";
import { addDaysYMD, weekdayOf } from "./time";
import { findMonthDates, upcomingYmd } from "./upcoming-date";

/** A typed busy time, with what it is ("bakery shifts", "debate"). */
export type BusyWindow = AvoidWindow & { label: string };
/** The last moment the plan is for: no step on or after `date` unless it is the event. */
export type Deadline = { date: string; label: string };

export type PlanConstraints = {
  /** Every block the placer must keep free: busy times plus a late cutoff. */
  avoid: AvoidWindow[];
  busy: BusyWindow[];
  deadline: Deadline | null;
  /** "nothing after 11pm": minutes since midnight, or null. */
  latestEnd: number | null;
};

const DAY_WORD = "(?:sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:days?|nesdays?|sdays?|rsdays?|urdays?|days?)?";
const DAY_SEP = "\\s*(?:-|–|—|to|through|thru|\\/|,|&|and|or)\\s*";
const DAY_SPEC = `(?:weekends?|weekdays|every\\s*day|daily|${DAY_WORD}(?:${DAY_SEP}${DAY_WORD})*)`;
const TIME = "(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)?";
const PAIR = new RegExp(
  `\\b(${DAY_SPEC})\\b\\.?,?\\s*(?:from\\s+|at\\s+|between\\s+)?${TIME}\\s*(?:-|–|—|to|until|till)\\s*${TIME}`,
  "gi"
);

// Words that say the time is taken (busy) or that it's time to use (free).
const CUE = /\b(?:not|no|never|avoid|except|busy|can'?t|cannot|don'?t|nothing|unavailable)\b/gi;
const ACTIVITY =
  /\b(?:i\s+(?:work|volunteer|babysit|coach|tutor|train|swim|play|have)|job|jobs|shifts?|practices?|rehearsals?|lessons?|games?|meets?|debate|soccer|basketball|football|volleyball|baseball|softball|tennis|hockey|lacrosse|wrestling|swimming|track|cross\s+country|band|orchestra|choir|robotics|church|tutoring|club|team|work(?!\s+on\b))\b/gi;
const USE =
  /\b(?:study|studying|review|reviewing|work\s+on|working\s+on|finish|write|writing|read|reading|session|sessions|schedule|put|plan|free|open|available|block)\b/gi;

const WEEKDAYS: [RegExp, number][] = [
  [/^sun/, 0],
  [/^mon/, 1],
  [/^tue/, 2],
  [/^wed/, 3],
  [/^thu/, 4],
  [/^fri/, 5],
  [/^sat/, 6],
];

function weekdayWord(word: string): number | null {
  const w = word.trim().toLowerCase();
  for (const [re, n] of WEEKDAYS) if (re.test(w)) return n;
  return null;
}

/** "Sat-Sun" → [6, 0], "Mon–Fri" → [1..5], "Tue and Thu" → [2, 4], "weekends" → [6, 0]. */
export function daysOf(spec: string): number[] {
  const s = spec.toLowerCase().trim();
  if (/^weekends?$/.test(s)) return [6, 0];
  if (s === "weekdays") return [1, 2, 3, 4, 5];
  if (/^(every\s*day|daily)$/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
  const out: number[] = [];
  const parts = s.split(/(\s*(?:-|–|—|to|through|thru)\s*|\s*(?:\/|,|&|and|or)\s*)/);
  let rangeNext = false;
  for (const part of parts) {
    if (!part.trim()) continue;
    if (/^\s*(?:-|–|—|to|through|thru)\s*$/.test(part)) {
      rangeNext = true;
      continue;
    }
    if (/^\s*(?:\/|,|&|and|or)\s*$/.test(part)) {
      rangeNext = false;
      continue;
    }
    const day = weekdayWord(part);
    if (day === null) continue;
    if (rangeNext && out.length > 0) {
      for (let d = (out[out.length - 1] + 1) % 7, guard = 0; guard < 7; d = (d + 1) % 7, guard++) {
        out.push(d);
        if (d === day) break;
      }
    } else {
      out.push(day);
    }
    rangeNext = false;
  }
  return Array.from(new Set(out));
}

function toMin(h: string, m: string | undefined, ap: string | undefined): number {
  let hour = Number(h) % 24;
  const a = ap?.toLowerCase().replace(/\./g, "");
  if (a === "pm" && hour < 12) hour += 12;
  else if (a === "am" && hour === 12) hour = 0;
  // "3:30-5" from a student means the afternoon.
  else if (!a && hour >= 1 && hour < 8) hour += 12;
  return hour * 60 + Number(m ?? 0);
}

function rangeOf(m: RegExpMatchArray): [number, number] | null {
  const startAp = m[4];
  const endAp = m[7];
  const end = toMin(m[5], m[6], endAp);
  // "4-9pm": the start shares the end's am/pm; "8am-2pm" keeps its own.
  let start = toMin(m[2], m[3], startAp ?? endAp);
  if (!startAp && start >= end && start >= 12 * 60 && start - 12 * 60 < end) start -= 12 * 60;
  if (end <= start || end - start > 12 * 60) return null;
  return [start, end];
}

function lastMatch(re: RegExp, s: string): { index: number; text: string } | null {
  let best: { index: number; text: string } | null = null;
  for (const m of Array.from(s.matchAll(re))) best = { index: m.index ?? 0, text: m[0] };
  return best;
}

function tidy(label: string): string {
  return label.replace(/\s+/g, " ").trim().toLowerCase();
}

/** What the block is, in a few words: "(debate)" → "debate", "I work at the bakery" → "bakery shifts". */
function labelFor(before: string, after: string): string {
  const paren = /^\s*\(([^)]{2,30})\)/.exec(after);
  if (paren) return tidy(paren[1]);
  const workAt = /\bi\s+work\s+(?:at|for)\s+(?:the\s+|a\s+|my\s+)?([a-z][a-z' ]{1,24}?)(?=\s+(?:on|every|from|$)|\s*$)/i.exec(before.trim());
  if (workAt) return tidy(`${workAt[1]} shifts`);
  const sport = /\b((?:[a-z]+\s+)?(?:practice|rehearsal|lessons?|club|team|games?|meets?))\b/i.exec(before);
  if (sport) {
    const words = sport[1].trim().split(/\s+/);
    const lead = words.length > 1 && /^(i|have|my|the|a|on|at|got|with)$/i.test(words[0]) ? words.slice(1) : words;
    return tidy(lead.join(" "));
  }
  const act = lastMatch(ACTIVITY, before);
  if (act) {
    const t = tidy(act.text);
    if (/^i\s+work$|^work$|^jobs?$|^shifts?$/.test(t)) return "work";
    if (!/^i\s/.test(t)) return t;
  }
  return "busy time";
}

/**
 * Busy times the student typed: a cue ("not", "busy", "can't") or an activity
 * ("I work at the bakery", "soccer", "debate") before a day and time range.
 * A chain keeps its kind: "I work Wed 4-9pm and Sat-Sun 8am-2pm" is two busy
 * times. "study tue 3:30-5" and "work on my essay tue 4-5" are times to use.
 */
export function busyWindows(text: string): BusyWindow[] {
  const out: BusyWindow[] = [];
  for (const sentence of text.split(/[.;!?\n]+/)) {
    let prevEnd = 0;
    let prevBusy = false;
    let prevLabel = "";
    for (const m of Array.from(sentence.matchAll(PAIR))) {
      const at = m.index ?? 0;
      const before = sentence.slice(prevEnd, at);
      const cue = lastMatch(CUE, before);
      const act = lastMatch(ACTIVITY, before);
      const use = lastMatch(USE, before);
      const busyAt = Math.max(cue?.index ?? -1, act?.index ?? -1);
      // Only "and"/"," between this pair and the last one: the chain goes on.
      const chained = prevEnd > 0 && /^\s*(?:,|and|&|plus|also)?\s*$/i.test(before);
      const busy: boolean = chained ? prevBusy : busyAt >= 0 && busyAt > (use?.index ?? -1);
      const range = rangeOf(m);
      prevEnd = at + m[0].length;
      prevBusy = busy;
      if (!busy || !range) continue;
      const label = chained && prevLabel ? prevLabel : labelFor(sentence.slice(0, at), sentence.slice(prevEnd));
      prevLabel = label;
      for (const weekday of daysOf(m[1])) {
        if (out.some((w) => w.weekday === weekday && w.start === range[0] && w.end === range[1])) continue;
        out.push({ weekday, start: range[0], end: range[1], label });
      }
    }
  }
  return out.slice(0, 14);
}

/** "nothing after 11pm", "no sessions past 9:30": the latest a step may end. */
export function latestEndFrom(text: string): number | null {
  const m = /\b(?:nothing|no(?:\s+\w+)?|not|never)\s+(?:after|past|later\s+than)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(text);
  if (!m) return null;
  const ap = m[3]?.toLowerCase();
  let hour = Number(m[1]) % 24;
  if (ap === "pm" && hour < 12) hour += 12;
  else if (ap === "am" && hour === 12) hour = 0;
  else if (!ap && hour >= 1 && hour < 12) hour += 12;
  return hour * 60 + Number(m[2] ?? 0);
}

const EVENT = "(test|exam|final|midterm|quiz|presentation|recital|tryouts?|audition|interview)";
const DUE = "(due|deadline|before|by|until|ready|submit)";

function labelOfEvent(word: string): string {
  const w = word.toLowerCase();
  if (/^(due|deadline|before|by|until|ready|submit)$/.test(w)) return "the deadline";
  return `your ${w.replace(/s$/, "")}`;
}

function nextWeekday(today: string, weekday: number): string {
  const ahead = (weekday - weekdayOf(today) + 7) % 7 || 7;
  return addDaysYMD(today, ahead);
}

/**
 * The deadline the request names, or null. A month date next to an exam or
 * due word ("final is Thu Dec 17", "ready before Jan 5"), else an exam or due
 * word next to a weekday ("test Friday", "Friday's quiz", "due Mon") or
 * "tomorrow". A weekday means its next one after today.
 */
export function deadlineFrom(text: string, today: string): Deadline | null {
  const s = text.toLowerCase();
  for (const d of findMonthDates(s)) {
    const before = s.slice(Math.max(0, d.position - 30), d.position);
    const after = s.slice(d.position, d.position + 30);
    const word =
      new RegExp(`\\b${EVENT}\\b[^.;\\n]*$`).exec(before)?.[1] ??
      new RegExp(`\\b${DUE}\\b[^.;\\n]*$`).exec(before)?.[1] ??
      new RegExp(`^[^.;\\n]*?\\b${EVENT}\\b`).exec(after.slice(3))?.[1];
    if (!word) continue;
    const date = upcomingYmd(today, d.month, d.day);
    if (date > today) return { date, label: labelOfEvent(word) };
  }
  const near = new RegExp(`\\b${EVENT}\\b[^.;\\n]{0,24}?\\b(?:on\\s+|this\\s+|next\\s+)?(${DAY_WORD}|tomorrow)\\b`, "i").exec(s);
  const far = new RegExp(`\\b(${DAY_WORD}|tomorrow)(?:'s)?\\s+(?:\\w+\\s+){0,2}?${EVENT}\\b`, "i").exec(s);
  const due = new RegExp(`\\b(?:due|deadline\\s+is)\\s+(?:on\\s+|this\\s+|by\\s+)?(${DAY_WORD}|tomorrow)\\b`, "i").exec(s);
  const pick = near ? { day: near[2], word: near[1] } : far ? { day: far[1], word: far[2] } : due ? { day: due[1], word: "due" } : null;
  if (!pick) return null;
  const date = pick.day.toLowerCase() === "tomorrow" ? addDaysYMD(today, 1) : (() => {
    const wd = weekdayWord(pick.day);
    return wd === null ? null : nextWeekday(today, wd);
  })();
  return date ? { date, label: labelOfEvent(pick.word) } : null;
}

/** Everything the placer must hold to, from the request (and any earlier context). */
export function planConstraints(text: string, today: string): PlanConstraints {
  const busy = busyWindows(text);
  const avoid: AvoidWindow[] = busy.map(({ weekday, start, end }) => ({ weekday, start, end }));
  for (const w of avoidWindows(text)) {
    if (!avoid.some((a) => a.weekday === w.weekday && a.start === w.start && a.end === w.end)) avoid.push(w);
  }
  const latestEnd = latestEndFrom(text);
  if (latestEnd !== null && latestEnd < 24 * 60) {
    for (let weekday = 0; weekday < 7; weekday++) avoid.push({ weekday, start: latestEnd, end: 24 * 60 });
  }
  return { avoid, busy, deadline: deadlineFrom(text, today), latestEnd };
}

/** "Deadline: 2026-12-17 (your final)", kept in a project's notes so later rounds keep it. */
export function deadlineNote(d: Deadline): string {
  return `Deadline: ${d.date} (${d.label})`;
}

export function deadlineFromNotes(notes: string | null | undefined): Deadline | null {
  const m = /^Deadline:\s*(\d{4}-\d{2}-\d{2})(?:\s*\(([^)]+)\))?/m.exec(notes ?? "");
  return m ? { date: m[1], label: m[2] ?? "the deadline" } : null;
}
