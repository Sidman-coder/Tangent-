import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { pollPendingBriefBatch, submitDailyBriefBatch } from "@/lib/daily-brief";
import { forEachCronUser } from "@/lib/cron-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Loops over every student.
export const maxDuration = 60;

// Scheduled in vercel.json (once daily). Runs once per student (forEachCronUser),
// each with their own tasks, context, brief config and pending batch. This is the real "Daily Brief" feature —
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
// app/api/cron/proactive/route.ts also calls pollPendingBriefBatch(). It runs
// daily at 15:00 UTC, three hours after this route (12:00 UTC), so a batch
// submitted here is usually finalized into a notification the same day.
//
// To test manually (CRON_SECRET must be set; requests without
// `Authorization: Bearer $CRON_SECRET` get 401): GET this route once to submit a
// batch, then GET it again later (or GET /api/cron/proactive, which polls too)
// once the batch has finished — check status at https://console.anthropic.com or
// just retry after a few minutes.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await forEachCronUser("daily-brief", async () => {
      const pollResult = await pollPendingBriefBatch();

      if (pollResult.checked && !pollResult.finalized) {
        // Either still processing, or the check itself failed — either way, don't
        // submit a second batch on top of one that might still resolve.
        return { phase: "pending" as const, ...pollResult };
      }

      const submission = await submitDailyBriefBatch();
      return {
        phase: "submitted" as const,
        ...submission,
        finalizedFromPreviousTick: pollResult.finalized ? pollResult.notification : undefined,
      };
    });
    return NextResponse.json({ ok: results.every((r) => r.ok), students: results.length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/cron/daily-brief] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
