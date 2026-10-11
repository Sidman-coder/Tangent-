-- Pipeline V2, step 3: plan nicknames (B3) and AI decision records (B9).
--
-- plan_aliases   The student's own words for a plan or project ("eye see eff
--                prep" → ICF Prep), saved when they confirm or tap a match so
--                the next request matches at once. Owner-only RLS. At most 10
--                per plan (also enforced in lib/store.ts). Deleting the plan
--                deletes its nicknames.
--
-- ai_decisions   One row per intake request (flag on): what Tangent understood
--                (route, intent, confidence, plan match, question asked, models)
--                and how it ended (outcome). Students can read and delete their
--                own rows; only the server writes them (service role, user_id
--                set explicitly), so there are no insert or update policies.
--                No foreign keys to calendar data: deleting a row never changes
--                a task or plan, and a plan or change set going away leaves the
--                row as history. request_text is capped at 500 characters.
--                Kept 90 days: purge_old_ai_decisions() deletes older rows and
--                runs from the daily /api/cron/proactive job.
--
-- The app works before this migration is applied: nicknames read as none and
-- decision rows are skipped with one warning. Safe to run twice.

begin;

-- ─── plan_aliases ───────────────────────────────────────────────────────────

create table if not exists public.plan_aliases (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  plan_id           uuid not null references public.plans (id) on delete cascade,
  -- lib/pipeline/match.ts aliasFor(): lowercase words, filler dropped.
  alias_normalized  text not null check (char_length(alias_normalized) between 1 and 120),
  created_at        timestamptz not null default now(),
  unique (user_id, alias_normalized)
);

create index if not exists plan_aliases_plan_idx on public.plan_aliases (plan_id);

alter table public.plan_aliases enable row level security;

drop policy if exists "own rows: select" on public.plan_aliases;
drop policy if exists "own rows: insert" on public.plan_aliases;
drop policy if exists "own rows: update" on public.plan_aliases;
drop policy if exists "own rows: delete" on public.plan_aliases;
create policy "own rows: select" on public.plan_aliases
  for select to authenticated using (user_id = (select auth.uid()));
-- A nickname may only point at the student's own plan.
create policy "own rows: insert" on public.plan_aliases
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
  );
create policy "own rows: update" on public.plan_aliases
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
  );
create policy "own rows: delete" on public.plan_aliases
  for delete to authenticated using (user_id = (select auth.uid()));

-- At most 10 nicknames per plan.
create or replace function public.plan_aliases_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.plan_aliases a where a.plan_id = new.plan_id and a.id <> new.id) >= 10 then
    raise exception 'plan_aliases: at most 10 nicknames per plan' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists plan_aliases_cap on public.plan_aliases;
create trigger plan_aliases_cap
  before insert or update of plan_id on public.plan_aliases
  for each row execute function public.plan_aliases_cap();

-- ─── ai_decisions ───────────────────────────────────────────────────────────

create table if not exists public.ai_decisions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  source            text not null check (source in ('typed', 'voice')),
  request_text      text not null default '' check (char_length(request_text) <= 500),
  -- lib/pipeline/intent.ts: fast | chat | tangent | clarify | draft (and the
  -- answer routes). Short tokens only.
  route             text not null check (char_length(route) <= 40),
  intent            text check (char_length(intent) <= 40),
  confidence        real check (confidence is null or (confidence >= 0 and confidence <= 1)),
  -- router | rules | fast | answer
  via               text not null check (char_length(via) <= 40),
  -- { decision: sure|unsure|none, candidates: [{ id, score }] } (ids only)
  plan_match        jsonb,
  chosen_plan_id    uuid,
  -- { action, kind, candidates: <count> } (no titles)
  pending_question  jsonb,
  change_set_id     uuid,
  action_id         uuid,
  -- model ids used, e.g. ["claude-haiku-4-5"]
  models            jsonb not null default '[]'::jsonb,
  outcome           text not null check (
    outcome in ('answered', 'drafted', 'confirmed', 'discarded', 'undone', 'applied_instantly', 'asked', 'failed')
  )
);

create index if not exists ai_decisions_user_created_idx on public.ai_decisions (user_id, created_at desc);
create index if not exists ai_decisions_change_set_idx on public.ai_decisions (change_set_id) where change_set_id is not null;
create index if not exists ai_decisions_action_idx on public.ai_decisions (action_id) where action_id is not null;
create index if not exists ai_decisions_created_idx on public.ai_decisions (created_at);

alter table public.ai_decisions enable row level security;

-- Students read and delete their own rows. No insert or update policy: only
-- the service role (which bypasses RLS) writes them.
drop policy if exists "own rows: select" on public.ai_decisions;
drop policy if exists "own rows: delete" on public.ai_decisions;
create policy "own rows: select" on public.ai_decisions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows: delete" on public.ai_decisions
  for delete to authenticated using (user_id = (select auth.uid()));

-- 90-day retention (lib/pipeline/decisions.ts RETENTION_DAYS). Service role only.
create or replace function public.purge_old_ai_decisions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.ai_decisions where created_at < now() - interval '90 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_old_ai_decisions() from public, anon, authenticated;
grant execute on function public.purge_old_ai_decisions() to service_role;

commit;
