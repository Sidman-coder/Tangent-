import { NextResponse } from "next/server";
import { addContextEntry, confirmContextEntry, getAllTasks, getUserContext, getUserTimezone, removeContextEntry, updateTask } from "@/lib/store";
import { withUser } from "@/lib/request-context";
import { followUpById, pickFollowUp, replyFor } from "@/lib/student/follow-ups";
import { recentStepFollowUp, stepFollowUpReply, stepFollowUpTaskId } from "@/lib/student/step-follow-up";
import { checkedInTaskIds, logStepEvents } from "@/lib/student/step-events";
import { reportFeel } from "@/lib/progress-report";
import { legacyCategoryOf } from "@/lib/student/facts";
import { DISTRESS_REPLY } from "@/lib/student/sensitive";
import { trackEvent } from "@/lib/analytics";
import { addDaysYMD, localNow } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The daily follow-up bubble (Round 4 Phase 6): one deeper question, picked
// from what Tangent knows least well (lib/student/follow-ups.ts).
// Overnight 2 Phase 3: first, how a plan step from the last 1–2 days went
// (lib/student/step-follow-up.ts).

/** GET ?asked=id,id → the next question, or null when there's nothing to ask. */
export const GET = withUser(async (request: Request) => {
  try {
    const asked = (new URL(request.url).searchParams.get("asked") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);
    const today = localNow(await getUserTimezone()).date;
    const [tasks, checked] = await Promise.all([getAllTasks().catch(() => []), checkedInTaskIds()]);
    const recent = recentStepFollowUp(tasks, today, asked, checked);
    if (recent) return NextResponse.json({ ok: true, followUp: recent });
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
    const stepId = stepFollowUpTaskId(id);
    if (stepId) return answerStep(stepId, answer);
    const { entries } = await getUserContext();
    const followUp = followUpById(id, entries);
    if (!followUp) return NextResponse.json({ ok: false, error: "That question has moved on" }, { status: 404 });

    const reply = replyFor(followUp, answer);
    // Real distress: a kind reply, nothing saved, never a task.
    if (reply.kind === "distress") return NextResponse.json({ ok: true, saved: false, distress: DISTRESS_REPLY });
    // Health, mental-health or family details: a kind word, never stored.
    if (reply.kind === "sensitive") return NextResponse.json({ ok: true, saved: false, sensitive: true });
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

/** "How did X go?": logged like the check-in sheet (app/api/today "check_in"). Never a fact, never a task. */
async function answerStep(taskId: string, answer: string) {
  const today = localNow(await getUserTimezone()).date;
  const task = (await getAllTasks()).find((t) => t.id === taskId);
  // Only a finished step from the last two days; anything else has moved on.
  if (!task || !task.completed || task.date < addDaysYMD(today, -2) || task.date >= today) {
    return NextResponse.json({ ok: false, error: "That question has moved on" }, { status: 404 });
  }
  const reply = replyFor({ lead: "" }, answer);
  if (reply.kind === "distress") return NextResponse.json({ ok: true, saved: false, distress: DISTRESS_REPLY });
  if (reply.kind === "empty") return NextResponse.json({ ok: true, saved: false });
  const code = reportFeel(answer);
  if (code) logStepEvents([{ kind: "check_in", task, code }]);
  // Teen privacy: health, family or distress never get written down; the feel code alone is kept.
  const words = reply.kind === "fact" ? reply.fact.slice(0, 280) : "";
  if (words) {
    const kept = (task.notes ?? "").replace(/(?:^|\n)\s*HOW IT WENT:[^\n]*/gi, "").trim();
    await updateTask(task.id, { notes: [kept, `HOW IT WENT: ${words}`].filter(Boolean).join("\n") });
  }
  trackEvent("step_check_in", { task_id: task.id, count: code ? 1 : 0 });
  if (reply.kind === "sensitive") return NextResponse.json({ ok: true, saved: Boolean(code), sensitive: true });
  return NextResponse.json({ ok: true, saved: true, reply: stepFollowUpReply(task.title, Boolean(words)) });
}
