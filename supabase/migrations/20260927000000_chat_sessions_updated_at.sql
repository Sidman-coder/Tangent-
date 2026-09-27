-- Let Postgres stamp chat_sessions.updated_at so chat ordering uses one clock
-- (the database's) instead of the app server's. The store still sends
-- updated_at on touch; this trigger overrides it with now().
create trigger chat_sessions_set_updated_at
  before update on public.chat_sessions
  for each row execute function public.set_updated_at();
