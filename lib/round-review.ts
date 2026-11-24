// Round 5A Phase 5: the end-of-round review. When a round's steps are done
// (or the student says they've finished it), Tangent asks 3 to 5 questions
// about what actually happened, then "When should round N start?" with the
// next round on a calendar. Pure, so the route, the sheet and the tests agree.
//
// What it reads is data, never the student's private words: planned vs done
// dates, steps skipped or moved, check-in codes and time taken.

import { addDaysYMD, daysBetweenYMD } from "./time";
import { prepareFact } from "./student/facts";
import { minutesFromNotes } from "./load";
import { roundOf, withRound, type RoundInfo } from "./rounds";
import type { ChangeSet } from "./pipeline/changeset";

export type ReviewStep = {
  id: string;
  title: string;
  date: string;
  completed: boolean;
  /** ISO time the step was ticked off, when the store has it. */
  completedAt?: string | null;
};

export type StepCode = { taskId: string | null; kind: string; code: string };

/** What happened in the round, counted. */
export type RoundFacts = {
  round: number;
  next: number;
  total: number;
  done: number;
  /** Done a day or more after the planned date. */
  late: { title: string; days: number }[];
  /** Done before the planned date. */
  early: number;
  /** Past its date and still not done. */
  missed: string[];
  /** Not done, whatever its date (overnight 2 L12: a step due later this week is still open). */
  open: string[];
  /** Moved to another day at least once ("rescheduled" events). */
  moved: number;
  /** Skipped steps ("skipped" events), each step once. */
  skipped: number;
  /** Check-in codes, counted: nailed, okay, struggled. */
  feel: { nailed: number; okay: number; struggled: number };
  /** Check-in time codes, counted: faster, about_right, longer. */
  time: { faster: number; about: number; longer: number };
  /** "Not today" reasons, counted. */
  notToday: Record<string, number>;
  /** Days from the round's start to its last finished step. */
  daysTaken: number | null;
};

const ymdOf = (iso: string | null | undefined): string | null => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null);

/** Counts what happened in this round's steps. */
export function roundFacts(steps: readonly ReviewStep[], codes: readonly StepCode[], round: RoundInfo, today: string): RoundFacts {
  const done = steps.filter((s) => s.completed);
  const late: RoundFacts["late"] = [];
  let early = 0;
  let lastDone: string | null = null;
  for (const s of done) {
    const on = ymdOf(s.completedAt);
    if (!on || !s.date) continue;
    const diff = daysBetweenYMD(s.date, on);
    if (diff >= 1) late.push({ title: s.title, days: diff });
    else if (diff < 0) early++;
    if (!lastDone || on > lastDone) lastDone = on;
  }
  const missed = steps.filter((s) => !s.completed && s.date && s.date < today).map((s) => s.title);
  const movedIds = new Set<string>();
  let movedLoose = 0;
  const skippedIds = new Set<string>();
  const feel = { nailed: 0, okay: 0, struggled: 0 };
  const time = { faster: 0, about: 0, longer: 0 };
  const notToday: Record<string, number> = {};
  for (const c of codes) {
    if (c.kind === "rescheduled") {
      if (c.taskId) movedIds.add(c.taskId);
      else movedLoose++;
    } else if (c.kind === "skipped") {
      skippedIds.add(c.taskId ?? `loose-${skippedIds.size}`);
    } else if (c.kind === "not_today") {
      notToday[c.code] = (notToday[c.code] ?? 0) + 1;
    } else if (c.kind === "check_in") {
      if (c.code === "nailed" || c.code === "okay" || c.code === "struggled") feel[c.code]++;
      else if (c.code === "faster") time.faster++;
      else if (c.code === "about_right") time.about++;
      else if (c.code === "longer") time.longer++;
    }
  }
  return {
    round: round.n,
    next: round.n + 1,
    total: steps.length,
    done: done.length,
    late: late.sort((a, b) => b.days - a.days),
    early,
    missed,
    open: steps.filter((s) => !s.completed).map((s) => s.title),
    moved: movedIds.size + movedLoose,
    skipped: skippedIds.size,
    feel,
    time,
    notToday,
    daysTaken: lastDone ? daysBetweenYMD(round.startedOn, lastDone) + 1 : null,
  };
}

/** The facts as plain lines for the question writer. Titles only, no notes. */
export function factLines(f: RoundFacts): string[] {
  const lines = [`Finished ${f.done} of ${f.total} steps in round ${f.round}.`];
  if (f.late.length) lines.push(`${f.late.length} finished late: ${f.late.slice(0, 3).map((l) => `"${l.title}" (${l.days} day${l.days === 1 ? "" : "s"} late)`).join(", ")}.`);
  if (f.early) lines.push(`${f.early} finished early.`);
  if (f.missed.length) lines.push(`Not done yet: ${f.missed.slice(0, 3).map((t) => `"${t}"`).join(", ")}.`);
  const later = f.open.filter((t) => !f.missed.includes(t));
  if (later.length) lines.push(`Still open (its day hasn't passed): ${later.slice(0, 3).map((t) => `"${t}"`).join(", ")}.`);
  if (f.moved) lines.push(`${f.moved} step${f.moved === 1 ? " was" : "s were"} moved to another day.`);
  if (f.skipped) lines.push(`${f.skipped} step${f.skipped === 1 ? " was" : "s were"} skipped.`);
  const checked = f.feel.nailed + f.feel.okay + f.feel.struggled;
  if (checked) lines.push(`Check-ins: ${f.feel.nailed} nailed it, ${f.feel.okay} okay, ${f.feel.struggled} struggled.`);
  const timed = f.time.faster + f.time.about + f.time.longer;
  if (timed) lines.push(`Time: ${f.time.faster} faster than planned, ${f.time.about} about right, ${f.time.longer} took longer.`);
  const reasons = Object.entries(f.notToday).sort((a, b) => b[1] - a[1]);
  if (reasons.length) lines.push(`"Not today" reasons: ${reasons.map(([k, n]) => `${k.replace(/_/g, " ")} ×${n}`).join(", ")}.`);
  if (f.daysTaken) lines.push(`The round took ${f.daysTaken} day${f.daysTaken === 1 ? "" : "s"}.`);
  return lines;
}

// ─── Questions ──────────────────────────────────────────────────────────────

export type ReviewQuestion = { id: string; text: string; chips: string[]; kind: "answer" | "start" };

export const START_QUESTION_ID = "start";

/** The last question, always: when the next round starts. */
export function startQuestion(next: number): ReviewQuestion {
  return { id: START_QUESTION_ID, text: `When should round ${next} start?`, chips: ["Start now", "Push 1 week", "Pick a date"], kind: "start" };
}

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

/** The AI's questions, checked: 2 to 4 of them (the start question makes 3 to
 *  5), each with 2 to 5 short chips. Anything malformed is dropped; too few
 *  left and the data-based questions are used instead. */
export function readQuestions(raw: unknown, f: RoundFacts): ReviewQuestion[] {
  const list = Array.isArray((raw as { questions?: unknown })?.questions) ? (raw as { questions: unknown[] }).questions : [];
  const out: ReviewQuestion[] = [];
  for (const q of list) {
    const text = clip((q as { text?: unknown })?.text, 200);
    const chips = (Array.isArray((q as { chips?: unknown })?.chips) ? (q as { chips: unknown[] }).chips : [])
      .map((c) => clip(c, 40))
      .filter((c, i, all) => c && all.indexOf(c) === i)
      .slice(0, 5);
    if (!text || chips.length < 2 || /when should round/i.test(text)) continue;
    out.push({ id: `q${out.length + 1}`, text: namedStep(text, f), chips, kind: "answer" });
    if (out.length === 4) break;
  }
  return [...(out.length >= 2 ? out : fallbackQuestions(f)), startQuestion(f.next)];
}

/** Overnight 2 (L12): "Which step did you not finish?" when only one is open
 *  asks what Tangent knows. Name it instead. */
export function namedStep(text: string, f: Pick<RoundFacts, "open">): string {
  if (f.open.length !== 1 || !/\bwhich (?:step|one)\b/i.test(text)) return text;
  const tail = /\b(what got in the way|why)\b/i.test(text) ? " What got in the way?" : " What happened?";
  return `"${f.open[0]}" didn't get done.${tail}`;
}

/** Questions from the data alone, for when the AI is unavailable. */
export function fallbackQuestions(f: RoundFacts): ReviewQuestion[] {
  const qs: Omit<ReviewQuestion, "id">[] = [];
  if (f.late.length >= 2 || f.moved >= 2) {
    qs.push({ text: `${f.late.length >= 2 ? `${f.late.length} steps finished late` : `${f.moved} steps got moved`}. Was the timing too tight?`, chips: ["Too tight", "About right", "Life got busy"], kind: "answer" });
  } else if (f.open.length) {
    qs.push({ text: `"${f.open[0]}" didn't happen yet. Keep it for round ${f.next}?`, chips: ["Keep it", "Drop it", "Make it smaller"], kind: "answer" });
  } else {
    qs.push({ text: `You finished ${f.done} of ${f.total} steps. How did the pace feel?`, chips: ["Too slow", "About right", "Too much"], kind: "answer" });
  }
  if (f.time.longer > f.time.faster) qs.push({ text: "Steps took longer than planned. Shorter steps next round?", chips: ["Yes, shorter", "Same length", "More time per step"], kind: "answer" });
  else qs.push({ text: "Which kind of session actually moved you forward?", chips: ["Practice", "Reading or notes", "Building something", "Not sure"], kind: "answer" });
  qs.push({ text: "What can you do now that you couldn't a week ago?", chips: ["A real skill", "A bit more", "Not much yet"], kind: "answer" });
  return qs.slice(0, 3).map((q, i) => ({ ...q, id: `q${i + 1}` }));
}

// ─── Answers ────────────────────────────────────────────────────────────────

export type ReviewAnswer = { questionId: string; question: string; chip?: string; text?: string };

/** The answers worth keeping as project facts. Each one goes through the same
 *  filter as every fact (sensitive details are never kept); the start answer
 *  is a date, not a fact. */
export function answerFacts(answers: readonly ReviewAnswer[], project: string, round: number): string[] {
  const out: string[] = [];
  for (const a of answers) {
    if (a.questionId === START_QUESTION_ID) continue;
    const said = [clip(a.chip, 40), clip(a.text, 200)].filter(Boolean).join(": ");
    if (!said) continue;
    const q = clip(a.question, 120).replace(/[?.!]+$/, "");
    const fact = `${project} round ${round}, asked "${q}": ${said}`;
    const prepared = prepareFact({ category: "general", fact, source: "manual", factSource: "said" });
    if (prepared.ok) out.push(prepared.fact);
  }
  return out;
}

/** Overnight 2 (L12): one line on the next round's draft saying what changed
 *  and why, from the review's answers ("Round 2 changed because you said: more
 *  practice; ran out of time."). Typed words go through the fact filter first. */
export function reviewChangeNote(answers: readonly ReviewAnswer[], next: number): string {
  const said: string[] = [];
  for (const a of answers) {
    if (a.questionId === START_QUESTION_ID) continue;
    const chip = clip(a.chip, 40);
    const typed = clip(a.text, 80);
    const typedOk = typed && prepareFact({ category: "general", fact: typed, source: "manual", factSource: "said" }).ok;
    const bit = typedOk ? typed : chip;
    if (bit) said.push(bit.replace(/[.!]+$/, "").toLowerCase());
  }
  if (said.length === 0) return "";
  return `Round ${next} changed because you said: ${said.slice(0, 3).join("; ")}.`;
}

type TimedStep = { time?: string | null; notes?: string | null };

const partOfDay = (time: string | null | undefined): string | null => {
  if (!time || !/^\d{2}:\d{2}/.test(time) || time.startsWith("23:59")) return null;
  const h = Number(time.slice(0, 2));
  return h < 12 ? "mornings" : h < 17 ? "afternoons" : "evenings";
};

/** The part of the day most of these steps sit in, when most of them agree. */
function mainPartOfDay(steps: readonly TimedStep[]): string | null {
  const counts = new Map<string, number>();
  for (const s of steps) {
    const p = partOfDay(s.time);
    if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const [best] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return best && best[1] * 2 > steps.length ? best[0] : null;
}

function medianMinutes(steps: readonly TimedStep[]): number | null {
  const mins = steps
    .map((s) => minutesFromNotes(s.notes ?? undefined))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  return mins.length ? mins[Math.floor(mins.length / 2)] : null;
}

/** Overnight 2 Phase 3: the review's change, said the way a coach would ("Last
 *  round you said mornings didn't stick, so this round is evenings"). What
 *  changed is read from the steps themselves (old round vs the new draft): the
 *  part of the day, step length, step count. Nothing changed that can be seen:
 *  it says the round is planned around what they said. */
export function roundChangeLine(note: string, oldSteps: readonly TimedStep[], newSteps: readonly TimedStep[]): string {
  const m = /^Round (\d+) changed because you said: (.+?)\.?$/.exec(note);
  if (!m) return note;
  const [, next, said] = m;
  const so: string[] = [];
  const was = mainPartOfDay(oldSteps);
  const now = mainPartOfDay(newSteps);
  if (was && now && was !== now) so.push(`this round is ${now}`);
  const a = medianMinutes(oldSteps);
  const b = medianMinutes(newSteps);
  if (a && b && b <= a * 0.75) so.push(`steps are shorter (${b} min, not ${a})`);
  else if (a && b && b >= a * 1.25) so.push(`steps are longer (${b} min, not ${a})`);
  if (so.length < 2 && oldSteps.length && newSteps.length && newSteps.length !== oldSteps.length) {
    so.push(`round ${next} has ${newSteps.length} step${newSteps.length === 1 ? "" : "s"}, not ${oldSteps.length}`);
  }
  if (!so.length) return `Last round you said ${said}. Round ${next} is planned around that.`;
  return `Last round you said ${said}, so ${so.slice(0, 2).join(" and ")}.`;
}

// ─── The next round's dates and round line ──────────────────────────────────

export type StartChoice = { kind: "now" } | { kind: "push" } | { kind: "date"; date: string };

/** The first day of the next round for each option. */
export function startDate(choice: StartChoice, today: string): string {
  if (choice.kind === "push") return addDaysYMD(today, 7);
  if (choice.kind === "date" && /^\d{4}-\d{2}-\d{2}$/.test(choice.date) && choice.date >= today) return choice.date;
  return today;
}

type Op = ChangeSet["ops"][number];

/** The proposed round, moved so its first step lands on `start`. The plan's
 *  round line (an update_plan op) moves with it, so the round number and its
 *  start date are confirmed, and undone, with the steps. */
export function shiftRound(ops: readonly Op[], start: string): Op[] {
  const dates = ops.flatMap((o) => (o.op === "add_task" ? [o.date] : []));
  if (dates.length === 0) return [...ops];
  const first = dates.reduce((a, b) => (b < a ? b : a));
  const by = daysBetweenYMD(first, start);
  return ops.map((o) => {
    if (o.op === "add_task") {
      const date = addDaysYMD(o.date, by);
      const repeat = o.repeat?.endDate ? { ...o.repeat, endDate: addDaysYMD(o.repeat.endDate, by) } : o.repeat;
      return { ...o, date, ...(repeat ? { repeat } : {}) };
    }
    const r = o.op === "update_plan" && o.notes !== undefined ? roundOf(o.notes) : null;
    if (o.op === "update_plan" && r) return { ...o, notes: withRound(o.notes, { n: r.n, startedOn: start }) };
    return o;
  });
}

/** Max length of an update_plan op's notes (lib/pipeline/changeset.ts). */
const NOTES_MAX = 2000;

/** The ops with the round line update added (or replaced). Null when the
 *  description is too long for an op; the caller then advances the round
 *  after the confirm, as Round 4 did. */
export function withRoundOp(ops: readonly Op[], planId: string, description: string | null | undefined, next: RoundInfo): Op[] | null {
  const notes = withRound(description, next);
  if (notes.length > NOTES_MAX) return null;
  const rest = ops.filter((o) => !(o.op === "update_plan" && o.plan_id === planId && o.title === undefined));
  return [...rest, { op: "update_plan", plan_id: planId, notes }];
}
