# Tangent: Pipeline V2, Prompt 3 (Understanding: intent router + plan matcher)

Before pasting, run:

```
git add -A
git commit -m "Pipeline V2 step 2: one input box, plan reuse, just-talking, draft restore"
git switch -c pipeline-v2/3-understanding
```

Paste **Part 1** first, then **Part 2**, into Claude Code (local, in the TANGENT demo folder). When Part 2 is built and its summary looks good, paste **Part 3** into the **same session** (same branch) to build the AI Activity page.

---

## Part 1: Context (paste first)

```
Context before the prompt below:
- We're already on branch pipeline-v2/3-understanding, created from pipeline-v2/2-intake (which builds on 1-action and 0-foundation). Don't create a branch, and don't push or merge.
- Steps 0–2 are committed but NOT merged, and NO Supabase migration has been applied. Don't run anything against Supabase, and don't run the real eval (the --check mode is fine).
- What exists: ChangeSet + applyChangeSet + undo (step 0), drafts + PreviewCard + /api/changesets/* routes (step 1), and the single intake (lib/pipeline/intake.ts) with a temporary rule in lib/pipeline/route-request.ts marked "TODO Prompt 3" (step 2). Quick adds and the pen stay instant.
- Notes from step 2 to handle here:
  1. Questions that contain action words ("should I schedule…") currently get a preview. The router should send real questions to chat.
  2. Browser voice is logged as source "typed". Have the composer mark text that came from dictation, so events and change sets say source "voice".
- If you need a migration, put it in a new file after the existing ones and don't run it. Add it to section A of docs/tangent-pipeline-final-checks.md.
- At the end, add new manual checks as a new section "E2. Prompt 3" in docs/tangent-pipeline-final-checks.md instead of asking me to test now.
```

---

## Part 2: The prompt

```
Pipeline V2, step 3: Understanding. Goal: Tangent works out WHAT the student wants (intent) and WHICH existing plan they mean (matching) before anything is drafted. This fixes the two worst bugs: "add 2 checkpoints to my iCF prep" creates a NEW plan instead of updating "ICF Prep", and "I have a test next week" becomes a 7-day plan.

Everything is behind TANGENT_PIPELINE_V2. Flag OFF = today's behavior, unchanged.

READ FIRST, then give me your plan before writing code:
- lib/pipeline/* (intake.ts, route-request.ts, changeset.ts, draft.ts, grade.ts, fixtures/requests.json)
- lib/voice-handler.ts (classifyIntent, isPlanRequest regex, findTaskByTitle, the plan branch)
- lib/ai/router.ts (no-AI fast paths: keep them first and unchanged)
- lib/ai/models.ts, lib/ai/call.ts, lib/anthropic-json.ts (how structured AI calls, budgets and model tiers work)
- lib/store.ts (plans and tasks queries)
- components/PreviewCard.tsx and the composer/mic code

BUILD:

1. Intent router (lib/pipeline/intent.ts), replacing route-request.ts when the flag is on
   - Order: (a) existing no-AI fast paths from lib/ai/router.ts → (b) one small FAST-model (Haiku) call with a strict zod-validated JSON output → (c) fallback to the step-2 rule if the AI call fails or the budget blocks it.
   - Output: { intent: new_plan | add_to_plan | change_plan | add_task | change_task | complete_task | delete_task | question | clarify, confidence: 0–1, plan_mention: string|null (the words the student used for a plan, e.g. "iCF prep"), task_mention: string|null, reason: short string }.
   - Rules for the router prompt: a single dated item ("I have a test next week", "dentist friday") is add_task, never new_plan. A real question with no request to change anything is question, even if it contains words like "plan" or "schedule". Only new_plan when the student asks for a multi-step plan toward a goal.
   - Confidence below 0.6 → intent clarify: show a small card with 2–3 tap options (e.g. "Make a plan", "Just add one task", "Just talking") instead of guessing.
   - Keep the router's system prompt stable (no dates or user data in it) so prompt caching can work. Put today's date and the request in the user message. Note in a comment: Haiku 4.5 only caches prompts of 4,096+ tokens.
   - Register a new feature "intentRouter" in lib/ai/models.ts on the FAST tier, max ~200 output tokens, so it shows in ai_usage.

2. Plan matcher (lib/pipeline/match.ts), pure code, no AI, with tests
   - Input: plan_mention (from the router) + the student's active plans (id, title, aliases, updated_at).
   - Score each plan using:
     - exact or alias match (strongest)
     - normalized match: lowercase, remove spaces/dots/dashes ("iCF", "I.C.F.", "icf" all equal "icf")
     - fuzzy text similarity (trigram or Jaro-Winkler, written in the repo, no heavy dependency)
     - sound-alike match for voice ("eye see eff" → "icf"): letter-name spelling plus a small phonetic code (e.g. Double Metaphone or a simple implementation), no network
     - a small bonus for plans edited recently
   - Output: top 3 candidates with scores, plus a decision:
     - sure: top score high AND clearly ahead of number 2 → target that plan
     - unsure: middle score or two close candidates → one tap question ("ICF Prep or ICF Essay?" plus "New plan")
     - none: low scores → treat as new plan
   - Put the thresholds in one constants object with comments, so we can tune them from eval results.

3. Nicknames (aliases)
   - New migration: table plan_aliases (id, user_id, plan_id references plans on delete cascade, alias_normalized text, created_at), unique (user_id, alias_normalized), owner-only RLS, same pattern as other tables. Don't run it.
   - When a student confirms a change set whose target plan came from a match (or picks a plan in the tap question), save the words they used as an alias for that plan. Max 10 aliases per plan; skip if already there.

4. Drafting changes to an existing plan
   - For add_to_plan / change_plan with a target plan: build a ChangeSet with target_plan_id set, add_task ops carrying plan_id (not plan_ref), and update_plan if the title/notes change. No create_plan.
   - Generating the new tasks: one SMART call (new file lib/pipeline/extend-plan.ts, new feature "extendPlan" in models.ts) that receives the request, the target plan's title, and its existing tasks (title, date, done or not), and returns only the NEW tasks. It must not repeat existing tasks. Use the same date rules as the current plan generator.
   - The preview card's header says "Updating ICF Prep" (already supported). Show the existing plan's task count, e.g. "ICF Prep · 6 tasks → 8 tasks".
   - For add_task with a task-only request ("I have a test next week"), draft a single add_task as today. Don't route it to the plan generator.

5. Clarify and tap-question UI (PreviewCard or a small sibling component)
   - Clarify card: the tap options from the router. Tapping re-runs the request with the chosen intent forced.
   - Match question: "Which plan?" with up to 2 candidate titles plus "New plan". Tapping re-runs with that target forced.
   - Keep visual changes small and use existing tokens and classes. List touched files and lines for Juann.

6. Voice source tagging
   - The composer marks text that came from dictation, and that flag travels to the intake, so events and change sets record source "voice". The pen route stays unchanged.

7. Events (add to event-types.ts, structured props only, no free text)
   - intent_classified {intent, confidence_bucket: "high"|"mid"|"low", via: "fast"|"ai"|"fallback"}
   - match_proposed {decision: "sure"|"unsure"|"none", candidates: number}
   - match_confirmed {method: "auto"|"tap"}
   - match_corrected (the student picked a different plan or "New plan" than the top match)
   - clarify_shown, clarify_answered {choice}

8. Fixtures and eval
   - Add cases: aliases ("my icf thing" with alias saved), two similar plans ("ICF Prep" and "ICF Essay" → unsure), sound-alike ("eye see eff prep"), "add a study session to my SAT plan", "rename my ICF plan to ICF Finals", "I have a test next week" → add_task, "should I schedule study time?" → question, a low-confidence request → clarify.
   - Update gradeCase so target_plan is checked for add_to_plan/change_plan and must_not catches create_plan.
   - Router and matcher get unit tests that run WITHOUT the AI (mock the router output). The matcher is pure, so test it thoroughly.
   - Only run eval --check.

9. Decision record (the data for the AI Activity page, which gets built right after this step)
   - New table ai_decisions (same migration as plan_aliases): id, user_id, created_at, source ("typed"|"voice"|"palette"), request_text (the student's words, capped at 500 characters), route ("fast"|"chat"|"draft"|"clarify"), intent, confidence (nullable), via ("fast"|"ai"|"fallback"), plan_match jsonb (decision + up to 3 candidates with title and score), chosen_plan_id (nullable), change_set_id (nullable), action_id (nullable, for instant quick commands), models jsonb (which model tiers ran, e.g. ["FAST","SMART"]), outcome ("answered"|"drafted"|"confirmed"|"discarded"|"undone"|"applied_instantly"|"asked"|"failed"), updated_at.
   - RLS: students can SELECT and DELETE their own rows. Inserts and updates happen server-side only. A student deleting a log row must NOT undo or change any calendar data.
   - Write exactly one row per request that goes through the intake (flag on only), and update its outcome when the student confirms, discards, undoes, or answers a clarify/match question. Never write a row with the flag off.
   - Retention: rows older than 90 days get deleted by the existing cron pattern (or a simple cleanup on read, if there's no suitable cron). Note this in the migration comments.
   - Unit-test the outcome transitions.

RULES
- Don't change the existing plan-generation prompts or lib/ai/router.ts. The new prompts go in new files.
- Flag OFF = no new code runs (check this in the diff, and add a test that the router isn't called with the flag off).
- No secrets. Don't touch Supabase. Don't commit or push.

DONE WHEN
- npm run build and npm test pass, and eval --check passes with the new case count.
- Summary: files added/changed, the router output schema, the matcher thresholds, the new migration, the estimated extra cost per request, and the exact lines changed in ChatThread.tsx / ai/page.tsx / CommandPalette.tsx / PreviewCard.tsx for Juann.
- The new manual checks are added as section E2 in docs/tangent-pipeline-final-checks.md.
```

---

## Part 3: AI Activity page (paste after Part 2 is built, same session)

```
Step 3B: AI Activity. Goal: students (and we, while testing) can see every request the AI handled, what it decided, and what happened, in a table. Behind TANGENT_PIPELINE_V2: with the flag off, the tab and button don't appear and the routes return 404.

READ FIRST, then give me your plan before writing code:
- app/(app)/settings/page.tsx and how its sections/tabs are built today (match that pattern exactly)
- the ai_decisions table and writes from step 9, change_sets, action_records, ai_usage
- app/(app)/ai/page.tsx header ("Tangent AI" title, "Your Brief" button), components/PreviewCard.tsx, components/CommandPalette.tsx
- lib/auth/access.ts (isOwnerEmail)

BUILD:

1. Settings → new tab "AI Activity"
   - A table, newest first, 25 rows per page, with these columns:
     | When | You asked | Tangent understood | Plan | Changes | Result |
     - When: relative time ("2h ago"), with the exact time on hover
     - You asked: request_text, cut to one line, with the full text on expand. A small icon for voice.
     - Tangent understood: the intent in plain words ("New plan", "Add to a plan", "Single task", "Question", "Quick command (no AI)", "Asked you to choose"), plus a confidence dot (high/mid/low)
     - Plan: the matched plan title, or "New plan", or "—"
     - Changes: a short summary from the change set ("+3 tasks", "1 moved", "—")
     - Result: a status chip: Answered / Waiting for you / Added / Discarded / Undone / Added instantly / Failed
   - Filters at the top: Result (all, added, discarded, undone, waiting), Type (plans, tasks, questions, quick commands), date range (7 days, 30 days, 90 days). Plus a search box that searches request_text.
   - Expanding a row shows "Why Tangent did this":
     - intent + confidence + whether the AI, a quick rule or a fallback decided
     - plan match: the top candidates with plain-language strength (strong/possible/weak), and which was chosen and how (automatic or you picked)
     - questions asked and the answers
     - assumptions shown on the preview
     - the full list of changes (describeChangeSet lines), and any skipped duplicates
     - actions: "Undo" if it's still undoable (reuse the existing undo route), "Open draft" if it's waiting
   - Owner-only debug columns (only when isOwnerEmail): models used, plus tokens and estimated cost joined from ai_usage by request time and user. Never show these to students.
   - "Delete" on a row and "Clear activity" (with a confirm dialog) delete log rows only, never calendar data. Say that in the dialog: "This clears the log. Your calendar stays the same."
   - Empty state: "Nothing yet. When you ask Tangent AI to plan or change things, you'll see what it did here."
   - Mobile: under 640px the table becomes stacked cards (When + Result on top, You asked, then a one-line summary).

2. Entry points (keep the AI page uncluttered)
   - AI page header: add ONE small ghost icon button (a history/clock icon, no text label) to the left of "Your Brief", with a tooltip "AI activity" and aria-label "AI activity". It links to Settings → AI Activity. No new pill, no new row.
   - Preview card, after Confirm/Undo: add a quiet "Details" text link to the collapsed receipt ("Added to your calendar · Undo · Details") that opens that exact row expanded in AI Activity.
   - Command palette: add a command "Open AI activity".
   - Don't add anything to the hero, composer, suggestion chips or the left sidebar.

3. API
   - GET /api/ai-activity?cursor&filters, DELETE /api/ai-activity/[id], DELETE /api/ai-activity (clear all): all wrapped in withUser and limited to the user's own rows by RLS plus a user_id check. 404 when the flag is off.
   - Logged events: activity_viewed, activity_row_expanded, activity_cleared (structured props only).

4. Tests
   - API: a user can't read or delete another user's rows; 404 with the flag off; clearing doesn't touch tasks, plans or change_sets.
   - The summary helpers that turn intents/outcomes into plain words get unit tests.

RULES
- Match the existing settings styling and tokens. No new UI libraries.
- Keep AI page changes to the single icon button. List the exact changed lines in app/(app)/ai/page.tsx, app/(app)/settings/page.tsx, PreviewCard.tsx and CommandPalette.tsx for Juann.
- Don't touch Supabase, and don't commit or push.

DONE WHEN
- npm run build, npm test and eval --check pass.
- Summary of files, routes and the exact changed lines for Juann.
- New manual checks added as section E3 "AI Activity" in docs/tangent-pipeline-final-checks.md (including: owner columns hidden for a non-owner account, delete doesn't change the calendar, Details link opens the right row, mobile layout, flag off hides everything).
```
