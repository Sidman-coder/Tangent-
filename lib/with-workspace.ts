import { cookies, headers } from "next/headers";
import { WORKSPACE_COOKIE, WORKSPACE_HEADER } from "./workspace-cookie";
import { withWorkspace } from "./workspace";

// Wraps a route handler so the store it calls is the caller's own workspace,
// loaded from shared storage before the handler runs and written back after if it
// changed. Every API route goes through this; a route that doesn't would read
// whatever happened to be in that serverless instance's memory, which is the bug
// this all exists to fix.
//
// Resolution order:
//   1. the tangent_ws cookie, set by middleware for every browser
//   2. an x-tangent-workspace header, for clients with no cookie jar (the pen)
//   3. "shared" — a last resort so a malformed request still works rather than
//      500s. Browsers never land here.

function resolveWorkspaceId(): string {
  const fromCookie = cookies().get(WORKSPACE_COOKIE)?.value;
  if (fromCookie) return fromCookie;

  const fromHeader = headers().get(WORKSPACE_HEADER);
  if (fromHeader?.trim()) return fromHeader.trim();

  console.warn("[with-workspace] request with no workspace cookie or header — using 'shared'");
  return "shared";
}

type RouteHandler<Args extends unknown[]> = (...args: Args) => Promise<Response> | Response;

export function withWorkspaceRoute<Args extends unknown[]>(
  handler: RouteHandler<Args>
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    const id = resolveWorkspaceId();
    return withWorkspace(id, () => handler(...args));
  };
}
