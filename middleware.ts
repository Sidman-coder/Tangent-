import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isEmailAllowed } from "@/lib/auth/access";

// Runs on every app route (see matcher). Refreshes the Supabase session cookie,
// then gates access:
//   * public paths — sign-in, auth callback/sign-out, invite-only page, cron
//     (cron routes keep their own CRON_SECRET check)
//   * signed-out   — pages redirect to /signin, API routes get 401
//   * not invited  — signed out server-side and sent to /invite-only

const PUBLIC_PATHS = ["/signin", "/invite-only", "/auth/", "/api/cron/"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p));
}

/** Redirect that keeps any session cookies Supabase just set or cleared. */
function redirectWithCookies(url: URL, from: NextResponse): NextResponse {
  const res = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

export async function middleware(request: NextRequest) {
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

  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (user && !isEmailAllowed(user.email)) {
    await supabase.auth.signOut();
    if (isApi) {
      const res = NextResponse.json({ ok: false, error: "TANGENT is invite-only right now" }, { status: 403 });
      response.cookies.getAll().forEach((c) => res.cookies.set(c));
      return res;
    }
    if (pathname === "/invite-only") return response;
    return redirectWithCookies(new URL("/invite-only", request.url), response);
  }

  if (isPublic(pathname)) {
    if (user && pathname === "/signin") {
      return redirectWithCookies(new URL("/", request.url), response);
    }
    return response;
  }

  if (!user) {
    if (isApi) {
      return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
    }
    const signin = new URL("/signin", request.url);
    if (pathname !== "/") signin.searchParams.set("next", pathname + search);
    return redirectWithCookies(signin, response);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|glb|gltf|mp3|wav|woff2?)$).*)",
  ],
};
