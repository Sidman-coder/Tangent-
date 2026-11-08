// "You, mapped" (Settings › What Tangent knows, Round 4 §5.4): the facts
// Tangent plans with, grouped into six areas, each fact labelled with where it
// came from. Pure and client-safe: no fact rules or prompts in here.

import type { ContextEntry } from "./types";

export type MapGroupKey = "goals" | "classes" | "commitments" | "work" | "hard" | "future";

export type MapGroup = {
  key: MapGroupKey;
  label: string;
  /** A --series-* key: the cluster's colour on the map and its card. */
  color: string;
  /** Shown when the group has nothing yet. */
  empty: string;
};

export const MAP_GROUPS: MapGroup[] = [
  { key: "goals", label: "Goals", color: "violet", empty: "What you're working toward." },
  { key: "classes", label: "Classes & activities", color: "blue", empty: "Your classes, clubs and teams." },
  { key: "commitments", label: "Commitments", color: "amber", empty: "The fixed parts of your week." },
  { key: "work", label: "How you work", color: "teal", empty: "When and how you get things done." },
  { key: "hard", label: "What's hard", color: "rose", empty: "What tends to get in the way." },
  { key: "future", label: "Future", color: "green", empty: "Where you want to end up." },
];

/** Which area a fact sits in. Identity and push style read as how you work. */
export function groupOf(entry: Pick<ContextEntry, "factCategory" | "category">): MapGroupKey {
  switch (entry.factCategory) {
    case "goals":
      return "goals";
    case "classes_activities":
      return "classes";
    case "schedule":
      return "commitments";
    case "whats_hard":
      return "hard";
    case "future":
      return "future";
    case "how_you_work":
    case "push_style":
    case "identity":
      return "work";
  }
  // Rows written before the student model have only the older category.
  if (entry.category === "goal") return "goals";
  if (entry.category === "commitment") return "commitments";
  if (entry.category === "work") return "classes";
  return "work";
}

export type FactOrigin = "said" | "noticed" | "guess";

export const ORIGIN_LABEL: Record<FactOrigin, string> = {
  said: "You said",
  noticed: "Tangent noticed",
  guess: "Guess, confirm?",
};

/** Where a fact came from, as the student reads it. A guess stays a guess
 *  until they confirm it. */
export function originOf(entry: Pick<ContextEntry, "factSource" | "unconfirmed">): FactOrigin {
  if (entry.unconfirmed || entry.factSource === "guessed") return "guess";
  if (entry.factSource === "seen") return "noticed";
  return "said";
}

export type GroupedFacts = { group: MapGroup; facts: ContextEntry[] }[];

/** Every area in a fixed order, empty ones included (the map shows them dim). */
export function groupFacts(entries: ContextEntry[]): GroupedFacts {
  return MAP_GROUPS.map((group) => ({ group, facts: entries.filter((e) => groupOf(e) === group.key) }));
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** One sentence over the whole map: how much Tangent knows and where most of
 *  it is. "Tangent knows 9 things about you, mostly your goals and how you work." */
export function mapSummary(grouped: GroupedFacts): string {
  const total = grouped.reduce((n, g) => n + g.facts.length, 0);
  if (total === 0) return "Tangent doesn't know anything about you yet. Answer a question or add a fact, and it starts here.";
  const top = grouped
    .filter((g) => g.facts.length > 0)
    .sort((a, b) => b.facts.length - a.facts.length)
    .slice(0, 2)
    .map((g) => (g.group.key === "hard" ? "what's hard" : g.group.key === "goals" ? "your goals" : lower(g.group.label)));
  const things = total === 1 ? "1 thing" : `${total} things`;
  const guesses = grouped.reduce((n, g) => n + g.facts.filter((f) => originOf(f) === "guess").length, 0);
  const tail = guesses > 0 ? ` ${guesses === 1 ? "One is a guess" : `${guesses} are guesses`} for you to confirm.` : "";
  return `Tangent knows ${things} about you, mostly ${top.join(" and ")}.${tail}`;
}

/** Initials for the centre of the map: "Juan Ruiz" → "JR", "" → "You". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "You";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
