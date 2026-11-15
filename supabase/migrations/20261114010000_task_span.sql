-- Round 5A Phase 4.3: task durations and multi-day tasks.
-- duration_min: how long the block is on each day (null = the default 45-min block).
-- end_date: the last day a range task covers (null = a single-date task).
-- The app works before this runs (lib/store.ts treats both as optional columns;
-- resizing then has nothing to save and the calendar keeps the default block).

alter table public.tasks
  add column if not exists duration_min integer null
  check (duration_min is null or (duration_min between 15 and 1440));

alter table public.tasks
  add column if not exists end_date date null;

alter table public.tasks
  drop constraint if exists tasks_end_date_after_date;
alter table public.tasks
  add constraint tasks_end_date_after_date
  check (end_date is null or end_date >= date);

-- Check after running:
--   select column_name, data_type from information_schema.columns
--     where table_name = 'tasks' and column_name in ('duration_min', 'end_date');
--   select conname from pg_constraint where conname = 'tasks_end_date_after_date';
