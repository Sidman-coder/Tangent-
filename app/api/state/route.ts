import { NextResponse } from "next/server";
import { getState, replaceState } from "@/lib/store";
import type { AppState } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getState());
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as AppState;
    replaceState(body);
    return NextResponse.json({ ok: true, state: getState() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid body";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
