# AI judge 1: expert planner and learning coach

Lens: does the student actually finish the goal? I judge plan quality (step size, spacing, sequence to a real deadline, practice over re-reading), respect for stated limits, re-planning after misses, and questions that change the plan.

Read-only review. I ran nothing live. Source tags:
- [LN Lx]: `docs/overnight2/live/LIVE-NOTES.md`, Phase 1 section for check Lx.
- [R2 Lx]: the same file, "Phase 2 re-checks" table.
- [D-n]: `docs/overnight2/DECISIONS.md` O2-Dn.
- [shot]: a screenshot in `docs/overnight2/live/`, which I opened and read.
- [eval]: the named `docs/overnight2/eval-*.log`.
- [sim]: `user-simulation-tests/simulation/results/2026-11-22-<persona>.md`. All 5 sims ran **before** the Phase 2 fixes.
- [code]: I read the source file named.
- [inference]: my own reading of the evidence, not a test.

## Scores per live check (current state)

| # | Score | Why |
|---|---|---|
| L1 | 8 | Talk-first on Auto now works. The answer has a real method: "Solve each in under 15 minutes, then read the editorial", "Re-solve every problem you got wrong, cold, a day or two later", 45-min blocks [shot R2-L1-answer.png] [R2 L1]. Minus: it repeats the vague "Finish the missed round 1 step today" and ends on a question that won't change the plan ("Codeforces specifically, or also AtCoder or LeetCode?") [shot R2-L1-answer.png]. |
| L2 | 6 | Topic steps are good and land under 30 s (15.9 s) [R2 L2]. But it made a **second, parallel plan** labelled "Round 1" for a project already in round 2. "Solve 4 sorting and counting problems" is on Wed Nov 25 twice: 3:30 PM in the project, 5:30 PM in the draft [shot R2-L2-brief.png, R2-L9-notime.png] [inference]. One Because cites an unrelated club item ("Find club rules… ends at 8:05 AM") [shot R2-L2-brief.png]. The Thanksgiving Because is fixed by unit test only [D-35]. |
| L3 | 7 | Saves and shows up on Calendar and Today [LN L3]. The header "next:" skips the 9:30 AM plan step for a 6 PM video item. That is a design choice, now with Sid [D-14]. |
| L4 | 8 | Three items become 3 tasks. The DUE line is kept and the dentist stays fixed at Fri 3 PM [R2 L4]. Minus: "start reading Gatsby" gets no due date question and no chunking [shot R2-L9-notime.png shows it as one 4:30 PM item] [inference]. |
| L5 | 7 | The date is right with no model call [LN L5]. The title fix ("Thu" dropped) and Haiku-only follow-ups are in [D-8] [D-17] [R2 L4c]. A test with no time still gets a study-style 3:30 PM slot [LN L5]. "Algebra test 5:30 PM" on Friday shows the same pattern [shot R2-L11-rail.png]. |
| L6 | 7 | Talk-first, not a grill, and "in March" is no longer asked back [R2 L6]. The /capture answer shows raw `##` markdown, which is not fixed [R2 L6] [shot R2-L6-answer.png]. |
| L7 | 8 | No model call, Confirm/Cancel, nothing lost [LN L7]. "Delete 93 tasks" counts each repeat. For a stressed student that number is alarming [LN L7]. Not fixed. |
| L8 | 8 | Done → check-in → "Next: Solve 4 array and loop problems · Tue, Nov 24 3:30 PM" with Undo [R2 L8] [shot R2-L9-first.png]. The check-in codes now feed the round summary ("Steps took longer than planned") [code `lib/rounds.ts` roundSummary]. The check-in it opened was for "Finish the missed round 1 step", a vague step [shot R2-L9-first.png]. |
| L9 | 6 | It now stays near and asks one reason on the 2nd tap [R2 L9] [D-12] [D-36]. But "No time" moves the same-size step 8 days, to Mon Nov 30, and calls it "the lightest day coming up" [shot R2-L9-notime.png] [D-36 "known copy gap"]. A coach would shrink or split the step for "No time". Nothing here does. |
| L10 | 6 | Answers from the project's steps and the 45-min focus fact [LN L10]. The ISO date and stay-on-project fixes are prompt and code only, with no live re-run [D-13] [R2 table footnote]. It still ended on two questions in Phase 1 [LN L10]. |
| L11 | 8 | Names Thanksgiving and the 1.5 h vs 2 h load, suggests a 30–40 min run, and warns that Friday is overloaded [R2 L11] [shot R2-L11-rail.png]. Minus: a loading flash says "Nothing on your calendar" [R2 L11]. |
| L12 | 6 | Phase 1: a topic-aware review, and round 2 used "more practice" [LN L12]. Fixes for naming the open step, "say why it changed" and no duplicate missed step are unit-tested only, with no live re-run [D-19] [D-25]. The vague "Finish the missed round 1 step" is still on Home [shot R2-L2-draft.png]. "Solve 10 limit problems" reads like calculus [LN L12]. |
| L13 | 8 | The distress line gets a kind reply and nothing is saved. Health, mental-health and family answers aren't saved either [R2 L13] [D-5]. Not re-shot after the last rebuild [R2 L13]. Regex detection will always miss some wording [inference]. |

## Overall: 6 / 10

Routing and capture are now solid. The eval went from 42/64 to 62/64 [eval-before.log, eval-after-phase2.log]. The plan brief passed 4/4 quality cases and 2/2 swap cases [eval-quality-phase2.log] [eval-context-phase2.log]. The steps are often good coaching. The loop around them is weak:
- The plan never reaches the deadline.
- A second plan can pile onto the first.
- Stated limits are forgotten after one plan.
- "No time" moves work without making it smaller.

All 5 sims abandoned. They ran before the fixes, and several causes are now fixed [sim ×5] [D-11] [D-21] [D-22]. None of the five has been re-run.

## Top 7 fixes, ranked by impact on finishing the goal

1. **Plan all the way to the deadline, not just week 1.**
   - What's wrong: every plan is 5 steps in Nov 22–28, even for AP Bio in May ("Final date range: 2026-11-22 to 2027-05-01 / Plan sessions: 5 from 2026-11-22 to 2026-11-28") [eval-after-phase2.log l.354-355]. Maya's Dec 17 final "never shows up" [sim maya]. The only trace of the real deadline is the assumption line "later rounds cover the rest" [code `lib/voice-handler.ts:1123`] [shot R2-L6-answer.png].
   - Fix: keep one-week rounds, but show a backward milestone line to the deadline, with a full practice test 2–3 days before it, so round 1 is visibly step 1 of N.
   - Likely files: `lib/rounds.ts`, `lib/voice-handler.ts`.
2. **One plan per goal, filed in the right project.**
   - What's wrong: "Plan this into my calendar" on Leo's competitive-programming goal made a new "Round 1" draft beside the live round-2 project. The same topic is now on the same day twice [shot R2-L2-brief.png, R2-L9-notime.png] [inference]. Algebra steps ("Solve 6 exponential equation problems", "Learn log rules and change of base") sit inside "Python Competitive Programming Basics" [shot R2-L9-notime.png] [sim leo: "filed the Algebra 2 step under Python Competitive Programming Basics"].
   - Fix: when a goal already has an active project, plan into that project's current or next round, and never file a step under a project with an unrelated topic.
   - Likely files: none named for this in the notes. The talk route is `lib/pipeline/talk-route.ts` [LN L1].
3. **Remember stated weekly busy times.**
   - What's wrong: "practice Mon-Fri 3:30-5:30" shaped Jordan's first plan. His next capture still landed at Mon 3:30 [sim jordan]. The avoid-time fix only reads the current request [D-20]. The gap is still open [NEEDS-SID "Stated weekly busy times aren't kept"].
   - Fix: offer a one-tap "Add soccer practice as a busy block?" whenever a request states a weekly time, and have every placement respect it.
   - Likely files: `lib/avoid-times.ts` and the `cmt_` commitments path [NEEDS-SID].
4. **Done must land on the plan step, and the exam must move to its real date.**
   - What's wrong: on the exam task's sheet, "Mark done" completed the whole "AP Chem final", not step 1. The plan's step 1 stayed open [sim maya]. The check-in now opens [D-21], but nothing says the button was retargeted. The placeholder exam date isn't moved when a plan is made ("left for the judges' list") [D-11].
   - Fix: once a goal has a plan, the sheet's Done acts on the next open step and names it. The exam itself moves to the date the student gave.
   - Likely files: the task sheet (`components/TaskDetail.tsx`) [inference from D-21 "task sheet's Mark done"].
5. **"No time" and "Too big" make the step smaller, not just later.**
   - What's wrong: "No time" moved "Physics lab" 8 days, at full size [shot R2-L9-notime.png]. "Unclear" and "blocked" only change the receipt text [D-12].
   - Fix: on "No time", offer one tap to split the step into a 15–20 min starter today plus the rest later, and keep it before any due date.
   - Likely files: `app/api/today/route.ts`, `lib/today-steps.ts` [LN L9] [D-36].
6. **Never place a prep step after its deadline.**
   - What's wrong: Leo's replans kept steps after a Friday test, and one reason even said "Saturday is after the test" [sim leo]. `lib/ai/plan-guard.ts` checks time-of-day clashes, banned phrases and generic titles, but not the deadline [code: grep found no deadline check]. Leo's case was not re-run after the date-reader fixes [D-8] [D-11].
   - Fix: add a guard that drops or moves any step dated on or after the goal's deadline and sends its reason to the existing planFix rewrite.
   - Likely files: `lib/ai/plan-guard.ts`.
7. **Ask fewer, better questions.**
   - What's wrong: Home shows "18 questions to sharpen your plans" [shot R2-L2-draft.png, R2-L9-first.png]. Sam read the count as "more homework" and left [sim sam]. Maya hit 4 rounds of questions, including "how many hours a week" right after Done [sim maya]. The pile also blocked the daily bubble during L13 [R2 L13].
   - Fix: keep at most 3 open questions. Show only ones that would change a live plan, and never show a profile question in the check-in slot.
   - Likely files: none named in the notes.

## Pedagogy: where the plans are strong

- **Practice and retrieval, not re-reading.** "Re-solve Tuesday's problems cold" [LN L2]. "Redo missed problems cold … where most improvement comes from" [shot R2-L2-brief.png]. "Redo missed problems and quiz yourself on equilibrium … without notes" [eval-quality-phase2.log]. "Keep a mistake log" [LN L1].
- **A real test at the end of the week.** "Run a timed virtual contest" (Sat) [LN L2]. "Attempt one timed Bronze contest, then review" [eval-quality-phase2.log].
- **Concrete, countable steps with a visible outcome.** "Solve 4 Codeforces Div 2 A problems … You'll have 4 solved array and loop problems, each timed" [shot R2-L2-brief.png]. "Solve 6 Ksp and ICE-table problems" [eval-quality-phase2.log].
- **Sensible sequence.** Learn → apply → re-solve → timed test → review [LN L2] [R2 L2]. Chem starts by mapping "the first step for equilibrium problems", because the student said that's what unlocks her [eval-quality-phase2.log].
- **Sized to the student.** 45-min blocks under a 2-hour school-night limit are cited in the reasons [LN L2] [shot R2-L2-brief.png]. The step size adapts to what the student finishes (`studentStepMinutes`, `roundStepCount`) [code `lib/rounds.ts`, `lib/voice-handler.ts:999`].
- **Same goal, different student, different plan.** SAT for "math-weak" gets algebra word problems. SAT for "reading-weak" gets question-type mapping [eval-context-phase2.log].
- **Round 2 responds to the review.** "More practice" became more problem sets [LN L12].

## Pedagogy: where the plans are weak

- **No arc to the exam.** Five steps in week 1 for a May exam teach nothing about pacing. Nothing shows interleaved review of earlier units or a final mock before the test date [eval-after-phase2.log l.354-355] [sim maya].
- **Admin and vague steps take a full session.**
  - "Set up Codeforces account" was a scheduled 9:30 AM session [LN L2].
  - "Finish the missed round 1 step" doesn't say what to do [shot R2-L2-draft.png].
  - "Confirm final scope and list units" is a 5-minute job, not a study block [sim maya].
- **Some passive or unclear steps slip through.**
  - "Review stoichiometry and thermochemistry notes" is re-reading [sim maya steps].
  - "Review timed contest tactics" [LN L12] and "Practice Skimming Passage Structure" [eval-context-phase2.log] are low-yield.
  - "Learn log rules and change of base" has no practice count [shot R2-L9-notime.png].
  - "Solve 10 limit problems" is ambiguous for a CP beginner [LN L12].
- **Titles go stale after a move.** "Re-solve Tuesday's problems cold" stayed while Tuesday's step moved to Monday [shot L10-project-chat.png].
- **Reasons that don't fit the step hurt trust.**
  - The Wed Because cites a club-rules item [shot R2-L2-brief.png].
  - The Because quotes a review answer clumsily ("you said 'Python Competitive Programming Basics round 1, asked …: More practice'") [R2 L2].
  - "Since you mentioned you're too sleepy to focus in the morning, this waits until late morning" contradicts itself [eval-quality-phase2.log].
  - Leo: personal reasons that contradict the plan "read like it's just saying stuff to sound like it knows me" [sim leo].
- **Overload is noticed but not fixed.** The rail correctly says Friday is 2.5 h against a 2 h limit [shot R2-L11-rail.png]. Monday has 4 items stacked at 3:30 PM, and the new draft adds a Mon 5:30 PM session on top [shot R2-L11-rail.png, R2-L2-brief.png] [inference].
- **Misses are moved, never shrunk.** Spacing and capacity are respected when placing a step. After a miss, the step keeps its full size [shot R2-L9-notime.png] [D-12].
