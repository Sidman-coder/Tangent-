# JUDGMENT-3: product panel, round 3 (overnight 2, Phase 8)

Panel (O2-D60):
- design judge: `judges/judge-design-3.md`
- student advocate: `judges/judge-student-3.md`
- differentiation judge: `judges/judge-differentiation-3.md`

Each judge worked from files only: the round-2 persona sims and Phase 1 baselines, heuristic round 3, LIVE-NOTES, AI-RESULTS, CONTEXT-ENGINE-NOW and the screenshots. None ran the app or made AI calls, and none read another judge's file. The chair merged the three files below.

Scale is 1–10, the same nine areas as `docs/overnight/JUDGMENT-2.md`.

**Panel change:** round 2 had an investor judge; round 3 has a differentiation judge in that seat. The differentiation judge used the JUDGMENT-2 chair mean as its round-2 baseline.

**Re-scored areas:** in round 2, Chat, Planning quality and Differentiation were carried over because the AI could not run. They are re-scored in round 3 from live AI runs, the first time since round 1.

## Scores

| Area | R2 mean | Design R3 | Student R3 | Differentiation R3 | **R3 mean** | Change |
|---|---|---|---|---|---|---|
| First-use | 4.33 | 5 | 6 | 5 | **5.33** | +1.00 |
| Chat | 4.33 (not re-scored) | 5 | 6 | 5 | **5.33** | +1.00 |
| Planning quality | 6.33 (not re-scored) | 5 | 6 | 6 | **5.67** | −0.67 |
| Today (Home) | 6.33 | 5 | 6 | 6 | **5.67** | −0.67 |
| Calendar | 6.33 | 6 | 6 | 6.5 | **6.17** | −0.17 |
| Projects | 5.00 | 5 | 6 | 5 | **5.33** | +0.33 |
| Settings / You | 6.00 | 6 | 7 | 6.5 | **6.50** | +0.50 |
| Overall polish | 6.33 | 5 | 6 | 5.5 | **5.50** | −0.83 |
| Differentiation | 6.00 (not re-scored) | 7 | 7 | 6 | **6.67** | +0.67 |
| **Mean** | **5.67** | 5.44 | 6.22 | 5.72 | **5.80** | +0.13 |

Single overall verdicts:
- design: 5.5
- student advocate: 6.0, up from 5.5
- differentiation: 5.7

Source: each judge's file, section 1 and verdict.

## What the panel agrees on

**Up: the loop now finishes [fact, all three].**
- 4 of 5 round-2 sims did every task action (Phase 1: 1 of 5). Source: PROGRESS 8.1a–e.
- That is why First-use, Chat and Differentiation rose.
- The judges named what is clearly better than ChatGPT, Notion or Todoist:
  - one typed sentence becomes a dated plan placed on the calendar, with a reason for each step
  - the check-in after Done arrives unasked
  - capacity reasoning, e.g. "Thursday, Nov 26 is Thanksgiving, so there's no school that day…"
  - (`judge-differentiation-3.md` §2)

**Down: the finish feels untrustworthy [fact, all three].** Planning, Today and Polish fell because more of the app now shows on screen, and three faults now show with it.

## Top 3 fixes: every judge named all three, only the order differs

1. **The check-in Save is silent.**
   - It closes with nothing in its place, and hit 3 of 5 sims (Maya, Priya, Sam). Two of them marked the task unresolved for this alone.
   - The code is at `components/today/StepFollowUp.tsx:59-78`.
   - Fix: confirm what was logged, and show what changed in the next step.
2. **Stated busy times and deadlines are broken, and the Because line claims they are kept.**
   - Priya's step was placed inside her 4–9 PM shift with "comes after your 4-9pm hours".
   - Leo had 2 prep steps after his test.
   - Maya's only study step landed on the day of her final.
   - Jordan's untimed quiz was placed in practice.
   - Fix: treat these as hard blocks in the planner guard, and reject a Because line that contradicts its slot.
3. **The "Draft plan" pill stays after Confirm.**
   - Its only dismiss is an × that discards, with no Undo. Source: heuristic F07, 3/3 raters; Priya and Sam.
   - At 390 it stacks two-high over content (design judge, `p5-*-390-light.png`).
   - Fix: clear it on Confirm and replace the × with a non-destructive Hide.

**Also named by two or more judges:**
- Reply in one line to every correction or replan, saying what moved. Maya's and Priya's corrections got no chat reply.
- Capture should be at least as good as Todoist quick add:
  - keep the student's words (Leo's "edit 's video")
  - make an untimed capture date-only, with a "Plan study time" offer (Jordan)
  - never fold a new capture into an open draft (Sam)
  - explain "Goes to: Auto" (F05)

**Named by one judge:**
- design: the Home header "next" names a long title while earlier items are open (F01).
- design: the mic button covers rows and the check-in card at 390.
- differentiation: record a real two-day run, so the Day-2 card is shown live.

## Dissent

**Design vs student advocate: Planning and Today.**
- The design judge scores 5 and 5. The student advocate scores 6 and 6.
- The student advocate weighs personal plans that students want to return to.
- The design judge weighs reasons that read false.

**Differentiation score.**
- The differentiation judge gives Differentiation 6: the follow-up "changes nothing", so it reads like a form.
- The other two give 7, because the calendar placement alone beats competitors.

## Limits [fact]

- All five personas shared one test account, so the greetings and items mixed between personas.
- The browser was headless with no mic, so "Say it" could not be tested.
- The users were synthetic.
- Nothing was run on a real phone.
- The Day-2 card was verified only by unit tests.
