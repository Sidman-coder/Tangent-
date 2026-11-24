// Round 5A 2.2 (Sid, Q1): the plan's reasoning step, a separate brief-building
// call that runs before any step is written. It reads the student's week and
// what they've told Tangent, then decides what each session is for and why,
// tied to something real: a day in their week, a fact (by id) or the topic.
// The quality guard (lib/ai/plan-guard.ts) checks every step; failing steps are
// rewritten once (planFix) and dropped if they still fail. The kept steps feed
// generatePlan (lib/ai/plan.ts), and each "why" is saved on its task as a
// WHY: note line (lib/note-parts.ts).

import type Anthropic from "@anthropic-ai/sdk";
import { callClaude, messageText } from "./call";
import { checkStep, dropNote, type GuardConfig, type GuardContext, type WhyRef } from "./plan-guard";
import type { RecallFact } from "../student/recall";

export type StepIntent = {
  what: string;
  when_hint: string;
  why: string;
  why_ref: WhyRef | null;
  youll_have: string;
  /** The session's fixed "HH:MM" (overnight 2 L2), so the guard can check the why against it. */
  time?: string;
};

export type PlanBrief = {
  goal_line: string;
  assumptions: string[];
  /** One question, only when the answer would change the plan. */
  question: string | null;
  steps: StepIntent[];
  /** Index (into the requested dates) of each kept step, so dates line up. */
  kept: number[];
  /** Plain sentence for the brief when steps were dropped, or "". */
  dropNote: string;
  /** Ids of facts the kept steps lean on ("What I used about you"). */
  factIds: string[];
};

export type BriefInput = {
  request: string;
  dateContext: string;
  /** "Mon 16 Nov: soccer 4–6pm, 2 tasks" lines for the planning window. */
  weekSummary: string;
  facts: readonly RecallFact[];
  /** Session dates the plan will use (YYYY-MM-DD). */
  dates: readonly string[];
  /** Overnight 2 (L2): each date's fixed start time ("HH:MM"), same order, when the spacing found one. */
  times?: readonly (string | undefined)[];
  /** The student already answered the brief's question: never ask again. */
  noQuestion?: boolean;
  guard: GuardConfig;
};

const REF_SCHEMA = {
  type: "object",
  properties: { kind: { type: "string", enum: ["calendar", "fact", "topic"] }, ref: { type: "string" } },
  required: ["kind", "ref"],
  additionalProperties: false,
} as const;

const STEP_SCHEMA = {
  type: "object",
  properties: {
    what: { type: "string" },
    when_hint: { type: "string" },
    why: { type: "string" },
    why_ref: REF_SCHEMA,
    youll_have: { type: "string" },
  },
  required: ["what", "when_hint", "why", "why_ref", "youll_have"],
  additionalProperties: false,
} as const;

const BRIEF_SCHEMA = {
  type: "object",
  properties: {
    goal_line: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
    question: { type: "string" },
    step_intents: { type: "array", items: STEP_SCHEMA },
  },
  required: ["goal_line", "assumptions", "question", "step_intents"],
  additionalProperties: false,
} as const;

const FIX_SCHEMA = {
  type: "object",
  properties: { step_intents: { type: "array", items: STEP_SCHEMA } },
  required: ["step_intents"],
  additionalProperties: false,
} as const;

const STEP_RULES = `Each step:
- what: 2 to 6 words, starts with a verb, names the real thing ("Solve 3 USACO prefix-sum problems", "Draft the Common App intro"). Never only generic words like "Practice problems" or "Study session".
- when_hint: which day and part of day, from their week ("Tue after soccer", "Sat morning").
- why: one plain sentence (25 to 160 characters) saying why THIS step, THEN, for THIS student. Tie it to a real thing: a busy or free day in their week, something they told you, or the topic itself. When you use something they told you, say so ("Since you mentioned you're sleepy in the morning, this one is light.").
- why_ref: what the why points at: {"kind":"calendar","ref":"YYYY-MM-DD"} for a day in the window, {"kind":"fact","ref":"<fact id>"} for something they told you (only ids listed below), or {"kind":"topic","ref":"<words from their request>"}.
- youll_have: under 12 words, the concrete result ("a solved set of 3 prefix-sum problems").
Never write boilerplate: no "stay consistent", "work hard", "you're aiming for a top result", "build momentum", "you've got this".`;

/** "15:30" → "3:30 PM". */
function time12(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** "2026-11-24 at 3:30 PM, …" when the times are known; plain dates otherwise. */
export function sessionLine(dates: readonly string[], times?: readonly (string | undefined)[]): string {
  return dates.map((d, i) => (times?.[i] ? `${d} at ${time12(times[i]!)}` : d)).join(", ");
}

const clip = (s: unknown, max: number): string => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

function readRef(raw: unknown): WhyRef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind === "calendar" || r.kind === "fact" || r.kind === "topic" ? r.kind : null;
  const ref = clip(r.ref, 80);
  return kind && ref ? { kind, ref } : null;
}

export function readSteps(raw: unknown): StepIntent[] {
  return (Array.isArray(raw) ? raw : [])
    .map((s) => (s && typeof s === "object" ? (s as Record<string, unknown>) : {}))
    .map((s) => ({
      what: clip(s.what, 80),
      when_hint: clip(s.when_hint, 60),
      why: clip(s.why, 200),
      why_ref: readRef(s.why_ref),
      youll_have: clip(s.youll_have, 120).replace(/^you'?ll have:?\s*/i, "").replace(/\.$/, ""),
    }))
    .filter((s) => s.what);
}

function factLines(facts: readonly RecallFact[]): string {
  return facts.length ? facts.map((f) => `- [${f.id}] ${f.text}`).join("\n") : "(nothing yet)";
}

/** Guard every step; returns the passing ones and the indexes that failed. */
export function guardSteps(steps: StepIntent[], ctx: GuardContext, cfg: GuardConfig): { pass: StepIntent[]; fail: { step: StepIntent; reason: string }[] } {
  const pass: StepIntent[] = [];
  const fail: { step: StepIntent; reason: string }[] = [];
  for (const s of steps) {
    const r = checkStep(s, ctx, cfg);
    if (r.ok) pass.push(s);
    else fail.push({ step: s, reason: `${r.reason}: ${r.detail}` });
  }
  return { pass, fail };
}

/** The brief, or null when the model failed (the caller plans without it). */
export async function buildPlanBrief(input: BriefInput): Promise<PlanBrief | null> {
  const n = input.dates.length;
  const system = `You are Tangent's planner. Before any session is written, you decide what each session is for and why, for this one student.
${input.dateContext}
The plan has ${n} session${n === 1 ? "" : "s"} on these dates: ${sessionLine(input.dates, input.times)}.${input.times?.some(Boolean) ? "\nThose times are fixed. Never describe a session's part of day differently from its time (no \"late at night\" for a 3:30 PM session), and don't call a day free if you also call it busy." : ""}

THEIR WEEK:
${input.weekSummary || "(nothing scheduled)"}

WHAT THEY'VE TOLD YOU (id, then their words):
${factLines(input.facts)}

Return:
- goal_line: one sentence naming the goal and what round 1 gets them this week, specific to the topic.
- assumptions: 0 to 4 short lines, each a default you chose because it wasn't known ("45-minute sessions", "Starting from Bronze level").
- question: ${input.noQuestion ? 'always "".' : 'one short question ONLY if the answer would change the plan and nothing above answers it; otherwise "". Never ask what they already told you.'}
- step_intents: exactly ${n}, in date order, building on each other.

${STEP_RULES}`;
  const r = await callClaude(
    "planBrief",
    { system, messages: [{ role: "user", content: `Request: ${input.request}` }] },
    { format: { type: "json_schema", schema: BRIEF_SCHEMA } as Anthropic.JSONOutputFormat, label: "plan brief" }
  );
  if (!r.ok) return null;
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(messageText(r.message)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const ctx: GuardContext = {
    factIds: input.facts.map((f) => f.id),
    dates: input.dates,
    topicText: `${input.request} ${clip(json.goal_line, 240)}`,
  };
  const steps = readSteps(json.step_intents).slice(0, n).map((s, i) => (input.times?.[i] ? { ...s, time: input.times[i] } : s));
  const first = guardSteps(steps, ctx, input.guard);
  let pass = first.pass;
  let kept = steps.map((_, i) => i);
  const fail = first.fail;
  let dropped = 0;
  if (fail.length > 0) {
    // A rewrite keeps its slot's time, so the guard checks it again.
    const fixed = (await fixSteps(fail, ctx, input)).map((s, i) => (fail[i].step.time ? { ...s, time: fail[i].step.time } : s));
    const again = guardSteps(fixed, ctx, input.guard);
    // Keep date order: rebuild from the original order, swapping in fixes.
    const fixedByWhat = new Map(fail.map((f, i) => [f.step.what, again.pass.includes(fixed[i]) ? fixed[i] : null]));
    const slots = steps.map((s) => (fixedByWhat.has(s.what) ? fixedByWhat.get(s.what) ?? null : s));
    kept = slots.flatMap((s, i) => (s ? [i] : []));
    pass = slots.filter((s): s is StepIntent => !!s);
    dropped = steps.length - pass.length;
  }
  const question = input.noQuestion ? null : clip(json.question, 200) || null;
  const factIds = Array.from(new Set(pass.filter((s) => s.why_ref?.kind === "fact").map((s) => s.why_ref!.ref)));
  return {
    goal_line: clip(json.goal_line, 240),
    assumptions: (Array.isArray(json.assumptions) ? json.assumptions : []).map((a) => clip(a, 120)).filter(Boolean).slice(0, 4),
    question,
    steps: pass,
    kept,
    dropNote: dropNote(dropped),
    factIds,
  };
}

/** One rewrite of the failing steps (same count, same order). */
async function fixSteps(fail: { step: StepIntent; reason: string }[], ctx: GuardContext, input: BriefInput): Promise<StepIntent[]> {
  const system = `You fix steps in a student's plan that failed a quality check. Rewrite each one so it passes, keeping its day and purpose.
${input.dateContext}
Valid fact ids: ${ctx.factIds.join(", ") || "(none)"}. Valid dates: ${ctx.dates.join(", ")}.
A step's "time" is fixed: its why must not put it in another part of the day.
WHAT THEY'VE TOLD YOU:
${factLines(input.facts)}

${STEP_RULES}
Return exactly ${fail.length} step_intents, in the same order.`;
  const body = fail.map((f, i) => `${i + 1}. ${JSON.stringify(f.step)} — failed: ${f.reason}`).join("\n");
  const r = await callClaude(
    "planFix",
    { system, messages: [{ role: "user", content: `Request: ${input.request}\n\nSteps to fix:\n${body}` }] },
    { format: { type: "json_schema", schema: FIX_SCHEMA } as Anthropic.JSONOutputFormat, label: "plan fix" }
  );
  if (!r.ok) return fail.map((f) => f.step);
  try {
    const out = readSteps((JSON.parse(messageText(r.message)) as { step_intents?: unknown }).step_intents);
    return fail.map((f, i) => out[i] ?? f.step);
  } catch {
    return fail.map((f) => f.step);
  }
}

/** The kept steps as guidance for generatePlan's session writer. */
export function briefGuidance(brief: PlanBrief): string {
  if (brief.steps.length === 0) return "";
  return [
    `PLAN BRIEF (decided already; write the sessions to match, one per step, same order):`,
    `Goal: ${brief.goal_line}`,
    ...brief.steps.map((s, i) => `${i + 1}. ${s.what} (${s.when_hint}). Why: ${s.why} You'll have: ${s.youll_have}.`),
  ].join("\n");
}
