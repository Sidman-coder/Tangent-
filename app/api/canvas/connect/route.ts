import { NextResponse } from "next/server";
import { fetchAndValidateIcs, syncCanvasFeed } from "@/lib/canvas-ics";
import { getCanvasFeed, getCanvasFeedStatus, saveCanvasFeed, recordCanvasSync } from "@/lib/store";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const feed = await saveCanvasFeed(icsUrl);
    const result = await syncCanvasFeed(icsUrl);
    await recordCanvasSync(result.total);

    // The feed URL is a secret; only the masked status goes back to the browser.
    return NextResponse.json({ ok: true, ...result, feed: await getCanvasFeedStatus() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/canvas/connect] POST error:", message);
    return NextResponse.json({ ok: false, error: "Canvas could not be connected. Check the link and try again." }, { status: 500 });
  }
});

/** Re-syncs the already-connected feed on demand. */
export const GET = withUser(async () => {
  try {
    const feed = await getCanvasFeed();
    if (!feed) {
      return NextResponse.json({ ok: false, error: "Canvas isn't connected yet." }, { status: 400 });
    }

    const result = await syncCanvasFeed(feed.icsUrl);
    await recordCanvasSync(result.total);

    // The feed URL is a secret; only the masked status goes back to the browser.
    return NextResponse.json({ ok: true, ...result, feed: await getCanvasFeedStatus() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/canvas/connect] GET error:", message);
    return NextResponse.json({ ok: false, error: "Couldn't re-sync your Canvas feed right now." }, { status: 500 });
  }
});
