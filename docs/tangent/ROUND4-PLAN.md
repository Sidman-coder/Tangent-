# Round 4 plan and progress log

Branch `v3-core-loop`. Spec: `docs/tangent/CONTEXT-ENGINE.md` (copied from Part 2 of the Round 4 report). Master prompt: `D:\TANGENT showcase\Round 4\tangent-round4-master-prompt.md`.

## Progress

| Phase | Status |
|---|---|
| 0 Read, audit, plan | Done, approved 2026-11-08 |
| 1 Bugs, sign-up, access | Done (see Phase 1 log) |
| 2 Context engine foundation | Done (see Phase 2 log), plus behaviour reading (Phase 2b) |
| 3 Planning flow | Done (see Phase 3 log) |
| 4 Tasks, calendar, Paths | Not started (4.4 Paths pulled forward, done) |
| 5 Home, notifications, settings, You, mapped | Not started (5.3 Settings layout and 5.4 You, mapped pulled forward, done) |
| 6 Onboarding | Not started |
| 7 Audit, screenshots, report | Not started |

Baseline (start of Round 4): `git status` clean on `v3-core-loop`, head `f9d83b2`. Lint, typecheck, test and build were **not** run in Phase 0 (docs-only).

Baseline recorded at the start of Phase 1: build passes; lint 7 warnings (all `react-hooks/exhaustive-deps`, pre-existing); 644 tests pass. Lint had no config file, so `npm run lint` prompted; Phase 1 adds `.eslintrc.json` (`next/core-web-vitals`) and a `typecheck` script.

---

## Audit (read from the code on 2026-11-08)

### Context and memory

- **Two separate stores today.**
  - `context_entries` (init schema): free-text facts. Columns `category` (check: preference, habit, commitment, goal, person, work, general), `fact`, `source` (check: chat, voice, manual), `created_at`. Read by `getUserContext()` / `getContextAsString()` in `lib/store.ts`. Written by `lib/context-extract.ts` (AI extraction after chat, fire-and-forget), `app/api/context` (`remember`, `remember_many`, `extract`) and `lib/store.ts:3564` (grill answers become facts through `factFromAnswer`).
  - `context_slots` (migration `20261105030000`): one row per (user, project or null, `slot_key`), `value` jsonb, `source` (check: answer, inferred, default, known). Read and written by `lib/context/store.ts`. Falls back to null if the table is missing.
- `lib/context/slots.ts`: 7 project slots (outcome, deadline, hoursPerWeek, currentLevel, hardestPart, constraints, bestTimeForThis) and 3 global (preferredWorkTimes, focusLength, weekendAvailability). Weights, `ENOUGH = 0.7`, required slots deadline and hoursPerWeek (defaults 2 weeks, 3 hrs).
- `lib/context/flow.ts`: template questions, **one question at a time**, check-in after 5 in a row, skip applies defaults. `lib/context/grill.ts` runs a turn. `lib/context/infer.ts` infers slots from the request text.
- Fact wording is produced in `slotToFact()` (`flow.ts:163`) and `factFromAnswer` (store). This is the source of "Does their best work: Late at night" and "Deadline: No real deadline". Nothing is second person.
- `app/api/context/route.ts`: GET returns entries and a joined string. No sensitive-content filter anywhere. No confidence, no `last_confirmed_at`, no `used_count`, no project link.
- `grill_questions` (migration `20261103000000`): queue of questions per user and project, kinds deadline, hours, level, hardest, constraints (`lib/grill-queue.ts`). Routes: `api/grill` (turn), `api/grill-queue` (list/answer), `api/questions` (Home inbox), `api/path-intake` (Paths intake, 173 lines).
- Settings UI: `components/settings/WhatTangentKnows.tsx`, `GrillQueue.tsx`, `ImportContext.tsx`; page `app/(app)/settings/context/page.tsx`.
- Onboarding: `lib/onboarding.ts` (470 lines, pure), `app/api/onboarding/route.ts` (POST/PATCH/DELETE), UI `components/FirstRun.tsx` + `FirstRun.css`, post-onboarding bubble `components/GetToKnowYou.tsx`. Current answers: helpFocus, slipPoint (assignments, projects, ideas, deadlines, everything), dayView, workingToward, startingIntent (140 chars), school hours. Stored as profile columns (migration `20260929000000`). **No age or grade is collected.**

### AI calls and the context each receives today

All "picture" text comes from `lib/ai/student-context.ts` `buildStudentContext()`: today's date, `getContextAsString()` (last 50 entries, or compressed summary plus recent), school hours, daily capacity, 14-day load, Canvas due items, overdue, open this week, class names, projects under way, Paths goals. It is unranked and has **no token budget**, no per-project state, no slot answers, no calibration, no record of what was used.

| Call | Where | Context today |
|---|---|---|
| Chat plan reply | `lib/chat-reply.ts` (used by `api/chat` and `api/sessions`; the prompt also lists `api/agent-chat`, which does not exist in this repo) | Full picture appended to the system prompt, plus last 12 messages and an optional `projectNote`. |
| Clarify questions | `lib/ai/clarify.ts`, called from `api/chat/route.ts:262` | Picture text; asks about capacity and projects. Older path used when `context_slots` is missing. |
| Intent router | `lib/pipeline/intent.ts`, `intent-prompt.ts` | **No student data** by design (cache-stable prompt); date, plan titles and request go in the user message. |
| Understand / draft | `lib/pipeline/understand.ts:183` | Picture. |
| Extend plan | `lib/pipeline/extend-plan.ts:33` | Picture, plus existing tasks of that plan (last 40). No outcomes, no facts. |
| Plan generation | `lib/ai/plan.ts`, `plan-brief.ts` | Brief built from request; not the full picture. To confirm in Phase 2. |
| Path | `api/path/route.ts:506` (579 lines), `path-intake` | Picture. |
| Grill | `lib/context/grill.ts` | Stored slots plus memory string; templates, no AI per question. |
| Daily brief, proactive, voice | `lib/daily-brief.ts`, `lib/proactive.ts`, `lib/voice-handler.ts`, `lib/voice-agent-tools.ts` | `getContextAsString()` or picture. |

Conclusion for Phase 2.4: `buildContextPack()` can wrap and replace `buildStudentContext()`. There are about 14 call sites (grep for `buildStudentContext` and `getContextAsString`). Moving them all in one phase is risky; plan is to introduce `buildContextPack(userId, purpose, projectId?)` and migrate the call sites purpose by purpose, keeping `buildStudentContext` as a thin wrapper until the last one moves.

"Facts used" has nowhere to live: `change_sets` and `ai_decisions` have no such column. `ai_usage` rows carry no request id (`lib/ai-activity.ts:206`).

### Paths and Tangents

- Pages: `app/(app)/tangents/page.tsx`, `tangents/[pathId]/page.tsx`, `tangents.css`. Components in `components/path/*` (3D scene, inspector, scheduler) and `components/tangents/*` (new/delete dialogs). `app/(app)/path/page.tsx` just redirects to `/tangents`.
- API: `api/path` (one large route), `api/path-intake`. Tables `paths`, `path_nodes` (migrations `20260927030000`, `20260928000000`); `tasks.path_node_id` links a step to a node.
- Not in the sidebar or phone nav (confirmed by prompt; I have not yet re-checked `components/AppShell.tsx`, will do in Phase 4).
- Predates Round 3 tokens; needs restyling.

### Auth

- `middleware.ts` (104 lines): public paths `/signin`, `/invite-only`, `/auth/`, `/api/cron/`. A signed-in user whose email is **not** in `ALLOWED_EMAILS` is **signed out** and sent to `/invite-only` (APIs get 403). Signed-out: pages redirect to `/signin?next=`, APIs 401. `/dev/*` bypasses auth only when `NODE_ENV=development`.
- `lib/auth/access.ts`: `isEmailAllowed` fails closed if the env var is empty; `+tag` aliases of an invited address are allowed. `NOT_INVITED` text is returned **before sending a code**, so uninvited emails never get an account today.
- `app/(auth)/signin/SignInForm.tsx` (460 lines): steps email → code → newPassword, methods password / code (a tablist of "Password" and "Email code"), purpose signin / reset. No create-account mode. `CodeInput.tsx` is hard-coded to 6 boxes (`LENGTH = 6`, auto-completes at 6); `app/auth/verify/route.ts:29` rejects any token whose length is not 6. `app/auth/magic-link/route.ts` (37 lines) does not log the Supabase error. Other routes: `callback`, `password`, `password/set`, `recover`, `signout`.
- `app/(auth)/invite-only/page.tsx`: the "You're early" page; copy says "we've signed you out".
- Tests exist for access/errors/password (`lib/auth-access.test.ts`, `auth-errors.test.ts`, `auth-password.test.ts`). No middleware or route-level access tests.

### Bugs from Phase 1, first look (not yet reproduced)

- `/api/tasks` POST wraps everything in a try/catch that logs `e.message` and **returns the raw message to the client with status 500** (`route.ts:162-165`). The real cause is not visible from reading; needs a reproduction after onboarding and planning. Both the leak and the cause are in scope.
- `components/ui/Toast.tsx` is a plain function component (default export at line 63) inside `AnimatePresence`; matches the `PopChild` ref warning.
- `@import` in CSS: `grep` found **none** in `app` or `components` `.css` files, so the two sources are probably `@import` strings inside inlined or generated CSS (font packages, `@fontsource` imports in a CSS file elsewhere, or a `<style>` tag). To be found in Phase 1 with the dev server and DevTools. Not yet located.
- Calendar drag: `components/calendar/WeekView.tsx` already contains pointer-drag code and `lib/calendar-drag.ts` has tests, yet the prompt says dragging does not work. Needs a reproduction before rewriting (Phase 4.1).

---

## Phases and files

Test and check commands: `npm run lint`, `npx tsc --noEmit` (**there is no `typecheck` script**; I will add `"typecheck": "tsc --noEmit"`), `npm test`, `npm run build`. The `test` script lists globs by folder, so new test folders (`app/**`, `middleware`, `lib/student/*`) must be added to it.

### Phase 1: bugs, sign-up, access (no migrations)

- 1.1 `app/api/tasks/route.ts` (+ test), `components/ui/Toast.tsx`, the CSS `@import` sources, console sweep of every main page.
- 1.2 `app/(auth)/signin/SignInForm.tsx` (split into sign-in and create-account parts using `components/ui/SegmentedTabs`), `app/auth/magic-link/route.ts`, `app/auth/callback/route.ts`, `middleware.ts`, `lib/auth/access.ts`, `app/(auth)/invite-only/page.tsx` → waitlist page (rename or keep the URL), new `lib/auth/waitlist.ts`.
- 1.3 `lib/auth/password.ts`, `SignInForm.tsx` (blur/submit validation, calm rule hints).
- 1.4 `app/(auth)/CodeInput.tsx` (6–10 digits, paste, no auto-submit at 6), `app/auth/verify/route.ts`, `lib/auth/messages.ts`, `app/auth/magic-link/route.ts` (server log), tests.
- 1.5 New access tests (middleware and route level) and a `/dev/*` production check.

### Phase 2: context engine foundation

- 2.1 New `lib/student/` (pure): `facts.ts` (`formatFact`, categories, sensitive-content block), `sensitive.ts`; extend `lib/store.ts` fact functions; update `app/api/context/route.ts`, `lib/context-extract.ts`, `lib/ai/import-context.ts`.
- 2.2 `lib/student/observations.ts` (`timeMultiplier`, `completionByHour`, `preferredStepSize`), `lib/pipeline/events.ts` or a new writer; hooks in `api/tasks`, `api/reschedule`.
- 2.3 `lib/context/slots.ts` (slot lists per goal type), `flow.ts` (sufficiency copy, 1–3 per turn), a server-side config, `infer.ts` (read the free-text box first).
- 2.4 New `lib/student/context-pack.ts`; migrate call sites listed above; `lib/ai-activity.ts`, `lib/pipeline/activity.ts`, `components/settings/AiActivity.tsx` show "Used: …".
- 2.5 `lib/pipeline/fixtures/` (swap test, slot coverage), `lib/pipeline/grade.ts`, `scripts/eval-pipeline.ts`. Not run.
- 2.6 Commit, write migrations plus check queries in `docs/MANUAL-STEPS.md` under "Round 4", stop.

### Phase 3: planning flow

`lib/pipeline/intent-prompt.ts`, `intent.ts`, `route-request.ts`, `fixtures/requests.json`; `components/chat/HomeChat.tsx`, `ChatPanel.tsx`, `ChatSheet.tsx`, `components/dashboard/*` (composer), `components/GetToKnowYou.tsx`; `lib/chat/scope.ts`, `api/sessions`; new `components/planning/*` (workspace, "How this plan works"); `components/PreviewWeek.tsx`, `lib/preview-week.ts`; rounds in `lib/pipeline/*`, `lib/ai/plan.ts`, `extend-plan-*`; check-in sheet; round review card; copy sweep for "Goal step"; `lib/project-stats.ts` (+ tests), `components/projects/*`.

### Phase 4: tasks, calendar, Paths

`components/calendar/WeekView.tsx`, `lib/calendar-drag.ts`, month view in `app/(app)/calendar/page.tsx`; `components/AddTaskModal.tsx`, `components/add/*`; calendar day panel (`calendar.css`, `TaskTip.tsx`); `components/AppShell.tsx` (Paths nav), `app/(app)/tangents/*`, `components/path/*`, `components/tangents/*`.

### Phase 5: Home, notifications, settings, You, mapped

`components/today/*`, `lib/today-sections.ts`; `components/NotificationBell.tsx`, `lib/notification-*`, `settings/notifications`; `app/(app)/settings/layout.tsx`, `settings.css`, `components/settings/SettingsFrame.tsx`; `components/settings/WhatTangentKnows.tsx` → "You, mapped" (new `components/settings/you/*`).

### Phase 6: onboarding

`lib/onboarding.ts`, `components/FirstRun.tsx`, `api/onboarding`, `components/settings/SchoolHoursEditor.tsx` → commitments editor shared with Settings → Schedule, `components/GetToKnowYou.tsx`, `lib/school-block.ts`, `lib/load.ts`.

### Phase 7: audit

All changed pages at 390 and 1440 px, light and dark; contrast check; screenshots to `docs/design/screens/round4/`; final report.

---

## Migrations needed (files only; you run them)

Proposed names use `20261108…`; all `if not exists`, own-row RLS. Final contents are decided in Phase 2.

1. `20261108000000_student_facts.sql`: extend `context_entries` into the student model: add `fact_category` (identity, schedule, goals, classes_activities, how_you_work, whats_hard, future, push_style), `fact_source` (said, seen, guessed), `confidence` real, `last_confirmed_at`, `project_id`, `used_count`, `display_text` (second-person cleanup, keeps the original `fact`). Old `category`/`source` checks stay as-is so old rows remain valid. *Reason: Layer 1 without losing existing facts.*
2. `20261108010000_step_events.sql`: new `step_events` (user, task, plan, kind, hour, weekday, props jsonb, created_at) with RLS and an index. *Reason: Layer 2 observation log. Separate from the existing `events` table, which is pipeline funnel data and must not hold student text.*
3. `20261108020000_rounds_and_outcomes.sql`: `plans.round`, `plans.round_started_on`; `tasks.expected_outcome` ("You'll have"), `tasks.personal_reason`; check-in answers go into `step_events.props`. *Reason: Layer 4.*
4. `20261108030000_facts_used.sql`: `facts_used jsonb` on `change_sets` and `ai_decisions`. *Reason: show "Used: …" without storing prompts.*
5. `20261108040000_profile_age_grade.sql`: `profiles.birth_year`, `profiles.grade`, `profiles.push_style`. *Reason: age gate and onboarding. Everything else from onboarding is stored as facts.*
6. `20261108050000_commitments.sql`: new `commitments` (name, kind, repeat rule jsonb, blocks jsonb) with RLS. *Reason: Phase 6 recurring busy blocks with several time blocks and "1st Saturday" patterns, which the current recurring-task model cannot express.*
7. `20261108060000_plan_prefs.sql`: `plans.suggest_after_add` (the per-project "Don't ask again" in Phase 4.2). *Reason: remembered choice.*

Not needed: project chat thread (existing `chat_sessions.scope`/`plan_id` from `20261105040000` already give one thread per project); context box text (stored as messages in that thread); hiding Today's summary (a flag).

Each migration will have a check query in `docs/MANUAL-STEPS.md`. Code must read the new columns defensively (existing `lib/schema-compat.ts` pattern).

---

## Decisions confirmed by the user (2026-11-08)

- **Fact store (conflict 1):** go with the recommendation: extend `context_entries` as the student model, keep `context_slots` for per-project slot state. The user wants the context pack (Phase 2.4) treated as a top priority: whatever makes students feel Tangent really gets them, as long as it is safe.
- **Waitlist (conflict 4):** keep the session; uninvited emails can create an account but never reach the app. A separate marketing landing page for the waitlist will be built later; Round 4 only builds the in-app page they land on.
- **Open sign-up (conflict 5):** accepted, with Supabase rate-limit and CAPTCHA settings listed as manual steps.
- **Under-13 (conflict 3):** keep it as the master prompt says for Round 4: age is the first onboarding question, under 13 shows the friendly stop screen and blocks everything (pages and APIs), storing only a yes/no flag, no deletion. The real fix (age check before sign-in, from the landing page) is committed for Round 5: see `docs/tangent/ROUND5-PLAN.md`, which also holds the full write-up of what can go wrong with the Round 4 version.

## Conflicts between the prompt and the code, and decisions I need

1. **Reuse `context_slots` for facts?** The prompt says reuse and extend `context_slots` and `grill_questions`. `context_slots` is keyed by a fixed slot list with a source check (answer/inferred/default/known), which does not match facts (many per category, source said/seen/guessed). **Recommendation:** extend `context_entries` as the fact store (migration 1), keep `context_slots` as per-project slot state, and have every slot answer also write a fact. Keep `grill_questions` as the queue. Tell me if you want one table instead.
2. **Grill rules change.** `docs/tangent/decisions/2026-11-grill-sufficiency.md` says one question at a time with a check-in after 5. The prompt wants 1–3 per turn and 2–5 total, then "I have enough to start round 1." Aligned with AGENTS.md ("ask until enough"); I will add a short superseding decision note in Phase 2.
3. **Under-13 and "don't create the account".** The spec says do not create the account under 13; the prompt collects age in onboarding, after the Supabase account exists. **Recommendation:** at the under-13 screen, call a server route that deletes the auth user (service-role key, server-only, no `NEXT_PUBLIC_`) and signs out, and store nothing. Needs your OK since it deletes an account.
4. **Waitlist: keep the session or sign out.** I recommend **keeping the session** (middleware already knows the email, so the waitlist page can show it and a Sign out button) with middleware redirecting every page to `/waitlist` and returning 403 for every API except sign-out. It is simpler than the current sign-out-and-redirect and avoids a sign-in loop. Residual risk: a waitlisted user holds a valid Supabase token and could call the Supabase REST API directly for their own rows; RLS limits that to their own empty data. Documented as acceptable for now.
5. **Account creation for uninvited emails changes the security model.** Today uninvited emails never receive a code. Open sign-up means anyone can create a Supabase user (spam, rate limits). Rely on Supabase's email rate limits and CAPTCHA settings (I can't change Supabase settings; I will list them under manual steps).
6. **No `typecheck` script** in `package.json` (prompt expects one). I will add it.
7. **Calendar drag "doesn't work"** while drag code and tests already exist. I will reproduce first; the fix may be small.
8. **"Used: …" and Settings → AI activity** currently show owner-only detail (`lib/pipeline/activity.ts`). Facts-used display must be added for all users but never the prompt; fine, but it changes that file's current owner-only rule only for the facts list.
9. **Memory file says Groq.** The code calls Anthropic through `lib/ai/call.ts` / `callClaude`. No Groq usage found in the audited files; I will treat the memory note as stale and update it at the end.
10. **Council.** Round 4 touches teen privacy, onboarding scope and positioning. You wrote the scope yourself, so I am treating it as decided and implementing it. The two items I would run past `docs/tangent/COUNCIL.md` if you want one: open sign-up with waitlist, and the under-13 account deletion.
11. **Resource-load risk.** Phases 3 and 5 each hold several large UI builds (workspace animation, "map of you"). Commits per phase as instructed; if a phase runs long I will split it and say so in this log.

## Risks

- Migrating about 14 AI call sites to `buildContextPack` can change plan behavior; mitigate by wrapping first and keeping the old text as the pack's base section.
- The sensitive-content filter is heuristic. It will err toward not saving; tested with distress and health phrases.
- Hidden dependency on migrations: every Round 4 read path needs the missing-column fallback and a one-time server warning.
- Paid evals are not run; swap-test quality is **unverified** until you run `npm run eval:pipeline`.
- `CSS @import` source not yet located; a Next/font change may touch every page's typography.

## What would change this plan

- Reproducing `/api/tasks` 500 shows a schema or migration issue instead of a code bug → Phase 1 becomes a manual step.
- You choose one fact table instead of two (conflict 1) → migration 1 becomes a larger rewrite of `lib/context/store.ts`.

## Phase 1 log (2026-11-08)

**1.1 Errors**
- `/api/tasks` 500: not reproduced (needs a signed-in session). Fixed the failure paths instead: request bodies go through `lib/task-input.ts` (bad input is a 400 with a reason, not a 500), store errors keep their code (`lib/store.ts` `fail()`), and the route logs through `lib/server-log.ts` (no emails, task text or tokens).
- Toast `forwardRef` warning: fixed (`components/ui/Toast.tsx`).
- CSS `@import` warning: not reproducible in dev or build; no stylesheet has a late `@import`.
- Console sweep: signed-out pages and `/dev/app/*` are clean. A signed-in sweep wasn't possible (shared Supabase project; no credentials).

**1.2 Accounts and access**
- `/signin` has **Sign in** and **Create account** tabs (`?mode=create` opens the second). Create account: email → code → password (required, no Skip) → app, where onboarding starts.
- Create account on an email that already has a finished account (password set, or created over an hour ago, such as Google) answers "You already have an account. Sign in instead." and switches tabs (`lib/auth/signup.ts`, `app/auth/signup/route.ts`). This deliberately says the account exists; Sign in still never does.
- Access is one pure function, `lib/auth/gate.ts`, used by `middleware.ts` and `withUser`: signed out → `/signin` / 401; not on `ALLOWED_EMAILS` → `/waitlist` / 403, **session kept**; under 13 → `/not-yet` / 403; `/dev` → 404 outside development. `/invite-only` moved to `/waitlist`; the old URL redirects.
- Age is the first onboarding screen (`components/FirstRun.tsx`, neutral list 7 or younger … 19 or older). Under 13 posts to `/api/age`, which sets `app_metadata.under_13` (service role) and nothing else; 13 and up stores nothing on the server (a per-device flag skips the question next time). Full handling is in Round 5.

**1.3 Password fields:** the confirm mismatch shows only after leaving the confirm field or pressing submit. The rules (8+ characters, not a common password, not your email) are listed and turn green as they're met.

**1.4 Codes:** one input that takes 6 to 10 digits, paste-friendly, never auto-submits. Copy: "We sent a sign-in code". A wrong or expired code: "That code didn't work. Check all the digits, or send a new code." Code-send failures in magic-link, signup, recover and verify are logged with the Supabase error code only.

**1.5 Tests:** `lib/auth-gate.test.ts` covers the gate matrix, `/dev` 404, Create account's existing-account rule, the age answer, 6- and 8-digit codes and the password hints. `lib/auth-password.test.ts` now expects uninvited sign-ins to land on `/waitlist`. Checked against the dev server with curl: signed-out pages 307 to `/signin`, `/api/tasks` and `/api/age` 401.

Checks: lint (7 warnings, same as baseline), typecheck, 659 tests, build all pass.

**Not verified:** a real Create account and waitlist sign-in against Supabase, the age screen signed in, and the email's code length. They're in `docs/MANUAL-STEPS.md` → Round 4.

## Phase 2 log (2026-11-08)

Migrations were renamed from the `20261108…` proposals to `20261110…`, and the plan's items 1, 2 and 4 are now `20261110000000_student_facts.sql`, `20261110010000_step_events.sql` and `20261110020000_facts_used.sql`. `step_events` stores fixed columns (`hour`, `weekday`, `minutes`, `actual_minutes`, `code`) instead of `props jsonb`, so free text can't get in. Items 3, 5, 6 and 7 move to the phases that use them. Everything works before the migrations run: the new columns and tables are read defensively, with one server warning each (`lib/schema-compat.ts`).

**2.1 Student model:** `context_entries` stays the fact store (user decision).
- `lib/student/facts.ts` adds the 8 categories, the said/seen/guessed sources, confidence, a cleaned-up second-person `display_text` (the original words are kept), and `prepareFact`/`factView`.
- `lib/student/sensitive.ts` blocks health, mental-health and family-conflict details before anything is saved, and drops vague values.
- Every write path goes through it: `lib/store.ts`, `/api/context`, `lib/context-extract.ts` and `lib/ai/import-context.ts`. Settings → What Tangent knows shows guesses as guesses.

**2.2 Observation log:**
- `lib/student/step-events.ts` writes `step_events` rows. They hold no titles and no notes.
- Events are logged as follows:
  - created: `applyChangeSet` and `/api/tasks`
  - done, skipped and rescheduled: `/api/tasks` and `/api/reschedule`
  - "Not today" with a reason code, and too big: `/api/today`
- Logging is fire-and-forget and never blocks the action.
- `lib/student/observations.ts` turns these rows into three numbers: the time multiplier, completion by hour, and preferred step size. Each number is used only once there's enough data, and then appears in the pack as "HOW THEY ACTUALLY WORK (observed)".

**2.3 Question engine:** `lib/context/goal-slots.ts` handles five goal types: general, exam, creator, club and essay.
- Each goal type has must-have slots and nice-to-have slots.
- It reads the free-text answers first (platform, followers, niche, weak topics, drafts and so on).
- It asks 1–3 questions per turn and at most 5 in total, and every question can be skipped or stopped. When it has enough it says "I have enough to start round 1."
- Student-level answers such as followers or niche are saved as facts with no project, so they are never asked again.
- `lib/context/grill.ts` and `components/add/AddFlow.tsx` use it.

**2.4 Context pack:** `lib/student/context-pack.ts` (pure) and `lib/ai/student-context.ts`.
- Facts are ranked as 0.5 relevance + 0.3 confidence + 0.2 recency. Relevance depends on the purpose, on matching words in the request, and on whether the fact belongs to this project; recency halves every 60 days.
- The pack holds the top 10–15 facts, with guesses labelled as unconfirmed.
- Sections in the pack:
  - this project's state comes first
  - calibration
  - the next 14 days
  - a token budget for each purpose, which drops the least important section first and never drops today or capacity
- Every AI call site uses it with a purpose:
  - chat, grill, path and path-intake
  - questions and extend-plan
  - voice and chat-reply
  - daily brief and proactive
  - voice-agent tools
- The facts shown are recorded for each request:
  - `change_sets.facts_used` and `ai_decisions.facts_used` store id and text only, never prompts
  - the plan preview card shows "Used: …"
  - `used_count` goes up for each fact used

**2.5 Evals:** `lib/pipeline/fixtures/context.json`.
- **Slot coverage:** 8 goals, run free in `npm test` (`lib/pipeline/context-evals.test.ts`). For example, the Instagram goal asks about followers, niche and hoursPerWeek, and "200 subscribers" is never asked again.
- **Swap test:** 2 goals × 2 student profiles. `gradeSwap` checks that each plan mentions its own student and that the two plans share at most 60% of their words. The paid run is `npm run eval:pipeline -- --context` (about $0.08). It was **not run**.

Checks:
- lint: 5 warnings, all existing `exhaustive-deps` ones, down from 7
- typecheck: passes
- tests: 707 pass
- build: passes
- the free check `npm run eval:pipeline -- --context --check`: passes

**Not done / not verified:**
- Settings → AI activity doesn't show "Used: …" yet; only the plan preview card does. That's planned for Phase 5 (Settings).
- The voice agent still falls back to the old context string when the pack fails.
- Nothing has run against the real database, because the migrations haven't been applied.

## Phase 2b log: reading behaviour, and UI pulled forward (2026-11-08)

The user asked for two things before Phase 3. First, the context should read how they work: follow-through, when they work, how they plan with the chat, and what they ask task chats. Second, a set of UI fixes, some of which were pulled forward from Phases 4 and 5.

**Behaviour reading (codes only, never the student's words):**
- **Migration:** `supabase/migrations/20261111000000_step_events_behaviour.sql` widens the `step_events` kind check. The new kinds are `chat_ask`, `plan_accept`, `plan_edit`, `plan_reject`, `plan_stop`, `question_answer` and `question_skip`.
- **Before the migration runs:** the old check rejects the new kinds with error 23514. `lib/student/step-events.ts` then logs one server warning, stops sending behaviour rows, and still writes the step rows.
- **Where events are logged:**
  - A task chat logs `chat_ask` with the question's type: how_to, explain, check, stuck, time, motivation or other. `classifyAsk` assigns the type.
  - When the plan is drafted, the planning questions log one `question_answer` or `question_skip` per slot (the slot name in snake_case), plus `plan_stop`.
  - Preview Confirm, Edit, Discard and Undo log `plan_accept`, `plan_edit`, `plan_reject` and `plan_reject` with the code `undo`.
- **What the AI sees:** `behaviourLines` in `lib/student/observations.ts` turns these into plain lines under "HOW THEY ACTUALLY WORK":
  - follow-through rate and the usual "Not today" reason
  - best weekdays and how much happens on weekends
  - whether they take, change or turn down plans
  - whether they answer or skip questions, and repeated Stops
  - what they ask task chats about, each with a matching piece of advice
- **Thresholds:** each line stays silent until there's enough data (6 due steps, 8 done steps, 3 plans, 4 questions, 3 asks).
- **New "Not today" reasons:** unclear, not_feeling_it and blocked, for Phase 3.4.
- **Tests:** `lib/student/behaviour.test.ts`.

**UI pulled forward:**
- **Home:** `/` sends you to the big-mic Home (`/capture`) the first time you open the app in a session, using the `tg_entered` cookie set by `lib/entry.ts`. `manifest.ts` starts there too.
- **Paths:** reached from Projects (sidebar link and a pill). The Paths map follows light and dark mode (4.4).
- **Widths:** new `--content-max` 1120px and `--content-read` 760px; Today is 880px; `docs/design/TANGENT-STYLE.md` is updated.
- **Calendar:** gets a side rail at ≥ 1280px (`components/calendar/CalendarRail.tsx`). It shows the next 7 days in plain lines and an "Ask about your week" box. The box grows on focus and sends the question to the Home chat.
- **Settings:** a 220px sub-nav and 760px content (5.3).
- **What Tangent knows:** now "You, mapped" (5.4).
  - Files: `lib/you-map.ts` and `components/settings/YouOrbit.tsx`.
  - A slowly turning sphere of facts around the student's initials, with one colour per area. You can drag it, and it turns to face the card you scroll to.
  - Origins read "You said", "Tangent noticed" and "Guess, confirm?".
  - Each fact has Confirm, Edit and Forget.
  - Reduced motion stops the spin.
- **Not built here:** the chat expanding as you type, and the calendar beside the chat. Both are part of the planning workspace (3.3), so they're built once, there.

**Conflict, recorded:** the master prompt's 5.1 keeps Today as the home page and reaches capture from it. The user's newer instruction says the big-mic Home is the first screen after onboarding and on every app open. Following the newer instruction (AGENTS.md: most recent user-confirmed information wins). Today is still one tap away in the sidebar and bottom nav.

**Manual step:** run migration 4 in `docs/MANUAL-STEPS.md` (Round 4, Phase 2b).


## Phase 3 log: planning flow (2026-11-08)

**3.1 Intent fixes.** `lib/pipeline/planning-intent.ts` reads "break down…", "make a plan/path for…", "help me…", "steps to…" and "how do I get…" as planning, never as a task with that literal title. The onboarding goal is sent with `planRequestFor`, so it always plans. Tests: `lib/pipeline/planning-intent.test.ts` plus new fixtures in `lib/pipeline/fixtures/requests.json`.

**3.2 One chat, in place.**
- Planning started in the Home composer (a typed or spoken goal, or the onboarding goal) continues in that composer: it opens into the planning workspace (3.3) instead of moving to another page.
- When the plan is confirmed, the talk that made it is written into the new project's one thread (`lib/chat/seed-thread.ts`), in order: the request, each question and answer, the "Tell me anything" text, and a "Planned round 1" line. A thread that already has messages is left alone. Best effort: a failure only means the thread starts empty.
- The project's Chat panel shows "Earlier conversations (N)" when the thread spans more than one sitting (3 hours apart, `lib/chat/history.ts`); each entry scrolls to that sitting.

**3.3 Planning workspace** (`components/add/PlanWorkspace.tsx`, `components/add/AddFlow.tsx`).
- **Opening:** opens when Tangent asks planning questions or drafts a plan (a new project or more than one step). The composer grows in place with Motion `layout` (spring, about 300 ms; no animation with reduced motion), and Today widens to 1200px while it's open.
- **Left pane:** the conversation so far, the current question card, then "Tell me anything about this: your schedule, what you've already done, what's hard". That text is sent with each request as "More about this: …". The reply box sits under them.
- **Right pane:** the calendar preview (month by default, plus week). New steps show in the project colour and existing items as grey dots. Below it, "How this plan works" says what round 1 gets you, what the plan is based on (facts used and assumptions), and "When you finish these, tell Tangent how they went and it plans the next round."
- **Draft card:** in the workspace, the preview card hides its own calendar and lists its lines instead.
- **Phone (under 768px):** stacked panes behind Chat / Plan tabs.
- **"Plan it" | "Just talk":** a segmented toggle.
  - "Just talk" sends `talk: true`, and `/api/chat` answers with `planReply` only, so nothing is added.
  - A draft or question on screen stays there through a talk reply.
  - The distress guard still runs first, and its kind reply appears in the conversation.
- **Calendar popover:** the hover tip shows the full title, date and time, and the note ("why"). `placeTip` moves it sideways to stay inside the pane or viewport, and flips it above the step when there's no room below. Tapping a day still opens the day sheet.
- **Skip and Stop:** now quiet text buttons, still 44px tall. "Stop planning" is renamed "Stop and plan", because it drafts with what Tangent knows.

**3.4 Rounds** (`lib/rounds.ts`, `app/api/rounds/route.ts`, `components/projects/RoundReview.tsx`).
- **Storage:** a project planned in rounds has a `Round — N · started YYYY-MM-DD` description line. Each step can have a `YOU'LL HAVE: …` notes line, shown as "You'll have" on the task row and in task detail. No migration.
- **Review card:** shows on the project once 70% of the round is done or its last step day has passed.
  - It summarises check-in and "Not today" codes in plain sentences. Codes only; the student's words are never used.
  - "Plan round N" drafts the next week (3 to 7 steps) as a preview. Confirming it advances the round line.
  - "Not now" hides the card until the next round.
- **Event:** `round_reviewed`.

**3.5 Wording.** Flexible/plan steps are now "Goal step" everywhere (`lib/task-kind.ts`, CONTEXT.md glossary: Goal step, Round, Check-in; PROJECT.md).

**3.6 Project page fixes.** `lib/project-stats.ts` no longer calls a new project "Behind". Before the first step's date it says "Starts today / tomorrow / Tue, Nov 10" (regression tests in `lib/project-stats.test.ts`). The round chip replaces the end-date chip. "You'll have:" shows under each step on hover or expand. The workload chart uses whole or half hours ("about 5 hrs", `hoursLabel`).

**Checked in the browser** (signed-out `/dev/app/today` preview, with `/api/chat`, `/api/changesets` and `/api/sessions` mocked so no model calls were made):
- **Planning flow:** ask → answer → draft at 1440px. The tip stays inside the pane on the last column.
- **Phone:** Chat / Plan tabs at 390px.
- **Just talk:** sends `talk: true`, with no capture or clarify.
- **Close:** returns to the plain composer.
- **Thread seeding:** confirming writes the expected seven messages to `/api/sessions`.

**Known gaps:**
- **Undo after advancing a round:** undoing the round-2 preview after Confirm leaves the round line advanced, so the review card won't reappear for that round. Rare, and fixable from the project description.
- **Onboarding hand-off:** the onboarding goal plans in the Today composer (`/`). If the student opens the big-mic Home first, the goal waits in sessionStorage until they open Today in the same session.
- **Workspace scope:** the workspace is Home-only. The ⌘K sheet and the Projects starter keep the compact flow, because a two-pane layout doesn't fit a sheet.
- **Not checked live:** the real model path. Run `npm run eval:pipeline` (paid) to check the planning intent fixtures.
