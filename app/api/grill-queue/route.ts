import { NextResponse } from "next/server";
import { withUser } from "@/lib/request-context";
import { trackEvent } from "@/lib/analytics";
import { answerGrillQuestion, getGrillQuestions, seedGrillQuestions, skipGrillQuestion } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: the student's whole queue; the surfaces pick what to show from it. */
export const GET = withUser(async () => {
  return NextResponse.json({ ok: true, items: await getGrillQuestions() });
});

type Body =
  | { action: "seed"; planId: string; said?: string; asked?: number }
  | { action: "answer"; id: string; answer: string }
  | { action: "skip"; id: string };

/**
 * POST
 * - seed: a plan was just confirmed; queue the questions it earns.
 * - answer: save the answer to What Tangent knows, and say if it could change the plan.
 * - skip: not this one. It won't be asked about this project again.
 */
export const POST = withUser(async (req: Request) => {
  const body = (await req.json()) as Body;

  if (body.action === "seed") {
    const asked = typeof body.asked === "number" ? body.asked : 0;
    const said = String(body.said ?? "").slice(0, 1000);
    return NextResponse.json({ ok: true, items: await seedGrillQuestions(String(body.planId ?? ""), said, asked) });
  }
  if (body.action === "answer") {
    const answer = String(body.answer ?? "").trim().slice(0, 300);
    if (!answer) return NextResponse.json({ ok: false, error: "answer required" }, { status: 400 });
    const saved = await answerGrillQuestion(String(body.id ?? ""), answer);
    if (!saved) return NextResponse.json({ ok: false, error: "Question not found" }, { status: 404 });
    trackEvent("grill_answered", { count: 1, source: "queue" });
    return NextResponse.json({ ok: true, ...saved });
  }
  if (body.action === "skip") {
    await skipGrillQuestion(String(body.id ?? ""));
    trackEvent("grill_skipped", { count: 1, source: "queue" });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
});
