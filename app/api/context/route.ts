import { NextResponse } from "next/server";
import { addContextEntry, getUserContext, getContextAsString, removeContextEntry } from "@/lib/store";
import { extractContextFacts } from "@/lib/context-extract";
import { factsFromText } from "@/lib/ai/import-context";
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
    // "Bring your context": preview facts from pasted text; nothing is saved.
    if (body.action === "import_preview") {
      const text = String(body.text ?? "").trim().slice(0, 80000);
      if (text.length < 20) return NextResponse.json({ ok: false, error: "Paste a bit more than that." }, { status: 400 });
      const facts = await factsFromText(text);
      return NextResponse.json({ ok: true, facts });
    }
    // …then save the ones the student kept.
    if (body.action === "remember_many") {
      const CATS = ["preference", "habit", "commitment", "goal", "person", "work", "general"] as const;
      const items = (Array.isArray(body.facts) ? body.facts : []).slice(0, 60) as { category?: string; fact?: string }[];
      let saved = 0;
      for (const f of items) {
        const fact = String(f.fact ?? "").trim().slice(0, 300);
        if (!fact) continue;
        await addContextEntry({ category: CATS.find((c) => c === f.category) ?? "general", fact, source: "manual" });
        saved++;
      }
      return NextResponse.json({ ok: true, saved });
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
