import { NextResponse } from "next/server";
import { getBriefConfig, saveBriefConfig } from "@/lib/store";
import type { BriefConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, config: getBriefConfig() });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BriefConfig;
    if (!Array.isArray(body.sources) || !body.cadence || !body.deliveryTime) {
      return NextResponse.json({ ok: false, error: "Invalid brief config" }, { status: 400 });
    }
    const saved = saveBriefConfig(body);
    return NextResponse.json({ ok: true, config: saved });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
