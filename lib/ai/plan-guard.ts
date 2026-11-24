// Round 5A 2.4: the plan quality guard. Pure: every step the brief call
// proposes is checked before it's placed. A step fails when its reason is
// boilerplate ("stay consistent"), its title is only generic words
// ("Practice problems"), or its reason points at something Tangent doesn't
// actually know (a fact id that isn't there, a date that isn't in the week, a
// topic word that isn't in the student's request). The caller rewrites a
// failing step once and drops it if it still fails (lib/ai/plan-brief-call.ts).
//
// The word lists live in config/plan-guard.json, loaded by
// lib/ai/plan-guard-config.ts; this file takes the config as an argument so it
// stays testable under plain `node --test`.

export type GuardConfig = {
  bannedPhrases: string[];
  genericTitleWords: string[];
  minWhyLength: number;
};

export type WhyRef = { kind: "calendar" | "fact" | "topic"; ref: string };

export type GuardStep = {
  what: string;
  why: string;
  why_ref?: WhyRef | null;
  /** The session's fixed "HH:MM", when known before the reasons are written. */
  time?: string;
};

export type GuardContext = {
  /** Ids of the facts the brief call was given. */
  factIds: readonly string[];
  /** ISO dates (YYYY-MM-DD) in the planning window. */
  dates: readonly string[];
  /** The student's request plus the plan's goal line. */
  topicText: string;
};

export type GuardReason = "banned_phrase" | "generic_title" | "short_why" | "no_ref" | "unknown_fact" | "unknown_date" | "off_topic" | "time_clash";

type DayPart = "early" | "morning" | "afternoon" | "evening" | "night";

/** The part of day an "HH:MM" time falls in. */
export function dayPartOf(time: string): DayPart | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  if (h < 8) return "early";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

// Which slot parts each phrase allows. "After school" is the afternoon or later.
const DAY_WORDS: [RegExp, DayPart[]][] = [
  [/\b(?:late at night|late[- ]night|at night|tonight|before bed)\b/i, ["evening", "night"]],
  [/\b(?:evening|after dinner)\b/i, ["evening", "night"]],
  [/\bafternoon\b/i, ["afternoon"]],
  [/\bafter school\b/i, ["afternoon", "evening", "night"]],
  [/\b(?:morning|before school|first thing)\b/i, ["early", "morning"]],
];

/** Overnight 2 (L2): a reason that puts the step in a part of day its time
 *  isn't ("late at night" on a 3:30 PM slot). Null when it fits or says nothing. */
export function timeClash(why: string, time: string | undefined): string | null {
  const part = time ? dayPartOf(time) : null;
  if (!part) return null;
  const said = DAY_WORDS.filter(([re]) => re.test(why));
  if (said.length === 0) return null;
  // Any phrase that fits the slot is fine ("not in the morning, so this evening one…").
  if (said.some(([, ok]) => ok.includes(part))) return null;
  return `says ${String(said[0][0].exec(why)?.[0])} but the session is at ${time}`;
}

export type GuardResult = { ok: true } | { ok: false; reason: GuardReason; detail: string };

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .split(/[^a-z0-9'+#]+/)
    .filter(Boolean);

const normalize = (s: string): string => ` ${words(s).join(" ")} `;

/** The first banned phrase in `text`, matched as whole words. */
export function bannedPhraseIn(text: string, cfg: GuardConfig): string | null {
  const hay = normalize(text);
  for (const p of cfg.bannedPhrases) {
    if (hay.includes(normalize(p))) return p;
  }
  return null;
}

/** True when every word of the title is a generic one ("Practice problems"). */
export function isGenericTitle(title: string, cfg: GuardConfig): boolean {
  const w = words(title);
  if (w.length === 0) return true;
  const generic = new Set(cfg.genericTitleWords);
  return w.every((x) => generic.has(x));
}

const STOP = new Set(["the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "my", "me", "i", "it", "is", "at", "with", "get", "better", "help", "want", "need", "this", "that", "your", "you"]);

/** Content words of a text: no stop words, no one-letter words, simple plural folded. */
export function topicWords(text: string): string[] {
  const out = new Set<string>();
  for (const w of words(text)) {
    if (w.length < 2 || STOP.has(w)) continue;
    out.add(w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w);
  }
  return Array.from(out);
}

export function checkStep(step: GuardStep, ctx: GuardContext, cfg: GuardConfig): GuardResult {
  if (isGenericTitle(step.what, cfg)) return { ok: false, reason: "generic_title", detail: step.what };
  const banned = bannedPhraseIn(step.why, cfg) ?? bannedPhraseIn(step.what, cfg);
  if (banned) return { ok: false, reason: "banned_phrase", detail: banned };
  if (step.why.trim().length < cfg.minWhyLength) return { ok: false, reason: "short_why", detail: step.why };
  const clash = timeClash(step.why, step.time);
  if (clash) return { ok: false, reason: "time_clash", detail: clash };
  // Every reason must point at something real: a day, a fact or the topic.
  const ref = step.why_ref;
  if (!ref) return { ok: false, reason: "no_ref", detail: step.why };
  {
    if (ref.kind === "fact" && !ctx.factIds.includes(ref.ref)) return { ok: false, reason: "unknown_fact", detail: ref.ref };
    if (ref.kind === "calendar" && !ctx.dates.includes(ref.ref)) return { ok: false, reason: "unknown_date", detail: ref.ref };
    if (ref.kind === "topic") {
      const topic = new Set(topicWords(ctx.topicText));
      if (!topicWords(ref.ref).some((w) => topic.has(w))) return { ok: false, reason: "off_topic", detail: ref.ref };
    }
  }
  return { ok: true };
}

/** A short plain sentence for the brief when a step was dropped. */
export function dropNote(count: number): string {
  if (count <= 0) return "";
  return count === 1
    ? "I left out one step that was too vague to be useful."
    : `I left out ${count} steps that were too vague to be useful.`;
}

// ── Round 6 (item 2): the Because-line truth check ─────────────────────────
// A reason may say "after your shift" or "before your test" only when the
// step's real day and time say so (Priya sim: "comes after your 4-9pm hours"
// on a 6:30 PM Wednesday step). Runs after placement, on the final times.

/** What's true about one placed step: its slot, the labelled blocks that day
 *  (minutes since midnight) and the deadline. */
export type ClaimFacts = {
  date: string;
  time: string;
  minutes?: number;
  blocks: { label: string; start: number; end: number }[];
  deadline?: { date: string; label: string } | null;
};

const EXAM_WORD = /^(?:test|exam|final|finals|quiz|midterm|deadline|due date)\b/i;
const BLOCK_WORD = /\b(?:shifts?|work|job|practice|school|debate|soccer|rehearsal|club|games?|class|lessons?|hours|meets?|band|robotics|training|activit(?:y|ies))\b/i;
const WEEKDAY_FULL = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function clockMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function weekdayIndex(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function daysApart(from: string, to: string): number {
  const ms = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

/** "4-9pm" → 21:00, the end of a typed range in a reason. */
function rangeEnd(phrase: string): number | null {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(phrase);
  if (!m) return null;
  let h = Number(m[4]) % 24;
  const ap = m[6]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  else if (!ap && h >= 1 && h < 8) h += 12;
  return h * 60 + Number(m[5] ?? 0);
}

/** Why a reason is false for its slot, or null when nothing it claims is wrong. */
export function claimCheck(text: string, f: ClaimFacts): string | null {
  if (!text.trim()) return null;
  const start = clockMinutes(f.time);
  const end = start === null ? null : start + (f.minutes ?? 45);
  const deadline = f.deadline ?? null;

  for (const m of Array.from(text.matchAll(/\bafter\s+(?:your|the|my)?\s*([^,.;:!?]{0,40})/gi))) {
    const phrase = m[1].trim();
    if (EXAM_WORD.test(phrase)) {
      if (deadline && f.date < deadline.date) return `says "after ${phrase}" but it is before ${deadline.label}`;
      continue;
    }
    if (start === null) continue;
    const typedEnd = rangeEnd(phrase);
    if (typedEnd !== null) {
      if (start < typedEnd) return `says "after ${phrase}" but starts before it ends`;
      continue;
    }
    if (/^school\b/i.test(phrase)) {
      const school = f.blocks.find((b) => b.label === "school");
      const weekend = [0, 6].includes(weekdayIndex(f.date));
      if (school ? school.end > start : weekend) return `says "after school" but ${weekend ? "it's a weekend" : "school isn't over"}`;
      continue;
    }
    if (!BLOCK_WORD.test(phrase) && !f.blocks.some((b) => phrase.toLowerCase().includes(b.label.toLowerCase().split(" ")[0]))) continue;
    const overlaps = f.blocks.some((b) => end !== null && start < b.end && b.start < end);
    const endedBefore = f.blocks.some((b) => b.end <= start);
    if (overlaps || !endedBefore) return `says "after ${phrase}" but no block ends before ${f.time}`;
  }

  for (const m of Array.from(text.matchAll(/\b(?:before|ahead of)\s+(?:your|the|my)?\s*([^,.;:!?]{0,30})/gi))) {
    const phrase = m[1].trim();
    if (EXAM_WORD.test(phrase)) {
      if (deadline && f.date >= deadline.date) return `says "before ${phrase}" but it is on or after ${deadline.date}`;
      continue;
    }
    if (end !== null && BLOCK_WORD.test(phrase) && !/^school\b/i.test(phrase) && !f.blocks.some((b) => b.start >= end)) {
      return `says "before ${phrase}" but no block starts after it`;
    }
  }

  if (timeClash(text, f.time)) return timeClash(text, f.time);

  // "during your shift", "sits in it": a reason that admits the step is in a block.
  if (/\b(?:sits in|fits (?:inside|in|into)|inside your|within your|during|in the middle of|on a break)\b/i.test(text) && BLOCK_WORD.test(text)) {
    const overlaps = f.blocks.some((b) => end !== null && start !== null && start < b.end && b.start < end);
    if (!overlaps) return "says it sits in a block but it doesn't";
  }

  // "this 6:30 session", "at 4 PM": a clock time that isn't the step's ("4-9pm" ranges are blocks, not claims).
  if (start !== null) {
    for (const m of Array.from(text.matchAll(/\b(?:this|at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?!\s*(?:-|–|to)\s*\d)/gi))) {
      const h = Number(m[1]);
      const min = Number(m[2] ?? 0);
      if (h < 1 || h > 12 || min > 59) continue;
      const said = (h % 12) * 60 + min;
      const step = start % 720;
      const meridiemOk = !m[3] || (m[3].toLowerCase() === "pm") === start >= 720;
      if (said !== step || !meridiemOk) return `says ${m[0].trim()} but the step is at ${f.time}`;
    }
  }

  // "the afternoon of the final itself", "the night before your test": a claim about the deadline day.
  const examAlt = "test|exam|final|finals|quiz|midterm";
  // Round 6: "the final is this same day", "same day as your test", "the test is today" / "is tomorrow".
  const sameDay = `(?:${examAlt}) is (?:(?:this|that|the) )?same day|same day as (?:the|your) (?:${examAlt})|(?:${examAlt}) is today|(?:${examAlt})['’]s (?:date|day)|(?:${examAlt}) (?:is|lands|falls|happens)(?: on)? (?:(?:this|that|the) )?(?:same )?(?:date|day)(?! (?:after|before))`;
  if (new RegExp(`\\b(?:(?:day|morning|afternoon|evening) of (?:the|your) (?:${examAlt})|(?:${examAlt}) itself|(?:${examAlt}) day|${sameDay})\\b`, "i").test(text)) {
    if (!deadline || f.date !== deadline.date) return "says it's on the day of the deadline but it isn't";
  }
  if (new RegExp(`\\b(?:night before (?:the|your) (?:${examAlt})|(?:${examAlt}) is tomorrow)\\b`, "i").test(text)) {
    if (!deadline || daysApart(f.date, deadline.date) !== 1) return "says it's the night before but it isn't";
  }

  // "this Saturday", "Saturday morning", "on Saturday", "Saturday is free": a claim about the step's day.
  // A possessive ("Sunday's video") or a deadline ("test on Friday") is a reference, not a claim.
  const day = WEEKDAY_FULL[weekdayIndex(f.date)];
  const days = WEEKDAY_FULL.join("|");
  const dayClaim = new RegExp(
    `\\b(?:(?:this|on)\\s+(${days})(?!['’]s)|(${days})\\s+(?:morning|afternoon|evening|night|is|has|gives|leaves|keeps))\\b`,
    "gi"
  );
  for (const m of Array.from(text.matchAll(dayClaim))) {
    const said = (m[1] ?? m[2]).toLowerCase();
    if (said === day) continue;
    const lead = text.slice(Math.max(0, (m.index ?? 0) - 24), m.index ?? 0);
    if (new RegExp(`\\b(?:${examAlt}|due|deadline)\\b[^.;]*$`, "i").test(lead)) continue;
    return `says ${said} but the step is on ${day}`;
  }
  return null;
}

function clock12(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function singular(label: string): string {
  return label.replace(/\b(shift|practice|lesson|game|meet)s\b/i, "$1");
}

/** A plain true reason from the placement itself, no AI: the block it follows,
 *  else how far ahead of the deadline it is, else just the open time. */
export function placementReason(f: ClaimFacts): string {
  const day = WEEKDAY_FULL[weekdayIndex(f.date)];
  const Day = day[0].toUpperCase() + day.slice(1);
  const start = clockMinutes(f.time);
  if (start !== null) {
    const before = f.blocks.filter((b) => b.end <= start && start - b.end <= 120).sort((a, b) => b.end - a.end)[0];
    if (before) return `Starts after ${singular(before.label)} ends (${clock12(before.end)}).`;
  }
  if (f.deadline && f.date < f.deadline.date) {
    const n = daysApart(f.date, f.deadline.date);
    return `Open time on ${Day}, ${n} day${n === 1 ? "" : "s"} before ${f.deadline.label}.`;
  }
  return start !== null ? `Open time on ${Day} at ${clock12(start)}.` : `Open time on ${Day}.`;
}

/** The reason as written when it's true for its slot; otherwise the whole
 *  reason is replaced by a true one from the placement. */
export function truthfulReason(text: string, f: ClaimFacts): string {
  return claimCheck(text, f) ? placementReason(f) : text;
}

/** A reason that talks about its slot: a day, a clock time, a part of day, or a block. */
// Round 6 item 7: "on 17 Dec", "by Dec 8" name a date too, so a moved step's reason with one is replaced.
const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const SLOT_TALK = new RegExp(
  `\\b(?:${WEEKDAY_FULL.join("|")}|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|today|tonight|tomorrow|weekend|morning|afternoon|evening|night|same day|day of|(?:test|exam|final|quiz|midterm)['’]s (?:date|day))\\b|\\d(?::\\d{2})?\\s*(?:am|pm)\\b|${BLOCK_WORD.source}|\\b${MONTH} \\d{1,2}\\b|\\b\\d{1,2}(?:st|nd|rd|th)? ${MONTH}(?![a-z])`,
  "i"
);

/** The reason for a step at its final slot. A step the placement check moved
 *  had its reason written for the old slot, so one that talks about a day, a
 *  time or a block is replaced too, not just one that is provably false. */
export function finalReason(text: string, f: ClaimFacts, moved: boolean): string {
  if (moved && SLOT_TALK.test(text)) return placementReason(f);
  return truthfulReason(text, f);
}
