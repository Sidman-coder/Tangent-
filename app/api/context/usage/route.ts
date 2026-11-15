import { NextResponse } from "next/server";
import { listFactUsage } from "@/lib/store";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Round 5B: which confirmed plans used which facts, for the "You, mapped"
 *  satellites. Empty until the facts_used migration has run. */
export const GET = withUser(async () => NextResponse.json({ usage: await listFactUsage() }));
