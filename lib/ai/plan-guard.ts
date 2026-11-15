// Round 5A 2.4: the plan quality guard. Pure: every step the brief call
// proposes is checked before it's placed. A step fails when its reason is
// boilerplate ("stay consistent"), its title is only generic words
// ("Practice problems"), or its reason points at something Tangent doesn't
// actually know (a fact id that isn't there, a date that isn't in the week, a
// topic word that isn't in the student's request). The caller rewrites a
// failing step once and drops it if it still fails (lib/ai/plan-brief-call.ts).
//
// The word lists live in config/plan-guard.json, loaded by
// lib/ai/plan-guard-config.ts; this file takes the config as an argument so it
// stays testable under plain `node --test`.

export type GuardConfig = {
  bannedPhrases: string[];
  genericTitleWords: string[];
  minWhyLength: number;
};

export type WhyRef = { kind: "calendar" | "fact" | "topic"; ref: string };

export type GuardStep = {
  what: string;
  why: string;
  why_ref?: WhyRef | null;
};

export type GuardContext = {
  /** Ids of the facts the brief call was given. */
  factIds: readonly string[];
  /** ISO dates (YYYY-MM-DD) in the planning window. */
  dates: readonly string[];
  /** The student's request plus the plan's goal line. */
  topicText: string;
};

export type GuardReason = "banned_phrase" | "generic_title" | "short_why" | "no_ref" | "unknown_fact" | "unknown_date" | "off_topic";

export type GuardResult = { ok: true } | { ok: false; reason: GuardReason; detail: string };

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .split(/[^a-z0-9'+#]+/)
    .filter(Boolean);

const normalize = (s: string): string => ` ${words(s).join(" ")} `;

/** The first banned phrase in `text`, matched as whole words. */
export function bannedPhraseIn(text: string, cfg: GuardConfig): string | null {
  const hay = normalize(text);
  for (const p of cfg.bannedPhrases) {
    if (hay.includes(normalize(p))) return p;
  }
  return null;
}

/** True when every word of the title is a generic one ("Practice problems"). */
export function isGenericTitle(title: string, cfg: GuardConfig): boolean {
  const w = words(title);
  if (w.length === 0) return true;
  const generic = new Set(cfg.genericTitleWords);
  return w.every((x) => generic.has(x));
}

const STOP = new Set(["the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "my", "me", "i", "it", "is", "at", "with", "get", "better", "help", "want", "need", "this", "that", "your", "you"]);

/** Content words of a text: no stop words, no one-letter words, simple plural folded. */
export function topicWords(text: string): string[] {
  const out = new Set<string>();
  for (const w of words(text)) {
    if (w.length < 2 || STOP.has(w)) continue;
    out.add(w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w);
  }
  return Array.from(out);
}

export function checkStep(step: GuardStep, ctx: GuardContext, cfg: GuardConfig): GuardResult {
  if (isGenericTitle(step.what, cfg)) return { ok: false, reason: "generic_title", detail: step.what };
  const banned = bannedPhraseIn(step.why, cfg) ?? bannedPhraseIn(step.what, cfg);
  if (banned) return { ok: false, reason: "banned_phrase", detail: banned };
  if (step.why.trim().length < cfg.minWhyLength) return { ok: false, reason: "short_why", detail: step.why };
  // Every reason must point at something real: a day, a fact or the topic.
  const ref = step.why_ref;
  if (!ref) return { ok: false, reason: "no_ref", detail: step.why };
  {
    if (ref.kind === "fact" && !ctx.factIds.includes(ref.ref)) return { ok: false, reason: "unknown_fact", detail: ref.ref };
    if (ref.kind === "calendar" && !ctx.dates.includes(ref.ref)) return { ok: false, reason: "unknown_date", detail: ref.ref };
    if (ref.kind === "topic") {
      const topic = new Set(topicWords(ctx.topicText));
      if (!topicWords(ref.ref).some((w) => topic.has(w))) return { ok: false, reason: "off_topic", detail: ref.ref };
    }
  }
  return { ok: true };
}

/** A short plain sentence for the brief when a step was dropped. */
export function dropNote(count: number): string {
  if (count <= 0) return "";
  return count === 1
    ? "I left out one step that was too vague to be useful."
    : `I left out ${count} steps that were too vague to be useful.`;
}
