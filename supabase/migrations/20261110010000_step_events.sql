-- Round 4 Phase 2: the observation log (context engine Layer 2).
-- One row per thing the student did with a step: created, done, skipped,
-- "Not today" (with a reason code), too big, rescheduled, a check-in answer.
-- Only what the calibration numbers need: no titles, no free text.
-- Safe to run twice. Before it's applied the app skips logging quietly.

begin;

create table if not exists public.step_events (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  task_id         uuid,
  plan_id         uuid,
  kind            text not null check (kind in ('created', 'done', 'skipped', 'not_today', 'too_big', 'rescheduled', 'check_in')),
  hour            smallint check (hour between 0 and 23),
  weekday         smallint check (weekday between 0 and 6),
  minutes         integer check (minutes between 0 and 1440),
  actual_minutes  integer check (actual_minutes between 0 and 1440),
  code            text check (code is null or code ~ '^[a-z_]{1,24}$'),
  created_at      timestamptz not null default now()
);

-- Steps and projects can be deleted; their history still counts, unlinked.
create index if not exists step_events_user_created_idx on public.step_events (user_id, created_at desc);

alter table public.step_events enable row level security;

drop policy if exists "own rows: select" on public.step_events;
create policy "own rows: select" on public.step_events
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own rows: insert" on public.step_events;
create policy "own rows: insert" on public.step_events
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "own rows: delete" on public.step_events;
create policy "own rows: delete" on public.step_events
  for delete to authenticated using (user_id = (select auth.uid()));

commit;
