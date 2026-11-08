import { NextResponse } from "next/server";
import { withUser } from "@/lib/request-context";
import { getAllTasks, getPlanById, updatePlan } from "@/lib/store";
import { studentNow } from "@/lib/spacing";
import { readPlanStepCodes } from "@/lib/student/step-events";
import { checkInsFromCodes, reviewDue, roundOf, roundSteps, roundSummary, withRound } from "@/lib/rounds";
import { splitProjectNotes } from "@/lib/project-notes";
import { handleVoiceText } from "@/lib/voice-handler";
import { trackEvent } from "@/lib/analytics";

// Round 4 §3.4: the round review. GET says whether a project's round is ready
// for review and how it went (from step event codes only, never the student's
// words). POST "propose" drafts the next round through the usual preview, so
// nothing is written until the student confirms; POST "advance" moves the
// project's round line on once they have.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function review(planId: string) {
  const plan = await getPlanById(planId);
  if (!plan) return null;
  const round = roundOf(plan.description);
  const [tasks, now] = await Promise.all([getAllTasks(), studentNow()]);
  const steps = roundSteps(tasks.filter((t) => t.planId === planId), round);
  const done = steps.filter((t) => t.completed).length;
  const due = reviewDue(steps, round, now.date);
  const codes = round && due ? await readPlanStepCodes(planId, round.startedOn) : [];
  const { checkIns, notToday } = checkInsFromCodes(codes);
  const next = (round?.n ?? 1) + 1;
  return {
    plan,
    round,
    today: now.date,
    due,
    done,
    total: steps.length,
    next,
    summary: round ? roundSummary(done, steps.length, checkIns, notToday, next) : "",
  };
}

export const GET = withUser(async (request: Request) => {
  const planId = new URL(request.url).searchParams.get("projectId") ?? "";
  const r = await review(planId);
  if (!r) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  return NextResponse.json({ ok: true, due: r.due, round: r.round, done: r.done, total: r.total, next: r.next, summary: r.summary });
});

export const POST = withUser(async (request: Request) => {
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; projectId?: unknown };
  const planId = typeof body.projectId === "string" ? body.projectId : "";
  const r = await review(planId);
  if (!r || !r.round) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });

  if (body.action === "advance") {
    const description = withRound(r.plan.description, { n: r.next, startedOn: r.today });
    await updatePlan(planId, { description });
    trackEvent("round_reviewed", { count: r.next });
    return NextResponse.json({ ok: true, round: { n: r.next, startedOn: r.today } });
  }

  if (body.action === "propose") {
    const goal = splitProjectNotes(r.plan.description).goal || r.plan.title;
    const text = `Plan round ${r.next} of my "${r.plan.title}" project. Goal: ${goal.slice(0, 300)}`;
    const context = `How round ${r.round.n} went: ${r.summary} Plan the next week only: 3 to 7 steps that build on what's done, sized to how it went.`;
    return handleVoiceText(text, { forcePlan: true, preview: true, source: "typed", projectId: planId, context });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
});
