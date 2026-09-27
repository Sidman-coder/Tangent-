import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { importCutoff, syncCanvasFeed } from "@/lib/canvas-ics";
import { getCanvasFeed, recordCanvasSync } from "@/lib/store";
import { forEachWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";
// Fetches and parses a full .ics per workspace.
export const maxDuration = 60;

// Keeps connected Canvas feeds current.
//
// Without this, a feed was only ever read when someone pressed a button, so it
// went stale the moment it was connected and new assignments never appeared.
// Scheduled in vercel.json; the app also nudges a re-sync on load when the feed
// is more than a few hours old, so this is the floor, not the only path.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const runs = await forEachWorkspace(async () => {
    const feed = getCanvasFeed();
    if (!feed) return { connected: false as const };
    const result = await syncCanvasFeed(feed.icsUrl, importCutoff());
    recordCanvasSync(result.total);
    return { connected: true as const, ...result };
  });

  const failed = runs.filter((r) => r.error).length;
  return NextResponse.json(
    { ok: failed === 0, workspaces: runs.length, failed, runs },
    { status: failed === 0 ? 200 : 500 }
  );
}
