# Overnight run 2 progress

Branch: `push-v1` (continues from overnight 1, last commit e6a6f81). Started 2026-11-22.
Prompt: `D:\TANGENT showcase\Overnight 2\tangent-overnight2-prompt.md`.
Rule: after any restart or compaction, read this first and continue from the first unchecked item.
Tags: **[ran]** = verified by running it; **[code]** = read in code only.

## Phase checklist
- [x] Phase 0: Setup
  - [x] 0.1 git status clean (nothing to commit)
  - [x] 0.2 docs/overnight2 created (PROGRESS, DECISIONS, NEEDS-SID, AI-SPEND)
  - [x] 0.3 build + next start [ran] (`npm run build` with 3072 heap OK; `next start` on :3000 with TANGENT_PERF=1, AI_DAILY_BUDGET_USD=6; O2-D1, O2-D2)
  - [x] 0.4 Playwright signed in as test account [ran] (screens/p0-home-signin-check.png, "Hey, Leo.")
  - [x] 0.5 user-simulation plugin works [ran] (skills simulation-run/heuristic-test present in plugin cache 5.0.0; subagent types synthetic-screen-evaluator, synthetic-flow-synthesizer, summary-synthesizer listed; 5 profiles in user-simulation-tests/simulation/profiles/)
  - [x] 0.6 npm test passes [ran] (979 pass / 0 fail)
  - [x] 0.7 smoke test: one real AI call on Home [ran] (live/p0-smoke-chat-done.png; server log `[api/chat] talk route: add home`, specific streamed answer)
- [x] Phase 1: AI baseline live (eval-before.log, L1-L13 in live/, persona sims)
  - [x] 1.1 eval baseline 42/64 [ran] (docs/overnight2/eval-before.log)
  - [x] 1.2 live checks L1-L13 [ran] (docs/overnight2/live/LIVE-NOTES.md + screenshots)
  - [x] 1.3a sim Maya [ran]: abandoned at step 11 (user-simulation-tests/simulation/results/2026-11-22-maya-okafor-j3a.md)
  - [x] 1.3b sim Jordan [ran] (results/2026-11-22-jordan-*.md)
  - [x] 1.3c sim Leo [ran]: abandoned at step 14; Mark done asked nothing, check-in typed into "Stuck? Ask…" got a plan preview (results/2026-11-22-leo-brandt-c9v.md). Fixes already in code (TaskDetail check-in, talk-route `report`), not built yet.
  - [x] 1.3d sim Priya [ran], 1440x900: abandoned at step 4. "Placing…" ran ~30 s, then a "task list was cut off" flash and no plan; the ED II deadline was dropped (results/2026-11-22-priya-nair-e2n.md)
  - [x] 1.3e sim Sam [ran], 390x844: abandoned at step 4. Add cleared with no visible result; Confirm returned 409 from /api/changesets/<id>/confirm and the card vanished silently (results/2026-11-22-sam-patel-t5d.md)
  - [x] 1.4 sim spend tallied (server.log 142-357: 38 calls, $0.203), AI-SPEND running total $0.62
- Phase 2 code fixes already made (not yet built; ship in the Phase 2 commit, O2-D5): see DECISIONS O2-D6 to O2-D11. Unit tests pass for each; `npx tsc --noEmit` clean.
- [x] Phase 2: AI judges + fix loop (AI-JUDGMENT-1.md, AI-RESULTS.md)
  - [x] 2.1 fix loop 1: eval 62/64, swap 2/2, quality 4/4 with 0 banned phrases, router fixtures 19/19, talk 3.0 s, plan 15.9 s [ran] (AI-RESULTS.md)
  - [x] 2.2 live re-checks on builds 3-7: L1, L2, L4, L4c, L6, L8, L9, L11, L13 pass [ran] (live/LIVE-NOTES.md "Phase 2 re-checks")
  - [x] 2.3 judges: student, coach and differentiation each scored 6/10; chair merge in AI-JUDGMENT-1.md
  - [x] 2.4 judge fixes, no AI calls (O2-D41 to O2-D44): deadline cap on re-plans, "Too big" in why-not, "a few questions", Because picks a fixed item. `npm test` 1043/1043 [ran], tsc clean [ran]. Not built yet: they ship in the Phase 3.4 rebuild
  - Stopped after 1 paid loop because every target was met (AI-JUDGMENT-1 "Loop decision")
- [x] Phase 3: Follow-up you can see (build 8, server9)
  - [x] 3.1 "Because you said…" [code+tests]: lib/because.ts, BECAUSE: note line, PlanBrief + TaskDetail (lib/because.test.ts, 8 pass)
  - [x] 3.2 Day-2 follow-up [code+tests]: Home day-2 card (lib/today-steps.ts dayTwoStep), bubble asks about a step from the last 1–2 days (lib/student/step-follow-up.ts, /api/follow-up), lib/day-two.test.ts 9 pass on seeded dates (O2-D25)
  - [x] 3.3 Round review → Round 2 [code+tests]: roundChangeLine "Last round you said X, so this round is evenings" (lib/round-review.test.ts)
  - [x] 3.4 live check [ran] (live/LIVE-NOTES.md "Phase 3.4"): Because rows pass after O2-D45 (a round answer leaked as its stored record); project cards show only the goal (O2-D46); round sheet pass; "Too big" → split pass; Home nudge pass. Day-2 card not reachable live without seeding (unit tests only). `npm test` 1043/1043 [ran], tsc clean [ran], build8 exit 0 [ran]. Spend total $1.42
- [x] Phase 4: Proactive notifications, cheaper (O2-D24; PROACTIVE.md). Before: 16 loads → 16 Haiku calls, all deduped [ran]. After: 7 loads → 0 calls (1 rules-only run, 6 gate skips; /projects didn't trigger) [ran]. Monthly ≈ $0.085 → $0 to ≤ $0.047 worst case [estimate]
- [x] Phase 5: Website finalization
  - [x] 5.1 public pages, gate, legal, Deepgram opt-out, links (O2-D around "Public pages"; auth-gate 13/13 [ran]); landing image now real (O2-D53)
  - [x] 5.2 category colours, one rule everywhere (O2-D47; task-colors 27/27, preview-week 11/11, chat 14/14 [ran]; Calendar 390 legend dots School/3 projects/Personal, live [ran])
  - [x] 5.3 judges' leftovers: N06 Next up [code, not rendered on the test account: open items today], N14/F07 labels [ran], N15/F03 Personal [ran grep], N16 strip under first section [ran], N11/F09 map [ran], F04 Done labels [ran], rail placeholder [ran]
  - [x] 5.4 removal words (O2-D52)
  - [x] 5.5 screenshots: docs/overnight2/screens/p5-{home,calendar,you-mapped}-{390,1440}-{light,dark}.png, no sideways scroll on any [ran]
  - Checks: npm test 1045 pass / 0 fail, tsc exit 0, build exit 0 (build10), server11 [ran]
- [x] Phase 6: Approved privacy controls (build12, server13)
  - [x] 6.1 Disconnect Canvas (O2-D54/55): inline question with the spec copy and live count, feed link always deleted, items only on "Remove". Live, test account [ran]: real POST 200 `{ok:true, removedItems:0}` (no feed row to delete); panel rendered with a stubbed status read; focus on Cancel, Escape closes, buttons 44px, no sideways scroll at 390. Screens: docs/overnight2/screens/phase6/disconnect-panel-{390,1440}.png, disconnect-done-390.png
  - [x] 6.2 Forget everything also deletes step_events, with new copy (O2-D56) [code + store tests; not run live, to keep Phase 8's test facts]
  - [x] 6.3 "Tangent noticed" rows in You, mapped, each with Forget (O2-D57). Live, test account [ran]: steps row (4 lines) and planning row (1 line); Undo sent 0 requests; a real Forget of "How you plan" gave 200 `removed: 17`, and the row was gone after reload. Screens: noticed-{390,1440}.png, noticed-forgotten-390.png
  - [x] 6.4 Consent line on onboarding step 1, plus Settings → Help and privacy "What you can take back" (O2-D58). Screens [ran]: onboarding-consent-{390,1440}.png (/dev/app/setup under next dev, signed-in browser), privacy-controls-{390,1440}.png (production)
  - Tests: lib/privacy-controls.test.ts 8/8 [ran]; npm test 1053 pass / 0 fail [ran]; tsc exit 0 [ran]; build11 and build12 exit 0 [ran]
- [x] Phase 7: CONTEXT-ENGINE-NOW.md (storage, real test-account data, pack selection + example, good vs ignored quotes, matching probes, profile gaps, cost per feature). No code changed, no AI calls; step_events export gap and 3 more items in NEEDS-SID
- [x] Phase 8: Round-2 sims, JUDGMENT-3, MORNING-REPORT

## Log
- Phase 0 started. Read overnight 1 MORNING-REPORT, DECISIONS, NEEDS-SID, JUDGMENT-2, CONTEXT-REVIEW. `git status` clean on push-v1.
- Phase 7 committed (443498b). Phase 8 started: round-2 sims one at a time, slugs `<persona>-r2` (O2-D59); judges design / student advocate / differentiation over the nine JUDGMENT-2 areas (O2-D60). Maya r2 running.
  - [x] 8.1a Maya r2 [ran]: all task actions done in 8/15 steps (Phase 1: abandoned at step 11). Worst: first draft put the only study step on the day of the final (fixed after she typed a correction); check-in Save closed with no confirmation; plan changed without a chat reply. Context partly used (debate Tue 3:30–5 kept, nothing after 11 PM). results/2026-11-22-maya-okafor-r2.md
  - [x] 8.1b Jordan r2 [ran]: abandoned at step 4/15 (Phase 1: plan saved, 8 steps). "geometry quiz friday" with no time was placed Fri 4:30 PM, inside soccer practice Tangent was never told this time; the toast offered Undo plus a load warning and no way on to planning. "Say it" silent twice (headless browser has no mic). The quiz is left on the test account for Fri Nov 27 4:30 PM. results/2026-11-22-jordan-reyes-r2.md
  - [x] 8.1c Leo r2 [ran]: goal reached in 13/15 steps (Phase 1: abandoned at step 14). Worst: 2 prep steps still after Friday's test in the first draft, and a typed time saved only on blur; "Later" on the follow-up question removed the whole Added card; Done gave no check-in, and his typed report got a generic "Logged how … went" with the Thursday step unchanged. Stored goal fact used in the plan. results/2026-11-22-leo-brandt-r2.md
  - [x] 8.1d Priya r2 [ran]: every task action done, then marked unresolved at step 11/15 (Phase 1: abandoned at step 4, no plan). Worst: "Outline essay" placed Wed 6:30 PM inside her stated 4–9 PM shift, and the regenerated plan kept the slot while its Because line claimed it "comes after your 4-9pm hours" (she moved it by hand); a "Draft plan · 5 steps" pill stayed after Confirm; check-in Save closed silently. results/2026-11-22-priya-nair-r2.md
  - [x] 8.1e Sam r2 [ran]: every task action done, then abandoned at step 7/15 (Phase 1: abandoned at step 4 on a 409 Confirm). Worst: check-in Save closed with nothing in its place; the "Draft plan · 5 steps" pill stayed after Confirm; "english essay due friday" was added to the open ED II draft, not its own plan. results/2026-11-22-sam-patel-r2.md
  - Round-2 sim pattern: 4 of 5 did every task action (Phase 1: 1 of 5). Silent check-in Save hit 3 of 5 (Maya, Priya, Sam); the leftover draft pill after Confirm hit 2 (Priya, Sam); stated busy times were broken in 3 (Jordan, Priya, Leo's test date).
  - [x] 8.2 heuristic round 3 [ran]: 17 findings (round 2: 11, round 1: 17); 7 round-2 findings gone, 3 remain, 1 partly fixed, 13 new, mostly on Home/Calendar now that they show more content. Top: F07 Draft plan bar's only dismiss is an X that discards with no Undo (3/3 raters); F01 Home header "next" at 6 PM while earlier items are open; F05 "Goes to: Auto" unexplained. user-simulation-tests/heuristic/results/2026-11-22-heuristic-tangent-localhost-site-round3.md
  - [x] 8.3 judges [ran: file review, no AI calls]: design 5.5, student advocate 6.0, differentiation 5.7; chair merge JUDGMENT-3.md, mean 5.67 -> 5.80 (Chat, Planning, Differentiation re-scored live). Same top 3 from all three: silent check-in Save, busy times/deadlines + false Because lines, Draft pill after Confirm.
  - [x] 8.4 MORNING-REPORT.md written; npm test 1053/0 [ran], tsc exit 0 [ran]. Spend total $1.59.

OVERNIGHT: COMPLETE
