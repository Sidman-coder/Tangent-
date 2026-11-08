import { NextResponse } from "next/server";
import { withUser } from "@/lib/request-context";
import { logEvent } from "@/lib/pipeline/events";
import { CLIENT_EVENT_TYPES } from "@/lib/pipeline/event-types";

// Master fix Phase 4: the chat's own events (thumbs, retry, edit, stop, new
// topic). Only the client allowlist is accepted; props are sanitized to
// tokens by logEvent, so no message text is ever stored.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withUser(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { type?: unknown; props?: unknown };
  const type = CLIENT_EVENT_TYPES.find((t) => t === body.type);
  if (!type) return NextResponse.json({ ok: false, error: "Unknown event" }, { status: 400 });
  const props = body.props && typeof body.props === "object" && !Array.isArray(body.props) ? (body.props as Record<string, never>) : {};
  logEvent(type, props);
  return NextResponse.json({ ok: true });
});
