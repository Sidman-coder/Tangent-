import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createClient();
  await supabase.auth.signOut();
  // 303 so the browser follows with a GET after the form POST.
  return NextResponse.redirect(new URL("/signin", request.url), { status: 303 });
}
