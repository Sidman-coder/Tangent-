import { NextResponse } from "next/server";
import { getCommitments, getState, getUserTimezone, replaceCommitments } from "@/lib/store";
import { withUser } from "@/lib/request-context";
import { MAX_COMMITMENTS, commitmentProblem, parseCommitment, parseCommitments } from "@/lib/commitments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: the student's commitments, read back from their busy blocks. */
export const GET = withUser(async () => {
  try {
    return NextResponse.json({ ok: true, commitments: await getCommitments() });
  } catch (e) {
    console.error("[api/commitments] GET error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Couldn't load your schedule." }, { status: 500 });
  }
});

/** PUT { commitments }: replaces every commitment and its busy blocks. */
export const PUT = withUser(async (req: Request) => {
  const body = (await req.json().catch(() => null)) as { commitments?: unknown } | null;
  const list = parseCommitments(body?.commitments);
  if (Array.isArray(body?.commitments) && body!.commitments.length > MAX_COMMITMENTS) {
    return NextResponse.json({ ok: false, error: "Too many commitments" }, { status: 400 });
  }
  // One that doesn't parse is rejected, not quietly dropped from the calendar.
  if (!list || list.length !== (body!.commitments as unknown[]).length) {
    return NextResponse.json({ ok: false, error: "Invalid commitments" }, { status: 400 });
  }
  try {
    await replaceCommitments(list, await getUserTimezone());
    return NextResponse.json({ ok: true, commitments: await getCommitments(), state: await getState() });
  } catch (e) {
    console.error("[api/commitments] PUT error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Couldn't save your schedule. Try again." }, { status: 500 });
  }
});

/** POST { add }: Round 6 (item 5), the student tapped Yes on "Add bakery shifts
 *  as busy time?". Appends one commitment to the ones saved, through the same
 *  replace path Settings → Schedule uses. Already covered → nothing changes. */
export const POST = withUser(async (req: Request) => {
  const body = (await req.json().catch(() => null)) as { add?: unknown } | null;
  const add = parseCommitment(body?.add);
  if (!add || commitmentProblem(add)) {
    return NextResponse.json({ ok: false, error: "Invalid commitment" }, { status: 400 });
  }
  try {
    const current = await getCommitments();
    const same = current.find((c) => c.name.toLowerCase() === add.name.toLowerCase() && JSON.stringify(c.blocks) === JSON.stringify(add.blocks));
    if (same) return NextResponse.json({ ok: true, added: false, commitments: current, state: await getState() });
    if (current.length >= MAX_COMMITMENTS) {
      return NextResponse.json({ ok: false, error: "Too many commitments" }, { status: 400 });
    }
    await replaceCommitments([...current, { ...add, id: undefined }], await getUserTimezone());
    console.log("[api/commitments] added from an offer:", add.kind, "| blocks:", add.blocks.length);
    return NextResponse.json({ ok: true, added: true, commitments: await getCommitments(), state: await getState() });
  } catch (e) {
    console.error("[api/commitments] POST error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Couldn't add that. Try again." }, { status: 500 });
  }
});
