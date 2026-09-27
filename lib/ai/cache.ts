import type Anthropic from "@anthropic-ai/sdk";
import { minCacheableTokens } from "@/lib/ai/models";

// Prompt caching. Every prompt is laid out in cache order:
//
//   tools → playbook (same for every student) → student context → date + request
//
// The API caches a prefix up to each cache_control breakpoint, so anything
// that changes more often than the layer before it has to come after it. The
// local date and time change every minute, so they always go last, uncached.
//
// TTLs (cache writes cost 1.25× input for 5 minutes, 2× for 1 hour; reads 0.1×):
// - Playbook: 1 hour. It's identical for every student, so one write serves
//   all of them. Paying 0.75× extra for the hour is covered the first time a
//   request lands more than 5 minutes after the previous one: that request
//   reads at 0.1× instead of re-writing at 1.25× (saving 1.15×).
// - Student context: 5 minutes. It's one student's calendars and memory, read
//   again only within a burst of commands or the turns of one tool loop. The
//   extra 0.75× for an hour pays only if they come back 5–60 minutes later
//   with the context unchanged, which is the exception.
// - Conversation history: 5 minutes, for the same reason.
//
// A breakpoint on a prefix shorter than the model's minimum (Haiku 4096,
// Sonnet 1024 tokens) caches nothing; enforceCacheRules drops those so the
// request says what actually happens.

export type CacheTtl = "5m" | "1h";

const ephemeral = (ttl: CacheTtl): Anthropic.CacheControlEphemeral => ({ type: "ephemeral", ttl });

/** System blocks in cache order. `volatile` (date/time) is never cached. */
export function layeredSystem(parts: { playbook: string; context?: string; volatile?: string }): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = [{ type: "text", text: parts.playbook, cache_control: ephemeral("1h") }];
  if (parts.context?.trim()) blocks.push({ type: "text", text: parts.context, cache_control: ephemeral("5m") });
  if (parts.volatile?.trim()) blocks.push({ type: "text", text: parts.volatile });
  return blocks;
}

function withBreakpoint(message: Anthropic.MessageParam): Anthropic.MessageParam {
  const blocks = typeof message.content === "string"
    ? [{ type: "text" as const, text: message.content }]
    : message.content.slice();
  if (blocks.length === 0) return message;
  const last = blocks.length - 1;
  blocks[last] = { ...blocks[last], cache_control: ephemeral("5m") } as Anthropic.ContentBlockParam;
  return { ...message, content: blocks };
}

/** Marks the end of the settled conversation (everything before the newest
 *  user turn), so the next turn reads it back. Copies; never mutates. */
export function cacheHistory(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  if (messages.length < 2) return messages;
  const out = messages.slice();
  out[out.length - 2] = withBreakpoint(out[out.length - 2]);
  return out;
}

/** Marks the newest message, for tool loops whose next turn re-sends it all. */
export function cacheLastMessage(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  if (messages.length === 0) return messages;
  const out = messages.slice();
  out[out.length - 1] = withBreakpoint(out[out.length - 1]);
  return out;
}

/** Appends the date/time to the newest user message: last in the prompt, so it
 *  never invalidates a cached prefix. */
export function withDateLast(messages: Anthropic.MessageParam[], dateContext: string): Anthropic.MessageParam[] {
  const i = messages.length - 1;
  if (i < 0 || messages[i].role !== "user") return messages;
  const m = messages[i];
  const blocks = typeof m.content === "string" ? [{ type: "text" as const, text: m.content }] : m.content.slice();
  const out = messages.slice();
  out[i] = { ...m, content: [...blocks, { type: "text", text: dateContext }] };
  return out;
}

/** Rough token count: ~3.5 characters per token for this app's English
 *  prompts and JSON (calibrated against reported usage in the A5 tests). */
export function estimateTokens(value: unknown): number {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return Math.ceil(text.length / 3.5);
}

type Cacheable = { cache_control?: Anthropic.CacheControlEphemeral | null };
type Body = {
  tools?: unknown[];
  system?: string | Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
};

/** Walks the prompt in cache order and, in place: drops breakpoints whose
 *  prefix is under the model's minimum, keeps at most 4 (the API limit, latest
 *  kept since they cover the most), and downgrades a 1h breakpoint that follows
 *  a 5m one (the API requires longer TTLs first). Returns what it kept. */
export function enforceCacheRules(body: Body, model: string): { kept: number; dropped: number; prefixTokens: number[] } {
  const min = minCacheableTokens(model);
  const marked: { block: Cacheable; prefix: number }[] = [];
  let tokens = 0;
  const visit = (block: unknown) => {
    tokens += estimateTokens(block);
    const b = block as Cacheable;
    if (b && typeof b === "object" && b.cache_control) marked.push({ block: b, prefix: tokens });
  };
  for (const tool of body.tools ?? []) visit(tool);
  if (Array.isArray(body.system)) body.system.forEach(visit);
  else if (body.system) tokens += estimateTokens(body.system);
  for (const m of body.messages) {
    if (typeof m.content === "string") tokens += estimateTokens(m.content);
    else m.content.forEach(visit);
  }

  let dropped = 0;
  const eligible = marked.filter((m) => {
    if (m.prefix >= min) return true;
    delete m.block.cache_control;
    dropped++;
    return false;
  });
  while (eligible.length > 4) {
    delete eligible.shift()!.block.cache_control;
    dropped++;
  }
  let seen5m = false;
  for (const m of eligible) {
    if (m.block.cache_control?.ttl === "1h" && seen5m) m.block.cache_control = ephemeral("5m");
    if (m.block.cache_control?.ttl !== "1h") seen5m = true;
  }
  return { kept: eligible.length, dropped, prefixTokens: eligible.map((m) => m.prefix) };
}
