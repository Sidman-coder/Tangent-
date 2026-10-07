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
2. **Run the migration.** Open `supabase/migrations/20261006000000_pipeline_v2_change_sets_and_events.sql`, paste all of it into a new SQL Editor query, and run it. It's safe to run twice.
3. **Make sure the tables exist and are empty:**
   ```sql
   select count(*) from change_sets;
   select count(*) from events;
   ```
   Both should be 0.
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
19. Known gap: reloading a chat drops an unconfirmed preview card. The draft stays in `change_sets` with status `draft` and nothing is on the calendar.
20. Flag OFF again (remove the line, restart): no preview cards anywhere, and `POST /api/changesets/<any id>/confirm` returns **404**.

## E. Flag ON: Prompt 2 (one box, no mode switch)

1. The Plan/Calendar mode switch is **gone**.
2. "help me plan ICF prep" shows a preview.
3. "what should I do for ICF?" gets a **chat answer**, with no preview.
4. Draft a plan in conversation, then click **Add plan to calendar**. The saved tasks **exactly match** what you saw, with no regeneration.
5. **Voice** and **typing** the same request give the same preview.
6. Click **"Just talking, don't add"** on a preview. It discards and replies conversationally.
7. Supabase: `select count(*) from events where type='changeset_discarded';` goes up.

## F. Save and ship (in this order)

1. Commit each branch, if not done already (no `.env.local` in `git status`!).
2. Push the branches and open the PRs on GitHub. Merge in order: **0 → 1 → 2**.
3. Make sure the database migrations from section A have been run **before** merging.
4. Keep `TANGENT_PIPELINE_V2` **off in Vercel**. Only turn it on there after you and Juann have each tried 10 real brain-dumps locally.
5. On the live site, check a quick task and Undo.

## G. Known to-dos (not bugs)

- The iCF duplicate and "test next week" fail until **Prompt 3** (router + plan matcher).
- Your local `main` is behind GitHub. Run `git checkout main && git pull` at the end. Close VS Code and File Explorer first to avoid the folder lock.
- `npm audit` shows 3 vulnerabilities. Look at them separately and **don't** run `npm audit fix --force` blindly.
