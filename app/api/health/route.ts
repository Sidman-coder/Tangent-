import { NextResponse } from "next/server";
import { backendName, isShared } from "@/lib/kv";
import { currentWorkspaceId } from "@/lib/workspace";
import { getAppState, getPathSpace } from "@/lib/store";
import { withWorkspaceRoute } from "@/lib/with-workspace";

export const dynamic = "force-dynamic";

// Answers the question the old setup made impossible to answer: is this instance
// serving real shared data, or its own private copy?
//
// `storage: "file"` in production means the Redis credentials are missing and the
// workspace only exists on whichever instance answered — the state every bug
// about vanishing data came from. It also reports the instance id, so hitting
// this a few times shows several instances agreeing on the same workspace.
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
    instance: process.env.VERCEL_DEPLOYMENT_ID ?? process.pid,
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
