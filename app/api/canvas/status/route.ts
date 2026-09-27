import { NextResponse } from "next/server";
import { getCanvasFeedStatus } from "@/lib/store";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether Canvas is connected, with the feed URL masked (it's a secret). */
export const GET = withUser(async () => {
  return NextResponse.json({ ok: true, feed: await getCanvasFeedStatus() });
});
