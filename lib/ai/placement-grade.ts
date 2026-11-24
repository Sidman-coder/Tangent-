// Round 6 (item 2): the placement half of the plan-quality eval. A case with
// `times` gives the brief's steps the slots a sim run actually got; the grade
// runs them through the placement check and the Because truth check, and
// fails on any step left in a block or on/after the deadline, or any reason
// still false. It reports the counts before and after, so one paid run shows
// both. Pure (no AI): `npm run eval:pipeline -- --quality --only <ids>`.

import type { Task } from "../types";
import { planConstraints } from "../plan-constraints";
import { checkPlacement, dayItems, stepIssue } from "../placement-check";
import { DEFAULT_CAPACITY, DEFAULT_PLACEMENT_RULES } from "../load";
import { addDaysYMD, weekdayOf } from "../time";
import { claimCheck, finalReason } from "./plan-guard";
import { CUE_GAP_MINUTES, ifThenLine, parseIfThen, shortTitle } from "../if-then";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type PlacementCase = {
  id: string;
  request: string;
  dates: string[];
  /** The slot each date got in the sim run ("HH:MM"). */
  times?: string[];
  /** The case's own today, when it isn't the file's reference_date. */
  reference_date?: string;
  /** Mon–Fri 8:00–3:00 School blocks in the fixture weeks. */
  school?: boolean;
  /** What planConstraints must read from the request (null: no deadline). */
  expectDeadline?: string | null;
  expectBusy?: number;
};

export type PlacementGrade = { pass: boolean; failures: string[]; summary: string; lines: string[] };

function schoolTasks(from: string, days: number): Task[] {
  const out: Task[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysYMD(from, i);
    const wd = weekdayOf(date);
    if (wd === 0 || wd === 6) continue;
    out.push({ id: `school-${date}`, title: "School", date, time: "08:00", completed: false, kind: "school", notes: "Until 3:00 PM" });
  }
  return out;
}

/** Grades the placement and reasons of one brief, or null when the case has no `times`. */
export function gradePlacement(
  c: PlacementCase,
  brief: { steps: { what: string; why: string }[]; kept?: number[] } | null,
  fileToday: string
): PlacementGrade | null {
  if (!c.times || !brief) return null;
  const today = c.reference_date ?? fileToday;
  const cons = planConstraints(c.request, today);
  const failures: string[] = [];
  if (c.expectDeadline !== undefined && (cons.deadline?.date ?? null) !== c.expectDeadline) {
    failures.push(`deadline read as ${cons.deadline?.date ?? "none"}, want ${c.expectDeadline ?? "none"}`);
  }
  if (c.expectBusy !== undefined && cons.busy.length !== c.expectBusy) failures.push(`${cons.busy.length} busy windows read, want ${c.expectBusy}`);

  const tasks = c.school ? schoolTasks(today, 56) : [];
  const now = { date: today, minutes: 9 * 60 };
  const rules = { ...DEFAULT_PLACEMENT_RULES, avoid: cons.avoid };
  const ctx = { tasks, now, cap: DEFAULT_CAPACITY, rules, deadline: cons.deadline };
  const steps = brief.steps.flatMap((s, i) => {
    const at = brief.kept?.[i] ?? i;
    return c.dates[at] ? [{ title: s.what, date: c.dates[at], time: c.times?.[at] ?? "16:00", why: s.why }] : [];
  });
  const badBefore = steps.filter((s) => stepIssue(s, tasks, ctx)).length;
  const r = checkPlacement(steps, ctx);
  const badAfter = r.steps.filter((s) => stepIssue(s, tasks, ctx)).length;
  if (badAfter > 0) failures.push(`${badAfter} step(s) still in a block or on/after the deadline`);

  let falseBefore = 0;
  let falseAfter = 0;
  let cued = 0;
  let longTitles = 0;
  const lines: string[] = [];
  for (const s of r.steps) {
    const facts = { date: s.date, time: s.time, blocks: dayItems(tasks, s.date, cons.busy), deadline: cons.deadline };
    const original = steps[s.index];
    const was = { ...facts, date: original.date, time: original.time, blocks: dayItems(tasks, original.date, cons.busy) };
    if (claimCheck(s.why, was)) falseBefore++;
    const moved = s.date !== original.date || s.time !== original.time;
    const fixed = finalReason(s.why, facts, moved);
    const why = claimCheck(fixed, facts);
    // Item 4: the if-then line's cue is a real item that day (ends 0–30 min before) or the step's own time.
    const title = shortTitle(s.title);
    const words = title.split(/\s+/).filter(Boolean).length;
    if (words < 2 || words > 6) {
      longTitles++;
      failures.push(`step "${title}" is ${words} words (want 2–6)`);
    }
    const line = ifThenLine({ title, date: s.date, time: s.time }, facts.blocks);
    const cue = parseIfThen(line);
    const [h, m] = s.time.split(":").map(Number);
    const start = h * 60 + m;
    const dayOk = cue?.day === WEEKDAY[weekdayOf(s.date)];
    const cueOk =
      cue?.kind === "when"
        ? facts.blocks.some((b) => b.label.toLowerCase() === cue.label.toLowerCase() && b.end === cue.end && start - b.end >= 0 && start - b.end <= CUE_GAP_MINUTES)
        : cue?.kind === "at" && cue.time === start;
    if (!cue || !dayOk || !cueOk) failures.push(`step "${title}" if-then cue isn't a real item or its time: "${line}"`);
    else if (cue.kind === "when") cued++;
    lines.push(`${s.date} ${s.time}${moved ? ` (was ${original.date} ${original.time})` : ""} ${title} | ${line} | ${fixed}`);
    if (why) {
      falseAfter++;
      failures.push(`step "${s.title}" reason still false (${why})`);
    }
  }
  const summary =
    `placement: ${badBefore} bad → ${badAfter} (moved ${r.moved}, dropped ${r.dropped.length}); ` +
    `reasons: ${falseBefore} false at the sim slot → ${falseAfter} after the check; ` +
    `if-then: ${r.steps.length} lines, ${cued} cued by a calendar item, ${r.steps.length - cued} by the time; titles over 6 words: ${longTitles}`;
  return { pass: failures.length === 0, failures, summary, lines };
}
