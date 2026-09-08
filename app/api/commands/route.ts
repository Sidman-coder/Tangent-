import { NextResponse } from "next/server";
import { applyCommands } from "@/lib/store-server";
import type { Command } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { commands?: Command[] };
    if (!Array.isArray(body.commands)) {
      return NextResponse.json({ ok: false, error: "commands array required" }, { status: 400 });
    }
    const state = applyCommands(body.commands);
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
