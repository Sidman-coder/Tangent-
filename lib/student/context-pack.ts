// Layer 5 of the context engine (docs/tangent/CONTEXT-ENGINE.md): choosing
// what the AI sees about the student. Pure, so it is tested without a
// database; lib/ai/student-context.ts reads the data and calls these.
//
// Facts are ranked by relevance to what the call is for (0.5), how sure
// Tangent is (0.3) and how recent (0.2). The top 10–15 go in. The pack is
// then fitted to a token budget, dropping the least important sections first,
// so a student with a long history never crowds out today's calendar.

import type { FactCategory, FactSource } from "./facts";

export const CONTEXT_PURPOSES = ["plan", "extend", "chat", "path", "grill", "brief", "voice"] as const;
export type ContextPurpose = (typeof CONTEXT_PURPOSES)[number];

export type RankableFact = {
  id: string;
  text: string;
  factCategory?: FactCategory;
  factSource?: FactSource;
  confidence?: number;
  /** ISO; the newer of when it was said and last confirmed. */
  timestamp: string;
  lastConfirmedAt?: string | null;
  projectId?: string | null;
  unconfirmed?: boolean;
};

export type RankedFact = RankableFact & { score: number };

export const MIN_FACTS = 10;
export const MAX_FACTS = 15;

/** Which kinds of fact matter most for each kind of call (0–1). */
const CATEGORY_WEIGHT: Record<ContextPurpose, Partial<Record<FactCategory, number>>> = {
  plan: { goals: 1, schedule: 1, how_you_work: 1, whats_hard: 0.9, push_style: 0.7, classes_activities: 0.8, future: 0.5, identity: 0.4 },
  extend: { how_you_work: 1, whats_hard: 1, schedule: 0.9, goals: 0.8, push_style: 0.7, classes_activities: 0.6, future: 0.4, identity: 0.3 },
  chat: { goals: 0.8, push_style: 1, whats_hard: 0.9, how_you_work: 0.8, identity: 0.7, schedule: 0.6, classes_activities: 0.6, future: 0.6 },
  path: { future: 1, goals: 1, classes_activities: 0.9, identity: 0.7, whats_hard: 0.6, how_you_work: 0.5, schedule: 0.4, push_style: 0.4 },
  grill: { goals: 1, schedule: 0.9, how_you_work: 0.9, classes_activities: 0.8, whats_hard: 0.7, future: 0.6, push_style: 0.5, identity: 0.5 },
  brief: { schedule: 1, push_style: 1, how_you_work: 0.9, goals: 0.8, whats_hard: 0.8, classes_activities: 0.6, future: 0.4, identity: 0.4 },
  voice: { schedule: 1, how_you_work: 0.9, goals: 0.8, push_style: 0.8, whats_hard: 0.7, classes_activities: 0.7, future: 0.4, identity: 0.4 },
};

const STOP = new Set(
  "a an and are as at be but by can do for from get had has have i if in into is it its my of on or so that the their them they this to up was we what when with you your".split(" "),
);

export function words(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (w.length < 3 || STOP.has(w)) continue;
    out.add(w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w);
  }
  return out;
}

/** 0–1: how much this fact matters for this call. */
export function relevance(fact: RankableFact, purpose: ContextPurpose, query: Set<string>, projectId: string | null): number {
  // Facts about another project rarely help; facts about this one always do.
  if (fact.projectId && projectId && fact.projectId === projectId) return 1;
  const category = fact.factCategory ? CATEGORY_WEIGHT[purpose][fact.factCategory] ?? 0.5 : 0.5;
  let overlap = 0;
  if (query.size) {
    const fw = words(fact.text);
    let hits = 0;
    fw.forEach((w) => {
      if (query.has(w)) hits++;
    });
    overlap = Math.min(1, hits / 2);
  }
  const base = query.size ? 0.55 * category + 0.45 * overlap : category;
  return fact.projectId && fact.projectId !== projectId ? base * 0.5 : base;
}

/** 0–1, halving about every two months. */
export function recency(fact: RankableFact, now: Date): number {
  const t = Math.max(Date.parse(fact.timestamp) || 0, fact.lastConfirmedAt ? Date.parse(fact.lastConfirmedAt) || 0 : 0);
  if (!t) return 0.3;
  const days = Math.max(0, (now.getTime() - t) / 86_400_000);
  return Math.pow(0.5, days / 60);
}

function confidenceOf(f: RankableFact): number {
  if (typeof f.confidence === "number" && Number.isFinite(f.confidence)) return Math.max(0, Math.min(1, f.confidence));
  if (f.unconfirmed || f.factSource === "guessed") return 0.4;
  return f.factSource === "seen" ? 0.7 : 0.8;
}

/**
 * The facts to show the AI, best first: at most MAX_FACTS, and at least
 * MIN_FACTS when the student has that many. A fact that scores very low is
 * left out once the minimum is met.
 */
export function rankFacts(
  facts: RankableFact[],
  opts: { purpose: ContextPurpose; query?: string; projectId?: string | null; now?: Date; limit?: number },
): RankedFact[] {
  const now = opts.now ?? new Date();
  const query = words(opts.query ?? "");
  const projectId = opts.projectId ?? null;
  const limit = Math.max(1, Math.min(MAX_FACTS, opts.limit ?? MAX_FACTS));
  const seen = new Set<string>();
  const scored = facts
    .filter((f) => f.text.trim())
    .filter((f) => {
      const key = f.text.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((f) => ({ ...f, score: 0.5 * relevance(f, opts.purpose, query, projectId) + 0.3 * confidenceOf(f) + 0.2 * recency(f, now) }))
    .sort((a, b) => b.score - a.score || b.timestamp.localeCompare(a.timestamp));
  const out: RankedFact[] = [];
  for (const f of scored) {
    if (out.length >= limit) break;
    if (out.length >= MIN_FACTS && f.score < 0.35) break;
    out.push(f);
  }
  return out;
}

/** One prompt line per fact; guesses are never stated as true. */
export function factLine(f: RankableFact): string {
  const guess = f.unconfirmed || f.factSource === "guessed";
  return `- ${f.text.trim()}${guess ? " (Tangent's guess, not confirmed: don't rely on it)" : ""}`;
}

/** Rough tokens: about four characters each. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export type PackSection = {
  key: string;
  text: string;
  /** Higher stays longer. Sections at or above KEEP are never dropped. */
  priority: number;
};

export const KEEP = 100;

/** Default budget for the student picture, in tokens. */
export const DEFAULT_BUDGET = 2500;

/**
 * Keeps sections in their order and drops the lowest-priority ones until the
 * whole fits the budget. Sections marked KEEP are cut short instead of dropped.
 */
export function fitBudget(sections: PackSection[], budget: number = DEFAULT_BUDGET): { text: string; tokens: number; dropped: string[] } {
  const live = sections.filter((s) => s.text.trim());
  const join = (list: PackSection[]) => list.map((s) => s.text.trim()).join("\n\n");
  const dropped: string[] = [];
  let kept = live.slice();
  const byPriority = live.filter((s) => s.priority < KEEP).sort((a, b) => a.priority - b.priority);
  for (const s of byPriority) {
    if (estimateTokens(join(kept)) <= budget) break;
    kept = kept.filter((k) => k !== s);
    dropped.push(s.key);
  }
  let text = join(kept);
  if (estimateTokens(text) > budget) {
    const chars = budget * 4;
    text = `${text.slice(0, Math.max(0, chars - 2)).replace(/\s+\S*$/, "")}\n…`;
  }
  return { text, tokens: estimateTokens(text), dropped };
}
