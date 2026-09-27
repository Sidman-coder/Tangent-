import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AI_TASKS, estimateCostUsd, modelParams, type AiTask, type TaskConfig, type Feature, type Tier, type UsageTokens } from "@/lib/ai/models";
import { createAdminClient } from "@/lib/supabase/admin";
import { perfClaude } from "@/lib/perf";
import { isOwnerEmail } from "@/lib/auth/access";
import { getRequestContext, type RequestContext } from "@/lib/request-context";

// Every Claude call goes through callClaude(). It picks the model for the task
// (lib/ai/models.ts), enforces the per-student daily budget, and records one
// ai_usage row per call: feature, model, token counts, duration and estimated
// cost. Prompt and response contents are never logged or stored.

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  client ??= new Anthropic({ apiKey, maxRetries: 2 });
  return client;
}

export type ClaudeRequest = Omit<Anthropic.MessageCreateParamsNonStreaming, "model" | "max_tokens" | "temperature" | "thinking" | "output_config"> & {
  /** Overrides the task's max_tokens (e.g. a shorter brief-sources call). */
  max_tokens?: number;
};

export type ClaudeResult =
  | { ok: true; message: Anthropic.Message; model: string; degraded: boolean }
  | { ok: false; status: number; error: string; budgetExceeded?: boolean };

export type CallOptions = {
  /** Structured output schema (output_config.format). */
  format?: Anthropic.JSONOutputFormat;
  /** Force a tier (the router escalates FAST → SMART this way). */
  tier?: Tier;
  /** How the router got here (e.g. "fast-path-miss", "smart-escalation"); stored in ai_usage.route. */
  route?: string;
  /** Label for dev perf logs. Defaults to the task name. */
  label?: string;
};

// ─── Budget ──────────────────────────────────────────────────────────────────

/** Features too expensive to run on the FAST model as a budget fallback. */
const HEAVY_FEATURES: ReadonlySet<Feature> = new Set<Feature>(["plan", "tangent"]);

export const BUDGET_MESSAGE =
  "You've used today's AI allowance for building plans. It resets at midnight UTC. You can still add tasks, check what's due, and ask quick questions.";

export function dailyBudgetUsd(): number {
  const raw = Number(process.env.AI_DAILY_BUDGET_USD);
  return Number.isFinite(raw) && raw >= 0 && process.env.AI_DAILY_BUDGET_USD?.trim() ? raw : 0.5;
}

function utcDayStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

// Per-process cache of today's spend so a multi-turn request doesn't re-read
// ai_usage before every call. Re-read after 60 s; add local spend in between.
const spendCache = new Map<string, { day: string; usd: number; readAt: number }>();
const SPEND_TTL_MS = 60_000;

/** Today's (UTC) estimated spend for the current student. */
export async function spentTodayUsd(ctx: RequestContext): Promise<number> {
  const day = utcDayStart();
  const hit = spendCache.get(ctx.userId);
  if (hit && hit.day === day && Date.now() - hit.readAt < SPEND_TTL_MS) return hit.usd;
  // RLS lets a student read only their own rows; the explicit filter keeps the
  // service-role (cron) client scoped too.
  const { data, error } = await ctx.db.from("ai_usage").select("est_cost_usd").eq("user_id", ctx.userId).gte("created_at", day);
  if (error) {
    // Telemetry must never take the product down; without the table (migration
    // not applied yet) the budget can't be enforced, so say so loudly.
    console.warn("[ai] budget check unavailable:", error.message);
    return 0;
  }
  const usd = (data ?? []).reduce((sum, r) => sum + Number((r as { est_cost_usd: number | string | null }).est_cost_usd ?? 0), 0);
  spendCache.set(ctx.userId, { day, usd, readAt: Date.now() });
  return usd;
}

function addLocalSpend(userId: string, usd: number): void {
  const hit = spendCache.get(userId);
  if (hit && hit.day === utcDayStart()) hit.usd += usd;
}

/** Test hook: forget cached spend. */
export function resetSpendCache(): void {
  spendCache.clear();
}

type BudgetDecision = { action: "allow" } | { action: "downgrade" } | { action: "block" };

async function budgetDecision(ctx: RequestContext | null, feature: Feature): Promise<BudgetDecision> {
  if (!ctx || isOwnerEmail(ctx.email)) return { action: "allow" };
  if ((await spentTodayUsd(ctx)) < dailyBudgetUsd()) return { action: "allow" };
  return HEAVY_FEATURES.has(feature) ? { action: "block" } : { action: "downgrade" };
}

// ─── Telemetry ───────────────────────────────────────────────────────────────

export type UsageRow = {
  userId: string | null;
  feature: Feature;
  model: string;
  usage: UsageTokens;
  durationMs: number;
  isBatch?: boolean;
  cacheTtl?: "5m" | "1h";
  route?: string;
};

let warnedNoAdmin = false;

/** Inserts one ai_usage row. Server-side only (the table has no INSERT policy),
 *  so it uses the service-role client with an explicit user_id. Never throws. */
export async function recordUsage(row: UsageRow): Promise<number> {
  const cost = estimateCostUsd(row.model, row.usage, { batch: row.isBatch, cacheTtl: row.cacheTtl });
  if (row.userId) addLocalSpend(row.userId, cost);
  try {
    const { error } = await createAdminClient().from("ai_usage").insert({
      user_id: row.userId,
      feature: row.feature,
      model: row.model,
      input_tokens: row.usage.input_tokens ?? 0,
      output_tokens: row.usage.output_tokens ?? 0,
      cache_creation_tokens: row.usage.cache_creation_input_tokens ?? 0,
      cache_read_tokens: row.usage.cache_read_input_tokens ?? 0,
      is_batch: row.isBatch ?? false,
      duration_ms: Math.round(row.durationMs),
      est_cost_usd: cost,
      route: row.route ?? null,
    });
    if (error) console.warn("[ai] usage not recorded:", error.message);
  } catch (e) {
    if (!warnedNoAdmin) {
      warnedNoAdmin = true;
      console.warn("[ai] usage not recorded:", e instanceof Error ? e.message : e);
    }
  }
  return cost;
}

function currentContext(): RequestContext | null {
  try {
    return getRequestContext();
  } catch {
    // Callers that touch student data already require a context; telemetry
    // just records the call without a student rather than guessing one.
    return null;
  }
}

// ─── The call ────────────────────────────────────────────────────────────────

type Prepared =
  | { blocked: ClaudeResult }
  | { blocked?: undefined; cfg: TaskConfig; userId: string | null; route?: string; model: string; body: Anthropic.MessageCreateParamsNonStreaming };

/** Budget check and request body shared by callClaude and streamClaude. */
async function prepare(task: AiTask, request: ClaudeRequest, opts: CallOptions): Promise<Prepared> {
  const cfg: TaskConfig = AI_TASKS[task];
  const ctx = currentContext();
  const userId = ctx?.userId ?? null;

  const budget = await budgetDecision(ctx, cfg.feature);
  let tier = opts.tier ?? cfg.tier;
  let route = opts.route ?? ctx?.aiRoute;
  if (budget.action === "block") {
    console.warn(`[ai] daily budget reached; blocked ${cfg.feature}`);
    await recordUsage({ userId, feature: cfg.feature, model: "none", usage: {}, durationMs: 0, route: "budget:blocked" });
    return { blocked: { ok: false, status: 429, error: BUDGET_MESSAGE, budgetExceeded: true } };
  }
  if (budget.action === "downgrade" && tier !== "FAST") {
    console.warn(`[ai] daily budget reached; ${cfg.feature} downgraded to FAST`);
    tier = "FAST";
    route = "budget:fast";
  }

  const params = modelParams(task, { tier, format: opts.format as Record<string, unknown> | undefined });
  const { max_tokens, ...rest } = request;
  const body = { ...rest, ...params, max_tokens: max_tokens ?? params.max_tokens } as Anthropic.MessageCreateParamsNonStreaming;
  return { cfg, userId, route, model: params.model, body };
}

async function finish(task: AiTask, p: Exclude<Prepared, { blocked: ClaudeResult }>, opts: CallOptions, message: Anthropic.Message, durationMs: number): Promise<ClaudeResult> {
  perfClaude(
    opts.label ?? task,
    message.model,
    (message.usage.input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0),
    message.usage.output_tokens ?? 0,
    durationMs,
    200,
    message.usage.cache_read_input_tokens ?? 0,
  );
  await recordUsage({ userId: p.userId, feature: p.cfg.feature, model: p.model, usage: message.usage, durationMs, cacheTtl: p.cfg.cacheTtl, route: p.route });
  return { ok: true, message, model: p.model, degraded: p.route === "budget:fast" };
}

function failure(task: AiTask, model: string, opts: CallOptions, e: unknown, start: number): ClaudeResult {
  const status = e instanceof Anthropic.APIError ? (e.status ?? 0) : 0;
  const error = e instanceof Error ? e.message : String(e);
  perfClaude(opts.label ?? task, model, 0, 0, Date.now() - start, status);
  return { ok: false, status, error };
}

/** Calls Claude for `task`. Never throws for API errors: returns ok:false with
 *  the HTTP status so callers keep their existing fallback paths. */
export async function callClaude(task: AiTask, request: ClaudeRequest, opts: CallOptions = {}): Promise<ClaudeResult> {
  const p = await prepare(task, request, opts);
  if (p.blocked) return p.blocked;
  const start = Date.now();
  let message: Anthropic.Message;
  try {
    message = await anthropic().messages.create(p.body);
  } catch (e) {
    return failure(task, p.model, opts, e, start);
  }
  return finish(task, p, opts, message, Date.now() - start);
}

/** callClaude, streamed: onText receives the accumulated text after every
 *  delta, so callers can show partial structured output as it arrives. The
 *  result, budget and telemetry are identical to callClaude. */
export async function streamClaude(
  task: AiTask,
  request: ClaudeRequest,
  opts: CallOptions & { onText: (textSoFar: string) => void }
): Promise<ClaudeResult> {
  const p = await prepare(task, request, opts);
  if (p.blocked) return p.blocked;
  const start = Date.now();
  let message: Anthropic.Message;
  try {
    const stream = anthropic().messages.stream(p.body);
    let text = "";
    stream.on("text", (delta) => {
      text += delta;
      try {
        opts.onText(text);
      } catch (e) {
        // A progress callback must never break generation.
        console.warn("[ai] onText callback failed:", e instanceof Error ? e.message : e);
      }
    });
    message = await stream.finalMessage();
  } catch (e) {
    return failure(task, p.model, opts, e, start);
  }
  return finish(task, p, opts, message, Date.now() - start);
}

/** Joined text blocks of a response. */
export function messageText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
