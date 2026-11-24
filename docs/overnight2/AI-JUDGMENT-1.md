# AI judgment 1 (Phase 2, after fix loop 1)

Three judge subagents read the live notes and screenshots (`live/`), `eval-before.log` / `eval-after-phase2.log` and the Phase 2 eval logs, the five Phase 1 sim results and DECISIONS. Each wrote its own file; this is the chair's merge.

- Student, 16 (`judges/AI-J1-student.md`): **6/10**. "Maybe for a few days."
- Learning coach (`judges/AI-J1-coach.md`): **6/10**
- Differentiation vs ChatGPT / Notion / Todoist (`judges/AI-J1-differentiation.md`): **6/10**. The lead is "real but narrow".

The judges judged the current state. Fixes that were only unit-tested (L3, L5, L7, L10, L12, L13 not re-shot) kept most of their Phase 1 marks. All five sims ran before the Phase 2 fixes and quit early. They are re-run in Phase 8.

## Score per live check

| Check | Student | Coach | Diff. | Mean | Chair's note |
|---|---|---|---|---|---|
| L1 talk answer | 7 | 8 | 6 | 7.0 | Specific to Leo; ChatGPT can do the same answer |
| L2 plan brief | 6 | 6 | 7 | 6.3 | Best demo moment. Wed Because cites an unrelated club item; a second plan sat beside the live round-2 project |
| L3 header "next" | 7 | 7 | 6 | 6.7 | Header names a diary-like title (NEEDS-SID) |
| L4 multi-capture | 8 | 8 | 5 | 7.0 | Works; Todoist parses dates too |
| L5 one-liner on Haiku | 6 | 7 | 3 | 5.3 | Cheap and fine, not a differentiator |
| L6 /capture talk | 6 | 7 | 5 | 6.0 | Raw `##` markdown (fixed after judging, O2-D40) |
| L7 delete confirm | 7 | 8 | 5 | 6.7 | "93 tasks" counts each repeat |
| L8 Done → Next | 8 | 8 | 7 | 7.7 | Demo moment; the shown step was the vague "Finish the missed round 1 step" |
| L9 Not today ×2 | 7 | 6 | 7 | 6.7 | Asks why. "No time" only moves the step (8 days later) and never shrinks it |
| L10 project chat | 6 | 6 | 5 | 5.7 | Fixed in code only |
| L11 calendar rail | 8 | 8 | 7 | 7.7 | Holiday-aware, real load numbers |
| L12 round review → round 2 | 5 | 6 | 6 | 5.7 | Fixed in code only; the vague missed step is still on screen |
| L13 distress line | 8 | 8 | 2 | 6.0 | Fixed in code with unit tests. Diff. judge: a phrase list, not re-shot live |

## Ranked fix list (merged)

| # | Fix | Judges | Evidence | Loop-1 action |
|---|---|---|---|---|
| 1 | **Deadlines are hard limits.** A re-plan must never move a prep step past its test, and it should say what moved | all 3 | Leo sim (steps after a Friday test; "Saturday is after the test"); `lib/ai/plan-guard.ts` and `rebuild` have no deadline check | **Fix**: `rebuild` caps a plan step before the plan's earliest dated exam or due item (O2-D41) |
| 2 | **"No time" should make the step smaller, not only later** | coach, diff. | `R2-L9-notime.png` moves a full step 8 days | **Fix**: the "No time" move offers "Split it" (the existing Too big split) (O2-D42) |
| 3 | **Fewer questions; the pile count keeps growing** (6 → 18) | student, coach | `R2-home.png`, Sam sim | **Fix (copy)**: Home says "A few questions…" not "18 questions…" (O2-D43). The pile itself is NEEDS-SID |
| 4 | **Round 2 leftovers**: the vague "Finish the missed round 1 step" and the duplicate | all 3 | `R2-L8-done.png`, LIVE-NOTES L12 | Fixed in code (O2-D19); **re-run live** in Phase 3.4 |
| 5 | **Because cites unrelated items** | student, diff. | `R2-L2-brief.png` (Wed: "Find club rules… ends at 8:05 AM") | **Fix**: prefer a fixed item (class, practice, event) over a to-do (O2-D44) |
| 6 | **Weekly busy times aren't remembered** | all 3 | Jordan, Priya sims | Product choice, already in NEEDS-SID |
| 7 | **Wrong project / one plan per goal** | student, coach | `R2-L9-notime.png` (algebra steps under Python CP) | Test-account data from Phase 1 L2 sat beside round 2; not re-filed. NEEDS-SID: offer "Add to <project>?" when a goal matches an open project |
| 8 | Check-in answer should change the next step, and say so | diff. | `R2-L8-done.png` | Not in loop 1. "Struggled" already logs a feel code. Proposal in NEEDS-SID |
| 9 | Plans cover only week 1 of a May goal | coach | eval-after lines 354-355 | **By design** (rounds: "later rounds cover the rest", `lib/voice-handler.ts:1123`). The chair disagrees with the coach |
| 10 | L13 is a phrase list; re-shoot live | diff. | O2-D5 | Re-shot in Phase 3.4 if the bubble is free |

Resolved disagreement: the diff. judge saw `voice-email-teacher` failing with 6 duplicate adds in `eval-after-phase2.log` (4:23 AM). The O2-D29 de-duplication landed after that run, and the single-case re-runs passed 2/2 (scratchpad two-1.log 4:32 AM, two-2.log). Both are true, for different builds.

## Loop decision
The eval targets are met (62/64, swap 2/2, quality 4/4, router 100%, speed). Loop 1's fixes above are deterministic (no new AI calls) and unit-tested. A second paid loop isn't needed for the targets. The live re-checks of L8, L12 and L13 happen in Phase 3.4 on the new build, and Phase 8's sims re-judge the whole loop.
