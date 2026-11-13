-- Round 5A, 1.5: a real waitlist.
-- Someone who signs in but isn't on ALLOWED_EMAILS is added here once. The owner
-- approves them on /settings/waitlist; approval also sets app_metadata.waitlist
-- = 'approved' on their auth user, which is what lets them in (lib/auth/gate.ts).
--
-- Server only: RLS is on with no policies and every grant is revoked from the
-- browser roles. Only the service role (lib/auth/waitlist-server.ts) touches it.
-- The app works before this migration is applied: joining the waitlist is
-- skipped with one warning, and the gate falls back to ALLOWED_EMAILS alone.
-- Safe to run twice.

begin;

create table if not exists public.waitlist (
  email        text primary key check (email = lower(email) and char_length(email) between 3 and 320),
  user_id      uuid references auth.users (id) on delete cascade,
  status       text not null default 'waiting' check (status in ('waiting', 'approved')),
  created_at   timestamptz not null default now(),
  approved_at  timestamptz,
  check ((status = 'approved') = (approved_at is not null))
);

create index if not exists waitlist_status_created_idx on public.waitlist (status, created_at);

alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;

commit;
