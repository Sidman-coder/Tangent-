-- A project's color becomes a key into the series palette in lib/task-colors.ts,
-- so a palette change reaches every project at once. Projects get hues in the
-- order they were created, the same order assignProjectColor walks from empty.
-- The app also reads an old hex value safely, so this can run at any time.

begin;

alter table public.plans add column if not exists color text;

with palette as (
  select array['violet','teal','rose','blue','amber','green','magenta','indigo','orange','cyan'] as keys
), ordered as (
  select p.id,
         row_number() over (partition by p.user_id order by p.created_at, p.id) as n
  from public.plans p, palette
  where p.color is null or not (p.color = any (palette.keys))
)
update public.plans p
   set color = palette.keys[((o.n - 1) % 10) + 1]
  from ordered o, palette
 where p.id = o.id;

commit;
