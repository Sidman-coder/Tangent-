# AI spend log (budget: under $15 tonight; paid evals once before and once after Phase 4, each under $3)

Method: the app's AI calls are made server-side with keys I never read. I cannot read exact usage, so figures below are ESTIMATES from call counts, not measurements. Replace with real numbers if usage can be read from the provider dashboard in the morning.

| When | What | Calls (observed) | Est. cost | Basis |
|---|---|---|---|---|
| Phase 1 | Baseline page loads (about 66 shots, proactive Haiku call per load) | about 60 Haiku | under $0.10 | small Haiku calls |
| Phase 2, Maya | 2 captures, 1 intake panel, 1 chat turn, 2 plan generations, page-load calls | about 6 planner/chat calls + about 15 Haiku | about $0.25 to $0.60 | planner calls are the large ones |
| Subagent simulators (Claude Code side, not the app) | evaluator/synthesizer subagents | n/a | not part of app spend | separate from the $15 app budget; noted for completeness |

Running estimate for the app after Maya: about $0.35 to $0.70 of $15.
Per-persona estimate going forward: about $0.30 to $0.60 each, so 5 more personas about $1.50 to $3.00.

## Update after Phase 2 personas (written 2026-11-18, overnight)
| When | What | Calls (observed) | Est. cost | Basis |
|---|---|---|---|---|
| Phase 2, Jordan | 1 capture, planner draft, 1 confirm, page-load calls | about 3 planner/chat calls + about 10 Haiku | about $0.15 to $0.35 | estimate from call counts |
| Phase 2, Sam | 1 capture, question round, 1 draft, page-load calls | about 4 planner/chat calls + about 10 Haiku | about $0.20 to $0.40 | estimate |
| Phase 2, Priya | essay plan (15 steps) drafted and confirmed, Canvas questions | about 5 planner/chat calls + about 12 Haiku | about $0.25 to $0.50 | estimate |
| Phase 2, Leo | 1 capture to draft plan, edit mode, confirm, page-load calls | about 4 planner/chat calls + about 12 Haiku | about $0.20 to $0.45 | estimate |
| Phase 2, Dana | signed out only, no app AI calls | 0 | $0 | no account, no capture |
| Heuristic test crawl | 7 page loads (proactive Haiku call per load on signed-in pages) | about 6 Haiku | under $0.02 | estimate |

Running estimate for the app after Phase 2 (all 6 personas + heuristic crawl): about $1.2 to $2.5 of $15. Still all estimates; the app's real usage could not be read.
Not part of this budget: the Claude Code subagents (screen evaluators, report/summary synthesizers, heuristic expert and raters). They run on the Claude Code side.

## Update after Phase 4.3 paid evals (2026-11-18, from `[perf]` lines, not billing)
| When | What | Calls | Est. cost | Basis |
|---|---|---|---|---|
| 4.3 before-eval | `npm run eval:pipeline`, 64 cases | 147 (all HTTP 200) | about $0.27 | `scripts/eval-cost-from-log.mjs` on the log; 39/64 passed |
| 4.3 after-eval | same, after the context fixes | 146 calls, **96 failed HTTP 400 "credit balance is too low"**, 39 ok (about $0.09) | about $0.09 | run invalid; not repeated (see CONTEXT-REVIEW.md section 0) |

Running app-spend estimate after 4.3: about $1.6 to $2.9 of $15. **The Anthropic account's credit balance is empty**, so any further paid AI call fails until it is topped up (DECISIONS D6, NEEDS-SID).
