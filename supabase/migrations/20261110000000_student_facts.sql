-- Round 4 Phase 2: the student model (context engine Layer 1).
-- context_entries stays the one fact store; these columns say what kind of
-- fact it is, where it came from, how sure Tangent is and when it was last
-- confirmed. `fact` keeps the student's original words; `display_text` is the
-- cleaned-up second-person line Tangent shows. Safe to run twice. The app
-- works before this is applied: it reads and writes the old columns only.

begin;

alter table public.context_entries
  add column if not exists fact_category     text,
  add column if not exists fact_source       text,
  add column if not exists confidence        real,
  add column if not exists last_confirmed_at timestamptz,
  add column if not exists project_id        uuid,
  add column if not exists used_count        integer not null default 0,
  add column if not exists display_text      text,
  add column if not exists slot_key          text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'context_entries_fact_category_check') then
    alter table public.context_entries add constraint context_entries_fact_category_check
      check (fact_category is null or fact_category in
        ('identity', 'schedule', 'goals', 'classes_activities', 'how_you_work', 'whats_hard', 'future', 'push_style'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'context_entries_fact_source_check') then
    alter table public.context_entries add constraint context_entries_fact_source_check
      check (fact_source is null or fact_source in ('said', 'seen', 'guessed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'context_entries_confidence_check') then
    alter table public.context_entries add constraint context_entries_confidence_check
      check (confidence is null or (confidence >= 0 and confidence <= 1));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'context_entries_slot_key_check') then
    alter table public.context_entries add constraint context_entries_slot_key_check
      check (slot_key is null or slot_key ~ '^[a-zA-Z]{1,32}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'context_entries_display_text_len') then
    alter table public.context_entries add constraint context_entries_display_text_len
      check (display_text is null or char_length(display_text) <= 500);
  end if;
  -- A fact about one project goes when the project does.
  if not exists (select 1 from pg_constraint where conname = 'context_entries_project_fk') then
    alter table public.context_entries add constraint context_entries_project_fk
      foreign key (project_id, user_id) references public.plans (id, user_id) on delete cascade;
  end if;
end $$;

create index if not exists context_entries_user_category_idx
  on public.context_entries (user_id, fact_category);
create index if not exists context_entries_user_project_idx
  on public.context_entries (user_id, project_id) where project_id is not null;

-- RLS: context_entries already has own-row select/insert/update/delete
-- policies from the init schema; nothing to add.

commit;
