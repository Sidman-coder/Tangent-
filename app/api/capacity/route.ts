import { NextResponse } from "next/server";
import { setCapacity } from "@/lib/store";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { weekday, weekend } in minutes — how much work a day can hold before
 *  it's too much (the spacing brain, lib/load.ts). */
export const POST = withUser(async (req: Request) => {
  const body = (await req.json()) as { weekday?: unknown; weekend?: unknown };
  const weekday = Number(body.weekday);
  const weekend = Number(body.weekend);
  if (!(weekday >= 15 && weekday <= 600) || !(weekend >= 15 && weekend <= 720)) {
    return NextResponse.json({ ok: false, error: "weekday must be 15–600 and weekend 15–720 minutes" }, { status: 400 });
  }
  const saved = await setCapacity({ weekday, weekend });
  if (!saved) {
    return NextResponse.json(
      { ok: false, error: "Can't save this yet — the database update for it hasn't been applied." },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
});
