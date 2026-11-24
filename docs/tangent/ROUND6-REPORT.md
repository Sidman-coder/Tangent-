# Round 6 report: trust fixes before the pilot

Branch `push-v1`, 2026-11-22. Plan and log: [ROUND6-PLAN.md](ROUND6-PLAN.md). Spec: `tangent-round6-trust-fixes.md`.

How to read the tags:
- **[ran]** means a command, test or live check ran and its output or screenshot is cited.
- **[code]** means it was read from the code but not run.

Live checks ran **signed in** on the test account, against a production build (`next start -p 3107`).

## Result in one screen

| | Before | After |
|---|---|---|
| Steps inside a stated busy time or on/after the deadline (3 sim cases) | 7 (Priya 2, Leo 2, Maya 3) | **0** [ran] |
| False Because/WHY lines after the check (3 sim cases) | up to 2 per plan | **0** in the last 3 runs [ran] |
| Steps with an if-then line | 0 | **11/11** [ran] |
| Titles over 6 words (last run) | not checked | **0** [ran] |
| Full eval (`npm run eval:pipeline`) | 62/64 (overnight report) | **63/63**, twice: at 390498a and at the final commit b78c26b [ran] |
| Unit tests (`npm test`) | 1057 at the start of the round | **1090/1090** [ran] |
| AI spend this round | | **≈ $1.18** of the $3 cap |

Gates on the last commit (deefdce) [ran]:
- `npm run lint`: 4 warnings, the same 4 as before the round (AddFlow 486, CaptureHome 213/261, PathScene 247)
- `npm run typecheck`: 0 errors
- `npm test`: 1090/1090
- `npm run build`: compiled successfully

## Items

### 1. Check-in Save confirmation (6f0af3e)

**What changed:**
- The check-in card now swaps in place to "Saved. Next: <next step · day time>". The line has `role="status"`. The card closes itself after about 2.5 s and has a Close button.
- When Tangent replies, "Saved." sits above the reply.
- When the save fails (server error, `ok:false` or no network), the card stays open with the student's choices kept. It says "That didn't save. Try again." and Save still works.
- The save logic is in `lib/check-in-save.ts`; the card is `components/today/StepFollowUp.tsx`.

**Evidence:**
- [ran] `lib/check-in-save.test.ts`, 4 tests: success, reply, failure (server error, `ok:false`, no network), and a 200 with an unreadable body.
- [ran] Live: screenshots `docs/design/screens/round6/2a-checkin-before-save.png` and `2b-checkin-saved-confirmation.png`. The second shows "Saved. Next: Brainstorm and pick topic · Tue, Nov 24 7:30 PM".

### 2. Hard constraints, placement check, Because truth check (134a8d6, aabb8ee, e680c74, 8a3db72, deefdce)

**What changed:**
- **Stated busy times and deadlines are read** by `lib/plan-constraints.ts`.
  - Busy times: "I work at the bakery Wed 4-9pm and Sat-Sun 8am-2pm", "soccer Mon–Fri", "debate Tue 3:30-5".
  - Deadlines: "test Friday", "final is Thu Dec 17", "ready before Jan 5".
  - "study tue 3:30-5" stays a time to use.
  - Plans stop the day before the deadline.
  - A `Deadline:` note line keeps the deadline for Round 2 and re-plans.
- **Placement check** (`lib/placement-check.ts`): after the plan is built, a step that falls inside a block (school, a commitment, a fixed task or a stated busy time), or on or after the deadline, moves to the nearest free slot before the deadline.
  - If nothing fits, the step is dropped and the draft says "Couldn't fit X before <date>; want me to shorten the plan?"
  - The exam itself may sit on its own day.
- **Because truth check** (`lib/ai/plan-guard.ts`). `claimCheck` catches these false claims about a step:
  - after or before a block or the test
  - inside a block
  - the wrong clock time or weekday
  - day-of / night-before / "the final is this same day" / "the test is tomorrow" / "the final's date" / "lands on this date"
- **False reasons are rewritten in code**, with no AI call, from the real slot. Examples: "Starts after school ends (3:00 PM).", "Open time on Wednesday at 4:00 PM."
  - A step that moved loses any reason that talks about its old slot, including a named date such as "on 17 Dec".
- **Wiring:** the plan path (`lib/voice-handler.ts`) and Add to plan (`lib/pipeline/extend-plan.ts`).

**Evidence:**
- [ran] `lib/plan-constraints.test.ts`, 5 tests. They cover the exact Priya, Leo and Maya sentences plus other wordings.
- [ran] `lib/placement-check.test.ts`, 5 tests:
  - Leo: both after-test steps move before Friday.
  - Maya: the event itself may sit on Dec 17; prep may not.
  - When there's no room, the step is dropped with the question.
  - Priya's "after your 4-9pm hours" is rewritten.
  - A true/false claim table that includes every wording the item 7 reruns found.
- [ran] Targeted eval; see the table under item 7.
- [ran] Live: `docs/design/screens/round6/1-priya-plan-no-shift-steps.png`. Priya's sentence gave a plan with no step in her Wed 4-9 PM or Sat/Sun 8 AM-2 PM shifts.

### 3. Draft pill (3092fee, 390498a)

**What changed:**
- **Confirm** clears its own pill. It also clears older drafts of the same conversation, meaning the same page plus the same project, a shared title word, or a shared word from the request.
  - Confirmed ids are remembered for the session, so an old message can't bring the pill back.
- **The pill's ×** is now **Hide**. Hide discards nothing; the draft shows again on the page where it was made.
- **Discard** (with Undo) lives inside the opened card only.

**Evidence:**
- [ran] `lib/drafts/draft-store.test.ts`. Five new tests cover the Leo/Priya Confirm case, unrelated drafts left alone, same project, the live Priya case, and Hide.
- [ran] Live, first attempt: **failed.** An earlier "Add to project" draft kept its pill after Confirm on a re-plan that named a new project. Commit 390498a fixes it by matching request words, not only the title, and adds a test named "live Priya case…".
- [ran] Live, second attempt: passed.
  - `3b-replan-before-confirm.png` shows the draft before Confirm.
  - `3c-after-confirm-home.png` shows Home after Confirm.
  - `3d-after-confirm-calendar-no-pill.png` shows /calendar with no pill (0 drafts in storage).
  - `3a-replan-before-confirm-pill.png` is from the failed first attempt.

### 4. If-then steps (b8dd2ca, 8a3db72)

**What changed:**
- Each step gets an if-then line built **in code from its final slot**, with no model call, so the cue is always real.
  - With a cue: "When debate ends Tuesday (5:00 PM), then solve Ksp and solubility problems." The cue is a fixed item or stated busy time that ends 0–30 min before the step.
  - With no cue, it uses the step's time: "At 4:00 PM Monday, then …".
- The line is stored as a `WHEN:` note line. It shows under the title on the plan brief's step cards and in task detail.
- Titles:
  - The model is asked for 2–6 words, verb first.
  - `shortTitle` drops a trailing clause, then articles ("Complete a full AP Chem practice final" → "Complete full AP Chem practice final"). It never cuts mid-phrase.

**Evidence:**
- [ran] `lib/if-then.test.ts`, 5 tests.
- [ran] Targeted eval, last run: 11 if-then lines. 7 are cued by a calendar item and 4 by the time. Titles over 6 words: 0.
- [ran] Cost per plan brief is unchanged: $0.010 before, $0.010–0.011 after (the eval's `[perf] claude` totals).

### 5. Busy times become calendar blocks (abf7117)

**What changed:**
- When the student states a recurring busy time, Tangent asks "Add bakery shifts as busy time?" with **Yes** / **Not now**.
- **Yes** saves it as a weekly commitment through the existing `cmt_` path. The new POST `{ add }` on `/api/commitments` needs no schema change. The row then reads "Added. It's in Settings → Schedule." with a link.
- **Not now** hides it for the session.
- Nothing is added without the tap.
- The offer is read from the student's own words in code, with no AI call (`lib/busy-offer.ts`). It isn't offered when a saved commitment already covers that time.
- It shows on Home's plan brief, in the talk thread, in task/project chats and on the capture card.

**Evidence:**
- [ran] `lib/busy-offer.test.ts`, 3 tests. They cover Priya's offer as a weekly work commitment, the cases that must not get an offer, and the whole chain from Yes through `cmt_` tasks to Settings reading it back. In that chain, a 60-min Wednesday capture lands outside the shift; before, it landed at Wed 3:30 PM, inside it.
- [ran] Live:
  - `docs/design/screens/round6/4a-busy-offer-added.png` shows the Yes, then "Added".
  - `4b-settings-schedule-bakery-shifts.png` shows Settings → Schedule listing Bakery shifts.
  - The shift blocks also appeared on Home: Wed 4 PM, Sat and Sun 8 AM.

### 6. Small items (bdcc5c1)

- **SAT fixture** [ran]: `r4-help-me-sat` moved from `requests.json` to `talk-first.json` as an answer plus the Plan this offer. It is checked free in `npm test` (`lib/pipeline/talk-route.test.ts`). `requests.json` now has 63 cases.
- **Project-scoped facts** [ran]: a fact tied to another project is left out, not halved (`lib/student/context-pack.test.ts`). This covers the chess plan / Python round case.
- **Export** [ran]: `step_events` is in `EXPORT_TABLES` (`lib/settings/settings.test.ts`).
- **Pack log** [code]: `buildStudentContext` logs `[perf] pack <purpose>: N tok, kept [...], dropped [...]`. It logs section keys only, never student text.
- **glanceLine** [ran]: "next:" names the earliest upcoming fixed item or plan step (`lib/today-sections.test.ts`).
- **Near-duplicate facts** [ran]: the 45-minute pair merges, and the newer one is kept. Night vs morning, and 45 vs 90 minutes, stay apart (`lib/student/context-pack.test.ts`).

### 7. Check it

**Targeted eval**: `npm run eval:pipeline -- --quality --only trust-priya-bakery,trust-leo-test-friday,trust-maya-final`, Sonnet 5.5, last run [ran]. "Before" is the step's original slot from the sim; "after" is after the placement and Because check.

| Case | Bad placements before → after | False reasons before → after | If-then lines (cued by an item) | Titles > 6 words |
|---|---|---|---|---|
| Priya: ED II essay, bakery shifts | 2 → 0 (2 moved) | 1 → 0 | 4 (2) | 0 |
| Leo: Algebra 2 test Friday | 2 → 0 (2 moved) | 0 → 0 | 4 (2) | 0 |
| Maya: AP Chem final Thu Dec 17, debate Tue | 3 → 0 (3 moved) | 0 → 0 | 3 (3) | 0 |

3/3 passed, $0.033.

**The reruns found four more false reasons**, all in Maya's last step, which moved from Dec 17 to Dec 16. Each one was fixed and committed with a test, then rerun:

| Rerun | Wording found | Fix |
|---|---|---|
| 1 | "The final is this same day" | aabb8ee |
| 2 | "falls on the final's date" | e680c74 |
| 3 | "The final lands on this date" | 8a3db72 |
| 4 | "on 17 Dec" | deefdce |

Two reruns also failed on a 7-word title; 8a3db72 drops articles. The 5th run passed 3/3.

**Full eval** [ran]: `npm run eval:pipeline`. Before: 62/64 (overnight report). After: **63/63**, 160 calls, $0.416.
- There is one fewer case because the SAT case moved to talk-first (item 6).
- First run at 390498a, before the four Because-check and title-clamp commits.
- **Second run, 2026-11-23, at the final commit b78c26b** (includes those four commits): **63/63 passed**, 157 calls, $0.388 [ran]. Command: `echo y | npm run eval:pipeline`. No case changed from pass to fail.

**Live checks** [ran], signed in, screenshots in `docs/design/screens/round6/`:
1. Priya's plan has no step in her shifts: `1-priya-plan-no-shift-steps.png`.
2. Check-in Save confirms: `2a-…`, `2b-checkin-saved-confirmation.png`.
3. Confirm clears the draft pill: `3b-…`, `3c-…`, `3d-after-confirm-calendar-no-pill.png`. The first attempt failed and was fixed in 390498a; see item 3.
4. Busy offer → Yes → Settings → Schedule: `4a-busy-offer-added.png`, `4b-settings-schedule-bakery-shifts.png`.

## AI spend

| What | Spend |
|---|---|
| Targeted evals during items 2–4 | ≈ $0.123 |
| Live plans and re-plans (item 7) | ≈ $0.06–0.10 |
| Full eval, run 1 (390498a) | $0.416 |
| Targeted reruns in item 7 (5 runs) | $0.153 |
| Full eval, run 2 (b78c26b, 2026-11-23) | $0.388 |
| **Total** | **≈ $1.14–1.18** (cap $3) |

These come from the `[perf] claude` token lines and the eval's own totals. The live-plan figure is a range because those calls were read from the server log by hand.

## What to try on a phone

1. On Home, type: "Help me write my ED II supplemental essay, it needs to be ready before Jan 5. I work at the bakery Wed 4-9pm and Sat-Sun 8am-2pm."
   - No step should land in a shift, and none on or after Jan 5.
   - Each step should read "When … ends, then …" or "At <time>, then …".
   - The Because line should match where the step really is.
2. On that plan, look for "Add bakery shifts as busy time?" and tap **Yes**. Open Settings → Schedule; Bakery shifts should be listed.
3. Confirm the plan. The Draft pill should be gone on Home and on Calendar.
4. On a step card on Today, do a check-in and tap Save. You should see "Saved. Next: …", and the card closes itself.
5. Turn on airplane mode and Save a check-in again. It should say "That didn't save. Try again." and keep your choices.
6. Type "algebra 2 test friday, help me prep" on a Monday. Nothing should land on Friday or later.

## Known gaps (not fixed this round)

1. **Date-only capture on a full day** [code]: a capture with a date but no time, on a day with no room, falls back to 4:00 PM (`placeNewTask`). This is pre-existing.
2. **"Move it to Tuesday/Thursday" in a re-plan isn't honoured** [ran, live].
   - The ED II re-plan kept Tue 7:30 PM, with a reason saying it "moved off Tuesday".
   - A Spanish re-plan kept Mon 5:30 PM.
   - Re-plan day requests aren't a hard constraint yet.
3. **A re-plan that names a new project makes a new project** [ran, live]. "ED II Supplemental Essay Draft" was created instead of adding to the existing one. This is pre-existing.
4. **"Starts after bakery shift ends (2:00 PM)" can sit at 3:00 PM** [ran, eval]. That's true but loose: the step starts an hour after the shift, so the reason reads as if it were right after.
5. **Holidays are not blocks** [ran, eval/live]. Leo's last step lands on Thu Nov 26, which is Thanksgiving.
6. **Title length depends on the model** [ran]. Some 7-word titles can't be cut cleanly ("Work through equilibrium and Q vs K") and are kept as written. 2 of 5 Maya reruns had one; the last 3-case run had none.
7. **Because wording is open-ended** [ran]. The check catches the claims seen in 5 reruns. A new way of saying "the deadline is this day" could still slip past. A step that moved loses any reason naming a weekday, time, block or date, which covers most of them.

## EXTRA (beyond the spec)

- `--only` flag for `eval:pipeline --quality`, 3 trust cases with sim slots, and `lib/ai/placement-grade.ts` (placement, reason, if-then and title grading).
- `shortTitle` clamp: drops a trailing clause, then articles.
- The `sameConversation` heuristic for Confirm (same project, shared title word or request word), and the sessionStorage list of settled drafts.
- A buffer around stated busy windows.
- `placementContext` (reads the week's blocks for the check), and the exemption that lets the exam itself sit on its own day.
- `finalReason`: a moved step loses any reason that talks about its old slot.
- If-then cue gap of 30 min instead of the planned 90, so "when X ends, then" stays true.
- POST `{ add }` on `/api/commitments` returns "already saved" without a change for an identical commitment.
- "Not now" on the busy offer is remembered for the session (sessionStorage).
- The busy offer is computed on the client, not as a server `busyOffer` field (change from the plan, noted in the log).
- The capture card holds open while the busy offer waits for a tap.
- The extra Because patterns found by the item 7 reruns (same day, tomorrow, the final's date, lands on this date, named calendar dates).
