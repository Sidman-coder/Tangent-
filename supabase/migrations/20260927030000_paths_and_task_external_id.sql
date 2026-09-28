-- Paths (Tangents) and Canvas event tracking, brought over from origin/main,
-- where both lived in the in-memory/KV workspace store.
--
-- 1. tasks.external_id: the Canvas event UID a task was imported from, so a
--    re-sync updates the task in place (moved due date, renamed assignment)
--    instead of adding a duplicate. See lib/canvas-ics.ts.
-- 2. paths + path_nodes: one row per goal and one per node of its recursive
--    tree (lib/types.ts Path / PathNode). A node's parent is another node of
--    the same path and the same student; deleting a node deletes the subtree.
--
-- Row Level Security matches the init schema: the four owner-only policies.

-- ─── tasks.external_id ──────────────────────────────────────────────────────

alter table public.tasks add column external_id text;

create index tasks_user_external_idx on public.tasks (user_id, external_id)
  where external_id is not null;

-- ─── paths ──────────────────────────────────────────────────────────────────

create table public.paths (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  title          text not null,
  kind           text not null check (kind in ('college', 'career', 'skill', 'other')),
  target         text not null default '',
  current        text not null default '',
  deadline       text,
  hours_per_week numeric,
  constraints    text,
  standing       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, user_id)
);

create index paths_user_created_idx on public.paths (user_id, created_at);

create trigger paths_set_updated_at
  before update on public.paths
  for each row execute function public.set_updated_at();

-- ─── path_nodes ─────────────────────────────────────────────────────────────

create table public.path_nodes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  path_id        uuid not null,
  -- null: hangs off the goal at the centre of the root circle.
  parent_id      uuid,
  kind           text not null check (kind in ('work', 'idea')),
  title          text not null,
  detail         text,
  rationale      text,
  effort         text,
  category       text check (category in ('ec', 'award', 'course', 'project')),
  hours_per_week numeric,
  years          numeric,
  status         text not null check (status in ('suggested', 'accepted', 'done', 'dismissed')),
  origin         text not null check (origin in ('tangent', 'you')),
  created_at     timestamptz not null default now(),
  unique (id, user_id),
  foreign key (path_id, user_id) references public.paths (id, user_id) on delete cascade,
  foreign key (parent_id, user_id) references public.path_nodes (id, user_id) on delete cascade
);

create index path_nodes_user_path_idx on public.path_nodes (user_id, path_id, created_at);
create index path_nodes_parent_idx on public.path_nodes (parent_id) where parent_id is not null;

-- ─── Row Level Security ─────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['paths', 'path_nodes']
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
