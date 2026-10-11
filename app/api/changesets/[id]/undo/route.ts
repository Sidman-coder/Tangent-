import { withUser } from "@/lib/request-context";
import { undoChangeSet } from "@/lib/pipeline/card-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pipeline V2 (404 while TANGENT_PIPELINE_V2 is off): reverses a confirmed change set through its single undo entry. */
export const POST = withUser(undoChangeSet);
