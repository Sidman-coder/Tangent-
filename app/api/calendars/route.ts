import { NextResponse } from "next/server";
import { addCalendar, getAppState } from "@/lib/store";
import { withWorkspaceRoute } from "@/lib/with-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** POST — creates a new calendar */
async function POSTHandler(req: Request) {
  const body = (await req.json()) as { name?: string; color?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  }
  const calendar = addCalendar(body.name.trim(), body.color);
  return NextResponse.json({ ok: true, calendar, state: getAppState() });
}

// Runs against the caller's own workspace, loaded and saved around the request.
export const POST = withWorkspaceRoute(POSTHandler);
