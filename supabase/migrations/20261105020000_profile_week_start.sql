begin;

alter table public.profiles add column if not exists week_start smallint not null default 0;
alter table public.profiles drop constraint if exists profiles_week_start_check;
alter table public.profiles add constraint profiles_week_start_check check (week_start in (0, 1, 6));

commit;
