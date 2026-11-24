-- PROPOSED, NOT APPLIED. Written overnight (Phase 4.5); needs Sid's review.
-- Plan: docs/overnight/NEEDS-SID.md, "Post-event reviews (Phase 4.5)".
--
-- What: two small tables for short "how did it go?" reviews of an event the student
-- opted in to (a test, a presentation, a game...).
--   event_review_prefs  one row per student: which event types may be asked about, and
--                       whether paid follow-up questions are on. Absent row = nothing asked.
--   event_reviews       one row per review: what event, the 2-3 answers, a one-line
--                       takeaway, and the goal (plan) it belongs to.
--
-- Privacy, by design:
--   - private by default: own-rows RLS only, no sharing column, nothing visible to anyone else.
--   - answers are the student's own words; the app refuses health and family facts at
--     write time (same rule as context_entries) before the row is created.
--   - the student can edit (update) and delete (delete) any review; both policies below.
--   - ON DELETE CASCADE from auth.users: "Delete my account" removes them. resetUserData
--     (lib/store.ts) and the data export must add both tables (a code change, gated).
--   - the event title is copied (event_title) so the review survives the task being deleted.
--
-- Safe to run twice. Nothing reads these tables until the code ships.

begin;

create table if not exists public.event_review_prefs (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  -- Opt-in per type. Empty array = off. Allowed values are checked below.
  event_types    text[] not null default '{}'
                 check (event_types <@ array['test', 'presentation', 'performance', 'game', 'competition', 'interview', 'project_due']),
  -- Paid tier: allow AI follow-up questions. Fixed questions stay free.
  ai_followups   boolean not null default false,
  -- Two "Not now" in a row for a type -> the app offers to turn that type off.
  snoozed_until  timestamptz,
  updated_at     timestamptz not null default now()
);

create table if not exists public.event_reviews (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  -- Links. Both survive deletion of the event or the goal, unlinked.
  task_id        uuid,
  plan_id        uuid,
  event_title    text not null check (char_length(event_title) between 1 and 200),
  event_type     text not null check (event_type in ('test', 'presentation', 'performance', 'game', 'competition', 'interview', 'project_due')),
  event_source   text not null check (event_source in ('canvas', 'calendar', 'capture')),
  event_ended_at timestamptz not null,
  -- 'asked' = offered, not answered. 'done' = answered. 'skipped' = Skip. 'stopped' = Stop.
  status         text not null default 'asked' check (status in ('asked', 'done', 'skipped', 'stopped')),
  -- [{ "q": "How did it feel?", "a": "Harder than I thought", "kind": "fixed" | "ai" }], at most 3.
  answers        jsonb not null default '[]' check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) <= 3),
  takeaway       text check (takeaway is null or char_length(takeaway) <= 200),
  asked_on       date not null,
  created_at     timestamptz not null default now(),
  answered_at    timestamptz
);

-- At most one review prompt per student per day (the daily cap, enforced in the database).
create unique index if not exists event_reviews_one_per_day_idx on public.event_reviews (user_id, asked_on);
create index if not exists event_reviews_user_created_idx on public.event_reviews (user_id, created_at desc);
create index if not exists event_reviews_plan_idx on public.event_reviews (plan_id) where plan_id is not null;

alter table public.event_review_prefs enable row level security;
alter table public.event_reviews enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['event_review_prefs', 'event_reviews'] loop
    execute format('drop policy if exists "own rows: select" on public.%I', t);
    execute format('create policy "own rows: select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('drop policy if exists "own rows: insert" on public.%I', t);
    execute format('create policy "own rows: insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('drop policy if exists "own rows: update" on public.%I', t);
    execute format('create policy "own rows: update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('drop policy if exists "own rows: delete" on public.%I', t);
    execute format('create policy "own rows: delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

commit;
