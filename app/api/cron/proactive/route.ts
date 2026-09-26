import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runProactiveCheck } from "@/lib/proactive";
import { pollPendingBriefBatch } from "@/lib/daily-brief";
import { forEachWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";
// Now loops over every workspace.
export const maxDuration = 60;

// Scheduled in vercel.json. Runs proactive-notification generation on a fixed
// cadence so overdue-task and reschedule-offer notifications don't go stale for
// days if the student never happens to load a page (the only other trigger for
// this check — see app/api/proactive/route.ts).
//
// Also opportunistically polls for a pending Daily Brief batch (see
// app/api/cron/daily-brief/route.ts). That route only runs once a day, so without
// this, a batch submitted in the morning wouldn't get turned into a notification
// until the following day's tick. This route runs more often, so it acts as the
// poller that finalizes it the same day it was submitted.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  // Every workspace gets its own check: a cron request carries no cookie, so
  // there is no single workspace for it to act on any more.
  const runs = await forEachWorkspace(async () => {
    const proactive = await runProactiveCheck("cron");
    const briefPoll = await pollPendingBriefBatch();
    return { proactive, briefPoll };
  });
  const failed = runs.filter((r) => r.error).length;
  return NextResponse.json(
    { ok: failed === 0, workspaces: runs.length, failed, runs },
    { status: failed === 0 ? 200 : 500 }
  );
}
