import "server-only";

// "Grill me": before Tangent acts on a big or vague request, it may ask the
// student up to three short questions, each with tap-to-answer options. It
// asks only what it can't already tell from the student's context
// (lib/ai/student-context.ts) — asking something Tangent should know is worse
// than not asking at all. Simple, specific captures never get here
// (shouldConsiderClarifying), and the capture mic always skips it.

import { callClaude } from "@/lib/ai/call";
import { extractStructuredJson } from "@/lib/anthropic-json";
import { isClearPlanRequest } from "@/lib/ai/plan";

export type ClarifyQuestion = {
  id: string;
  question: string;
  /** 2–4 short answers to tap; the student can always type their own. */
  options: string[];
};

/** Asked once, the first time it matters; the answer is saved to the profile. */
export const CAPACITY_QUESTION: ClarifyQuestion = {
  id: "capacity",
  question: "On a school night, how much work can you do before you're fried?",
  options: ["About 1 hr", "About 2 hrs", "About 3 hrs", "4+ hrs"],
};

const SCHEMA = {
  type: "object",
  properties: {
    ask: { type: "boolean" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["question", "options"],
        additionalProperties: false,
      },
    },
  },
  required: ["ask", "questions"],
  additionalProperties: false,
} as const;

const SYSTEM = `You are TANGENT, a planner for high school students that knows them well. A student just asked for something. Before acting, decide whether a few questions would make the result clearly better for THIS student.

Ask only when the answer would change what you do, and you cannot already tell it from their context below. Never ask something the context answers (their school hours, capacity, what's due, their goals, facts you know). Never ask permission, never ask "anything else?", never ask about preferences that don't change the plan.

Good reasons to ask: a goal with no deadline or target ("get better at chess" — what rating, by when?), a plan whose scope is unclear (which units, which subjects), a request that could mean two very different things, missing info only they know (when the test is, what the teacher said).

If the request is already specific enough, or it's a simple capture, set ask=false and return no questions.

When you ask:
- At most 3 questions, most important first. Fewer is better.
- Each under 12 words, plain and direct, like a sharp older friend — not a form.
- 2–4 options each, under 4 words, the likely answers. Use what you know about them to make the options specific (their actual classes, their actual deadlines).
- Don't number them.`;

/** Cheap gate before spending a model call: plans and goals, or anything long
 *  enough to be more than one simple task. */
export function shouldConsiderClarifying(text: string): boolean {
  const t = text.trim();
  if (/\b(just do it|don'?t ask|no questions)\b/i.test(t)) return false;
  if (isClearPlanRequest(t)) return true;
  if (/\b(plan|prep|prepare|study for|get better|learn|improve|catch up|organi[sz]e|help me|figure out|finals?|midterms?|project)\b/i.test(t)) {
    return true;
  }
  return t.split(/\s+/).length >= 14;
}

/** Up to three questions for the request, or [] to go straight ahead. Any
 *  failure also means "go straight ahead" — asking is never required. */
export async function clarifyQuestions(
  request: string,
  studentContext: string,
  opts: { askCapacity: boolean }
): Promise<ClarifyQuestion[]> {
  const result = await callClaude(
    "clarify",
    {
      system: SYSTEM,
      messages: [{ role: "user", content: `STUDENT CONTEXT:\n${studentContext}\n\nTHEIR REQUEST:\n${request}` }],
    },
    { format: { type: "json_schema", schema: SCHEMA } }
  );
  if (!result.ok) {
    console.warn("[clarify] model call failed:", result.status);
    return [];
  }
  let parsed: { ask: boolean; questions: { question: string; options: string[] }[] };
  try {
    parsed = extractStructuredJson(result.message);
  } catch {
    return [];
  }
  if (!parsed.ask) return [];
  const questions: ClarifyQuestion[] = parsed.questions
    .filter((q) => q.question?.trim())
    .slice(0, 3)
    .map((q, i) => ({
      id: `q${i + 1}`,
      question: q.question.trim(),
      options: (q.options ?? []).map((o) => o.trim()).filter(Boolean).slice(0, 4),
    }));
  // Capacity only matters once there's real work to spread out.
  if (questions.length > 0 && opts.askCapacity && questions.length < 3) questions.push(CAPACITY_QUESTION);
  return questions;
}

/** "About 2 hrs" / "90 min" / "4+ hrs" → minutes, or null. */
export function capacityFromAnswer(answer: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*\+?\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i.exec(answer);
  if (!m) return null;
  const n = Number(m[1]);
  const minutes = /^h/i.test(m[2]) ? n * 60 : n;
  return minutes >= 15 && minutes <= 600 ? Math.round(minutes) : null;
}
