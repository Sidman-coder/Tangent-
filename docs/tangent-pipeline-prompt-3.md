# Tangent: Pipeline V2, Prompt 3 (merged): testing fixes + router + matcher + AI Activity

## Before you paste (do these first)

1. **Ship what you have.** The current branch already stops the live "Cleared 93 tasks" bug, so it should go live before anything else:
   ```
   git add -A
   git commit -m "Safety hotfix: scoped confirmed deletes, persistent undo, clean titles, just-talking follow-up"
   git fetch origin
   git merge origin/main
   npm run build
   npm test
   ```
   If the merge reports conflicts, stop and get help. Then, with the switch **off**, check that "take out all of my SAT tasks" asks first and never clears everything. Then:
   ```
   git push -u origin pipeline-v2/2-intake
   ```
   On GitHub, open a PR **pipeline-v2/2-intake → main** and merge it. Make sure the migrations (step 0, Juann's capacity migration, chat_messages_undo_refs) are already run in Supabase.
2. **Start Prompt 3 from the updated main:**
   ```
   git checkout main
   git pull
   git switch -c pipeline-v2/3-understanding
   ```
   (If the folder-lock error appears, close VS Code and File Explorer and retry.)
3. In Claude Code (local, in the TANGENT demo folder), paste **Part 1**, then **Part 2**. When Part 2 is built and its summary looks good, paste **Part 3** in the **same session**.

---

## Part 1: Context (paste first)

```
Context before the prompt below:
- We're on branch pipeline-v2/3-understanding, created from main after the Pipeline V2 steps 0–2 and the safety hotfix were merged. Don't create a branch, and don't push or merge.
- Supabase already has: the step-0 migration (change_sets, events, change_sets_guard trigger, apply_changeset kind), Juann's 20261010000000_profile_daily_capacity.sql, and 20261011000000_chat_messages_undo_refs.sql. Any NEW migration goes in a new file after these. Don't run it, and add it to section A of docs/tangent-pipeline-final-checks.md.
- What exists: ChangeSet + applyChangeSet + batch undo; drafts + PreviewCard + /api/changesets/*; the single intake (lib/pipeline/intake.ts) with a temporary rule in lib/pipeline/route-request.ts marked "TODO Prompt 3"; scoped, confirmed bulk deletes; Recent changes + Undo toast; quick-add title cleanup; the "Just talking" follow-up with the readiness row. Quick adds and the pen stay instant.
- Juann added lib/load.ts (daily capacity, the "spacing brain"). Don't modify it in this step; Prompt 4 will use it for scheduling.
- Don't run the real eval (the --check mode is fine), and don't touch Supabase.
- At the end, add new manual checks to docs/tangent-pipeline-final-checks.md as sections "J. Testing fixes", "E2. Prompt 3" and (after Part 3) "E3. AI Activity", instead of asking me to test now.
```

---

## Part 2: The prompt (fixes + router + matcher + decision log)

```
Pipeline V2, step 3. This has two halves: A) fix three bugs found in testing, and B) build the intent router and plan matcher. Do A first, since B builds on it. Everything new is behind TANGENT_PIPELINE_V2, except where a fix says "flag on AND off".

READ FIRST, then give me your plan before writing code:
- lib/pipeline/* (intake.ts, route-request.ts, changeset.ts, apply.ts, apply-core.ts, draft.ts, grade.ts, fixtures/requests.json)
- lib/voice-handler.ts (scoped-delete code from the hotfix, classifyIntent, isPlanRequest, findTaskByTitle, the plan branch, the calendar-listing path)
- lib/ai/router.ts (no-AI fast paths: keep them first)
- lib/chat-reply.ts (PLAN_FOLLOWUP, isCompleteSchedule), components/console/ChatThread.tsx, components/PreviewCard.tsx
- lib/ai/models.ts, lib/ai/call.ts, lib/anthropic-json.ts, lib/store.ts

═══ A. FIXES FROM TESTING ═══

Real transcript (flag on):
  me: "Take out all of my SAT tasks"
  ai: "sat" matches more than one plan: "SAT Writing Skills Sprint", "SAT Math Mastery Plan". Which one should I delete?
  me: "the writing stuff"                 → ai: "I couldn't add that to your calendar — Task not found: SAT Writing Skills Sprint."
  me: "all of them"                       → ai: "I didn't delete anything. Which tasks should I remove?…"
  me: "my SAT tasks"                      → ai: "You have 4 calendars: All Calendars, Personal, Work, Study"
  me: "the SAT writing skills sprint one" → ai: a PREVIEW TO CREATE A NEW PLAN "SAT Writing Skills Sprint" with 8 tasks
Also: "I have a soccer coaching appointment coming up tomorrow 10pm" → task titled "I have a soccer coaching appointment coming up".
Also: after I clicked "Just talking, don't add", the conversation never offered "Ready to add this to your calendar?".

A1. Clarifying questions must remember what they asked (flag on AND off)
   - Root cause to confirm: answers to a clarifying question are routed as brand-new requests, with no memory of the question.
   - When Tangent asks a which-one question, save a pending question server-side: the action (delete / add_to_plan / change), the candidates (ids + titles), who it's for, and an expiry (10 minutes). Store it with the chat session or in ai_decisions (B9) if that's built first.
   - Show the choices as TAP BUTTONS under the question: one per candidate, plus "All of these" (for deletes), plus "Cancel". Tapping resolves directly, with no re-parsing.
   - Typed answers are resolved against the pending question FIRST:
     - fuzzy match against the candidate titles ("the writing stuff", "the SAT writing skills sprint one", "writing" → SAT Writing Skills Sprint)
     - "all", "all of them", "both", "everything" → all candidates
     - "cancel", "never mind", "no" → cancel
     - a fresh, unrelated request → drop the pending question and route normally
     - still unclear → ask again once, with the buttons.
   - After resolving a delete: show the delete preview (count + titles, Confirm/Discard). Flag on → a ChangeSet of delete ops; flag off → the existing confirmation.
   - An answer to a clarifying question must NEVER create a new plan, and must never fall through to unrelated fast paths (like listing calendars).
   - Investigate and fix why "my SAT tasks" returned the calendar list (a fast-path regex is probably too broad). Add it as a regression test.

A2. Deleting a plan's tasks: offer to remove the plan too
   - When a scoped delete targets a whole plan, the preview has an "Also remove the plan" checkbox, checked by default when every task in the plan is being deleted.
   - Add a delete_plan op to the ChangeSet schema, with undo that restores the plan and re-links its tasks. Flag off: include the plan removal in the existing confirmation text.

A3. Clean titles for EVERY new task (flag on AND off)
   - New pure module lib/pipeline/titles.ts, applied to every add_task title: fast path, AI single tasks, plan tasks, and parsed chat plans.
   - Strip lead-ins (I have a/an, I've got, I need to, I have to, remind me to, there's a, don't forget to, add, schedule, put).
   - Strip trailing filler and time/date words that are already captured as the date/time: "coming up", "soon", "later", "tomorrow", "today", "tonight", weekday names, "next week", "at 10pm", "10pm", "at 3", "on friday", "by friday".
   - Capitalize the first letter. If cleaning leaves fewer than 2 characters, keep the original.
   - "I have a soccer coaching appointment coming up tomorrow 10pm" → title "Soccer coaching appointment", date tomorrow, time 10:00 PM. Check that the time is still captured.
   - 15+ unit tests, including the two real examples and some that must stay unchanged ("Add math notes to binder" keeps "Add").

A4. "Just talking" → readiness, done right (flag on)
   - After "Just talking, don't add", the next replies keep planning, one short question at a time.
   - As soon as a later reply contains a complete schedule (isCompleteSchedule), show "Ready to add this to your calendar?" with [Yes, show preview] and [Keep talking].
   - If the student's answer makes the plan complete but the reply only confirms it, still show the readiness row (judge readiness from the conversation's latest complete schedule, not just the last reply's text).
   - Keep showing a small "Add plan to calendar" chip on the latest complete schedule in the thread until it's added or discarded.
   - Add tests for the exact transcript shape: plan → Just talking → answer → readiness shown.

A5. Undo safety before plans get edited
   - restore_plan undo currently puts the whole plan back as it was at confirm time, which would wipe later edits. Change it to compare-and-restore: only revert fields this change set changed, and only if they still hold the value it set. Same for tasks.
   - Add tests. This is needed before B4 starts editing existing plans.

═══ B. ROUTER + MATCHER (behind the flag) ═══

B1. Intent router (lib/pipeline/intent.ts), replacing route-request.ts when the flag is on
   - Order: (a) pending-question resolution (A1) → (b) no-AI fast paths from lib/ai/router.ts → (c) one small FAST-model (Haiku) call with strict zod-validated JSON → (d) fallback to the old rule if the AI call fails or the budget blocks it.
   - Output: { intent: new_plan | add_to_plan | change_plan | add_task | change_task | complete_task | delete_task | delete_plan_tasks | question | clarify, confidence: 0–1, plan_mention: string|null, task_mention: string|null, clean_title: string|null, reason: short string }.
   - Router prompt rules:
     - a single dated item ("I have a test next week", "dentist friday") is add_task, never new_plan
     - a real question with no request to change anything is question, even if it contains "plan" or "schedule"
     - new_plan only when the student asks for a multi-step plan toward a goal
     - "take out / remove / delete … tasks" is delete_task or delete_plan_tasks, never clear-all.
   - Confidence below 0.6 → clarify: a small card with 2–3 tap options ("Make a plan", "Just add one task", "Just talking") instead of guessing.
   - Keep the system prompt stable (no dates or user data) so caching can work. Put the date and request in the user message. Comment: Haiku 4.5 only caches prompts of 4,096+ tokens.
   - Register feature "intentRouter" in lib/ai/models.ts on the FAST tier (~200 output tokens).
   - Have the composer mark dictated text as source "voice", so browser voice is logged correctly.

B2. Plan matcher (lib/pipeline/match.ts), pure code, no AI, with thorough tests
   - Input: plan_mention + the student's active plans (id, title, aliases, updated_at).
   - Score: exact or alias match; normalized match (lowercase, strip spaces/dots/dashes, so "iCF" = "I.C.F." = "icf"); fuzzy similarity (trigram or Jaro-Winkler, written in the repo); sound-alike for voice ("eye see eff" → "icf": letter-name spelling plus a small phonetic code); a small recency bonus. Whole-word matching only, so "SAT" never matches "Saturday".
   - Decision: sure (high score and clearly ahead of number 2) → target it; unsure → the A1 tap question; none → new plan.
   - Thresholds go in one commented constants object.
   - Reuse this matcher for A1's typed-answer resolution and for scoped deletes.

B3. Nicknames: migration table plan_aliases (id, user_id, plan_id references plans on delete cascade, alias_normalized, created_at, unique(user_id, alias_normalized), owner-only RLS). When a student confirms a matched target, or picks one by tapping, save the words they used. Max 10 per plan.

B4. Adding to an existing plan
   - For add_to_plan / change_plan: ChangeSet with target_plan_id, add_task ops with plan_id, update_plan if needed. No create_plan.
   - New lib/pipeline/extend-plan.ts (feature "extendPlan", SMART tier) receives the request, the plan title and its existing tasks, and returns ONLY new tasks (no repeats), using the current date rules.
   - Preview header: "Updating ICF Prep · 6 tasks → 8 tasks".

B5. Events (structured props only): intent_classified {intent, confidence_bucket, via}, match_proposed {decision, candidates}, match_confirmed {method}, match_corrected, clarify_shown, clarify_answered {choice}, pending_question_resolved {how: "tap"|"typed"|"dropped"|"expired"}.

B6. Fixtures and eval: add cases for:
   - the full transcript above (each answer resolves correctly)
   - "my icf thing" with an alias
   - "ICF Prep" vs "ICF Essay" → unsure
   - "eye see eff prep"
   - "add a study session to my SAT plan"
   - "rename my ICF plan to ICF Finals"
   - "I have a test next week" → add_task
   - "should I schedule study time?" → question
   - a low-confidence → clarify case
   - title-cleanup cases.
   Update gradeCase for target_plan and must_not. Router and matcher tests run without the AI (mock the router). Only run eval --check.

B9. Decision record (data for the AI Activity page in Part 3)
   - In the same migration as plan_aliases, add table ai_decisions: id, user_id, created_at, updated_at, source ("typed"|"voice"|"palette"), request_text (max 500 characters), route ("fast"|"chat"|"draft"|"clarify"|"answer"), intent, confidence, via ("pending"|"fast"|"ai"|"fallback"), plan_match jsonb (decision + up to 3 candidates with title and score), chosen_plan_id, pending_question jsonb (for A1), change_set_id, action_id, models jsonb, outcome ("answered"|"drafted"|"confirmed"|"discarded"|"undone"|"applied_instantly"|"asked"|"failed").
   - RLS: students can SELECT and DELETE their own rows. Inserts and updates happen server-side. Deleting a row never changes calendar data.
   - One row per intake request (flag on), with the outcome updated on confirm, discard, undo and answer. 90-day retention (cleanup on read if there's no suitable cron). Unit-test the outcome transitions.

RULES
- Don't change the existing plan-generation prompts or lib/ai/router.ts patterns, except to narrow the over-broad regex from A1 (show the diff). New prompts go in new files.
- Flag OFF: only A1 (memory for clarifying questions, using the existing confirmation flow), A2 (plan removal in the confirmation text) and A3 (titles) change behavior. Verify everything else in the diff, and add a test that the router is never called with the flag off.
- No secrets. Don't touch Supabase. Don't commit or push.

DONE WHEN
- npm run build, npm test and eval --check pass.
- Summary: root causes for A1–A4, files added/changed, the router schema, matcher thresholds, the new migration, estimated extra cost per request, and the exact changed lines in ChatThread.tsx / ai/page.tsx / CommandPalette.tsx / PreviewCard.tsx for Juann.
- Checks added as sections J and E2 in docs/tangent-pipeline-final-checks.md.
```

---

## Part 3: AI Activity page (paste after Part 2 is built, same session)

```
Step 3B: AI Activity. Goal: students (and we, while testing) can see every request the AI handled, what it decided, and what happened, in a table. Behind TANGENT_PIPELINE_V2: with the flag off, the tab and button don't appear and the routes return 404.

READ FIRST, then give me your plan before writing code:
- app/(app)/settings/page.tsx and how its sections/tabs are built (match that pattern exactly)
- ai_decisions (B9), change_sets, action_records, ai_usage
- app/(app)/ai/page.tsx header ("Tangent AI" title, "Your Brief" button), components/PreviewCard.tsx, components/CommandPalette.tsx, components/RecentChanges.tsx
- lib/auth/access.ts (isOwnerEmail)

BUILD:

1. Settings → new tab "AI Activity"
   - A table, newest first, 25 rows per page:
     | When | You asked | Tangent understood | Plan | Changes | Result |
     - When: relative time, with the exact time on hover
     - You asked: one line, full text on expand, with a voice icon when spoken
     - Tangent understood: plain words ("New plan", "Add to a plan", "Single task", "Question", "Quick command (no AI)", "Asked you to choose", "Remove tasks") plus a high/mid/low confidence dot
     - Plan: the matched title, "New plan", or "—"
     - Changes: "+3 tasks", "−5 tasks", "1 moved", "—"
     - Result: a chip: Answered / Waiting for you / Added / Removed / Discarded / Undone / Added instantly / Failed
   - Filters: Result, Type (plans, tasks, removals, questions, quick commands), date range (7/30/90 days), plus search on request_text.
   - Expanding a row shows "Why Tangent did this":
     - intent + confidence + who decided (AI / quick rule / fallback / your answer)
     - plan match candidates with strength (strong/possible/weak), what was chosen and how
     - questions asked and the answers
     - assumptions
     - every change (describeChangeSet lines), plus skipped duplicates
     - actions: Undo (existing undo route) if still undoable, "Open draft" if waiting.
   - Owner-only debug columns (only when isOwnerEmail): models used, plus tokens and estimated cost joined from ai_usage. Never shown to students.
   - "Delete" per row and "Clear activity" (with a confirm dialog) delete log rows only. The dialog says: "This clears the log. Your calendar stays the same."
   - Empty state: "Nothing yet. When you ask Tangent AI to plan or change things, you'll see what it did here."
   - Under 640px, rows become stacked cards.

2. Entry points (keep the AI page uncluttered)
   - AI page header: ONE small ghost icon button (a history/clock icon, no label) left of "Your Brief", with tooltip and aria-label "AI activity". It links to Settings → AI Activity.
   - Collapsed preview receipt: add a quiet "Details" link ("Added to your calendar · Undo · Details") that opens that exact row expanded.
   - Recent changes panel: each item gets "Details" too, when it came from the AI.
   - Command palette: "Open AI activity".
   - Nothing added to the hero, composer, suggestion chips or the left sidebar.

3. API: GET /api/ai-activity?cursor&filters, DELETE /api/ai-activity/[id], DELETE /api/ai-activity (clear). Wrapped in withUser, limited to the user's own rows by RLS plus a user_id check, and 404 with the flag off. Events: activity_viewed, activity_row_expanded, activity_cleared.

4. Tests: a user can't read or delete another user's rows; 404 with the flag off; clearing doesn't touch tasks, plans or change_sets; unit tests for the plain-words helpers.

RULES: match the existing settings styling and tokens, with no new UI libraries. AI page changes are limited to the one icon button. List the exact changed lines in ai/page.tsx, settings/page.tsx, PreviewCard.tsx, RecentChanges.tsx and CommandPalette.tsx for Juann. Don't touch Supabase, and don't commit or push.

DONE WHEN: build, tests and eval --check pass; summary plus changed lines for Juann; checks added as section E3 "AI Activity" in docs/tangent-pipeline-final-checks.md (owner columns hidden for a non-owner, delete doesn't change the calendar, Details opens the right row, mobile layout, flag off hides everything).
```

---

## After it's built (testing order)

1. Run the new migration (plan_aliases + ai_decisions) in the Supabase SQL Editor.
2. Restart `npm run dev` with `TANGENT_PIPELINE_V2=true`.
3. Retest the exact transcript: "Take out all of my SAT tasks" → tap or type "the writing stuff" → a delete preview for **only** that plan, with "Also remove the plan".
4. "I have a soccer coaching appointment coming up tomorrow 10pm" → **"Soccer coaching appointment"**, tomorrow at 10 PM.
5. Plan → "Just talking" → answer its questions → **"Ready to add this to your calendar?"** appears.
6. Sections J, E2 and E3 of the checklist, then switch off and repeat the J checks.
