-- How much work a student can take on in a day (the spacing brain, lib/load.ts).
--
-- Additive and backward compatible: both columns are nullable and NULL means
-- "never answered", so the app uses DEFAULT_CAPACITY (150 min on school
-- nights, 240 on weekends) and asks the student once.
--
-- Safe to apply before OR after the code that reads them: lib/store.ts reads
-- these columns in their own query and falls back to null when they don't
-- exist yet. Until this is applied, a student's answer can't be saved, so
-- they may be asked again.
--
-- No RLS change: the existing own-row select/update policies on
-- public.profiles cover new columns.

alter table public.profiles
  add column if not exists capacity_weekday_min integer
    constraint profiles_capacity_weekday_check check (capacity_weekday_min between 15 and 600),
  add column if not exists capacity_weekend_min integer
    constraint profiles_capacity_weekend_check check (capacity_weekend_min between 15 and 720);
