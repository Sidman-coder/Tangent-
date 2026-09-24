import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runProactiveCheck } from "@/lib/proactive";
import { pollPendingBriefBatch } from "@/lib/daily-brief";

export const dynamic = "force-dynamic";

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
  const proactive = await runProactiveCheck("cron");
  const briefPoll = await pollPendingBriefBatch();
  return NextResponse.json({ ...proactive, briefPoll }, { status: proactive.ok ? 200 : 500 });
}
