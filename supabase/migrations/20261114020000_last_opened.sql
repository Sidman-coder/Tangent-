-- When a student last opened each project (plans) and Tangent (paths), so the
-- sidebar's Projects list shows the ones they actually use, not just the
-- newest. Null until first opened; the app falls back to created_at.
-- The code keeps working before this runs (lib/store.ts markOpened, getPathSpace).

alter table public.plans add column if not exists last_opened_at timestamptz;
alter table public.paths add column if not exists last_opened_at timestamptz;

-- paths.updated_at means "the Tangent changed". Opening one only stamps
-- last_opened_at, so the trigger skips updates that touch nothing else.
drop trigger if exists paths_set_updated_at on public.paths;
create trigger paths_set_updated_at
  before update on public.paths
  for each row
  when ((to_jsonb(old) - 'last_opened_at' - 'updated_at') is distinct from (to_jsonb(new) - 'last_opened_at' - 'updated_at'))
  execute function public.set_updated_at();
