-- Safety hotfix: Undo survives navigation. An assistant chat message remembers
-- the change it made, so reopening the chat can show Undo again (or "Can't undo
-- anymore" once the action record is gone or already undone).
--
--   action_id      action_records.id of the change (any kind, incl. apply_changeset)
--   change_set_id  change_sets.id of a Pipeline V2 draft shown in that message
--
-- No foreign keys: action_records are trimmed to the newest 50 per student and
-- change sets expire, and a dangling id simply reads as "Can't undo anymore".
-- Both columns are only hints; /api/actions re-checks ownership and state.
--
-- Nullable, so existing rows and older app builds keep working. The app falls
-- back to the old columns if this migration hasn't been applied yet.
-- Safe to run twice.

begin;

alter table public.chat_messages add column if not exists action_id uuid;
alter table public.chat_messages add column if not exists change_set_id uuid;

commit;
