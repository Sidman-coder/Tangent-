// AI cost by feature for the last N days (default 7), from public.ai_usage.
// Owner/dev only: reads every student's rows with the service-role key, so it
// runs locally and is never deployed as a route.
//
//   node --env-file=.env.local scripts/ai-cost-report.mjs [days]
//
// Prints totals only (no student ids, no prompt contents).
import { createClient } from "@supabase/supabase-js";

const days = Math.max(1, Number(process.argv[2]) || 7);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. --env-file=.env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const since = new Date(Date.now() - days * 86_400_000).toISOString();

const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from("ai_usage")
    .select("user_id, feature, model, route, is_batch, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, duration_ms, est_cost_usd")
    .gte("created_at", since)
    .order("id")
    .range(from, from + 999);
  if (error) {
    console.error("ai_usage query failed:", error.message);
    // exitCode (not exit()) lets open sockets close cleanly on Windows.
    process.exitCode = 1;
    break;
  }
  rows.push(...data);
  if (data.length < 1000) break;
}

function group(keyOf) {
  const out = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    const g = out.get(k) ?? { calls: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, ms: 0, usd: 0 };
    g.calls++;
    g.input += r.input_tokens ?? 0;
    g.output += r.output_tokens ?? 0;
    g.cacheWrite += r.cache_creation_tokens ?? 0;
    g.cacheRead += r.cache_read_tokens ?? 0;
    g.ms += r.duration_ms ?? 0;
    g.usd += Number(r.est_cost_usd ?? 0);
    out.set(k, g);
  }
  return [...out.entries()].sort((a, b) => b[1].usd - a[1].usd);
}

const hitRate = (g) => {
  const total = g.input + g.cacheWrite + g.cacheRead;
  return total ? `${Math.round((100 * g.cacheRead) / total)}%` : "-";
};

function table(title, entries) {
  console.log(`\n${title}`);
  console.log(
    ["", "calls", "in", "out", "cache w", "cache r", "hit", "avg ms", "est $"].map((h, i) => (i ? h.padStart(9) : h.padEnd(22))).join("")
  );
  for (const [k, g] of entries) {
    console.log(
      [
        String(k).padEnd(22),
        g.calls,
        g.input,
        g.output,
        g.cacheWrite,
        g.cacheRead,
        hitRate(g),
        g.calls ? Math.round(g.ms / g.calls) : 0,
        g.usd.toFixed(4),
      ]
        .map((v, i) => (i ? String(v).padStart(9) : v))
        .join("")
    );
  }
}

if (!process.exitCode) {
  const students = new Set(rows.map((r) => r.user_id).filter(Boolean)).size;
  const total = rows.reduce((s, r) => s + Number(r.est_cost_usd ?? 0), 0);
  console.log(`AI usage, last ${days} day(s): ${rows.length} calls, ${students} student(s), est $${total.toFixed(4)}`);
  table("By feature", group((r) => r.feature));
  table("By model", group((r) => r.model + (r.is_batch ? " (batch)" : "")));
  table("By route", group((r) => r.route ?? "(direct)"));
}
