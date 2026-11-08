import { withUser } from "@/lib/request-context";
import { activityDelete } from "@/lib/pipeline/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Settings › AI Activity: DELETE one of the student's own rows (404 while
 *  TANGENT_PIPELINE_V2 is off, or when the row isn't theirs). */
export const DELETE = withUser(activityDelete);
