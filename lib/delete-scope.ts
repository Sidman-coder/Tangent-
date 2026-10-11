// Which tasks a delete request is about. Pure (no store, no AI) so it is unit
// tested with plain Node; lib/voice-handler.ts runs it before any model call.
//
// Safety rules (docs/tangent-pipeline-final-checks.md, H):
//  - Clearing everything needs one of a few explicit phrases ("clear my whole
//    schedule", "delete everything", "delete all my tasks"). Nothing else ever
//    becomes a full clear, whatever the model returns.
//  - A scoped request ("all of the SAT tasks", "my SAT plan", "the ICF stuff")
//    matches plan titles first, then task titles. No match or an ambiguous one
//    means asking, never a wider delete.
//  - Every delete of existing tasks is confirmed first (bulkDeleteMessage).
//  - Pipeline V2 (B2): when no title has every word, the plan matcher
//    (lib/pipeline/match.ts) may still name ONE plan it is sure of ("my eye
//    see eff prep tasks" → ICF Prep). Never a second guess, never wider.

import { matchPlan } from "./pipeline/match";

/** Lowercase, apostrophes dropped, other punctuation to spaces, leading filler removed. */
function normalize(text: string): string {
  let s = text.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const FILLER = /^(?:ok|okay|so|um|uh|hey|hi|actually|tangent|please|can you|could you|would you|will you|i want to|i want you to|id like to|lets|go ahead and|just)\s+/;
  for (let prev = ""; prev !== s; ) {
    prev = s;
    s = s.replace(FILLER, "");
  }
  return s.replace(/\s+(?:please|for me|now|thanks|thank you)$/, "").trim();
}

const SCHEDULE = "(?:schedule|calendar|planner)";
const WHERE = `(?:\\s+(?:on|from|in|off)\\s+my\\s+${SCHEDULE})?`;
const FULL_CLEAR = [
  new RegExp(`^(?:clear|wipe|empty|reset)(?:\\s+out)?\\s+(?:my|the)\\s+(?:whole\\s+|entire\\s+)?${SCHEDULE}$`),
  new RegExp(`^(?:clear|delete|remove|erase|wipe)\\s+everything${WHERE}$`),
  new RegExp(`^(?:clear|delete|remove|erase)\\s+all\\s+(?:of\\s+)?my\\s+tasks${WHERE}$`),
  new RegExp(`^(?:clear|delete|remove|erase)\\s+every\\s+(?:single\\s+)?task${WHERE}$`),
];

/** True only for an explicit request to remove every task. The whole message
 *  must be the command, so "delete all my SAT tasks" is not one. */
export function isFullClearRequest(text: string): boolean {
  const s = normalize(text);
  return FULL_CLEAR.some((re) => re.test(s));
}

const VERB = "(?:delete|remove|take out|take off|get rid of|clear out|clear|cancel|drop|erase|wipe|scrap|ditch|trash)";
/** Nouns that make a request about a group of tasks. */
const GROUP_NOUN = "(?:tasks|stuff|things|items|events|sessions|assignments|plans?|ones)";
const STOP = new Set(["the", "my", "of", "all", "every", "each", "those", "these", "that", "this", "a", "an", "some", "any", "related", "for", "them"]);
const TRAILING_WHERE = new RegExp(`\\s+(?:on|from|in|off|out of)\\s+(?:my|the)\\s+${SCHEDULE}.*$`);

export type DeleteScope =
  /** A group named by these words, e.g. ["sat"]. */
  | { kind: "scoped"; words: string[]; phrase: string }
  /** "Delete all the tasks" and the like: everything-ish, but not an explicit full-clear phrase. */
  | { kind: "unclear" };

/**
 * A request to delete a group of tasks, or null when the text isn't one (a
 * single task like "delete chem lab" is left to the existing delete path).
 */
export function parseDeleteScope(text: string): DeleteScope | null {
  const s = normalize(text).replace(TRAILING_WHERE, "");
  const withNoun = new RegExp(`\\b${VERB}\\s+(all\\s+(?:of\\s+)?|every\\s+|each\\s+)?((?:[a-z0-9]+\\s+){0,6}?)${GROUP_NOUN}\\b`).exec(s);
  const allNoNoun = new RegExp(`\\b${VERB}\\s+(all\\s+(?:of\\s+)?|every\\s+)((?:[a-z0-9]+\\s*){1,6})$`).exec(s);
  const m = withNoun ?? allNoNoun;
  if (!m) return null;
  const words = m[2].split(/\s+/).filter((w) => w && !STOP.has(w));
  if (words.length === 0) return { kind: "unclear" };
  return { kind: "scoped", words, phrase: words.join(" ") };
}

/** "dentists" → "dentist", "sat's" (apostrophe already dropped) → "sat". */
function stem(w: string): string {
  return w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
}
const tokens = (title: string) => new Set(normalize(title).split(" ").filter(Boolean).map(stem));

type ScopeTask = { id: string; title: string; planId?: string | null };
export type ScopePlan = { id: string; title: string };

export type ScopeMatch<T extends ScopeTask> =
  | { kind: "match"; tasks: T[]; via: "plan" | "title"; label: string }
  | { kind: "none" }
  | { kind: "ambiguous"; options: ScopePlan[] };

/**
 * Plans whose title contains every scope word come first (all their tasks);
 * then tasks whose own title contains every word. Words match whole words, so
 * "SAT" never matches "Saturday shift".
 */
export function matchScope<T extends ScopeTask>(words: string[], tasks: readonly T[], plans: readonly ScopePlan[]): ScopeMatch<T> {
  const want = words.map(stem).filter(Boolean);
  if (want.length === 0) return { kind: "none" };
  const hasAll = (title: string) => {
    const have = tokens(title);
    return want.every((w) => have.has(w));
  };
  const matchedPlans = plans.filter((p) => hasAll(p.title));
  if (matchedPlans.length > 1) {
    const withTasks = matchedPlans.filter((p) => tasks.some((t) => t.planId === p.id));
    if (withTasks.length > 1) return { kind: "ambiguous", options: withTasks.map((p) => ({ id: p.id, title: p.title })) };
    if (withTasks.length === 1) matchedPlans.splice(0, matchedPlans.length, withTasks[0]);
  }
  if (matchedPlans.length === 1) {
    const plan = matchedPlans[0];
    const inPlan = tasks.filter((t) => t.planId === plan.id);
    if (inPlan.length > 0) return { kind: "match", tasks: inPlan, via: "plan", label: plan.title };
  }
  const byTitle = tasks.filter((t) => hasAll(t.title));
  if (byTitle.length > 0) return { kind: "match", tasks: byTitle, via: "title", label: words.join(" ") };
  // Nothing has every word: a plan the matcher is sure of (sound-alikes,
  // typos, spelled letters), with tasks in it.
  const fuzzy = matchPlan(words.join(" "), plans.filter((p) => tasks.some((t) => t.planId === p.id)));
  if (fuzzy.decision === "sure") {
    const plan = plans.find((p) => p.id === fuzzy.target.id);
    if (plan) return { kind: "match", tasks: tasks.filter((t) => t.planId === plan.id), via: "plan", label: plan.title };
  }
  return { kind: "none" };
}

/** Up to five titles, then "and N more". */
export function titleList(titles: readonly string[], max = 5): string {
  const shown = titles.slice(0, max).map((t) => `"${t}"`);
  const rest = titles.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(", ");
}

/** The confirmation text: the count and up to five titles, then the plans
 *  that go too because none of their tasks would be left. */
export function bulkDeleteMessage(titles: readonly string[], opts: { all?: boolean; label?: string; plans?: readonly string[] } = {}): string {
  const n = titles.length;
  const noun = `${n} task${n === 1 ? "" : "s"}`;
  const also = planRemovalNote(opts.plans ?? []);
  if (opts.all) return `Clear ALL ${noun} from your schedule? This removes everything: ${titleList(titles)}.${also}`;
  const from = opts.label ? ` matching "${opts.label}"` : "";
  return `Delete ${noun}${from}? ${titleList(titles)}.${also}`;
}

/** " This also removes the plan "SAT Prep"." or "" when no plan goes. */
export function planRemovalNote(planTitles: readonly string[]): string {
  if (planTitles.length === 0) return "";
  const noun = planTitles.length === 1 ? "the plan" : "the plans";
  return ` This also removes ${noun} ${titleList(planTitles)}.`;
}

/**
 * Plans this delete would leave with no tasks: every task linked to them is
 * in `deleting`. Those plans are removed too by default (the preview's "Also
 * remove the plan" box, or the confirmation text with the pipeline off).
 */
export function emptiedPlans<P extends ScopePlan>(deleting: readonly ScopeTask[], all: readonly ScopeTask[], plans: readonly P[]): P[] {
  const gone = new Set(deleting.map((t) => t.id));
  return plans.filter((p) => {
    const linked = all.filter((t) => t.planId === p.id);
    return linked.length > 0 && linked.every((t) => gone.has(t.id));
  });
}

export type BulkDeletePlan<T extends ScopeTask> =
  /** Ask for confirmation of exactly these tasks. */
  | { kind: "propose"; tasks: T[]; all: boolean; label?: string }
  /** Delete nothing; send this question back. `candidates` are the plans it
   *  could mean (the pending question's buttons, lib/pending-question.ts). */
  | { kind: "ask"; message: string; candidates?: ScopePlan[] }
  /** Nothing deleted yet, nothing to clear. */
  | { kind: "empty" };

/**
 * What a delete request should do, decided before any model call. Returns null
 * when the text isn't a delete of more than one task. It only ever proposes
 * (the caller asks for confirmation) or asks; a full clear needs an explicit
 * phrase (isFullClearRequest).
 */
export function planBulkDelete<T extends ScopeTask>(text: string, tasks: readonly T[], plans: readonly ScopePlan[]): BulkDeletePlan<T> | null {
  if (isFullClearRequest(text)) return tasks.length ? { kind: "propose", tasks: [...tasks], all: true } : { kind: "empty" };
  const scope = parseDeleteScope(text);
  if (!scope) return null;
  if (scope.kind === "unclear") return { kind: "ask", message: ASK_WHICH };
  const match = matchScope(scope.words, tasks, plans);
  if (match.kind === "none") {
    return { kind: "ask", message: `I couldn't find any tasks or plans matching "${scope.phrase}", so I didn't delete anything. Which tasks did you mean?` };
  }
  if (match.kind === "ambiguous") {
    return {
      kind: "ask",
      message: `"${scope.phrase}" matches more than one plan: ${titleList(match.options.map((p) => p.title))}. Which one should I delete?`,
      candidates: match.options,
    };
  }
  return { kind: "propose", tasks: match.tasks, all: false, label: match.label };
}

/** The reply when it isn't clear which tasks to delete. */
export const ASK_WHICH = `I didn't delete anything. Which tasks should I remove? Name them (like "my SAT tasks"), or say "clear my whole schedule" to remove everything.`;
