// Per-task AI cost from a saved `npm run eval:pipeline` log (the [perf] lines).
//
//   node scripts/eval-cost-from-log.mjs <log-file> [<log-file-2>]
//
// Free and offline. Prices mirror lib/ai/models.ts PRICES (USD per million tokens);
// cache writes are billed at 1.25x input and cache reads at the model's cacheRead
// price (0.1x input when none is set). It is an estimate from the log, not billing.

import { readFileSync } from "node:fs";

const PRICES = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.05 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

const LINE = /\[perf\] claude ([\w ]+?): (\S+) \| in (\d+) tok(?: \((\d+) (cache-written|cached)\))?, out (\d+) tok/;

export function parseLog(text) {
  const by = {};
  for (const line of text.split(/\r?\n/)) {
    const m = LINE.exec(line);
    if (!m) continue;
    const [, task, model, inTok, cacheTok, cacheKind, outTok] = m;
    const p = PRICES[model] ?? { input: 5, output: 25 };
    const total = Number(inTok);
    const cache = Number(cacheTok ?? 0);
    // "in" counts every input token; the parenthesis says how many were cache traffic.
    const fresh = total - cache;
    const cacheRate = cacheKind === "cached" ? (p.cacheRead ?? p.input * 0.1) : p.input * 1.25;
    const usd = (fresh * p.input + cache * cacheRate + Number(outTok) * p.output) / 1e6;
    const row = (by[task] ??= { calls: 0, input: 0, output: 0, usd: 0 });
    row.calls += 1;
    row.input += total;
    row.output += Number(outTok);
    row.usd += usd;
  }
  return by;
}

if (process.argv[1] && process.argv[1].endsWith("eval-cost-from-log.mjs")) {
  for (const file of process.argv.slice(2)) {
    const by = parseLog(readFileSync(file, "utf8"));
    const rows = Object.entries(by).sort((a, b) => b[1].usd - a[1].usd);
    console.log(`\n${file}`);
    console.log("task".padEnd(20) + "calls".padStart(6) + "in/call".padStart(9) + "out/call".padStart(9) + "usd".padStart(9) + "usd/call".padStart(10));
    let calls = 0;
    let usd = 0;
    for (const [task, r] of rows) {
      calls += r.calls;
      usd += r.usd;
      console.log(
        task.padEnd(20) + String(r.calls).padStart(6) + String(Math.round(r.input / r.calls)).padStart(9) + String(Math.round(r.output / r.calls)).padStart(9) + r.usd.toFixed(3).padStart(9) + (r.usd / r.calls).toFixed(4).padStart(10),
      );
    }
    console.log("TOTAL".padEnd(20) + String(calls).padStart(6) + "".padStart(18) + usd.toFixed(3).padStart(9));
  }
}
