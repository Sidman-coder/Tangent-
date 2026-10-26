-- Tangents becomes a way to see a project: each project can have one Path,
-- opened from the project page ("View path"). paths.plan_id is that link.
--
-- Nullable: paths made before this (and any made from a goal, not a project)
-- have none. Deleting the project keeps the path and clears the link
-- (SET NULL on plan_id only, so user_id is untouched). One path per project.
--
-- APPLY THIS BEFORE deploying code that selects paths.plan_id (lib/store.ts
-- PATH_COLUMNS), or every path query fails.

alter table public.paths add column plan_id uuid;

alter table public.paths
  add constraint paths_plan_fk
  foreign key (plan_id, user_id) references public.plans (id, user_id)
  on delete set null (plan_id);

create unique index paths_user_plan_idx on public.paths (user_id, plan_id)
  where plan_id is not null;
