-- Round 4: the observation log learns how the student plans and asks, not
-- only how they finish steps. New kinds, still codes only (never text):
--   chat_ask         a question in a task or project chat; code = its type
--                    (how_to, explain, check, stuck, time, motivation, other)
--   plan_accept      confirmed a planned preview; code = the intent
--   plan_edit        changed a preview before confirming; code = the edit type
--   plan_reject      discarded a preview, or undid one (code = 'undo')
--   plan_stop        pressed Stop on the planning questions
--   question_answer  answered a planning question; code = its slot
--   question_skip    skipped a planning question; code = its slot
-- Safe to run more than once. Requires 20261110010000_step_events.sql.

alter table public.step_events drop constraint if exists step_events_kind_check;
alter table public.step_events add constraint step_events_kind_check check (kind in (
  'created', 'done', 'skipped', 'not_today', 'too_big', 'rescheduled', 'check_in',
  'chat_ask', 'plan_accept', 'plan_edit', 'plan_reject', 'plan_stop', 'question_answer', 'question_skip'
));
