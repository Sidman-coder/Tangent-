# TANGENT Project

Last reconciled: 2026-09-27

## Identity

**One-line pitch:** TANGENT is an AI-powered productivity system for high school students—a web app paired with a custom voice-recording pen—built for the moments when a phone cannot be there to capture a thought.

**Tagline:** Say it. Capture it. Build it.

**Mission:** Make capture frictionless, then use the student's real school context to turn captured thoughts into organized, actionable work.

**Primary audience:** High school students balancing classes, extracurriculars, sports, and personal projects. TANGENT is intentionally not positioned as productivity software for everyone.

## Product boundary

TANGENT has two connected products:

1. **Web App:** receives typed or spoken captures, understands tasks and constraints, and helps the student plan and reprioritize.
2. **Pen:** a dedicated voice-capture device for classrooms, transitions, activities, and other moments when pulling out a phone is impractical.

The product is not an AI counselor, therapy product, family surveillance system, or autonomous school decision-maker. TANGENT may help a student understand workload and priorities without adopting those categories.

## Team

- **Sid:** software lead; web app, AI pipeline, integrations, and product direction.
- **Juann:** hardware co-builder; prototype pen and production-intent hardware workstream.

## Current software state

The repository is a Next.js 14 and TypeScript application. Current code and user-provided context establish the following:

- A first-run onboarding flow collects the student's name, whether they are a high school student, and school days and hours. It generates recurring School Blocks.
- The application includes task, calendar, AI-console, settings, daily-brief, notification, planning, rescheduling, and voice-command surfaces.
- Gmail and Google Calendar modules are designed for read-only access. **Google Calendar requires three env vars — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` (`.env.local`) — and as of this review all three are unset**, so `lib/calendar.ts` throws immediately on any call and the AI chat/voice pipeline cannot read Google Calendar events until a developer completes the OAuth setup and supplies them. This is unrelated to TANGENT's own internal task calendars (`cal_work`/`cal_personal`/`cal_study`/`cal_all`, managed by `lib/store.ts`), which always work regardless of this integration's state — the AI's `get_my_tasks` tool reads from that internal store and needs no external credentials.
- Canvas is a per-student `.ics` calendar-feed connection for assignment and deadline events (see [Persistence and accounts](#persistence-and-accounts)). The legacy token-based Canvas client is removed on `feat/supabase` but still present on `main` until that branch merges.
- On `main`, application data is still stored in process memory and resets when the server process restarts. The Supabase migration below is in progress on the `feat/supabase` branch and not yet merged.
- The application assumes one student per account. A parent or family shared-login model is outside the current scope.
- **A real cron trigger now exists** (`vercel.json`, Vercel Cron). Two routes are wired, each once daily (UTC):
  - `app/api/cron/daily-brief` (`0 12 * * *`) generates the scheduled Daily Brief from the student's saved `BriefConfig` sources (`lib/brief-sources.ts`: RSS feeds, manual URL summaries, stale-task checks). It submits generation through the Anthropic Batch API (`lib/anthropic-batch.ts`) because it's non-interactive work. A Vercel Function can't stay alive for Batch's turnaround, so the design is submit-now, poll-later.
  - `app/api/cron/proactive` (`0 15 * * *`) regenerates proactive and overdue notifications so they don't go stale between page loads. It also finalizes the pending brief batch the same day (`lib/daily-brief.ts`).

  Constraints and setup (verified against Vercel docs on 2026-09-27):
  - **Hobby:** both schedules fit, because Hobby allows once-daily crons and fires them anywhere within the scheduled hour. The three-hour gap keeps the order.
  - **Auth:** both routes fail closed. Without `CRON_SECRET` set, every request gets 401 in every environment, including local dev. With it set, only `Authorization: Bearer $CRON_SECRET` passes, checked in constant time. Vercel sends that header automatically once `CRON_SECRET` is set on the project, so **`CRON_SECRET` must be set in Vercel Production or the crons never run**.
  - **Production only:** Vercel invokes crons only on the production deployment, so Preview doesn't need the secret.
  - **Delivery time:** a fixed hour, not per-user. Per-user delivery time would need dynamic scheduling, which Vercel cron doesn't support.
- The on-demand "Daily Brief" button in the Bell panel was renamed **"Today's Summary"** to remove a naming collision with the actual scheduled, source-aggregating Daily Brief feature above — they are unrelated systems that happened to share a name. The on-demand button still calls the Messages API synchronously (a student clicking it wants an immediate result); only the new cron-triggered path uses Batch. Both paths publish through the same shared `publishDailyBrief()` in `lib/daily-brief.ts`, so there's one notification-creation path, not two.

### AI and voice providers

Verified against `feat/supabase` on 2026-09-27:

- Anthropic Claude is the only language-model provider in the web app: chat, voice commands, plan generation, the agent tool loop, context extraction, proactive notifications and the Daily Brief. The earlier OpenAI and Groq code paths are gone; the Raspberry Pi forwarder posts to `/api/voice`, which uses Claude.
- Deepgram transcribes browser voice capture (`app/api/voice-browser`) and needs `DEEPGRAM_API_KEY`; without it the voice UI says voice isn't set up.

Recheck the code before restating provider claims externally; this section reflects the date above.

### Persistence and accounts

Status: in progress on `feat/supabase` (started 2026-09-26). Decisions below are confirmed by Sid; implementation state is tracked by the branch.

- **Storage:** Supabase Postgres. The schema lives in `supabase/migrations/` and is the authority for tables and columns. Every student-owned table has `user_id` → `auth.users`, Row Level Security, and four own-rows-only policies (select/insert/update/delete). Cross-table references use composite `(id, user_id)` foreign keys so a row can never point at another student's data.
- **Access model:** browser requests use the anon key plus the student's session, so RLS applies. Trusted server processes (cron jobs; later the pen upload server) use `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS and therefore must always set and filter `user_id` explicitly. The service role key is server-only; importing it into client code is a critical bug. Store functions refuse to run without an explicit user context — they never fall back to the service role or a default user.
- **Auth:** Supabase Auth with Google sign-in and magic-link email. **Invite-only:** only emails in `ALLOWED_EMAILS` may use the app, enforced server-side in the auth callback and middleware.
- **Timezone:** each student's IANA timezone is stored on their profile (captured at onboarding, default `America/New_York`); cron jobs loop over students and use each one's timezone.
- **Google (Gmail / Google Calendar) is owner-only for now:** those integrations read from env credentials tied to Sid's personal account, so they only run when the signed-in email matches `OWNER_EMAIL`; everyone else gets a "Google connection coming soon" response. **Future work:** per-student Google OAuth — a "Connect Google Calendar" button that stores each student's encrypted refresh token.
- **Canvas:** the `.ics` Canvas Feed is the only Canvas integration. The legacy token-based Canvas API client (`lib/canvas.ts` and its three agent tools) is removed on `feat/supabase`; the agent answers Canvas/assignment questions with `get_canvas_deadlines`, which reads tasks imported by the feed (`source = 'canvas'`). The feed URL embeds a private token and is never returned to the browser unmasked.
- **Pen → student linking (schema only, not wired):** `pen_devices` (`id`, `user_id`, `name`, `device_key_hash`, `created_at`, `last_seen_at`, `revoked_at`) maps a pen to its student. Intended flow: each pen holds a random device key; the pen upload server (planned for Railway) hashes the key it receives (SHA-256), looks up `device_key_hash` with the service role, and inserts tasks for that row's `user_id`. The raw key is never stored. Pairing UI and pen auth are out of scope for this migration; `/api/voice` requires a signed-in session like every other route, and `pi-poller.mjs` is deprecated.

### Environment variables

This is the complete list of variables the code reads on `feat/supabase`, checked by grepping every `process.env` read on 2026-09-27. Kinds:

- **Secret:** server-only. Never put it in a `NEXT_PUBLIC_` name or in client code.
- **Public:** inlined into the browser bundle, so it's safe to expose.
- **Config:** not sensitive.

Dev and Preview share the production Supabase project, so Supabase values and `CANVAS_FEED_KEY` must be identical everywhere.

| Name | Kind | Required? | Vercel environments | Purpose |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Yes | Production, Preview | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Yes | Production, Preview | Browser/session client; RLS applies |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Yes (crons) | Production | Admin client, used only by cron jobs (`lib/cron-users.ts`, `runAsUser`); bypasses RLS |
| `ALLOWED_EMAILS` | Config | Yes | Production, Preview | Invite list, comma-separated; empty means nobody can sign in (fails closed) |
| `ANTHROPIC_API_KEY` | Secret | Yes | Production, Preview | All Claude calls |
| `AI_MODEL_FAST` / `AI_MODEL_SMART` | Config | No | Production, Preview | Override the model for a tier (defaults `claude-haiku-4-5` / `claude-sonnet-5`, set in `lib/ai/models.ts`) |
| `CRON_SECRET` | Secret | Yes | Production | Vercel sends it as `Authorization: Bearer …` to `/api/cron/*`; without it, cron routes reject every request |
| `CANVAS_FEED_KEY` | Secret | Recommended | Production, Preview | 32-byte base64 key that encrypts stored Canvas feed URLs. Without it, feed URLs are stored in plaintext. Once rows are encrypted, losing it makes them unreadable. |
| `CANVAS_ALLOWED_HOSTS` | Config | No | Production, Preview | Extra Canvas hostnames beyond the built-in `*.instructure.com` allow-list |
| `DEEPGRAM_API_KEY` | Secret | No | Production, Preview | Browser voice transcription; voice capture is disabled without it |
| `OWNER_EMAIL` | Config | No | Production, Preview | The one account allowed to use the env-based Google integrations |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` | Secret | No | Production, Preview | Owner-only Gmail and Google Calendar access; currently unset |

Set automatically or used only in tests (don't add these to Vercel):

- `NODE_ENV` is set by Next.js and Vercel.
- `TANGENT_FAKE_NOW` is a clock override for local tests only.

Every variable in the table goes in `.env.local` for local development. You can omit `CRON_SECRET` locally unless you are testing crons. Without it, the cron routes return 401.

These variables are obsolete; delete them from `.env.local` and from Vercel:

- `CANVAS_API_TOKEN` and `CANVAS_BASE_URL`: the token-based Canvas client was removed.
- `NEXT_PUBLIC_BASE_URL`: nothing reads it.
- `GROQ_API_KEY` and `OPENAI_API_KEY`, if either is present: no Groq or OpenAI code remains.

## Current hardware state

- **Prototype direction:** XIAO ESP32-S3 Sense, used to validate voice capture and end-to-end communication.
- **Production-intent direction:** a custom PCB centered on the ESP32-S3-MINI-1U-N8 module.
- **Sequence:** validate the software experience before investing deeply in custom hardware and manufacturing.

The repository contains a Raspberry Pi forwarding path, but the exact current physical prototype, enclosure, battery, microphone, button, storage, and radio configuration have not been verified here.

## Strategic shift

TANGENT narrowed from a general productivity concept to high school students. That focus moved school-specific foundations ahead of broad polish and custom hardware: onboarding-generated School Blocks, Canvas deadline ingestion, and recurring schedules became prerequisites rather than optional integrations.

This shift is a central product lesson: a narrow audience becomes defensible when the roadmap is rebuilt around that audience's non-negotiable constraints.

## Roadmap order

1. Finish and demonstrate the software.
2. Deploy the web app to Vercel.
3. Replace process-memory storage with persistent storage — Supabase (Postgres + Auth), confirmed by Sid on 2026-09-26; see [Persistence and accounts](#persistence-and-accounts).
4. Complete an end-to-end ESP32 prototype.
5. Design and validate the production-intent custom PCB.
6. Expand the AI agent pipeline from capture through understanding to safe action.

## Confirmed operating decisions

- Focus on high school students rather than general productivity users.
- Keep one student per account for the first version.
- Build software first and custom hardware second.
- Use read-only school and communication integrations unless the user deliberately approves broader permissions.
- Avoid the AI-counselor category and its expectations.
- Use Council Reviews only for consequential decisions, not routine work.
- Keep Resource Preparation production-only and separate from research and strategy.

## Evidence status

The following remain assumptions or unknowns until supported by research, tests, or user confirmation:

- Number of active users, retention, or demonstrated willingness to pay.
- Which capture situations students experience most often and how frequently.
- Whether a dedicated Pen is meaningfully better than phone, watch, earbuds, or school-device capture.
- School policy, privacy, consent, and recording constraints across target schools.
- Final hardware form factor, battery life, microphone performance, unit cost, and manufacturing partner.
- Pricing, buyer, distribution channel, and business model.
- Exact deployment readiness of each integration.
- Competition, grant, funding, or fellowship eligibility and deadlines.

## Open questions

- What single use case creates the strongest repeated demand: assignment capture, reminders, project ideas, schedule changes, or something else?
- Is the student the buyer, or does adoption depend on parents, schools, programs, or another sponsor?
- What evidence is required before the Pen advances from prototype to custom PCB?
- Which actions may TANGENT take automatically, and which require confirmation?
- What is the minimum privacy and consent model for classroom voice capture?
- Which product metric best proves value before expanding scope?
