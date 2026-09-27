// lib/canvas-feed-security.ts
//
// A Canvas Calendar Feed link looks like
//   https://<school>.instructure.com/feeds/calendars/user_<SECRET_TOKEN>.ics
// The token grants read access to the student's calendar, and the server
// fetches whatever link a student pastes — so every fetch goes through here:
//
//  - scheme: webcal:// becomes https://; anything else that isn't https is refused
//  - host:   a subdomain of instructure.com or a host in CANVAS_ALLOWED_HOSTS;
//            no IP literals, no port other than 443, no user:pass@
//  - path:   /feeds/calendars/<name>.ics (first hop)
//  - DNS:    every resolved address must be public (no private, loopback,
//            link-local, reserved or cloud-metadata ranges); the connection is
//            pinned to the checked address, so a DNS rebind can't swap it
//  - redirects: never followed automatically; each hop is re-validated, max 3
//  - limits: 10 s overall, 5 MB body, a calendar-ish content type, must parse
//  - secrecy: logs name the host only; the browser only ever sees maskCanvasFeedUrl()

import "server-only";
import { BlockList, isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";
import https from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const MAX_REDIRECTS = 3;
export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_FEED_BYTES = 5 * 1024 * 1024;

const FEED_PATH = /^\/feeds\/calendars\/[A-Za-z0-9_.~-]+\.ics$/;

/** An error whose message is safe to show the student (never contains the URL). */
export class CanvasFeedError extends Error {}

function allowedExtraHosts(): string[] {
  return (process.env.CANVAS_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
}

export function isAllowedCanvasHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host.endsWith(".instructure.com") && host.length > ".instructure.com".length) return true;
  return allowedExtraHosts().includes(host);
}

/** Checks the link's shape (not DNS). `firstHop` also requires the feed path. */
export function parseCanvasFeedUrl(raw: string, firstHop = true): URL {
  let text = raw.trim();
  if (/^webcal:\/\//i.test(text)) text = "https://" + text.slice("webcal://".length);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new CanvasFeedError("That doesn't look like a valid link. Copy the Calendar Feed link from Canvas and try again.");
  }
  if (url.protocol !== "https:") {
    throw new CanvasFeedError("The Canvas calendar feed link must start with https:// (or webcal://).");
  }
  if (url.username || url.password) {
    throw new CanvasFeedError("That link has a username or password in it. Copy the Calendar Feed link straight from Canvas.");
  }
  if (url.port && url.port !== "443") {
    throw new CanvasFeedError("That link uses an unusual port. Copy the Calendar Feed link straight from Canvas.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    throw new CanvasFeedError("That link points at an IP address. Use your school's Canvas address (…instructure.com).");
  }
  if (!isAllowedCanvasHost(host)) {
    throw new CanvasFeedError("That isn't a Canvas link. The Calendar Feed link ends in instructure.com/feeds/calendars/….ics.");
  }
  if (firstHop && !FEED_PATH.test(url.pathname)) {
    throw new CanvasFeedError("That isn't a Canvas calendar feed link. It should look like …/feeds/calendars/user_….ics.");
  }
  url.hash = "";
  return url;
}

// ── Address checks ────────────────────────────────────────────────────────────

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. 169.254.169.254 metadata
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments (incl. 192.0.0.192 Oracle metadata)
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["::", 96], // IPv4-compatible (deprecated)
  ["100::", 64], // discard
  ["2001::", 23], // IETF protocol assignments (Teredo etc.)
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4
  ["fc00::", 7], // unique local, incl. fd00:ec2::254 AWS metadata
  ["fe80::", 10], // link-local
  ["fec0::", 10], // site-local (deprecated)
  ["ff00::", 8], // multicast
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/** Embedded IPv4 for ::ffff:a.b.c.d and NAT64 64:ff9b::/96, else null. */
function embeddedIPv4(ip: string): string | null {
  const lower = ip.toLowerCase();
  const dotted = lower.match(/^(?:::ffff:|64:ff9b::)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) return dotted[1];
  const hex = lower.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return null;
}

/** True when an address must never be fetched from the server. */
export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return blocked.check(ip, "ipv4");
  if (family === 6) {
    const v4 = embeddedIPv4(ip);
    if (v4) return blocked.check(v4, "ipv4");
    return blocked.check(ip, "ipv6");
  }
  return true; // not an address at all
}

export type ResolvedAddress = { address: string; family: 4 | 6 };
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

const systemResolver: Resolver = async (hostname) => {
  const found = await dnsLookup(hostname, { all: true, verbatim: true });
  return found.map((a) => ({ address: a.address, family: a.family === 6 ? 6 : 4 }));
};

/** Resolves a host and returns the address to connect to, refusing if ANY
 *  resolved address is non-public (a mixed answer is treated as hostile). */
export async function resolvePublicAddress(hostname: string, resolve: Resolver = systemResolver): Promise<ResolvedAddress> {
  let found: ResolvedAddress[];
  try {
    found = await resolve(hostname);
  } catch {
    throw new CanvasFeedError("Couldn't find that Canvas server. Check the link and try again.");
  }
  if (found.length === 0) throw new CanvasFeedError("Couldn't find that Canvas server. Check the link and try again.");
  if (found.some((a) => isBlockedAddress(a.address))) {
    throw new CanvasFeedError("That link points at a private or internal address, so TANGENT won't fetch it.");
  }
  return found[0];
}

// ── Fetching ──────────────────────────────────────────────────────────────────

export type HopResponse = {
  status: number;
  headers: IncomingHttpHeaders;
  body: AsyncIterable<Buffer | string>;
  /** Stops reading the body early (oversized responses). */
  abort: () => void;
};
/** Makes one request to `url`, connecting only to `address`. */
export type Transport = (url: URL, address: ResolvedAddress, signal: AbortSignal) => Promise<HopResponse>;

const pinnedHttpsTransport: Transport = (url, address, signal) =>
  new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        signal,
        headers: { Accept: "text/calendar, text/plain;q=0.8, */*;q=0.1", "User-Agent": "TANGENT-Canvas-Sync/1.0" },
        // Connect to the address we already checked; the hostname is still used for TLS (SNI + certificate).
        lookup: (_host, opts, cb) => {
          const all = (opts as { all?: boolean }).all;
          if (all) (cb as unknown as (e: null, a: ResolvedAddress[]) => void)(null, [address]);
          else (cb as unknown as (e: null, a: string, f: number) => void)(null, address.address, address.family);
        },
      },
      (res) => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: res, abort: () => res.destroy() })
    );
    req.on("error", reject);
    req.end();
  });

export type FetchDeps = { resolve?: Resolver; transport?: Transport; timeoutMs?: number; maxBytes?: number };

const CALENDARISH = /^(text\/calendar|text\/x-vcalendar|application\/ics|application\/x-ical|text\/plain|application\/octet-stream)\b/i;

/** Fetches a Canvas feed under every rule above and returns its text. Throws
 *  CanvasFeedError with a student-friendly message; never logs the URL. */
export async function fetchCanvasFeedText(rawUrl: string, deps: FetchDeps = {}): Promise<string> {
  const resolve = deps.resolve ?? systemResolver;
  const transport = deps.transport ?? pinnedHttpsTransport;
  const maxBytes = deps.maxBytes ?? MAX_FEED_BYTES;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? FETCH_TIMEOUT_MS);

  let url = parseCanvasFeedUrl(rawUrl, true);
  try {
    for (let hop = 0; ; hop++) {
      const address = await resolvePublicAddress(url.hostname, resolve);
      let res: HopResponse;
      try {
        res = await transport(url, address, controller.signal);
      } catch (e) {
        if (controller.signal.aborted) throw new CanvasFeedError("Canvas took too long to respond. Try again in a minute.");
        console.error("[canvas-feed] request failed for host", url.hostname, "-", e instanceof Error ? e.name : "error");
        throw new CanvasFeedError("Couldn't reach Canvas. Check the link and try again.");
      }

      if (res.status >= 300 && res.status < 400) {
        res.abort();
        const location = res.headers.location;
        if (!location) throw new CanvasFeedError("Canvas sent an unexpected response. Try again in a minute.");
        if (hop >= MAX_REDIRECTS) throw new CanvasFeedError("That link redirects too many times.");
        // Re-validate the next hop: scheme, host allowlist, port, userinfo, then DNS.
        url = parseCanvasFeedUrl(new URL(location, url).toString(), false);
        console.log("[canvas-feed] redirect", hop + 1, "to host", url.hostname);
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        res.abort();
        console.error("[canvas-feed] host", url.hostname, "returned", res.status);
        throw new CanvasFeedError(
          res.status === 401 || res.status === 403 || res.status === 404
            ? "Canvas didn't accept that feed link. Copy a fresh Calendar Feed link from Canvas and try again."
            : `Canvas returned an error (${res.status}). Try again in a minute.`
        );
      }

      const type = String(res.headers["content-type"] ?? "");
      if (type && !CALENDARISH.test(type)) {
        res.abort();
        throw new CanvasFeedError("That link didn't return a calendar feed. Make sure you copied the Calendar Feed link from Canvas.");
      }
      const declared = Number(res.headers["content-length"]);
      if (Number.isFinite(declared) && declared > maxBytes) {
        res.abort();
        throw new CanvasFeedError("That calendar feed is too large to import (over 5 MB).");
      }

      const chunks: Buffer[] = [];
      let size = 0;
      try {
        for await (const chunk of res.body) {
          const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
          size += buf.length;
          if (size > maxBytes) {
            res.abort();
            throw new CanvasFeedError("That calendar feed is too large to import (over 5 MB).");
          }
          chunks.push(buf);
        }
      } catch (e) {
        if (e instanceof CanvasFeedError) throw e;
        if (controller.signal.aborted) throw new CanvasFeedError("Canvas took too long to respond. Try again in a minute.");
        throw new CanvasFeedError("Couldn't read the calendar feed. Try again in a minute.");
      }
      const text = Buffer.concat(chunks).toString("utf8");
      if (!/BEGIN:VCALENDAR/.test(text)) {
        throw new CanvasFeedError("That link didn't return a calendar feed. Make sure you copied the Calendar Feed link from Canvas.");
      }
      return text;
    }
  } finally {
    clearTimeout(timer);
  }
}

// ── Encryption at rest (optional) ─────────────────────────────────────────────
// With CANVAS_FEED_KEY set (32 random bytes, base64) the stored ics_url is
// AES-256-GCM ciphertext "enc:v1:<iv>:<tag>:<data>". Without it, links are
// stored as before. Reads accept both, so turning the key on later is safe:
// older plaintext rows are re-encrypted the next time they're saved.

const ENC_PREFIX = "enc:v1:";

function feedKey(): Buffer | null {
  const raw = process.env.CANVAS_FEED_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("CANVAS_FEED_KEY must be 32 bytes, base64-encoded");
  return key;
}

export function encryptFeedUrl(url: string): string {
  const key = feedKey();
  if (!key) return url;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(url, "utf8"), cipher.final()]);
  return ENC_PREFIX + [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(":");
}

export function decryptFeedUrl(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  const key = feedKey();
  if (!key) throw new Error("A Canvas feed is encrypted but CANVAS_FEED_KEY is not set");
  const [iv, tag, data] = stored.slice(ENC_PREFIX.length).split(":").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** "school.instructure.com/…/user_••••.ics" — the host, never the token. */
export function maskCanvasFeedUrl(icsUrl: string): string {
  try {
    const url = new URL(icsUrl.replace(/^webcal:\/\//i, "https://"));
    const file = url.pathname.split("/").pop() ?? "";
    const masked = /^user_/i.test(file) ? "user_••••.ics" : "••••.ics";
    return `${url.hostname}/…/${masked}`;
  } catch {
    return "••••.ics";
  }
}
