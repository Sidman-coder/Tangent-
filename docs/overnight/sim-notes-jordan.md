# Jordan run: orchestrator notes (feeds the Tangent-specific section of the report)

Run on the production build, `push-v1`, signed in as the test account, reset and re-onboarded as Jordan (15, 10th, School Mon-Fri 08:00-15:00, Practice Mon-Fri 15:30-17:30 + Sat 08:00-12:00, priorities Grades / A sport / A club or competition, slip = "I don't know where to start", works best Evenings, 45 min, 2 hrs on a school night, Gentle nudges; optional steps skipped). Viewport 1440x900 (same as Maya).

Onboarding observations (setup, not part of the simulated steps):
- The practice row defaulted to Mon+Wed 15:30-17:30; "Add another time" defaulted its days to Mon+Sat, so Monday 08:00-12:00 would have been blocked if left. Needed manual fixing. (Possible friction for any user adding a second time.)
- "You're all set, Jordan." screen was shown again after a reload, with the tour modal ("Tangent in two minutes") and a "One question" modal stacked on top; the greeting kept saying "Sid" until "Open Tangent" was tapped.
- Evidence: `sim-jordan-onboarding-done.png`, `sim-jordan-tour-over-onboarding.png`.

## Observed (step 1 screen)
After "Open Tangent", Jordan lands on a chat, "Talk with Tangent", that Tangent opened itself: "Break down plan: Starting an Environmental Club before January and keeping my grades up during soccer season", with Tangent's question "Is there a teacher you already have in mind to be the club's advisor?" and "skip and plan it anyway". On top: a "One question" modal ("Which sport do you play, and when is your season?"), and a "Enable desktop notifications" alert dialog. Three stacked prompts before the first action.
Evidence: `sim-jordan-step1-first-screen.png`.

## Step 1 evaluated and executed
Evaluator (replied in Spanish again; later prompts say "reply in English"): Low clarity, doubt yes, 12 s. Annoyed by two overlays (sport question, notifications) before anything useful; "I already said I play football" (the onboarding only asked 'A sport', not which one). Wants times and a plan. Action: Not now on "One question", Not now on notifications, then tap "skip and plan it anyway". Executed the two dismissals (both closed; 0 dialogs left).

## Observed (step 2 evaluated, step 3 screen)
2. Evaluator (English): High clarity, doubt yes, 8 s. "Skip" is right inside the question. Worry: no sign yet that Tangent knows practice 3:30-5:30. Executed: tapped "skip and plan it anyway". Plan appeared in under about 5 s (WAIT on "Confirm" returned immediately; no wait timer needed).
3. Result (screenshot `sim-jordan-step3-plan.png`, full page): "Planning with Tangent" brief.
   - Heading: "Start your Environmental Club before January, and this week get a short list of advisor candidates plus a one-paragraph club pitch ready to bring to a teacher."
   - Round 1 has ONE step: "Draft Environmental Club pitch paragraph", Wed, Nov 18 7:00 PM. Why: "Since you often don't know where to start, this first step is small: a pitch and 3 teacher names fit your 2-hour school-night limit." Outcome: "a one-paragraph club pitch and 3 possible advisors".
   - "What I used about you": only 1 line, "You often don't know where to start". It does not name practice 3:30-5:30 or Saturday games anywhere.
   - "What I assumed": includes "Spread from today to today" (reads like a template glitch), "Spaced around your busy days", "Evening work after practice, since you do your best work then" (practice is acknowledged only in this line), "45-minute focus block", "Advisor picked from science or other teachers you already have, since you had no preference" (Tangent has no list of Jordan's teachers: onboarding never asked for them; Jordan skipped the advisor question).
   - Good: 7 PM step is outside 3:30-5:30 and Saturday morning; the "2-hour school night" and "45 min" onboarding answers were used and quoted. "Nothing is on your calendar until you confirm."
   - Weak: a one-step "this week" plan for a club needing sponsor + 5 signatures + room by January; no mention of the sponsor/signatures/room milestones; "Advisor picked from ... teachers you already have" is an invented assumption.

## Observed (step 3 evaluated, step 4 screen)
3. Evaluator: Medium clarity, doubt yes, 20 s. Reads the time first: Wed 7 PM is outside practice, and "Evening work after practice" tells him Tangent knows his schedule. Annoyed by the wall of "used/assumed" text; "Spread from today to today" makes no sense; only one step for "your first week of steps"; nothing says Saturday mornings are protected; "you often don't know where to start" feels slightly preachy. Action: Confirm. Executed.
4. Result (screenshot `sim-jordan-step4-confirmed.png`): status "Added 1 step to your calendar." + Undo. Stale text remains on the page: "Nothing is on your calendar until you confirm." (now false, directly above the status line). Plan page stays open at this moment.

## Observed (step 4 evaluated, step 5 screen)
4. Evaluator: Medium clarity, doubt yes, 10 s. Relieved by the real confirmation; annoyed it is one lonely step and the page does not say where to go next; the wall of text "feels like homework about homework"; Saturday mornings still not mentioned. Declared action: tap "Back to Today". NOT EXECUTED as a click: the "Planning with Tangent" view had already closed itself (button count 0) by the time I acted, about a minute after Confirm. Second run in a row (Maya too) where the planning page closes on its own. Home was already showing, which is where the declared action goes, so step 5 perceives Home.
5. Result (screenshot `sim-jordan-step5-home-after-confirm.png`, full page): Home, "Still up, Jordan?" (it is 1:16 AM), "Wednesday, November 18 · 2 left today · next: Practice at 3:30 PM". Afternoon: "Practice 3:30 PM" listed under a "Personal" heading with a Done check (a repeating busy block shown as a to-do). Evening: heading link "Environmental Club Launch Pitch" with "Draft Environmental Club pitch paragraph 7:00 PM", buttons "Done", "Not today", "Too big". "Coming up 3". A "Use Canvas?" card at the bottom. No modal is stacked now (clean compared with the first screen).

## Observed (step 5 evaluated, step 6 screen)
5. Evaluator: Medium clarity, doubt yes, 12 s. Likes that the 7 PM step is clear of practice and that Practice was already on Today without being told. Annoyed: only one club step (needs two), "Coming up 3" collapsed, Canvas card and "Not today / Too big" are noise, 1:16 AM clock beside a 7 PM step, Saturday mornings still not visible. Action: tap Done on the pitch step. Executed by role name (ref stale).
6. Result (screenshot `sim-jordan-step6-after-done.png`): header now "1 left today". Evening section "0 items". A "How did it go?" dialog opens at once: "How did 'Draft Environmental Club pitch paragraph' go?" with radios Nailed it / Okay / Struggled, a second group "How long it took" Less time / About right / More time, an optional "Anything to remember" box, and Skip (two Skip buttons). Also a "Recent activity 1" group. Good: the per-step check-in is short and skippable.

## Observed (step 6 evaluated, step 7 screen)
6. Evaluator: Medium clarity, doubt yes, 6 s, annoyed: "I tapped Done and got a questionnaire", "feels like homework about homework"; Skip was easy to find. Action: Skip. Executed (first Skip button; both dialogs' Skip buttons look the same).
7. Result (`sim-jordan-step7-after-skip.png`): dialog closed, back on Today. "1 left today" (that is Practice, which cannot really be "left" as a to-do). Evening 0 items, "Coming up 3" still collapsed, "Recent activity 1" group, Canvas card. The finished step's check-in was skipped, so no feedback was given for round 2.

## Observed (step 7 evaluated, step 8 screen)
7. Evaluator: Medium clarity, doubt yes, 10 s, mildly annoyed that the club step he came for is not visible; Practice shows as a to-do with a Done circle; Canvas card is noise. Action: open "Coming up 3". Executed.
8. Result (`sim-jordan-step8-coming-up.png`, full page): Coming up shows THREE items and all are Practice: Thu Nov 19 3:30 PM, Fri Nov 20 3:30 PM, Sat Nov 21 8:00 AM (the Saturday item is labelled Practice, not "game"; onboarding asked for practice times only). No second club step exists anywhere. So the "finish two steps" part of the task cannot be done: round 1 contained one step. Good: Tangent did hold the practice times and Saturday 8:00 AM block, so Saturday mornings ARE known. It was never stated on the plan screen, which is what Jordan kept missing.

## Step 8 evaluated; run stopped
8. Evaluator: Medium clarity, doubt yes, 12 s, annoyed. Only Practice rows; Sat 8:00 AM row sits in his game time ("Saturday mornings are games"); no club step; no named element to tap ("I look around for another way"). Memory: "If it isn't on the Today screen soon, I'm done with this." Stop reason: no executable next action; no second step exists, so "finish two steps" and the end-of-round review were not reachable. Recorded as Stalled (goal partly reached: plan confirmed, first step done, check-in skipped). Not executed: nothing to click.
