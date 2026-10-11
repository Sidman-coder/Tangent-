-- Pipeline V2, step 0: storage only. Nothing in the app reads or writes these
-- tables until TANGENT_PIPELINE_V2 is turned on in a later step.
--
--   change_sets  A drafted set of calendar changes the student previews and
--                confirms (lib/pipeline/changeset.ts). The app supplies the id,
--                which doubles as the idempotency key.
--   events       Pipeline funnel events (lib/pipeline/events.ts). Structured
--                facts only, never student free text; props is sanitized in
--                code and size-capped here.
--
-- Also widens action_records.kind with 'apply_changeset': one undo entry per
-- applied ChangeSet. The 8 existing kinds are kept exactly.
--
-- change_sets_guard (a trigger) enforces the status lifecycle in the
-- database, because students can reach change_sets through the REST API with
-- their own token (RLS lets them update their own rows).
--
-- Safe to run twice: create ... if not exists, drop ... if exists. Runs as one
-- transaction, so a failure part-way leaves nothing behind.

begin;

-- ─── change_sets ────────────────────────────────────────────────────────────

create table if not exists public.change_sets (
  id             uuid primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  source         text not null check (source in ('typed', 'voice')),
  request_text   text not null default '' check (char_length(request_text) <= 4000),
  summary        text not null check (char_length(summary) between 1 and 200),
  intent         text not null check (intent in (
                   'new_plan', 'add_to_plan', 'change_plan', 'add_task', 'change_task',
                   'complete_task', 'delete_task', 'question', 'clarify')),
  -- The existing plan the request is about. No foreign key: a draft outlives
  -- a plan deleted after it was drafted, and apply re-checks it.
  target_plan_id uuid,
  ops            jsonb not null default '[]' check (jsonb_typeof(ops) = 'array'),
  assumptions    jsonb not null default '[]' check (jsonb_typeof(assumptions) = 'array'),
  status         text not null default 'draft' check (status in ('draft', 'confirmed', 'discarded', 'undone')),
  created_at     timestamptz not null default now(),
  confirmed_at   timestamptz,
  -- The single undo entry written when it was applied (action_records.id).
  -- No foreign key: old action records are trimmed.
  action_id      uuid,
  -- Stamped when apply finished, with or without an undo entry. While it is
  -- null a confirmed change set is still being written, and only then may the
  -- server roll it back to draft (see change_sets_guard).
  applied_at     timestamptz
);

alter table public.change_sets add column if not exists applied_at timestamptz;

create index if not exists change_sets_user_created_idx on public.change_sets (user_id, created_at desc);

alter table public.change_sets enable row level security;

drop policy if exists "own rows: select" on public.change_sets;
drop policy if exists "own rows: insert" on public.change_sets;
drop policy if exists "own rows: update" on public.change_sets;
drop policy if exists "own rows: delete" on public.change_sets;
create policy "own rows: select" on public.change_sets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows: insert" on public.change_sets
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rows: update" on public.change_sets
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows: delete" on public.change_sets
  for delete to authenticated using (user_id = (select auth.uid()));

-- ─── change_sets_guard ──────────────────────────────────────────────────────
-- The server runs as the student (RLS, not the service role), so a "server
-- only" function would be callable by the student too. Instead the row's own
-- state decides what may change:
--   insert       only as a fresh draft (no action_id, no applied_at)
--   status       draft→confirmed, draft→discarded, confirmed→undone, and
--                confirmed→draft only while applied_at is null (the server's
--                rollback window while a confirm is still writing)
--   applied_at,  write-once: fixed after applied_at is stamped
--   action_id
--   content      source, request_text, summary, intent, target_plan_id, ops,
--                assumptions change only while the row is a draft
--   identity     id, user_id, created_at never change
-- So a student cannot reopen an applied or discarded change set, or rewrite
-- one after it was confirmed.

create or replace function public.change_sets_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.action_id is not null or new.applied_at is not null then
      raise exception 'change_sets: a change set starts as a draft' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if new.id <> old.id or new.user_id <> old.user_id or new.created_at <> old.created_at then
    raise exception 'change_sets: id, user_id and created_at cannot change' using errcode = 'check_violation';
  end if;

  if new.status <> old.status and not (
       (old.status = 'draft' and new.status in ('confirmed', 'discarded'))
    or (old.status = 'confirmed' and new.status = 'undone')
    or (old.status = 'confirmed' and new.status = 'draft' and old.applied_at is null)
  ) then
    raise exception 'change_sets: % → % is not allowed', old.status, new.status using errcode = 'check_violation';
  end if;

  if old.applied_at is not null and new.status <> 'draft' and (
       new.applied_at is distinct from old.applied_at
    or new.action_id is distinct from old.action_id
  ) then
    raise exception 'change_sets: applied_at and action_id are fixed once applied' using errcode = 'check_violation';
  end if;

  if old.status <> 'draft' and (
       new.source is distinct from old.source
    or new.request_text is distinct from old.request_text
    or new.summary is distinct from old.summary
    or new.intent is distinct from old.intent
    or new.target_plan_id is distinct from old.target_plan_id
    or new.ops is distinct from old.ops
    or new.assumptions is distinct from old.assumptions
  ) then
    raise exception 'change_sets: only a draft can be edited' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists change_sets_guard on public.change_sets;
create trigger change_sets_guard
  before insert or update on public.change_sets
  for each row execute function public.change_sets_guard();

-- ─── events ─────────────────────────────────────────────────────────────────
-- Append-only. Students may insert and read their own rows; nobody can edit
-- or delete them through the API. The ids are plain columns, not foreign
-- keys, so an event survives the deletion of what it refers to.

create table if not exists public.events (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  type          text not null check (type ~ '^[a-z_]{1,64}$'),
  change_set_id uuid,
  plan_id       uuid,
  task_id       uuid,
  props         jsonb not null default '{}'
                  check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 2048),
  occurred_at   timestamptz not null default now()
);

create index if not exists events_user_occurred_idx on public.events (user_id, occurred_at);
create index if not exists events_type_occurred_idx on public.events (type, occurred_at);

alter table public.events enable row level security;

drop policy if exists "own rows: select" on public.events;
drop policy if exists "own rows: insert" on public.events;
create policy "own rows: select" on public.events
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows: insert" on public.events
  for insert to authenticated with check (user_id = (select auth.uid()));

revoke update, delete on public.events from anon, authenticated;

-- ─── action_records.kind: add 'apply_changeset' ─────────────────────────────
-- action_records_kind_check is the name Postgres gave the inline check in
-- 20260926000000_init_schema.sql. pending_confirmations keeps its own check
-- unchanged: a ChangeSet is confirmed through change_sets, not that table.

alter table public.action_records drop constraint if exists action_records_kind_check;
alter table public.action_records add constraint action_records_kind_check check (kind in (
  'add_task', 'complete_task', 'delete_task', 'delete_all_tasks', 'add_recurring_task',
  'create_plan', 'move_tasks', 'reschedule_task',
  'apply_changeset'
));

commit;
