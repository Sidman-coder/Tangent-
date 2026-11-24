# How Tangent's context engine works now (overnight 2, Phase 7)

Written 2026-11-22 from the code on `push-v1` (commit 44f1a7f) and from the shared test account. This is a description only: nothing in the code changed.

Tags: **[ran]** means seen by running something (an API read, a probe script, a server log). **[code]** means read in code only. **[estimate]** means worked out by hand from code and measured numbers.

Test-account caveat: one shared account carried five personas tonight (Leo, Maya, Jordan, Priya, Sam), so its facts are a mix of people. Names below are persona names from the sim profiles. Emails are masked.

---

## 1. Every place student context is stored [code]

| Store | What it holds | Written by | Read by | How long it's kept |
|---|---|---|---|---|
| `context_entries` (init schema + `20261110000000_student_facts.sql`) | One fact per row: `fact`, `display_text` (≤500), `category` (old set: preference/habit/commitment/goal/person/work/general), `fact_category` (identity, schedule, goals, classes_activities, how_you_work, whats_hard, future, push_style), `fact_source` (said/seen/guessed), `confidence` 0–1, `last_confirmed_at`, `project_id` (FK plans, cascade), `used_count`, `slot_key`, `source` (chat/voice/manual) | Onboarding (slots `onb*`, manual, confidence 1); `lib/context-extract.ts` (Haiku "contextExtract", chat, 0.7); round answers (manual, with `project_id`); slot answers | The context pack (`lib/student/context-pack.ts` via `lib/ai/student-context.ts`); You → What Tangent knows | No expiry. Deleted by Forget, Forget everything, or account delete |
| `profiles` (context columns) | `context_summary`, `context_interactions`, `context_updated_at`, `weekly_plan`, `last_voice_command`/`last_voice_response`, `help_focus`, `slip_point`, `day_view`, `working_toward`, `starting_intent` (≤140), `grade`, `capacity_weekday_min`/`capacity_weekend_min`, `week_start`, `notification_prefs` | Onboarding, Settings, voice handler, summary job | Pack sections `capacity`, `summary`; Home; voice | Life of the account |
| `context_slots` (`20261105030000`) | `slot_key` → `value` jsonb per student (`project_id` null) or per project; `source` answer/inferred/default/known; unique on (user, project, key) | Grill answers, `inferSlots` (Haiku) | Grill ("never ask the same thing twice"), plan prompts | No expiry; project rows cascade |
| `step_events` (`20261110010000`, `20261111000000`) | Codes only, never text: `kind` (created, done, skipped, not_today, too_big, rescheduled, check_in, chat_ask, plan_accept/edit/reject/stop, question_answer/skip), `hour`, `weekday`, `minutes`, `actual_minutes`, `code`, `task_id`, `plan_id` | Task actions, plan sheet, questions, chat | `calibrationLines` + `behaviourLines` → pack section "HOW THEY ACTUALLY WORK (observed)"; You → Tangent noticed | No expiry. Task and plan links are set null, not cascaded. Forget (per row) and Forget everything delete them (Phase 6) |
| `grill_questions` (`20261103000000`) | `question`, `kind`, `choices`, `priority`, `answer`, `status` (open/answered/skipped/expired), `project_id` (cascade) | Capture, clarify, plan questions | Home "N questions" card, plan sheet | Until answered/skipped/expired |
| `plan_aliases` | A student's own name for a plan, normalized, ≤10 per plan | Pipeline when a nickname is confirmed | `lib/pipeline/match.ts` (alias = score 1) | With the plan |
| `ai_decisions` | `request_text` ≤500, `route`, `intent`, `confidence`, `via`, `plan_match` {decision, candidates[{id, score}]}, `models`, `outcome`, `facts_used` | Router and pipeline | Debug, eval | 90 days (`purge_old_ai_decisions()`, daily cron) |
| `change_sets.facts_used` | Fact ids a draft plan relied on | Plan pipeline | "Because you said…" rows, "Used:" line | With the change set |
| `plans.description` | The plan brief ("Brief — Exam date… Assumed — 3 sessions") | Plan pipeline | Pack section "THIS PROJECT" (first 300 chars) | With the plan |
| `chat_messages`, `chat_sessions`, `task_chat_messages`, `voice_logs` | Raw conversation text, voice text + response | Chat, task chat, voice | Chat history; compressed summary | Account life (Forget everything keeps chats, by design) |
| Canvas-derived `tasks` (`source = canvas`) + `canvas_feeds` | Class names and due dates | Canvas sync | Pack sections `due`, `classes` | Until Disconnect (Phase 6) |

Gap found while mapping this: **`step_events` is not in `EXPORT_TABLES`** (`lib/settings/data-export.ts`), so "Download your data" leaves out the habits Tangent noticed, which the student can see and forget. Added to NEEDS-SID (export is data handling).

---

## 2. What was actually stored for the test personas tonight [ran]

Source: `GET /api/context` and `GET /api/export` from the signed-in Playwright tab, 2026-11-22, masked in the page before reading.

**23 facts in `context_entries`:**

- **12 onboarding facts** (2026-11-18, manual, confidence 1, `used_count` 254–273). Examples: "You're in 11th grade"; "You're busy with School: Mon–Fri 8:00 AM – 3:00 PM"; "You put things off until the last minute"; "On your mind right now: Keeping a weekly Sunday video upload going without my chem and algebra grades slipping"; "You do your best work late at night"; "You can focus for about 45 minutes at a time"; "You can handle about 2 hours of work on a school night"; "You're still figuring out what you're building toward, and that's fine"; "You like gentle nudges".
- **3 round answers** (manual, with `project_id`), e.g. Python round 1, "Which step did you not finish, and what got in the way": "Ran out of time". Others: "About right", "More practice".
- **6 chat-extracted facts** (confidence 0.7):
  - "You have an AP Chem final on Thursday, December 17" (classes_activities, used 4)
  - "You are preparing for your AP Chem final by reviewing units and practicing your weakest problem types": filed as **whats_hard**, which is the wrong category
  - "You plan to study in about three 40-minute sessions before the final"
  - "You work at the bakery on Wednesdays from 4 to 9pm and on Saturdays and Sundays from 8am to 2pm" (classes_activities, **used 0 times**)
  - "You are applying to colleges through ED II with a deadline of January 5" (schedule)
  - "You focus for about 45 minutes at a time": a **near-duplicate** of the onboarding fact
- **2 slot facts with no project**: "You have: not started" and "The prompt: not picked yet" (slot keys `drafts`, `essayPrompt`). On their own they mean nothing.

**Other tables:**
- `context_slots`: 2 rows (`preferredWorkTimes` ["late night"], `focusLength` "45 min", source answer).
- `grill_questions`: 11, all open, none answered. "What's the big test that's coming up, and when is it?" appears **4 times** and "Is there a date you'd like this done by?" **4 times**. The first is still asked although the AP Chem date fact exists.
- `plan_aliases`: **0**. No nickname has ever been saved.
- Plans: AP Chem Final Prep (5 steps), Start Environmental Club (8), Python Competitive Programming Basics (13), Work (kind work, no steps), School (kind school).
- `ai_decisions`: 11 (clarify/asked 5, draft/drafted 1, draft/discarded 2, chat/answered 1, draft/failed 2). **None has a `plan_match`**.
- Profile: `help_focus` "balance", `slip_point` "deadlines", `working_toward` "school". That last one **contradicts** the fact "still figuring out what you're building toward". `context_summary` is empty.
- Counts: 122 tasks, 19 voice logs, 0 chat sessions.
- Tangent noticed (from `step_events`), steps row: "You usually finish work around 3am." (sims run at night, so this is an artifact), "You finish about 5 in 10 of the steps that come due.", "When you put one off, it's usually "no time".", "You get the most done on Sunday." The planning row is gone because it was forgotten live in Phase 6.

---

## 3. How the pack picks facts [code], with an example [estimate]

### Picking facts (`lib/student/context-pack.ts`)

- **Score** = 0.5 × relevance + 0.3 × confidence + 0.2 × recency.
- **Relevance**: `CATEGORY_WEIGHT[purpose][fact_category]` (default 0.5). With a query, 0.55 × category + 0.45 × min(1, shared words / 2). A fact tied to this project scores 1; a fact tied to a different project is halved.
- **Confidence** defaults when missing: guessed 0.4, seen 0.7, said 0.8.
- **Recency** halves every 60 days since `last_confirmed_at` / `created_at`.
- **Keep** the top 15 (`MAX_FACTS`); after 10 (`MIN_FACTS`) stop at the first score under 0.35.
- **Dedup** is exact lowercase text only, so the two "45 minutes" facts both get in.
- Guessed facts are labelled "(Tangent's guess, not confirmed: don't rely on it)".
- Every fact sent bumps `used_count` (`markFactsUsed`), which is why onboarding facts show 250+.

### Building the pack (`lib/ai/student-context.ts`)

Sections are pushed with a priority, then `fitBudget` drops the lowest priority first until the pack fits. `KEEP` sections are cut short instead of dropped. Tokens are estimated as characters ÷ 4.

| Section (heading the model sees) | Priority |
|---|---|
| TODAY | KEEP |
| THIS PROJECT (title + first 300 chars of the brief) | 95 |
| WHAT YOU KNOW ABOUT THEM (most relevant first) | 90 |
| HOW THEY ACTUALLY WORK (observed) | 85 |
| SCHOOL HOURS | 80 |
| DAILY CAPACITY | KEEP |
| OPEN THIS WEEK (≤25) | 75 |
| HOW FULL THE NEXT 14 DAYS ARE | 70 |
| OVERDUE | 65 |
| COMING UP FOR SCHOOL | 60 |
| GOALS THEY'RE WORKING TOWARD (Paths) | 55 (92 for `path`) |
| PROJECTS ALREADY UNDER WAY (≤10, done/total, next step) | 50 |
| THEIR CLASSES (Canvas) | 40 |
| EARLIER (summary of older conversations) | 20 |

Budgets per purpose: plan / extend / path 3000 tokens, chat 2000, voice and brief 1600, grill 2500 (default). `studentFactsText(purpose)` sends only the facts and is used by the daily brief, proactive (cut to 600 characters) and the voice agent.

### Example pack: Leo, "plan my AP Chem final prep" (purpose `plan`) [estimate]

Built by hand from the code above and the real facts in section 2. Not captured from a live call: no code logs the pack (see section 7).

```
TODAY: Sunday (2026-11-22)
THIS PROJECT: AP Chem Final Prep — Brief — Exam date Thu Dec 17. Assumed — 3 sessions of 40 min…
WHAT YOU KNOW ABOUT THEM (most relevant first):
- You have an AP Chem final on Thursday, December 17
- You plan to study in about three 40-minute sessions before the final
- You are preparing for your AP Chem final by reviewing units and practicing your weakest problem types
- You can focus for about 45 minutes at a time
- You focus for about 45 minutes at a time            ← duplicate gets through
- You can handle about 2 hours of work on a school night
- You do your best work late at night
- You put things off until the last minute
- You lock in when there's a real deadline
- On your mind right now: Keeping a weekly Sunday video upload going without my chem and algebra grades slipping
- You work at the bakery on Wednesdays from 4 to 9pm…   ← another persona's fact, in the same account
- You are applying to colleges through ED II…          ← same
- … (up to 15)
HOW THEY ACTUALLY WORK (observed):
- They usually finish work around 3am.
- They finish about 5 in 10 of the steps that come due.
- …
SCHOOL HOURS: Mon–Fri, 8:00 AM–3:00 PM
DAILY CAPACITY (their own answer): about 2h of work on school nights, …
OPEN THIS WEEK (25): - 2026-11-23 3:30 PM: Practice dict frequency counting … (×25)
HOW FULL THE NEXT 14 DAYS ARE: …
PROJECTS ALREADY UNDER WAY:
- Python Competitive Programming Basics (x/13 done, next: …)
- Start Environmental Club (x/8 done, next: …)
```

Size [estimate]: facts ≈ 15 lines × ~15 tokens ≈ 225; observed ≈ 60; week ≈ 25 lines × ~14 ≈ 350; load ≈ 150; projects ≈ 100; today/project/school/capacity ≈ 120. Total ≈ **1,000–1,100 tokens** for this account, well under the 3,000 plan budget, so `fitBudget` drops nothing. The measured plan-brief call is 2,874 input tokens on average (section 7), so the pack is about a third to a half of it. The rest is the system prompt and the student's words.

Two things this shows:
1. Facts that apply to the request (Dec 17, three 40-minute sessions) do rank first.
2. Facts that are **wrong for this student** still ride along, because nothing separates people, merges duplicates, or drops a fact once its date has passed.

---

## 4. Where the AI used context well, and where it ignored or misused it [ran]

All quotes from tonight's sims (`user-simulation-tests/simulation/results/2026-11-22-*.md`) and live checks (`docs/overnight2/live/LIVE-NOTES.md`).

### Used well

- **Onboarding facts in a chat answer** (LIVE-NOTES, L1): "Fitting it in: Your school nights give you about 2 hours, and you focus best in roughly 45-minute blocks… Since you do your best work late at night… Since you mentioned your chem and algebra grades matter this year, keep weeknight sessions to one block…" Four stored facts, all used correctly.
- **A next step that cites a fact** (LIVE-NOTES, Phase 2): "Start with the dict frequency counting drill tomorrow… Monday, 2026-11-23, at 3:30 PM, right after school… Since you mentioned you can focus for about 45 minutes at a time…"
- **Constraints typed in the same message** (Jordan): "I have soccer practice Mon-Fri 3:30-5:30 and games Saturday mornings." All 8 steps landed at "7:30 PM, 7:45 AM before school, or Sunday 10 AM". Jordan: "It actually used my practice times."
- **Goal recall in the "Why this plan" section** (Leo): "Relieved it pulled in my 1,000-subscriber goal and school hours, which ChatGPT would never do." The sim also notes "the late-night editing in the saved step's Why line" and "the Sunday 6 PM upload kept clear".

### Ignored or misused

- **Dated deadline ignored** (Leo): "the test is FRIDAY. why are logs on saturday and the practice quiz on sunday, that's after the test lol." The sim summary: "Ignored or broke: the Friday deadline, in the first plan and both replans; it called the test a 'final'; it added an unrequested Python step." (Deadline cap O2-D41 since added for re-plans.)
- **Stated constraint and deadline lost** (Maya): "It says the goal ends Nov 29 and the header still says Nov 23, so I don't think it ever understood Dec 17." Observed: a session at Tue 4:30 PM inside the debate slot she gave; "Used:" cited "late at night" and "2 hours on a school night" but neither debate nor Dec 17.
- **Another persona's fact surfaced** (Maya): "That 'Used:' list still has the video-upload thing… that isn't mine." This is partly the shared account, but the product behaviour is real: a fact with no source and no visible way to correct it from that line.
- **Asked what it had just been told** (Jordan): "Then it asked me who approves the club, which I'd literally just said, and I nearly rolled my eyes out of the app." Live check L2 shows the same: the brief repeated "What language do you already code in…?" right after the talk answer asked it.
- **Kept the work shifts, dropped the deadline** (Priya): "Tangent seems to have kept only the bakery part, as an empty 'Work' project, and dropped the deadline." The ED II fact was later extracted from chat, but no plan used it, and the bakery fact has `used_count` 0.
- **A check-in ignored** (Leo, step 14): "I typed exactly what I did and that decay felt easier, and Tangent ignored it and tried to sell me five more sessions." (Talk-route `report` fix shipped in Phase 2.)

Pattern (Leo's sim says it best): "Tangent's personalization layer (Why lines, goal recall) is ahead of its constraint layer (deadline, slot conflicts, project matching)." Soft facts get quoted back; hard facts (dates, busy hours) are not enforced.

---

## 5. How Tangent matches what a student says to an existing project

### Three matchers, used in different places [code]

1. **`lib/project-match.ts` → `matchProject`.** Content words with stop words removed, then the suffix `(ing|es|s)$` is stripped. A shared word of 5+ letters scores 2, a shorter one scores 1; a match needs ≥ 2. Used by `home-route.ts` (`projectFor`), `app/api/chat/route.ts:421` and `lib/ai/clarify.ts:112`.
2. **`lib/pipeline/match.ts` → `matchPlan`.** Alias or exact title = 1; then word cover (0.75 × of the mention + 0.25 × of the title); Jaro-Winkler ≥ 0.92; Soundex 0.85; spelled-out letters; +0.04 if recent. "Sure" at ≥ 0.88 with a 0.08 gap to the next; "unsure" at ≥ 0.6. Used in `understand.ts:266` only for the `add_to_plan` and `change_plan` intents (on the router's `planMention`), plus pending-question and delete-scope.
3. **The model itself**, which sees "PROJECTS ALREADY UNDER WAY" in the pack and may name one.

There is no synonym list, no embedding, and no learned alias (`plan_aliases` is empty on the test account).

### Probe results [ran] (`$s/match-probe.ts`, `$s/route-probe.ts`, real functions, no AI calls)

| Student says | Existing project | `matchProject` | `homeRoute` | Right? |
|---|---|---|---|---|
| "I want to practise dance" | Dance | Dance | add → Dance | Yes |
| "I want to practise **dancing**" | Dance | none ("dancing"→"danc", "dance" stays "dance") | add, no project | **No** |
| "help me get better at my dances" | Dance | none | **plan** (new project) | **No**: makes a second dance project |
| "choreo practice for tryouts" | Dance Team Auditions | none | add, no project | **No** (no synonyms) |
| "more coding practice this week" | Python Competitive Programming Basics | none | add, no project | **No** |
| "plan the next round of my python practice" | same | Python | extend → Python | Yes |
| "study for my chem final" / "chemistry review" | AP Chemistry Final Prep | AP Chem | add → AP Chem | Yes |
| "SAT practice test saturday" | Digital SAT Prep | none ("sat" is 3 letters, scores 1) | add, no project | **No** |
| "post more reels" | Grow my Instagram | none | add, no project | **No** |
| "how do I get more followers on insta" | Grow my Instagram | none | **plan** (new project) | **No** |
| "I want to start running again" | Couch to 5K | none | add, no project | **No** |

`matchPlan` on the whole sentence "I want to practise dance" also returns none (score ≈ 0.5): it is built for a short mention, not a sentence.

Why it fails: suffix stripping is inconsistent ("dancing" vs "dance"), short words like "SAT" barely count, and nothing knows that "coding" ≈ "Python", "insta" ≈ "Instagram", "running" ≈ "5K". The model sees the project list but the router decides `plan` vs `add` before the model is asked. A miss is silent: the step lands loose, or a duplicate project appears.

---

## 6. Gaps for a "profile document"

A profile document would be one short, readable page per student that the AI reads first and the student can correct. Today the pieces exist but nothing joins them:

1. **No "who they are" narrative.** Facts are a flat list of single sentences; `context_summary` is empty on the test account [ran].
2. **No list of current activities and commitments.** Busy times live in onboarding slots and school hours. Typed commitments (bakery shifts, debate Tue 3:30–5, soccer) become facts but **never become busy blocks**, so the planner can schedule over them [ran: bakery fact used 0 times; Maya's debate clash].
3. **No merging or dedup.** The two "45 minutes" facts both live and both get sent [ran]; dedup is exact text only [code].
4. **No conflict resolution** between profile columns and facts (`working_toward` "school" vs "still figuring out what you're building toward") [ran].
5. **No expiry for time-bound facts.** "AP Chem final on Thursday, December 17" will keep ranking after Dec 17 [code: recency only halves every 60 days].
6. **Slot facts lose their subject.** "You have: not started" and "The prompt: not picked yet" carry no project, so they read as nonsense [ran].
7. **Miscategorised facts** ("preparing for your AP Chem final…" as whats_hard) skew the category weights [ran].
8. **The grill queue repeats itself.** 4 copies of the same two questions, one already answered by a stored fact [ran].
9. **No learned names for projects.** `plan_aliases` = 0, so "chem", "insta" or "my dances" are never remembered [ran].
10. **No per-person separation in testing.** One account, five personas. Not a product gap, but it hides product gaps; a profile per test persona would make sims cleaner.
11. **Habits are not in the export** (`step_events` missing from `EXPORT_TABLES`) [code].
12. **No visible log of what was used.** The "Used:" line shows facts per plan, but there is no per-call record (section 7). The student can't see why a fact reached a chat reply.

---

## 7. Cost: input tokens per call, per feature [ran]

From every server log tonight (`$s/tok-by-feature.mjs`, parsing `[perf] claude <label>: <model> | in N tok, out M tok`). Input tokens include the system prompt, the context pack and the student's words. **The pack alone is not logged anywhere:** `picture.tokens` is computed in `student-context.ts` but never written out [code], so the pack's own share is an estimate (section 3: ~1,000 tokens on this account, capped by the purpose budget).

Prices (Anthropic list, per million tokens): Haiku 5.5 $0.10 in / $0.50 out; Sonnet 5.5 $2 in / $10 out.

| Feature | Model | Calls | Avg input tokens | Range | Avg output | Input cost / call | Pack budget (cap) |
|---|---|---|---|---|---|---|---|
| proactive | Haiku | 32 | 1,693 | 1,499–1,996 | 174 | $0.00017 | facts only, 600 chars |
| talk | Haiku | 14 | 2,455 | 1,828–3,645 | 390 | $0.00025 | 2,000 (chat) |
| plan brief | Sonnet | 18 | 2,874 | 2,553–3,302 | 891 | $0.0057 | 3,000 (plan) |
| plan outline | Sonnet | 14 | 3,044 | 2,530–3,579 | 143 | $0.0061 | 3,000 |
| plan detail 1 | Haiku | 14 | 3,803 | — | 364 | $0.00038 | 3,000 |
| plan detail 2 | Haiku | 14 | 3,794 | — | 245 | $0.00038 | 3,000 |
| plan detail 1/2 | Sonnet | 4 | ~3,940 | — | — | $0.0079 | 3,000 |
| refineTask | Sonnet | 6 | 2,965 | — | — | $0.0059 | 3,000 |
| refineTask | Haiku | 2 | 3,448 | — | — | $0.00034 | 3,000 |
| plan fix | Sonnet | 5 | 2,921 | — | — | $0.0058 | 3,000 |
| clarify | Sonnet | 6 | 1,995 | — | 144 | $0.0040 | 2,500 (grill) |
| captureQuestions | Haiku | 2 | 2,417 | — | — | $0.00024 | 2,500 |
| shortTitles | Haiku | 6 | 899 | — | — | $0.00009 | none |
| contextExtract | Haiku | 6 | 839 | — | 104 | $0.00008 | none |
| roundReview | Haiku | 3 | 671 | — | — | $0.00007 | none |
| splitStep | Haiku | 1 | 576 | — | — | $0.00006 | none |
| inferSlots | Haiku | 6 | 394 | — | — | $0.00004 | none |
| classifyCommitment | Haiku | 3 | 351 | — | — | $0.00004 | none |

What it means [estimate]:
- **One full plan** (brief + outline on Sonnet, two details on Haiku) sends ≈ 13,500 input tokens, ≈ $0.0126 of input. The pack is resent in every one of the four calls, so about 4 × ~1,000 = ~4,000 of those tokens are the same pack. Sending it once (or caching the shared prefix) would save roughly a third of plan input.
- **Haiku calls cost almost nothing** (under $0.0004 each), so on the free tier (Haiku only) context size is not a cost problem; it is a speed and focus problem.
- **Sonnet calls carry ~95% of the context cost.** If the pack grew to its 3,000 cap for a busy student, a Sonnet plan call would rise from ~$0.006 to ~$0.008 input.
- Missing measurement: log `picture.tokens` and the section names kept/dropped per call, so the pack's real share and any `fitBudget` drops can be seen.
