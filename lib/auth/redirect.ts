import { safeNext } from "./safe-next";

// Where sign-in emails and OAuth send the student back. Always the origin the
// student is on (localhost, a Vercel preview, or production), never a fixed
// Site URL. Supabase only honours it when it matches an entry in Auth → URL
// Configuration → Redirect URLs (see docs/tangent-pipeline-final-checks.md).

export type OriginHeaders = {
  origin?: string | null;
  host?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
};

/** The browser's origin for this request. The Origin header wins when it names
 *  the same host the request reached (so a cross-site POST can't pick the
 *  redirect); otherwise the proxied host, then the request URL. */
export function requestOrigin(h: OriginHeaders, requestUrl: string): string {
  const url = new URL(requestUrl);
  const host = (h.forwardedHost ?? h.host ?? "").split(",")[0].trim() || url.host;
  if (h.origin) {
    try {
      const o = new URL(h.origin);
      if ((o.protocol === "https:" || o.protocol === "http:") && o.host === host) return o.origin;
    } catch {
      /* not a URL; fall through */
    }
  }
  const proto = (h.forwardedProto ?? "").split(",")[0].trim() || url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** The auth callback on `origin`, carrying the page to return to. The email
 *  template appends "&token_hash=…&type=email" to this, so it always has a
 *  query string. */
export function authCallbackUrl(origin: string, next: string | null | undefined): string {
  return `${origin.replace(/\/+$/, "")}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
}

/** OriginHeaders from a Request. */
export function originHeaders(request: Request): OriginHeaders {
  return {
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
  };
}
