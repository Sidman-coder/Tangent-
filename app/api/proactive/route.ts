import { NextResponse } from "next/server";
import { runProactiveCheck } from "@/lib/proactive";

export const dynamic = "force-dynamic";

// Called on page load (NotificationBell.tsx) so a visit refreshes proactive
// notifications immediately. app/api/cron/proactive/route.ts calls the same
// runProactiveCheck() on a schedule so these don't go stale between visits.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const trigger = body.trigger || "manual"; // 'manual', 'page_load', 'cron'
  const result = await runProactiveCheck(trigger);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
