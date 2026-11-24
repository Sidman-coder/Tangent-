# Judge: Differentiation, round 3

Date: 2026-11-22. Branch `push-v1`.

**Question:** where does Tangent do something a student could not get from ChatGPT, Notion or Todoist, and where is it only equal or worse?

**Method:** a read-only review of files.
- I did not run the app or call any AI API, and I did not browse the web or read the other round-3 judges' files.
- The baseline for each area is the JUDGMENT-2 chair mean (`docs/overnight/JUDGMENT-2.md`).
- Chat, Planning quality and Differentiation were "not re-scored" in round 2. I re-score them here and give them double weight in the overall score.

**Labels:** **[F]** fact from a file · **[I]** inference · **[O]** opinion · **[OWN]** what competitors do, from my own knowledge and not checked this round. The competitor baseline follows `docs/overnight2/judges/AI-J1-differentiation.md`.

## Limits (read these before the scores)

- **[F] Shared test account.** One account mixes five personas, with 23 stored facts from several of them (`docs/overnight2/CONTEXT-ENGINE-NOW.md`). Some Because lines and the "Tangent noticed" rows are polluted by other personas. The heuristic report says the same: "odd or duplicate item content is test data".
- **[F] Synthetic users in a headless browser.**
  - The round-2 sims are AI personas driven through Playwright.
  - The mic was silent because the browser has no microphone (Jordan r2), so voice capture, the pen's core input, was not tested.
- **[F] Some features were only seen in code.**
  - The Day-2 card was never reachable live ("unit tests only", `docs/overnight2/PROGRESS.md` 3.4).
  - The Next up card was "code, not rendered" (PROGRESS 5.3).
  - A real second round was not run live after the night's fixes.
- **[I] Differentiation is mostly a multi-day claim.** "Chatbots answer you. Tangent follows up." needs several days to show. Every run here covers one session, so this judgment leans on single-session evidence and probably undersells the follow-up loop.
- **[OWN] Competitor claims were not checked this round.**
  - ChatGPT has memory, Projects, Tasks and calendar connectors.
  - Notion AI writes pages and databases.
  - Todoist has natural-language quick add, AI subtasks and voice capture that splits rambles into tasks.
  - None of the three places a study plan around the student's real load and then asks how it went without being prompted.

## 1. Scores, round 2 → round 3

The round-2 scores are the JUDGMENT-2 chair means; nr = not re-scored in round 2.

| Area | R2 → R3 | Evidence | Label |
|---|---|---|---|
| First-use | 4.33 → **5** | 4 of 5 round-2 sims did every task action; in Phase 1, all 5 abandoned (PROGRESS 8.1 pattern). Jordan still abandoned at step 4: "geometry quiz friday" was placed at "Fri 4:30 PM", inside practice (`results/2026-11-22-jordan-reyes-r2.md`). The onboarding consent line shipped (PROGRESS 6.4). | F, O on the score |
| Chat (re-scored, weighted ×2) | 4.33 nr → **5** | Talk 3.0 s, router 19/19 (`docs/overnight2/AI-RESULTS.md`). The plan changed without a chat reply (Maya r2). Leo's typed report got "Logged how "Review weakest algebra units" went. Thanks for telling me. It helps size the next steps.", and the Thursday step was unchanged (`results/2026-11-22-leo-brandt-r2.md`). Leo: "It remembered what I'd told it before, but it ignored what I told it just now." | F; O on the score |
| Planning quality (re-scored, weighted ×2) | 6.33 nr → **6** | Eval 62/64, 0 banned phrases (AI-RESULTS). Plans are dated with a reason per step (Priya r2: "One typed sentence became a dated 5-step plan with a reason per step"). Stated busy times were broken in 3 of 5 sims (PROGRESS 8.1 pattern), and Maya's first draft put a step on the day of her final. Priya's Because line claimed the step "comes after your 4-9pm hours" while it stayed at Wed 6:30 PM. | F; I: false reasons cost more trust than missing ones |
| Today (Home) | 6.33 → **6** | Heuristic R3 F01: "3 left today · next: … at 6:00 PM" while 9:30 and 10:30 items were still open. F14: the draft pill covers "Answer". The Day-2 card and Next up card were not seen live. The Too big split works live (`docs/overnight2/live/LIVE-NOTES.md` Phase 3.4). | F |
| Calendar | 6.33 → **6.5** | The rail answered "Thursday, Nov 26 is Thanksgiving… about 1.5 hours of work against a 2-hour capacity" (LIVE-NOTES L11). Maya's best moment was "Saved 5 steps to your calendar". The R2 heuristic finding (8.0) is gone. New: F12, Calendar rows drop the project name. | F |
| Projects | 5.00 → **5** | Project cards now show the goal only (O2-D46). Project matching misses synonyms, and a miss is silent ("dancing", "SAT", "coding" → Python; CONTEXT-ENGINE-NOW). Sam's "english essay due friday" was added to the open ED II draft. Ticking a step on the project page gave Leo no check-in. | F |
| Settings / You | 6.00 → **6.5** | "Tangent noticed" rows each have a Forget button (a live Forget returned 200 `removed: 17`). Disconnect Canvas works, and "Forget everything" also deletes step_events (PROGRESS 6.1–6.3). Against that: F15, the map pushes the facts below the fold; F11, no undo note; F06, "chat ids". | F; O: privacy controls beyond ChatGPT memory are a modest edge [OWN] |
| Overall polish | 6.33 → **5.5** | Check-in Save closed silently for 3 of 5 sims. The leftover draft pill appeared for 2 of 5. F07: the draft bar's only dismiss is an X that discards the draft (3/3 raters). Leo's sentence was mangled into "edit 's video", and his time edit saved only on blur. 1053 tests pass, but the live run shows rough edges. | F |
| Differentiation (re-scored, weighted ×2) | 6.00 nr → **6** | The loop is now reachable end to end: Maya, Priya and Sam each said yes when asked whether it differs from ChatGPT, Notion and Todoist (sim reports, "Different from generic apps"). The core claim, that the follow-up changes what comes next, was not shown: Leo's report left the next step unchanged, and Save was silent for 3 of 5. Leo: "a fancier version of the same thing". Jordan: "looks like Todoist's quick add, plus a made-up time." | F (quotes); O (score) |

**Weighted overall** (Chat, Planning and Differentiation counted twice): (5 + 2×5 + 2×6 + 6 + 6.5 + 5 + 6.5 + 5.5 + 2×6) / 12 = **5.7** **[O]**. The round-2 chair overall was 5.67, so the change is about zero. **[I]** The night widened what a student can reach (4 of 5 complete the loop, against 1 of 5 before). It did not widen what is unique: the visible proof that Tangent "follows up and adapts" is still missing.

## 2. Three moments where Tangent is clearly better

1. **A typed sentence becomes a dated plan placed on the student's calendar, with a reason per step.** [F]
   - Priya r2: "Yes, clearly. One typed sentence became a dated 5-step plan with a reason per step."
   - Sam r2: "Todoist would have stored one task and ChatGPT would have produced text with no calendar."
   - Maya r2: "ChatGPT could write a study plan but can't put it in her calendar."
   - [OWN] None of the three competitors places steps around the student's real load without manual dragging.
2. **The check-in after Done arrives without being asked.** [F]
   - Maya r2 was "relieved it asked me on its own".
   - Sam's check-in got "the run's only High clarity".
   - LIVE-NOTES L8 (R2): after "How did … go? Nailed it/Okay/Struggled" came "Next: Solve 4 array and loop problems · Tue, Nov 24 3:30 PM".
   - [OWN] ChatGPT and Todoist never ask how a task went.
3. **Capacity and context reasoning a generic tool does not do.** [F]
   - The rail said: "Thursday, Nov 26 is Thanksgiving, so there's no school that day… about 1.5 hours of work against a 2-hour capacity", and warned that Friday was overloaded (L11).
   - After "No time", the step "Moved 'Physics lab' to Mon, Nov 30, the lightest day coming up" (L9).
   - The Too big split gave "Open the book to chapter one 5 min · Read the first chapter 25 min · Jot down first impressions 10 min" (Phase 3.4).
   - Leo said it "pulled in my 1,000-subscriber goal and school hours, which ChatGPT would never do".

## 3. Three moments where Tangent is equal or worse

1. **Capture is worse than Todoist quick add.** [F]
   - Jordan's "geometry quiz friday" got an invented time, "Fri 4:30 PM", inside practice. He left: "looks like Todoist's quick add, plus a made-up time."
   - Leo's sentence was mangled into "Get ready" and "edit 's video".
   - Sam's essay was attached to the wrong draft.
   - [OWN] Todoist would have stored the task correctly with no date guesswork.
2. **The follow-up does not change anything, so it reads like a form.** [F]
   - Leo's report got the generic "Logged how … went" while the next step stayed the same.
   - Save closed silently for Maya, Priya and Sam. Maya: "talking to a form, not a planner".
   - [I] On the surface this is the same as a Todoist checkbox. It is worse than ChatGPT, which at least answers in words.
3. **Hard constraints are broken while the reasons claim the opposite.** [F]
   - Priya's step stayed in her 4–9 PM shift with a Because line saying it came after the shift. She fixed it by hand.
   - Leo had 2 prep steps after his Friday test.
   - Maya's first draft had one step on the day of her final: "worse than a ChatGPT answer" (Maya r2).
   - Leo: "read like it's just saying stuff to sound like it knows me" (AI-J1).
   - [I] A ChatGPT plan with no reasons would be about as wrong, but less misleading.

## 4. Top 5 next fixes that would widen the gap (ranked)

1. **Make the check-in visibly change the next step and say so.** Save should confirm with "Got it, I moved X / shortened Y"; a report or "Struggled" should reshape the next step (`components/today/StepFollowUp.tsx:59-78`, the report route).
2. **Treat stated busy times, test dates and deadlines as hard blocks.** The plan guard should reject any Because line that claims compliance the slot does not have.
3. **Reply in words to every correction or replan:** one line saying what moved and why.
4. **Make capture at least as good as Todoist.** Keep the student's words. With no time given, make it date-only plus a "Plan study time" offer. Never attach it to an unrelated open draft. Say where it went (F05 "Goes to: Auto").
5. **Record a real two-day run live,** with the Day-2 card and round 2 on the actual app, to show "follows up" as the investor note in JUDGMENT-2 asked. Clear the draft pill after Confirm as part of the same pass.

## 5. Verdict

**5.7 / 10 [O]:** Tangent now reliably turns one sentence into a calendar plan with reasons, which no competitor does. But its unique promise, a follow-up that changes what comes next, is still asked and never acted on, and its reasons sometimes claim constraints it broke.
