import { NextResponse } from "next/server";
import { getState, replaceState } from "@/lib/store";
import type { AppState } from "@/lib/types";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withUser(async () => {
  return NextResponse.json(getState());
});

export const PUT = withUser(async (req: Request) => {
  try {
    const body = (await req.json()) as AppState;
    replaceState(body);
    return NextResponse.json({ ok: true, state: getState() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid body";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
});
