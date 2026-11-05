-- Round 2 Phase C: what Tangent knows about each project (and the student),
-- one row per slot, so "Grill until enough" never asks the same thing twice.
-- project_id null = a slot about the student (preferred work times, focus
-- length, weekends). Safe to run twice. The app works before this is applied:
-- planning falls back to the older clarify questions.

begin;

create table if not exists public.context_slots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid,
  slot_key    text not null check (slot_key ~ '^[a-zA-Z]{1,32}$'),
  value       jsonb not null,
  source      text not null check (source in ('answer', 'inferred', 'default', 'known')),
  updated_at  timestamptz not null default now(),
  foreign key (project_id, user_id) references public.plans (id, user_id) on delete cascade
);

create unique index if not exists context_slots_user_project_key_idx
  on public.context_slots (user_id, project_id, slot_key) nulls not distinct;

create index if not exists context_slots_user_idx
  on public.context_slots (user_id, updated_at desc);

alter table public.context_slots enable row level security;

drop policy if exists "own rows: select" on public.context_slots;
create policy "own rows: select" on public.context_slots
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own rows: insert" on public.context_slots;
create policy "own rows: insert" on public.context_slots
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "own rows: update" on public.context_slots;
create policy "own rows: update" on public.context_slots
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own rows: delete" on public.context_slots;
create policy "own rows: delete" on public.context_slots
  for delete to authenticated using (user_id = (select auth.uid()));

commit;
