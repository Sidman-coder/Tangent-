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
import { matchProject } from "@/lib/project-match";

/** Id prefix of the "part of your project?" question; the chat route reads it. */
export const PROJECT_QUESTION_PREFIX = "project:";
/** The answer that files the ask under the matched project. */
export const PROJECT_YES = "Yes, add to it";

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
- Don't number them.

Use what you can see, and say so in the question, so it feels like Tangent knows them:
- If they name a class loosely ("chem", "english"), match it to THEIR CLASSES and name it ("AP Chem"). If a matching test or deadline is in COMING UP FOR SCHOOL, confirm it instead of asking ("Is this the Dec 12 AP Chem final?" with options like "Yes", "No, later").
- Don't ask which project something belongs to: Tangent asks that itself. Do use PROJECTS ALREADY UNDER WAY so you don't ask what a project already answers.
- Every date you offer must be after TODAY. Prefer relative options ("This month", "Before winter break") to years.
- If the week is already heavy (HOW FULL THE NEXT ... DAYS ARE), you may ask whether to start after the busy days.`;

/** Cheap gate before spending a model call: plans and goals, or anything long
 *  enough to be more than one simple task. */
export function shouldConsiderClarifying(text: string): boolean {
  const t = text.trim();
  if (/\b(just do it|don'?t ask|no questions)\b/i.test(t)) return false;
  if (isClearPlanRequest(t)) return true;
  // Bigger efforts too ("start a robotics club", "apply to summer programs"):
  // with Pipeline V2 on there's no separate New project route to flag them.
  if (/\b(plan|prep|prepare|study for|get better|learn|improve|catch up|organi[sz]e|help me|figure out|finals?|midterms?|project|start|launch|found|build|apply|applications?|research|train|practice for|get into|compete|run for)\b/i.test(t)) {
    return true;
  }
  return t.split(/\s+/).length >= 14;
}

/** Up to three questions for the request, or [] to go straight ahead. Any
 *  failure also means "go straight ahead" — asking is never required. */
export async function clarifyQuestions(
  request: string,
  studentContext: string,
  opts: { askCapacity: boolean; projects?: { id: string; title: string }[] }
): Promise<ClarifyQuestion[]> {
  // A project it plausibly belongs to is asked about first, every time, so a
  // second "robotics club" project never quietly appears beside the first.
  const match = matchProject(request, opts.projects ?? []);
  const projectQuestion: ClarifyQuestion[] = match
    ? [{ id: `${PROJECT_QUESTION_PREFIX}${match.id}`, question: `Part of your “${match.title}” project?`, options: [PROJECT_YES, "Start a new one"] }]
    : [];

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
    return projectQuestion;
  }
  let parsed: { ask: boolean; questions: { question: string; options: string[] }[] };
  try {
    parsed = extractStructuredJson(result.message);
  } catch {
    return projectQuestion;
  }
  if (!parsed.ask) return projectQuestion;
  const questions: ClarifyQuestion[] = parsed.questions
    .filter((q) => q.question?.trim())
    .slice(0, 3 - projectQuestion.length)
    .map((q, i) => ({
      id: `q${i + 1}`,
      question: q.question.trim(),
      options: (q.options ?? []).map((o) => o.trim()).filter(Boolean).slice(0, 4),
    }));
  // Capacity only matters once there's real work to spread out.
  if (questions.length > 0 && opts.askCapacity && questions.length + projectQuestion.length < 3) questions.push(CAPACITY_QUESTION);
  return [...projectQuestion, ...questions];
}

const CAPTURE_SYSTEM = `You are TANGENT, a planner for high school students that knows them well. The student just captured something and Tangent ALREADY SAVED it as a task (shown below) — nothing is waiting on you. Your job is to ask 1 to 3 short follow-up questions they can answer later, whenever they want.

Every answer should make Tangent smarter: either it sharpens this task (when it's really due, how big it is, which class, what "done" looks like, the first concrete step) or it teaches Tangent something durable about the student (how they work, what they're aiming for).

Rules:
- Always ask at least one question. Never more than 3. Most useful first.
- Never ask something the context or the task already answers.
- Each under 12 words, plain and direct, like a sharp older friend.
- 2–4 tap answers each, under 4 words, specific to them (their classes, their deadlines).
- No yes/no questions about whether they want help. Don't number them.`;

/** Questions about a task that's already saved (captures, quick asks). The
 *  student answers whenever they like; answers refine the task. */
export async function captureQuestions(
  task: { title: string; date: string; time: string; notes?: string },
  request: string,
  studentContext: string
): Promise<ClarifyQuestion[]> {
  const result = await callClaude(
    "clarify",
    {
      system: CAPTURE_SYSTEM,
      messages: [
        {
          role: "user",
          content: `STUDENT CONTEXT:\n${studentContext}\n\nWHAT THEY SAID:\n${request}\n\nTHE TASK TANGENT SAVED:\n${task.title} — ${task.date} ${task.time}${task.notes ? `\nNotes: ${task.notes}` : ""}`,
        },
      ],
    },
    { format: { type: "json_schema", schema: SCHEMA } }
  );
  if (!result.ok) return [];
  try {
    const parsed = extractStructuredJson<{ questions: { question: string; options: string[] }[] }>(result.message);
    return parsed.questions
      .filter((q) => q.question?.trim())
      .slice(0, 3)
      .map((q, i) => ({
        id: `q${i + 1}`,
        question: q.question.trim(),
        options: (q.options ?? []).map((o) => o.trim()).filter(Boolean).slice(0, 4),
      }));
  } catch {
    return [];
  }
}

export { capacityFromAnswer } from "@/lib/capacity-answer";
