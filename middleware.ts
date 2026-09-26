import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Gives every browser its own workspace.
//
// Before this, the app had no notion of who was using it — no cookie, no
// session, no user id anywhere — so everyone who opened the URL edited one
// shared workspace and saw each other's tasks appear in their own.
//
// The id is a random 128-bit value, httpOnly so page scripts can't read it, and
// it is the key the workspace is stored under. This is a workspace, not an
// account: anyone holding the cookie is that workspace, and clearing cookies
// starts a new empty one. Real accounts replace this, and should reuse the same
// scoping — see SETUP.md.

import { WORKSPACE_COOKIE, WORKSPACE_HEADER } from "@/lib/workspace-cookie";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function middleware(req: NextRequest) {
  const existing = req.cookies.get(WORKSPACE_COOKIE)?.value;
  if (existing && /^[0-9a-f-]{8,64}$/i.test(existing)) {
    return NextResponse.next();
  }

  // A client that names its own workspace (the pen, a script) must keep it.
  // Minting a cookie here would shadow the header and hand it a new, empty
  // workspace on every request.
  if (req.headers.get(WORKSPACE_HEADER)?.trim()) {
    return NextResponse.next();
  }

  const id = crypto.randomUUID();

  // Also set it on the forwarded request, so the very first request already runs
  // against its own workspace instead of falling back to a shared one.
  const headers = new Headers(req.headers);
  const forwarded = req.cookies.get(WORKSPACE_COOKIE)?.value
    ? headers.get("cookie") ?? ""
    : [headers.get("cookie"), `${WORKSPACE_COOKIE}=${id}`].filter(Boolean).join("; ");
  headers.set("cookie", forwarded);

  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(WORKSPACE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return res;
}

export const config = {
  // Everything except static assets. API routes included: they need the cookie
  // most of all.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
