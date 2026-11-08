import { withUser } from "@/lib/request-context";
import { activityClear, activityGet, activityPost } from "@/lib/pipeline/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Settings › AI Activity (404 while TANGENT_PIPELINE_V2 is off). GET one page
 *  of the student's own rows (?page&result&type&days&q&focus), POST
 *  { expanded } when a row is opened, DELETE to clear the log (the calendar
 *  stays the same). */
export const GET = withUser(activityGet);
export const POST = withUser(activityPost);
export const DELETE = withUser(activityClear);
