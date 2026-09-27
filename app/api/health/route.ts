import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { backendName, isShared } from "@/lib/kv";

// Identifies THIS process, not this deployment.
//
// `instance` used to report VERCEL_DEPLOYMENT_ID, which is the same string for
// every lambda of a deployment — so the "hit this a few times and watch several
// instances disagree" check below could never actually show anything. Module
// scope runs once per cold start, so this id is stable within an instance and
// different across instances, which is exactly the axis being diagnosed.
const INSTANCE_ID = randomUUID().slice(0, 8);
import { currentWorkspaceId } from "@/lib/workspace";
import { getAppState, getPathSpace } from "@/lib/store";
import { withWorkspaceRoute } from "@/lib/with-workspace";

export const dynamic = "force-dynamic";

// Answers the question the old setup made impossible to answer: is this instance
// serving real shared data, or its own private copy?
//
// `storage: "file"` in production means the Redis credentials are missing and the
// workspace only exists on whichever instance answered — the state every bug
// about vanishing data came from. Hit this a few times and compare: with a
// shared store every `instance` reports the same counts, and with the file
// fallback the counts drift as different instances answer.
async function GETHandler() {
  const state = getAppState();
  const space = getPathSpace();
  return NextResponse.json({
    ok: true,
    storage: backendName(),
    shared: isShared(),
    // Local file storage is fine on one machine; on Vercel it is per-instance
    // /tmp, so nothing written there reliably survives a return visit.
    durable: isShared() || !process.env.VERCEL,
    workspace: currentWorkspaceId(),
    instance: INSTANCE_ID,
    deployment: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    counts: {
      tasks: state.tasks.length,
      plans: state.plans.length,
      paths: space.paths.length,
      pathNodes: space.nodes.length,
    },
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}

export const GET = withWorkspaceRoute(GETHandler);
