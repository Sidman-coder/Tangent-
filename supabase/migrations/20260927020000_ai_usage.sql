-- AI usage telemetry: one row per Claude call (lib/ai/call.ts, lib/ai/batch.ts).
-- Stores token counts, duration and estimated cost only — never prompt or
-- response contents. Drives the per-student daily budget (AI_DAILY_BUDGET_USD)
-- and the cost-by-feature report (scripts/ai-cost-report.mjs).
--
-- Students may read their own rows. Nobody but the server writes: there is no
-- insert/update/delete policy, and those privileges are revoked from the API
-- roles, so rows come only from the service-role client.

create table public.ai_usage (
  id                    bigint generated always as identity primary key,
  user_id               uuid references auth.users (id) on delete cascade,
  feature               text not null,
  model                 text not null,
  input_tokens          int,
  output_tokens         int,
  cache_creation_tokens int,
  cache_read_tokens     int,
  is_batch              boolean not null default false,
  duration_ms           int,
  est_cost_usd          numeric(10, 6),
  -- How the request was routed (lib/ai/router.ts), or a budget event
  -- ("budget:fast", "budget:blocked"). Null for plain calls.
  route                 text,
  created_at            timestamptz not null default now()
);

create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at);
create index ai_usage_feature_created_idx on public.ai_usage (feature, created_at);

alter table public.ai_usage enable row level security;

create policy "own rows: select" on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));

revoke insert, update, delete on public.ai_usage from anon, authenticated;
