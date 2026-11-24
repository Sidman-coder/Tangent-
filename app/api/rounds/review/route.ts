import { NextResponse } from "next/server";
import { withUser } from "@/lib/request-context";
import { addContextEntry, getAllTasks, getPlanById } from "@/lib/store";
import { studentNow } from "@/lib/spacing";
import { readPlanReviewCodes } from "@/lib/student/step-events";
import { roundOf, roundSteps } from "@/lib/rounds";
import { callClaude } from "@/lib/ai/call";
import { extractStructuredJson } from "@/lib/anthropic-json";
import { answerFacts, factLines, readQuestions, roundFacts, type ReviewAnswer } from "@/lib/round-review";

// Round 5A Phase 5: the end-of-round review sheet. GET returns 3 to 5
// questions written from what happened (dates, moves, check-in codes; never
// the student's notes), the last always "When should round N start?". POST
// keeps the answers as project facts, through the usual sensitive filter.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, chips: { type: "array", items: { type: "string" } } },
        required: ["text", "chips"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

const SYSTEM = `A high school student just finished a round (about a week) of steps toward a goal. Write 2 to 4 short questions that will change how the next round is planned.

- Each question points at something that actually happened in the data: a step that ran late, steps that got moved, check-ins that said "struggled" or "took longer", a step not done. Name the step when it helps.
- One question per thing. Plain words, under 20 words each. No "How did you feel" questions, nothing about health, mood, family or anything private.
- Give each question 2 to 4 answer chips, 1 to 4 words each, that cover the likely answers.
- Don't ask when the next round should start; that question comes separately.`;

async function load(planId: string) {
  const plan = await getPlanById(planId);
  const round = plan ? roundOf(plan.description) : null;
  if (!plan || !round) return null;
  const [tasks, now] = await Promise.all([getAllTasks(), studentNow()]);
  const steps = roundSteps(tasks.filter((t) => t.planId === planId), round).map((t) => ({
    id: t.id,
    title: t.title,
    date: t.date,
    completed: t.completed,
    completedAt: t.completedAt ?? null,
  }));
  const codes = await readPlanReviewCodes(planId, round.startedOn);
  return { plan, round, today: now.date, facts: roundFacts(steps, codes, round, now.date) };
}

export const GET = withUser(async (request: Request) => {
  const planId = new URL(request.url).searchParams.get("projectId") ?? "";
  const r = await load(planId);
  if (!r) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  const lines = factLines(r.facts);
  let raw: unknown = null;
  const result = await callClaude(
    "roundReview",
    {
      system: SYSTEM,
      messages: [{ role: "user", content: `Project: ${r.plan.title}\nRound ${r.round.n}, started ${r.round.startedOn}.\n${lines.join("\n")}` }],
    },
    { format: { type: "json_schema", schema: SCHEMA } }
  );
  if (result.ok) {
    try {
      raw = extractStructuredJson(result.message);
    } catch {
      raw = null;
    }
  }
  // Too few good questions (or no AI): the data-based ones.
  const questions = readQuestions(raw, r.facts);
  return NextResponse.json({ ok: true, round: r.round, next: r.facts.next, today: r.today, facts: r.facts, lines, questions });
});

export const POST = withUser(async (request: Request) => {
  const body = (await request.json().catch(() => ({}))) as { projectId?: unknown; answers?: unknown };
  const planId = typeof body.projectId === "string" ? body.projectId : "";
  const plan = await getPlanById(planId);
  const round = plan ? roundOf(plan.description) : null;
  if (!plan || !round) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  const answers: ReviewAnswer[] = (Array.isArray(body.answers) ? body.answers : [])
    .slice(0, 6)
    .filter((a): a is ReviewAnswer => !!a && typeof (a as ReviewAnswer).questionId === "string" && typeof (a as ReviewAnswer).question === "string")
    .map((a) => ({
      questionId: a.questionId,
      question: a.question,
      chip: typeof a.chip === "string" ? a.chip : undefined,
      text: typeof a.text === "string" ? a.text : undefined,
    }));
  let saved = 0;
  for (const fact of answerFacts(answers, plan.title, round.n)) {
    const entry = await addContextEntry({ category: "work", fact, source: "manual", factSource: "said", factCategory: "how_you_work", projectId: planId });
    if (entry) saved++;
  }
  return NextResponse.json({ ok: true, saved });
});
