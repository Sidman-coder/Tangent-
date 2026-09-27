import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// Verifies a request actually came from Vercel Cron (or a trusted manual test),
// not the public internet. Vercel sends `Authorization: Bearer $CRON_SECRET` on
// every scheduled invocation once CRON_SECRET is set on the project — see
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
//
// The cron routes act for every student with the service role, and middleware
// lets /api/cron/* through without a session, so this check is the only gate.
// It fails closed everywhere: with no CRON_SECRET set, every request is
// rejected — including local dev, which is reachable from the LAN (the Pi).
// To trigger a cron by hand locally, set CRON_SECRET in .env.local and send
// the same Bearer header.
export function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET is not set — refusing cron request.");
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  // Hash both sides so the comparison is constant-time and length-independent.
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${cronSecret}`));
}
