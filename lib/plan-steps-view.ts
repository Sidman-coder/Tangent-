// Round 5A 2.3: the step cards in Home's plan brief. Title, day and time come
// from the drafted add_task ops, so an edit (move, remove) shows at once; the
// "Why" and "You'll have" ride in each op's notes (WHY: / YOU'LL HAVE:, see
// lib/note-parts.ts), falling back to the brief's step at the same place.

import { noteParts, whenPart } from "./note-parts";
import { ifThenFor } from "./if-then";

type Op = { op: string; title?: string; date?: string; time?: string; notes?: string };
type BriefStep = { what: string; when: string; why: string; youllHave: string; because?: string; ifThen?: string };

export type StepCard = {
  /** The op's index in the ChangeSet, for edits ({type:"remove", index}). */
  index: number;
  title: string;
  date: string;
  time: string;
  why: string;
  /** Overnight 2 Phase 3: the fact the why used ("you said you focus best at night"). */
  because: string;
  youllHave: string;
  /** Round 6: "When school ends Monday (3:00 PM), then 45 min: …", true for the op's slot now. */
  ifThen: string;
};

export function stepCards(ops: readonly Op[], briefSteps: readonly BriefStep[] = []): StepCard[] {
  const cards: StepCard[] = [];
  ops.forEach((op, index) => {
    if (op.op !== "add_task" || !op.title || !op.date) return;
    const parts = op.notes ? noteParts(op.notes, true) ?? [] : [];
    const part = (label: string) => parts.find((p) => p.label === label)?.text ?? "";
    const fallback = briefSteps[cards.length];
    cards.push({
      index,
      title: op.title,
      date: op.date,
      time: op.time ?? "",
      why: part("Why") || fallback?.why || "",
      because: part("Because") || fallback?.because || "",
      youllHave: part("You'll have") || fallback?.youllHave || "",
      ifThen: ifThenFor(whenPart(op.notes) || fallback?.ifThen, { title: op.title, date: op.date, time: op.time }),
    });
  });
  return cards;
}

/** "2026-11-16", "16:30" → "Mon, Nov 16 · 4:30 PM". */
export function whenLabel(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  if (!/^\d{1,2}:\d{2}$/.test(time)) return day;
  const [h, min] = time.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${day} · ${hour}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Lines from a planning template (competition milestones, idea stage) that say
 *  nothing about an exam or a to-do. Shown only when the goal is that kind of thing. */
const TEMPLATE_LINES = [/^starting from the idea stage/i, /^standard milestones/i, /^general steps that fit any category/i, /^working on your own, with check-ins/i];
const PROJECT_GOAL = /\b(competition|contest|fair|olympiad|hackathon|robot\w*|project|science|build|entry|submission)\b/i;

/** The few assumptions worth showing under "Why this plan": at most three, no
 *  repeats, and no project-template lines on a goal that is not a project (overnight C13). */
export function reasonLines(assumptions: readonly string[], goalText: string, max = 3): string[] {
  const project = PROJECT_GOAL.test(goalText);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of assumptions) {
    const line = raw.trim();
    const key = line.toLowerCase();
    if (!line || seen.has(key)) continue;
    seen.add(key);
    if (!project && TEMPLATE_LINES.some((re) => re.test(line))) continue;
    out.push(line);
    if (out.length === max) break;
  }
  return out;
}
