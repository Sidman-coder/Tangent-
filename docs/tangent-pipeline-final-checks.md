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

## E2. Cleanup fixes (steps 0 to 2)

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

## F. Save and ship (in this order)

1. Commit each branch, if not done already (no `.env.local` in `git status`!).
2. Push the branches and open the PRs on GitHub. Merge in order: **0 → 1 → 2**.
3. Make sure the database migrations from section A have been run **before** merging.
4. Keep `TANGENT_PIPELINE_V2` **off in Vercel**. Only turn it on there after you and Juann have each tried 10 real brain-dumps locally.
5. On the live site, check a quick task and Undo.

## G. Known gaps (to fix later)

- With the flag on, **recurring tasks** ("gym every Monday") and **Gmail / Canvas imports** still write straight to the calendar, with no preview card.

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

- The iCF duplicate and "test next week" fail until **Prompt 3** (router + plan matcher).
- Your local `main` is behind GitHub. Run `git checkout main && git pull` at the end. Close VS Code and File Explorer first to avoid the folder lock.
- `npm audit` shows 3 vulnerabilities. Look at them separately and **don't** run `npm audit fix --force` blindly.
