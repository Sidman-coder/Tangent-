import { NextResponse } from "next/server";
import { addContextEntry, getUserContext, getContextAsString, removeContextEntry } from "@/lib/store";
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

    // "What Tangent knows" in Settings: the student adds a fact themselves.
    if (body.action === "remember") {
      const fact = String(body.fact ?? "").trim().slice(0, 300);
      if (!fact) return NextResponse.json({ ok: false, error: "fact is required" }, { status: 400 });
      const CATEGORIES = ["preference", "habit", "commitment", "goal", "person", "work", "general"] as const;
      const category = CATEGORIES.find((c) => c === body.category) ?? "general";
      const entry = await addContextEntry({ category, fact, source: "manual" });
      return NextResponse.json({ ok: true, entry });
    }
    if (body.action === "forget") {
      const removed = await removeContextEntry(String(body.id ?? ""));
      return NextResponse.json({ ok: removed }, { status: removed ? 200 : 404 });
    }
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
