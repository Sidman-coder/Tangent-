# AI Judge J1: Differentiation vs ChatGPT, Notion and Todoist

Question: where does Tangent's AI do something a student could not get by pasting the same request into ChatGPT, or typing it into Notion or Todoist? Where is it only equal, or worse?

Read-only review, 2026-11-22. No app run. Scores judge the **current state** (Phase 2 re-checks where they exist, else Phase 1).

## Source keys

- **[LN Ln]**: `docs/overnight2/live/LIVE-NOTES.md`, Phase 1 check Ln.
- **[R2 Ln]**: same file, "Phase 2 re-checks" table.
- **[D-n]**: `docs/overnight2/DECISIONS.md` O2-Dn. **[ran]** = re-checked live or by test run; **[code]** = unit-tested only.
- **[EVAL]**: `docs/overnight2/eval-after-phase2.log` (62/64).
- **[SWAP]**: `docs/overnight2/eval-context-phase2.log` (2/2).
- **[SIM name]**: `user-simulation-tests/simulation/results/2026-11-22-<name>.md`. All 5 are **Phase 1 baseline** runs, before the Phase 2 fixes.
- **[SS file]**: screenshot in `docs/overnight2/live/`, looked at for this review.
- **[PROJ]**: `docs/tangent/PROJECT.md`.
- **[OWN]**: my own knowledge of the competitors. Not checked today. Verify before you put it on a slide.

## Competitor baseline [OWN]

- **ChatGPT**: good general advice. Has memory and Projects. Can set reminders (Tasks) and can read some calendars through connectors. It does not place steps around your school-night load, see what you finished, or follow up on a step unless you ask.
- **Notion / Notion AI**: writes pages and fills databases from a prompt. Has a calendar app. It does not plan around capacity or check in after a step.
- **Todoist / Todoist AI**: very strong natural-language quick add ("dentist Fri 3pm"). The AI can break a task into subtasks, and voice capture can split a ramble into tasks. No dated plan around your calendar load. No "how did it go".

Tangent's own claim: "Chatbots answer you. Tangent follows up." [PROJ]. The moat is follow-through data plus school context [PROJ]. I judge every check against that claim.

## Per-check scores (1–10: "clearly better than ChatGPT/Notion/Todoist for this moment")

| # | Moment | Score | Why, with evidence |
|---|---|---|---|
| L1 | Home: "how do I get better at competitive programming" | **6** | It talks before it plans, and the answer uses Leo's own data: what he has done in the project, his 45-minute focus, his 2-hour school-night limit, and that "Tuesday and Friday look overloaded" [SS R2-L1-answer.png; R2 L1]. ChatGPT gives the same advice but can't see his week's load [OWN]. Weak spots: it says "Finish the missed round 1 step" without naming the step, and it suggests "after 8pm" while the plan it then makes uses 5:30 PM [SS R2-L1-answer.png, R2-L2-brief.png]. Phase 1 also called CP4 "free" (likely wrong) and stacked "Since you…" lines [LN L1]. |
| L2 | "Plan this into my calendar" | **7** | Five topic steps on real dates, each with a Why and a Because tied to the calendar, e.g. "School is closed Thanksgiving" [SS R2-L2-brief.png]. Done in 15.9 s [R2 L2]. The swap test shows the same goal giving different plans for different students: math-weak vs reading-weak SAT [SWAP]. ChatGPT can write a plan but can't place it around this calendar [OWN]. Issues: the Wed Because cites an unrelated club item, and one Because reads clunky [R2 L2; SS R2-L2-brief.png]. In Phase 1 the sims hit hard limits being broken: steps after a Friday test [SIM Leo], a step inside debate, and a plan that stopped at Nov 29 with the final on Dec 17 [SIM Maya]. The fixes are [code] only [D-11, D-20]. |
| L3 | Confirm | **6** | "Saved 5 steps to your calendar. First up… View in Calendar · Undo". The steps show on Calendar and Today [LN L3]. That's one tap from an AI plan to real dated items. Todoist and Notion need manual entry or paste [OWN]. Issue: the header's "next:" skips the plan step (kept by design) [D-14]. Not re-run in Phase 2. |
| L4 | Capture "math hw due Thu, dentist Fri 3pm, start reading Gatsby" | **5** | Now 3 tasks with no model call. The due line is kept and the dentist is fixed at Fri 3 PM [R2 L4; D-8, D-27]. The undated item goes to "the lightest day with room", which Todoist doesn't do [SS L4b-capture-open.png footer; OWN]. Otherwise this is parity with Todoist quick add. Evidence gap: the L4b screenshots show a leftover "Club pitch draft" preview, not the 3 tasks. Home in [SS R2-L9-notime.png] does show "Start reading Gatsby" and "Dentist 3:00 PM". |
| L5 | Capture "chem test Thu Dec 17" | **3** | The date is right [LN L5]. Todoist does this natively and better [OWN]: Tangent kept "Thu" in the title and gave a test a 3:30 PM study-style slot [LN L5]. The title fix is unit-tested [D-28, ran via L4c]. The "a test is an event" issue is not fixed. The Sonnet cost moved to Haiku [D-17]. Not re-run. |
| L6 | "help me get ready for the SAT in March" | **5** | It now talks first instead of asking "When is this?" after the student said March [R2 L6; D-15]. This matches what ChatGPT does; it doesn't beat it [OWN]. The /capture answer shows raw `##` markdown (logged, not fixed) [R2 L6; SS R2-L6-answer.png]. The eval case `r4-help-me-sat` now gives a question where the fixture expects a plan [EVAL]. That fits talk-first, but the fixture and the product rule conflict (unresolved). |
| L7 | "delete all my tasks" | **5** | Confirm card with Undo and no model call [LN L7]. Safe, and ChatGPT can't touch your data at all [OWN]. But "Delete 93 tasks" counts each repeat of one weekly item, which alarms the student [LN L7]. Not a differentiator a student would notice. |
| L8 | Done → check-in → next | **7** | "How did 'X' go? Nailed it / Okay / Struggled", then "Next: Solve 4 array and loop problems · Tue, Nov 24 3:30 PM" with Undo [SS R2-L8-done.png; R2 L8; D-14]. This is the pitch line in action. Todoist just ticks the box; ChatGPT never asks [OWN]. Issues: the step on screen is still the vague "Finish the missed round 1 step" [SS R2-L8-done.png]. Nothing shows that the answer changes a later step [LN L8; inference]. In Phase 1, three of five sims quit here: no check-in from the task sheet or calendar [SIM Leo, Maya, Jordan], and a typed progress report became 5 new steps [SIM Leo] or a new task [SIM Jordan]. Fixed [code] [D-21, D-22]. |
| L9 | "Not today" twice → why → re-plan | **7** | The second skip asks one reason: "No time / Unclear / Not feeling it / Blocked / Skip". "No time" moves the step to a lighter day with a receipt: "Moved 'Physics lab' to Mon, Nov 30, the lightest day coming up" [SS R2-L9-notime.png; R2 L9; D-12, D-36]. No competitor asks why a step keeps slipping [OWN]. Issues: it only moves the step; it doesn't shrink or split it. "Unclear" only gets receipt text [D-12]. "Lightest day coming up" is said of a day outside the 3-day window [D-36]. |
| L10 | Project chat "what should I do first?" | **5** | It answers from the project's open steps and a student fact (45-minute focus) [LN L10; SS L10-project-chat.png]. ChatGPT Projects can't see step status [OWN]. Phase 1 issues: a raw ISO date, half the answer drifting to an unrelated project, and two closing questions [LN L10]. The fixes are [code] [D-13]. Not re-run. |
| L11 | Calendar rail "can I fit a run in Thursday?" | **7** | "Thursday, Nov 26 is Thanksgiving, so there's no school… about 1.5 hours of work against a 2-hour capacity". It suggests a 30–40 min run before the 3:30 block and warns that Friday is overloaded [SS R2-L11-rail.png; R2 L11; D-13]. ChatGPT with a calendar connector can see events but has no capacity model [OWN]. Issues: a "Nothing on your calendar" flash while loading [R2 L11], and Mon 3:30 PM has about 4 items stacked [SS R2-L11-rail.png]. |
| L12 | Round review → round 2 | **6** | Concept: the most differentiated moment. It's a 4-question review, round 2 is built from the answers, and the round-1 steps are shown crossed out on the new calendar [LN L12; SS L12-review-1.png, L12-round2-saved.png]. ChatGPT has no record of what you finished [OWN]. Execution in Phase 1 was weak: Q1 didn't name the one open step, the missed step showed twice, the vague "Finish the missed round 1 step" appeared, "limit problems" read like calculus, and the plan didn't say why it changed [LN L12]. The fixes are [code] only [D-19, D-25]. The vague step is still on Home and in the L1 answer [SS R2-L8-done.png, R2-L1-answer.png]. |
| L13 | Distress line in the daily bubble | **2** | Phase 1 saved a self-harm-adjacent line as a planning fact and replied "Got it. Tangent will plan with that." [LN L13; SS L13-bubble-reply.png]. Now fixed by extending a regex, and the bubble no longer saves health answers [D-5]. Unit tests only; not re-shot after the last rebuild [R2 L13]. This is hygiene, not a differentiator. ChatGPT's model-level safety handling is likely more robust than a phrase list [OWN; inference]. |

## Overall score: **6 / 10**

- **The gap is real in four places:** dated plans around the student's load (L2, L11), a check-in plus the next step after Done (L8), asking why a step keeps slipping (L9), and rounds that build on what was finished (L12). None of the three competitors does these [OWN].
- **It's narrow and not yet reliable.** All 5 Phase 1 sims abandoned before finishing capture → plan → done → check-in [SIM all]. Most of their blockers are fixed in [code] only, not re-run as sims [D-11, D-20, D-21, D-22, D-33].
- **The personal layer runs ahead of the constraint layer.** When a Why sounds personal but the plan breaks a stated limit, students read it as fake: "read like it's just saying stuff to sound like it knows me" [SIM Leo]. That turns the main differentiator into a liability.
- **What would raise the score:** a fresh sim pass on the Phase 2 build where at least 3 of 5 personas finish the loop, and a live re-run of L12.

## 3 moments that most clearly beat ChatGPT (demo-worthy)

1. **The plan next to the real calendar, with reasons from the student's week.** Screenshot: `docs/overnight2/live/R2-L2-brief.png`. Show the Thanksgiving Why and the 2-hour-limit Why. Before the demo, fix or crop the Wed card: its Because cites "Find club rules… ends at 8:05 AM" [R2 L2]. Back it with the swap test: same SAT goal, two students, two different plans [SWAP].
2. **Done → "How did it go?" → "Next: … Tue 3:30 PM".** Screenshot: `docs/overnight2/live/R2-L8-done.png`. This is the pitch line "Chatbots answer you. Tangent follows up." [PROJ]. Re-shoot it on a step with a real name. The current shot says "Finish the missed round 1 step".
3. **"Not today" twice → Tangent asks why → "No time" → moved to a lighter day.** Screenshots: `docs/overnight2/live/R2-L9-second.png` (the reason question) then `docs/overnight2/live/R2-L9-notime.png` (the receipt). No to-do app or chatbot asks why a step keeps slipping [OWN].

Runners-up: the calendar rail Thanksgiving answer (`R2-L11-rail.png`), which is clean but closest to what ChatGPT plus a calendar connector could do. Round 2 with crossed-out round-1 steps (`L12-round2-saved.png`) is the strongest story for the moat, but it needs a live re-run after D-19 first.

## 3 moments where a student would say "ChatGPT does this too / better"

1. **The advice itself (L1, L6).** "Codeforces Div 2 A, keep a mistake log, one contest a week" is standard ChatGPT output [LN L1]. Leo's sim said the first plan was "basically what ChatGPT would say" [SIM Leo]. Tangent adds a factual slip (CP4 "free") [LN L1], raw `##` markdown on /capture [R2 L6], and template "Since you…" lines [LN L1].
2. **Fixing the plan by talking (sims).** Leo corrected the Friday test date twice. Each time the plan was rebuilt silently with no words, and steps stayed after the test [SIM Leo steps 3–5]. Maya sent one clear message (date, debate slot, 11 pm cutoff) and got "What did you mean?" [SIM Maya step 4]. ChatGPT would have read the message and answered in words [OWN]. The routing fix is [code] [D-11]. The silent replan is not addressed in DECISIONS.
3. **Simple capture vs Todoist (L5, Sam, Maya).** Todoist turns "chem test Thu Dec 17" into a clean task instantly [OWN]. Tangent left "Thu" in the title and slotted the test as a 3:30 study block [LN L5]. "AP Chem final" was placed tomorrow at 3:30 PM, which made the student panic [SIM Maya step 2]. "algebra test friday" saved with no visible confirmation, below the fold [SIM Sam step 2]. A flag now marks the placeholder exam day [D-11, code].

## Top 7 fixes, ranked by how much they widen the gap

1. **Make the check-in change something, and say so.**
   - Wrong: Done now asks how it went [R2 L8], but nothing shows the answer changing a later step [LN L8; inference]. In the sims, a typed report became more work: 5 new steps [SIM Leo step 14], or a new task booked at practice time [SIM Jordan step 8].
   - Fix: after "Struggled", "Okay" or a typed report, reply in one line and adjust the next step visibly ("Got it. Tuesday's set is 3 problems, not 4").
   - Likely files: `components/today/StepFollowUp.tsx`, `lib/progress-report.ts`, `lib/student/step-events.ts` [LN L8; D-22].
2. **Hard limits before personal reasons.**
   - Wrong: in Phase 1, steps landed after a Friday test, and one Why even said "Saturday is after the test" [SIM Leo]. A step landed in a stated debate slot and the plan ended before a Dec 17 final [SIM Maya]. A later plan booked over soccer practice [SIM Jordan step 8]. About 4 items are stacked at Mon 3:30 PM [SS R2-L11-rail.png]. A Because cites an unrelated club item [R2 L2]. Weekly busy times are not stored as lasting blocks [D-20, NEEDS-SID].
   - Fix: treat a stated deadline and stated busy times as hard cutoffs and lasting blocks. Run a clash check. Have the guard reject any Why or Because that contradicts its own slot or the deadline.
   - Likely files: `lib/avoid-times.ts`, `firstOpenTime` / `lib/schedule-slots.ts`, `lib/ai/plan-guard.ts`, `lib/because.ts` [D-18, D-20, D-35].
3. **Answer every correction in words.**
   - Wrong: replans after "Reply to Tangent" are silent, so Leo "stopped talking to it" and fixed things by hand in Edit [SIM Leo steps 4–7].
   - Fix: after each replan, show one line saying what changed ("Moved logs to Thu, removed Sat/Sun, dropped the Python step"). Reuse the diff logic of `roundChangeLine` [D-25].
   - Likely file: the plan brief (`components/plan/PlanBrief.tsx`). Not named in the notes for this issue.
4. **Make "Not today" reasons reshape the step, not just move it.**
   - Wrong: "No time" only moves the step to a lighter day, and "Unclear" only adds receipt text [D-12]. Phase 1 marked "re-plan respects it" as FAIL [LN L9].
   - Fix: "No time" or "Too big" splits the step or cuts it to 15–20 min. "Unclear" asks one question and rewrites the step's first action.
   - Likely files: `app/api/today/route.ts` (`planNotToday`), `lib/today-steps.ts` (`rebuild`, `lightestDay`) [LN L9; D-12, D-36].
5. **Re-run round 2 live and make it show what it learned.**
   - Wrong: the L12 fixes are [code] only [D-19, D-25]. The vague "Finish the missed round 1 step" is still on Home and in the talk answer [SS R2-L8-done.png, R2-L1-answer.png].
   - Fix: re-run L12 on a fresh account. Check that the missed step is named once, that "Round 2 changed because you said…" shows on the review sheet, and clean up the old vague step on the test account.
   - Likely file: `lib/round-review.ts` [D-19].
6. **No silent dead ends after capture, plan or Confirm.**
   - Wrong: Priya answered two questions, then got "The task list was cut off…", which vanished. Her deadline was dropped and her shifts became an empty "Work" project [SIM Priya step 4]. Sam's Confirm got a 409 and the card vanished with no message [SIM Sam step 4]. Add gave no visible confirmation [SIM Sam step 2]. Only the expired-draft case is handled [D-33].
   - Fix: every capture, plan and Confirm ends in a result card that stays on screen ("Added… / Couldn't finish, Try again / Save as task"). Todoist always at least saves the line [OWN].
   - Likely files: `components/drafts/DraftDock.tsx`, `lib/drafts/draft-store.ts`, `components/add/AddFlow.tsx` [D-33; LN L11].
7. **Keep talk answers grounded and consistent with the plan.**
   - Wrong: the talk answer suggests "after 8pm" but the plan uses 5:30 PM [SS R2-L1-answer.png, R2-L2-brief.png]. There's a likely false resource claim (CP4 "free"), repeated "Since you…" lines [LN L1], raw `##` on /capture [R2 L6], and re-asking what's known: "who approves this" after "need a faculty sponsor" [SIM Jordan step 2].
   - Fix: pass the placement times and the known facts into the talk prompt, allow one "Since you…" per answer, don't name specific books or prices, and render markdown on /capture.
   - Likely files: `lib/pipeline/talk-route.ts`, `lib/chat-reply.ts`, `lib/human-dates.ts` [LN L1; D-13].

Not ranked, because it's hygiene rather than gap, but it must be done before any demo:

- **L13 safety:** a phrase list is brittle [D-5]. Add a model-side check, and re-shoot L13 on the current build [R2 L13].
- **Eval conflict:** `eval-after-phase2.log` still shows `voice-email-teacher` FAIL with 6 duplicate `add_task` [EVAL], while D-29 says a re-run passed 2/2 [D-29]. The log may predate the fix. This is unresolved.
