# Needs Sid's approval (gated work; nothing here was built)

## TOP OF LIST: the Anthropic credit balance is empty
- During the 4.3 after-eval the API began returning `Your credit balance is too low to access the Anthropic API` (about 39 calls in). Add credits (Plans & Billing) before the demo or the pilot; until then every AI feature fails for every student. Then re-run `echo y | npm run eval:pipeline` (about $0.30) for the real after-numbers. See DECISIONS D6.

Gates: billing/payments, auth/sign-in logic, data deletion, database schema.


## Privacy: test email visible in Phase 1 baseline screenshots (git history)
- Found at ~03:20 while judging: six baseline screenshots of the Account page showed the test account's email in clear (`docs/overnight/screens/before/settings-1440-{light,dark}.png`, `settings-account-1440-{light,dark}.png`, `settings-account-390-{light,dark}.png`).
- Fixed in the working tree tonight (email region masked with a bar; viewed afterwards: settings-1440-light.png, settings-account-390-dark.png).
- NOT fixed in git history: commit `965c0fb` (Phase 1) still contains the unmasked versions. Nothing was pushed. Before any push, decide whether to rewrite that commit (I did not, history rewrite is destructive and not in tonight's scope).
- Rule going forward: no screenshot of /settings or /settings/account without masking first.


## Group 3 gated and deferred items (from JUDGMENT-1)

### C06. Public Privacy, Terms and "For parents" pages, plus sign-in footer links
- Why gated: today `/privacy`, `/terms`, `/pricing`, `/parents` do not exist as pages (checked in 4.4: `git ls-files` finds none), and signed-out visitors to any unknown path are sent to `/signin`. The route guard is sign-in logic, so I did not touch it.
- Exact change needed: `middleware.ts` calls `skipsSessionCheck(pathname)` from `lib/auth/gate.ts` first. Add the four static paths (`/privacy`, `/terms`, `/pricing`, `/parents`) to that function (same way `/auth/*` is handled) and add a `gate.test.ts` case that a signed-out request for each returns "next", not a redirect. No other auth logic changes.
- Then: new static pages under `app/(public)/...` (own layout, no AppShell) and a footer row on `/signin` with the four links.
- Draft copy (plain words; every line marked CONFIRM needs Sid to say it is true before it ships):
  - **What Tangent keeps:** your tasks, plans and steps; the short notes you tell it about how you work (you can read and delete these in Settings, "What Tangent knows"); your Canvas calendar link and the due dates it brings in, if you connect Canvas; your email, for sign-in. CONFIRM the list is complete (age or birth year is also stored for the under-13 gate).
  - **Who sees it:** you. Tangent staff do not read your plans. CONFIRM who has database access.
  - **AI:** your words and the plan context go to Anthropic's Claude to write replies and plans. CONFIRM Anthropic's current API terms (no training on API data by default) and name the exact page.
  - **Deleting it:** Settings, "Delete all my data". CONFIRM this also removes the stored Canvas link and synced items (see the disconnect item below).
  - **For parents:** what the app does in two lines, what it never does (no ads, no selling data) CONFIRM, how to ask for deletion (contact address: Sid to supply).
- Also needed before App Store: a privacy policy URL (App Store Connect), see `LAUNCH-REVIEW.md`.

### C23. Stale first name pre-filled after a reset
- Seen once: the first-name field pre-filled with the previous persona after the test-account reset. Most likely a test artifact (same browser profile and account reused between simulations), not confirmed.
- Next step for Sid: sign in on a fresh browser profile, run Settings, "Delete all my data", reload, and check the name field. If it is not empty, the cause is in the reset path (`resetUserData` in `lib/store.ts`) and the fix is a data-deleting change, so it stays gated.

### Disconnect Canvas / Google that deletes the stored token and synced data
- Today there is no per-connection disconnect. "Delete all my data" is the only removal (copy now says so, C16).
- Plan: a "Disconnect" button per connection that (1) deletes the stored token or feed URL row, (2) optionally deletes items synced from it, asking first ("Remove the 14 Canvas items too?"), (3) confirms in plain words. This deletes user data, so it needs Sid's go-ahead. Details in `docs/overnight/CONNECTORS.md`. A standalone Disconnect is the only gap: Delete all my data already removes `canvas_feeds` (`resetUserData`, `lib/store.ts`).

### Permanent dismiss of the Canvas offer on Home (C14)
- The quiet "Not now" on Home's Canvas row is remembered in the browser (localStorage) only, so it comes back on a new device. A permanent dismiss needs a column on the user's settings table (schema, gated). Proposed: `canvas_offer_dismissed_at timestamptz` on the user prefs table. Migration draft to follow in `docs/overnight/proposed-migrations/` if Sid wants it.

### Task category stored on the task (C20)
- Tonight's fix classifies school work by title and calendar at display time (`taskView` in `lib/task-filters.ts`) and treats timed practice, games and appointments as busy blocks (`isBusyBlock` in `lib/task-kind.ts`). Nothing stored changed.
- A stored per-task category the student can correct ("This is school work") would need a schema column. Not built; only worth it if the title rules prove wrong often in the pilot.

### C21 and C22 (LATER, short specs)
- C21 "follow-up loop never seen working": the "Next: ..." line after Done or Skip is built (C08, C11). Remaining: a seeded two-day demo account where a check-in answer visibly changes the next step, and the day-2 bubble.
- C22 "capture-to-plan wait up to 30 s": the progress note ("Still working. Longer plans can take up to 30 seconds.") is built (C09). Remaining: log the time of each Placing call, then show the first draft step before the full plan.

## Connectors (Phase 4.2)
- **Confirm `CANVAS_FEED_KEY` is set in Vercel (production and preview).** `lib/canvas-feed-security.ts` only encrypts the stored Canvas feed URL at rest when it is set. I cannot read env files or Vercel settings. If it is missing, feed URLs (each embeds a private token) sit in the database as plain text. Setting it also means existing feeds need one re-save (students reconnect, or a script re-encrypts). Not touched tonight.
- **Per-student Gmail and Google Calendar (gated: auth, schema, OAuth scopes).** Today they use one env refresh token and work for the owner only. A student version needs a Google OAuth consent screen and verification; a `google_connections` table (user_id, encrypted refresh token, scopes, connected_at; RLS own rows; included in reset and export redaction); refresh and revoke handling; a Disconnect that deletes the token. Suggested scopes, smaller than the owner's: `calendar.freebusy` (or `calendar.events.readonly`) and `gmail.metadata`. Gmail scopes need Google's sensitive-scope review. No scope was changed tonight.
- **Rotate the owner Google refresh token** if it was ever pasted outside the server environment (I found no sign of that in the repo).

## Context review (Phase 4.3)
- **Apply `proposed-migrations/20261118000000_ai_usage_task.sql`** (one nullable `ai_usage.task` column). Cost per task is only readable from logs today because several tasks share one `feature` (`plan` covers planBrief, planOutline, planDetail, planFix). After it exists, `recordUsage` in `lib/ai/call.ts` can pass the task name (a one-line change I did not make, since the column is not there yet).
- **Observed habits are invisible and survive "Forget everything" (gated: data deletion).** The context pack's "how you work" lines (`calibrationLines`, `behaviourLines` in `lib/student/observations.ts`) are computed from `step_events`. The student cannot see them in "You, mapped", and "Forget everything" (`clearContextEntries`) clears only `context_entries`. Only Settings, Your data, "Delete all my data" clears `step_events`. Plan: (1) show those lines in "You, mapped" as "Tangent noticed" rows ("You finish most steps in the evening"), computed server-side from the same functions; (2) make "Forget everything" also delete `step_events` (a data-deletion change, so it needs your approval and a test against a throwaway account). Until then the student can still remove everything with "Delete all my data".

## Launch review (Phase 4.4), see `LAUNCH-REVIEW.md`
- **Rotate the pen upload key (`PEN_KEY`).** The pen server (`D:\TANGENT showcase\tangent-pen-server\`, separate repo) reads it from the environment and the pen firmware holds the same value (`X-Pen-Key` header). The showcase `README.md` (line 73) shows a 64-character hex value as an "example"; if it was ever the real key, treat it as exposed. Steps: generate a new key, set `PEN_KEY` in the deploy environment, flash the pen, delete the old value from the README. Rotate the server and the pen together (old key returns 401 after the change). Longer term: per-device hashed keys in `pen_devices` so one pen can be revoked.
- **`D:\TANGENT showcase\TANGENT google cloud secrets.json`** sits outside any git repo. I did not open it. Keep it out of zips and shares; rotate those Google credentials if it was ever sent anywhere.
- **Create a reviewer demo account** (allowlist, sample data, AI credits on) and publish a privacy policy URL before any App Store submission (Apple 2.1(a), 5.1.1(i)).
- **Decide:** Sign in with Apple (4.8) vs dropping Google in the wrapper build; how a parent pays (IAP vs free pilot vs web, explained in LAUNCH-REVIEW section 3); Kids Category (not recommended for a 13+ app).
- **Confirm in the Supabase dashboard** that every table shows RLS enabled (I could only read the migration files).
- **Security headers (optional, ungated):** add `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and a tested CSP to `next.config.mjs` `headers()`. Not built (report-only phase).
- **Rate limits:** no per-route throttle besides the daily AI budget. Proposal: a small per-user and per-IP limiter on `/api/chat`, `/auth/*` and capture routes before the beta opens beyond the allowlist.
- **Offline:** no service worker. Proposal: an offline page now, a queued capture later.
- **Consent line for third-party AI and voice** (Apple 5.1.2(i)): onboarding sentence naming Anthropic (text) and Deepgram (audio).

## Post-event reviews (Phase 4.5): plan only, nothing built except a static mockup
Gated: database schema (two new tables), privacy (the student's own reflections), data deletion (reset and export must include them). Migration draft: `docs/overnight/proposed-migrations/20261118010000_event_reviews.sql` (not applied). Mockup, sample data only, development server only: `/dev/app/review-mockup` (screenshots `docs/overnight/screens/review-mockup-390-{light,dark}-N.png`, `review-mockup-1440-light-N.png`; the dev page is a signed-out/sample-data view, not a check of any real data).

**What it is.** After an event the student cares about (a test, a presentation, a game), Tangent asks 2-3 short questions about how it went, keeps the answers as the student's own takeaway, and uses them in the next plan ("last test you ran out of time, so the practice run comes first"). It fits capture → plan → done: it makes the next plan better. It is not a new AI surface: it is one card on Home, answered in place, plus one section inside the existing "You, mapped" page.

**1. Detecting the event (reuse, no new parser).**
- Canvas items (`source: canvas`) and calendar imports (`isCalendarImport`) whose title matches test/quiz/exam, presentation, performance, game/match, competition, interview, or a project due date. Captured tasks too, through the same title rules `classifyTaskKind` and `isBusyBlock` already use (`lib/task-kind.ts`, PRACTICE_AS_EVENT, SHOW_UP_WORDS, GRADED_WORK). Ambiguous titles use the existing low-cost `classifyWithAsk` (Haiku) path, or are simply not asked about.
- Event end = the task's end time, else the start plus a default length per type. Eligible 1-3 hours after the end.
- Never reviews appointments, health items or personal-calendar items by default (the type list above is the whole list).

**2. Opt-in and timing.**
- Off by default. A settings row per event type (mockup section 1). No row = nothing is ever asked.
- Never inside the student's quiet hours (`isQuiet` in `lib/settings/notification-prefs.ts`, default 22:00 to 07:00), and never while another busy block is running (`isBusyBlock`). At most 1 a day, enforced by a unique index (user, date) in the proposed table. Expires after 48 hours with no nagging. Two "Not now" in a row for a type: ask once whether to turn that type off.
- Appears as a Home card (mockup section 2) the next time the student opens the app; a push only if they already allow notifications, and then at most that one. Today stays scannable in 3 seconds: one card, one line, only when due.

**3. The questions (under a minute, voice or typing).**
- 2-3 questions, each with chips plus "Say or type your own" (the existing mic and capture input), and a **Skip** and a **Stop** that never block (product guardrail). Stop ends the whole review and records `stopped`.
- **Free tier: fixed questions**, chosen by event type (for a test: "How did it go?", "What got in the way?", and one about next time). No AI call needed to ask them.
- **Paid tier: AI follow-ups.** One Haiku or Sonnet call writes the third question from the student's earlier answer and the context pack (mockup section 4). Never a long chat; a hard stop at 3 questions.
- Answers pass the existing write-time refusal of health and family facts before saving.

**4. Storage and use.**
- `event_reviews` row per review, linked to the event (`task_id`, with the title copied so it survives deletion) and the goal (`plan_id`), plus a one-line takeaway. Private: own-rows security only, no sharing field, nothing shown to teachers or parents.
- Feeds the context pack as a short "after past events" line (the pack already fits a token budget per purpose), and the planner may use it ("put a practice run of the last questions first"). The student sees that use in plain words.
- **Weekly "what you've learned"** (mockup section 5): inside You, mapped, not a new nav item. Every line editable and deletable. "Forget everything" and "Delete all my data" must clear both tables (code change in `resetUserData` and the export, gated; also close the 4.3 gap that observed habits survive "Forget everything").

**5. Cost per student per month (estimate, from the 4.3 measured per-call costs, not billing).**
- Assumptions: 12 reviews a month (opt-in types, at most 1 a day, so at most 30); Haiku 5.5 $0.10 in / $0.50 out per million tokens, Sonnet 5.5 $2 in / $10 out (`PRICES` in `lib/ai/models.ts`); the 1,700-token context pack measured in 4.3; a voice answer of about 40 seconds. **The Deepgram rate is an assumption (about $0.0043 per audio minute from memory); confirm the current price on Deepgram's pricing page.**
- Free tier: one Haiku call to write the one-line takeaway (about 600 in / 150 out, about $0.00014) plus voice (about $0.003 if every answer is spoken). About **$0.04 a month** (12 reviews), $0.09 at the 30 a month ceiling.
- Paid tier: add two Sonnet follow-ups (about 1,700 in / 150 out, about $0.005 each) per review and one weekly digest call (about 2,500 in / 400 out, about $0.009, 4 a month). About **$0.20 a month** at 12 reviews, $0.43 at 30.
- The existing per-user daily AI budget (429) already caps runaway use. Reviews add no polling cost: detection is rule-based and runs where tasks are already loaded.

**6. Risks and what would change this.**
- Reflection prompts can feel like a school form or pressure after a bad grade. Keep wording neutral, never mention grades or scores, no streaks. Pilot test: if students skip or Stop more than about half the time, shorten to one question or drop the type.
- A 13-17 audience: the answers are personal. Private by default, deletable, not used for anything but the student's own plans; the privacy policy (C06) must describe it. Do not ship before that page exists.
- Evidence that would change this: pilot skip rate, and whether the next-plan change students see ("practice run first") is something they notice and keep.

**Decisions for Sid:** build it at all; free fixed questions only vs also the paid follow-ups; apply the migration; whether the weekly view belongs in You, mapped (recommended) or Today.

## Phase 5 heuristic round 2 leftovers (see `user-simulation-tests/heuristic/results/2026-11-18-heuristic-tangent-localhost-site-round2.md`)

Ask: decide wording and owner; nothing below was built.

- **F11, no privacy, safety or help information on sign-in or Settings.** Same root as C06 above and the top blocker in `LAUNCH-REVIEW.md`. Ask: approve (or write) the Privacy, Terms and "For parents" copy so a sign-in footer and a Settings "Help and privacy" row can link to real pages.
- **F05/F06, removal verbs and confirmations.** "Forget", "Clear", "Delete" and "Remove" are used for different things on What Tangent knows and Your data; the round-2 capture did not show a confirmation step (a confirmation may exist, it was not captured). Deletion is gated, so nothing was changed. Ask: pick one rule (suggested: Delete = removed from Tangent's servers, Clear = this device only) and confirm each destructive action asks first.
- **Small, not built (low risk, left for a later pass):** F07 icon-only controls need visible or accessible labels; F03 "Personal" vs "Short-term" filter names differ between Home and Calendar; F04 the "Done" label differs between screens; F09 the You-map repeats the same counts three times; F02 "Tangents" label and where it sits (product naming, ask Juann).
