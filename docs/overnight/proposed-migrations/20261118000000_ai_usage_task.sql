-- PROPOSED, NOT APPLIED. Written overnight (Phase 4.3); needs Sid's review.
--
-- Why: ai_usage records feature, model, tokens and cost, but not WHICH task made the
-- call. Several tasks share one feature (planBrief, extendPlan and plan detail are all
-- "plan"), so cost per task cannot be read from the table. The paid eval measured it
-- from logs instead (scripts/eval-cost-from-log.mjs).
--
-- Change: one nullable text column. Nothing reads it yet, so it is safe to add before
-- any code change. After it exists, recordUsage (lib/ai/call.ts) can pass the task name.
-- Existing rows stay null. RLS is unchanged (the column is on the same row).

alter table public.ai_usage add column if not exists task text;

comment on column public.ai_usage.task is 'AI_TASKS key that made the call (lib/ai/models.ts), for cost per task.';
