import { NextResponse } from "next/server";
import { withUser, getRequestContext } from "@/lib/request-context";
import { runWaitlistAction } from "@/lib/auth/waitlist";
import { sendApprovalEmail, waitlistAdmin } from "@/lib/auth/waitlist-server";
import { originHeaders, requestOrigin } from "@/lib/auth/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner only (OWNER_EMAIL): approves one waiting email. Anyone else gets 404,
 *  as if the route didn't exist. The email comes from the session, never the body. */
export const POST = withUser(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const origin = requestOrigin(originHeaders(req), req.url);
  const result = await runWaitlistAction(getRequestContext().email, body, {
    admin: waitlistAdmin(),
    sendSignInLink: (email) => sendApprovalEmail(email, origin),
  });
  const res = NextResponse.json(result.body, { status: result.status });
  res.headers.set("Cache-Control", "no-store");
  return res;
});
