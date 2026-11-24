# Context review (overnight Phase 4.3)

How the AI is given what it knows about a student, what each call costs, what I changed, and what I could not measure. Read from the code on 2026-11-18. Cost figures come from the `[perf]` lines of the paid eval (`npm run eval:pipeline`), turned into per-task tables with `scripts/eval-cost-from-log.mjs`. They are estimates from token counts, not billing.

## 0. Read this first: the "after" eval did not complete

- **Before eval (clean):** 64 cases, 147 calls, all HTTP 200, **39/64 passed**, about **$0.27**.
- **After eval (invalid):** the Anthropic API answered `400 invalid_request_error: "Your credit balance is too low to access the Anthropic API"` after about 39 successful calls. 96 of the 146 calls in the run failed with that error, so **21/64 is an artifact of the empty balance, not a regression, and it must not be read as one.** Only 39 calls produced output (about $0.09).
- I did **not** re-run it. A second run would hit the same wall, and topping up billing is not something I can or should do. The paid evals were budgeted at under $3 each; the two together used about $0.36, so the empty balance is an account-level matter, not this budget.
- **Consequence:** the spec's "after" comparison (pass count, cost per call, cost per active student) is **not measured**. What I can say instead is in section 5, labelled as reasoning, not measurement.
- **Consequence for the rest of the night:** every remaining step that needs the app's AI (Phase 5 re-simulations) will hit the same error until credits are added. Logged as DECISIONS D6 and at the top of NEEDS-SID.

## 1. One place assembles context (finding: yes, already true)

`buildStudentContext({ purpose, projectId?, query? })` in `lib/ai/student-context.ts` builds the pack; `lib/student/context-pack.ts` ranks and fits it to a budget per purpose (plan, extend, path 3000 tokens; chat 2000; voice and brief 1600). Callers:

| Caller | Purpose | Uses |
|---|---|---|
| `lib/chat-reply.ts` (planReply, answerReply, talkReply) | plan / plan / chat | full pack |
| `lib/voice-handler.ts` (plan brief, voice command) | plan / voice | full pack |
| `lib/pipeline/extend-plan.ts` | extend | full pack |
| `lib/pipeline/understand.ts`, `app/api/chat/route.ts`, `app/api/grill/route.ts` | grill | full pack |
| `app/api/path`, `app/api/path-intake` | path | full pack |
| `app/api/questions/route.ts` (clarify, refine) | plan | full pack |
| `lib/daily-brief.ts`, `lib/proactive.ts`, `app/api/daily-brief`, `lib/voice-agent-tools.ts` | brief / voice | `studentFactsText(purpose)`: only the ranked facts (these calls describe the calendar themselves) |

No call builds its own copy of "what we know about the student". The calls with **no** student context are short utility calls on purpose: intentRouter, inferSlots, shortTitles, chatTitle, classifyCommitment, pickCandidate, contextExtract, contextCompress. They see only the user's own text. That is data minimization already, and I left it alone.

## 2. Call inventory

Tokens and cost per call are from the **before** eval (the only clean run). "n/a" means the eval did not exercise the task.

| Task | Feature | Tier | Max out | Student data in | In / out tokens | Cost / call |
|---|---|---|---|---|---|---|
| planBrief | plan | SMART | 1600 | week summary + up to 16 ranked facts (via the plan pack) | 1725 / 751 | $0.0110 |
| planOutline | plan | SMART | 300 | request + pack | 1721 / 113 | $0.0046 |
| planDetail | plan | FAST | 2048 | one phase + facts | about 2500 / 350 | about $0.0005 |
| planFix | plan | SMART | 800 | rejected steps + facts | n/a | n/a |
| plan (agent's create_plan) | plan | SMART | 4096 | pack | n/a | n/a |
| extendPlan | extendPlan | SMART | 1500 | pack (purpose extend) | 1709 / 129 | $0.0047 |
| chatPlan | chat | SMART | 700 | pack (plan or answer) | 1117 / 166 | $0.0039 |
| talk | chat | FAST | 1200 | pack (chat) | n/a | n/a |
| clarify | chat | SMART | 700 | pack (plan) | n/a | n/a |
| refineTask | chat | SMART | 1200 | pack (plan) | n/a | n/a |
| grillNext | chat | SMART | 400 | pack (grill) + the questions already asked | n/a | n/a |
| splitStep | chat | FAST | 500 | one step | n/a | n/a |
| voiceCommand | classify | FAST | 4096 | pack (voice), 1 fast route | about 5000 / 75 | about $0.0003 (Haiku) |
| intentRouter | intentRouter | FAST | 200 | request only | 1751 / 85 (1695 cached) | $0.0001 |
| inferSlots, shortTitles, chatTitle, classifyCommitment, pickCandidate | classify | FAST | 40 to 3000 | request only | about 350 / 12 | under $0.0001 |
| contextExtract | context | FAST | 300 | one chat turn | 710 / 26 | $0.0001 |
| contextCompress, chatSummary | context | FAST | 250 to 400 | facts / thread | n/a | n/a |
| contextImport | context | SMART | 3000 | pasted text only | n/a | n/a |
| dailyBrief | brief | SMART | 300 | ranked facts + day | n/a | n/a |
| briefSources, proactive | brief / notif | FAST | 400 to 500 | ranked facts | n/a | n/a |
| agent | agent | SMART | 2048 | tools: Canvas tasks, owner Gmail / Calendar | 4178 / 50 | $0.0109 |
| pathBranches, pathIntake | tangent | SMART | 900 to 1500 | path pack | n/a | n/a |
| roundReview | plan | FAST | 700 | what happened in the round | n/a | n/a |

Prices used (USD per million tokens, mirrored from `lib/ai/models.ts`): Haiku 5.5 input 0.1 / output 0.5; Sonnet 5.5 input 2 / output 10, cache read 0.05.

**What `ai_usage` records** (`recordUsage`, `lib/ai/call.ts`): `user_id`, `feature`, `model`, `input_tokens`, `output_tokens`, `cache_creation_tokens`, `cache_read_tokens`, `is_batch`, `duration_ms`, `est_cost_usd`, `route`. **It does not record the task.** Several tasks share a feature (`plan` is planBrief, planOutline, planDetail and planFix), so cost per task cannot be read from the table, which is why I had to read it from eval logs. Fix proposed, not applied: `docs/overnight/proposed-migrations/20261118000000_ai_usage_task.sql` (NEEDS-SID).

**Where the money goes** (before eval, total about $0.27): plan brief 65% (16 calls, $0.175), extendPlan 17%, chatPlan 7%, the agent loop 4%. The 57 router and 22 extraction calls together are under 2%. Optimizing anything other than the plan brief and extendPlan would not move cost.

## 3. Where the AI ignored context, repeated, or went generic (from the Phase 2 transcripts)

| Finding | Source | Status |
|---|---|---|
| The same deadline was listed twice: once in "due soon" and again in "this week" | pack inspection | **Fixed** (section 4) |
| Long pasted titles flooded the pack ("Read chapters 4 through 9 and answer ...", 200+ characters) | pack inspection | **Fixed** (section 4) |
| Maya: the first capture dropped the Precalc quiz; "When is this?" asked what was already stated | JUDGMENT-1 C-items | Fixed earlier in the groups (multi-item capture, stated-date inference in `lib/context/infer.ts`) |
| Jordan: "I already said I play football" asked again | sim notes | The slot inference covers stated slots; the grill's "already asked this session" list is supplied by the client (`app/api/grill/route.ts`), so a reload forgets it. Not changed: persisting it needs a table (schema, gated). |
| Maya: assumptions mention a competition template for exam prep | JUDGMENT-1 C13 | Hidden in the view only; the model text is still generated. Server-side fix not done. |
| Plan brief, extendPlan and chat each re-send the pack in full on every call | token tables | Intentional: the pack is the context. Prompt caching covers the router; the pack differs per call so it is not cached. |
| The "One question" follow-ups after a plan | JUDGMENT-1 | Intentional (ask until enough; Skip and Stop never block). Left alone. |

Honest scope note: I did not find a call that ignores the pack. The generic outputs in the transcripts came from missing slots and template text, not from calls that skipped context.

## 4. Fixes made tonight

1. **No repeated deadlines.** `dueNotInWeek` (`lib/student/context-pack.ts`) removes tasks already in the week list from the "COMING UP FOR SCHOOL" section (`lib/ai/student-context.ts`). Test: `dueNotInWeek dedupes`.
2. **Title clipping.** `clipTitle` caps any title put in the pack at 90 characters, at a word boundary with an ellipsis, collapsing whitespace. Tests: `clipTitle cut at a word with an ellipsis and a length limit`, `clipTitle hard-cuts an unbroken string`. The raw title is never changed in the database; only the prompt copy is shortened.
3. **Persona fixtures kept.** `lib/pipeline/fixtures/personas.json` holds the five Phase 2 student personas (Maya, Jordan, Leo, Priya, Sam) with their first ask and what a plan must respect; Dana (a parent, signed out) is not a planning fixture. Tests: `lib/pipeline/persona-fixtures.test.ts` (2). They are data only so far: `eval-pipeline` does not run them yet, because the eval's grading shape (`FixtureCase`) is per-request, not per-persona. Wiring them in is a follow-up.
4. **Cost tool.** `scripts/eval-cost-from-log.mjs` prints calls, tokens and cost per task from any eval log (free, offline).

Evidence: `npm run typecheck` clean; `npm test` 973 pass / 0 fail (was 968 before the 4.3 tests).

## 5. Cost per active student: argued, not measured

Because the after-eval failed, the spec's "flat or falling" check is **reasoned from the code**, not measured:
- Both pack changes can only remove text from the prompt: dedupe drops a duplicated section's lines, clipping shortens long titles. Neither adds a call, a section or a model.
- The 3 plan-brief and 5 extendPlan calls that did succeed in the after run read 2057 and 1945 input tokens per call against 1725 and 1709 before. These are **different cases and tiny samples**, so they say nothing either way. I am not claiming a saving.
- The pack budgets (3000 / 2000 / 1600 tokens) are unchanged and remain the hard ceiling per call, so the worst case did not rise.
- To measure properly once credits exist: `echo y | npm run eval:pipeline > after.log` then `node scripts/eval-cost-from-log.mjs before.log after.log`. About $0.30, one run.

New-feature cost: nothing added a call, so no new per-feature monthly cost for a free student.

## 6. Can the student see and delete what is learned?

- **Facts: yes.** "You, mapped" (`components/settings/WhatTangentKnows.tsx`) lists each fact with its origin ("You said", "Tangent noticed", "Guess, confirm?", `lib/you-map.ts`), lets the student forget one fact (with Undo; `POST /api/context {action:"forget"}`), add one, edit one, and "Forget everything" behind a typed confirmation (`forget_all`, word FORGET). Sensitive facts (health, family) are refused at write time (`lib/student/facts.ts`, `NOT_KEPT` message).
- **Observed habits: no.** The "how you work" lines in the pack (`calibrationLines`, `behaviourLines`, computed from `step_events`) are **not shown** in You, mapped, and "Forget everything" does **not** delete them (it clears `context_entries` only). Only "Delete all my data" clears `step_events` (`resetUserData`, `lib/store.ts`). This is the one gap in "see and delete". Fixing deletion is a data-deletion change (gated), so it is planned in NEEDS-SID, not built.
- I checked this by reading the code and grepping the components for `step_events`, `behaviour` and `calibration` (no matches in `components/` or `app/`). I did not click through it tonight (the production server was stopped for the eval); the facts flow was checked in Round 5B.

## 7. Compactness and data-minimization rules (as they stand)

- Hard budget per purpose; sections have priorities and the lowest drop first (facts 90, calibration 85, school 80, week 75, load 70, overdue 65, due 60, goals 55, projects 50, classes 40, summary 20; capacity is never dropped).
- Titles 90 characters max in the pack (new).
- A deadline appears once (new).
- Only the ranked facts relevant to the query and purpose go in; the brief and voice calls get facts only.
- Sensitive categories are never stored as facts (`lib/student/facts.ts`).
- The feed URL, tokens and email are never in any prompt (CONNECTORS.md section 3).
- Utility calls get no student data at all.

## 8. Gated or open (all in NEEDS-SID)

1. Apply the `ai_usage.task` migration, then pass the task in `recordUsage`.
2. Show observed habits in You, mapped, and make "Forget everything" clear `step_events`.
3. Persist the grill's asked-list (needs a table).
4. **Add credits to the Anthropic account** and re-run the after-eval (about $0.30).
