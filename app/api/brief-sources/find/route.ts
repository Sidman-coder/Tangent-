import { NextResponse } from "next/server";
import { findSuggestedSources } from "@/lib/brief-sources";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withUser(async (req: Request) => {
  try {
    const body = (await req.json()) as { query?: string };
    if (!body.query || !body.query.trim()) {
      return NextResponse.json({ ok: false, error: "Missing query" }, { status: 400 });
    }
    const suggestions = await findSuggestedSources(body.query);
    return NextResponse.json({ ok: true, suggestions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
});
