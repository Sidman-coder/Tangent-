// Single source of truth for which Claude model each AI task uses and how it is
// called. No other file names a model ID: callers pick a task from AI_TASKS and
// spread modelParams(task) into the request.
//
// Tiers
//   FAST  — classification, extraction, notification copy, context, titles.
//   SMART — plan generation, the Tangent Map, the multi-step agent, chat.
// Override a tier per deployment with AI_MODEL_FAST / AI_MODEL_SMART.
//
// Model IDs and prices were checked on 2026-09-27 against the Anthropic model
// list shipped with @anthropic-ai/sdk 0.128 and the Claude API model docs.

export const DEFAULT_MODELS = {
  FAST: "claude-haiku-4-5",
  SMART: "claude-sonnet-5",
} as const;

export type Tier = keyof typeof DEFAULT_MODELS;

/** Resolved at call time so tests and env changes take effect without a restart. */
export function modelFor(tier: Tier): string {
  const override = tier === "FAST" ? process.env.AI_MODEL_FAST : process.env.AI_MODEL_SMART;
  return override?.trim() || DEFAULT_MODELS[tier];
}

export const MODELS = {
  get FAST() {
    return modelFor("FAST");
  },
  get SMART() {
    return modelFor("SMART");
  },
};

/** Feature labels recorded with every call (ai_usage.feature). */
export type Feature = "plan" | "classify" | "agent" | "chat" | "context" | "brief" | "tangent" | "notif" | "router";

export type TaskConfig = {
  feature: Feature;
  tier: Tier;
  maxTokens: number;
  /** Only sent to models that accept sampling parameters (see supportsSampling). */
  temperature?: number;
  /** SMART models think adaptively unless told otherwise; latency-sensitive tasks disable it. */
  thinking?: "disabled" | "adaptive";
  /** output_config.effort, for models that support it. */
  effort?: "low" | "medium" | "high";
  /** TTL for cache_control breakpoints this task places. */
  cacheTtl?: "5m" | "1h";
};

export const AI_TASKS = {
  /** Voice/chat command → structured action (VOICE_COMMAND_SCHEMA). */
  voiceCommand: { feature: "classify", tier: "FAST", maxTokens: 4096, temperature: 0, cacheTtl: "5m" },
  /** Same, with the shorter prompt after a 429. */
  voiceCommandRetry: { feature: "classify", tier: "FAST", maxTokens: 4096, temperature: 0 },
  /** Multi-session plan in one call (PLAN_SCHEMA). Kept for the agent's create_plan tool. */
  plan: { feature: "plan", tier: "SMART", maxTokens: 4096, thinking: "disabled", cacheTtl: "5m" },
  /** Plan stage 1: title + phase names/goals (lib/ai/plan.ts). Small and SMART: it sets the progression. */
  planOutline: { feature: "plan", tier: "SMART", maxTokens: 300, thinking: "disabled" },
  /** Plan stage 2: the sessions of one phase, run in parallel. FAST measured faster and
   *  cheaper at equal quality (docs/tangent/perf-after.md); AI_PLAN_DETAIL_TIER=SMART overrides. */
  planDetail: { feature: "plan", tier: "FAST", maxTokens: 2048, temperature: 0.7, thinking: "disabled" },
  /** Gmail/Canvas/calendar tool loop. */
  agent: { feature: "agent", tier: "SMART", maxTokens: 2048, thinking: "disabled", cacheTtl: "5m" },
  /** Plan-mode chat reply (talks a plan through, never acts). */
  chatPlan: { feature: "chat", tier: "SMART", maxTokens: 700, thinking: "disabled" },
  /** Per-task helper chat. */
  taskChat: { feature: "chat", tier: "SMART", maxTokens: 500, thinking: "disabled" },
  /** On-demand and scheduled Daily Brief narrative. */
  dailyBrief: { feature: "brief", tier: "SMART", maxTokens: 300, thinking: "disabled", cacheTtl: "5m" },
  /** Brief sources: page summary, narration, source suggestions. */
  briefSources: { feature: "brief", tier: "FAST", maxTokens: 500, cacheTtl: "5m" },
  /** Proactive notification copy. */
  proactive: { feature: "notif", tier: "FAST", maxTokens: 400 },
  /** Tangents: three branches off one node of a Path (app/api/path). SMART with
   *  thinking off, like plan generation; "tangent" is a heavy feature, so it is
   *  blocked rather than downgraded once the daily budget is spent. */
  pathBranches: { feature: "tangent", tier: "SMART", maxTokens: 1500, thinking: "disabled" },
  /** Durable-fact extraction from a chat turn. */
  contextExtract: { feature: "context", tier: "FAST", maxTokens: 300 },
  /** Compress the context file once it grows past 40 entries. */
  contextCompress: { feature: "context", tier: "FAST", maxTokens: 400 },
} as const satisfies Record<string, TaskConfig>;

export type AiTask = keyof typeof AI_TASKS;

// ─── Model capabilities ──────────────────────────────────────────────────────

/** Sonnet 5, Opus 4.7+ and the Fable/Mythos 5 family reject non-default temperature/top_p/top_k. */
export function supportsSampling(model: string): boolean {
  return !/^claude-(sonnet-5|opus-(4-[7-9]|5)|fable|mythos)/.test(model);
}

/** Models with adaptive thinking and output_config.effort. Haiku 4.5 and Sonnet 4.5 have neither. */
export function supportsEffort(model: string): boolean {
  return /^claude-(sonnet-(4-6|5)|opus-(4-[5-9]|5)|fable|mythos)/.test(model);
}

/** Smallest prompt prefix the model will cache; shorter prefixes silently don't. */
export function minCacheableTokens(model: string): number {
  if (/^claude-haiku/.test(model)) return 4096;
  if (/^claude-(opus-5|fable)/.test(model)) return 512;
  return 1024;
}

export type ModelParams = {
  model: string;
  max_tokens: number;
  temperature?: number;
  thinking?: { type: "disabled" } | { type: "adaptive" };
  output_config?: { effort?: "low" | "medium" | "high"; format?: Record<string, unknown> };
};

/** Request fields for a task: model, max_tokens and whatever sampling/thinking
 *  settings the resolved model accepts. Spread into the request body. Pass the
 *  structured-output format here (not as a separate output_config) so it merges
 *  with effort instead of replacing it. */
export function modelParams(task: AiTask, opts: { tier?: Tier; format?: Record<string, unknown> } = {}): ModelParams {
  const cfg: TaskConfig = AI_TASKS[task];
  const model = modelFor(opts.tier ?? cfg.tier);
  const params: ModelParams = { model, max_tokens: cfg.maxTokens };
  if (cfg.temperature !== undefined && supportsSampling(model)) params.temperature = cfg.temperature;
  const outputConfig: NonNullable<ModelParams["output_config"]> = {};
  if (opts.format) outputConfig.format = opts.format;
  if (supportsEffort(model)) {
    // Thinking-capable models get an explicit setting so a model swap never
    // silently turns on adaptive thinking (Sonnet 5 thinks when it's omitted).
    params.thinking = { type: cfg.thinking ?? "disabled" };
    if (cfg.effort) outputConfig.effort = cfg.effort;
  }
  if (Object.keys(outputConfig).length > 0) params.output_config = outputConfig;
  return params;
}

// ─── Prices (USD per million tokens) ─────────────────────────────────────────
// Cache writes cost 1.25× input (5-minute TTL) or 2× (1-hour); cache reads 0.1×.
// The Batch API halves every rate.

export type Price = { input: number; output: number };

export const PRICES: Record<string, Price> = {
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-opus-5": { input: 5, output: 25 },
};

export function priceFor(model: string): Price {
  if (PRICES[model]) return PRICES[model];
  const base = Object.keys(PRICES).find((id) => model.startsWith(id));
  // Unknown models are priced as the most expensive listed tier so budgets err safe.
  return base ? PRICES[base] : { input: 5, output: 25 };
}

export type UsageTokens = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  /** Per-TTL split of cache_creation_input_tokens, when the API reports it. */
  cache_creation?: { ephemeral_5m_input_tokens?: number | null; ephemeral_1h_input_tokens?: number | null } | null;
};

/** Estimated USD cost of one response. Cache writes are priced per TTL from the
 *  usage breakdown, else at the task's TTL. */
export function estimateCostUsd(model: string, usage: UsageTokens, opts: { batch?: boolean; cacheTtl?: "5m" | "1h" } = {}): number {
  const p = priceFor(model);
  const split = usage.cache_creation;
  const writeUnits = split
    ? (split.ephemeral_5m_input_tokens ?? 0) * 1.25 + (split.ephemeral_1h_input_tokens ?? 0) * 2
    : (usage.cache_creation_input_tokens ?? 0) * (opts.cacheTtl === "1h" ? 2 : 1.25);
  const usd =
    ((usage.input_tokens ?? 0) * p.input +
      writeUnits * p.input +
      (usage.cache_read_input_tokens ?? 0) * p.input * 0.1 +
      (usage.output_tokens ?? 0) * p.output) /
    1_000_000;
  return Math.round((opts.batch ? usd / 2 : usd) * 1e6) / 1e6;
}
