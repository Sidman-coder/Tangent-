-- Grill me: the queue of questions Tangent wants to ask about a student's plans.
-- Filled after a project is drafted or a task joins one; answered on Today, under
-- a confirmed preview, or in Settings. Safe to run twice. The app works before
-- this is applied: the queue just reads empty.

begin;

create table if not exists public.grill_questions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  project_id   uuid references public.plans (id) on delete cascade,
  question     text not null,
  kind         text not null,
  choices      jsonb not null default '[]'::jsonb,
  priority     integer not null default 0,
  status       text not null default 'open' check (status in ('open', 'answered', 'skipped', 'expired')),
  answer       text,
  created_at   timestamptz not null default now(),
  answered_at  timestamptz
);

create index if not exists grill_questions_user_status_idx
  on public.grill_questions (user_id, status, priority desc);

alter table public.grill_questions enable row level security;

drop policy if exists "own rows: select" on public.grill_questions;
create policy "own rows: select" on public.grill_questions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own rows: insert" on public.grill_questions;
create policy "own rows: insert" on public.grill_questions
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "own rows: update" on public.grill_questions;
create policy "own rows: update" on public.grill_questions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own rows: delete" on public.grill_questions;
create policy "own rows: delete" on public.grill_questions
  for delete to authenticated using (user_id = (select auth.uid()));

commit;
