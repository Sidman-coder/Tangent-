-- Round 2 Phase F.1: when a task was marked Done. The app sets it on every
-- Done and clears it on Undo or reopen; project pace counts by it. Tasks
-- finished before this runs keep it null and are counted by their date.
-- Idempotent; tasks already has row-level security (own rows only).
begin;

alter table public.tasks
  add column if not exists completed_at timestamptz;

create index if not exists tasks_user_completed_at_idx
  on public.tasks (user_id, completed_at)
  where completed_at is not null;

commit;
