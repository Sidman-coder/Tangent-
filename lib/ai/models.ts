// Single source of truth for which Claude model each AI task uses and how it is
// called. No other file names a model ID: callers pick a task from AI_TASKS and
// spread modelParams(task) into the request.
//
// Tiers
//   FAST  — classification, extraction, notification copy, context, titles.
//   SMART — plan generation, the Tangent Map, the multi-step agent, chat.
// Override a tier per deployment with AI_MODEL_FAST / AI_MODEL_SMART.
//
// Model IDs, prices and parameter rules were checked on 2026-10-11 against
// platform.claude.com/docs (models overview, pricing, prompt caching, and the
// Sonnet 5.5 / Haiku 5.5 migration notes).

export const DEFAULT_MODELS = {
  FAST: "claude-haiku-5-5",
  SMART: "claude-sonnet-5-5",
} as const;

/** Used once per call when the tier's model returns 404 not_found_error
 *  (lib/ai/call.ts): the previous generation of each tier. */
export const FALLBACK_MODELS = {
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
export type Feature = "plan" | "classify" | "agent" | "chat" | "context" | "brief" | "tangent" | "notif" | "router" | "intentRouter" | "extendPlan";

export type TaskConfig = {
  feature: Feature;
  tier: Tier;
  maxTokens: number;
  /** Only sent to models that accept sampling parameters (see supportsSampling). */
  temperature?: number;
  /** Thinking-capable models think adaptively unless told otherwise; latency-sensitive
   *  tasks turn it off ("disabled" maps to between_tools on Sonnet 5.5, see thinkingFor). */
  thinking?: "disabled" | "adaptive";
  /** output_config.effort, for models that support it. Unset = the model's default
   *  (student-facing text); "low" for routing and classification. */
  effort?: "low" | "medium" | "high";
  /** TTL for cache_control breakpoints this task places. */
  cacheTtl?: "5m" | "1h";
};

export const AI_TASKS = {
  /** Voice/chat command → structured action (VOICE_COMMAND_SCHEMA). */
  voiceCommand: { feature: "classify", tier: "FAST", maxTokens: 4096, temperature: 0, cacheTtl: "5m", effort: "low" },
  /** Same, with the shorter prompt after a 429. */
  voiceCommandRetry: { feature: "classify", tier: "FAST", maxTokens: 4096, temperature: 0, effort: "low" },
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
  /** Before acting on a big or vague request: what to ask the student first
   *  (lib/ai/clarify.ts). SMART because the questions are the product; thinking
   *  off to keep the pause short. */
  clarify: { feature: "chat", tier: "SMART", maxTokens: 700, thinking: "disabled" },
  /** Facts pulled from text the student pastes from another AI (lib/ai/import-context.ts). */
  contextImport: { feature: "context", tier: "SMART", maxTokens: 3000, thinking: "disabled" },
  /** New Tangent intake: drafts the answers from context, then asks what's missing. */
  pathIntake: { feature: "tangent", tier: "SMART", maxTokens: 900, thinking: "disabled" },
  /** The next "grill me" question, aimed at what Tangent doesn't know yet. */
  grillNext: { feature: "chat", tier: "SMART", maxTokens: 400, thinking: "disabled" },
  /** Round 2 Phase C: what a plan request already states (lib/context/infer.ts),
   *  only when the rules find nothing. FAST: a short extraction. */
  inferSlots: { feature: "classify", tier: "FAST", maxTokens: 300, temperature: 0, effort: "low" },
  /** Short calendar labels for long task titles (app/api/short-titles). */
  shortTitles: { feature: "classify", tier: "FAST", maxTokens: 3000, temperature: 0, effort: "low" },
  /** Master fix Phase 4: a 3–6 word chat title from the first message, when
   *  no project names the chat (app/api/sessions "autotitle"). */
  chatTitle: { feature: "classify", tier: "FAST", maxTokens: 40, temperature: 0, effort: "low" },
  /** Round 2 Phase D: a running summary of a chat thread every ~6 messages
   *  (lib/chat/summary.ts), read back into that thread's context. */
  chatSummary: { feature: "context", tier: "FAST", maxTokens: 250, temperature: 0, effort: "low" },
  /** Applies the student's answers to a saved task (lib/ai/refine.ts). */
  /** The detail every captured task carries (notes, first step, category). It runs
   *  in the background after the save, so it buys quality, not speed: SMART. */
  refineTask: { feature: "chat", tier: "SMART", maxTokens: 1200, thinking: "disabled" },
  /** Too big on Today: one step into 2-3 smaller ones (lib/ai/split.ts). */
  splitStep: { feature: "chat", tier: "FAST", maxTokens: 500 },
  /** Durable-fact extraction from a chat turn. */
  contextExtract: { feature: "context", tier: "FAST", maxTokens: 300, effort: "low" },
  /** Compress the context file once it grows past 40 entries. */
  contextCompress: { feature: "context", tier: "FAST", maxTokens: 400, effort: "low" },
  /** Pipeline V2 intent router (lib/pipeline/intent.ts): one short JSON answer
   *  per request. The system prompt (~900 tokens) is cached for 1 hour: over Haiku
   *  5.5's 512-token minimum, under Haiku 4.5's 4,096 (the fallback drops it). */
  intentRouter: { feature: "intentRouter", tier: "FAST", maxTokens: 200, temperature: 0, effort: "low", cacheTtl: "1h" },
  /** Master fix B5: which of a question's options an unclear reply means, or
   *  none (lib/ai/pick-candidate.ts). Numbers in, numbers out. */
  pickCandidate: { feature: "classify", tier: "FAST", maxTokens: 150, temperature: 0, effort: "low" },
  /** Fixed, reminder or flexible, when the rules aren't sure (lib/task-kind-ai.ts). */
  classifyCommitment: { feature: "classify", tier: "FAST", maxTokens: 60, temperature: 0, effort: "low" },
  /** Pipeline V2: only the new tasks for an existing plan (lib/pipeline/extend-plan.ts). */
  extendPlan: { feature: "extendPlan", tier: "SMART", maxTokens: 1500, thinking: "disabled" },
} as const satisfies Record<string, TaskConfig>;

export type AiTask = keyof typeof AI_TASKS;

// ─── Model capabilities ──────────────────────────────────────────────────────

/** Sonnet 5+, Haiku 5+, Opus 4.7+ and the Fable/Mythos 5 family reject non-default temperature/top_p/top_k. */
export function supportsSampling(model: string): boolean {
  return !/^claude-(sonnet-5|haiku-5|opus-(4-[7-9]|5)|fable|mythos)/.test(model);
}

/** Models with adaptive thinking and output_config.effort. Haiku 4.5 and Sonnet 4.5 have neither. */
export function supportsEffort(model: string): boolean {
  return /^claude-(sonnet-(4-6|5)|haiku-5|opus-(4-[5-9]|5)|fable|mythos)/.test(model);
}

/** Sonnet 5.5 rejects thinking "disabled" (400); its lowest setting is
 *  "between_tools", which no other model accepts. */
function needsBetweenTools(model: string): boolean {
  return /^claude-sonnet-5-5/.test(model);
}

/** Smallest prompt prefix the model will cache; shorter prefixes silently don't. */
export function minCacheableTokens(model: string): number {
  if (/^claude-haiku-4/.test(model)) return 4096;
  if (/^claude-(haiku-5|sonnet-5-5|opus-5|fable)/.test(model)) return 512;
  return 1024;
}

export type ThinkingParam = { type: "disabled" } | { type: "adaptive" } | { type: "between_tools" };

export type ModelParams = {
  model: string;
  max_tokens: number;
  temperature?: number;
  thinking?: ThinkingParam;
  output_config?: { effort?: "low" | "medium" | "high"; format?: Record<string, unknown> };
};

/** The task's thinking setting in the form `model` accepts. */
export function thinkingFor(model: string, wanted: "disabled" | "adaptive"): ThinkingParam {
  if (wanted === "adaptive") return { type: "adaptive" };
  return needsBetweenTools(model) ? { type: "between_tools" } : { type: "disabled" };
}

/** Request fields for a task: model, max_tokens and whatever sampling/thinking
 *  settings the resolved model accepts. Spread into the request body. Pass the
 *  structured-output format here (not as a separate output_config) so it merges
 *  with effort instead of replacing it. */
export function modelParams(task: AiTask, opts: { tier?: Tier; format?: Record<string, unknown>; model?: string } = {}): ModelParams {
  const cfg: TaskConfig = AI_TASKS[task];
  const model = opts.model ?? modelFor(opts.tier ?? cfg.tier);
  const params: ModelParams = { model, max_tokens: cfg.maxTokens };
  if (cfg.temperature !== undefined && supportsSampling(model)) params.temperature = cfg.temperature;
  const outputConfig: NonNullable<ModelParams["output_config"]> = {};
  if (opts.format) outputConfig.format = opts.format;
  if (supportsEffort(model)) {
    // Thinking-capable models get an explicit setting so a model swap never
    // silently turns on adaptive thinking (Sonnet 5+ and Haiku 5.5 think when
    // it's omitted). Every effort used here is "high" or below, which
    // "disabled" and "between_tools" both require.
    params.thinking = thinkingFor(model, cfg.thinking ?? "disabled");
    if (cfg.effort) outputConfig.effort = cfg.effort;
  }
  if (Object.keys(outputConfig).length > 0) params.output_config = outputConfig;
  return params;
}

// ─── Prices (USD per million tokens) ─────────────────────────────────────────
// Cache writes cost 1.25× input (5-minute TTL) or 2× (1-hour); cache reads 0.1×
// input, except 0.05× on Sonnet 5.5. The Batch API halves every rate.
// Haiku 5.5 alone has a long-context tier: a request whose prompt (input + cache
// writes + cache reads) is over 100,000 tokens pays 5× on every category.

export type Price = {
  input: number;
  output: number;
  /** Cache-read multiplier of `input`; 0.1 when unset. */
  cacheRead?: number;
  /** Rates for prompts over `aboveTokens` (counting cache reads and writes). */
  long?: { aboveTokens: number; input: number; output: number };
};

export const PRICES: Record<string, Price> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, long: { aboveTokens: 100_000, input: 0.5, output: 2.5 } },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.05 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-opus-5": { input: 5, output: 25 },
};

/** Exact id, else the longest listed id the model starts with (so a dated
 *  "claude-sonnet-5-5-…" id is Sonnet 5.5, not Sonnet 5). */
export function priceFor(model: string): Price {
  if (PRICES[model]) return PRICES[model];
  const base = Object.keys(PRICES)
    .filter((id) => model.startsWith(id))
    .sort((a, b) => b.length - a.length)[0];
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
  const prompt = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  const rate = p.long && prompt > p.long.aboveTokens ? p.long : p;
  const split = usage.cache_creation;
  const writeUnits = split
    ? (split.ephemeral_5m_input_tokens ?? 0) * 1.25 + (split.ephemeral_1h_input_tokens ?? 0) * 2
    : (usage.cache_creation_input_tokens ?? 0) * (opts.cacheTtl === "1h" ? 2 : 1.25);
  const usd =
    ((usage.input_tokens ?? 0) * rate.input +
      writeUnits * rate.input +
      (usage.cache_read_input_tokens ?? 0) * rate.input * (p.cacheRead ?? 0.1) +
      (usage.output_tokens ?? 0) * rate.output) /
    1_000_000;
  return Math.round((opts.batch ? usd / 2 : usd) * 1e6) / 1e6;
}
