# Tangent Pipeline V2: Final Checks

Do these **after** Prompts 0, 1 and 2 are all built. Go top to bottom.

---

## A. Database (Supabase)

1. **Check the name of the undo-kind rule.** In Supabase Dashboard → SQL Editor, run:
   ```sql
   select conname from pg_constraint
   where conrelid = 'public.action_records'::regclass and contype = 'c';
   ```
   - If it shows `action_records_kind_check`, continue.
   - If it shows another name, stop and ask Claude before running the migration.
2. **Run the migration.** Open `supabase/migrations/20261006000000_pipeline_v2_change_sets_and_events.sql`, paste all of it into a new SQL Editor query, and run it. It's safe to run twice, and it runs as one transaction (`begin; … commit;`), so if it fails nothing is left half-done.
3. **Make sure the tables exist and are empty:**
   ```sql
   select count(*) from change_sets;
   select count(*) from events;
   ```
   Both should be 0.
   Then check the lifecycle guard is installed:
   ```sql
   select tgname from pg_trigger where tgrelid = 'public.change_sets'::regclass and not tgisinternal;
   select column_name from information_schema.columns where table_name = 'change_sets' and column_name = 'applied_at';
   ```
   The first shows `change_sets_guard`, the second shows `applied_at`.
4. Run any migrations that Prompts 1 and 2 add the same way (paste each into the SQL Editor, oldest first).
5. **Prompt 3 migration.** After `20261011000000_chat_messages_undo_refs.sql` (section H step 1), paste `supabase/migrations/20261012000000_plan_aliases_and_ai_decisions.sql` into a new query and run it. It adds two empty tables (`plan_aliases`, `ai_decisions`) and the `purge_old_ai_decisions()` function. It is one transaction and safe to run twice. Without it the app still works: nicknames read as none, and decision rows are skipped with one server warning. Then check:
   ```sql
   select count(*) from plan_aliases;
   select count(*) from ai_decisions;
   select tgname from pg_trigger where tgrelid = 'public.plan_aliases'::regclass and not tgisinternal;
   ```
   Both counts are 0 and the trigger is `plan_aliases_cap`.

## B. Build and tests (on the last branch)

```
npm install
npm run build
npm test
```

All should pass.

## C. Flag OFF: the app behaves exactly as before

Make sure `.env.local` does **not** set `TANGENT_PIPELINE_V2`, then run `npm run dev` and try:

1. Typed task: "dentist tomorrow at 3pm". It should show on the calendar, and **Undo** should remove it.
2. Plan: "help me study for the SAT in 3 weeks". The plan is created as before, and **Undo** removes the plan and all its tasks.
3. Fast path: "done with math hw" (with a Math homework task present). It completes instantly, with no AI call.
4. The Plan/Calendar mode switch is still there.
5. Delete, move and clear still ask for confirmation, as before.
6. These should still be 0: `select count(*) from change_sets;` and `select count(*) from events;`

## D. Flag ON: Prompt 1 (preview → confirm → undo)

Add `TANGENT_PIPELINE_V2=true` to `.env.local` and restart `npm run dev`.

1. "help me study for the SAT in 3 weeks" shows a **preview card**, and **nothing** is on the calendar yet.
2. Click **Confirm**. All tasks appear **once**.
3. Click **Undo**. The plan and all its tasks are gone.
4. Draft again and **double-click Confirm**. There are no duplicates.
5. Draft again and click **Discard**. Nothing is added.
6. Make a plan that repeats a task you already have. The preview or result mentions the skipped duplicates.
7. "done with math hw" is still instant, with Undo.
8. Supabase: `select status, count(*) from change_sets group by status;` shows draft, confirmed, discarded and undone rows.
9. Supabase: `select type, count(*) from events group by type;` shows changeset_drafted, preview_shown, changeset_confirmed and the rest.
10. Run `npm run eval:pipeline`. It asks before spending money. Save the results table. **Expected failures for now:** the iCF cases and "I have a test next week" (Prompt 3 fixes these). Most "add to an existing plan" and "change a task" cases also fail for now, because only new plans and new tasks are drafted so far, and they carry no target plan.
11. **Eval account (once, before step 10).** Make a dedicated account with a Gmail "+eval" address, e.g. `yourname+eval@gmail.com` (mail still reaches your inbox). Add it to `ALLOWED_EMAILS`, otherwise sign-in is refused. Sign in once so its profile row exists. Find its id in Supabase (`select user_id from profiles where email like '%+eval%';`) and put `TANGENT_EVAL_USER_ID=<that id>` in `.env.local`. The eval **deletes every task and plan on that account** before each case, and refuses to run on an address without "+eval".
12. `npm run eval:pipeline -- --check` runs with no database and no AI. It validates the fixtures, prints the cost estimate and says "Check OK".
13. Quick add from the box ("add dentist tomorrow 3pm") is still **instant with Undo**, with no preview card. Supabase: `select props from events where type='request_received' order by occurred_at desc limit 5;` shows `route: fast:add, fast: true`.
14. On the preview card: **Edit** lets you remove a line (×) and change a task's date or time; the preview updates and Confirm saves the edited version. Removing a plan's last task is refused ("Discard instead").
15. Keyboard: with the card focused, **Enter** confirms and **Esc** discards.
16. The same request from the **command palette** (Ctrl+K) shows the preview card there, and Confirm / Undo work the same.
17. The **pen** (voice from the device) still writes directly, with no preview card. Drafting is only for typed requests in the app.
18. After a confirm whose tasks were all duplicates, the card says "Already on your calendar · nothing new added" and offers no Undo.
19. Flag OFF again (remove the line, restart): no preview cards anywhere, and `POST /api/changesets/<any id>/confirm` returns **404**.

## E. Flag ON: Prompt 2 (one box, no mode switch)

1. The Plan/Calendar mode switch is **gone**.
2. "help me plan ICF prep" shows a preview.
3. "what should I do for ICF?" gets a **chat answer**, with no preview.
4. Draft a plan in conversation, then click **Add plan to calendar**. The saved tasks **exactly match** what you saw, with no regeneration.
5. **Voice** and **typing** the same request give the same preview.
6. Click **"Just talking, don't add"** on a preview. It discards and replies conversationally.
7. Supabase: `select count(*) from events where type='changeset_discarded';` goes up.
8. The **Add to calendar** button under a drafted plan says "Shows what will be added before saving." Clicking it shows a card (nothing saved yet). Confirm, then check every title, date and time on the calendar against the reply.
9. If a schedule line in the reply can't be read (for example "11/01 - 3 - Review mistakes"), the card says **"Read X of Y lines"** and lists the skipped line. Nothing disappears silently.
10. "can you add dentist tomorrow?" adds or previews; it never just chats. "what's my plan for today?" and "ideas for my ICF project" chat. "should I schedule study time for the SAT?" previews.
11. Browser voice: hold the mic, say "um can you like help me plan icf prep", press Enter. You get the same preview as typing it. The pen (`/api/voice`) still saves directly, with no preview.
12. Just-talking event: `select props from events where type='changeset_discarded' order by occurred_at desc limit 1;` shows `"reason": "just_chatting"`.
13. Reload gap: make a preview, **don't** confirm, reload the AI page. The card comes back. Open the palette (Ctrl+K) on another page: the newest open card shows there too.
14. 24-hour expiry: in Supabase, set one draft's `created_at` to 25 hours ago, then reload. It doesn't come back, its status is `discarded`, and a `changeset_discarded` event has `"reason": "expired"`.
15. Flag off (`TANGENT_PIPELINE_V2=false`, restart `npm run dev`): the mode switch, the old hero text and the old dock hint are back, and "Add to calendar" switches to Calendar mode as before.

## E1. Cleanup fixes (steps 0 to 2)

One check per fix. `npm test` covers 1, 2 and 4 automatically; the rest are by hand with the flag on.

1. **Rollback if the plan link fails.** `npm test` → `apply-core.test.ts`: "if the plan's task-list update fails…" passes. It simulates the failure and checks that no plan or task is left and the change set is back to `draft`.
2. **No stray Undo after a failure.** `npm test` → "if a step after the undo entry fails…" passes: the `apply_changeset` undo entry is removed and `action_id` is null.
3. **Add to calendar keeps its button on failure.** Draft a plan in conversation. In DevTools → Network, set **Offline**, click **Add plan to calendar**: an error shows and the button stays. Go back online and click again: one card appears. Double-clicking makes only one card.
4. **"Just talking" saves one reply.** `npm test` → `components/console/turns.test.ts` passes. By hand: get a preview, click **"Just talking, don't add"**, send one more message, reload. Each request shows its own reply, and the preview summary is gone from the thread.
5. **Old drafts can't be confirmed.** Make a preview and leave the card open. In Supabase set its `created_at` to 25 hours ago (`update change_sets set created_at = now() - interval '25 hours' where id = '<id>';`). Click **Confirm** without reloading: the card says "This draft expired. Ask again for a fresh preview.", nothing is added, its status is `discarded`, and a `changeset_discarded` event has `"reason": "expired"`.
6. **Second confirm when nothing was created.** Confirm a preview whose tasks are all duplicates. `select status, applied_at, action_id from change_sets order by created_at desc limit 1;` shows `confirmed`, a time, and null. In the DevTools console run `await (await fetch('/api/changesets/<id>/confirm', {method:'POST'})).json()`. It answers right away (no 5-second wait) with `alreadyConfirmed: true` and `createdTaskCount: 0`.
7. **Events always land.** Note `select count(*) from events;`, then do one preview → Confirm → Undo. The count goes up by at least 4 (request_received, changeset_drafted, changeset_confirmed, changeset_undone). After deploying a Vercel preview with the flag on, repeat it there: the same events appear.
8. **The database refuses backward moves.** In the SQL Editor (triggers apply to every role, so this is the same check the REST API gets):
   ```sql
   begin;
   update change_sets set status = 'draft' where id = (select id from change_sets where status = 'confirmed' and applied_at is not null limit 1);
   rollback;
   ```
   It fails with `confirmed → draft is not allowed`. The same for `discarded → draft`, and for editing `ops` on a confirmed row ("only a draft can be edited").

## E2. Prompt 3 (router and plan matcher)

Flag **on**, migration from section A step 5 run. `npm test` covers the router, matcher, question answers and titles without the AI (`lib/pipeline/intent.test.ts`, `match.test.ts`, `fixtures.test.ts`, `lib/pending-question.test.ts`), including "the router is never called with the flag off".

1. **Add to an existing plan.** With an "ICF Prep" plan, type "add 2 more checkpoints to my iCF prep". The card header says **"Updating ICF Prep · N tasks → N+2 tasks"**, lists only the 2 new tasks, and notes any day or time the spacing chose. Confirm: they appear inside ICF Prep, and no second ICF plan exists. Undo removes only those 2.
2. **Voice spelling.** Hold the mic and say "add a checkpoint to my eye see eff prep". The same "Updating ICF Prep" card appears.
3. **Not sure which plan.** With "ICF Prep" and "ICF Essay", type "add a checkpoint to my ICF stuff". It asks **"Which plan?"** with ICF Prep, ICF Essay, New plan and Cancel. Tap ICF Essay: the card says "Updating ICF Essay".
4. **Nicknames.** After step 3, type "add another checkpoint to my ICF stuff" again: it goes straight to ICF Essay (the tap was saved). Supabase: `select alias_normalized from plan_aliases;` shows the saved words. A plan keeps at most 10.
5. **SAT is not Saturday.** With "SAT Prep" and "Saturday Chores", "add a study session to my SAT plan" updates SAT Prep only.
6. **Rename.** "rename my ICF plan to ICF Finals" shows a one-line card that renames, with no new tasks and no new plan.
7. **Single dated item.** "I have a test next week" adds one task (no plan).
8. **Questions stay questions.** "should I schedule study time?" and "what should I do for ICF?" get a chat answer and no card.
9. **Projects and Tangents.** "start a project to build my robotics portfolio website" drafts a new plan (a Project). "I want to get into MIT someday" goes to Tangents, and nothing is drafted.
10. **Low confidence.** "prep stuff" asks **"What did you mean?"** with **Make a plan**, **Just add one task** and **Just talking**. Each tap does what it says, and Just talking adds nothing.
11. **Palette and dock.** The same "Which plan?" / "What did you mean?" question from Ctrl+K or the capture dock opens the AI page, which asks it there with buttons.
12. **Events.** `select type, count(*) from events where type in ('intent_classified','match_proposed','match_confirmed','match_corrected','clarify_shown','clarify_answered','pending_question_resolved') group by type;` shows rows after steps 1 to 10. `select props from events where type = 'intent_classified' order by occurred_at desc limit 5;` shows only intent, confidence bucket, via and, when the AI was skipped, fallback (no request text).
13. **Router down.** Temporarily set a wrong Anthropic key in `.env.local` and restart. "help me plan ICF prep" still gives a preview (the old rules take over), and "done with math hw" is still instant. Put the key back.

## E3. AI Activity

Flag **on**, migration from section A step 5 run, and a few requests made in section E2 first. `npm test` covers own rows only, 404 with the flag off, clearing that never touches tasks, plans, projects or change_sets, and the plain words (`lib/ai-activity.test.ts`, `lib/pipeline/activity.test.ts`).

1. **Find it.** Settings has an **AI Activity** tab after What Tangent knows, and each section links to the other. On the AI page, the clock icon left of **Your Brief** (tooltip "AI activity") opens it. Ctrl+K → **Open AI activity** does the same.
2. **The table.** Newest first, 25 rows a page. Each row shows When, You asked, Tangent understood (plain words plus a green, amber or red confidence dot), Plan, Changes and a Result chip. "add 2 more checkpoints to my ICF prep", once confirmed, reads **Add to a plan · ICF Prep · 2 · Added**. A "Which plan?" left unanswered reads **Asked you to choose · Waiting for you**.
3. **Why Tangent did this.** Click a request. It shows intent, confidence and who decided; the plans it considered (Strong/Possible/Weak) and which was chosen and how; the question and your answer; the assumptions (days or times the spacing chose); every change; and "Skipped N already on your calendar" when duplicates were dropped. **Undo** appears only while it still works, and **Open draft** only while the card waits for Confirm.
4. **Filters.** Result, Type, 7/30/90 days and search each narrow the table. A filter with no matches says "Nothing matches these filters."
5. **Owner columns are hidden for a non-owner.** Signed in as the account in `OWNER_EMAIL`, the table also has Models, Tokens and Est. cost (an estimate: ai_usage has no request id, so calls are matched by time). Sign in as any other student: those three columns are gone, and the `/api/ai-activity` response has no `usage` field.
6. **Delete keeps the calendar.** Note your task count, then **Delete from log** on one row, and **Clear activity** (it asks "This clears the log. Your calendar stays the same."). The rows go, and every task, plan and project is still there. Supabase: `select count(*) from ai_decisions where user_id = '<you>';` is 0, and `change_sets` still has your rows.
7. **Details opens the right row.** After confirming a preview card, its collapsed receipt has **Details**: it opens Settings at that row, expanded and scrolled into view, even on page 2. In Ctrl+K → **Undo recent change**, entries made by Tangent AI have **Details** too, and manual changes don't.
8. **Mobile layout.** Under 640px wide each row becomes a stacked card (labels on the left, values on the right), the filters wrap, and nothing scrolls sideways.
9. **Empty state.** A new student (or after Clear activity) sees "Nothing yet. When you ask Tangent AI to plan or change things, you'll see what it did here."
10. **Flag off hides everything.** Set `TANGENT_PIPELINE_V2=false` and restart. Settings has no AI Activity tab or link, the AI page has no clock icon, Ctrl+K has no Open AI activity, Recent changes has no Details, and `/api/ai-activity` answers **404** (GET, POST and DELETE, and `/api/ai-activity/<id>`).
11. **Events.** `select type, props from events where type like 'activity_%' order by occurred_at desc limit 10;` shows `activity_viewed` (rows, owner, focus), `activity_row_expanded` (from table or details_link) and `activity_cleared` (rows, scope row or all). There is no request text.

## F. Save and ship (in this order)

1. Commit each branch, if not done already (no `.env.local` in `git status`!).
2. Push the branches and open the PRs on GitHub. Merge in order: **0 → 1 → 2**.
3. Make sure the database migrations from section A have been run **before** merging.
4. Keep `TANGENT_PIPELINE_V2` **off in Vercel**. Only turn it on there after you and Juann have each tried 10 real brain-dumps locally.
5. On the live site, check a quick task and Undo.

## G. Known gaps (to fix later)

- With the flag on, **recurring tasks** ("gym every Monday") and **Gmail / Canvas imports** still write straight to the calendar, with no preview card.
- The **calendar day chat** shows "Which plan?" / "What did you mean?" as text, without the tap buttons. Typed answers still work.
- A clarify answer sent from the **palette or dock** is classified again on the AI page (one extra router call), and the palette's decision row stays "asked".
- Consolidate the **ai_usage/cron admin uses** behind one helper, as the pipeline's `ai_decisions` writes already are (`decisionsAdmin` in `lib/store.ts`). Today `ai_usage` inserts (`lib/ai/call.ts`), `lib/cron-users.ts` and `runAsUser` (`lib/request-context.ts`) each call `createAdminClient()` directly. All three are server-only.

## H. Safety hotfix

Fixes 1 to 3 apply with the flag **on and off**, so do steps 3 to 9 twice: once without `TANGENT_PIPELINE_V2`, once with `TANGENT_PIPELINE_V2=true`. Restart `npm run dev` after changing the flag, because it is read only when the server starts.

1. **Migration (optional but recommended).** Paste `supabase/migrations/20261011000000_chat_messages_undo_refs.sql` into the SQL Editor and run it. It adds two empty columns to `chat_messages` and is safe to run twice. Without it, everything still works except that Undo on a reopened chat doesn't come back (the server logs one warning naming this migration).
2. **Automated.** `npm test` passes, including `lib/delete-scope.test.ts`, `lib/quick-add.test.ts`, `lib/undo-events.test.ts` and the "ready-to-add" test in `lib/pipeline/plan-text.test.ts`. `npm run eval:pipeline -- --check` passes.
3. **Scoped delete.** With an SAT plan and other tasks on the calendar, type "Actually, nevermind I dont want the SAT tasks. Take out all of the SAT tasks". It shows the count and up to 5 titles, all SAT tasks, and nothing is deleted yet (flag on: a preview card of deletes; flag off: Confirm / Cancel). Confirm: only the SAT tasks are gone. Undo brings them back.
4. **Nothing matches.** With no SAT tasks, "delete the SAT stuff" asks which tasks you mean. Nothing is deleted.
5. **Full clear needs the explicit phrase.** "delete all the tasks" or "get rid of the stuff" asks which tasks you mean. "clear my schedule" or "delete everything" shows "Clear all N tasks…" with up to 5 titles and waits for Confirm. Cancel leaves everything.
6. **Undo after leaving the page.** Add a task in the AI console, go to Calendar within 8 seconds: an Undo toast is there. Click it: the task is gone.
7. **Undo after reopening a chat** (needs step 1). Add a task in the AI console, reload the page: its Undo is still in the thread. Undo it, reload again: it says "Undone". For a change older than the newest 50, it says "Can't undo anymore".
8. **Recent changes.** On Calendar, click the ↶ button next to the arrows, or press Ctrl+K and choose "Undo recent change". Up to 10 changes appear, newest first, each with a time and Undo. Undo one: the calendar updates. Sign in as a second account: none of the first account's changes appear.
9. **Quick-add titles.** "I have a dentists appointment" adds an untimed task called "Dentists appointment" (no 9:00 PM). "dentist tomorrow at 3pm" still lands at 3:00 PM.
10. **Just talking (flag on only).** Ask "help me plan for the SAT". It asks one short question at a time. Once a reply lists a full schedule, it shows "Ready to add this to your calendar?" with **Yes, show preview** (opens the preview card; nothing is saved until Confirm) and **Keep talking** (hides the row). A reply that ends with a question shows no row.

## I. Known to-dos (not bugs)

- The iCF duplicate and "test next week" are fixed by **Prompt 3** in the mocked tests. Confirm them with the real `npm run eval:pipeline` (it asks before spending money).
- Your local `main` is behind GitHub. Run `git checkout main && git pull` at the end. Close VS Code and File Explorer first to avoid the folder lock.
- `npm audit` shows 3 vulnerabilities. Look at them separately and **don't** run `npm audit fix --force` blindly.

## J. Testing fixes (Prompt 3, part A)

Fixes 1 to 3 apply with the flag **on and off**, so do them twice (restart `npm run dev` after changing `TANGENT_PIPELINE_V2`). Fixes 4 to 6 are flag **on** only. `npm test` covers the automated parts: `lib/pending-question.test.ts`, `lib/quick-add.test.ts`, `lib/delete-scope.test.ts`, `components/console/talking.test.ts`, `lib/pipeline/apply-core.test.ts` and `lib/pipeline/fixtures.test.ts`.

1. **The real transcript.** Make two plans whose titles contain SAT, e.g. "SAT Writing Skills Sprint" and "SAT Math Mastery Plan". Type "Take out all of my SAT tasks". It asks which one, with a button per plan, **All of these** and **Cancel**. Then try each reply below on a fresh ask:
   - "the writing stuff" or "the SAT writing skills sprint one" → the delete preview (count + titles) for the Writing plan only.
   - "all of them" or a tap on All of these → the delete preview for both plans.
   - "my SAT tasks" → it asks once more, with the buttons. It **never** lists your calendars.
   - "never mind" → nothing is deleted.
   - "add bio homework tomorrow at 5pm" → the question is dropped and the task is handled as a new request.
   - No reply ever creates a plan. After 10 minutes the question expires and replies are handled as new requests.
2. **Remove the plan too.** Delete every task of one plan. Flag on: the card has **"Also remove the plan …"**, ticked. Confirm: the plan is gone. Undo: the plan and all its tasks come back, linked. Untick it: only the tasks go. Flag off: the confirmation text says "This also removes the plan …". Same with a Project.
3. **Clean titles everywhere.** "I have a soccer coaching appointment coming up tomorrow 10pm" → "Soccer coaching appointment", tomorrow at 10:00 PM. "don't forget to return library books on friday" → "Return library books". "Add math notes to binder" stays as typed. Check instant capture, the AI console, a plan's steps and a project's steps.
4. **Just talking → ready.** Ask "help me plan for the SAT", get a preview, click **"Just talking, don't add"**. Tangent keeps asking one short question at a time. Answer until a reply lists a full schedule: **"Ready to add this to your calendar?"** shows with **Yes, show preview** and **Keep talking**. A small **Add plan to calendar** chip stays on the newest full schedule until it is added or discarded.
5. **Undo is careful.** Rename a plan with a preview and confirm. Rename it again by hand, then Undo the first change: your hand rename stays. Undo only reverts fields that still hold the value it set.
6. **Projects preview.** In a Project's chat or **Ask** box, ask for new steps. A card (or a compact Confirm / Discard row) shows first, and nothing is saved until Confirm. Undo removes only the new steps.

## K. Master fix

Flag-on items are marked **(on)**; everything else applies with the flag on and off. No new migrations, so section A is unchanged. `npm test`, `npm run build` and `npm run eval:pipeline -- --check` cover the automated parts (59 fixtures).

**Models (Phase 1)**

1. **Model line.** `npm run eval:pipeline -- --check` prints `Models: FAST claude-haiku-5-5, SMART claude-sonnet-5-5` and a per-request line of about $0.0008 a command and $0.0138 a new plan.
2. **Fallback.** Set `AI_MODEL_FAST=claude-haiku-9-9` in `.env.local`, restart, add a task by voice or text: it still works (one 404, then `claude-haiku-4-5`). Remove the line afterwards.

**Sign-in (Phase 1B)**

3. **Code sign-in.** Enter an invited email: "Check your email" shows six boxes. Type the 6-digit code from the email: it signs in without pressing a button.
4. **Resend.** The button reads "Resend code in Ns" and unlocks at 60s. After a resend, "New code sent. Older codes no longer work." and the first code is refused.
5. **Not invited.** An email outside `ALLOWED_EMAILS` gets the "isn't invited" message and no email is sent.
6. **Slow link.** Open the email link with the network throttled to offline after the page loads: "Signing you in…" turns into "Tangent didn't hear back in time…" after 10 seconds, with **Try again** and **Use a code instead**.
7. **Alias email.** A `name+test@…` address that is on the invite list signs in (by code and by link).
8. **Right site.** On a Vercel preview URL, the email link returns to that same preview, not localhost or production.
9. **Google.** From `/calendar` while signed out, **Continue with Google** returns you to `/calendar`. Sign out from Settings lands on `/signin` with no stale chat in the console.

**Every AI write previews (B1, on)**

10. **All of these.** Two SAT plans, "take out all my SAT tasks", tap **All of these**: a delete preview opens. Nothing is gone until Confirm.
11. **Answered plan.** "Help me prepare for ISEF", answer the card: a full plan preview, never a straight save.
12. **Other doors.** Each of these opens a preview first, and Undo works after Confirm: a project typed in the main box, a voice request that makes a task, a capture from the dock and the command palette, "gym every Monday and Wednesday at 6".

**Questions and deletes (B2 to B7, on)**

13. **One message.** Send any request once: one user bubble and one reply, even after a slow reply or a page refocus.
14. **Question card everywhere.** A question asked from the dock, the palette or voice shows the same card (buttons, **Other…**, **Cancel**) on the AI page, never bullet text.
15. **After answers.** Answering a card's questions opens the full preview (count, titles, weeks), not a short summary.
16. **Typos and the closest plan.** Plans "SAT Reading Score Boost" and "SAT Math Geometry Sprint". Type "deltet my writing stuff for sat": it reads it as delete and offers **Delete SAT Reading Score Boost**, **Pick another**, **Cancel**. **Pick another** shows the full list. It never says "couldn't tell" twice in a row.
17. **Multi-select.** Three plans, a delete that matches them all: tick two chips, the button reads **Delete selected (2)**, the preview lists only those two plans' tasks. **All of these** takes all three.

**Plan briefs (Phase 3, on)**

18. **Competition.** "Help me prepare for ISEF": a card with at most 5 questions (deadline, where you are, category…), each with buttons.
19. **Silly goal.** "fight Mike Tyson in 2 weeks": one light question. **Just do it** gives a safe fundamentals plan whose assumptions include the safety line.
20. **Enough context.** "Plan my AP Bio exam on May 12, I'm at a 3, 45 minutes a day": no questions, straight to the preview.

**Chat (Phase 4)**

21. **Streaming and Stop.** A long reply streams in under "Tangent is typing". Send turns into Stop; Esc stops it and the bubble shows "Stopped".
22. **Markdown.** Ask for a study tip list: bold, lists and links render; no raw `**` or `-`.
23. **Reply actions.** On a reply: **Copy** copies it, **Retry** re-asks, **Edit your message** puts your text back in the box, **Good reply** / **Bad reply** highlight.
24. **Jump to latest.** Scroll up during a long reply: a **Jump to latest** pill appears and takes you down.
25. **Receipt row (on).** After Confirm, the receipt shows **Undo · Open project · Details**. A preview with many sessions shows **See all N sessions** / **Show less**.
26. **Titles.** A new chat starting "Could you make me a plan for the AP Bio exam?" is titled "AP Bio exam" in the sidebar, not the first words.
27. **New topic.** After two ISEF messages, send "make me a plan to learn guitar chords": **Start new chat** / **Keep here** chips show. A follow-up about ISEF shows none.
28. **Empty state and keys.** A new chat shows "Ask, add, or plan anything. You'll always see what changes." Enter sends, Shift+Enter adds a line, Esc stops a reply.

**Calendar (Phase 5)**

29. **Tooltip.** Hover or focus a task in week, month and the day panel: title, time, the project's color dot, and **School** or **No school**. Nothing on touch.
30. **Busy days.** A month day with 6 tasks shows 3 (4 on a wide screen) plus **+N more**, which opens that day.
31. **Remove on a busy day.** In the day panel of a day with 2+ tasks, **Remove** asks "Remove which tasks?" with chips and **Delete selected**. A day with one task removes it straight away as before.

## L. Sign-in

Optional password next to the email code. No new migrations, so section A is unchanged. The "has a password" flag lives in Supabase `app_metadata.password_set`, written by the server with the service-role key. `npm test` covers the rules in `lib/auth-password.test.ts`: the invite list on every path, the wrong-password reply, skip, forgot, the limiter and the password rules.

**Supabase settings to change by hand (Dashboard → your project)**

- **Authentication → Sign In / Providers → Email**
  - **Enable Email provider:** on.
  - **Confirm email:** on.
  - **Secure password change:** on. This works with Tangent because every password save comes straight after a fresh sign-in: the current password, a new code, or the code that just signed you in.
  - **Secure email change:** leave on.
  - **Minimum password length:** `8`.
  - **Password requirements:** "No required characters". Tangent applies its own rules: 8+ characters, not one of the 20 most common passwords, not your email. A stricter setting here would reject passwords the strength hint called fine.
  - **Prevent use of leaked passwords:** on, if your plan shows the toggle (Pro and up). On the Free plan it is greyed out; skip it.
  - **Email OTP length:** keep `6`. The code boxes expect 6 digits.
- **Authentication → Sign In / Providers → User Signups → Allow new users to sign up:** keep on. Email codes create the account for invited emails; the invite list still blocks everyone else.
- **Authentication → Attack Protection → CAPTCHA protection:** keep off. With it on, password sign-in fails without a captcha token.
- **Authentication → Rate Limits:** leave the defaults. Tangent adds its own limit of 5 failed passwords per email and per IP every 15 minutes, in memory on each server instance; Supabase's per-IP sign-in limit sits behind it.
- **Authentication → Emails → Magic Link template:** must still contain `{{ .Token }}`. Forgot-password uses this same code email; the "Reset password" template isn't used.
- **Vercel → Settings → Environment Variables:** `SUPABASE_SERVICE_ROLE_KEY` must be set for Production and Preview. Without it:
  - Sign-in still works.
  - The "doesn't have a password yet" message falls back to "Wrong email or password".
  - Settings always asks for an email code.

**Checks**

1. **Tabs.** `/signin` shows **Continue with Google**, then the **Password** and **Email code** tabs. Pick Password and reload: Password is still selected. A full sign-out keeps the choice. Left and right arrow keys switch tabs.
2. **Not invited.** On either tab, an email outside `ALLOWED_EMAILS` gets "This email isn't invited yet…". No email is sent, and the Supabase Auth logs show no sign-in attempt.
3. **New account.** Use an invited email that has never signed in, on the **Email code** tab, and enter the code.
   - **Create a password** shows password + confirm, **Show/Hide**, a strength hint, and **Skip, I'll use email codes**.
   - Save: you land on the page you came from.
   - Sign out, then sign in on the **Password** tab with that password.
4. **Skip.** Do step 3 with another new invited email and tap **Skip**: you're signed in. Sign out, then try the **Password** tab with any password: "This account doesn't have a password yet. Use an email code, then set one in Settings." with **Use an email code instead**.
5. **Wrong password.** For an account with a password, a wrong one says "Wrong email or password." An invited email with no account gives the same reply as an account without a password (check 4), so nothing tells you whether the account exists.
6. **Too many tries.** Five wrong passwords for one email.
   - The sixth try, even with the right password, says "Too many tries. Use an email code, or wait 15 minutes and try again." with **Use an email code instead**.
   - The email code still signs in.
7. **Forgot password.** **Password** tab: type the email, then **Forgot password?**.
   - The code goes to the email. Enter it.
   - **Set a new password**, then **Save and continue**: you're signed in.
   - Sign out: the new password works and the old one says "Wrong email or password."
8. **Rules.** In any new-password form:
   - `short`, `password1` and your own email (or the part before @) are refused, each with a reason.
   - Different confirm text shows "The two passwords don't match."
   - The hint moves from Weak to Okay to Strong as the password gets longer and mixes characters.
9. **Settings → Security, no password yet.** **Set a password**, then **Email me a code**. Enter the code plus a new password, then **Save password**: "Password set." The Password tab now works.
10. **Settings → Security, change.** **Change password**: a wrong current password says "Your current password isn't right."; the right one says "Password changed." **Forgot it? Use an email code instead** switches the form to the code path.
11. **Sign out everywhere.** Sign in from two browsers. In one, **Settings → Security → Sign out everywhere** and confirm: it lands on `/signin`. The other browser is sent to `/signin` on its next page load. At worst this takes up to the access-token lifetime (1 hour by default).
12. **Keyboard and screen reader.**
    - Tab moves through every field with a visible focus ring.
    - Enter submits each form.
    - Labels are read out, and the toggle reads "Show password" / "Hide password".
    - The browser offers to save the password after **Create a password**, and fills it on the **Password** tab.
13. **Google.** **Continue with Google** works exactly as before (section K, check 9).
14. **No passwords in logs.** After checks 3 to 10, Vercel's function logs show lines like `[auth/password] sign-in failed: invalid_credentials`, never a password.
