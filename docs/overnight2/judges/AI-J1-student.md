# AI judge J1: a 16-year-old student

Point of view: I'm 16. I have school, a club and a side goal (say, Codeforces). I'll drop an app that wastes my time, sounds like a robot, or gets my week wrong.

How I judged: current state. Phase 2 re-check row where one exists, else Phase 1 notes plus DECISIONS. "[ran]" = re-checked live. "[code]" = only unit-tested. Sources are in brackets after each claim. Files are under `docs/overnight2/` unless a path says otherwise. Screenshots are in `docs/overnight2/live/`. I didn't run the app.

## Scores per live check

| # | Score | Why (evidence) |
|---|---|---|
| L1 "how do I get better at competitive programming" | **7** | It answers now, no quiz. The answer is specific: Div 2 A/B, timed solves, my 45-min focus. It ends with a plan button. [LIVE-NOTES R2 L1; `R2-L1-answer.png`]. Minus: it tells me to "Finish the missed round 1 step" without naming the step. It also says to move "array and exponential problems". Exponentials are my algebra stuff, filed in the wrong project. [`R2-L1-answer.png`] |
| L2 "Plan this into my calendar" | **6** | Steps fit the topic and arrive in 15.9 s [LIVE-NOTES R2 L2]. The "Because" lines hurt it. Mon quotes the app's own form at me. Wed cites an unrelated club item "ends at 8:05 AM". Thu said "School ends at 3:00 PM" on Thanksgiving. [`R2-L2-brief.png`]. The Thanksgiving line is fixed in code only (O2-D35, unit test). |
| L3 Confirm | **7** | Clear "Saved 5 steps… First up… Undo" [`L3-saved.png`]. Minus: the header "next:" skips my 9:30 AM plan step and names a 6 PM item. Not changed (O2-D14, NEEDS-SID). [`R2-home.png`] |
| L4 three items in one line | **8** | Now makes 3 tasks, keeps the DUE day, dentist at Fri 3 PM [LIVE-NOTES R2 L4]. I can see Math hw Mon, Gatsby, Dentist Fri 3:00 PM in Coming up [`R2-L9-notime.png`]. This is the most common thing I'd type, and it works. |
| L5 "chem test Thu Dec 17" | **6** | Date right, no model call [`L5-capture.png`]. But it says "Added Chem test Thu for Thursday at 3:30 PM". The title has a leftover "Thu", and a test got a study-style 3:30 slot. The title fix is unit-tested (O2-D28) and was live-checked on a different line (L4c). Nothing in DECISIONS fixes the test time. |
| L6 "help me get ready for the SAT in March" | **6** | Talks first now, no "When is this?" after I said March [LIVE-NOTES R2 L6, O2-D15]. But the /capture answer shows raw `## ` markdown ("## Get…" in `R2-L6-answer.png`), and that was logged but not fixed. It looks broken. |
| L7 "delete all my tasks" | **7** | Safe: one confirm card, Cancel works, no model call [`L7-delete-confirm.png`]. But "Delete 93 tasks and 1 project?" scares me when I have about 7 things. A repeating item is counted 93 times [LIVE-NOTES L7]. Not fixed. |
| L8 Done on a step | **8** | Done → "How did … go?" → "Next: Solve 4 array and loop problems · Tue, Nov 24 3:30 PM" with Undo [`R2-L8-done.png`]. That's what I want. Minus: the step I finished is the vague "Finish the missed round 1 step". |
| L9 "Not today" twice | **7** | First tap keeps it near (Sun → Wed Nov 25). Second tap asks one reason. "No time" moves it [`R2-L9-first-after-fix.png`, `R2-L9-reason.png`, `R2-L9-notime.png`]. Minus: the toast says "the lightest day coming up" for Mon, Nov 30, a week out (O2-D36 known gap). |
| L10 project chat "what should I do first?" | **6** | Answers from the project's steps and my 45-min focus [LIVE-NOTES L10]. The Phase 1 reply had "Monday, 2026-11-23", wandered into my video upload, and ended with two questions [`L10-project-chat.png`]. The date and stay-on-project fixes are code only (O2-D13). Not re-run live. |
| L11 calendar rail "can I fit a run in Thursday?" | **8** | Gets Thanksgiving right ("no school that day"), gives load vs capacity, warns Friday is overloaded, no ISO dates [`R2-L11-rail.png`, LIVE-NOTES R2 L11]. Best answer in the set. Minus: "Since you do your best work late at night" again, and a "Nothing on your calendar" flash while loading. |
| L12 finish a round | **5** | The X-ed old steps are nice [`L12-review-last-2.png`]. But live it asked "Which step did you not finish…?" when only one was open [`L12-review-1.png`]. Round 2 added a vague "Finish the missed round 1 step" plus a duplicate. Week 1 of the preview is mostly past days [`L12-review-last-2.png`]. The fixes are code plus unit tests only (O2-D19, O2-D25). Not re-run live. The vague step is still on my Home [`R2-L2-draft.png`]. |
| L13 sensitive line in the bubble | **8** | Before the fix it replied "Got it. Tangent will plan with that." and saved it [`L13-bubble-reply.png`]. That's the worst thing in the whole report. Now the exact line is in a unit test (`lib/student/follow-ups.test.ts:107`). The reply sends me to a trusted adult and 988, and nothing is saved (`lib/student/sensitive.ts:68`, O2-D5). Not shown live after the last rebuild [LIVE-NOTES R2 L13], so not a 10. |

## Overall: **6 / 10**

Would I keep using it tomorrow? Maybe for a few days. The quick capture, the calendar rail and the Done → Next flow are better than Notion. But the pile of questions, my algebra steps showing up in my coding project, and plans that don't stick to what I said would make me stop trusting it by the end of the week.

Context: all 5 persona sims ended "Abandoned" [results `2026-11-22-*.md`, line 5-6 of each]. They ran before the Phase 2 fixes, and several of their blockers are now fixed (O2-D11, D20, D21, D22, D33). The ones below are not.

## Top 7 fixes, ranked by how much they'd change my day

### 1. The plan doesn't hold my deadline, and replans happen without a word
- Wrong: I said the test is Friday. The plan put log practice on Sat and a "final check" on Sun. Two typed corrections each swapped the plan silently. One "why" even said "Saturday is after the test", and the step stayed. [Leo sim, steps 4-5, `results/2026-11-22-leo-brandt-c9v.md`]. 9 of 14 steps went to fixing the plan by hand [same, Synthesis].
- Status: O2-D11 fixed reading month dates like "Thu Dec 17". Nothing in DECISIONS covers a weekday deadline ("Friday") as a hard cutoff, or a written reply after "Reply to Tangent". Not re-tested since.
- Fix: treat a stated test day as a hard cutoff for placing study sessions, and answer every replan with one line saying what changed.
- File: plan placement (`firstOpenTime`/`PlacementRules`, see O2-D20) and the plan brief in `lib/voice-handler.ts`. The notes don't name the exact spot.

### 2. My weekly practice and shift times aren't remembered
- Wrong: Jordan said "soccer Mon-Fri 3:30-5:30". The first plan respected it, but a later capture landed "Club pitch draft" Mon 3:30 PM, right on practice [Jordan sim step 8]. Priya's bakery shifts became an empty "Work" project and her ED II deadline was dropped [Priya sim step 4]. Still open [NEEDS-SID "Stated weekly busy times aren't kept"].
- Fix: when I state a weekly time with an activity, offer one tap to save it as a busy block. Every later placement then avoids it.
- File: the commitments path (`cmt_` series) per NEEDS-SID, read by `firstOpenTime`.

### 3. Auto puts my stuff in the wrong project
- Wrong: my Algebra 2 prep was filed under "Python Competitive Programming Basics", tag ECs [Leo sim step 12]. It's still there: "Solve 6 exponential equation problems" and "Learn log rules and change of base" are labeled Python Competitive Programming Basics [`R2-L9-notime.png`]. It leaks into the AI too. The CP answer tells me to move "the array and exponential problems" [`R2-L1-answer.png`]. No DECISIONS entry covers it.
- Fix: only file into an existing project when the subject matches, otherwise make or suggest a class project, and show the project on the brief before Confirm.
- File: Auto destination in `components/add/AddFlow.tsx` and the server's project match (not named in the notes).

### 4. Too many questions, and the count keeps growing
- Wrong: Home says "18 questions to sharpen your plans" [`R2-home.png`]. It was 6 in Phase 1 [`L7-delete-confirm.png`], 9 to 12 during the sims [Sam sim step 2], and 12 in the palette [`L4b-capture-result.png`]. Toasts pop up: "Tangent has 3 questions About 'Physics lab'" [`R2-home.png`] and "3 questions About 'Chem test Thu'" [`L7-delete-confirm.png`]. Three personas called it homework [Leo step 1, Priya step 1, Jordan step 1]. The 6-question card also blocked the safety bubble [LIVE-NOTES L13, R2 L13]. This breaks "ask until enough". A one-line "Physics lab" doesn't need 3 questions.
- Fix: cap open questions (one per task, a few total), drop ones I've ignored, and never toast about them.
- File: `lib/task-questions.ts:51` (the "Tangent has N questions" title) and the Home questions strip.

### 5. The header "next:" points at a diary sentence, not my next step
- Wrong: "next: Keeping a weekly Sunday video upload going without my chem and algebra grades slipping at 6:00 PM". A 9:30 AM plan step came first [`R2-home.png`, LIVE-NOTES L3]. My goal sentence was stored as a task title. That's not scannable in 3 seconds. Left on purpose and sent to Sid (O2-D14, NEEDS-SID).
- Fix: name the next open item of any kind, and shorten goal sentences to a 3-5 word title.
- File: `lib/today-sections.ts` `glanceLine` and its pinned test (NEEDS-SID).

### 6. "Because" lines quote the app's internals or cite unrelated things
- Wrong: Mon: "you said "Python Competitive Programming Basics round 1, asked "Should next round include more practice problems, or fewer?": More practice"". Wed: "Find club rules: approval form, room booking pr... ends at 8:05 AM on Wed, Nov 25, plus 3 more" [`R2-L2-brief.png`]. Leo: reasons that sound personal but contradict the plan "read like it's just saying stuff to sound like it knows me" [Leo sim, Synthesis].
- Fix: write review answers as plain words ("you asked for more practice") and only cite a calendar item that's on the same day and near the slot.
- File: `lib/because.ts` (O2-D25).

### 7. Round 2 leftovers: a vague step name, a duplicate, and an unchecked round review
- Wrong: "Finish the missed round 1 step" is on Home, in the palette's "Next for…" and in the L8 check-in [`R2-L2-draft.png`, `L4b-capture-result.png`, `R2-L8-done.png`]. The real step "Run a timed virtual contest" was still listed too [LIVE-NOTES L12, `R2-L9-notime.png` Sat Nov 28]. The fix (O2-D19) is unit-tested only, and L12 wasn't re-run live.
- Fix: re-run L12 live after O2-D19, and rename or merge any existing "missed round N step" item to the real step's title.
- File: `lib/round-review.ts` (O2-D19).

Close runner-up: raw `##` markdown in the /capture answer [`R2-L6-answer.png`, LIVE-NOTES R2 L6]. It's a cheap fix and it's very visible.

## Robotic, preachy or generic moments (quoted)

- "Got it. Tangent will plan with that." Its reply to a suicidal-sounding line [`L13-bubble-reply.png`]. Fixed in code (O2-D5), but this is the line that would make a parent delete the app.
- "Since you do your best work late at night…" shows up in L1 (Phase 1 transcript, LIVE-NOTES L1), again in L1 Phase 2 [`R2-L1-answer.png`] and in L11 [`R2-L11-rail.png`]. Phase 1 also had two "Since you…" sentences in a row [LIVE-NOTES L1]. After the third time it feels like a template, not like it knows me.
- "you said "Python Competitive Programming Basics round 1, asked "Should next round include more practice problems, or fewer?": More practice"" [`R2-L2-brief.png`]. A form pasted back at me.
- "18 questions to sharpen your plans" / "Tangent has 3 questions About "Physics lab"" [`R2-home.png`]. Feels like homework from my planner.
- "Delete 93 tasks and 1 project?" [`L7-delete-confirm.png`]. Alarming math.
- "The task list was cut off, so I'll check the busiest upcoming dates to avoid collisions." [Priya sim step 4]. Machine talk, then it vanished. Replaced in code with "That plan got too long to finish, so nothing was added. Try asking for just the first week of it." (`lib/ai/agent-cutoff.ts:17`) [code, not re-run].
- "Finish the missed round 1 step (it's due now)… Don't let it block the week." [`R2-L1-answer.png`]. Vague and a little naggy.
- "Your first open step is Practice dict frequency counting on Monday, 2026-11-23" [`L10-project-chat.png`]. Nobody says dates like that. Fixed in code (O2-D13).
- "Thanksgiving week: Thursday is Thanksgiving, so the day may be more relaxed or packed with family plans" [LIVE-NOTES L11 Phase 1]. Filler.
- A notification at 3:10 AM: "Your Codeforces account setup is due today at 9:30 AM. Getting it done now keeps the rest of your Sunday open for the video." [`L7-delete-confirm.png`, clock 3:10 AM]. "Getting it done now" at 3 AM is the wrong nudge.
- Turning my "went fine, took 20 min" into a new task, or into "5 more things to do" [Jordan sim step 8, Leo sim step 14]. Fixed for the chat route (O2-D22, unit tests). /capture and the palette still don't handle it (O2-D22).

What felt human and good: the L11 Thanksgiving answer [`R2-L11-rail.png`], "Next: … · Tue, Nov 24 3:30 PM" after Done [`R2-L8-done.png`], and the new distress reply in `lib/student/sensitive.ts:68` ("Your plans can wait.").
