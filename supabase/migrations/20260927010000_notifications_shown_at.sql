-- In-app notification popups: each notification pops at most once, ever,
-- across tabs and devices. The app claims popups with
--   update notifications set shown_at = now()
--   where user_id = … and id in (…) and shown_at is null returning id
-- so two tabs polling at the same moment can't both pop the same one.
-- Existing RLS ("own rows: update") already limits this to the student's rows.

alter table public.notifications add column shown_at timestamptz;

-- Anything already read or dismissed has been seen; don't pop it after deploy.
update public.notifications set shown_at = created_at where read or dismissed;
