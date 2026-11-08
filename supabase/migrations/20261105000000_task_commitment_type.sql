-- What kind of promise a task is: fixed, reminder or flexible. Today's Must do
-- and Today's plan sections come from this. Separate from tasks.kind, which says
-- what the work is about (school, academic-ec, side-ec, personal, commitment).
-- Also records when a student dismissed an overdue item from Must do.

begin;

alter table public.tasks add column if not exists commitment_type text;
alter table public.tasks add column if not exists overdue_dismissed_at timestamptz;

alter table public.tasks drop constraint if exists tasks_commitment_type_check;
alter table public.tasks add constraint tasks_commitment_type_check
  check (commitment_type is null or commitment_type in ('fixed', 'reminder', 'flexible'));

create index if not exists tasks_user_commitment_type_idx
  on public.tasks (user_id, commitment_type);

-- Finished tasks are skipped: they never appear on Today, and the app reads a
-- missing value through the same rules.
update public.tasks set commitment_type = case
  when source = 'canvas' then 'fixed'
  -- Calendar imports have no source marker, only the note they were saved with.
  when notes ~ '(^|· )From [^·]+$' then 'fixed'
  when kind = 'commitment' then 'fixed'
  when plan_id is null and time <> '' and title ~*
    '\m(appointment|class|practice at|meeting|game|lesson|dentist|doctor|exam|test at)\M' then 'fixed'
  when plan_id is null
    and array_length(regexp_split_to_array(btrim(title), '\s+'), 1) <= 6
    and title ~* '\m(call|email|text|turn in|bring|pay|remind|submit|sign)\M' then 'reminder'
  else 'flexible'
end
where commitment_type is null and completed = false;

commit;
