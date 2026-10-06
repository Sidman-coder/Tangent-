-- First-run onboarding preferences.
--
-- Additive and backward compatible: every column is nullable, so existing
-- profiles (and application code that never selects these columns) keep
-- working. NULL means "not answered", and the app falls back to today's
-- default behavior for that preference.
--
-- No RLS change is needed: the existing own-row select/update policies on
-- public.profiles already cover new columns.
--
-- Apply this BEFORE deploying application code that selects these columns
-- (lib/store.ts PROFILE_COLUMNS lists them explicitly).

alter table public.profiles
  add column if not exists help_focus text
    constraint profiles_help_focus_check
    check (help_focus in ('school', 'goals', 'balance', 'unsure')),
  add column if not exists slip_point text
    constraint profiles_slip_point_check
    check (slip_point in ('assignments', 'projects', 'ideas', 'deadlines', 'everything')),
  add column if not exists day_view text
    constraint profiles_day_view_check
    check (day_view in ('next', 'day', 'week', 'goals')),
  add column if not exists working_toward text
    constraint profiles_working_toward_check
    check (working_toward in ('school', 'build', 'skill', 'prepare', 'organized')),
  add column if not exists starting_intent text
    constraint profiles_starting_intent_check
    check (char_length(starting_intent) <= 140);
