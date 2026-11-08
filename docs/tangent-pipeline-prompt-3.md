# Tangent: Prompt 3 (rewritten after merging Juann's main)
Testing fixes + intent router + plan matcher + decision log + AI Activity, built ON TOP of Juann's projects, questions and spacing.

## Before you paste
```
git checkout main
git pull
npm install
git switch -c pipeline-v2/3-understanding
```
(If the folder-lock error appears, close VS Code and File Explorer and retry.)

Paste **Part 1**, then **Part 2** into Claude Code (local). Send its plan for review before saying go. When Part 2 is done, paste **Part 3** in the same session.

---

## Part 1: Context
```
Context before the prompt below:
- We're on branch pipeline-v2/3-understanding, created from main. Main now has BOTH:
  (a) Juann's work: the spacing brain (lib/spacing.ts), daily capacity (lib/load.ts, /api/capacity), School / No school calendars, Projects (/projects, project chat, addTasksToPlan), "questions before acting" (question cards + questions inbox), instant capture (no AI), student context in plans/voice, one routed input on the AI page, "What Tangent knows", the feature tour, Liquid Glass and the task detail panel;
  (b) our Pipeline V2 steps 0–2 + safety hotfix: ChangeSet + applyChangeSet + batch undo, change_sets/events tables, PreviewCard + /api/changesets/*, lib/pipeline/intake.ts with the temporary rule in route-request.ts ("TODO Prompt 3"), scoped confirmed bulk deletes, Recent changes + UndoToast, title cleanup (cleanTitle), the "Just talking" follow-up and readiness row, all behind TANGENT_PIPELINE_V2 where noted.
- Supabase already has: 20261006000000_pipeline_v2_change_sets_and_events, 20261010000000_profile_daily_capacity, 20261011000000_chat_messages_undo_refs. A NEW migration goes in a new file after these. Don't run it, and add it to section A of docs/tangent-pipeline-final-checks.md.
- BUILD ON Juann's systems, don't duplicate them: placement uses lib/spacing.ts + lib/load.ts; clarifying questions reuse his question-card / answers mechanism; adding to a plan reuses addTasksToPlan (wrapped in our ChangeSet so it previews); student context comes from his context builder. If something of ours overlaps his, extend his and tell me.
- Don't run the real eval (--check is fine), don't touch Supabase, and don't commit or push.
- At the end, add manual checks to docs/tangent-pipeline-final-checks.md as sections "J. Testing fixes", "E2. Prompt 3" and (after Part 3) "E3. AI Activity".
```

---

## Part 2: Fixes + router + matcher + decision log
```
Pipeline V2, step 3. Two halves: A) fix bugs found in testing, B) the intent router and plan matcher. Do A first. New behavior is behind TANGENT_PIPELINE_V2 unless a fix says "flag on AND off".

READ FIRST and summarize Juann's relevant systems in 5–10 bullets, then give me your plan before writing code:
- Juann: lib/spacing.ts, lib/load.ts, the projects code (addTasksToPlan, project chat), the question-card / questions-inbox code and how answers flow back into app/api/chat/route.ts, his routing on the AI page (questions vs Tangents vs projects), the student-context builder, "What Tangent knows".
- Ours: lib/pipeline/* (intake.ts, route-request.ts, changeset.ts, apply.ts, apply-core.ts, draft.ts, titles/cleanTitle, grade.ts, fixtures/requests.json), lib/chat-reply.ts (PLAN_FOLLOWUP, isCompleteSchedule), components/PreviewCard.tsx, components/console/ChatThread.tsx, the scoped-delete code in lib/voice-handler.ts, lib/ai/router.ts, lib/ai/models.ts, lib/ai/call.ts, lib/store.ts.

═══ A. FIXES FROM TESTING ═══
Real transcript (flag on, before the merge — re-test it on current main first and report what still fails):
  me: "Take out all of my SAT tasks"
  ai: "sat" matches more than one plan: "SAT Writing Skills Sprint", "SAT Math Mastery Plan". Which one should I delete?
  me: "the writing stuff"                 → ai: "I couldn't add that to your calendar — Task not found: SAT Writing Skills Sprint."
  me: "all of them"                       → ai: "I didn't delete anything. Which tasks should I remove?…"
  me: "my SAT tasks"                      → ai: "You have 4 calendars: All Calendars, Personal, Work, Study"
  me: "the SAT writing skills sprint one" → ai: a PREVIEW TO CREATE A NEW PLAN "SAT Writing Skills Sprint" with 8 tasks
Also: "I have a soccer coaching appointment coming up tomorrow 10pm" → title "I have a soccer coaching appointment coming up".
Also: after "Just talking, don't add", the conversation never offered "Ready to add this to your calendar?".

A1. Clarifying questions remember what they asked (flag on AND off)
   - Use Juann's question-card mechanism. When Tangent asks "which one?", it records a pending question: action (delete / add_to_plan / change), candidates (ids + titles), expiry 10 minutes.
   - Show the choices as tap buttons: one per candidate, "All of these" (for deletes), "Cancel". A tap resolves directly.
   - Typed answers are checked against the pending question FIRST:
     - fuzzy match on titles ("the writing stuff", "the SAT writing skills sprint one", "writing")
     - all / all of them / both / everything → all candidates
     - cancel / never mind / no → cancel
     - an unrelated new request → drop the question and route normally
     - unclear → ask once more, with buttons.
   - After resolving a delete: the delete preview (count + titles). Flag on → ChangeSet; flag off → the existing confirmation.
   - An answer to a clarifying question must NEVER create a plan, and must never hit unrelated fast paths. Find and narrow the regex that sent "my SAT tasks" to the calendar list (show the diff), and add a regression test.

A2. Deleting a plan's tasks offers to remove the plan
   - Preview checkbox "Also remove the plan", checked by default when every task in it is deleted.
   - Add a delete_plan ChangeSet op whose undo restores the plan and re-links its tasks. Flag off: mention it in the confirmation text.
   - Works for Juann's Projects too.

A3. Clean titles on EVERY new task path (flag on AND off)
   - Make sure cleanTitle runs on: quick adds, Juann's instant capture, AI single tasks, plan/project steps, addTasksToPlan steps, and parsed chat plans.
   - Extend it: strip lead-ins (I have a/an, I've got, I need to, I have to, remind me to, there's a, don't forget to, add, schedule, put) and trailing filler or date/time words already captured ("coming up", "soon", "later", "tomorrow", "today", "tonight", weekdays, "next week", "at 10pm", "10pm", "at 3", "on friday", "by friday").
   - Capitalize the first letter. If fewer than 2 characters are left, keep the original.
   - "I have a soccer coaching appointment coming up tomorrow 10pm" → "Soccer coaching appointment", tomorrow at 10:00 PM. Check that the time is still used, since Juann's spacing only keeps a time the student actually said.
   - 15+ tests, including ones that must stay unchanged ("Add math notes to binder").

A4. "Just talking" → readiness (flag on)
   - After "Just talking, don't add", keep planning one short question at a time. This must fit with Juann's questions-before-acting flow, not run alongside it.
   - Readiness is judged from the conversation's latest complete schedule, not just the last reply's wording. When complete, show "Ready to add this to your calendar?" [Yes, show preview] [Keep talking].
   - Keep a small "Add plan to calendar" chip on the latest complete schedule until it's added or discarded.
   - Test the exact shape: plan → Just talking → answer → readiness shown.

A5. Undo safety before editing plans
   - restore_plan / task restores must be compare-and-restore: only revert fields this change set changed, and only if they still hold the value it set. Add tests.

A6. Existing projects go through the preview (flag on)
   - Today, project chat and the "Ask" box save straight to the project. Wrap addTasksToPlan in a ChangeSet (add_task ops with plan_id) so they preview like everything else. Where a surface truly can't render a card, show a compact inline confirm (Confirm / Discard) instead of saving directly.

═══ B. ROUTER + MATCHER (behind the flag) ═══
B1. Intent router (lib/pipeline/intent.ts), replacing route-request.ts and unifying with Juann's AI-page routing
   - Order: (a) pending-question resolution (A1) → (b) no-AI fast paths + Juann's instant capture → (c) one FAST-model (Haiku) call with strict zod JSON → (d) fallback to the old rules if the AI call fails or the budget blocks it.
   - Output: { intent: new_plan | new_project | add_to_plan | change_plan | add_task | change_task | complete_task | delete_task | delete_plan_tasks | tangent | question | clarify, confidence: 0–1, plan_mention, task_mention, clean_title, needs_questions: boolean, reason }.
     - new_project and tangent map onto Juann's existing destinations.
     - needs_questions hands off to Juann's questions-before-acting flow.
   - Rules:
     - a single dated item is add_task, never new_plan
     - a real question with no change requested is question, even if it says "plan" or "schedule"
     - new_plan / new_project only for multi-step goals
     - "take out / remove / delete … tasks" is delete_task or delete_plan_tasks, never clear-all.
   - Confidence < 0.6 → clarify, with tap options ("Make a plan", "Just add one task", "Just talking").
   - Stable system prompt (no dates or user data), with date + request in the user message. Comment: Haiku 4.5 caches only prompts of 4,096+ tokens. Feature "intentRouter" on the FAST tier (~200 output tokens).
   - The composer marks dictated text as source "voice".

B2. Plan matcher (lib/pipeline/match.ts), pure code with thorough tests
   - Matches against plans AND projects: exact or alias; normalized ("iCF" = "I.C.F." = "icf"); fuzzy (trigram or Jaro-Winkler, written in the repo); sound-alike ("eye see eff"); recency bonus; whole words only ("SAT" ≠ "Saturday").
   - Decision: sure → target; unsure → A1 tap question; none → new.
   - One commented thresholds object. Used by the router, A1 typed answers and scoped deletes.

B3. Nicknames: new migration with table plan_aliases (id, user_id, plan_id → plans on delete cascade, alias_normalized, created_at, unique(user_id, alias_normalized), owner-only RLS). Save the student's words when they confirm or tap a match. Max 10 per plan.

B4. Adding to an existing plan/project
   - ChangeSet with target_plan_id, add_task ops with plan_id, update_plan if needed, no create_plan.
   - New tasks come from lib/pipeline/extend-plan.ts (feature "extendPlan", SMART tier), which returns ONLY new tasks given the existing ones. Placement goes through Juann's spacing (lib/spacing.ts + lib/load.ts), so tasks fit around school and capacity.
   - Preview header: "Updating ICF Prep · 6 tasks → 8 tasks". Note any time or day that spacing chose.

B5. Events (structured props only): intent_classified {intent, confidence_bucket, via}, match_proposed {decision, candidates}, match_confirmed {method}, match_corrected, clarify_shown, clarify_answered {choice}, pending_question_resolved {how}.

B6. Fixtures and eval
   - Add cases:
     - the full transcript above
     - an alias case
     - "ICF Prep" vs "ICF Essay" → unsure
     - "eye see eff prep"
     - "add a study session to my SAT plan"
     - "rename my ICF plan to ICF Finals"
     - "I have a test next week" → add_task
     - "should I schedule study time?" → question
     - a project case
     - a tangent case
     - low confidence → clarify
     - title cases.
   - Update gradeCase for target_plan and must_not. Tests run without the AI (mocked router). Only eval --check.

B9. Decision record
   - Same migration as plan_aliases: table ai_decisions (id, user_id, created_at, updated_at, source, request_text ≤500 chars, route, intent, confidence, via, plan_match jsonb, chosen_plan_id, pending_question jsonb, change_set_id, action_id, models jsonb, outcome: answered|drafted|confirmed|discarded|undone|applied_instantly|asked|failed).
   - RLS: students can select and delete their own rows; inserts and updates are server-side only. Deleting a row never changes calendar data.
   - One row per intake request (flag on), with the outcome updated on confirm, discard, undo and answer. 90-day retention. Test the outcome transitions.

RULES
- Don't change existing plan-generation prompts, Juann's spacing or load logic, or lib/ai/router.ts patterns, except narrowing the A1 regex (show the diff). New prompts go in new files.
- Flag OFF: only A1 (question memory), A2 (plan removal in the confirmation text) and A3 (titles) change behavior. Verify the rest, and add a test that the router is never called with the flag off.
- No secrets. Don't touch Supabase. Don't commit or push.

DONE WHEN
- npm run build, npm test and eval --check pass.
- Summary: the re-test of the transcript on current main, root causes for A1–A4, how each piece builds on Juann's systems, files changed, router schema, matcher thresholds, the migration, extra cost per request, and the exact changed lines in Juann's UI files (ai/page.tsx, ChatThread.tsx, CommandPalette.tsx, PreviewCard.tsx, project chat).
- Checks added as sections J and E2.
```

---

## Part 3: AI Activity page (same session, after Part 2)
```
Step 3B: AI Activity. Students (and we, while testing) can see every request the AI handled, what it decided, and what happened. Behind TANGENT_PIPELINE_V2: with the flag off, the tab and button are hidden and the routes return 404.

READ FIRST, then plan:
- app/(app)/settings/page.tsx (match its tab pattern and Juann's Liquid Glass styling)
- Juann's "What Tangent knows" screen (AI Activity is its sibling: what Tangent DID vs what Tangent KNOWS; link the two)
- ai_decisions, change_sets, action_records, ai_usage
- the AI page header, PreviewCard, RecentChanges, CommandPalette, lib/auth/access.ts (isOwnerEmail)

BUILD:
1. Settings → "AI Activity" tab
   - Table, newest first, 25 rows per page: When | You asked | Tangent understood | Plan | Changes | Result.
     - Understood is in plain words ("New plan", "New project", "Add to a plan", "Single task", "Question", "Quick capture (no AI)", "Asked you to choose", "Remove tasks", "Sent to Tangents") with a high/mid/low confidence dot.
     - Result chips: Answered / Waiting for you / Added / Removed / Discarded / Undone / Added instantly / Failed.
   - Filters: Result, Type, 7/30/90 days, plus search.
   - Expanding a row shows "Why Tangent did this":
     - intent, confidence, who decided
     - match candidates (strong/possible/weak), what was chosen and how
     - questions and answers
     - assumptions, including times or days chosen by spacing
     - every change, plus skipped duplicates
     - Undo if still possible; Open draft if waiting.
   - Owner-only columns (isOwnerEmail): models used, tokens and estimated cost from ai_usage.
   - Delete row / Clear activity (with a confirm dialog that says "This clears the log. Your calendar stays the same.").
   - Empty state: "Nothing yet. When you ask Tangent AI to plan or change things, you'll see what it did here."
   - Stacked cards under 640px.
2. Entry points
   - ONE ghost icon button (history/clock) left of "Your Brief", with tooltip and aria-label "AI activity".
   - A "Details" link on collapsed preview receipts and on AI items in Recent changes.
   - Command palette: "Open AI activity".
   - Nothing added to the hero, composer, chips or sidebar.
3. API: GET /api/ai-activity, DELETE /api/ai-activity/[id], DELETE /api/ai-activity. Wrapped in withUser, own rows only (RLS + user_id check), 404 with the flag off. Events: activity_viewed, activity_row_expanded, activity_cleared.
4. Tests: no cross-user reads or deletes; 404 with the flag off; clearing never touches tasks, plans, projects or change_sets; plain-words helpers.

RULES: match the existing styling, no new UI libraries, and the only AI page change is the one icon button. List the exact changed lines for Juann. Don't touch Supabase, don't commit or push.

DONE WHEN: build, tests and eval --check pass; summary plus changed lines; section E3 added to the checks doc (owner columns hidden for a non-owner, delete keeps the calendar, Details opens the right row, mobile layout, flag off hides everything).
```

---

## After it's built
1. Run the new migration (plan_aliases + ai_decisions) in the Supabase SQL Editor.
2. Restart `npm run dev` with `TANGENT_PIPELINE_V2=true` in `.env.local`.
3. Re-run the SAT conversation: tap or type "the writing stuff" → a delete preview for only that plan, with "Also remove the plan".
4. "I have a soccer coaching appointment coming up tomorrow 10pm" → "Soccer coaching appointment", tomorrow at 10 PM.
5. Plan → Just talking → answer → "Ready to add this to your calendar?"
6. "add a study session to my ICF prep" (with an ICF project) → "Updating ICF Prep · N → N+1 tasks", placed around school.
7. Sections J, E2 and E3, then switch off and repeat J.
