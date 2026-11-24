# Connectors (overnight Phase 4.2)

Every integration found in the code, how it works, and what a student sees when it breaks. Read from the code on 2026-11-18; nothing here is from production settings (I cannot read `.env*` or Vercel/Supabase). Items I could not confirm are marked **UNKNOWN** and listed in NEEDS-SID.

## 1. Summary

| Connector | Who gets it | Connect | Token stored | Sync | Scope |
|---|---|---|---|---|---|
| Canvas calendar feed (iCal) | Every student | Paste feed link (2-step guide) | Feed URL in `canvas_feeds.ics_url`; encrypted only if `CANVAS_FEED_KEY` is set (**UNKNOWN in prod**) | On connect, on app load when older than 6 h, daily cron | Read-only by nature (a private calendar link) |
| Calendar file import (.ics from Google, Apple, Outlook) | Every student | Choose a file in Settings | Nothing: events become normal tasks | Once, when the file is chosen | None (no account link) |
| Sign in with Google | Every student | Button on sign-in | Session cookies, handled by Supabase Auth | Not a data connector | Supabase default (name, email, profile) |
| Gmail (agent tools) | **Owner only** (the builder's account) | Server environment variables | One env refresh token for the whole app | On each question | `gmail.readonly` |
| Google Calendar (agent tools) | **Owner only** | Server environment variables | One env refresh token for the whole app | On each question | `calendar.readonly` |
| Pen (Raspberry Pi) | Pen owners | Device key | `pen_devices.device_key_hash` (hash only) | Pen pushes | n/a |

Students never see Gmail or Google Calendar: `currentUserIsOwner()` in `lib/request-context.ts` gates the tools, and a student asking gets a "coming soon" payload (`GOOGLE_COMING_SOON` in `lib/voice-agent-tools.ts`). Per-student Gmail/Calendar is the biggest connector gap (sections 2 and 7, and NEEDS-SID).

## 2. Per connector

### Canvas calendar feed
- **How a student connects.** Settings, Connections (or Home's Canvas row, or School's empty state) opens the guide. Tonight it went from three steps to two: "Find your Calendar Feed in Canvas" (one screen, one image), then "Copy your feed link". The paste box is now on both steps, so a student who already has the link pastes it and taps Connect straight away (`components/CanvasConnectGuide.tsx`). The link is validated and the first sync runs in the same request (`POST /api/canvas/connect`), with the student's time zone so due times land on the right day.
- **How the token is stored.** The private feed URL (it embeds a secret token) is saved per student in `canvas_feeds` (RLS "own rows"). `lib/canvas-feed-security.ts` encrypts it at rest when `CANVAS_FEED_KEY` is set. It is never sent back to the browser: the status route returns only a masked URL (`maskCanvasFeedUrl`), and the data export redacts `ics_url` (`lib/settings/data-export.ts`).
- **How sync works.** `syncCanvasFeed` (`lib/canvas-ics.ts`) fetches the feed with an SSRF guard, parses it, and upserts tasks with `source: "canvas"` from three weeks back onward. Triggers: connect, `GET /api/canvas/connect?ifStale=6` fired once per app load by `AppShell`, and the daily cron `GET /api/cron/canvas`.
- **Expiry or outage.** A Canvas feed link stays valid until the student regenerates it. A dead link (regenerated, school changed Canvas) raises a `CanvasFeedError`; an outage times out. **New tonight:** one quiet retry (1.5 s on app load, 3 s in the cron) before anything is reported (`lib/canvas-retry.ts`, 4 tests in `lib/canvas-retry.test.ts`).
- **What the AI uses.** The agent's Canvas tool reads the synced tasks (`get_canvas_deadlines`); the planner reads them as ordinary tasks (section 5). The AI never sees the feed URL.
- **What a student sees on failure.** Before tonight: nothing (errors were swallowed), the calendar just went stale. Now, after the retry also fails: one line on School and on the Settings Canvas row, "Canvas didn't update. Your last assignments are still here.", and the button becomes a primary **Reconnect** that reopens the guide. A later good sync clears the message. The flag lives in `sessionStorage` for the tab, so it shows once per session and is not nagged on every page.

### Calendar file import
- Settings, Connections, "Google, Apple or Outlook calendar": the student exports an .ics file and chooses it. The next two months of events become normal calendar items (no account link, no token, nothing to expire). They are deleted from the calendar like any item. A file that cannot be read shows an inline error in the control.

### Sign in with Google
- `app/(auth)/signin/SignInForm.tsx` calls `signInWithOAuth({ provider: "google" })` with no extra scopes, so it asks only for the Supabase default (name, email, profile). Session tokens live in Supabase's cookies. Callback: `app/auth/callback/route.ts`. If it fails the student sees "Couldn't start Google sign-in. Try again." and email sign-in remains. It is not a data connector; the app never calls a Google API with this login.

### Gmail and Google Calendar (owner-only)
- `lib/gmail.ts` and `lib/calendar.ts` use one refresh token from `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` in the server environment, exchange it for a short-lived access token (cached in memory), and only call read endpoints. Both files state in a header that they must never gain a write scope. A missing variable produces an error for the owner only; students get the "coming soon" payload.
- Because the token is one for the whole app, **this cannot be offered to students as is**. Offering it needs per-student OAuth (consent screen, token storage, refresh, revoke): auth plus schema plus scopes, so it is gated (NEEDS-SID).

### Pen
- `pen_devices` stores only a hash of the device key (RLS own rows; included in "Delete all my data"). The shared plain-text key issue is a Phase 4.4 item.

## 3. Security review (tokens never in logs or client code)

Checked by reading the code and grepping, not by a scanner:
- **Logs:** the `console.error` calls in the Canvas routes, the cron, `lib/gmail.ts` and `lib/calendar.ts` print `e.message` or a fixed string; none prints the URL or a token. The new failure paths use fixed text.
- **Client bundle:** `ics_url`, `GOOGLE_*` and `CANVAS_FEED_KEY` are referenced only in server files (`lib/`, `app/api/`); the browser gets `connected`, a masked URL, counts and timestamps. The retry flag in `sessionStorage` is a boolean.
- **Export and reset:** export redacts `ics_url` and `device_key_hash`; "Delete all my data" (`resetUserData`, `lib/store.ts`) includes `canvas_feeds`.
- **Open, not a leak:** the feed URL is plain text in the database when `CANVAS_FEED_KEY` is not set (**UNKNOWN**; NEEDS-SID asks Sid to confirm it is set in Vercel). No leak was found, so nothing needed fixing.

## 4. Minimum permissions

| Connector | Scope asked | Could it be smaller? |
|---|---|---|
| Canvas | A private calendar link; read-only by nature | No. It is the smallest Canvas offers (no OAuth) |
| Calendar import | None | n/a |
| Google sign-in | Supabase default: openid, email, profile | Already minimal |
| Gmail (owner) | `gmail.readonly` | For a student version, `gmail.metadata` (headers only) would cover "did my teacher email" without bodies. Changing scopes is gated |
| Google Calendar (owner) | `calendar.readonly` | `calendar.events.readonly` or `calendar.freebusy` would suffice for planning. Gated |

No scope was changed tonight.

## 5. Planner use of connector data (built tonight)

What the planner already did: Canvas items are tasks, so they count 45 minutes on their due date in the day-load maths (`dayLoad`), and they are skipped when time-blocking because a due time is a deadline, not occupied time (`dayBusy` in `lib/schedule-slots.ts`). Imported calendar events are ordinary tasks, so they count toward the day and hold their time slot, and steps are placed around them (`firstOpenTime`).

What was missing: a step could land on the evening before a Canvas deadline because that day looked empty. **Built:** `canvasEveMinutes` in `lib/load.ts` adds half of next-day Canvas minutes to a day's score when `placeTask` picks among days, so equal days resolve away from the eve of a deadline. It only nudges: a day the student or model asked for that still fits is kept. Tests in `lib/load.test.ts` (4 new): eve minutes counted (and only for undone Canvas items), a step avoids the eve, an asked-for day is kept, a step lands after an imported calendar event.

Not built: Google Calendar events reach the AI tools for the owner but not the planner (they are not stored as tasks). Making them planner input needs the per-student connector first.

## 6. Failure UX, in one place

| Situation | Student sees |
|---|---|
| Canvas slow once | Nothing (quiet retry) |
| Canvas down or link dead after the retry | One line plus Reconnect on School and Settings, once per session |
| Pasted link is invalid | A plain error in the guide ("That calendar feed couldn't be read. Copy a fresh Calendar Feed link ...") |
| Student asks the chat about Gmail or Google Calendar | A "coming soon" answer, not an error (`lib/source-read.ts` keeps the source line honest) |
| Not connected, asks about Canvas | "No Canvas items yet", plus the connect offer on Home |

## 7. Connectors to add next (ranked)

Ranking is value to a high schooler, then effort. Privacy notes assume the Canvas rule: connect only on request, read-only, deletable. Not built.

| # | Connector | Value | Effort | Privacy notes |
|---|---|---|---|---|
| 1 | Apple Calendar / iCloud via a subscribed .ics link | High on iPhone: many teens live in it | Low (same pattern as Canvas: a link, no OAuth) | A private link like Canvas; reuse the SSRF guard |
| 2 | Schoology / Blackboard / Brightspace feeds | Medium, school-dependent | Low (most expose an iCal feed; reuse the Canvas path) | Same as Canvas |
| 3 | Google Classroom (assignments and due dates) | Very high: the common alternative to Canvas | Medium (OAuth, `classroom.coursework.me.readonly` plus `courses.readonly`; school admins may block third-party apps) | Needs per-student token storage |
| 4 | Google Calendar, per student | High: practices, work and appointments become busy blocks | Medium (OAuth, `calendar.freebusy` or `calendar.events.readonly`, refresh) | Free/busy only would hide event titles |
| 5 | iOS Share Sheet / PWA share target | Medium: capture from anywhere | Medium (needs the wrapper or a PWA share target) | The student chooses each share; nothing is read passively |
| 6 | Gmail, per student, metadata only | Medium: "did my teacher email back" | High (Google sensitive-scope review; school accounts) | Highest sensitivity; headers only if ever built |
| 7 | Notion / Docs | Low for most high schoolers | Medium | Partly covered already by pasting into "What Tangent knows" |

Recommendation: 1 and 2 first (cheap, same pattern, no OAuth review), then 3 and 4 once per-student OAuth storage exists. Classroom is the largest audience but depends on the OAuth work, so it follows it.
