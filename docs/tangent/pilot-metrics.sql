-- TANGENT pilot metrics (Round 2, F.3).
--
-- Read-only queries over public.events, written by lib/analytics.ts. Run them
-- in the Supabase SQL editor (as the service role: RLS limits other roles to
-- their own rows). Events carry names, ids and counts only, never student text.
--
-- Event names: signup, first_capture, capture, first_plan_confirmed,
-- plan_confirmed, task_done, not_today, too_big, fresh_start, auto_replan,
-- grill_answered, grill_skipped, grill_stopped, chat_started, week_two_return.
-- The list lives in lib/analytics-events.ts.

-- 1. Week-2 retention: of the students who signed up at least 15 days ago,
--    the share who opened the app on day 7 through day 14.
with cohort as (
  select user_id, min(occurred_at) as signed_up
  from public.events
  where type = 'signup'
  group by user_id
  having min(occurred_at) < now() - interval '15 days'
)
select
  count(*) as cohort_size,
  count(*) filter (where exists (
    select 1 from public.events e where e.user_id = c.user_id and e.type = 'week_two_return'
  )) as returned_week2,
  round(100.0 * count(*) filter (where exists (
    select 1 from public.events e where e.user_id = c.user_id and e.type = 'week_two_return'
  )) / nullif(count(*), 0), 1) as retention_pct
from cohort c;

-- 2. Tasks done per active student per week. "Active" means at least one
--    event of any kind that week.
with weekly as (
  select date_trunc('week', occurred_at) as week, user_id,
         count(*) filter (where type = 'task_done') as done
  from public.events
  group by 1, 2
)
select week, count(*) as active_students, sum(done) as tasks_done,
       round(sum(done)::numeric / nullif(count(*), 0), 2) as done_per_active_student
from weekly
group by week
order by week desc;

-- 3. Capture → started-task rate: of the students who captured something in a
--    week, the share who also finished at least one task that week.
with weekly as (
  select date_trunc('week', occurred_at) as week, user_id,
         bool_or(type = 'capture') as captured,
         bool_or(type = 'task_done') as finished
  from public.events
  group by 1, 2
)
select week,
       count(*) filter (where captured) as capturing_students,
       count(*) filter (where captured and finished) as also_finished,
       round(100.0 * count(*) filter (where captured and finished)
             / nullif(count(*) filter (where captured), 0), 1) as capture_to_done_pct
from weekly
group by week
order by week desc;

-- 4. Grill stop rate: how often a student stops the Grill compared with how
--    many questions they answered or skipped. A high rate means Tangent asks
--    too much.
select date_trunc('week', occurred_at) as week,
       count(*) filter (where type = 'grill_stopped') as stops,
       coalesce(sum((props->>'count')::int) filter (where type = 'grill_answered'), 0) as answered,
       coalesce(sum((props->>'count')::int) filter (where type = 'grill_skipped'), 0) as skipped,
       round(100.0 * count(*) filter (where type = 'grill_stopped')
             / nullif(count(*) filter (where type in ('grill_answered', 'grill_skipped', 'grill_stopped')), 0), 1) as stop_pct
from public.events
where type like 'grill_%'
group by 1
order by 1 desc;

-- 5. The calm-recovery tools: how often each one is used per week.
select date_trunc('week', occurred_at) as week, type, count(*) as uses
from public.events
where type in ('not_today', 'too_big', 'fresh_start', 'auto_replan')
group by 1, 2
order by 1 desc, 2;
