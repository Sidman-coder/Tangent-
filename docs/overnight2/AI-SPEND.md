# AI spend, overnight 2

Budget: **$20** in app and eval calls. Stop AI calls at **$18**.
Figures are estimates from token counts (`[perf]` lines, `scripts/eval-cost-from-log.mjs`) unless marked otherwise. Claude Code subagents (judges, sims' evaluators) run on the Claude Code side and are not counted here; only calls the app itself makes to the Anthropic API are.

| Time | What | Calls | Est. cost | Running total |
|---|---|---|---|---|
| Phase 1 | eval:pipeline baseline (eval-before.log, eval-cost-from-log) | 130 | $0.315 | $0.34 |
| Phase 0 | Smoke test, one Home chat (Sonnet talk; no perf line, estimated ~3k in / 400 out) + page-load proactive x2 | ~3 | ~$0.02 | $0.02 |
| Phase 1 | Live checks L1-L13 (server.log lines 1-141, tallied by a scratchpad perf-tally script). Sonnet: 3 plan briefs $0.043, 2 outlines $0.014, refineTask $0.007, clarify $0.005. Haiku: 11 proactive $0.003, 5 talk $0.002, rest <$0.003 | 31 | $0.076 | $0.42 |
| Phase 1 | Persona sims Maya, Jordan, Leo, Priya, Sam (server.log lines 142-357). Sonnet: 5 plan briefs $0.074, 4 outlines $0.031, plan details $0.050, refineTask $0.017, plan fix $0.015, clarify $0.011. Haiku: plan details, 4 proactive, titles, context <$0.006 | 38 | $0.203 | $0.62 |
| Phase 2 | Eval re-run of the 22 failing cases (`--only`, scratchpad only-1.log) | 108 | $0.260 | $0.88 |
| Phase 2 | Single-case re-runs (one-1/2, two-1/2, sat-1..3) | ~14 | $0.020 | $0.90 |
| Phase 2 | Full eval after fixes (eval-after-phase2.log) | 150 | $0.400 | $1.30 |
| Phase 2 | Live re-checks (server3-6.log: plan brief $0.016, outline $0.009, talk, details, refine) | 13 | $0.036 | $1.34 |
| Phase 2 | Swap test `--context` $0.015, plan quality `--quality` $0.032, router fixtures `--round2` $0.002 | 52 | $0.049 | $1.39 |
| Phase 3 | Live check 3.4 (server8.log): talk $0.0005, chess plan brief $0.015, outline $0.008, 2 details $0.001, roundReview $0.0002 | 6 | $0.025 | **$1.42** |
| Phase 8 | Round-2 persona sims, 5 runs (server13.log, every `[perf] claude` line): plan brief 6 × Sonnet $0.081, outline 6 × Sonnet $0.046, details 14 $0.042, refine/captureQuestions/shortTitles $0.002. Phases 4–7 added no calls | 33 | $0.171 | **$1.59** |
