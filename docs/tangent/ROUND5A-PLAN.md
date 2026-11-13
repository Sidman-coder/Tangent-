# Round 5A plan and progress log

Spec: `D:\TANGENT showcase\Round 5\tangent-round5A-prompt.md`. Branch `v3-core-loop`. Style: `docs/design/TANGENT-STYLE.md`. Context engine: `docs/tangent/CONTEXT-ENGINE.md`. Round 4 log: `docs/tangent/ROUND4-PLAN.md`. The older backlog `docs/tangent/ROUND5-PLAN.md` (pre-sign-in age check) is a different file and is not part of 5A.

A fresh session continues from this file: read the **Progress log** at the bottom, then the next phase's section.

## Decisions from Sid (2026-11-13, Phase 0)

- **Q1 Reasoning step:** a separate brief-building call. Extended thinking is not used.
- **Q2 Waitlist email:** a Supabase SMTP sign-in link (`signInWithOtp`, `shouldCreateUser:false`), plus a "You're in" line Sid adds to the Magic Link template. No new env vars.
- **Q3 `TANGENT_PIPELINE_V2`:** ChangeSet drafts are always on for planning (preview → confirm), whatever the flag says. Other V2-only features (AI Activity, the intent router) stay behind the flag.
- **Q4 Home talk layout:** the conversation takes over Home once a message is sent (full-width chat, composer pinned at the bottom, a quiet "Back to Today"). Before any message, Home is unchanged.

## Ground truth found in the code (affects several items)

- **Preview → Confirm/Edit/Discard needs ChangeSets, which only exist when `TANGENT_PIPELINE_V2` is on.** It's off by default (`docs/tangent/PROJECT.md:137`). With the flag off, `lib/voice-handler.ts:1094-1128` writes plans straight to the calendar and `/api/changesets/*` return 404. Phases 2, 4 and 5 depend on drafts (Q3).
- **No live surface streams or renders markdown.** Every client sends `stream:false`. The prompts in `lib/chat-reply.ts` (PLAN_SYSTEM, ANSWER_SYSTEM) ban markdown and the `clean()` helpers strip it. Reusable, currently unused: `components/console/Markdown.tsx`, `markdown-parse.ts`, `components/console/turns.ts readChatReply` (NDJSON reader). The server's `ndjson()` already emits `reply_text`.
- **"help me…" plans because of several regexes:**
  - `lib/pipeline/planning-intent.ts:17,19`
  - `lib/ai/plan.ts:363` `isClearPlanRequest`
  - `lib/ai/clarify.ts:92`
  - `lib/voice-handler.ts:886`
  - `lib/pipeline/intent.ts:158` PLANNING_OVERRIDES
  - `lib/pipeline/intent-prompt.ts:28`
  - client `lib/ask-route.ts` turns a match into `newProject:true`, which forces grill cards and the split.
  - Fixtures lock this in: `lib/pipeline/fixtures/requests.json:2353,2399` and `round2.json:343,363`.
- **Images:** the five images in `D:\TANGENT showcase\Images\` were opened and match the prompt's description of each problem.
  - "Tangent knows about you P1 (2)" shows "4 hrs a week" **twice under Classes & activities**, while the prompt calls it a global Commitment. Both are wrong; the fix files it under its project.

## Phase 1: Trust and quick fixes

### 1.1 Password confirm
- **Files**
  - new `lib/auth/confirm-state.ts`: pure `confirmReducer(state, event)` with events `blur | submit | editConfirm | editPassword`, and `confirmView(password, confirm, state)` returning `idle | mismatch | match`.
  - `components/auth/PasswordFields.tsx`: use the reducer; move `onBlur` from the wrapper div (`:132`, which wraps the Show/Hide button too) to the confirm input; show a green "Passwords match".
  - `components/auth/password-fields.css`: `.pw-hint--ok`.
  - `app/(auth)/signin/SignInForm.tsx`, `components/settings/SecuritySettings.tsx`: stop showing the mismatch a second time as a form error.
- **Test:** `lib/auth-confirm.test.ts` walks type wrong → blur (mismatch) → edit (idle) → match (match) → change (idle until blur).

### 1.2 Missing-column race
- **Cause:** request A marks the columns missing; request B, already in flight with the full column list, gets 42703; `noteMissingFactColumns` returns false because they are already marked, so B throws (`lib/store.ts:2304-2309`, `readContextRows` `:2335-2350`).
- **Files:** `lib/store.ts`
  - `noteMissingFactColumns` returns true for any `missing_column` error. Marking stays idempotent and the warning still fires once, so every caller retries with the base columns.
  - Same fix for `readContextRows`, `addContextEntry` (`:2463`), `saveOnboardingFacts`, `tidyFacts`, `confirmContextEntry`, `markFactsUsed`.
  - Same flaw in `noteMissingTaskColumn`/`taskQuery` (`:153-172`).
  - `lib/student/step-events.ts`: its permanent `tableMissing`/`behaviourKindsMissing` flags move to `createColumnMemo`.
- **Test:** `lib/store-schema-race.test.ts`. A fake Supabase returns 42703 for any select that includes `fact_category`. `Promise.all` of two reads: both succeed.

### 1.3 Fact quality (the five examples become tests in `lib/student/student.test.ts`)
- **Grammar:** `formatFact` (`lib/student/facts.ts:287`) swaps pronouns inside the value (I→you, my→your, I'm→you're, am→are). A leading "I take/do/play/have" folds into the template: "Outside class, you take volunteering, TSA, soccer, and a job of tutoring".
- **Duplicates:** `tidyFacts` and the `addContextEntry` dedupe share one `normalizeFactText` (lowercase, no punctuation, collapsed spaces, hours→hrs), scoped by `project_id`. `groupFacts` also dedupes on display text, which covers rows already stored.
- **Vague values:** `isVagueValue` adds top result, good, better, best, asap, a lot, idk and similar. `lib/context/grill.ts` and `lib/grill-queue.ts` stop saving vague answers and queue a follow-up instead, for example "What would a top result look like: a score, a place, a rank?".
- **Project-scoped:** slot answers for a project that doesn't exist yet are saved with no `project_id` today. When the draft is confirmed, the flow's slot facts get the new `plan_id` (`lib/pipeline/card-actions.ts`, new store helper `attachFlowFacts`). Display: `lib/you-map.ts` and `components/settings/WhatTangentKnows.tsx` show project facts under a "Projects" group with the project name; `ProjectView` shows "What Tangent knows for this project". Deadline wording drops the dangling "It": "Due by end of term".
- **Category:** new `SLOT_CATEGORY` map in `lib/context/goal-slots.ts`; `grill.ts` passes `factCategory` (today it passes only the legacy `work` category, which maps to classes_activities). A `school night` hint goes to how_you_work and is checked before schedule. Also fixes `factFromAnswer` writing "4 a week" without "hrs".

### 1.4 Delete my account
- **Files**
  - new `lib/account/delete-account.ts`: clients injected, so it can be tested.
  - new `app/api/account/delete/route.ts`: needs `{confirm:"DELETE"}`; the user comes only from the session (`withUser`); any id in the body is ignored.
  - `lib/store.ts` `resetUserData` (`:3413-3463`): adds the missing tables.
  - `components/settings/YourDataSection.tsx`: new danger row with an inline `ConfirmPanel` (type `DELETE`).
  - new `app/(auth)/goodbye/page.tsx`, public in `middleware.ts`.
  - `lib/supabase/admin.ts` reused for `auth.admin.deleteUser` (no `deleteUser` exists yet).
- **Order:** delete the user's rows → delete `waitlist` by email → `auth.admin.deleteUser(sessionUserId)` → clear `sb-*` cookies (the `app/auth/signout` pattern) → `/goodbye`.
- **Tables covered** (every `user_id` table in the migrations; all cascade from `auth.users`):

| Table | "Delete all my data" | "Delete my account" |
|---|---|---|
| tasks, plans, chat_sessions, notifications, action_records, pending_confirmations, voice_logs, context_entries, brief_configs, canvas_feeds, paths, change_sets, ai_decisions, context_slots, grill_questions | already deleted | yes |
| **step_events**, **plan_aliases** | **added** to `resetUserData` | yes |
| path_nodes, task_chat_messages, chat_messages | removed by the foreign-key cascade from their parent (paths, tasks, chat_sessions), not deleted explicitly (corrected after spec-verifier) | yes |
| non-default calendars; profile fields reset | already | profiles and calendars rows removed |
| events, ai_usage (only the service role can delete) | kept (audit trail and the AI budget) | yes, with the admin client |
| pen_devices | kept, on purpose | yes |
| waitlist (by email) | kept | yes |
| auth.users | kept | `deleteUser`; the cascade catches anything missed |

  The "Delete all my data" copy says it removes "AI history". That is false for `ai_usage`, so the copy is corrected.
- **Tests:** `lib/account-delete.test.ts`:
  - the fake db records every query; each is `eq("user_id", <session id>)` or `eq("email", <session email>)`
  - `deleteUser` is called once, with the session id
  - a different `userId` in the body is ignored
  - a missing `DELETE` confirm returns 400
  - an admin error stops before sign-out and reports it
  - a route test imports the handler with stubbed modules (the existing `data:` stub pattern)

### 1.5 Real waitlist
- **Migration** `supabase/migrations/20261113000000_waitlist.sql`: `waitlist(email text primary key check (email = lower(email)), user_id uuid null, status text not null default 'waiting' check (status in ('waiting','approved')), created_at timestamptz default now(), approved_at timestamptz)`. RLS on, no policies, all revoked from anon and authenticated.
- **Files**
  - new `lib/auth/waitlist.ts`: `joinWaitlist` (insert, on conflict do nothing, so it's added once), `listWaitlist`, `approve`. All through the admin client.
  - `app/auth/verify/route.ts`: a non-allowed sign-in joins the waitlist.
  - `lib/auth/gate.ts` and `access.ts`: allowed = `ALLOWED_EMAILS` **or** `app_metadata.waitlist === "approved"`. Approve writes that flag with the service role (same pattern as `under_13`), so middleware stays one `getUser()` call with no extra query. If `waitlist` is missing (migration not run), the gate falls back to env-only.
  - new owner page `app/(app)/settings/waitlist/page.tsx` plus `app/api/waitlist/route.ts`. Both check `isOwnerEmail` server-side; everyone else gets 404. Counts for waiting and approved; an Approve button.
  - `app/(auth)/waitlist/page.tsx` copy: "You're on the waitlist. We'll email you at {email} when you're in."
- **Email (Q2):**
  - Approve sets `user_metadata.waitlist_approved = true` (admin `updateUserById`; whether it merges or replaces `user_metadata` is checked against the Supabase docs at the start of Phase 1), then calls `signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo } })`. Supabase's configured SMTP sends the normal sign-in email.
  - **Manual step for Sid** (I don't touch Supabase settings): add `{{ if .Data.waitlist_approved }}You're in! {{ end }}` to the Magic Link template.
  - Limit: Supabase's auth email rate limits apply.
  - Docs: https://supabase.com/docs/guides/auth/auth-email-templates, https://supabase.com/docs/reference/javascript/auth-signinwithotp
- **Tests:** `lib/auth-gate.test.ts` adds approved (allowed), waiting (waitlist) and env-allowed (allowed); `joinWaitlist` twice gives one row.

### 1.6 Bulk actions
- **Today:** these phrases fall to `add` in `homeRoute` and then to `handleBulkDelete`/the planner. "delete all my tasks and projects" opens `ASK_WHICH`; "delete all my chats" searches for tasks called "chats"; `deleteChatSession` exists but has no UI and there is no delete-all.
- **Files**
  - new `lib/pipeline/bulk-action.ts`, a pure parser: delete/clear/remove, move all, mark all done × tasks, projects, chats, everything, or a time scope (today, this week).
  - `lib/pipeline/home-route.ts`: new kind `action`, checked first; never plan or grill.
  - `app/api/chat/route.ts`: the action branch.
  - The confirm card reuses `proposeDelete` (`lib/voice-handler.ts:110-152`) and `bulkDeleteMessage` (`lib/delete-scope.ts:140`), with exact counts: "Delete 14 tasks and 2 projects?".
  - "Delete all projects" also removes plans that have no tasks.
  - new `deleteAllChats(userId)` in `lib/store.ts` (`chat_sessions`, `chat_messages`).
  - Undo: tasks and projects via `action_records`/`undoAction`; chats have no undo and the card says "This can't be undone."; move all and mark all done restore previous dates or completion.
- **Tests:** `lib/pipeline/home-route.test.ts` covers each phrase ("delete all my tasks and projects", "delete all my chats", "clear my chat history", "move all today's tasks to tomorrow", "mark all done", "delete everything") → `action`, never plan or grill. Count text in `lib/pipeline/bulk-action.test.ts`.

## Phase 2: AI chat (top priority)

### 2.1 Talk mode
- **One router:** new `lib/pipeline/talk-route.ts` `routeMessage(text, scope)` → `action | add | answer | plan`. `answer` carries `schedulable`. `plan` happens only on an explicit phrase or the button flag `planThis:true`. The regexes listed above stop forcing a plan; `isPlanningRequest` becomes the `schedulable` hint.
- **Server:** `lib/chat-reply.ts` gets a TALK_SYSTEM prompt: markdown allowed, a real topic-specific answer using the context pack (`buildStudentContext purpose "chat"`), at most 2 follow-up questions inside the answer, no "Want me to plan…" push, `max_tokens` about 1200. Streams through `streamClaude` with `reply_text`.
- **Client:**
  - new `components/talk/TalkThread.tsx`: user bubble on the right, assistant markdown with no bubble (reusing `components/console/Markdown.tsx`), composer pinned at the bottom.
  - new `components/talk/PlanThisRow.tsx`: "Plan this into my calendar" · "Not now".
  - `components/add/AddFlow.tsx` (hero) moves to `stream:true` with `readChatReply` and no longer opens the workspace on clarify or answer.
  - Home layout per Q4: the conversation takes over once a message is sent, with a quiet "Back to Today".
- **Tests:** a route test checks that a goal message gives `answer` + `schedulable` and no store writes (fake store); a logic test checks the layout state stays `talk`.

### 2.2 Planning only when asked, with a real thinking stage
- **Router fixtures:** new `lib/pipeline/fixtures/talk-first.json`: "help me get better at competitive programming" → answer; "plan it", "put this on my calendar", "make me a schedule for AP Chem" → plan; the button flag → plan. The four old fixtures change their expectations on purpose.
- **Stages** are NDJSON `{type:"stage", id}` events sent from the real steps in the `lib/voice-handler.ts` plan branch:
  - `week`: `getAllTasks`, commitments, busy days, capacity
  - `facts`: the context pack
  - `steps`: the brief call, then `generatePlan`
  - `place`: `spreadPlanDates`, then the quality guard
- **UI:** new `components/plan/ThinkingStages.tsx`: "Reading your week" → "Checking what you've told me" → "Choosing steps" → "Placing them".
- **Reasoning step (Q1):** new `lib/ai/plan-brief-call.ts`, SMART, JSON schema `{goal_line, assumptions[], question?, step_intents[{what, when_hint, why, why_ref:{kind:"calendar"|"fact"|"topic", ref}}]}`. Input: calendar summary plus the fact list with ids. Feeds `generatePlan`. Reuses the pure slot defaults in `lib/ai/plan-brief.ts`.
- **One question at most:** if `question` is set it is asked as plain text in the thread and planning continues on the reply; otherwise each default becomes an assumption in the brief. Grill cards no longer show for Home goals.
- **Q3:** planning always returns a ChangeSet draft; `lib/voice-handler.ts` no longer takes the direct-write branch for plans.

### 2.3 Split after placement
- `components/add/PlanWorkspace.tsx` is rebuilt as Brief | Calendar.
- new `components/plan/PlanBrief.tsx`, in order: goal line; "Round 1: what you'll get this week"; step cards (what / when / why / You'll have); "What I used about you"; "What happens next"; Confirm / Edit / Discard; the composer.
- The Confirm / Edit / Discard calls move from `components/PreviewCard.tsx` into a `usePreviewActions` hook so ⌘K and InlineAsk keep working.
- `components/preview/PlanCalendarPreview.tsx`: bigger, month and week views, full step on hover. `HowThisPlanWorks` moves into the brief; nothing sits under the calendar.
- `add.css`: the `layout` animation (`visualDuration .3`, AddFlow:664) already exists; `MotionConfig reducedMotion="user"` turns it off.
- Phone: Brief / Calendar tabs (the SegmentedTabs pattern).
- Each step's `why` is stored as a `WHY:` line in notes and parsed in `lib/note-parts.ts`. No migration.
- Duplicates removed: the `planStoryText` log line and PreviewCard's "New plan" kicker and title in the workspace. "New plan …" appears once, as the goal line.

### 2.4 Quality guard
- new `lib/ai/plan-guard.ts` (pure): `checkStep(step, {facts, calendar, topic})` → ok or reason.
- new `config/plan-guard.json`: banned phrases ("you're aiming for a top result", "stay consistent", "work hard", …) and generic title words (merged with `lib/plan-title.ts GENERIC_TITLES`).
- A failing step is regenerated once (`planDetail`, one step); still failing, it is dropped and the brief says why.
- Fixtures `lib/pipeline/fixtures/plan-quality.json`: competitive programming, AP Chem final, Instagram growth, college essay, with specificity expectations. `scripts/eval-pipeline.ts --quality`.
- Unit tests for `plan-guard` are free. **The paid eval command is `npm run eval:pipeline -- --quality`; I won't run it.**

### 2.5 One brain everywhere
- Callers move to `routeMessage` and talk-first: `components/capture/useCapture.ts` (inline answers under the mic, no `newProject:true` for goals), `components/chat/InlineAsk.tsx` (task and project chats), `CommandPalette` ask, `CalendarRail` (Phase 4).
- `app/api/chat/route.ts` gets one `routeMessage` call at the top; `homeRoute`, grill and clarify hang off its result.
- "Plan this" on `/capture` writes sessionStorage `tangent:talk-handoff` (the conversation), then goes to `/?plan=1`; Home rehydrates the thread and starts planning. The shared `tangent-ask-ai` key is left alone.
- **Test:** `lib/pipeline/talk-route.test.ts` runs every fixture through each entry point's scope (home, capture, task, project, rail) and expects the same route.

## Phase 3: `/capture`, urgency, School/Work
- **`/capture` order** (`lib/capture-list.ts`, `components/capture/CaptureHome.tsx`): mic and composer (CaptureIsland moves to the top); "Now" (today, due, overdue); an "All tasks" button; "Projects & goals" grouped by project. The lens chips stay.
- **"All tasks":** `app/(app)/tasks/` is an empty directory, so I add a simple `/tasks` page reusing `TaskRow`.
- **Urgency:** new `isUrgent(task)` in `lib/capture-list.ts`: only commitment `fixed` or `reminder`, and never a goal step (`plan_id`, `source` path or tangent, or a `Round —` plan). Fixes both leaks found: an AI-drafted fixed step (`lib/pipeline/draft.ts:37-43`) and path steps classified by title (`lib/task-kind.ts`). "Soon" currently includes tomorrow; the rule changes to the commitment type, not the date.
- **School/Work:**
  - Migration `supabase/migrations/20261113010000_plan_kind.sql`: `plans.kind text null check (kind in ('school','work'))` plus a partial unique index on `(user_id, kind) where kind is not null`.
  - new `lib/school-work.ts` `areasFor({commitmentKinds, chatMentions, canvasConnected})`: School if there is a school commitment or Canvas; Work if there is a work commitment or the student mentioned a job or shift. Never both by default.
  - Created in `replaceCommitments` (`lib/store.ts:1060`), `completeOnboarding` and context extraction.
  - `app/(app)/projects/page.tsx`: a "School & Work" sub-category. Canvas items show under School by `source === "canvas"` (their `plan_id` is not rewritten). `/projects/school` keeps working.
  - Schema-compat: with no `kind` column, it falls back to today's virtual School card.
- **Tests:** `lib/capture-list.test.ts` (urgency, including a goal step due today that is not urgent) and `lib/school-work.test.ts`.

## Phase 4: Calendar rail and draft bubble
- **4.1 Rail:** `components/calendar/CalendarRail.tsx` stops calling `askOnHome` (which overwrites Home's draft through the shared `tangent-ask-ai` key) and uses a compact `TalkThread` with local state. Planning from the rail lifts the draft ops to the Calendar page so the main calendar shows proposed steps (new in colour, others grey; `lib/preview-week.ts`); the brief and Confirm / Edit / Discard stay in the rail. Leaving the page clears the rail; an unconfirmed plan becomes a draft.
- **4.2 Drafts:**
  - new `lib/drafts/draft-store.ts`: sessionStorage `tangent:drafts`, at most 2, `{changeSetId, title, stepCount, origin, createdAt}`, unit tested.
  - new `components/drafts/DraftPill.tsx` and `DraftCard.tsx`, mounted in `app/(app)/layout.tsx` beside UndoToast so they also show on `/capture` (AppShell returns early there).
  - The pill sits bottom-right above `.app-fab` and the phone nav (toasts are bottom-left on desktop, z-index 400).
  - ✕ discards with Undo: the discard call is held until the toast ends.
  - A third draft asks first, then replaces the oldest.
  - Hidden on the draft's origin page.
  - "Open full view" goes to `origin?draft=<id>`; new GET `app/api/changesets/[id]/route.ts` rehydrates it.
  - Home also restores open drafts after a reload (`fetchOpenDrafts`; today only ⌘K does).
- **Accept check:** a Playwright MCP run by `ui-checker` (no new `@playwright/test` dependency): draft on Home → Calendar → pill → open → confirm, Home's text unchanged. It needs Sid signed in and the AI live; otherwise it is marked "needs Sid signed in".

## Phase 5: Round review
- new `lib/rounds/review-input.ts` (pure): planned vs done dates, skipped, moved, check-in codes, time taken (tasks and `step_events`).
- new `app/api/rounds/review/route.ts`: AI questions, 3–5, JSON.
- new `components/projects/RoundReviewSheet.tsx` (Sheet): chips plus short text; answers go through `prepareFact`'s sensitive filter and are saved as facts or outcomes.
- "I've finished this round" button in `components/projects/ProjectView.tsx`; the sheet opens automatically when all steps are done; the existing `RoundReview.tsx` card opens it.
- **Last question calendar:** `lib/preview-week.ts` gets a `removed` block kind (old steps in their colour with an X); other projects grey; new Round 2 steps in colour. Start now / Push 1 week / Pick a date shift the proposed op dates client-side, live.
- **Confirm and undo:** Confirm goes through the existing `propose` → changeset confirm path. The round line update joins the same changeset (an `update_plan` op, or the previous description stored on the undo record), so `undoChangeSet` rolls the round number back (the known Round 4 gap: `components/PreviewCard.tsx:158-162` undo only posts `/undo`). Files: `lib/pipeline/card-actions.ts`, `app/api/rounds/route.ts`.
- **Tests:** `lib/rounds-review.test.ts` (data-based input, advance and undo). Screenshots to `docs/design/screens/round5a/`.

## Phase 6: Notifications popover
- `components/NotificationBell.tsx` and `app/styles/shell.css`: 22px radius, soft shadow, an SVG tail toward the bell; `m.div` spring with `bounce ≈ 0.3`, `transformOrigin` at the bell, about 250 ms; reduced motion fades; header "Notifications" with "Clear all" as a quiet text button and ✕; Today and Earlier groups; relative times; unread dot; soft pill actions; empty state.
- new `lib/relative-time.ts` ("just now", "5m ago", "2h ago", "Yesterday", "Mon"), tested. (Today the time is clock-only, `NotificationBell.tsx:217`.)
- `lib/notification-dedupe.ts`: an aggregate overdue item absorbs the individual overdue items into one, tested with "Six tasks are overdue" plus the individual ones. The `lib/proactive.ts` prompt is also told not to send both.
- Phone Sheet gets the same styles.
- Screenshots at 1440 and 390, light and dark.

## Phase 7
`spec-verifier` on the whole round; `ui-checker` on Home (talk and plan), `/capture`, Calendar (rail plus draft bubble), a project (round review), Settings → Your data, `/signin` (Create account) and `/waitlist`; `docs/MANUAL-STEPS.md` → Round 5A (migrations plus check queries, the email method, signed-in checks); final summary; commit; no push.

## Migrations (files only; Sid runs them; code keeps working before they run)
1. `20261113000000_waitlist.sql`: the waitlist table, RLS with no policies.
2. `20261113010000_plan_kind.sql`: `plans.kind` (school | work) plus a partial unique index.

No migration for facts (`project_id` already exists), drafts (sessionStorage), why lines (notes) or rounds (the description line).

## New env vars
None (Q2 = Supabase SMTP).

## Conflicts with existing code or decisions
1. **Talk-first with one question at most** conflicts with `docs/tangent/decisions/2026-11-grill-sufficiency.md`, PROJECT.md "Plan (2–3 questions)" and CONTEXT-ENGINE "ask 1–3 questions at a time". The prompt is the newer user instruction, so I follow it, write a superseding note `docs/tangent/decisions/2026-11-talk-first.md`, and update PROJECT.md once the phase is accepted.
2. **Planning fixtures** that expect "help me…" to plan (`requests.json:2353,2399`, `round2.json:343,363`) change on purpose.
3. **"Plan it / Just talk" toggle** becomes redundant under talk-first. Removing it counts as removing a feature (the prompt says to ask): see smaller question a.
4. **"How this plan works"** moves into the brief rather than being deleted.
5. **TANGENT-STYLE** (nothing over 250 ms, no bounce, popovers at `--r-md` 12px) vs Phase 6 (20–24px radius, overshoot bounce). The prompt wins for the notification popover only; I note it in TANGENT-STYLE.md as an exception.
6. **Council trigger (AGENTS.md):** the round touches scope, privacy (account deletion) and email. The prompt sets the scope explicitly, so I treat it as decided, as in Round 4. A Council Review is available on request.
7. **`ai_usage` and `events`** are kept on "Delete all my data" and removed only by account deletion.
8. **`app/auth/magic-link/route.ts`** leaves `shouldCreateUser` at its default (true), so Sign in also creates accounts. Not in 5A; noted only.
9. **Permission rules as specified** do not cover a bare `git push` (no arguments) or the PowerShell tool. Adding `Bash(git push)` and `PowerShell(git push*)` to `deny` would be EXTRA: see smaller question g.

## Smaller questions (my default applies unless Sid says otherwise)
- a. Remove the Plan it / Just talk toggle? Default: yes.
- b. "All tasks" → a new simple `/tasks` page? Default: yes.
- c. Owner waitlist page at `/settings/waitlist`, hidden for everyone else? Default: yes.
- d. Keep `ai_usage` and `events` on "Delete all my data"? Default: yes.
- e. Notification pill actions: a new `soft` Button variant? Default: yes.
- f. Draft-bubble Playwright check via the Playwright MCP (`ui-checker`), with no new `@playwright/test` dependency? Default: yes.
- g. Add the two extra `deny` rules from conflict 9? Default: no.

## Per-phase checklist (from the prompt)
1. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. New test folders are added to the `npm test` glob in `package.json`, or tests go in `lib/*.test.ts`.
2. `spec-verifier` (with the phase base commit) and `ui-checker`.
3. Proof table: requirement → test name, screenshot path, or "needs Sid signed in".
4. Wait for "commit and continue".

## Progress log
- 2026-11-13 **Phase 0 done, waiting for Sid's approval of this plan.**
  - Created: `CLAUDE.md`, `.claude/settings.json`, `.claude/agents/spec-verifier.md`, `.claude/agents/ui-checker.md`; added `CLAUDE.local.md` to `.gitignore`.
  - Read: the five images, the prompt, ROUND4-PLAN, PROJECT.md, CONTEXT-ENGINE, the decision notes, and three read-only code surveys. No `.env*` file was opened. No application code was changed.
  - Decisions Q1–Q4 recorded above. Nothing committed.
- 2026-11-13 **Phase 0 approved by Sid ("approved"). Phase 1 started.**
  - **1.1 done.** `lib/auth/confirm-state.ts`, `PasswordFields.tsx` (blur on the confirm input only, green "✓ Passwords match"), `SignInForm.tsx`, `SecuritySettings.tsx`. Test: `lib/auth-confirm.test.ts` (5).
  - **1.2 done.** `lib/store.ts` `noteMissingFactColumns` and `noteMissingTaskColumn` return true on every missing-column error; `lib/student/step-events.ts` uses `createColumnMemo`. Test: `lib/store-schema-race.test.ts` (4; 3 fail on the old code).
  - **1.3 done in code** (not yet reported). `lib/student/facts.ts` (first-person rewrite, `byPhrase`, vague list, `goalQuestion`, `normalizeFactText`/`factKey`/`dedupeFacts`, `prepareFact` returns `followUp`, `factView` restates stale first-person wording), `lib/store.ts` (`queueFollowUps`, normalised dedupe by project in `addContextEntry`, `getUserContext` dedupes, `attachFlowFacts` called from `addPlanWithTasks`), `lib/context/goal-slots.ts` (`SLOT_CATEGORY`), `lib/context/grill.ts` (passes it), `lib/you-map.ts` (`groupFacts` global only, `projectFacts`), `components/settings/WhatTangentKnows.tsx` (a card per project). Tests: `lib/student/student.test.ts` (6 new), `lib/you-map.test.ts` (2 new), `lib/store-facts.test.ts` (8). Full `npm test`: 813 pass.
  - **1.4 done in code.** `lib/account/delete-account.ts` (clients injected), `app/api/account/delete/route.ts` (needs `{confirm:"DELETE"}`, user from the session only), `app/(auth)/goodbye/page.tsx` (public via `GOODBYE_PATH` in the gate), `components/settings/YourDataSection.tsx` (type-DELETE panel; "Delete all my data" copy corrected). Test: `lib/account-delete.test.ts` (10). It covers `runAccountDelete`, not the thin `withUser` wrapper.
  - **1.5 done in code.** Migration `supabase/migrations/20261113000000_waitlist.sql` (file only; Sid runs it). `lib/auth/waitlist.ts`, `lib/auth/waitlist-server.ts`, gate `isAllowedUser` = env allowlist OR `app_metadata.waitlist === "approved"`, `app/auth/verify|callback|password` routes join the waitlist, `lib/cron-users.ts` includes approved emails, `app/api/waitlist/route.ts`, owner page `/settings/waitlist` (`WaitlistAdmin.tsx`, no nav link), `app/(auth)/waitlist/page.tsx` copy. Tests: `lib/waitlist.test.ts` (8), `lib/auth-gate.test.ts`. Needs Sid: run the migration; add `{{ if .Data.waitlist_approved }}You're in! {{ end }}` to the Magic Link template; approval email delivery.
  - **1.6 done in code.** `lib/pipeline/bulk-action.ts` (pure parser `parseBulkAction` + `planBulk` counts/card text), `lib/pipeline/home-route.ts` (new kind `action`, checked first; never plan/grill), `lib/pipeline/bulk-action-run.ts` (`proposeBulk`, `runBulkConfirm`, store passed in), `app/api/chat/route.ts` (action branch → confirm card, JSON or ndjson `result`), `app/api/confirm/route.ts` (bulk branch first), `lib/store.ts` (`countChatSessions`, `deleteAllChats`: `chat_messages` then `chat_sessions`). Reuses existing `pending_confirmations`/`action_records` kinds (`delete_task`, `reschedule_task`, `complete_task`) with `payload.bulk=true`, so no migration. Tests: `lib/pipeline/bulk-action.test.ts` (7), `lib/pipeline/bulk-action-run.test.ts` (8), `lib/pipeline/home-route.test.ts` (+2).
    - Interpretations to flag: "delete everything"/bare "all" = tasks + projects, not chats (chats can't be undone); "delete all projects" also deletes their steps; bulk move leaves fixed events alone and says so on the card; bulk mark-done doesn't log `step_events`; a topic ("delete my SAT tasks") isn't a bulk action and keeps the old scoped-delete path.
  - **Phase 1 validation:** `npm run lint` (0 errors; 3 pre-existing warnings in untouched `CaptureHome.tsx`, `PathScene.tsx`), `npm run typecheck` clean, `npm test` 850 pass / 0 fail, `npm run build` succeeded.
  - **spec-verifier** (run as a general-purpose agent with the `.claude/agents` instructions, because the new project agents weren't registered until a restart): every 1.1–1.6 requirement MET in code; it ran no tests. Gaps: `deleteAllChats` real store function untested (fake only); `SLOT_CATEGORY`/grill path has no direct test; 1.4 table corrected (cascade, not explicit deletes).
  - **ui-checker** (same way), signed out: 24 screenshots in `docs/design/screens/round5a/` (signin, signin-create, goodbye public; settings-data, settings-context, settings-security via `/dev/app`, labelled signed-out). No sideways scroll. `/waitlist` and `/settings/waitlist` redirect when signed out and have no preview, so not checkable. Sign-up password+confirm fields only appear after the email code, so not reached; `settings-security` was a stand-in. Project cards (1.3) not visible in the dev preview data. `.you-hero-stage` clips slightly (CSS untouched this round, so likely pre-existing).
  - Next: Phase 1 report, wait for "commit and continue".
