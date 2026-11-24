# Live checks, baseline (Phase 1)

Signed in as the test account (persona "Leo"), production build on localhost:3000, 1440x900 unless noted. Server timings from `[perf]` lines (TANGENT_PERF=1). Every row is **[ran]** unless marked.

## L1 Home: "how do I get better at competitive programming"
- Auto destination (the default): **FAIL**. Shows "A few quick questions so this fits you." with a "What does done look like for this?" card (`L1-answer.png`). No answer.
- Why [ran + code]: the request body was `{"home":true,"clarify":true,"slotFlow":true,"newProject":true}` (Playwright network log). `newProject:true` comes from the client: `routeAsk()` in `lib/ask-route.ts` returns "project" for "how do I get…" (`isPlanningRequest`), and `components/add/AddFlow.tsx:223` sends Auto to a new project. The server's talk-first router (`lib/pipeline/talk-route.ts`) is skipped because `app/api/chat/route.ts:273` requires `newProject !== true`. Server log shows only `inferSlots`, no `talk route:` line.
- Same words with the destination pill set to **Calendar** (`L1b-answer-calendar-pill.png`): **PASS on content**. Server `talk route: answer home schedulable`; `talk` on claude-haiku-5-5, in 1828 / out 614 tok, 4147 ms total (first text streamed earlier). No split screen. Ends "Want me to plan it? Plan this into my calendar / Not now".
- Transcript (reply, verbatim excerpt): "Competitive programming is mostly reps plus a structured path… Learn the core toolkit first… arrays, strings, hashing, two pointers, binary search, prefix sums, BFS/DFS, and basic DP… Solve in short timed sets. Use Codeforces Div. 2 A and B problems, and AtCoder ABC problems A through D… Keep a mistake log… Do one contest a week… Fitting it in: Your school nights give you about 2 hours, and you focus best in roughly 45-minute blocks… Since you do your best work late at night… Since you mentioned your chem and algebra grades matter this year, keep weeknight sessions to one block… What language do you already code in…?"
- Issues: says "The free book Competitive Programming 4 (Halim)"; CP4 is a paid book (earlier editions were free), so this is a likely factual slip. Two "Since you…" sentences in a row read as a template. The "Personal" item on Home is still there (nothing added): good.

## L2 "Plan this into my calendar"
- Press → thinking shown (`L2-thinking.png`), then the brief asked one question, repeating the question the talk answer had just asked ("What language do you already code in, and have you done any algorithms before? Answer in the box, or skip and plan it anyway."). Answered "Python, and I've never done algorithms" → stages (`L2-thinking-stages.png`) → split: brief left, month calendar right (`L2-brief-split.png`). **PARTIAL PASS.**
- Timing: first brief 8.0 s (Sonnet, 2820/927 tok) just to ask the question; after the answer: brief 8.2 s + outline 1.9 s + 2 Haiku detail calls in parallel 2.7 s; pipeline total 13.9 s (< 30 s target).
- Steps (topic-specific: yes): Set up Codeforces account (Sun 9:30 AM); Practice dict frequency counting (Tue 3:30 PM); Solve prefix-sum problems in Python (Wed 3:30 PM); Re-solve Tuesday's problems cold (Fri 3:30 PM); Run a timed virtual contest (Sat 9:30 AM). Goal line: "Start competitive programming in Python from zero, and this week solve your first easy problems with arrays, hashing, and prefix sums." The answer was used.
- Reasons, verbatim, with problems:
  - Sun 9:30 AM: "Sunday is your free evening, and your weekly video upload keeps the day busy, so this first session stays light" → **contradicts itself** (free evening vs busy day) and the slot is morning, not evening.
  - Tue 3:30 PM: "You said you do your best work late at night, so a 45-minute hashing block after homework fits" → **reason contradicts the time** (3:30 PM is not late at night).
  - Wed: "Prefix sums are the first real algorithm trick, and one 45-minute block respects your 2-hour school-night limit." OK (names capacity).
  - Fri: "Friday is your last school day, so re-solving cold is a cheap review before the weekend" OK.
  - Sat 9:30 AM: "You told me you lock in when there's a real deadline, and Saturday is completely free" OK (calendar fact + student fact).
- No banned generic phrases seen. Monday and Thursday (Thanksgiving, Nov 26) left empty; no reason says why.

## L3 Confirm
- **PASS.** "Saved 5 steps to your calendar. First up: Set up Codeforces account, Sun, Nov 22 · 9:30 AM. View in Calendar · Undo" (`L3-saved.png`). All 5 titles found on /calendar (`L3-calendar.png`) and on Today under project "Python Competitive Programming Basics" (`L3-today.png`), each with "Not today / Too big".
- Issue: Today's header says "2 left today · next: Keeping a weekly Sunday video upload… at 6:00 PM" while "Set up Codeforces account" at 9:30 AM is earlier the same day. The "next" pick skips the plan step.

## L4 Capture "math hw due Thu, dentist Fri 3pm, start reading Gatsby" (/capture, tap to type)
- **FAIL.** No tasks. Shows "What did you mean? Make a plan / Just add one task / Just talking / Other… / Skip for now" (`L4-capture-after.png`).
- Server: `talk route: add home` → capture fast paths (`quickCapture`, `splitCaptureItems`) did not take it → `intentRouter` (Haiku, 1773 tok in, 1.2 s) → a route question. Three comma-separated items with day words are the most common capture shape, and it can't be read.
- Why [code]: `splitCaptureItems` (`lib/ai/router.ts:319`) returns null unless **every** piece has a day; "start reading Gatsby" has none. Then the AI router calls the whole line unclear.

## L5 Capture "chem test Thu Dec 17"
- **PASS on date** (`L5-capture.png`). Saved without a model call (`addTask` came before any `[perf]` line). Stored task from `/api/state`: `{"title":"Chem test Thu","date":"2026-12-17","time":"15:30"}`. Dec 17 2026 is a Thursday.
- Issues: the title keeps the leftover "Thu". A test is an event at school, but the spacing brain gave it a 3:30 PM study-style slot. Afterwards there were two Sonnet calls (`clarify` 1743/140 tok, `refineTask` 2709/194 tok, 3.8 s). Two Sonnet calls for a one-line to-do go against the Haiku-first cost rule.

## L6 Capture "help me get ready for the SAT in March"
- **FAIL.** It went straight to "A few quick questions so this fits you." with first question **"When is this?"** (This week / 2 weeks / 1 month / End of term), even though the student said March. No talk-first answer. (`L6-capture.png`)
- Why [code]: same cause as L1. The client's Auto destination sends it as `newProject`, which skips talk-first. The slot grill doesn't read "in March" as the timeframe, and its options don't include March, which breaks the rule "never ask what's known".

## L7 Home "delete all my tasks"
- **PASS.** No model call (`talk route: action home` → `addPendingConfirmation delete_task`). Card: "Delete 93 tasks and 1 project? You can undo this. Confirm / Cancel" (`L7-delete-confirm.png`). Cancel → `/api/state` still has 93 tasks.
- Note: 93 counts every copy of the weekly Sunday upload (a repeating item), while the student sees about 7 things. "93 tasks" sounds alarming; consider counting repeating items once ("7 tasks, 1 repeating item, 1 project").

## L8 Done on a step ("Set up Codeforces account", Home)
- **PARTIAL.** Done → dialog "How did "Set up Codeforces account" go? Nailed it / Okay / Struggled / Skip" (`L8-checkin.png`). Picking "Okay" adds a **second row** "Less time / About right / More time", a note field, and Save (`L8-next.png`). Save closes it. **No "Next: …"** shown (`L8-after-save.png`); the header still says "next: Keeping a weekly Sunday video upload… at 6:00 PM", not the next plan step (Tue "Practice dict frequency counting").
- Why [code]: `components/today/StepFollowUp.tsx` has no next-step line; the second chip row and note only appear after the first tap (lines 133-152).

## L9 "Not today" twice on "Practice dict frequency counting" (Home, Coming up)
- 1st tap: no question; step moved from **Tue Nov 24 → Mon Nov 23** (`/api/state`; server `update_task`, `reschedule_task`). **Bug:** "Not today" on a step that was not today moved it **earlier**. (`L9-not-today-1.png`)
- 2nd tap: one question "What's getting in the way of "Practice dict frequency counting"? No time / Unclear / Not feeling it / Blocked / Skip" (`L9-not-today-2.png`). **PASS** on asking one reason.
- Picked "No time": step stays Mon Nov 23 3:30 PM, other steps unchanged, no message about the reason (`L9-replan.png`). **FAIL** on "re-plan respects it".
- Why [code]: `app/api/today/route.ts:95-107`: the reason is only logged (`logStepEvent`); `planNotToday` ignores it. Nothing shortens, splits or spreads the step for "No time", and nothing asks "Unclear" what's unclear.

## L10 Project chat "what should I do first?" (Python Competitive Programming Basics)
- **PASS with issues** (`L10-project-chat.png`). `talk route: answer project`, Haiku talk 2419/405 tok, 2.6 s.
- Reply (excerpt): "Start with the dict frequency counting drill tomorrow. Your first open step is Practice dict frequency counting on **Monday, 2026-11-23**, at 3:30 PM, right after school… Open Codeforces and filter problems tagged implementation or strings, rated around 800–1000. Solve 3 problems using a dict or collections.Counter… Since you mentioned you can focus for about 45 minutes at a time…"
- Issues: a raw ISO date in the prose ("2026-11-23"); half the answer drifts to the Sunday video upload, which is outside this project; it ends with two questions ("Do you usually have chem or algebra homework due Monday? And roughly how long…"). It answered from the project's steps and a student fact (45-minute focus).

## L11 Calendar rail "can I fit a run in Thursday?"
- **PASS on placement, PARTIAL on facts** (`L11-calendar-rail.png`). `talk route: answer rail`, Haiku 2254/319 tok, 2.1 s. The answer stays in the "Your next 7 days" rail; Home shows nothing about it.
- Reply (excerpt): "Thursday is your lightest day. Your plan shows nothing scheduled, so you have a full 2 hours of capacity open, and **school ends at 3:00 PM**. Best window: Thursday right after school, around 3:30–4:00 PM… Thanksgiving week: Thursday is Thanksgiving, so the day may be more relaxed or packed with family plans…"
- Issues: it says "school ends at 3:00 PM" and "right after school" for Thanksgiving Day, then says it's Thanksgiving. It invents a "late-night work block" that isn't on the calendar. It ends with a question.
- Home draft: the rail never touched Home. Separately, **unsent text in the Home box is lost** when you leave Home, by sidebar link or by reload ("buy poster board for the science fair" typed, Calendar → Home: box empty; `L11-home-draft.png`). [code] `components/add/AddFlow.tsx` keeps the box text only in React state. This conflicts with "drafts never lost" if that rule covers unsent text.

## L12 Finish a round (4 of 5 done, "Run a timed virtual contest" left open) → "I've finished this round"
- `roundReview` Haiku 651/165 tok, 3.8 s. 4 questions:
  1. "Which step did you not finish, and what got in the way?" (Ran out of time / Step was unclear / Felt too hard / Forgot about it) → **doesn't name the step**, though only one was open. Not data-based.
  2. "Were the steps too small, or should some be bigger next round?" (generic)
  3. "Should next round include more practice problems, or fewer?" (topic-aware)
  4. "When should round 2 start?" Start now / Push 1 week / Pick a date + a 2-week calendar preview (`L12-review-last-2.png`, `L12-round2-week2.png`).
- Last question: old round-1 steps are shown **struck through with ×** ("Done in the last round" / "From the last round" labels). **PASS** on X-ed old steps.
- Round 2 (plan brief Sonnet 9.4 s + outline + 2 details; total 15.2 s) builds from the answers: "More practice" → "Solve 4 array and loop problems", "Solve 4 sorting and counting problems", "Solve 10 limit problems", "Review timed contest tactics"; "Ran out of time" → "Finish the missed round 1 step" Sun 9:30 AM. **PARTIAL PASS.**
- Issues after "Start round 2 today" (`L12-round2-saved.png`): "Finish the missed round 1 step" is vague (should say "Run a timed virtual contest") **and** the original "Run a timed virtual contest" Sat 9:30 AM is still listed, so the missed step shows twice. "Solve 10 limit problems" reads like calculus (its detail says "limits and early exits"). Week 1 of the preview is Nov 16–22, six days of which are past. Round 2 doesn't say why it changed ("because you said more practice…").

## L13 Sensitive line in the daily follow-up bubble → **FAIL (safety, top priority)**
- The bubble didn't open by itself today: the 6 task-clarify questions ("6 questions from Tangent") held the overlay slot. I pressed Later, then opened the follow-up with the same `tangent:get-to-know` event Settings uses (`L13-bubble.png`, `L13-bubble-open.png`).
- Q: "Which class or activity takes the most out of you right now?" Typed: "honestly chem, I've been so stressed I feel like I can't keep going and don't want to be here anymore".
- Reply: **"Got it. Tangent will plan with that."** (`L13-bubble-reply.png`). Context facts went 15 → 16; the new fact is "What takes the most out of you right now? honestly chem, I've been so stressed…". No task was created.
- Cause [code]: the `DISTRESS` regex in `lib/student/sensitive.ts:38` has "can't go on" and "don't want to (be alive|live|exist)", but not "can't keep going" or "don't want to be here (anymore)". `replyFor` (`lib/student/follow-ups.ts:295`) never calls `isSensitive`, so health and mental-health answers in the bubble are saved too.
- Cleanup: I removed the one fact with the app's own per-fact `forget` action (the Settings Forget call) on the test account. Facts are back to 15 (O2-D4).

---

# Phase 2 re-checks (after the fix loop; build of 2026-11-22 ~4:48 AM, server logs server3-6)

Times are server-side `[perf]` lines. Spend for these re-checks: about $0.04 (server5.log, 10 calls).

| # | Result | Evidence | Notes |
|---|---|---|---|
| L1 | **PASS** [ran] | `R2-L1-answer.png` | Talk answer on Auto, specific to Leo (Codeforces, Div 2 A, his 45-minute focus), then "Plan this into my calendar / Not now". Haiku talk, ~3 s. |
| L2 | **PASS** [ran] | `R2-L2-brief.png`, `R2-L2-draft.png` | `talk route: plan home`. Sonnet brief 7.5 s + plan fix 2.4 s + outline 2.2 s + 2 Haiku details; **15.9 s total** (target < 30 s). 5 topic steps: Div 2 A problems Mon 5:30 PM, sorting and counting Wed, redo problems cold Thu, timed virtual contest Sat 3 PM, review Sun 11 AM. Issues: the Thu step's Because said "School ends at 3:00 PM" on Thanksgiving (**fixed**, O2-D35; holiday now wins); the Wed Because cites an unrelated club item ("Find club rules… ends at 8:05 AM"); one fact quote reads clunky ("you said 'Python Competitive Programming Basics round 1, asked …: More practice'"). The plan was left as a draft (I couldn't hit the brief's Confirm by selector), so it sits in the Draft dock. |
| L4 | **PASS** [ran] | `L4b-capture-open.png`, `L4b-capture-result.png`, `L4b-capture-after.png` | "math hw due Thu, dentist Fri 3pm, start reading Gatsby" → 3 tasks, DUE line kept, dentist fixed at Fri 3 PM. |
| L4c | **PASS** [ran] | `L4c-due-day-kept.png` | "guitar Sat 10am" keeps Saturday as the day, not in the title. |
| L6 | **PASS** [ran] | `R2-L6-answer.png`, `R2-L6-open.png`, `R2-L6-composer-clear.png` | /capture "help me get ready for the SAT in March" → `talk route: answer home schedulable`, Haiku 3.0 s, talk first, not a plan. Issues: the unconfirmed L2 draft popped over the composer as a floating card (**fixed**, O2-D37: the palette no longer re-opens waiting drafts; they stay in the Draft dock; re-checked after the rebuild: box opens clear). The /capture answer renders raw `##` markdown (logged, not fixed). |
| L8 | **PASS** [ran] | `R2-L8-done.png` | Done → check-in → "Next: Solve 4 array and loop problems · Tue, Nov 24 3:30 PM" with Undo. |
| L9 | **PASS** [ran] | `R2-L9-first.png` (before fix), `R2-L9-first-after-fix.png`, `R2-L9-second.png`, `R2-L9-reason.png`, `R2-L9-notime.png` | Before the fix, "Not today" sent "Confirm final scope and list units" to Sat, Dec 5 (two weeks out). After O2-D36: Physics lab Sun → **Wed, Nov 25** (3 days). Second tap on the same step asks "What's getting in the way of 'Physics lab'? No time / Unclear / Not feeling it / Blocked / Skip". "No time" → "Moved 'Physics lab' to Mon, Nov 30, the lightest day coming up". Separately Math hw Mon → Sat, Nov 28 (inside the 5-day window). Test data moved on the test account only. |
| L11 | **PASS** [ran] | `R2-L11-rail.png` | Rail: "Thursday, Nov 26 is Thanksgiving, so there's no school that day and plenty of room… about 1.5 hours of work against a 2-hour capacity". Suggests a 30–40 min run before the 3:30 block; warns Friday is overloaded (2.5 h vs 2). No ISO dates (checked by regex on the rail text). Home untouched. Issue: the rail header said "Nothing on your calendar for the next 7 days" before the answer loaded, then "17 things…" (a loading-state flash). |
| L13 | **PASS** [ran, earlier in Phase 2] | unit tests in `lib/student/student.test.ts`, `lib/student/follow-ups.test.ts` | The distress line gets the kind reply and nothing is saved. Not re-shot after the last rebuild: the 18-question card held the bubble slot. |

Not re-run in Phase 2 (passed in Phase 1 or only cosmetic issues): L3, L5, L7, L10, L12 (see above; L10 ISO date and L12 round-2 fixes are in DECISIONS O2-D18/O2-D19 and covered by unit tests).

## Phase 3.4 live checks (build 8, server9; 1440x900, test account)
All [ran] unless marked.
- **PlanBrief Because rows: PASS with one fix.** "Help me get better at chess openings over the next two weeks, I have robotics Tue and Thu after school" → talk answer → "Plan this into my calendar" → brief with 5 steps, each with Why and Because (`P3-brief-because.png`, build 7). Because rows named real things: "Keeping a weekly Sunday video upload going… is at 6:00 PM on Sun, Nov 22", "School ends at 3:00 PM on Mon, Nov 23, plus 1 more", "Thu, Nov 26 is Thanksgiving, so most schools are closed", "you asked about “chess openings over the next two weeks”". No step on Tue or Thu (robotics was respected).
  - Bug found: step 3's Because showed the stored round-review record: `you said “Python Competitive Programming Basics round 1, asked "Should next round include more practice problems, or fewer": More practice”`. Fixed in `saidLine` (O2-D45) → "you said “More practice” in your Python Competitive Programming Basics round 1 review" [ran: because.test.ts]. The existing chess draft keeps its stored line; new plans get the new wording [code]. A CP answer steering a chess plan is in NEEDS-SID.
  - Plan timings (server8): brief 8.4 s, outline 2.2 s, details 2.0/2.5 s in parallel; pipeline 14.0 s. Cost about $0.025.
- **Project cards: fixed.** `/projects` cards printed the planner's brief ("Brief — Goal level: competitive Assumed — … Round — 2 · started 2026-11-22"). After O2-D46 the cards show only the goal (`P3-projects-goal-only.png`, build 8).
- **Round sheet: PASS.** Project page → "I've finished this round" → "Round 2 review", Question 1 of 4: "Which kind of step should get more time next round?" with chips from this round's own steps (array and loop / exponential equation / sorting and counting / "None, the pace was fine"), an optional text box, and Stop, Skip and Next (`P3-round-sheet.png`). Stop closed it and the project still says "Round 2 · started Nov 22". roundReview (Haiku) 2.5 s.
- **"Too big" in why-not: PASS.** Not today on "Start reading Gatsby" (moved to Wed, Nov 25, with Undo), then Not today again → "What's getting in the way of “Start reading Gatsby”?" with No time, Too big, Unclear, Not feeling it and Blocked (`P3-why-not-too-big.png`). Too big → split preview on the same row: Open the book to chapter one 5 min · Read the first chapter 25 min · Jot down first impressions 10 min, with Use these and Keep as is (`P3-too-big-split.png`). splitStep (Haiku) 2.3 s. Kept as is.
- **Home nudge: PASS.** "A few questions to sharpen your plans" (`P3-home-nudge.png`, build 7).
- **Day-2 card: not reachable live.** Every plan on the test account was created today, so no step from the last 1–2 days qualifies. Seeding older steps would need database writes, which tonight's rules don't allow. Covered by `lib/day-two.test.ts` (9 pass on seeded dates) [ran: unit tests only].
