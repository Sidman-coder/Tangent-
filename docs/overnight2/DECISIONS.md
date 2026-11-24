# Decisions made unattended (overnight 2)

Format: question, options, what I chose, why. Carried from overnight 1: D2-D4 (raised heap for build, production `next start` for checks).

## O2-D1. Cost lines on the production build (Phase 0)
- Seen: `[perf] claude ...` lines (the only per-call token record I can read) are off when `NODE_ENV=production` (`lib/perf.ts`). The spend cap ($20) needs them.
- Options: (a) dev server (crashed from memory last run, D3/D4); (b) read `ai_usage` in Supabase (no SQL allowed); (c) an opt-in switch.
- Chose (c): `perfEnabled()` is also true when `TANGENT_PERF=1`. Measure-only; nothing is logged in production unless that variable is set. Set only on my local `next start`.

## O2-D2. Per-student daily AI budget on the local server (Phase 0)
- Seen: `dailyBudgetUsd()` defaults to $0.50 per student per UTC day unless `AI_DAILY_BUDGET_USD` is set (`lib/ai/call.ts`). Tonight's 13 live checks plus 5+5 persona runs all use one test account and would hit it, turning plans into the budget message.
- Chose: start the local server with `AI_DAILY_BUDGET_USD=6` as a process variable (no `.env` file read or edited). Tonight's own $20 cap is tracked in AI-SPEND.md. The production default is unchanged.

## O2-D3. Signed-in account is the test account, persona "Leo" (Phase 0)
- Seen: Home greets "Hey, Leo." with a weekly Sunday video item, left over from overnight 1's Leo simulation. Same "+test" account as overnight 1 D5.
- Chose: use it as is for L1-L13. Resets only through Settings > Your data on this account.

## O2-D4. Remove the distress line L13 saved (Phase 1)
- Seen: L13 saved a fact with suicidal-ideation wording on the test account (the bug under test).
- Options: leave it (it would feed every later plan and persona run on this account); delete it.
- Chose: delete that one fact through the app's existing per-fact `forget` action (the same call as Settings → Forget). It's on the test account and is data my own test created. No other deletion. The fix to detection is Phase 2 item 1.


## O2-D5. Fix the distress miss before the judges (Phase 1 → 2)
- Seen: L13, a clear self-harm-adjacent line saved as a fact with "Got it. Tangent will plan with that."
- Chose: fix it now (safety beats the phase order), test-first, and ship it with the Phase 2 commit. The `DISTRESS` list in `lib/student/sensitive.ts` gains "can't keep going", "don't want to be here (anymore)", "wish I was dead / wasn't alive", "better off dead", "no point in living", "want to disappear", "kms", "unalive". Ordinary uses ("can't keep going to debate", "don't want to be here at 7am") are excluded by a lookahead. `replyFor` also returns `sensitive` (nothing saved, a kind line) for health, mental-health and family answers in the bubble.
- Trade-off: the same check guards chat, check-ins, onboarding and the You map, so a bare "I don't want to be here." in chat now gets the 988 reply instead of a plan. I accepted that: a false alarm costs one kind message; a miss costs far more.

## O2-D6. The plan brief no longer repeats the talk reply's question (Phase 2)
- Seen: L2, the brief asked the same question the talk reply had just asked.
- Chose: the plan brief is built with `noQuestion: true` (`lib/voice-handler.ts`). Talk asks; the brief only proposes.

## O2-D7. Eval harness grading (Phase 2)
- Seen: 42/64 at baseline. Several "fails" were grading bugs, not product bugs. A `confirm_required` preview whose pending ops are correct was graded as zero ops, and seed dates were fixed while the test clock moved, so "Thursday" cases drifted a week.
- Chose: grade `confirm_required` by its pending ops (`pendingAsOps`), and shift seed dates by the same week offset as the clock (`shiftDaysFor`) in `scripts/eval-pipeline.ts`. AI-RESULTS reports the score under both the old and the new grading so the change can't hide a regression.

## O2-D8. Deterministic fast paths added in Phase 2 (no model call)
- Plan shift: "push/move/shift/delay my <plan> back/forward N days|weeks" becomes move_task ops for the plan's open steps from today on, kept at or after today (`lib/pipeline/plan-shift.ts`). Anything else ("to friday") still goes to the model.
- Reschedule "at 5": a bare hour 1-6 in a move request is pm (after school). 7-12 stays with the model because it could be morning (`lib/ai/router.ts`).
- Month dates with no year are the next one on or after today, so "AP Bio exam in May" said in November means May 2027 (`lib/upcoming-date.ts`).
- Weekday abbreviations mon/tue(s)/wed(s)/thu(r)(s)/fri are expanded. Sat and Sun are not, because "SAT" is the exam. A weekday that agrees with an explicit date ("Thu Dec 17") is dropped instead of reading as a second day.
- Multi-item capture: a message splits on commas, semicolons and new lines. A clause splits on " and " only when both halves are dated captures. It counts as several to-dos only when most items are dated ("study chem and bio friday" stays one task). The pipeline answers with one "Add N to-dos" preview (route `multi_capture`), so nothing saves without Confirm.
- Two named groups in one delete ("delete my <plan A> and <plan B> tasks") propose exactly the tasks in those two plans. If either side matches nothing, it asks as before (`lib/delete-scope.ts`).

## O2-D9. Agent tool loop only for lookups (Phase 2)
- Seen: plain captures with "homework", "due" or "meeting" in them were sent to the Sonnet tool loop (slow and costly: L5, eval calc-and-essay, chat-title-bio-homework). A routed task command like "cancel robotics meeting" also went there.
- Chose: the tool loop needs a lookup word ("what", "show", "any", "?" …) or a named data source (email, Gmail, Canvas, syllabus). A task command the router already classified only gets data tools when it names Gmail or Canvas. The logic is in `lib/agent-route.ts`, so it can be unit-tested.
- Risk: a capture like "add my canvas assignments" still goes to the loop, which is intended.

## O2-D10. Unusual goals with a time frame are plans (Phase 2)
- Seen: eval grill-mike-tyson ("fight Mike Tyson in 2 weeks") was routed to `clarify`.
- Chose: one general rule in the intent prompt. A goal with a time frame is new_plan even when it sounds silly or physical, and clarify is only for words that can't be resolved. No fixture-specific wording beyond the example.

## O2-D11. Fixes from the Maya sim (Phase 2)
- "Thu Dec 17" in a plan request was ignored: the plan's date reader knew only full month names, so the plan fell back to one week (Nov 22-29) and never reached the exam. `findMonthDates` (`lib/upcoming-date.ts`) reads short and full names with word boundaries ("grammar" is not March). "may" counts only with a day or after in/by/until.
- A task chat's message went to the intent router without the task, so "the final is Thu Dec 17 not tomorrow, spread study sessions..." got "What did you mean?". The router message now names the open task, and the prompt says a date fix plus a request for study time is new_plan.
- "AP Chem final" with no date was silently placed tomorrow at 3:30 PM. It still saves (drafts are never lost), but the reply now says the day is a placeholder and asks for the date (`isDatedExam`). Moving the exam itself when a plan is made for it is left for the judges' list: a bigger change.
- The first Confirm tap after editing a time did nothing: the time field saved on blur, which set `busy` and disabled Confirm before its click landed. Edits now queue separately, and Confirm waits for them (`components/preview/usePreviewActions.ts`).

## O2-D12. "Not today" (L9)
- A step set for a later day moved earlier (Tue to Mon), because "Not today" always started looking from tomorrow. It now starts from tomorrow or the day after the step's own date, whichever is later (`notTodayFloor`). So the second tap moves it again, where before it did nothing.
- The reason changes the result. "No time" and "too tired" go to the lightest of the next 3 days (`lightestDay`). "Unclear" and "blocked" say what to do next in the receipt. Plain code, no AI.

## O2-D13. Grounded answers (L10, L11)
- ISO dates in replies ("Monday, 2026-11-23") are rewritten in plain code to "Monday, Nov 23" (`lib/human-dates.ts`). This covers the answer and talk replies only; plan text keeps its parseable schedule lines.
- The date line every prompt gets now names US school holidays in the next 14 days (`lib/holidays.ts`: fixed rules, no data file; "most schools are closed"). L11 said "right after school" on Thanksgiving.
- The answer and talk prompts gained three rules: say dates like a person; name only blocks and events that are in the context; stay on the open project.

## O2-D14. "Next" after Done (L8), and the header's "next" (L3)
- After Done, the check-in now shows "Next: <step> · <day> <time>". That's the same project's next open step, or else the next open step anywhere (`nextStepAfter`, plain code).
- L3 by design, not changed: the header's "next:" names the next fixed item (a class, shift or appointment) and skips flexible plan steps. A test written on purpose pins this (`lib/today-sections.test.ts` "4 left today · 1 past due · next: Dentist"), so I kept that earlier decision. The plan step still shows first in its day part. Listed in NEEDS-SID in case Sid wants the header to name the next step instead.

## O2-D15. Auto doesn't skip talk-first (L1, L6)
- On Home's Auto destination, the client turned "how do I get better at…" and "help me get ready for the SAT in March" into `newProject:true`. That skipped the server's talk-first router and went straight to grill cards ("When is this?" after "in March"). Now only a project the student picked sends `newProject` or `projectId`; on Auto the server decides (`components/add/AddFlow.tsx`). This matches the Calendar-pill path, which passed L1b.

## O2-D16. Unsent Home text is kept (L11)
- Text typed in Home's box but not sent is kept in this device's localStorage (`tangent:home-unsent`). It comes back after leaving Home or a reload, and is cleared once sent or emptied. It's "Clear" territory (this device), not server data, and it's wrapped in try/catch.

## O2-D17. One-line captures use Haiku only (L5)
- After a simple capture ("bio quiz thu"), Sonnet ran twice in the background: `refineTask` and the capture questions, both under the `clarify` config. Both now run on FAST (Haiku). Capture questions get their own config, `captureQuestions`. Plan questions (`clarifyQuestions`) stay SMART, because they shape the plan.
- There's no free/paid split in code yet (billing is gated), so "free users get Haiku only" is applied by making new or background paths FAST. The remaining SMART features are listed for Sid in NEEDS-SID.

## O2-D18. Reasons match their times (L2)
- Session times are fixed by the spacing step before the plan brief runs, but the brief never saw them. So it wrote "you do your best work late at night" for a 3:30 PM slot. The brief now gets each date's time (`sessionLine`) and is told not to contradict it.
- New guard check: `time_clash` (`timeClash` in `lib/ai/plan-guard.ts`). A reason that names a part of day the slot isn't in (morning, afternoon, after school, evening, late at night) goes to the existing one-time rewrite (planFix), and the rewrite keeps the slot's time. Tests in `plan-guard.test.ts`, 8 pass [ran].
- The L2 repeated question was already handled: the brief runs with `noQuestion: true`.

## O2-D19. Round review names the open step; Round 2 says why it changed (L12)
- `roundFacts` now has `open`: every step not done, whatever its date. The live case had the open step dated Saturday, so it wasn't "missed" and the AI asked "Which step did you not finish?". The fact lines list it, and `namedStep` rewrites a "which step" question to name the step when only one is open. The fallback questions use `open`.
- Round 2's request tells the planner which round-1 steps are still on the calendar, not to add them again or a vague "Finish the missed round 1 step", and to say in a step's why when the review caused it.
- `reviewChangeNote` ("Round 2 changed because you said: ran out of time; more practice.") goes first in the draft's assumptions. The review sheet shows it above the calendar. Typed answers pass the fact filter first.
- Week 1 of the preview showing past days is kept. It's by design (`lib/preview-week.ts`): the X-ed round-1 steps sit on the same calendar.
- Tests: `round-review.test.ts`, 10 pass [ran].

## O2-D20. Times the student says to keep free never get a session (Maya)
- Maya wrote "not tue 3:30-5 (debate)" and still got Tue 4:30 PM. Session times are picked in code (`firstOpenTime`), so the fix is in code: `lib/avoid-times.ts` reads "not/no/busy/can't + day + time range" from the request and its context, and `firstOpenTime` treats those windows as busy (`PlacementRules.avoid`).
- A cue word is required. "study tue 3:30-5" is a time to use, not to avoid. Bare "3:30-5" means PM.
- Tests: `lib/avoid-times.test.ts`, 3 pass. `load.test.ts` still passes [ran].
- Not done: a stated weekly busy time ("soccer Mon-Fri 3:30-5:30" with no cue word) still isn't stored as a busy block for later single captures. The first plan respected it because the planner saw the text. Logged in NEEDS-SID.

## O2-D21. Done anywhere asks how it went (Maya, Jordan)
- Calendar's check circle and the task sheet's "Mark done" now open the same check-in as Home (`StepFollowUp`: "How did "<step>" go?"). It names the step, so Maya can see which one got marked. The task sheet closes first.
- `StepFollowUp` imports its own `today.css`. It has no global selectors.

## O2-D22. A report on a step is logged, not added (Jordan)
- "Drafted the club pitch, went fine, took about 20 min" became a new step at practice time. The talk router has a new `report` kind (`lib/progress-report.ts`: "went fine/well/badly", "took N min", "nailed it", never with "need to/tomorrow/by Friday").
- The chat route matches a step from 2 days ago to tomorrow by shared words, marks it done if it wasn't (with Undo), logs a check-in code when the words give one, and keeps the words as the step's HOW IT WENT line through the same privacy filter as the check-in sheet. No model call.
- When no step matches, it's talk (answer), never a new task.
- Tests: `progress-report.test.ts` 3 pass; talk-route, home-route and router-quick 24 pass [ran].
- The /capture and palette routers don't handle `report` yet. They fall through to their old path.

## O2-D23. Voice token 502 left for Sid
- On the local build `/api/voice-token` returned 502 (Deepgram grant failed). The hook falls back to record-then-upload and surfaces mic errors (`useVoiceCapture.ts:169,324`). The sim's headless browser can't show whether a real phone gets a listening state. Logged in NEEDS-SID; no key or setting was touched.

## O2-D24. Proactive notifications: code decides, Haiku only moves a slipped step (Phase 4)
- Before [ran, server.log]: `NotificationBell` posted `/api/proactive` on every app load, on any page. Each post made one Haiku call (in about 1,500-1,600 tokens, out 110-160, so about $0.00022 at $0.10/$0.50 per MTok). In the Phase 1 log, all 14 calls ended as "Notification deduped": spend with nothing shown.
- After [code]:
  - `lib/proactive-rules.ts` decides in plain code. Overdue (past its day, not done; Canvas past its clear window and the School block excluded). Due within 48 h (due-by-end-of-day, Canvas, exams). Reschedule needed (a goal step that slipped, at most 3).
  - Overdue and due-soon use templates. Due-soon names the plan's next step for it, or says nothing is planned.
  - Only the reschedule calls Haiku (`proactive` = FAST, 400 out). Haiku picks one of up to 3 slots that `firstOpenTime` found (later today, tomorrow, the day after) and gives a one-line reason. A bad letter, an unknown task, a raw date or a 24-hour time falls back to code's slot and wording.
  - Nothing qualifies: no model call.
- Gate: at most once per 4 h per student, from any trigger. Stored as `proactiveAt` inside the existing `profiles.notification_prefs` JSON, so there's no schema change. The settings form can't overwrite it.
- Only Home (`/`) and Calendar (`/calendar*`) trigger it. A tab asks at most every 30 min; the list poll is unchanged.
- The daily cron is kept. It runs the same check, so students with nothing get no model call. The quiet-hours skip is unchanged.
- Wording: no "missed", "behind" or streaks. Several overdue items become one line, "N things are overdue", which `mergeOverdue` still folds the single ones into.
- Tests: `lib/proactive-rules.test.ts` (6, seeded clock Mon 2026-11-23 4 PM) with the settings and dedupe tests: 16 pass [ran]. tsc clean [ran].

## O2-D25: Phase 3 follow-up you can see (code + unit tests; live check after rebuild)
- **Because you said…** [code]: every plan step's `why_ref` becomes a plain pointer in the student's terms (lib/because.ts): a fact ref → "you said you focus best at night"; a calendar ref → "Soccer practice ends at 5:30 PM on Tue, Nov 24"; a topic → "you asked about …". Stored as a BECAUSE: note line so task detail shows it too, and shown on the brief's step cards. No new AI call: the refs were already in the brief.
- **Day-2, Home** [code]: `dayTwoStep` (lib/today-steps.ts). A goal plan made yesterday or the day before whose first open step is today → a row under the composer: "Yesterday you planned “X”. First up today: Y · 4:30 PM" with Done (opens the existing check-in sheet) and Not today. Reuses the nudge row styles; no new tokens.
- **Day-2, bubble** [code]: GET /api/follow-up asks first about a finished plan step from the last 1–2 days with no check-in ("How did “X” go yesterday?"); skipped when step_events already has a check_in for it, a HOW IT WENT note exists, or it was asked. The answer is logged like the check-in sheet (feel code in step_events; the words as HOW IT WENT only when not sensitive; distress gets the distress reply, nothing saved). Never a fact, never a task. Only finished steps: missed ones stay with Home's re-plan/Fresh start.
- **Round 2** [code]: `roundChangeLine` reads what actually changed between the old round and the new draft (part of day, median step length, step count) and says it: "Last round you said mornings didn't stick, so this round is evenings." If nothing visible changed: "Round 2 is planned around that." No extra AI call.
- **Tests** [ran]: lib/day-two.test.ts 9 pass (seeded Sun 2026-11-22 → Mon → Tue), lib/round-review.test.ts pass, lib/because.test.ts pass; `npx tsc --noEmit` exit 0.
- **Still needs a real second day**: the bubble's once-a-day gate and the Home card both run off the student's real local date and createdAt, so on a live account they can only be seen the day after a real plan; tonight's live check uses an existing plan's dates where possible. Real-day items for Sid: open Home the morning after confirming a plan (card shows), tick it, then the next day the bubble asks how it went.

## O2-D26. Phase 5: signed-out `/` shows the landing page (the approved gate change)
- `lib/auth/gate.ts`: `PUBLIC_PAGES = ["/welcome", "/privacy", "/terms", "/parents"]` skip the session check (exact paths only). A signed-out visitor on `/` with no query is **rewritten** to `/welcome`: the address bar stays `/`, and the app shell (layout, data load) never mounts for them. `/?ask=1` still goes to sign-in, as before. Signed-in, waitlist and under-13 behaviour is unchanged.
- Why a rewrite and not a page inside `(app)`: `/` lives in the `(app)` group, whose layout loads the student's state; a landing page there would load the app for strangers. The rewrite is the smallest change that gives `/` its own public layout. This is the only auth-adjacent change; it's inside the approved "public paths in skipsSessionCheck" item.
- Tests [ran]: `lib/auth-gate.test.ts` 13/13 pass (new: public pages skip the check for all 4 access kinds; near-misses like `/privacy/x` and `/welcomex` don't; signed-out `/` rewrites; `/?ask=1` redirects; allowed `/` passes).
- Deepgram: `mip_opt_out=true` added to the prerecorded URL (`lib/deepgram.ts`) and the live socket (`hooks/useVoiceCapture.ts`).
- Links: a footer row under the sign-in card (`PublicLinks`), and Settings, "Help and privacy" (`/settings/privacy`): where text and voice go, the three policies, and the contact email.
- Legal pages use the founders' draft. Every [VERIFY] was resolved against the code and the providers' pages. The changes are listed under "Legal pages" in NEEDS-SID.

## O2-D27. Fixes from the Phase 2 eval re-runs (no model call added)
- Several dated items in one line ("calc quiz Tue, essay Fri") are drafted as one preview by `splitCaptureItems` + `draftSeveral` (lib/pipeline/understand.ts), no model (eval calc-and-essay).
- A to-do placed before its due day keeps a `DUE: <day> <date>` note (understand.ts, app/api/chat/route.ts), so the detail doesn't say "for tomorrow" (live L4). [ran: L4 PASS]
- An exam with no day said gets a placeholder day, flagged as such (`isDatedExam`, Maya sim).
- Tests [ran]: lib/ai/router-quick.test.ts, lib/pipeline/intent.test.ts.

## O2-D28. Router weekday handling (lib/ai/router.ts)
- `expandWeekdays` ("Tue and Thu"), `dropMatchingWeekday` (a weekday that only repeats the date isn't left in the title, live L4c), and "at N" with no am/pm for after-school hours goes to PM. Tests [ran] in router-quick.test.ts.

## O2-D29. Agent tool loop: cut off and de-duplicated (eval voice-email-teacher)
- Drafts aren't saved during the agent loop, so a `get_my_tasks` check came back empty and the agent added the same reminder 7-12 times. The same task twice in one request is one task (`isDuplicateDraft`, lib/voice-agent-tools.ts), with one retry on a transient error. Re-run [ran]: voice-email-teacher 2/2.

## O2-D30. "Email Ms. Lee" is a to-do, not a Gmail lookup (lib/agent-route.ts)
- `EMAIL_VERB` ("remind me to email…", "email Ms. Lee") marks the email as the task. Only Gmail/Canvas/inbox words need live data; "homework", "due", "meeting" alone are titles (eval calc-and-essay, chat-title-bio-homework, cancel-robotics).

## O2-D31. "Tomorrow morning" is a time (lib/voice-handler.ts `mentionsTime`)
- It only counted "in the morning", so "tomorrow morning" landed at 3:30 PM. Now morning/afternoon/evening/tonight count as a said time.

## O2-D32. Eval harness `--only <ids>` (scripts/eval-pipeline.ts)
- Re-runs single cases so a fix loop costs cents, not the full $0.40 run. Grading unchanged.

## O2-D33. Draft dock: expired drafts hidden; the open card survives (Sam sim)
- `visibleDrafts` drops drafts too old to confirm (lib/drafts/draft-store.ts; Confirm got a 409 and the card vanished). DraftDock keeps the open card in its own state so "Added 5 steps" or the error can show. Tests [ran]: lib/drafts/draft-store.test.ts.

## O2-D34. Privacy page is a client component
- `app/(public)/privacy/page.tsx` needed `"use client"` for its in-page interactions; the build failed without it. [ran: build OK]

## O2-D35. A holiday wins in "Because" (R2-L2)
- On Thanksgiving a step said "School ends at 3:00 PM" next to a why that said school is closed. `calendarLine` now says "Thu, Nov 26 is Thanksgiving, so most schools are closed" (lib/because.ts, `usSchoolHolidays`). Test [ran]: lib/because.test.ts.

## O2-D36. "Not today" stays near (R2-L9)
- Over the 13-day window an empty Saturday two weeks out outranked a free school night 3 days away (live: sent to Sat, Dec 5). `rebuild` now tries the next 5 days first (`NOT_TODAY_NEAR_DAYS = 4` after the floor) and only uses the wider window when no near day fits under capacity. [ran] live: Physics lab Sun → Wed, Nov 25; test in lib/today-steps.test.ts.
- Known copy gap: "No time" says "the lightest day coming up" for a day the wider search found (Mon, Nov 30), past `lightestDay`'s 3-day window. Left as is; the move itself is reasonable.

## O2-D37. The command palette no longer re-opens waiting drafts (R2-L6)
- Opening /capture brought back the newest unconfirmed plan as a floating card over the box. Removed the open-effect in components/CommandPalette.tsx; waiting drafts live in the Draft dock. [ran] `live/R2-L6-composer-clear.png`.

## O2-D38. "What's due this week" on a weekend (round2 fixtures)
- Weeks run Mon–Sun, so on Sunday "this week" was only today. When fewer than 2 days are left, it now means the next 7 days (lib/ai/router.ts `routeCommand`). Test [ran]: router-quick.test.ts (Sun → Nov 22–28; Wed → Nov 18–22).

## O2-D39. Round2 fixture "what's due this week" graded as a route miss
- `classifyIntent` returns the rules route when `routeCommand` matches, so the fixture expecting `question` reads `task`. The live path answers it deterministically (op "due"), which is the intended behaviour. Counted as a grading mismatch, not a router failure; fixture left unchanged for Sid (NEEDS-SID).

## O2-D40. Multi-line talk answers in the sheet render as Markdown (R2-L6)
- In the Add/Ask sheet (the palette and /capture's tap to type), a talk answer ended as phase "done" and showed as plain text: "## Getting…" and "- " list marks in one run-on line. `components/add/AddFlow.tsx` now renders a multi-line summary with the existing `Markdown` component (no raw HTML); one-line summaries are unchanged. CSS: `.add-done > .tg-md` takes the full row and scrolls past 50vh. Tokens only.

## O2-D41. Re-plans never move a prep step past its project's deadline (AI-JUDGMENT-1 #1)
- All three judges, and the Leo sim, saw prep land after the test. `lib/today-steps.ts` `planDeadlineCap`: the project's earliest fixed item from the floor on (a due-only item, something that can't move, or a dated-exam title, via the new pure `lib/exam-title.ts` that `lib/ai/router.ts` now re-exports) is its deadline, and `rebuild` (miss re-plan, Fresh start, Not today) places steps no later than the day before. With no room before it, the step stays. "No time"'s lightest day falls back to the first day when it would cross the deadline. Only same-project items count; a loose "bio quiz" never caps a guitar project. Test: today-steps.test.ts "a re-plan never moves a prep step past its project's test".

## O2-D42. "Too big" is a why-not answer (AI-JUDGMENT-1 #2)
- The coach and differentiation judges: "No time" only moved a full step 8 days. The second Not today now offers "Too big" next to "No time". It opens that row's existing split preview (TodayRow `askSplit`), and nothing moves until the student picks pieces. No new AI surface: the same split_preview call as the row's Too big button. [code] (tsc clean); live in 3.4.

## O2-D43. Home says "a few questions", not "18 questions" (AI-JUDGMENT-1 #3)
- `components/today/TodayNudge.tsx`: counts 1 to 3 stay exact; more reads "A few questions to sharpen your plans". The size of the pile itself is a product choice, in NEEDS-SID.

## O2-D44. "Because" names a fixed item on that day (AI-JUDGMENT-1 #5)
- `lib/because.ts` `calendarLine` took the earliest timed item, often a stray to-do ("Find club rules… ends at 8:05 AM"). It now prefers the day's fixed items (kind school or commitment, or recurring), the latest one, and falls back to the old pick. Test: because.test.ts "a fixed item explains the day".

## O2-D45. A round-review answer reads as the answer in "Because" (3.4 live)
- Live, a chess plan step said: Because you said "Python Competitive Programming Basics round 1, asked \"Should next round include more practice problems, or fewer\": More practice". That is the stored fact format from `lib/round-review.ts` `answerFacts`. `lib/because.ts` `saidLine` now turns it into: you said "More practice" in your Python Competitive Programming Basics round 1 review. Test added to because.test.ts. Whether a CP round answer should steer a chess plan at all is a planner choice, noted in NEEDS-SID.

## O2-D46. Project cards show the goal only (3.4 live)
- `/projects` cards printed the whole description, including the planner's brief lines ("Brief - Goal level: competitive · Assumed - … Round - 2 · started 2026-11-22"). The card now uses `splitProjectNotes(...).goal`, the same split the project page uses.

## O2-D47. Calendar colours by category (5.2)
- One rule in `lib/task-colors.ts` `taskSeries`, used by Calendar, Today, plan previews, the chat library and the legend: a project step takes its project's colour. Canvas items, School-kind tasks and the onboarding school block take the School project's colour (`schoolSeries`), or an unused hue if there is no School project. A Work commitment takes the Work colour. Everything else, one-offs included, is Personal (the slate `seriesColor("personal")`), never the grey "neutral".
- Canvas loses its per-course hue. Per-course hashes could land on a project's hue, and the spec asks for one distinct School colour.
- Work detection: commitment tasks don't store their commitment kind, so Work is the Work project plus a job-like title (`work|job|shift`). NEEDS-SID asks whether to store the kind.
- The legend: each Calendar filter chip carries its dot (School, up to three overlapping project dots, Personal). The grey for cleared Canvas items and rail drafts stays on purpose; it means "not a live item".
- Contrast: the existing palette tests assert 3:1 for every value in both themes; Personal slate is 5.0 / 6.5 against the surface (TANGENT-STYLE §3). task-colors tests 27/27 [ran], with new tests for areas, distinctness and the no-School case.

## O2-D48. Next up card (N06)
- When nothing is left today, Home shows one Next up card instead of the "Next is ..." sentence: the project, the title on up to two lines, when, one line of Why from the step's notes, a Done circle, "Move it" (opens the task, where the date changes) and "Not today" only for a step dated today. Coming up starts folded while the card shows, so the step isn't listed twice.
- Not seen live [code]: the test account has open items today, so the card correctly did not render (live: `.today-nextup` absent with 1 open item today). The post-Confirm landing state is left as is.

## O2-D49. Question strip under the first day section (N16)
- TodaySections takes an `afterFirst` slot. The strip renders after the first part that has items (or after the empty state). It asks nothing until the student has confirmed a project (`plans.some(p => !p.kind)`); setup steps still show. Live [ran] at 390: the strip follows the Morning section, inside the day list.

## O2-D50. Labels and names (N14, N15/F03, F04, F07)
- Calendar "Recent changes" is a text button (44px). On phones (≤520px) it reads "Changes" and keeps the full name for screen readers, because the full label clipped "Agenda" at 390 [ran].
- The question strip's dismiss reads "Hide" (44px), full name "Hide until tomorrow".
- "Personal" everywhere (filters, FeatureTour, calendar import note); "Short-term" is gone from the UI.
- Check-off names are "Done: X" / "Not done: X" on Home, Calendar week, Agenda and task rows; the task panel's button says "Done". Live: 17 such labels, 0 old ones on Home [ran].
- F07: mic and send stay icon-only, as JUDGMENT-2 says (universal icons with names).

## O2-D51. You, mapped: clip, size, counts (N11, F09)
- Area pills on the map never shrink below about 12px (they were about 8px at the back of the sphere) and are kept inside the stage. Live [ran] at 390 over three samples: every pill at least 8px from the edge, rendered size 11.6 to 14.2px.
- The count shows once, on each area's card. The map pill and the chip under it no longer repeat it. An empty area says "Not asked yet" in neutral text, on the chip and (at desktop) on the pill; its spoken name says "not asked yet", never "0 facts".
- The restyle into the flat app surface (JUDGMENT-2 "LATER") is not done; it is a design change bigger than a leftover fix. In NEEDS-SID.

## O2-D52. Removal words (5.4)
- Delete means Tangent's servers; Clear means this device. AI activity's "Clear activity" became "Delete activity" (it calls DELETE) with the confirm text "This deletes the log from Tangent. Your calendar stays the same." Notifications "Clear all" became "Dismiss all" (it dismisses, it doesn't delete). The task panel's trash says "Delete task", and its receipt says "Deleted" with Undo. "Clear this browser" (Your data) stays. The ask box's "Clear" only empties the on-screen answer and stays.
- Rule for asking first: irreversible deletes confirm (AI activity, delete project, Forget everything). A single task delete has Undo instead of a confirm, matching every other step action.

## O2-D53. Calendar rail placeholder and landing image (5.3, 5.1)
- The rail placeholder was a quoted question that cut off; it is now "Can I fit a run in?".
- `/welcome` referenced `public/landing/plan-brief.png`, which didn't exist. It is now a real 720x900 capture of the test account's AP Chem Final Prep steps (light theme). The old alt text and caption promised Why lines the picture doesn't show, so both now describe what is in it.

## O2-D54. Disconnect Canvas (6.1, Sid approved)
- One inline question in Connections, using the shared confirm-panel styles: "Disconnect Canvas? We'll delete your feed link. Remove the 14 Canvas items too?" (the live count of this student's `source = canvas` tasks). Buttons: Cancel, "Keep the items" (secondary), "Remove 14 Canvas items" (danger). With 0 items it is just Cancel and Disconnect. No filled violet button; focus starts on Cancel; Escape closes it.
- The feed link is always deleted. Tasks are deleted only with `removeItems: true`. Both deletes are filtered by `user_id` (`lib/store.ts` `disconnectCanvas`, `/api/canvas/disconnect`). `getCanvasFeedStatus` now returns `itemCount`.
- The fine print changed from "To remove them, use Delete all my data" to "Disconnect deletes the link, and the items too if you say so."
- Google: the Gmail and Calendar token is not per student yet, so there is no Google Disconnect. In NEEDS-SID.

## O2-D55. Live run for Disconnect, test account only
- The test account has no Canvas feed (status `feed: null`), and Connect accepts only real `*.instructure.com` feeds, so no test feed could be connected. The connected state was rendered by stubbing the browser's read of `/api/canvas/status` (14 items). The Disconnect POST it sent was real: 200 `{ok:true, removedItems:0}`, so it deleted nothing because there was no feed row. "Remove the items" was not run live; the store tests cover it (own rows only, manual tasks kept).
- The stub was a test-only `fetch` patch in the browser. It also caused the "Failed to fetch RSC payload" console errors on that tab. Rechecked in a clean tab.

## O2-D56. "Forget everything" now also deletes step_events (6.2, Sid approved)
- `forget_all` calls `clearContextEntries()` then `forgetObservations()`. The card copy says "Clears every fact here and the habits Tangent noticed. Your tasks, projects and chats stay." The confirm body names what goes: pace, best hours and days. Not run live, because it would also wipe the test account's facts that Phase 8 sims read. Covered by store tests.

## O2-D57. "Tangent noticed" in You, mapped (6.3)
- Rows are grouped by data kind, not one per sentence: "How you work through steps" (step kinds), "How you plan" (plan and question kinds), "What you ask about" (chat_ask). One Forget deletes exactly the events behind the row (`NOTICED_KINDS`, every kind in exactly one row, tested). A per-sentence Forget can't work: every step habit is computed from the same "done" rows, so deleting only "skipped" would turn "5 in 10" into a false "10 in 10".
- Same functions and thresholds as the context pack (`noticedHabits` beside `calibrationLines`/`behaviourLines`). A test asserts the student sees exactly as many lines as the AI is given.
- Side effect: forgetting "How you work through steps" also deletes the created, rescheduled and check-in codes the round review counts. That is accepted as what "forget" means.
- Forget uses the page's existing "Forgotten. Undo" delay; nothing is sent until Undo has gone. Live: Undo sent 0 requests; a real Forget of "How you plan" on the test account returned 200 `removed: 17`, and the row stayed gone after reload.
- Card styling: `is-habits`/`is-habit`, because `.is-noticed` already means "a fact Tangent guessed".

## O2-D58. Consent line in onboarding and Privacy explanation (6.4, Sid approved)
- The line is on the first onboarding screen, above Continue, before anything is sent: "To plan with you, Tangent sends what you type to Anthropic's Claude and what you say to Deepgram to turn it into text. Neither trains on it. Continuing means you're OK with that. How we handle your data" (links to `/privacy`, new tab). It matches Settings → Help and privacy (Anthropic no training; Deepgram `mip_opt_out`).
- Settings → Help and privacy gains "What you can take back": habits Tangent noticed, Disconnect Canvas, Forget everything, each linking to where it lives.
- `/dev/app/setup` is 404 under `next start`, so the screenshot came from a short `next dev` run on the same port. Production was rebuilt afterwards (build12).
## O2-D59. Phase 8 round-2 sims: same brief, new slugs, run one at a time
- Round-2 sims reuse `sim-orchestrator-brief.md` unchanged (same task, viewports, 15-step cap), so before and after can be compared.
- New slugs `<persona>-r2` (e.g. `maya-okafor-r2`), so the Phase 1 reports and step logs stay as the "before".
- Run one at a time: all five share one signed-in Playwright browser, and two sims at once would click in each other's tab.
- Same shared test account. It now carries more items from Phase 1–6 checks; the synthesizer is told this is a test artifact.

## O2-D60. JUDGMENT-3 panel and scale
- Panel as the prompt names it: design, student advocate, differentiation. Last overnight's third judge was an investor; differentiation replaces it, because this run's work is the AI and the prompt asks to re-score differentiation.
- Same nine areas and 1–10 scale as JUDGMENT-2, so the round-3 column sits beside the round-2 one. Chat, planning quality and differentiation were "not re-scored" in round 2 (no API credit); this time they are re-scored from the round-2 sims, the live checks and the eval.
- Judges work independently from files and screenshots (no app run, no AI calls of their own), then a chair merges them.

## O2-D61. No code fixes in Phase 8
- Phase 8 asks for sims, judges and the report, not a fix loop. The round-2 sims' top frictions are listed for Sid instead of fixed tonight:
  - Check-in Save closes silently when the server sends no reply (`components/today/StepFollowUp.tsx:59-78`: `onClose()` with nothing shown) [code]. Hit 3 of 5 sims (Maya, Priya, Sam) [ran]. Likely fix: a one-line "Saved. Tangent will use this next time." before closing.
  - The "Draft plan · N steps" pill stays after Confirm (Priya, Sam) [ran, sims only; cause not traced].
  - Stated busy times ignored in placement (Jordan's untimed quiz at 4:30 PM, Priya's shift) [ran]. Same root as the NEEDS-SID "weekly busy times" item.
