-- Round 5A Phase 3: School and Work are projects.
-- A plan with kind 'school' or 'work' is that student's School or Work
-- project; null is an ordinary goal. At most one of each per student.
-- The app works before this runs (lib/store.ts ensureAreaProjects skips when
-- the column is missing, and /projects falls back to the virtual School card).

alter table public.plans
  add column if not exists kind text null
  check (kind in ('school', 'work'));

create unique index if not exists plans_user_kind_unique
  on public.plans (user_id, kind)
  where kind is not null;

-- Check after running:
--   select column_name, data_type from information_schema.columns
--     where table_name = 'plans' and column_name = 'kind';
--   select indexname from pg_indexes where indexname = 'plans_user_kind_unique';
