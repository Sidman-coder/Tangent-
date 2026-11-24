# Overnight 2: morning report

**Branch:** `push-v1`
- 8 commits from `58b1cc7` to the Phase 8 commit, on top of `e6a6f81`. Nothing is pushed.
- **Tags:** **[ran]** = measured by running it; **[code]** = read in code or unit-tested only.
- Emails are masked, and no `.env*` file was read.

## 1. Summary

1. **The AI was measured live and fixed** [ran].
   - Eval: 42/64 → 62/64 (63/64 with re-runs).
   - Swap test: 2/2. Banned phrases: 0. Router fixtures: 19/19.
   - A talk answer takes about 3 s and a plan about 16 s.
2. **The loop now finishes for most students** [ran]. 4 of 5 persona sims did every task action (capture → plan → save → done → check in), against 1 of 5 at the start of the night.
3. **Three faults now block trust** [ran: sims; code: line refs]. All three judges and the sims named the same three:
   - the check-in Save is silent (3 of 5 sims, `components/today/StepFollowUp.tsx:59-78`)
   - stated busy times and deadlines are broken, while the Because line claims they are kept (Priya, Leo, Maya, Jordan)
   - a "Draft plan" pill stays after Confirm (Priya, Sam)
4. **New since the last overnight** [ran]:
   - "Because you said…" lines on each step
   - the check-in after Done
   - proactive notices cut from 16 AI calls per 16 loads to 0 per 7
   - privacy controls: Disconnect Canvas, Forget everything including habits, "Tangent noticed" with Forget, and a consent line at onboarding
   - public and legal pages
   - one category-colour rule
   - a context-engine map
5. **Panel and cost** [ran]:
   - Panel mean 5.67 → **5.80** (JUDGMENT-3). Chat, Planning and Differentiation were re-scored live for the first time.
   - AI spend is **$1.59 of $20**.
   - `npm test` **1053/1053**, `tsc` clean.

## 2. AI results, before → after

| Measure | Before (Phase 1) | After | Evidence |
|---|---|---|---|
| Eval | 42/64 (66%) [ran] | **62/64 (97%)**; 63/64 with the voice-email-teacher re-runs [ran] | `eval-before.log`, `eval-after-phase2.log` |
| Live checks L1–L13 | L1 pass; L2, L3, L6, L8, L9, L10, L11, L12 partial; L13 fail [ran] | See below | `live/LIVE-NOTES.md` |
| Swap test (personal context changes the plan) | not run | **2/2** [ran] | `eval-context-phase2.log` |
| Banned phrases in plans | not run | **0** in 4/4 quality cases [ran] | `eval-quality-phase2.log` |
| Router fixtures | — | **19/19** [ran] | `talk-route.test.ts`, `router-quick.test.ts` |
| Speed: first talk answer | 2.1–3.8 s [ran] | **3.0 s** (target < 5 s) [ran] | L6, server `[perf]` |
| Speed: full plan | 15.2 s [ran] | **15.9 s** (target < 30 s) [ran] | L2 |
| Cost: one plan | — | **$0.02–0.03** (Sonnet brief + outline, Haiku details) [ran] | `AI-RESULTS.md` |
| Cost: one talk turn | — | **~$0.0005** (Haiku) [ran] | `AI-RESULTS.md` |
| Cost: proactive notices | 16 Haiku calls per 16 loads [ran] | **0 per 7 loads**; ≤ $0.047/month worst case [ran; monthly is an estimate] | `PROACTIVE.md` |
| Unit tests | 979 [ran] | **1053 pass, 0 fail** [ran] | `npm test`, Phase 8 |
| Persona sims, every task action done | 1 of 5 [ran] | **4 of 5** [ran] | PROGRESS 8.1 |
| Heuristic findings | 17 (round 1), then 11 (round 2) [ran] | **17** (round 3): 7 gone, 3 remain, 1 partly fixed, 13 new, mostly because Home and Calendar now show more [ran] | heuristic round-3 report |
| Product panel mean | 5.67 (JUDGMENT-2) | **5.80** (JUDGMENT-3) | `JUDGMENT-3.md` |
| AI spend tonight | — | **$1.59 of $20** [ran] | `AI-SPEND.md` |

**Live checks after the fixes:**
- Pass on re-check [ran]: L1, L2, L4, L4c, L6, L8, L9, L11.
- L13 [ran].
- L3, L5, L7, L10 and L12 are fixed in code [code].

**Eval failures left:**
- `r4-help-me-sat` is flaky. The classifier sometimes reads "help me get ready for the SAT" as a question.
- The fixture choice for it is in NEEDS-SID.

## 3. What changed, per commit

| Commit | Phase | What |
|---|---|---|
| `58b1cc7` | 0 | Progress docs. `TANGENT_PERF` opt-in cost lines in the server log [ran]. |
| `ec01a35` | 1 | AI baseline [ran]: eval 42/64, live checks L1–L13 with screenshots, 5 persona sims. Spend $0.62. |
| `b770384` | 2 | Fix loop (O2-D5 to O2-D44) [ran]: rule fast paths for multi-item captures and exam placeholders, a lookup-only agent loop, goal-with-timeframe → plan, distress replies never saved, the holiday Because line, Sunday "this week", a re-plan deadline cap. Eval 62/64. AI judges 6/10 each (`AI-JUDGMENT-1.md`). |
| `e3dbdef` | 3 | Visible follow-up: "Because you said…" rows (`lib/because.ts`), Day-2 card (`lib/today-steps.ts`; unit tests only [code]), Round 2 change line, "Too big" split. Live checks [ran] (O2-D45, O2-D46). |
| `129c221` | 4 | Proactive notices gated by rules first: 16 calls per 16 loads → 0 per 7 [ran] (`PROACTIVE.md`). |
| `07d5e6d` | 5 | Website: public, legal and parent pages, the auth gate (13/13 [ran]), Deepgram opt-out, one category-colour rule (27/27 tests [ran]), Next up [code], strip placement, labels, map fixes, removal words. Screens `screens/p5-*`. |
| `44f1a7f` | 6 | Privacy controls Sid approved: Disconnect Canvas (live POST 200 [ran]), Forget everything now includes `step_events` [code + tests], "Tangent noticed" rows with Forget (live Forget 200, 17 removed, test account [ran]), consent line on onboarding step 1 and the Help and privacy page. |
| `443498b` | 7 | `CONTEXT-ENGINE-NOW.md`: storage map, 23 real test-account facts, pack scoring and budgets, good vs ignored quotes, matching probes (8 of 11 miss), 12 profile gaps, cost per feature. No code. |
| Phase 8 | 8 | Round-2 sims ×5, heuristic round 3, 3 judges → `JUDGMENT-3.md`, this report. No code (O2-D61). |

**Total since `e6a6f81`:** 280 files, +6896/−492 [ran: `git diff --shortstat`]. This is before the Phase 8 commit; most of it is screenshots and docs.

## 4. Screenshots, before → after

All paths are under `docs/overnight2/` unless they start with `docs/overnight/`.

| What | Before | After |
|---|---|---|
| Talk answer on Home | `live/L1-answer.png` | `live/R2-L1-answer.png` |
| Plan brief | `live/L2-brief.png` | `live/R2-L2-brief.png` |
| Capture answer | `live/L6-capture.png` | `live/R2-L6-answer.png` |
| Check-in after Done | `live/L8-checkin.png` | `live/R2-L8-done.png` |
| "Not today" / re-plan | `live/L9-not-today-1.png`, `live/L9-not-today-2.png` | `live/R2-L9-first-after-fix.png`, `live/R2-L9-reason.png`, `live/R2-L9-notime.png` |
| Calendar rail | `live/L11-calendar-rail.png` | `live/R2-L11-rail.png` |
| Home | `docs/overnight/screens/after/final-home-390.png` | `screens/p5-home-390-light.png` (also 1440, dark) |
| Calendar | `docs/overnight/screens/after/final-calendar-390.png` | `screens/p5-calendar-390-light.png` |
| Heuristic screens | `docs/overnight/screens/after/heur-*.png` | `screens/heuristic3/heur-*.png` |

**New screens with no before:**
- `live/P3-brief-because.png`
- `live/P3-too-big-split.png`
- `live/P3-round-sheet.png`
- `live/P3-projects-goal-only.png`
- `screens/phase6/noticed-390.png`
- `screens/phase6/disconnect-panel-390.png`
- `screens/phase6/onboarding-consent-390.png`
- `screens/phase6/privacy-controls-390.png`

**Sim steps:** `sims/<persona>-r2-step*.png` (round 2) and `sims/<persona>-<id>-step*.png` (Phase 1).

## 5. NEEDS-SID

Full detail is in `docs/overnight2/NEEDS-SID.md`. The open items, most important first:

1. **The top 3 fixes from sims and judges**, not built tonight under O2-D61 (no code in Phase 8):
   - the silent check-in Save
   - stated busy times and deadlines as hard blocks, with a Because-line truth check
   - clear the Draft pill on Confirm and replace its × with a non-destructive Hide

   All are routine code. Say "go" and they are next.
2. **Stated weekly busy times aren't kept for later captures** (Jordan, Maya).
   - Storing them needs a decision on where they live, and may need a schema change.
   - A proposed migration goes in `proposed-migrations/` if you choose the table route.
3. **Voice token 502 on the local build**, so "Say it" is silent. This needs a real phone and a key check you do.
4. **Home header "next:"** shows a long title while earlier items are open (O2-D14, heuristic F01).
5. **SMART (Sonnet) features for the free tier.** Free users get Haiku only (O2-D17). Which Sonnet features, if any, stay paid-only?
6. **AI routing questions:**
   - the `r4-help-me-sat` fixture
   - round-2 router title and slot misses
   - the AI judge proposals in `AI-JUDGMENT-1`
7. **A planner fact from one project steering another project** (seen live in Phase 3.4).
8. **Legal pages:** what was changed from your draft, and what you must confirm before going public.
9. **Phase 5, 6 and 7 follow-ups:**
   - `step_events` is missing from the data export (`EXPORT_TABLES`)
   - log the context-pack size per call
   - a profile document
   - project matching (8 of 11 probes miss)

## 6. Decisions made

DECISIONS.md has **61** entries, O2-D1 to O2-D61. The ones that shape the product:

- **O2-D5:** distress lines in the follow-up bubble get the kind reply and are never saved.
- **O2-D8 / O2-D27:** rule fast paths for multi-item captures, due-day notes and exam placeholders, with no model call.
- **O2-D10:** an unusual goal with a time frame is a plan, not a question.
- **O2-D17:** free users get Haiku only; Sonnet features are listed for you.
- **O2-D24:** proactive notices are gated by rules before any AI call.
- **O2-D41 to O2-D44:** the judge fixes that need no AI calls:
  - re-plan deadline cap
  - "Too big" split
  - "a few questions"
  - Because names a fixed item
- **O2-D45 / O2-D46:** a round answer leaked as a stored record (fixed), and project cards show only the goal.
- **O2-D47:** one category-colour rule everywhere.
- **O2-D54 to O2-D58:** the privacy controls, as you approved them.
- **O2-D59 to O2-D61:** Phase 8 method (sims one at a time, the judge panel, no code fixes in Phase 8).

## 7. What Sid must check on a real phone

None of these could be tested headless.

1. **Voice:** "Say it" on Home. Does it record and transcribe, or still fail with the token 502? Headless had no mic [ran: silent twice for Jordan].
2. **Check-in after Done:** tick a step, pick Okay, and Save. Today it closes silently [code: `StepFollowUp.tsx:59-78`]. Confirm it looks as broken on the phone as it did in the sims.
3. **Tap targets:**
   - Disconnect, Forget, Nailed it/Okay/Struggled, and the onboarding consent links should all be 44px [ran at 390 in Playwright].
   - Check them with a thumb.
4. **No sideways scroll** at phone width on Home, Calendar and You → mapped [ran at 390].
5. **Overlays:**
   - Does the mic button cover an agenda row or the check-in card?
   - Do two Draft pills stack over content? [ran: screenshots]
6. **The consent line on onboarding step 1:** does it read clearly in both light and dark?
7. **Speed on mobile data:**
   - a talk answer should come in under 5 s
   - a full plan should come in under 30 s, with the "Placing…" state

## 8. How to review or revert

- **See everything:**
  - `git log --oneline e6a6f81..HEAD`
  - `git diff --stat e6a6f81..HEAD`
- **One phase:** `git show <sha>`, using the SHAs in section 3.
- **Undo one phase:** `git revert <sha>`. Phases 0, 1, 7 and 8 are docs-only. Revert later phases first if two touch the same file.
- **Undo the whole night:** `git revert --no-commit e6a6f81..HEAD`, then `git commit`. Do this only if you mean it.
- **Nothing is pushed.** Push only when you choose to.
- **Test account:**
  - Jordan's sim left "geometry quiz" on **Fri Nov 27, 4:30 PM**.
  - The sims added plans from all five personas.
  - No deletion was run except the Phase 6 Forget of "How you plan" (17 rows, test account only).
- **Server:** a production server may still be running on :3000 from this run. Stop it when you're ready.
