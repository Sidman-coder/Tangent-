-- A Path branch's first step can become a real task. The task keeps a link
-- back to the node it came from, so Calendar and Today can say which path it
-- serves and the path can say when the step is on the calendar.
--
-- Additive and nullable: existing tasks and every existing writer are
-- unaffected. The composite key means a task can only point at a node owned
-- by the same student, so no RLS change is needed. Deleting the node (or its
-- whole Path) keeps the task and clears only the link.

alter table public.tasks
  add column path_node_id uuid;

alter table public.tasks
  add constraint tasks_path_node_fk
  foreign key (path_node_id, user_id)
  references public.path_nodes (id, user_id)
  on delete set null (path_node_id);

-- Product rule for now: at most one open (not completed) scheduled step per
-- node. Completed steps are history and never block scheduling another. This
-- also closes the double-click race in the app. If a branch later needs
-- several sessions on the calendar at once, drop or replace this index in a
-- future migration.
create unique index tasks_path_node_active_idx
  on public.tasks (path_node_id)
  where path_node_id is not null and not completed;

-- Lookup of every task that came from a node, completed ones included.
create index tasks_path_node_idx
  on public.tasks (path_node_id)
  where path_node_id is not null;
