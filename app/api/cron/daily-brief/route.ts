import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { pollPendingBriefBatch, submitDailyBriefBatch } from "@/lib/daily-brief";

export const dynamic = "force-dynamic";

// Scheduled in vercel.json (once daily). This is the real "Daily Brief" feature —
// it aggregates the student's saved brief-sources config (RSS feeds, manual URLs,
// stale-task checks; see the "Brief" tab in the AI console and lib/brief-sources.ts)
// and publishes the same pinned daily_brief notification the on-demand "Today's
// Summary" button produces, via lib/daily-brief.ts's shared publishDailyBrief().
//
// Generation runs through the Anthropic Batch API (submitDailyBriefBatch), not a
// synchronous call — a scheduled overnight job is exactly Batch's use case (cheaper,
// and its up-to-an-hour-ish turnaround is irrelevant when nothing is waiting on it).
// A Vercel Function can't stay alive for that long, so this route can't submit and
// wait in one request. Instead:
//   1. If a batch from a previous tick is pending, try to finalize it first — this
//      also makes manual testing straightforward (see below).
//   2. If nothing is pending afterward, submit a fresh batch for today.
// app/api/cron/proactive/route.ts also calls pollPendingBriefBatch() on its more
// frequent schedule, so a submitted batch is typically finalized into a real
// notification within hours, not a full day later.
//
// To test manually: GET this route once to submit a batch, then GET it again later
// (or GET /api/cron/proactive, which polls too) once the batch has finished — check
// status at https://console.anthropic.com or just retry after a few minutes.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pollResult = await pollPendingBriefBatch();

    if (pollResult.checked && !pollResult.finalized) {
      // Either still processing, or the check itself failed — either way, don't
      // submit a second batch on top of one that might still resolve.
      return NextResponse.json({ ok: true, phase: "pending", ...pollResult });
    }

    const submission = await submitDailyBriefBatch();
    return NextResponse.json({
      ok: true,
      phase: "submitted",
      ...submission,
      finalizedFromPreviousTick: pollResult.finalized ? pollResult.notification : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/cron/daily-brief] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
