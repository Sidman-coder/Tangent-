import { withUser } from "@/lib/request-context";
import { discardChangeSet } from "@/lib/pipeline/card-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pipeline V2 (404 while TANGENT_PIPELINE_V2 is off): drops a draft. Nothing is written to the calendar. */
export const POST = withUser(discardChangeSet);
