import { withUser } from "@/lib/request-context";
import { confirmChangeSet } from "@/lib/pipeline/card-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pipeline V2 (404 while TANGENT_PIPELINE_V2 is off): applies a draft once. A repeat returns the first result. */
export const POST = withUser(confirmChangeSet);
