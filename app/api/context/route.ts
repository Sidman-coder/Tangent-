import { NextResponse } from "next/server";
import { getUserContext, getContextAsString } from "@/lib/store";
import { extractContextFacts } from "@/lib/context-extract";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Extracts and compresses remembered context.
export const maxDuration = 60;

export const GET = withUser(async () => {
  return NextResponse.json({
    context: await getUserContext(),
    contextString: await getContextAsString(),
  });
});

export const POST = withUser(async (request: Request) => {
  try {
    const body = await request.json();

    if (body.action === "extract") {
      const added = await extractContextFacts(String(body.conversation ?? ""), body.source || "chat");
      return NextResponse.json({ ok: true, added: added.length, entries: added });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/context] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
});
