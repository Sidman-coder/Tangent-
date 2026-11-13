import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { accessOf, gate, skipsSessionCheck } from "@/lib/auth/gate";
import { safeNext } from "@/lib/auth/safe-next";

// Runs on every app route (see matcher). Refreshes the Supabase session cookie,
// then applies lib/auth/gate.ts:
//   * /auth/*, /api/cron/*  skip the session check (they handle their own)
//   * /dev/*                development only; 404 in production
//   * signed out            pages go to /signin, APIs get 401
//   * waitlist              not on ALLOWED_EMAILS: session kept, pages go to
//                           /waitlist, APIs get 403
//   * under 13              pages go to /not-yet, APIs get 403

/** Redirect that keeps any session cookies Supabase just set or cleared. */
function withCookies<T extends NextResponse>(res: T, from: NextResponse): T {
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (skipsSessionCheck(pathname)) return NextResponse.next({ request });

  const isDev = process.env.NODE_ENV === "development";
  // Local design previews (app/dev/*, sample data, no account).
  if (pathname === "/dev" || pathname.startsWith("/dev/")) {
    return isDev ? NextResponse.next({ request }) : new NextResponse("Not found", { status: 404 });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // getUser() validates the session with Supabase Auth (not just the cookie)
  // and refreshes an expired access token. Don't run code between creating the
  // client and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const decision = gate({
    pathname,
    search,
    access: accessOf(user),
    isDev,
    next: safeNext(request.nextUrl.searchParams.get("next")),
  });

  switch (decision.kind) {
    case "next":
      return response;
    case "not_found":
      return new NextResponse("Not found", { status: 404 });
    case "json":
      return withCookies(NextResponse.json({ ok: false, error: decision.error }, { status: decision.status }), response);
    case "redirect":
      return withCookies(NextResponse.redirect(new URL(decision.to, request.url)), response);
  }
}

export const config = {
  matcher: [
    // Everything except Next internals and static files. The manifest is
    // fetched without cookies, so it must not be redirected to /signin.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|glb|gltf|mp3|wav|woff2?)$).*)",
  ],
};
