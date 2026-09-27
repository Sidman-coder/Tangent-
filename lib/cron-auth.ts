// Verifies a request actually came from Vercel Cron (or a trusted manual test),
// not the public internet. Vercel automatically sends `Authorization: Bearer
// $CRON_SECRET` on scheduled invocations once CRON_SECRET is set as an env var —
// see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
//
// If CRON_SECRET isn't set (e.g. local dev), the check is skipped so the routes
// stay manually triggerable with a plain GET while testing, per the task's
// "test by manually triggering the cron route" instruction. Set CRON_SECRET in
// Vercel before relying on these routes in production.
export function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Missing secret used to mean "allow", which is fine on a laptop and an
    // open door on a public URL. It now only opens the door off production,
    // so losing the env var fails the cron rather than exposing it.
    if (process.env.NODE_ENV === "production") {
      console.error("[cron] CRON_SECRET is not set in production — refusing. See SETUP.md.");
      return false;
    }
    console.warn("[cron] CRON_SECRET is not set — allowing unauthenticated in development only.");
    return true;
  }
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}
