import { NextResponse } from "next/server";
import { fetchAndValidateIcs, syncCanvasFeed } from "@/lib/canvas-ics";
import { getCanvasFeed, saveCanvasFeed, recordCanvasSync } from "@/lib/store";
import { withWorkspaceRoute } from "@/lib/with-workspace";

export const dynamic = "force-dynamic";
// Fetches and parses a full Canvas .ics feed.
export const maxDuration = 60;

async function POSTHandler(req: Request) {
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

    const feed = saveCanvasFeed(icsUrl);
    const result = await syncCanvasFeed(icsUrl, feed.connectedAt, validation.icsText);
    recordCanvasSync(result.total);

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/canvas/connect] POST error:", message);
    return NextResponse.json({ ok: false, error: "Canvas could not be connected. Check the link and try again." }, { status: 500 });
  }
}

/** Re-syncs the already-connected feed on demand. */
async function GETHandler() {
  try {
    const feed = getCanvasFeed();
    if (!feed) {
      return NextResponse.json({ ok: false, error: "Canvas isn't connected yet." }, { status: 400 });
    }

    const result = await syncCanvasFeed(feed.icsUrl, feed.connectedAt);
    recordCanvasSync(result.total);

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/canvas/connect] GET error:", message);
    return NextResponse.json({ ok: false, error: "Couldn't re-sync your Canvas feed right now." }, { status: 500 });
  }
}

// Runs against the caller's own workspace, loaded and saved around the request.
export const POST = withWorkspaceRoute(POSTHandler);
export const GET = withWorkspaceRoute(GETHandler);
