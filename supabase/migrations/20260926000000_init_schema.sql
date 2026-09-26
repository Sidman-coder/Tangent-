-- TANGENT initial schema: replaces the in-memory lib/store.ts.
--
-- Access model
--   * Browser/session requests use the anon key + the student's JWT, so Row Level
--     Security (below) limits every query to rows where user_id = auth.uid().
--   * Trusted server processes (cron jobs; the pen upload server later) use the
--     service role key, which bypasses RLS. They MUST set/filter user_id
--     explicitly. lib/store.ts also filters by user_id on every query as a
--     second layer.
--   * Cross-table references use composite (id, user_id) foreign keys so a row
--     can never point at another student's row, even via the service role.
--
-- Requires Postgres 15+ (ON DELETE SET NULL (column) syntax). All current
-- Supabase projects run 15 or newer.

-- ─── Shared helpers ─────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── profiles ───────────────────────────────────────────────────────────────
-- One row per student. Also holds single-value state that used to be scattered
-- across globals: long-term context summary, last voice command, weekly plan.

create table public.profiles (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  display_name          text not null default '',
  email                 text not null default '',
  is_high_school        boolean,
  onboarded_at          timestamptz,
  timezone              text not null default 'America/New_York',  -- IANA name, captured at onboarding
  weekly_plan           text[] not null default '{}',
  last_voice_command    text,
  last_voice_response   text,
  context_summary       text not null default '',
  context_interactions  integer not null default 0,
  context_updated_at    timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─── calendars ──────────────────────────────────────────────────────────────
-- Text ids (cal_all, cal_personal, cal_work, cal_study) are referenced directly
-- by app code and AI prompts, so they stay text and are unique per student.

create table public.calendars (
  user_id   uuid not null references auth.users (id) on delete cascade,
  id        text not null,
  name      text not null,
  category  text not null,
  color     text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ─── plans ──────────────────────────────────────────────────────────────────

create table public.plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  description text not null default '',
  -- Tasks the plan was built from. Kept as an array (not derived from
  -- tasks.plan_id) because a plan can adopt a pre-existing duplicate task.
  task_ids    uuid[] not null default '{}',
  task_count  integer not null default 0,
  color       text not null,
  created_at  timestamptz not null default now(),
  unique (id, user_id)
);

create index plans_user_created_idx on public.plans (user_id, created_at);

-- ─── tasks ──────────────────────────────────────────────────────────────────

create table public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  title               text not null,
  date                date not null,
  time                text not null default '',            -- 'HH:MM' 24-hour
  completed           boolean not null default false,
  kind                text check (kind in ('school', 'academic-ec', 'side-ec', 'personal', 'commitment')),
  -- No FK to calendars: the AI may assign a calendar id the student never created.
  calendar_id         text,
  plan_id             uuid,
  notes               text,
  recurring           jsonb,
  recurring_parent_id text generated always as (recurring ->> 'parentId') stored,
  resources           jsonb,
  start_action        text,
  source              text check (source in ('canvas')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, user_id),
  foreign key (plan_id, user_id) references public.plans (id, user_id) on delete set null (plan_id)
);

create index tasks_user_date_idx on public.tasks (user_id, date);
create index tasks_user_recurring_parent_idx on public.tasks (user_id, recurring_parent_id)
  where recurring_parent_id is not null;
create index tasks_plan_idx on public.tasks (plan_id) where plan_id is not null;
create index tasks_user_source_idx on public.tasks (user_id, source) where source is not null;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ─── task_chat_messages ─────────────────────────────────────────────────────

create table public.task_chat_messages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  task_id    uuid not null,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now(),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);

create index task_chat_messages_task_idx on public.task_chat_messages (task_id, id);
create index task_chat_messages_user_idx on public.task_chat_messages (user_id);

-- ─── chat_sessions / chat_messages ──────────────────────────────────────────

create table public.chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  -- Accumulated links to tasks/plan this chat touched. No FK: links outlive
  -- deleted tasks, and the UI already tolerates stale ids.
  task_ids   uuid[] not null default '{}',
  plan_id    uuid,
  color      text,
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index chat_sessions_user_updated_idx on public.chat_sessions (user_id, updated_at desc);

create table public.chat_messages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id) references public.chat_sessions (id, user_id) on delete cascade
);

create index chat_messages_session_idx on public.chat_messages (session_id, id);
create index chat_messages_user_idx on public.chat_messages (user_id);

-- ─── context_entries (long-term user context) ───────────────────────────────
-- The compressed summary and counters live on profiles.

create table public.context_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  category   text not null check (category in ('preference', 'habit', 'commitment', 'goal', 'person', 'work', 'general')),
  fact       text not null,
  source     text not null check (source in ('chat', 'voice', 'manual')),
  created_at timestamptz not null default now()
);

create index context_entries_user_created_idx on public.context_entries (user_id, created_at);

-- ─── notifications ──────────────────────────────────────────────────────────

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  type         text not null check (type in ('proactive_suggestion', 'daily_brief', 'overdue_task', 'upcoming_deadline', 'reschedule_offer')),
  title        text not null,
  body         text not null,
  action_label text,
  action_data  jsonb,
  task_id      text generated always as (action_data ->> 'taskId') stored,
  read         boolean not null default false,
  dismissed    boolean not null default false,
  created_at   timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

-- Dedup state: at most one live notification per (student, type, task). Makes
-- the page-load and cron proactive checks race-safe (insert ... on conflict).
create unique index notifications_live_dedup_idx
  on public.notifications (user_id, type, task_id)
  where not dismissed and task_id is not null;

-- ─── action_records (receipts + undo) ───────────────────────────────────────

create table public.action_records (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('add_task', 'complete_task', 'delete_task', 'delete_all_tasks', 'add_recurring_task', 'create_plan', 'move_tasks', 'reschedule_task')),
  summary    text not null,
  undoable   boolean not null default true,
  undone     boolean not null default false,
  snapshot   jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index action_records_user_created_idx on public.action_records (user_id, created_at desc);

-- ─── pending_confirmations (confirm-before-changing gate) ───────────────────

create table public.pending_confirmations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('add_task', 'complete_task', 'delete_task', 'delete_all_tasks', 'add_recurring_task', 'create_plan', 'move_tasks', 'reschedule_task')),
  message    text not null,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index pending_confirmations_user_created_idx on public.pending_confirmations (user_id, created_at);

-- ─── voice_logs ─────────────────────────────────────────────────────────────

create table public.voice_logs (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references auth.users (id) on delete cascade,
  at       timestamptz not null default now(),
  text     text not null,
  response text not null,
  action   text not null,
  ok       boolean not null
);

create index voice_logs_user_at_idx on public.voice_logs (user_id, at desc);

-- ─── brief_configs (Daily Brief settings + in-flight batch) ─────────────────

create table public.brief_configs (
  user_id                    uuid primary key references auth.users (id) on delete cascade,
  sources                    jsonb not null default '[]',
  cadence                    text not null default 'daily' check (cadence in ('daily', 'weekdays', 'weekly')),
  delivery_time              text not null default '07:00',   -- 'HH:MM' in profiles.timezone
  pending_batch_id           text,
  pending_batch_submitted_at timestamptz,
  updated_at                 timestamptz not null default now()
);

create trigger brief_configs_set_updated_at
  before update on public.brief_configs
  for each row execute function public.set_updated_at();

-- ─── canvas_feeds (.ics connection) ─────────────────────────────────────────
-- ics_url embeds a private Canvas token. The app never returns it unmasked.

create table public.canvas_feeds (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  ics_url         text not null,
  connected_at    timestamptz not null default now(),
  last_synced_at  timestamptz,
  last_sync_count integer not null default 0
);

-- ─── pen_devices (ready for the pen upload server; not wired yet) ───────────
-- The pen server (service role) hashes the key a pen presents and looks it up
-- here to learn which student sent a recording. The raw key is never stored.

create table public.pen_devices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null default 'TANGENT Pen',
  device_key_hash text not null unique,     -- hex SHA-256 of the device key
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz,
  revoked_at      timestamptz
);

create index pen_devices_user_idx on public.pen_devices (user_id);

-- ─── Row Level Security ─────────────────────────────────────────────────────
-- Same four policies on every table: a signed-in student can only
-- select/insert/update/delete rows where user_id is their own. anon gets
-- nothing. (select auth.uid()) is wrapped so Postgres evaluates it once per
-- statement instead of per row.

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'calendars', 'plans', 'tasks', 'task_chat_messages',
    'chat_sessions', 'chat_messages', 'context_entries', 'notifications',
    'action_records', 'pending_confirmations', 'voice_logs', 'brief_configs',
    'canvas_feeds', 'pen_devices'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows: select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows: insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows: update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows: delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- ─── New-user bootstrap ─────────────────────────────────────────────────────
-- Creates the profile and default calendars when Supabase Auth creates a user.
-- security definer because it runs as the auth system, not as the student.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (user_id) do nothing;

  insert into public.calendars (user_id, id, name, category, color)
  values
    (new.id, 'cal_all',      'All Calendars', 'ALL',      '#c4b5fd'),
    (new.id, 'cal_personal', 'Personal',      'personal', '#a78bfa'),
    (new.id, 'cal_work',     'Work',          'work',     '#34d399'),
    (new.id, 'cal_study',    'Study',         'study',    '#38bdf8')
  on conflict (user_id, id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any users that signed up before this migration ran.
insert into public.profiles (user_id, email, display_name)
select u.id, coalesce(u.email, ''), coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')
from auth.users u
on conflict (user_id) do nothing;

insert into public.calendars (user_id, id, name, category, color)
select u.id, c.id, c.name, c.category, c.color
from auth.users u
cross join (values
  ('cal_all',      'All Calendars', 'ALL',      '#c4b5fd'),
  ('cal_personal', 'Personal',      'personal', '#a78bfa'),
  ('cal_work',     'Work',          'work',     '#34d399'),
  ('cal_study',    'Study',         'study',    '#38bdf8')
) as c (id, name, category, color)
on conflict (user_id, id) do nothing;
