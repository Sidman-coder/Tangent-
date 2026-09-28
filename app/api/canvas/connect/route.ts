import { NextResponse } from "next/server";
import { fetchAndValidateIcs, syncCanvasFeed } from "@/lib/canvas-ics";
import { CanvasFeedError } from "@/lib/canvas-feed-security";
import { getCanvasFeed, getCanvasFeedStatus, saveCanvasFeed, recordCanvasSync } from "@/lib/store";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Fetches and parses a full Canvas .ics feed.
export const maxDuration = 60;

// Due times are converted into the student's own timezone (profiles.timezone),
// so a `timeZone` the browser sends is not needed here and is ignored.
export const POST = withUser(async (req: Request) => {
  try {
    const body = (await req.json()) as { icsUrl?: string };
    const icsUrl = body.icsUrl?.trim();
    if (!icsUrl) {
      return NextResponse.json({ ok: false, error: "Paste your Canvas calendar feed link before connecting." }, { status: 400 });
    }

    const validation = await fetchAndValidateIcs(icsUrl);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }

    // Store the normalized link (webcal:// → https://); import from the text already fetched.
    await saveCanvasFeed(validation.url);
    const result = await syncCanvasFeed(validation.url, { icsText: validation.icsText });
    await recordCanvasSync(result.total);

    // The feed URL is a secret; only the masked status goes back to the browser.
    return NextResponse.json({ ok: true, ...result, feed: await getCanvasFeedStatus() });
  } catch (e) {
    // Log the error kind only: messages from lower layers could echo the link.
    console.error("[api/canvas/connect] POST error:", e instanceof Error ? e.name : "error");
    return NextResponse.json({ ok: false, error: "Canvas could not be connected. Check the link and try again." }, { status: 500 });
  }
});

/**
 * Re-syncs the already-connected feed.
 *
 * `?ifStale=<hours>` makes it a no-op when the feed was synced recently, so the
 * app can call this on every load without hammering Canvas. Without it, the
 * feed only ever updated when someone pressed a button, which meant it went
 * stale the moment it was connected and new assignments never arrived.
 */
export const GET = withUser(async (req: Request) => {
  try {
    const ifStale = Number(new URL(req.url).searchParams.get("ifStale"));
    const onLoad = Number.isFinite(ifStale) && ifStale > 0;
    const feed = await getCanvasFeed();
    if (!feed) {
      // The on-load nudge runs for everyone; most people never connect Canvas.
      // For them there is nothing to do, which is not an error.
      if (onLoad) return NextResponse.json({ ok: true, skipped: true, connected: false });
      return NextResponse.json({ ok: false, error: "Canvas isn't connected yet." }, { status: 400 });
    }

    if (onLoad && feed.lastSyncedAt) {
      const age = Date.now() - new Date(feed.lastSyncedAt).getTime();
      if (age < ifStale * 3600_000) {
        return NextResponse.json({ ok: true, skipped: true, lastSyncedAt: feed.lastSyncedAt });
      }
    }

    const result = await syncCanvasFeed(feed.icsUrl);
    await recordCanvasSync(result.total);

    // The feed URL is a secret; only the masked status goes back to the browser.
    const status = await getCanvasFeedStatus();
    return NextResponse.json({ ok: true, ...result, lastSyncedAt: status?.lastSyncedAt ?? null, feed: status });
  } catch (e) {
    if (e instanceof CanvasFeedError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    console.error("[api/canvas/connect] GET error:", e instanceof Error ? e.name : "error");
    return NextResponse.json({ ok: false, error: "Couldn't re-sync your Canvas feed right now." }, { status: 500 });
  }
});

/** Reports the connection without touching Canvas, for the Settings panel. */
export const HEAD = withUser(async () => {
  return new Response(null, { status: (await getCanvasFeed()) ? 204 : 404 });
});
