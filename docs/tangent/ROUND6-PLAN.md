# Round 6 plan: trust fixes before the pilot

Source spec: `D:\TANGENT showcase\Round 6\tangent-round6-trust-fixes.md`. Branch `push-v1`.

After "approved", the first step copies this plan to `docs/tangent/ROUND6-PLAN.md` (plan mode can only write this file). I keep that copy current as the round's log.

## Context

The three judges (JUDGMENT-3) and 4 of 5 sims named the same trust faults:
- the check-in Save says nothing
- typed busy times and deadlines are ignored, while the Because line claims they were kept (Priya, Leo, Maya)
- the Draft pill stays after Confirm

A pilot with 3 students starts next. This round makes hard facts hard rules, writes steps as if-then lines, turns stated busy times into real blocks, and ships the six small items Sid approved.

## What the code does today [code]

- **The plan path.** All of these go through `lib/voice-handler.ts:937-1184`: first plans, "Reply to Tangent" re-plans, the task-dialog Ask and Round 2 (`opts.projectId` + `reviewNote`). "Add to plan" goes through `lib/pipeline/extend-plan.ts:69`.
- **Times are picked in code.** The spacing brain (`spreadPlanDates` → `spreadSessions` → `firstOpenTime`) picks every time, so the model never picks one.
  - `firstOpenTime` already blocks the School block, `cmt_` commitments and other timed tasks (`lib/schedule-slots.ts` `dayBusy`), plus the `avoid` windows.
- **Three gaps cause the sim failures:**
  1. `lib/avoid-times.ts` needs a cue word ("not/no/busy…") and a single day. Priya's "I work at the bakery Wed 4-9pm and Sat-Sun 8am-2pm" gives no windows.
  2. No deadline caps placement. "test Friday" leaves `endDate = today+7`, so steps land on Sat 28 and Sun 29 (Leo). Only the miss re-plan has a cap (`planDeadlineCap`, O2-D41).
  3. Nothing checks placements after the model runs. The guard's `timeClash` only checks day-part words ("morning"), not "after your shift" or "before your test".
- **Draft pill.** Each re-plan reply makes a **new** ChangeSet. Confirming the newest one forgets only its own id, so the older "5 steps" draft from the same page keeps its pill (Leo c9v steps 8–10, Priya r2 step 7). The pill × discards, with only a toast Undo.
- **Check-in.** `StepFollowUp.send` closes when there is no `reply`, and swallows failures.

## Items

### 1. Check-in Save confirmation

Files: `components/today/StepFollowUp.tsx`, new `lib/check-in-save.ts` + `.test.ts`, `components/today/today.css`.

- Pure `saveCheckIn(fetchFn, body)` returns `saved | reply | failed`. It treats `!res.ok`, `ok:false` and a network error as `failed`.
- **Saved:** the card swaps in place to a `role="status"` line: "Saved. Next: <followUp.next>" (the existing O2-D14 text, e.g. "Wire the motor · Tue 7:30 PM"), or "Saved." when nothing is next. It closes itself after about 2.5 s and has a Close button. The page stays usable underneath.
- **Reply:** "Saved." goes above the existing reply.
- **Failed:** the card stays open with the student's choices kept. It shows "That didn't save. Try again.", and Save stays enabled.
- Styles use tokens only, per TANGENT-STYLE.
- Test: the success, reply and failure paths with a fake fetch.

### 2. Hard constraints, placement check, Because truth check

**New `lib/plan-constraints.ts` (pure)**, which extends `avoid-times.ts`. `avoidWindows` stays as it is.

- `busyWindows(text)` reads stated busy times.
  - It accepts the existing cue words, or an activity phrase before a day/time chain: "I work at the bakery", "shift", "practice", "debate", "soccer", "job", "rehearsal", "lessons", "I have X".
  - Day forms: "Sat-Sun", "Mon–Fri", "Sat/Sun", "weekends", "Tue and Thu". Several day-time pairs per sentence.
  - A plain "study tue 3:30-5" or "work on essay tue 4-5" is still a time to use, not a busy time.
- `deadlineFrom(text, today)` returns `{ date, label }` from phrases like "test Friday", "final is Thu Dec 17", "ready before Jan 5", "due Mon".
  - A weekday word means its next occurrence.
  - The label is "your test", "your final", and so on.
- `planConstraints(text, context, today)` returns `{ avoid, deadline }`.

**Wiring:**
- `voice-handler.ts` plan path:
  - The constraints feed `spreadPlanDates`.
  - `endDate` is capped at the day before the deadline, so the round never runs past it. "Your goal runs to…" stays.
  - A `Deadline: YYYY-MM-DD` line goes into the project notes, so Round 2 and later re-plans keep it.
  - For `opts.projectId` (Round 2, re-plans), the deadline also comes from the project notes or `planDeadlineCap` in `lib/today-steps.ts`, which I reuse.
- `extend-plan.ts` gets the same constraints.

**New `lib/placement-check.ts` (pure)** runs on the final `planTasks`, before the draft or insert.
- A step overlaps when it clashes with a School/`cmt_` block, an existing fixed task, or a typed busy window. A step can also sit on or after the deadline, unless its title is the event (`isDatedExam`).
- Such a step moves to the nearest free slot (`firstOpenTime`, same rules) before the deadline, on a day still under capacity (the existing `lib/load.ts` day-load).
- When nothing fits, the step is dropped and a note goes into the draft's assumptions: "Couldn't fit <title> before Dec 17; want me to shorten the plan?"

**Because truth check:** `claimCheck(why, step, blocks, deadline)` in `lib/ai/plan-guard.ts`.
- "after your shift / practice / work / <block>" or "after your 4-9pm hours" is kept only if a block that day ends at or before the step's start.
- "before your test / final / quiz" is kept only if the step's date is before the deadline.
- Anything else is rewritten **in code, with no AI call**, from the real placement:
  - a fixed block before it: "Starts after Soccer practice ends (5:30 PM)."
  - a deadline: "Open time Tue, 3 days before your test."
  - otherwise: "First open time on Tue."
- The check runs after the placement check, so it reads final times. It covers the WHY: and BECAUSE: lines.

**Tests** use fixture weeks with the exact sim sentences. Each must give 0 overlaps and 0 steps after the deadline:
- `lib/plan-constraints.test.ts` and `lib/placement-check.test.ts`
- Priya: "ED II supplemental essay… before Jan 5. I work at the bakery Wed 4-9pm and Sat-Sun 8am-2pm". The Wed 6:30 PM and Sun 2:00 PM steps must move.
- Leo c9v and r2: "Algebra 2 test Friday…". Nothing on Fri 27 or later.
- Maya j3a and r2: "final is Thu Dec 17… not tue 3:30-5 (debate) and nothing after 11pm". Nothing in Tue 3:30–5, and nothing on Dec 17.
- Plus the claim-check rewrite for "comes after your 4-9pm hours".

### 3. Draft pill

Files: `lib/drafts/draft-store.ts` + `.test.ts`, `components/preview/usePreviewActions.ts`, `components/drafts/DraftDock.tsx`, `drafts.css`.

- **Confirm** forgets the confirmed draft and every older draft from the same origin, since those are the earlier versions of that conversation (`settleDrafts(state, id)`). A settled id is remembered in sessionStorage, so a remount of an old message can't keep it again.
- **The pill ×** becomes a text button, "Hide". It sets `hidden: true` on the entry and discards nothing. A hidden draft gets no pill on other pages. It shows again on its origin page, and opens there with `?draft=`.
- **Discard** moves into the opened card only. It uses the existing hold-then-discard with the Undo toast (the current `remove` logic, `UNDO_MS`).
- Test: draft-store unit tests for settle, hide and reachable-on-origin.
- Live Playwright check (MCP browser): draft → Confirm → no pill, with a screenshot.

### 4. If-then steps

New `lib/if-then.ts` (pure) + test. It builds `ifThen(step, dayItems, busyWindows)` **in code from the final placement**, with no model call, so the cue is always real and the cost per plan is unchanged.
- **Cue:** the latest fixed item (school, `cmt_`, or a recurring or fixed task, reusing `lib/because.ts`'s fixed-item pick, O2-D44) or a typed busy window that ends 0–90 min before the step that day.
  - "When soccer practice ends Tuesday (5:30 PM), then 30 min: wire the motor."
- **No cue:** "At 7:30 PM Tuesday, then 45 min: wire the motor."
- Stored as a `WHEN:` note line next to WHY:/BECAUSE: (`lib/note-parts.ts`). It shows under the title on the brief's step cards and in task detail.
- **Titles:** STEP_RULES in `plan-brief-call.ts` changes from "3–8 words" to "2–6 words, verb first", and the writer prompt in `plan.ts` gets the same rule. A code clamp cuts titles to 6 words when the writer runs long.
- **Eval:** `--quality` gets an `--only` flag and 3 new cases (Priya, Leo, Maya, with calendar items in the fixture week). `gradePlanQuality` asserts each step has an if-then line whose cue is a fixture calendar item or the step's time, and a title of 2–6 words. I report the per-plan token cost before and after from the `[perf] claude` lines.

### 5. Busy times become calendar blocks

- New `lib/busy-offer.ts` (pure) + test. `busyOffer(text, existingCommitments)` builds on `busyWindows` and returns `{ label: "bakery shifts", commitment: {kind, name, repeat: weekly, blocks} }`.
  - It returns nothing when there's no recurring busy time, or when an existing commitment already covers it.
  - kind: `work` for work, shift or job words; `practice` for sports words; otherwise `other`.
- Server:
  - the plan-path response (`respondWithDraft` extra), the talk/answer response and the capture response carry `busyOffer` when the text has one
  - `app/api/commitments/route.ts` gets a POST `{ add }` that appends through the existing `getCommitments` + `replaceCommitments` (`cmt_` series, no schema change)
- Client: one small shared `components/talk/BusyTimeOffer.tsx`, styled like `PlanThisRow`. It reads "Add bakery shifts as busy time?" with Yes / Not now, and is shown in Home's plan brief, the talk thread and InlineAsk.
  - Yes → POST, then the row reads "Added. It's in Settings → Schedule."
  - Not now → gone.
  - Nothing is ever added without the tap.
- Settings → Schedule already lists commitments (`commitmentsFromTasks`). That's checked live.
- **Test** (pure chain):
  1. Priya's text gives the offer.
  2. `commitmentTasks` gives `cmt_` busy tasks.
  3. An untimed later capture on a Wed is placed outside 4–9 PM, via `placeNewTask`/`firstOpenTime`.
  - A capture with an explicit typed time keeps the student's time. I'll note that.

### 6. Small items

- **SAT fixture:** move `r4-help-me-sat` from `requests.json` (plan classifier) to `talk-first.json` as `{ text: "help me get a 1400 on the SAT", kind: "answer", schedulable: true }`, which means an answer plus the Plan this offer. The note gives the reason (NEEDS-SID answer).
- **Project-scoped facts:** in `lib/student/context-pack.ts` `relevance`/`rankFacts`, a fact with a `projectId` is **excluded** unless the call's `projectId` matches. Today it's only halved. Round answers already save with `projectId` (`app/api/rounds/review/route.ts:103`).
  - Test: a chess plan with the Python round's "More practice" fact gives no such fact.
  - I'll update any existing halving test.
- **Export:** add `"step_events"` to `EXPORT_TABLES`, after checking it has `user_id`, plus a settings test assertion.
- **Pack log:** in `buildStudentContext`, after `fitBudget`: `[perf] pack <purpose>: N tok, kept [section keys], dropped [section keys]`. It logs only section keys and no student text.
- **glanceLine:** "next:" takes the earliest upcoming item that is either fixed or a plan step (`t.planId`). The pinned O2-D14 test is updated, with a new case where a plan step comes before the fixed item.
- **Near-duplicate facts:** in `rankFacts`, before scoring, a normalized-token check.
  - Lowercase, strip punctuation, drop filler words (you, can, about, for, at, a, the…).
  - Two facts count as duplicates when overlap ÷ smaller set ≥ 0.75, each has at least 3 tokens, and their numbers are identical.
  - The newer one is kept (by timestamp or lastConfirmedAt). Stored rows are untouched.
  - Test: the 45-minute pair merges. "focus best at night" vs "in the morning" and 45 vs 90 minutes stay apart.

### 7. Check it

- **Before:** run the new targeted `--quality --only` cases plus the SAT talk-first case before the item 2/4 code lands. The full-eval "before" is the overnight morning report (62/64), so a second full run isn't needed.
- **After:** the same targeted cases, then the full eval once at the end.
- **Live checks** on the test account, screenshots in `docs/design/screens/round6/`:
  1. Priya's sentence gives a plan with no step in her shifts.
  2. A check-in Save shows its confirmation.
  3. Confirm clears the draft pill.
  4. The busy-time offer gives Yes, and the block appears in the calendar and in Settings → Schedule.
- **Server:** I need a signed-in browser. A prod server may already be on :3000, so I'll build and run on a free port. If the Playwright browser isn't signed in, I'll ask Sid to sign in (I never type passwords).
- **Report:** `docs/tangent/ROUND6-REPORT.md` covers each item (what changed, evidence [ran]/[code]), eval before → after, AI spend, and what to try on a phone.

## Working rules for this round

- **Commits:** one per item (`round6: …`), after `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass. The spec says to commit after each item, which overrides CLAUDE.md's "commit only after commit and continue" for this round. No push.
- **Limits:**
  - no `.env*`
  - no schema or SQL: none needed (commitments use the task-based `cmt_` path, WHEN: is a note line, Hide is in sessionStorage)
  - UI follows `docs/design/TANGENT-STYLE.md`
- **Order:** 6 (small) → 1 → 3 → 2 → 4 → 5 → 7. Items 4 and 5 build on item 2's parser and placement facts.
- **AI spend (cap $3):**

  | Run | Estimate |
  |---|---|
  | targeted before/after (about 8 Sonnet brief cases ×2) | ~$0.40 |
  | live plans (3–4) | ~$0.30 |
  | full eval | ~$0.30 |
  | **Total** | **~$1.0–1.2** |

  I log spend from the `[perf] claude` lines as I go.
- **EXTRA:** anything beyond the spec goes under EXTRA in the report. Expected extras: the `--only` flag for `--quality`, and the 6-word title clamp.

## Calls I'm making (say if you want otherwise)

1. **If-then lines come from code, not the model.** This keeps every cue real and the cost flat.
2. **Confirm clears older drafts from the same page,** treated as superseded versions of that conversation.
3. **Busy-time cue words.** Activity phrases count as busy ("I work…", "soccer Mon–Fri…"), but "study/work on + day/time" stays a time to use.
4. **The rewritten Because line replaces the whole reason.** It isn't patched clause by clause.

## Progress log

- 2026-11-22: plan approved by Sid.
- Item 6 done: step_events export, project-scoped facts (excluded, not halved), near-duplicate fact dedupe, `[perf] pack` log line, glanceLine names the next plan step (earliest by time), `r4-help-me-sat` moved to talk-first.json (requests.json now 63 cases). Gates: lint, typecheck, `npm test` 1057/1057, build.
- Item 1 done: `lib/check-in-save.ts` (+4 tests), StepFollowUp saved state ("Saved. Next: …", role=status, closes after 2.5 s; Tangent's reply stays) and failed state (card stays open, "That didn't save. Try again."). Live screenshot comes in item 7. Gates: lint, typecheck, `npm test` 1061/1061, build.
- Item 3 done: `settleDrafts`/`settleDraft` (Confirm clears its pill and older versions of the same conversation: same page + same project or a shared title word; confirmed ids remembered in sessionStorage `tangent:drafts-settled`), `hideDraft` + `hidden` (pill shows only on its origin page), pill × → Hide, Discard with Undo inside the card. +4 draft-store tests. Live Confirm → no pill check comes in item 7. Gates: lint, typecheck, `npm test` 1065/1065, build.
- Item 2 done: `lib/plan-constraints.ts` (busy windows from activity phrases, multi-day chains; deadline + label), `lib/placement-check.ts` (move to nearest free slot before the deadline, or drop with "Couldn't fit X before <date>; want me to shorten the plan?"; the event step itself is exempt), `spreadSessions` `lastDate` cap, buffer around avoid windows, wired into the plan path (voice-handler: endDate capped, `Deadline:` note line, Round 2/re-plans read it back) and Add to plan (extend-plan). Because truth check in `plan-guard.ts`: `claimCheck` (after/before a block or the test, in-block claims, wrong clock time, wrong weekday, day-of/night-before), `placementReason`, `finalReason` (a moved step's slot-talking reason is replaced). Eval: `--quality --only`, 3 trust cases with sim slots, `lib/ai/placement-grade.ts`, real spend from `[perf] claude`. Targeted run 3/3: placement 2→0, 2→0, 3→0 bad; reasons 0 false after; $0.010 per plan brief. Spend so far ≈ $0.094 (three targeted runs). Gates: lint (4 baseline warnings), typecheck, `npm test` 1081/1081, build. Live plan screenshot comes in item 7.
- Item 4 done: `lib/if-then.ts` builds each step's if-then line in code from its final slot (no model call). The cue is a fixed item or typed busy time that ends 0–30 min before the step: "When school ends Tuesday (3:00 PM), then outline the strongest story." With no cue it uses the time: "At 4:00 PM Monday, then …". **Change from the plan:** the cue gap is 30 min, not 90, so "when X ends, then" stays true. The line is stored as a `WHEN:` note line. It shows under the title on brief step cards (`.plan-step-ifthen`) and in task detail (`.td-ifthen`), and is never shown as a part. A moved step falls back to the time line for its new slot (`ifThenFor`). Titles: STEP_RULES now says "2 to 6 words", plus a `shortTitle` clamp that drops a trailing clause and never cuts mid-phrase. Eval grading (`placement-grade.ts`): each kept step's cue must parse, and must be a fixture item ending 0–30 min before that day or the step's own time; titles must be 2–6 words. Targeted run 3/3: Priya 4 lines (2 cued by an item), Leo 4 (2), Maya 3 (3), titles over 6 words 0; $0.010 per plan brief, unchanged. Spend so far ≈ $0.123. Gates: lint (4 baseline warnings), typecheck, `npm test` 1086/1086, build.
- Item 5 done: `lib/busy-offer.ts` (+3 tests). It reads the first named recurring busy time from the student's words (`busyWindows`), merges same-hour days into one block, sets the kind (work / practice / lessons / other) and a weekly repeat, and skips unnamed blocks ("not tue 3-5") and ones a saved commitment already covers. POST `{ add }` on `/api/commitments` appends through `getCommitments` + `replaceCommitments` (`cmt_` series, no schema change). An identical one already saved means nothing changes. `components/talk/BusyTimeOffer.tsx` asks "Add bakery shifts as busy time?" with Yes / Not now. Yes → "Added. It's in Settings → Schedule." with a link. Not now is remembered for the session. It shows on Home's plan brief, under replies in the live talk thread, in InlineAsk, and on the capture card, which stays open while the offer waits. **Change from the plan:** the offer is computed on the client from the student's own words and the saved commitments (`commitmentsFromTasks`), instead of a `busyOffer` field on each server response: no AI call, same rules, fewer moving parts. Chain test: offer → `commitmentTasks` (cmt_) → `commitmentsFromTasks` reads it back → a 60-min Wed capture lands outside the shift (before: Wed 3:30 PM, into it). Known gap (pre-existing, not changed): a capture with a day but no time, on a day with no room, falls back to 4:00 PM (`placeNewTask`). Gates: lint (4 baseline warnings), typecheck, `npm test` 1089/1089, build.
- Item 7 done: full eval 63/63 ($0.416, at 390498a). Targeted reruns found four false reasons on Maya's moved Dec 16 step ("same day", "the final's date", "lands on this date", "on 17 Dec") and 7-word titles; each was fixed with a test (aabb8ee, e680c74, 8a3db72, deefdce). The last targeted run passed 3/3 ($0.033). Live checks 1–4 passed, signed in; check 3 first failed and was fixed in 390498a. Screenshots are in `docs/design/screens/round6/`. Report: [ROUND6-REPORT.md](ROUND6-REPORT.md). Round spend ≈ $0.79. Gates: lint (4 baseline warnings), typecheck, `npm test` 1090/1090, build.
- 2026-11-23: full eval rerun at b78c26b (the final code): 63/63, 157 calls, $0.388. Round spend ≈ $1.18. Report updated.
