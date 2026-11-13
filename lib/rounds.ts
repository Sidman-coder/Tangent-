// Round 4 §3.4: plans come in rounds. Round 1 is 3 to 7 steps over about a
// week; when the student finishes them (or the week ends), Tangent reviews how
// they went and proposes the next round. Pure, so the planner, the project
// page and the tests all agree.
//
// Stored without a migration, in the places these things already live:
//   - a step's outcome is a "YOU'LL HAVE:" line in its notes, beside TIME:
//   - the project's round is a "Round — 1 · started 2026-11-08" line in its
//     description, kept with the brief lines (lib/project-notes.ts)

import { addDaysYMD, daysBetweenYMD } from "./time";

/** About a week per round. */
export const ROUND_DAYS = 7;
export const ROUND_MIN_STEPS = 3;
export const ROUND_MAX_STEPS = 7;
/** The review card shows once this share of the round is done, or the round's
 *  last day has passed. */
export const REVIEW_AT = 0.7;

export const ROUND_ONE_COPY = "Here's round 1: your first week of steps. When you finish them, Tangent plans the next round from how they went.";

/** How many steps a round gets: about one every other day for long steps,
 *  more for short ones; never under 3 or over 7, and never more than days. */
export function roundStepCount(days: number, stepMinutes: number | null = null): number {
  const span = Math.max(1, Math.min(ROUND_DAYS, Math.round(days)));
  const perWeek = stepMinutes === null ? 5 : stepMinutes <= 25 ? 7 : stepMinutes <= 45 ? 5 : stepMinutes <= 75 ? 4 : 3;
  const n = Math.round((perWeek * span) / ROUND_DAYS);
  return Math.max(Math.min(ROUND_MIN_STEPS, span), Math.min(ROUND_MAX_STEPS, span, n));
}

/** The round's step dates: spread evenly over at most a week from `start`,
 *  never past `end` (the goal's own end, when it's sooner). */
export function roundDates(start: string, end: string, stepMinutes: number | null = null): string[] {
  const last = end < start ? start : end;
  const days = Math.min(ROUND_DAYS, daysBetweenYMD(start, last) + 1);
  const n = roundStepCount(days, stepMinutes);
  if (n <= 1) return [start];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = addDaysYMD(start, Math.round((i * (days - 1)) / (n - 1)));
    if (!out.includes(d)) out.push(d);
  }
  return out;
}

// ─── "You'll have:" ─────────────────────────────────────────────────────────

const OUTCOME_LINE = /(?:^|\n)\s*YOU'LL HAVE:\s*([^\n]*)/i;

/** The step's notes with its outcome line set (or replaced). */
export function withOutcome(notes: string | undefined, outcome: string | undefined): string | undefined {
  const o = (outcome ?? "").replace(/\s+/g, " ").replace(/^you'?ll have:?\s*/i, "").replace(/\.$/, "").trim().slice(0, 140);
  const base = (notes ?? "").replace(/(?:^|\n)\s*YOU'LL HAVE:[^\n]*/gi, "").trim();
  if (!o) return base || undefined;
  return [base, `YOU'LL HAVE: ${o}`].filter(Boolean).join("\n");
}

/** "a list of 10 post ideas", or null. */
export function outcomeFromNotes(notes: string | undefined | null): string | null {
  const m = OUTCOME_LINE.exec(notes ?? "");
  const o = m?.[1]?.trim();
  return o ? o : null;
}

/** Notes without the machine lines the UI shows on its own. */
export function notesWithoutOutcome(notes: string | undefined | null): string {
  return (notes ?? "").replace(/(?:^|\n)\s*YOU'LL HAVE:[^\n]*/gi, "").trim();
}

// ─── The project's round ────────────────────────────────────────────────────

export type RoundInfo = { n: number; startedOn: string };

const ROUND_LINE = /^Round\s*[—–-]\s*(\d{1,3})\s*·\s*started\s+(\d{4}-\d{2}-\d{2})\s*$/i;

export function roundLine(r: RoundInfo): string {
  return `Round — ${r.n} · started ${r.startedOn}`;
}

export function parseRoundLine(line: string): RoundInfo | null {
  const m = ROUND_LINE.exec(line.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 ? { n, startedOn: m[2] } : null;
}

/** The round in a project description, or null for projects made before rounds. */
export function roundOf(description: string | null | undefined): RoundInfo | null {
  for (const line of (description ?? "").split(/\r?\n/)) {
    const r = parseRoundLine(line);
    if (r) return r;
  }
  return null;
}

/** The description with its round line set (replacing any earlier one). */
export function withRound(description: string | null | undefined, r: RoundInfo): string {
  const kept = (description ?? "").split(/\r?\n/).filter((l) => !parseRoundLine(l));
  return [...kept, roundLine(r)].filter((l, i, all) => l.trim() || i < all.length - 1).join("\n").trim();
}

/** "Round 1 · started Nov 8" */
export function roundChip(r: RoundInfo): string {
  const [y, m, d] = r.startedOn.split("-").map(Number);
  const when = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `Round ${r.n} · started ${when}`;
}

// ─── Review ─────────────────────────────────────────────────────────────────

type RoundStep = { date: string; completed: boolean; createdAt?: string };

/** The steps of the current round: those dated on or after it started. */
export function roundSteps<T extends RoundStep>(steps: readonly T[], r: RoundInfo | null): T[] {
  if (!r) return [...steps];
  return steps.filter((s) => !s.date || s.date >= r.startedOn);
}

/** Time for the round review card: about 70% done, or the round's week is
 *  over with something done or missed. Never for an empty round. */
export function reviewDue(steps: readonly RoundStep[], r: RoundInfo | null, today: string): boolean {
  if (!r) return false;
  const these = roundSteps(steps, r);
  if (these.length === 0) return false;
  const done = these.filter((s) => s.completed).length;
  if (done / these.length >= REVIEW_AT) return true;
  const lastDay = these.reduce((max, s) => (s.date && s.date > max ? s.date : max), r.startedOn);
  return today > lastDay;
}

export type CheckIn = { feel: "nailed" | "okay" | "struggled" | null; time: "less" | "about" | "more" | null };

/** One plain sentence about how the round went, from the step events' codes. */
export function roundSummary(done: number, total: number, checkIns: readonly CheckIn[], notToday: Record<string, number> = {}, next = 2): string {
  const parts = [`You finished ${done} of ${total} step${total === 1 ? "" : "s"}.`];
  const feels = checkIns.map((c) => c.feel).filter(Boolean);
  const struggled = feels.filter((f) => f === "struggled").length;
  const nailed = feels.filter((f) => f === "nailed").length;
  if (feels.length >= 2 && struggled * 2 >= feels.length) parts.push(`Most felt hard, so round ${next} goes smaller.`);
  else if (feels.length >= 2 && nailed * 2 > feels.length) parts.push(`Most went well, so round ${next} can stretch a little.`);
  const times = checkIns.map((c) => c.time).filter(Boolean);
  const more = times.filter((t) => t === "more").length;
  const less = times.filter((t) => t === "less").length;
  if (times.length >= 2 && more * 2 > times.length) parts.push("Steps took longer than planned.");
  else if (times.length >= 2 && less * 2 > times.length) parts.push("Steps went faster than planned.");
  const top = Object.entries(notToday).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 2) parts.push(`"Not today" came up ${top[1]} times, mostly ${NOT_TODAY_WORDS[top[0]] ?? "for other reasons"}.`);
  return parts.join(" ");
}

const NOT_TODAY_WORDS: Record<string, string> = {
  no_time: "for no time",
  unclear: "because a step was unclear",
  not_feeling_it: "for not feeling it",
  blocked: "because something was blocking it",
};

const FEEL_CODES = new Set(["nailed", "okay", "struggled"]);
const TIME_FROM_CODE: Record<string, CheckIn["time"]> = { faster: "less", about_right: "about", longer: "more" };

/** Step event codes (check_in, not_today) turned into the review's inputs:
 *  one CheckIn per step, and "Not today" reasons counted. */
export function checkInsFromCodes(rows: readonly { taskId: string | null; kind: string; code: string }[]): {
  checkIns: CheckIn[];
  notToday: Record<string, number>;
} {
  const byTask = new Map<string, CheckIn>();
  const notToday: Record<string, number> = {};
  rows.forEach((r, i) => {
    if (r.kind === "not_today") {
      notToday[r.code] = (notToday[r.code] ?? 0) + 1;
      return;
    }
    if (r.kind !== "check_in") return;
    const key = r.taskId ?? `row-${i}`;
    const c = byTask.get(key) ?? { feel: null, time: null };
    if (FEEL_CODES.has(r.code) && !c.feel) c.feel = r.code as CheckIn["feel"];
    if (TIME_FROM_CODE[r.code] && !c.time) c.time = TIME_FROM_CODE[r.code];
    byTask.set(key, c);
  });
  return { checkIns: Array.from(byTask.values()), notToday };
}
