import "server-only";

// One turn of "ask until enough" for /api/chat (Layer 3 of the context engine,
// docs/tangent/CONTEXT-ENGINE.md). Reads what the student typed and what
// Tangent already knows first, then asks the next 1–3 questions for this kind
// of goal (lib/context/goal-slots.ts), or hands the pipeline what it knows:
// "I have enough to start round 1." 2–5 questions in all, never a loop.
// Answers are saved as facts and slots, so nothing is asked twice, even on a
// different project. Returns "fallback" before the Round 2 migration so the
// route uses the older clarify questions.

import { addContextEntry, getUserContext } from "@/lib/store";
import { studentNow } from "@/lib/spacing";
import { slotFactText } from "@/lib/student/facts";
import { inferSlotsWithFallback } from "./infer";
import { getContextSlots, saveContextSlots } from "./store";
import { parseSlotAnswer } from "./flow";
import { computeSufficiency, isGlobalSlotKey, valueText, SLOT_KEYS, type AnySlot, type SlotMap, type SlotValue } from "./slots";
import {
  ENOUGH_MESSAGE,
  SLOT_FACT_LABEL,
  defaultFor,
  goalTypeOf,
  inferExtraSlots,
  isQuestionSlot,
  isStudentSlot,
  nextQuestions,
  questionCard,
  type GoalType,
  type QuestionSlot,
  type SlotQuestionCard,
} from "./goal-slots";

/** The flow so far, kept by the client between turns. */
export type SlotTurn = { answers: { slot: string; answer: string }[]; skipped: string[]; inARow: number; stopped: boolean };

export function parseSlotTurn(raw: unknown): SlotTurn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const answers = Array.isArray(r.answers)
    ? r.answers
        .filter((a): a is { slot: string; answer: string } => !!a && typeof a === "object" && typeof (a as { slot?: unknown }).slot === "string" && typeof (a as { answer?: unknown }).answer === "string")
        .filter((a) => isQuestionSlot(a.slot))
        .slice(0, 12)
        .map((a) => ({ slot: a.slot, answer: a.answer.slice(0, 200) }))
    : [];
  const skipped = Array.isArray(r.skipped) ? r.skipped.filter((s): s is string => typeof s === "string" && isQuestionSlot(s)).slice(0, 12) : [];
  const inARow = typeof r.inARow === "number" && Number.isFinite(r.inARow) ? Math.max(0, Math.min(20, Math.floor(r.inARow))) : 0;
  return { answers, skipped, inARow, stopped: r.stopped === true };
}

export type GrillTurn =
  | { kind: "fallback" }
  | { kind: "ask"; cards: SlotQuestionCard[]; progress: number; goalType: GoalType }
  | { kind: "draft"; notes: string; asked: number; enough: boolean; message: string };

const hasValue = (v: SlotValue | undefined) => !!v && (Array.isArray(v.value) ? v.value.length > 0 : String(v.value).trim() !== "");

export async function grillTurn(input: { text: string; chat: string; projectId: string | null; title?: string; turn: SlotTurn | null }): Promise<GrillTurn> {
  const stored = await getContextSlots(input.projectId);
  if (!stored) return { kind: "fallback" };
  const said = `${input.text}\n${input.chat}`.trim();
  const now = new Date();
  const [{ date: today }, context] = await Promise.all([studentNow(), getUserContext().catch(() => null)]);
  const inferred = await inferSlotsWithFallback(said, today);
  const facts = (context?.entries ?? []).map((e) => e.fact);
  const type = goalTypeOf(`${input.title ?? ""} ${said}`);

  // Everything Tangent already knows, from the words first, then memory.
  const known: SlotMap<QuestionSlot> = { ...stored.global, ...stored.extra, ...stored.project, ...inferExtraSlots(said, now), ...inferred };
  const turn = input.turn ?? { answers: [], skipped: [], inARow: 0, stopped: false };
  const answered: SlotMap<QuestionSlot> = {};
  for (const a of turn.answers) answered[a.slot as QuestionSlot] = parseSlotAnswer(a.slot as AnySlot, a.answer, now);
  const skipped = new Set(turn.skipped);
  const values: SlotMap<QuestionSlot> = { ...known, ...answered };
  for (const s of turn.skipped) {
    const d = defaultFor(s as QuestionSlot, now);
    if (d && !values[s as QuestionSlot]) values[s as QuestionSlot] = d;
  }

  const filled = new Set<string>(Object.keys(values).filter((k) => hasValue(values[k as QuestionSlot])));
  // Facts like "You can give 4 hours a week to SAT prep" answer slots too.
  const sufficiency = computeSufficiency(values, stored.global, facts, said, input.title);
  for (const slot of SLOT_KEYS) if (!sufficiency.missing.includes(slot)) filled.add(slot);
  // A student slot saved as a fact (platform, followers…) is never asked again.
  for (const e of context?.entries ?? []) if (e.slotKey && isStudentSlot(e.slotKey)) filled.add(e.slotKey);

  const step = nextQuestions({
    type,
    filled,
    skipped,
    asked: turn.answers.length + turn.skipped.length,
    stopped: turn.stopped,
    workTimeOpen: !hasValue(stored.global.preferredWorkTimes),
  });
  if (step.type === "ask") return { kind: "ask", cards: step.slots.map((s) => questionCard(s, input.title, type)), progress: step.progress, goalType: type };

  // Draft: keep what was learned. Project slots wait for the project id when
  // the plan is new (the next request infers them again); facts don't.
  const projectSlots: SlotMap<QuestionSlot> = {};
  const studentSlots: SlotMap<QuestionSlot> = {};
  for (const [k, v] of Object.entries({ ...known, ...answered }) as [QuestionSlot, SlotValue][]) {
    if (!v || v.source === "known") continue;
    if (isStudentSlot(k)) studentSlots[k] = v;
    else projectSlots[k] = v;
  }
  await Promise.all([
    input.projectId ? saveContextSlots(input.projectId, projectSlots) : Promise.resolve(true),
    saveContextSlots(null, studentSlots),
    ...turn.answers.map((a) => {
      const slot = a.slot as QuestionSlot;
      const value = answered[slot];
      if (!value) return Promise.resolve();
      const student = isStudentSlot(slot);
      const text = slotFactText(SLOT_FACT_LABEL[slot], valueText(slot as AnySlot, value), student ? null : input.title);
      if (!text.text) return Promise.resolve();
      return addContextEntry({
        category: isGlobalSlotKey(slot) ? "habit" : slot === "outcome" ? "goal" : "work",
        fact: text.text,
        source: "manual",
        factSource: "said",
        projectId: student ? null : input.projectId,
        slotKey: slot,
      }).then(
        () => undefined,
        () => undefined,
      );
    }),
  ]);

  const lines = (Object.entries(values) as [QuestionSlot, SlotValue][])
    .filter(([, v]) => v && v.source !== "default")
    .map(([k, v]) => `- ${SLOT_FACT_LABEL[k] ?? k}: ${valueText(k as AnySlot, v)}`);
  const assumptions: string[] = [];
  for (const s of ["deadline", "hoursPerWeek"] as const) {
    const v = values[s];
    if (!v || v.source === "default") assumptions.push(s === "deadline" ? "Finish in about 2 weeks" : "About 3 hours a week");
  }
  const openMust = step.openMust.filter((s) => s !== "deadline" && s !== "hoursPerWeek");
  const notes = [
    lines.length ? `What Tangent knows for this plan:\n${lines.join("\n")}` : "",
    assumptions.length ? `Assume (the student skipped or didn't say): ${assumptions.join("; ")}.` : "",
    openMust.length && !step.enough ? `Not known yet: ${openMust.map((s) => SLOT_FACT_LABEL[s]).join(", ")}. Plan a sensible first round without it.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { kind: "draft", notes, asked: turn.answers.length + turn.skipped.length, enough: step.enough, message: ENOUGH_MESSAGE };
}
