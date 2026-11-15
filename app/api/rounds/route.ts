import { NextResponse } from "next/server";
import { withUser } from "@/lib/request-context";
import { getAllTasks, getChangeSet, getPlanById, saveChangeSet, updatePlan } from "@/lib/store";
import { studentNow } from "@/lib/spacing";
import { readPlanStepCodes } from "@/lib/student/step-events";
import { checkInsFromCodes, reviewDue, roundOf, roundSteps, roundSummary, withRound } from "@/lib/rounds";
import { splitProjectNotes } from "@/lib/project-notes";
import { handleVoiceText } from "@/lib/voice-handler";
import { trackEvent } from "@/lib/analytics";
import { previewFor } from "@/lib/pipeline/drafting";
import { answerFacts, shiftRound, withRoundOp, type ReviewAnswer } from "@/lib/round-review";

// Round 4 §3.4: the round review. GET says whether a project's round is ready
// for review and how it went (from step event codes only, never the student's
// words). POST "propose" drafts the next round through the usual preview, so
// nothing is written until the student confirms; POST "advance" moves the
// project's round line on once they have.
//
// Round 5A Phase 5: "propose" puts the round line update in the same draft as
// the steps (an update_plan op), so confirm moves the round on and undo moves
// it back. "schedule" moves that draft to the start date the student picked.
// "advance" stays for a draft without the line op (a very long description).

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
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; projectId?: unknown; changeSetId?: unknown; startDate?: unknown; answers?: unknown };
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
    // The review sheet's answers, through the same filter as every fact.
    const answers = (Array.isArray(body.answers) ? body.answers : []).slice(0, 6).filter(
      (a): a is ReviewAnswer => !!a && typeof (a as ReviewAnswer).questionId === "string" && typeof (a as ReviewAnswer).question === "string"
    );
    const said = answerFacts(answers, r.plan.title, r.round.n);
    const context = `How round ${r.round.n} went: ${r.summary}${said.length ? ` What the student said in the review: ${said.join(" ")}` : ""} Plan the next week only: 3 to 7 steps that build on what's done, sized to how it went.`;
    const extraOps = withRoundOp([], planId, r.plan.description, { n: r.next, startedOn: r.today }) ?? undefined;
    return handleVoiceText(text, { forcePlan: true, preview: true, source: "typed", projectId: planId, context, extraOps });
  }

  if (body.action === "schedule") {
    const id = typeof body.changeSetId === "string" ? body.changeSetId : "";
    const start = typeof body.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate) ? body.startDate : "";
    if (!id || !start) return NextResponse.json({ ok: false, error: "Missing draft or date" }, { status: 400 });
    if (start < r.today) return NextResponse.json({ ok: false, error: "Pick today or later" }, { status: 400 });
    const cs = await getChangeSet(id);
    // Only this project's own draft: every op must point at it.
    const ours = cs?.ops.every((o) => ("plan_id" in o ? o.plan_id === planId : false));
    if (!cs || cs.status !== "draft" || !ours) return NextResponse.json({ ok: false, error: "Draft not found" }, { status: 404 });
    const saved = await saveChangeSet({ ...cs, ops: shiftRound(cs.ops, start) });
    return NextResponse.json({ ok: true, changeSet: saved, preview: await previewFor(saved, r.today), hasRoundOp: saved.ops.some((o) => o.op === "update_plan") });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
});
