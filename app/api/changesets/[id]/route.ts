import { withUser } from "@/lib/request-context";
import { editChangeSet } from "@/lib/pipeline/card-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pipeline V2 (404 while TANGENT_PIPELINE_V2 is off): edit a draft before
 *  confirming. Body: {type:"remove",index} | {type:"date",index,date} | {type:"time",index,time}. */
export const PATCH = withUser(editChangeSet);
