import { NextResponse } from "next/server";
import { addCalendar, getAppState } from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** POST — creates a new calendar */
export async function POST(req: Request) {
  const body = (await req.json()) as { name?: string; color?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  }
  const calendar = addCalendar(body.name.trim(), body.color);
  return NextResponse.json({ ok: true, calendar, state: getAppState() });
}
