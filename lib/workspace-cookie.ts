// The cookie name, alone in its own module: middleware runs on the Edge runtime
// and must not pull in lib/workspace.ts, which uses node:async_hooks.
export const WORKSPACE_COOKIE = "tangent_ws";

/** Lets a non-browser client (the pen, a script) name its workspace explicitly. */
export const WORKSPACE_HEADER = "x-tangent-workspace";
