-- Round 2 Phase E: nudge times and quiet hours, chosen in Settings →
-- Notifications. A JSON object: { "nudgeTimes": ["07:30"], "quietHours":
-- { "start": "22:00", "end": "07:00" } }. Empty means "no preference".
-- Idempotent; profiles already has row-level security (own row only).
begin;

alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

alter table public.profiles drop constraint if exists profiles_notification_prefs_check;
alter table public.profiles
  add constraint profiles_notification_prefs_check check (jsonb_typeof(notification_prefs) = 'object');

commit;
