import "server-only";

// One turn of "Grill until enough" for /api/chat: rebuild the flow from what
// the client sends back (SlotTurn), ask the next question, or hand the
// pipeline what Tangent now knows. Returns "fallback" before the migration so
// the route uses the older clarify questions.

import { addContextEntry, getContextAsString } from "@/lib/store";
import { studentNow } from "@/lib/spacing";
import { inferSlotsWithFallback } from "./infer";
import { getContextSlots, saveContextSlots } from "./store";
import { EMPTY_FLOW, answerSlot, nextStep, parseSlotAnswer, skipSlot, slotToFact, CHECK_IN_QUESTION, KEEP_GOING, PLAN_NOW, type FlowState, type SlotQuestion } from "./flow";
import { computeSufficiency, isGlobalSlotKey, isSlotKey, valueText, type AnySlot, type GlobalSlotKey, type SlotKey, type SlotMap } from "./slots";

/** The flow so far, kept by the client between turns. */
export type SlotTurn = { answers: { slot: string; answer: string }[]; skipped: string[]; inARow: number; stopped: boolean };

export function parseSlotTurn(raw: unknown): SlotTurn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const answers = Array.isArray(r.answers)
    ? r.answers
        .filter((a): a is { slot: string; answer: string } => !!a && typeof a === "object" && typeof (a as { slot?: unknown }).slot === "string" && typeof (a as { answer?: unknown }).answer === "string")
        .filter((a) => isSlotKey(a.slot) || isGlobalSlotKey(a.slot))
        .slice(0, 12)
        .map((a) => ({ slot: a.slot, answer: a.answer.slice(0, 200) }))
    : [];
  const skipped = Array.isArray(r.skipped) ? r.skipped.filter((s): s is string => typeof s === "string" && (isSlotKey(s) || isGlobalSlotKey(s))).slice(0, 12) : [];
  const inARow = typeof r.inARow === "number" && Number.isFinite(r.inARow) ? Math.max(0, Math.min(20, Math.floor(r.inARow))) : 0;
  return { answers, skipped, inARow, stopped: r.stopped === true };
}

export type GrillTurn =
  | { kind: "fallback" }
  | { kind: "ask"; card: SlotQuestion; score: number; checkIn: boolean }
  | { kind: "draft"; notes: string; asked: number };

export async function grillTurn(input: { text: string; chat: string; projectId: string | null; title?: string; turn: SlotTurn | null }): Promise<GrillTurn> {
  const stored = await getContextSlots(input.projectId);
  if (!stored) return { kind: "fallback" };
  const [{ date: today }, memory] = await Promise.all([studentNow(), getContextAsString().catch(() => "")]);
  const facts = memory.split("\n").map((l) => l.replace(/^\[[a-z]+\]\s*/, "").trim()).filter(Boolean);
  const said = `${input.text}\n${input.chat}`.trim();
  const inferred = await inferSlotsWithFallback(said, today);

  const now = new Date();
  const turn = input.turn ?? { answers: [], skipped: [], inARow: 0, stopped: false };
  let state: FlowState = { ...EMPTY_FLOW, answered: { ...inferred, ...stored.project } };
  const global: SlotMap<GlobalSlotKey> = { ...stored.global };
  for (const a of turn.answers) {
    state = answerSlot(state, a.slot as AnySlot, a.answer, now);
    if (isGlobalSlotKey(a.slot)) global[a.slot] = parseSlotAnswer(a.slot, a.answer, now);
  }
  for (const s of turn.skipped) state = skipSlot(state, s as AnySlot, now);
  state = { ...state, inARow: turn.inARow, stopped: turn.stopped };

  const sufficiency = computeSufficiency(state.answered, global, facts, said, input.title);
  const step = nextStep(state, sufficiency, global, { title: input.title });
  if (step.type === "ask") return { kind: "ask", card: step.card, score: step.score, checkIn: false };
  if (step.type === "check_in") return { kind: "ask", card: { slot: "preferredWorkTimes", question: CHECK_IN_QUESTION, options: [KEEP_GOING, PLAN_NOW] }, score: step.score, checkIn: true };

  // Draft: keep what was learned. Answers become facts; project slots wait for
  // the project id when the plan is new (the next request infers them again).
  const answeredNow = turn.answers.filter((a) => isSlotKey(a.slot) || isGlobalSlotKey(a.slot));
  const projectSlots: SlotMap<SlotKey> = {};
  for (const [k, v] of Object.entries(state.answered) as [SlotKey, NonNullable<SlotMap<SlotKey>[SlotKey]>][]) {
    if (v.source !== "known") projectSlots[k] = v;
  }
  const globalAnswers: SlotMap<GlobalSlotKey> = {};
  for (const a of answeredNow) if (isGlobalSlotKey(a.slot)) globalAnswers[a.slot] = global[a.slot];
  await Promise.all([
    input.projectId ? saveContextSlots(input.projectId, projectSlots) : Promise.resolve(true),
    saveContextSlots(null, globalAnswers),
    ...answeredNow.map((a) => {
      const slot = a.slot as AnySlot;
      const value = isGlobalSlotKey(slot) ? global[slot] : state.answered[slot as SlotKey];
      if (!value) return Promise.resolve();
      return addContextEntry({ category: isGlobalSlotKey(slot) ? "habit" : "work", fact: slotToFact(slot, value, input.title), source: "manual" }).then(() => undefined, () => undefined);
    }),
  ]);

  const lines = (Object.entries(state.answered) as [SlotKey, NonNullable<SlotMap<SlotKey>[SlotKey]>][])
    .filter(([, v]) => v.source !== "default")
    .map(([k, v]) => `- ${k}: ${valueText(k, v)}`);
  for (const [k, v] of Object.entries(global) as [GlobalSlotKey, NonNullable<SlotMap<GlobalSlotKey>[GlobalSlotKey]>][]) lines.push(`- ${k}: ${valueText(k, v)}`);
  const notes = [
    lines.length ? `What Tangent knows for this plan:\n${lines.join("\n")}` : "",
    step.assumptions.length ? `Assume (the student skipped these): ${step.assumptions.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { kind: "draft", notes, asked: turn.answers.length + turn.skipped.length };
}
