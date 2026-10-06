# Tangent: Pipeline V2, Prompts 0–2

Paste these into Claude Code **one at a time**, in order. Each one gets its own branch and PR. Test it, merge it, then start the next.

Before Prompt 0, run: `git checkout main && git pull && npm install && npm run build`

---

## Prompt 0: Foundation (change sets, events, test runner)

```
We're starting "Pipeline V2" for Tangent: a redesign of how a request (typed or spoken) becomes calendar changes. This is step 0 of 3. It only builds foundations. The app must look and behave EXACTLY the same when you're done.

Branch: create `pipeline-v2/0-foundation` from main.

READ FIRST, then give me your plan before writing code:
- AGENTS.md, CONTEXT.md
- lib/voice-handler.ts (especially handleVoiceTextInner, how plans and tasks get created)
- lib/store.ts (addTask, addPlanWithTasks, updateTask, deleteTask, recordAction, undoAction, addPendingConfirmation)
- app/api/confirm/route.ts, app/api/actions/route.ts
- lib/types.ts, lib/ai/models.ts, lib/ai/call.ts
- supabase/migrations/ (follow the existing naming and RLS patterns)

BUILD THREE THINGS:

1. The ChangeSet format (lib/pipeline/changeset.ts)
   - A typed, zod-validated "list of proposed changes" that the AI will produce later instead of writing to the database directly.
   - Operations: create_plan, update_plan, add_task, update_task, move_task, complete_task, delete_task. Each op carries only the fields it needs (plan_id/task_id, title, date, time, calendarId, notes, kind).
   - A ChangeSet has: id (uuid, also used as the idempotency key), user_id, source ("typed" | "voice"), request_text, summary (one short human sentence), target_plan_id (nullable), ops[], assumptions[] (short strings shown to the student), status ("draft" | "confirmed" | "discarded" | "undone"), created_at, confirmed_at.
   - A pure function `describeChangeSet(cs)` that returns preview lines like "Add 'Draft ICF essay' · Wed 4:00 PM". No AI.
   - A function `applyChangeSet(cs)` that applies all ops using the EXISTING store functions, in one go, and records ONE undo entry (via recordAction) that can reverse the whole batch. It must refuse to apply a ChangeSet that is already confirmed (no double-saves).
   - Do NOT wire this into any route yet.

2. Storage + event logging (one new Supabase migration)
   - Table `change_sets`: columns matching the type above, ops and assumptions as jsonb. Owner-only RLS, same pattern as other tables.
   - Table `events`: id, user_id, type (text), change_set_id (nullable), plan_id (nullable), task_id (nullable), props (jsonb, small structured facts only, NO free text from students), occurred_at. Owner-only RLS. Indexes on (user_id, occurred_at) and (type, occurred_at).
   - lib/pipeline/events.ts: `logEvent(type, props)`. Fire-and-forget, never throws, never blocks a request.
   - Event types to support now: request_received, changeset_drafted, preview_shown, changeset_confirmed, changeset_discarded, changeset_undone, preview_edited.
   - Store helpers in lib/store.ts: saveChangeSet, getChangeSet, markChangeSet(status).

3. Test runner for the pipeline (scripts + test file)
   - A fixtures file `lib/pipeline/fixtures/requests.json` with 30 starter cases. Each: id, text, source (typed/voice), seeded state (existing plans/tasks, can be empty), and expected { intent, target_plan (title or "NEW" or null), min_ops, max_ops, must_not (e.g. "create_plan") }.
     Include these on purpose:
     - "add 2 checkpoints to my iCF prep before friday" with an existing plan "ICF Prep" → must NOT create a new plan
     - the same thing as voice text: "add two checkpoints to my eye see eff prep"
     - "I have a test next week" → single task, NOT a 7-day plan
     - "done with math hw" → complete_task (code fast path, no AI)
     - "help me study for the SAT in 3 weeks" → new plan
     - "what should I do for my ICF project?" → question / chat, zero ops
     - 2 ambiguous cases where the right answer is "ask the student"
   - A pure grading function `gradeCase(expected, changeSet)` with unit tests.
   - Unit tests for describeChangeSet and the changeset zod schema.
   - Make sure `npm test` actually runs these (check the Node version and fix the test script if .ts tests need a flag or tsx). Don't add heavy test frameworks.
   - The full "run every fixture through the real pipeline" script comes in Prompt 1. For now just the fixtures, the grader, and unit tests.

FEATURE FLAG
- Add `TANGENT_PIPELINE_V2` (default off) in one place (lib/pipeline/flags.ts). Nothing reads it yet besides an export.

RULES
- Don't change any existing behavior, UI, or route responses.
- Don't touch the AI prompts or models.
- No secrets in code. Add the flag to .env.example only.
- Keep the existing no-AI fast paths in lib/ai/router.ts untouched.

DONE WHEN
- `npm run build` and `npm test` pass.
- The migration applies cleanly (tell me the exact command to run it against Supabase, don't run it against production yourself).
- Give me a short summary: files added, the ChangeSet type, and 3 manual checks I can do to confirm nothing changed in the app.
```

---

## Prompt 1: Action pipeline (draft → preview → confirm → undo)

```
Pipeline V2, step 1 of 3. Prompt 0 is merged: we have lib/pipeline/changeset.ts (ChangeSet type, describeChangeSet, applyChangeSet), the change_sets and events tables, logEvent, fixtures and a grader, and the TANGENT_PIPELINE_V2 flag.

Goal: when the flag is ON, nothing the AI creates is saved until the student taps Confirm. When the flag is OFF, the app behaves exactly as today.

Branch: `pipeline-v2/1-action` from main.

READ FIRST, then give me your plan before writing code:
- lib/pipeline/* (what Prompt 0 built)
- lib/voice-handler.ts: handleVoiceTextInner, the plan branch (generatePlan → addPlanWithTasks), the single-task branches, and where recordAction is called
- app/api/chat/route.ts (calendarReply, the streamed {type:"plan_outline"|"plan_task"|"result"} lines)
- app/api/voice-browser/route.ts
- app/api/confirm/route.ts and addPendingConfirmation (existing confirm flow for delete/move/clear; reuse its ideas, don't break it)
- app/(app)/ai/page.tsx and components/console/* (how results and plan progress render)

BUILD:

1. Draft instead of write (server)
   - Behind the flag, the plan branch and the AI single-task branches in handleVoiceTextInner build a ChangeSet instead of calling addPlanWithTasks/addTask directly. Save it with status "draft", log changeset_drafted, and return it in the result: { type:"result", changeSet: {...}, preview: describeChangeSet(...) }.
   - Keep the streaming of plan_outline / plan_task so the student still sees the plan forming.
   - Code-only fast paths (complete / uncomplete / reschedule / due from lib/ai/router.ts) stay instant with undo, same as today. These are small, obvious and reversible. Log them as events.
   - Existing confirmations for delete / move / clear keep working.

2. Confirm, discard, undo (API)
   - POST /api/changesets/[id]/confirm: loads the draft, checks it belongs to the user and is still "draft", runs applyChangeSet, marks it "confirmed", logs changeset_confirmed. Calling it twice must NOT save twice (return the first result).
   - POST /api/changesets/[id]/discard: marks "discarded", logs the event.
   - POST /api/changesets/[id]/undo: reverses the whole batch through the single undo record, marks "undone".
   - Optional, only if small: PATCH /api/changesets/[id] to remove an op or change a task's date/time before confirming. Log preview_edited with which op changed (no free text).

3. Preview card (UI)
   - When a result has a changeSet, show a preview card in the chat and in the command palette:
     - Title line: summary, plus "Updating <plan title>" or "New plan: <title>"
     - One line per op from describeChangeSet
     - Assumptions as small grey lines, if any
     - Buttons: Confirm (primary), Edit (only if PATCH exists), Discard
   - After Confirm: the card collapses to "Added to your calendar · Undo". Log preview_shown when it renders.
   - Use the existing design tokens and components. Match the current look. Keyboard: Enter confirms, Esc discards, when the card is focused.

4. End-to-end test script
   - `npm run eval:pipeline` runs every fixture through the real pipeline with the flag on (calls the real AI, so print the estimated cost before running and ask for "y"), grades each with gradeCase, and prints a table: case, pass/fail, intent, target plan, op count, and the reason for any fail.
   - Expect the iCF and "test next week" cases to FAIL for now. Those get fixed in Prompt 3. Just report them.

RULES
- Flag OFF = zero behavior change. Check this explicitly.
- Don't change models or prompts, only where the output goes.
- No secrets in code. Don't run migrations against production.

DONE WHEN
- `npm run build` and `npm test` pass.
- With the flag ON: "help me study for the SAT in 3 weeks" shows a preview, nothing appears on the calendar until Confirm, Confirm adds everything once, Undo removes all of it.
- Double-clicking Confirm doesn't create duplicates.
- With the flag OFF, everything works like before.
- Tell me the eval:pipeline results table and the manual test steps.
```

---

## Prompt 2: Intake (one box, no Plan/Calendar switch)

```
Pipeline V2, step 2 of 3. Prompts 0 and 1 are merged: AI-created changes are now ChangeSets that show a preview and only save on Confirm (behind TANGENT_PIPELINE_V2).

Goal: with the flag ON, remove the Plan / Calendar mode switch. The student uses one box, typed or voice. The preview's Confirm button replaces the job the Calendar mode used to do.

WHY (keep this reasoning in mind when making choices):
- Today Plan mode = "talk, change nothing" and Calendar mode = "write to my calendar". Students have to understand the app's internals before asking anything.
- "Add plan to calendar" (app/(app)/ai/page.tsx, it sends "Add this plan to my calendar" in calendar mode) makes the AI generate the plan AGAIN. So what lands on the calendar can differ from the plan the student agreed to. That's a real bug.
- Since Prompt 1, nothing is written without Confirm, so the protection the mode switch gave is now provided by the preview, at the moment the student can actually judge it.

Branch: `pipeline-v2/2-intake` from main.

READ FIRST, then give me your plan before writing code:
- components/console/ModeSwitch.tsx and every place that uses the mode
- app/(app)/ai/page.tsx (send(), the "Add plan to calendar" button)
- app/api/chat/route.ts (planReply vs calendarReply, conversationContext)
- app/api/voice-browser/route.ts and the command palette
- lib/pipeline/* and the preview card from Prompt 1

BUILD (all behind the flag; flag OFF = today's behavior):

1. One path
   - Hide ModeSwitch. Every message goes to one handler, typed or voice, same function, same result shape.
   - Temporary routing rule until the real intent router in Prompt 3:
     - Code fast paths (complete / move / etc.) → act now with Undo, as today
     - Clear questions or brainstorming with no action words → chat reply, no ChangeSet
     - Anything that would create or change tasks/plans → draft a ChangeSet and show the preview
     - When unsure → draft and preview. A preview the student discards is cheap; a silent wrong write is not.
   - Put this rule in ONE small function (lib/pipeline/route-request.ts) with a clear TODO saying Prompt 3 replaces it.

2. Reuse the plan the student saw
   - Remove the regenerate step. When a plan was drafted in conversation, "Add plan to calendar" must confirm THAT ChangeSet (or turn the drafted plan into one), not send "Add this plan to my calendar" back to the AI.
   - Test: the tasks saved must exactly match the tasks shown.

3. "Just chatting" escape
   - On the preview card, add a small "Just talking, don't add" chip that discards the ChangeSet and replies conversationally. Log it as changeset_discarded with props {reason:"just_chatting"}. This tells us how often the temporary rule guesses wrong.

4. Voice parity
   - Voice uses the same handler and shows the same preview. Add 3 voice-style fixtures (lowercase, no punctuation, filler words like "um") to requests.json.

RULES
- Don't delete ModeSwitch or the old routes yet. Hide them behind the flag so we can switch back instantly.
- Juann may be editing UI. Keep changes to the console components minimal and tell me exactly which files you touched.
- No model or prompt changes.

DONE WHEN
- `npm run build`, `npm test` and `npm run eval:pipeline` run (report the table; iCF and "test next week" may still fail until Prompt 3).
- Flag ON: no mode switch. "help me plan ICF prep" shows a preview. "what should I do for ICF?" gets a chat answer. "Add plan to calendar" saves exactly the drafted tasks.
- Typing and speaking the same request give the same preview.
- Flag OFF: identical to today.
- Give me the list of touched files and manual test steps.
```

---

## After all three

1. Turn `TANGENT_PIPELINE_V2` on **locally only**. Try 10 real brain-dumps yourself, and have Juann do the same.
2. Look at the `events` table: how often "Just talking" gets tapped and how often previews are discarded.
3. Then move on to Prompt 3 (intent router + plan matcher). That's the one that fixes the iCF duplicate.
