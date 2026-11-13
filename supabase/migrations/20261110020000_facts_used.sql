-- Round 4 Phase 2: which facts shaped an AI answer, so "How this was planned"
-- and Settings → AI activity can say "Used: you can give 4 hrs a week · …".
-- A list of {id, text}; never the prompt. Safe to run twice. Before it's
-- applied the app leaves the line out.

begin;

alter table public.change_sets  add column if not exists facts_used jsonb;
alter table public.ai_decisions add column if not exists facts_used jsonb;

commit;
