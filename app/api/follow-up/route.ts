import { NextResponse } from "next/server";
import { addContextEntry, confirmContextEntry, getUserContext, removeContextEntry } from "@/lib/store";
import { withUser } from "@/lib/request-context";
import { followUpById, pickFollowUp, replyFor } from "@/lib/student/follow-ups";
import { legacyCategoryOf } from "@/lib/student/facts";
import { DISTRESS_REPLY } from "@/lib/student/sensitive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The daily follow-up bubble (Round 4 Phase 6): one deeper question, picked
// from what Tangent knows least well (lib/student/follow-ups.ts).

/** GET ?asked=id,id → the next question, or null when there's nothing to ask. */
export const GET = withUser(async (request: Request) => {
  try {
    const asked = (new URL(request.url).searchParams.get("asked") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);
    const { entries } = await getUserContext();
    return NextResponse.json({ ok: true, followUp: pickFollowUp(entries, asked) });
  } catch (e) {
    console.error("[api/follow-up] GET failed:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ ok: false, error: "Couldn't load a question" }, { status: 500 });
  }
});

/** POST {id, answer} → saves what the student typed as a fact they said. */
export const POST = withUser(async (request: Request) => {
  try {
    const body = (await request.json()) as { id?: unknown; answer?: unknown };
    const id = typeof body.id === "string" ? body.id.slice(0, 80) : "";
    const answer = typeof body.answer === "string" ? body.answer : "";
    const { entries } = await getUserContext();
    const followUp = followUpById(id, entries);
    if (!followUp) return NextResponse.json({ ok: false, error: "That question has moved on" }, { status: 404 });

    const reply = replyFor(followUp, answer);
    // Real distress: a kind reply, nothing saved, never a task.
    if (reply.kind === "distress") return NextResponse.json({ ok: true, saved: false, distress: DISTRESS_REPLY });
    if (reply.kind === "empty") return NextResponse.json({ ok: true, saved: false });
    if (reply.kind === "confirm") return NextResponse.json({ ok: true, saved: await confirmContextEntry(followUp.checkId ?? "") });
    if (reply.kind === "reject") return NextResponse.json({ ok: true, saved: await removeContextEntry(followUp.checkId ?? "") });

    const entry = await addContextEntry({
      category: legacyCategoryOf(followUp.factCategory),
      factCategory: followUp.factCategory,
      fact: reply.fact,
      source: "manual",
      factSource: "said",
      // A correction to a guess replaces it; it isn't an answer to a slot.
      slotKey: followUp.checkId ? undefined : followUp.slotKey,
    });
    if (entry && followUp.checkId) await removeContextEntry(followUp.checkId);
    return NextResponse.json({ ok: true, saved: Boolean(entry) });
  } catch (e) {
    console.error("[api/follow-up] POST failed:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ ok: false, error: "Couldn't save that" }, { status: 500 });
  }
});
