import { NextResponse } from "next/server";
import { DEFAULT_TIME_ZONE, fetchAndValidateIcs, importCutoff, isValidTimeZone, normalizeFeedUrl, syncCanvasFeed } from "@/lib/canvas-ics";
import { getCanvasFeed, saveCanvasFeed, recordCanvasSync, setCanvasTimeZone } from "@/lib/store";
import { withWorkspaceRoute } from "@/lib/with-workspace";

export const dynamic = "force-dynamic";
// Fetches and parses a full Canvas .ics feed.
export const maxDuration = 60;

async function POSTHandler(req: Request) {
  try {
    const body = (await req.json()) as { icsUrl?: string; timeZone?: string };
    const icsUrl = body.icsUrl ? normalizeFeedUrl(body.icsUrl) : "";
    const timeZone = isValidTimeZone(body.timeZone) ? body.timeZone : DEFAULT_TIME_ZONE;
    if (!icsUrl) {
      return NextResponse.json({ ok: false, error: "Paste your Canvas calendar feed link before connecting." }, { status: 400 });
    }

    const validation = await fetchAndValidateIcs(icsUrl);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }

    saveCanvasFeed(icsUrl, timeZone);
    const result = await syncCanvasFeed(icsUrl, importCutoff(), validation.icsText, timeZone);
    recordCanvasSync(result.total);

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/canvas/connect] POST error:", message);
    return NextResponse.json({ ok: false, error: "Canvas could not be connected. Check the link and try again." }, { status: 500 });
  }
}

/**
 * Re-syncs the already-connected feed.
 *
 * `?ifStale=<hours>` makes it a no-op when the feed was synced recently, so the
 * app can call this on every load without hammering Canvas. Without it, the
 * feed only ever updated when someone pressed a button, which meant it went
 * stale the moment it was connected and new assignments never arrived.
 */
async function GETHandler(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const reportedZone = params.get("tz");
    // A feed connected before zones were recorded has every due time shifted
    // to UTC. The first time a browser reports its zone, re-sync at once
    // rather than waiting out the cooldown, so those tasks get corrected.
    const zoneJustLearned = isValidTimeZone(reportedZone) && setCanvasTimeZone(reportedZone);
    const feed = getCanvasFeed();
    const ifStale = Number(params.get("ifStale"));
    if (!feed) {
      // The on-load nudge runs for everyone; most people never connect Canvas.
      // For them there is nothing to do, which is not an error, and answering
      // 400 put a red line in the console on every single page load.
      if (Number.isFinite(ifStale) && ifStale > 0) {
        return NextResponse.json({ ok: true, skipped: true, connected: false });
      }
      return NextResponse.json({ ok: false, error: "Canvas isn't connected yet." }, { status: 400 });
    }

    if (!zoneJustLearned && Number.isFinite(ifStale) && ifStale > 0 && feed.lastSyncedAt) {
      const age = Date.now() - new Date(feed.lastSyncedAt).getTime();
      if (age < ifStale * 3600_000) {
        return NextResponse.json({ ok: true, skipped: true, lastSyncedAt: feed.lastSyncedAt });
      }
    }

    const result = await syncCanvasFeed(feed.icsUrl, importCutoff(), undefined, feed.timeZone ?? DEFAULT_TIME_ZONE);
    const updated = recordCanvasSync(result.total);

    return NextResponse.json({ ok: true, ...result, lastSyncedAt: updated?.lastSyncedAt ?? null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/canvas/connect] GET error:", message);
    return NextResponse.json({ ok: false, error: "Couldn't re-sync your Canvas feed right now." }, { status: 500 });
  }
}

/** Reports the connection without touching Canvas, for the Settings panel. */
async function HEADHandler() {
  return new Response(null, { status: getCanvasFeed() ? 204 : 404 });
}

// Runs against the caller's own workspace, loaded and saved around the request.
export const POST = withWorkspaceRoute(POSTHandler);
export const GET = withWorkspaceRoute(GETHandler);
export const HEAD = withWorkspaceRoute(HEADHandler);
