import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

// Dev-only timing for the plan / chat pipeline. Measures, never changes
// behavior: every helper returns exactly what the wrapped call returns. In
// production (NODE_ENV=production) nothing is recorded or logged.
//
// One trace per request (withPerfTrace). Inside it:
//   - perfClaude logs each Claude call: label, model, input/output tokens, ms
//   - perfFetch (installed on the Supabase clients) counts DB reads/writes
//   - perfSpan times a named phase and the DB calls inside it
//   - perfCount tallies things like tool-loop turns
// When the trace ends, one summary line is printed.

export const perfEnabled = () => process.env.NODE_ENV !== "production";

type Db = { reads: number; writes: number; ms: number };
type Trace = {
  label: string;
  start: number;
  claude: { label: string; model: string; inTok: number; outTok: number; ms: number; status: number }[];
  db: Db;
  spans: { name: string; ms: number; db: Db }[];
  counts: Record<string, number>;
  openSpans: Db[];
};

const traces = new AsyncLocalStorage<Trace>();

/** Runs `fn` inside a trace (or the caller's, if one is already open). */
export async function withPerfTrace<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!perfEnabled() || traces.getStore()) return fn();
  const trace: Trace = { label, start: Date.now(), claude: [], db: { reads: 0, writes: 0, ms: 0 }, spans: [], counts: {}, openSpans: [] };
  try {
    return await traces.run(trace, fn);
  } finally {
    report(trace);
  }
}

/** Times a phase and the DB calls made inside it. */
export async function perfSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const trace = traces.getStore();
  if (!trace) return fn();
  const db: Db = { reads: 0, writes: 0, ms: 0 };
  const start = Date.now();
  trace.openSpans.push(db);
  try {
    return await fn();
  } finally {
    trace.openSpans.splice(trace.openSpans.indexOf(db), 1);
    const ms = Date.now() - start;
    trace.spans.push({ name, ms, db });
    console.log(`[perf] span ${name}: ${ms} ms | db ${db.reads}r/${db.writes}w ${db.ms} ms`);
  }
}

export function perfCount(name: string, by = 1): void {
  const trace = traces.getStore();
  if (trace) trace.counts[name] = (trace.counts[name] ?? 0) + by;
}

/** Records one Claude call (lib/ai/call.ts calls this): model, tokens, duration. */
export function perfClaude(label: string, model: string, inTok: number, outTok: number, ms: number, status: number, cacheRead = 0, cacheWrite = 0): void {
  if (!perfEnabled()) return;
  const parts = [cacheRead > 0 ? `${cacheRead} cached` : "", cacheWrite > 0 ? `${cacheWrite} cache-written` : ""].filter(Boolean);
  const cached = parts.length ? ` (${parts.join(", ")})` : "";
  console.log(`[perf] claude ${label}: ${model} | in ${inTok} tok${cached}, out ${outTok} tok | ${ms} ms | HTTP ${status}`);
  traces.getStore()?.claude.push({ label, model, inTok, outTok, ms, status });
}

/** fetch for the Supabase clients: counts DB reads (GET/HEAD) and writes. */
export const perfFetch: typeof fetch = async (input, init) => {
  const trace = traces.getStore();
  if (!trace) return fetch(input, init);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const url = String(input instanceof Request ? input.url : input);
  const start = Date.now();
  try {
    return await fetch(input, init);
  } finally {
    // Only PostgREST table calls; auth refreshes aren't DB work.
    if (url.includes("/rest/v1/")) {
      const ms = Date.now() - start;
      const write = method !== "GET" && method !== "HEAD";
      for (const db of [trace.db, ...trace.openSpans]) {
        if (write) db.writes++;
        else db.reads++;
        db.ms += ms;
      }
    }
  }
};

function report(t: Trace): void {
  const total = Date.now() - t.start;
  const claudeMs = t.claude.reduce((s, c) => s + c.ms, 0);
  const counts = Object.entries(t.counts).map(([k, v]) => `${k}=${v}`).join(" ");
  console.log(
    `[perf] ${t.label} total ${total} ms | claude ${t.claude.length} call(s) ${claudeMs} ms` +
      ` (${t.claude.map((c) => `${c.label} ${c.ms}ms ${c.inTok}/${c.outTok}tok`).join(", ") || "none"})` +
      ` | db ${t.db.reads}r/${t.db.writes}w ${t.db.ms} ms (sum; parallel reads overlap)` +
      (counts ? ` | ${counts}` : "")
  );
}
