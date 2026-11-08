-- Round 2 Phase D: one continuing chat per task and per project.
--
-- Adds chat_sessions.scope ('general' | 'task' | 'project'), task_id and a
-- running summary. Idempotent; safe to run twice. The app works before this
-- runs: lib/chat/scope.ts scopeOfSession infers the scope from plan_id and
-- task_ids, and the store reads the old columns when these are missing.
--
-- Existing chats become 'general' (the column default). The first time a
-- project chat opens, it adopts that project's newest linked chat; the first
-- time a task chat opens, it copies that task's task_chat_messages. Old rows
-- stay. RLS: chat_sessions already has its "own rows" policies; nothing new.

begin;

alter table public.chat_sessions add column if not exists task_id uuid;
alter table public.chat_sessions add column if not exists scope text not null default 'general';
alter table public.chat_sessions add column if not exists summary text;
alter table public.chat_sessions drop constraint if exists chat_sessions_scope_check;
alter table public.chat_sessions add constraint chat_sessions_scope_check
  check (scope in ('general', 'task', 'project'));

-- Clears links to already-deleted projects. No chat content changes.
-- The updated_at trigger is paused so these chats don't jump to the top of the library.
alter table public.chat_sessions disable trigger chat_sessions_set_updated_at;
update public.chat_sessions c set plan_id = null
 where c.plan_id is not null and not exists (
   select 1 from public.plans p where p.id = c.plan_id and p.user_id = c.user_id);
alter table public.chat_sessions enable trigger chat_sessions_set_updated_at;

alter table public.chat_sessions drop constraint if exists chat_sessions_task_fk;
alter table public.chat_sessions add constraint chat_sessions_task_fk
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id);
alter table public.chat_sessions drop constraint if exists chat_sessions_plan_fk;
alter table public.chat_sessions add constraint chat_sessions_plan_fk
  foreign key (plan_id, user_id) references public.plans (id, user_id) on delete set null (plan_id);

create index if not exists chat_sessions_user_scope_idx on public.chat_sessions (user_id, scope);
create index if not exists chat_sessions_user_task_idx on public.chat_sessions (user_id, task_id);
create index if not exists chat_sessions_user_plan_idx on public.chat_sessions (user_id, plan_id);

-- One continuing thread per task and per project.
create unique index if not exists chat_sessions_one_task_thread
  on public.chat_sessions (user_id, task_id) where scope = 'task' and task_id is not null;
create unique index if not exists chat_sessions_one_project_thread
  on public.chat_sessions (user_id, plan_id) where scope = 'project' and plan_id is not null;

commit;
