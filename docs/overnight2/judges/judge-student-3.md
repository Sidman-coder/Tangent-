# Judge: Student Advocate, round 3

Voice: a busy, slightly sceptical 16-year-old who will give an app one evening and one week.
Method: read-only review of files on 2026-11-22. I did not run the app, call any AI or edit code.
Labels: **[F]** fact seen in a file or screenshot, **[I]** inference from facts, **[O]** my opinion as the student.

## What I could and could not see

- [F] Seen:
  - Five round-2 persona sims, with step screenshots and result files (`user-simulation-tests/simulation/results/2026-11-22-*-r2.md`, `docs/overnight2/sims/*-r2-step*.png`).
  - The Phase 1 baseline sims.
  - Live checks L1 to L13 and the Phase 2 and 3 re-checks (`docs/overnight2/live/LIVE-NOTES.md`, `R2-*.png`, `P3-*.png`).
  - Phase 5 screens (`docs/overnight2/screens/p5-*.png`) and Phase 6 privacy screens (`docs/overnight2/screens/phase6/*.png`).
  - The round-3 heuristic report (`user-simulation-tests/heuristic/results/2026-11-22-heuristic-tangent-localhost-site-round3.md`).
  - The AI judge student file (`docs/overnight2/judges/AI-J1-student.md`), AI-RESULTS, DECISIONS O2-D1 to D61, and CONTEXT-ENGINE-NOW section 4.
- [F] Limits:
  - **One shared test account mixes five personas.** Every screen greets "Leo". It holds 31 to 35 items, and Because and Used lines can quote another persona's facts (CONTEXT-ENGINE-NOW section 4).
  - **The browser was headless,** so "Say it" was silent twice for Jordan. That is not a product bug.
  - **The users are synthetic.** These are AI personas, not teenagers.
  - **No real phone was used.** The 390 px shots are a resized desktop browser.
  - The Day-2 card was never seen live (unit tests only, LIVE-NOTES Phase 3.4). "Next up" was never rendered (O2-D48, code only).
- [I] Because of the shared account, the crowding on Home and Calendar and the "creepy" cross-persona facts are partly test artifacts. I discount them.
- [I] I do count these as real product behaviour:
  - plans placed inside hours the student stated
  - a false Why line
  - a silent check-in Save
  - a leftover Draft pill
  - capture fragments
  - Auto filing items into the wrong project

## 1. Scores (1-10), round 2 -> round 3

| Area | R2 | R3 | Evidence |
|---|---|---|---|
| First-use | 5 | 6 | **Better:**<br>[F] Onboarding step 1 names Anthropic's Claude and Deepgram, says "Neither trains on it" and links "How we handle your data" (`screens/phase6/onboarding-consent-390.png`).<br>[F] Public `/welcome`, `/privacy`, `/terms` and `/parents` pages now exist (`app/(public)/*/page.tsx`).<br>[F] The sign-in footer reads "Privacy, terms and contact" (heuristic R3, R2 F11 gone).<br>[F] The question strip now says "A few questions" (O2-D43).<br>**Still weak:**<br>[F] Onboarding says "1 of 9" (`onboarding-consent-390.png`).<br>[F] Jordan quit at step 4 (`jordan-reyes-r2.md`).<br>[O] Nine steps is long for "just let me add my quiz". |
| Chat | 4 (not re-scored) | 6 | **Better:**<br>[F] Router 19/19, talk reply about 3.0 s, distress reply fixed (AI-RESULTS, O2-D5).<br>[F] Leo got real advice back, with his own goal recalled (`leo-brandt-r2.md`).<br>**Still weak:** chat goes silent after a student's own words.<br>[F] Maya's typed correction changed the plan with no reply (`maya-okafor-r2.md`).<br>[F] Priya's "that's my shift" re-plan also got no reply (`priya-nair-r2.md`).<br>[F] Leo's report got "Logged how … went. Thanks for telling me. It helps size the next steps.", and the Thursday step stayed the same. |
| Planning quality | 7 (not re-scored) | 6 | **Better:**<br>[F] Eval 42/64 -> 62/64 (AI-RESULTS).<br>[F] Each step shows Why / Because / You'll have (`live/P3-brief-because.png`).<br>[F] Jordan: "It actually used my practice times" (CONTEXT-ENGINE section 4).<br>**Worse, and live this round:**<br>[F] Stated busy times broke in 3 of 5 sims (PROGRESS 8.1).<br>[F] Priya: Wed 6:30 PM inside her 4-9 shift, with the Because line "comes after your 4-9pm hours".<br>[F] Leo: 2 steps after Friday's test.<br>[F] Maya: the first draft put its only step on the day of the final.<br>[F] A chess plan's Because quotes "Python Competitive Programming Basics round 1, asked …" (`P3-brief-because.png`).<br>[O] A plan that lies about my shift is worse than no Why line. |
| Today (Home) | 7 | 6 | [F] The header "1 left today · next: Keeping a weekly Sunday video upload going without my chem and algebra grades slipping at 6:00 PM" points at a goal sentence (`screens/p5-home-390-light.png`; heuristic F01).<br>[F] Two stacked "Draft plan" pills cover the Evening section (same shot).<br>[F] The X on a pill discards the plan with no Undo (heuristic F07, 3/3 raters).<br>[F] "A few questions" still sits above the day.<br>[I] Some of the clutter is the shared account.<br>[O] I would not get "what now?" in 3 seconds. |
| Calendar | 6 | 6 | **Better:**<br>[F] Colour legend School / Projects / Personal, and agenda titles wrap at 390 (`p5-calendar-390-light.png`; O2-D47).<br>[F] Tapping a circle opens the "How did … go?" card (`sims/maya-okafor-r2-step7.png`).<br>**Still weak:**<br>[F] At 1440 the week view stacks blocks into unreadable "9:" and "3:" chips (`sims/priya-nair-r2-step7.png`).<br>[F] "Finish the missed round 1 step" is still on the list (`p5-calendar-390-light.png`; AI-J1 fix 7).<br>[F] Draft pills cover rows (`sims/sam-patel-r2-step7.png`).<br>[F] Rows do not show the project name (heuristic F12). |
| Projects | 5 | 6 | **Better:**<br>[F] Cards show only the goal (`live/P3-projects-goal-only.png`, O2-D46).<br>[F] "Too big" splits a step into 5/25/10-minute pieces with "Use these / Keep as is" (`live/P3-too-big-split.png`).<br>**Still weak:**<br>[F] Auto filed "Solve 6 exponential equation problems" under Python CP (`live/R2-L9-notime.png`, AI-J1).<br>[F] Sam's "english essay due friday" joined the open ED II draft (`sam-patel-r2.md`).<br>[F] Ticking a step on the project page gave Leo no check-in.<br>[F] "Tangents" is still in the sidebar (`priya-nair-r2-step7.png`; heuristic F04). |
| Settings / You | 6 | 7 | **Better:**<br>[F] "Tangent noticed" rows each have Forget, and Forget really removed 17 rows (`phase6/noticed-390.png`, PROGRESS 6.3).<br>[F] Disconnect Canvas no longer needs Delete-all (`phase6/disconnect-panel-390.png`).<br>[F] "What you can take back" is plain English (`phase6/privacy-controls-390.png`).<br>**Still weak:**<br>[F] Map labels overlap ("Python Comp…" over "AP Chem Final", "School" against "Commitments"), and pills cover the map (`p5-you-mapped-390-light.png`).<br>[F] One row says "You usually finish work around 3am" (`noticed-390.png`). |
| Overall polish | 6 | 6 | [F] There is no sideways scroll, and 1053 tests pass (PROGRESS 5.5, 6).<br>[F] Check-in Save closes with nothing shown in 3 of 5 sims (`components/today/StepFollowUp.tsx:59-78`, O2-D61).<br>[F] The Draft pill stays after Confirm (Priya, Sam).<br>[F] Capture split Leo's sentence into "Get ready" and "I still have to film and edit 's video" (`leo-brandt-r2.md`).<br>[F] "Later" wiped Leo's Added card and its Undo.<br>[F] Leo saw a "Tangent has a question" row with no question in it. |
| Differentiation | 6 (not re-scored) | 7 | [F] The "follows up" half is now visible. The sequence:<br>- the plan shows Because rows<br>- Done asks "How did X go?"<br>- the round sheet leads to Round 2 (`live/P3-round-sheet.png`)<br>- "Tangent noticed" shows what it has learned<br>- goal recall used his stored goal (Leo).<br>[O] No planner I use explains a step with "Because you said…".<br>[I] The edge is capped because the personalisation layer is ahead of the constraint layer (CONTEXT-ENGINE section 4). It sounds like it knows me, then books my shift. |
| **Overall** | **5.5** | **6.0** | [F] 4 of 5 sims did every task action (Phase 1: 1 of 5) and Leo reached his goal (PROGRESS 8.1).<br>[F] But 3 of 5 still ended abandoned or unresolved. |

## 2. Round-2 issues: status now

| Round-2 issue | Status | Evidence |
|---|---|---|
| C01 stacked overlays | FIXED (held) | [F] No sheet or tour on Home (`p5-home-390-light.png`). |
| C02 plan claims sources it did not read | PARTLY | [F] The Because rows name the source. But a Because line quoted another project's round answer (`P3-brief-because.png`; O2-D45 fixed one leak). |
| C03 "Stop and plan" asks again | PARTLY | [F] It is now "A few questions" with Answer / Hide. The stop-and-plan path was not re-observed in the r2 sims. |
| C04 re-asks what was typed | PARTLY | [F] Leo's facts were used. But Priya's stated shift was ignored and one question was re-asked (CONTEXT-ENGINE section 4). |
| C05 silence after Confirm | FIXED | [F] "Saved 5 steps to your calendar" was shown to Maya, Priya and Sam (r2 results). |
| C06 no privacy / terms / parent page | FIXED | [F] `app/(public)/{privacy,terms,parents,welcome}/page.tsx`. The sign-in footer link is present (heuristic R3). |
| C07 toast / draft dock covers buttons | PARTLY | [F] The Draft pill covers rows and the Answer button (heuristic F14; `p5-home-390-light.png`). |
| C08 false praise on Done | FIXED | [F] Done now asks "How did … go?" (O2-D21; `maya-okafor-r2-step7.png`). |
| C09 capture drops items / "Placing…" | PARTLY | [F] Priya got a plan this time (Phase 1: none). But Leo's capture fragmented and duplicated (`leo-brandt-r2.md`). |
| C12 stale / contradictory plan text | PARTLY | [F] The false Why line survived Priya's manual edit (`priya-nair-r2.md`). |
| C13 wall of assumptions | FIXED | [F] One "Why this plan" line plus per-step rows (`P3-brief-because.png`). |
| C15 "How do I…" gets a form | FIXED | [F] Talk route 19/19, and L6 passes (LIVE-NOTES Phase 2). |
| C16 Canvas disconnect only via delete-all | FIXED | [F] The Disconnect panel asks whether items go too (`phase6/disconnect-panel-390.png`, O2-D54). |
| C17 calendar history icon / mic | PARTLY | [F] It reads "Changes" with a label at 390 (`p5-calendar-390-light.png`). The mic still floats over the rows. |
| C18 projects sparse / stale | PARTLY | [F] Goal-only cards. Auto misfiles (`R2-L9-notime.png`). |
| C19 You map clips / zeros | PARTLY | [F] No "0" is visible. Labels overlap (`p5-you-mapped-390-light.png`). |
| C20 wrong labels | PARTLY | [F] Category colours (O2-D47). "Limit problems" appeared in an Algebra plan (`leo-brandt-r2.md`). |
| C21 "follows up" never seen | PARTLY | [F] The check-in and Round 2 were seen live. Save is silent and the note changes nothing (Maya, Priya, Sam). The Day-2 card is tests only. |
| C22 30 s capture wait | PARTLY | [F] The plan takes about 15.9 s (AI-RESULTS). Jordan's one-line add was fast. |
| C23 stale name after reset | OPEN | [I] Untestable: every screen says "Leo" on the shared account. |
| Sign-in "listens" copy | FIXED (code) | [F] Grep finds no "listens" in `app/` or `components/`. Sign-in was not re-shot by me. |
| "Tangents" jargon | OPEN | [F] It is still in the sidebar (`priya-nair-r2-step7.png`; heuristic F04). |
| New 3: no-credit dead end | OPEN (not re-tested) | [F] No evidence either way in round 3. |
| New 4: offline text lost | OPEN (not re-tested) | [F] No evidence in round 3. |
| New 6: Home has little pull | PARTLY | [F] Home now has content and Draft pills, but the header next is a goal sentence. "Next up" is not rendered (O2-D48). |
| New 7: Capture "0 things" vs Home | OPEN (not re-tested) | [F] No Capture shot this round. |
| New 8: clipped Home row | PARTLY | [F] The header wraps in full. The Draft pill title still truncates ("Competitive Program…"). |
| New 10: Settings tab strip clips | OPEN (not seen) | [F] No tab-strip shot in the round-3 set. |
| New 11: Projects intake box + mic | OPEN (not seen) | [F] No empty-Projects shot this round. |
| New 12: School page dead end | OPEN (not seen) | [F] No round-3 shot. |
| New 13: question strip above the day | OPEN | [F] "A few questions" still sits above Morning (`p5-home-390-light.png`). The copy is softer. |
| New 14: data verbs | PARTLY | [O] "Forget" is now used consistently in You, but there is no undo note on Forget / Delete (heuristic F11). |

## 3. Top 5 next fixes (ranked)

1. **Never book a time the student said they are busy, and check the Why line against the slot.** [F] Priya's Wed 6:30 PM sits in her 4-9 shift with a false "comes after your 4-9pm hours" line, and stated times broke in 3 of 5 sims (`priya-nair-r2.md`, PROGRESS 8.1).
2. **Make check-in Save visible and useful: say "Got it, I'll make the next one shorter" and show the change.** [F] Save closed silently for Maya, Priya and Sam (`components/today/StepFollowUp.tsx:59-78`, O2-D61).
3. **Remove the Draft pill after Confirm, and give it a non-destructive Hide in place of a discarding X.** [F] Priya and Sam saw the pill after Confirm, and the X discards with no Undo (heuristic F07, 3/3 raters; `sam-patel-r2-step7.png`).
4. **Reply in words after any correction or report, and act on it.** [F] Maya's and Priya's corrections got no reply, and Leo's report got a generic "Logged how … went" with the step unchanged (r2 results).
5. **Keep a new capture separate from an open draft, show where Auto put it, and offer "Plan study time" on a dated item.** [F] Sam's essay joined the ED II draft, Auto misfiled the exponentials task (`R2-L9-notime.png`), and Jordan had no path from "quiz Friday" to planning (`jordan-reyes-r2-step4.png`).

## 4. Would a student keep using it after a week?

**Maybe: the plans finally feel like they are about me, but the first time one lands on my shift and Save says nothing back, I stop trusting it. Overall 6.0 / 10.** [O]

### Tone check for minors

- [F] Kind:
  - "A few questions to sharpen your plans"
  - "Use these / Keep as is"
  - the distress reply is fixed (O2-D5)
- [F] Still risky:
  - "Heads up: Friday is now over your usual load" read as blame to Jordan (`jordan-reyes-r2-step4.png`).
  - "You usually finish work around 3am" and "You finish about 5 in 10 of the steps that come due" (`noticed-390.png`). A parent may read these as a grade.
  - A 3:10 AM notification (AI-J1).
- [O] Keep "noticed" rows, but phrase them as help, not as a score.
