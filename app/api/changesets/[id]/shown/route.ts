import { withUser } from "@/lib/request-context";
import { markShown } from "@/lib/pipeline/card-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pipeline V2 (404 while TANGENT_PIPELINE_V2 is off): logs preview_shown when the card renders. */
export const POST = withUser(markShown);
