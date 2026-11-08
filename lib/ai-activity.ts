// Settings › AI Activity (Pipeline V2, step 3B): what Tangent DID with each
// request, in plain words. Its sibling, "What Tangent knows", shows what it
// KNOWS. One ai_decisions row (lib/pipeline/decisions.ts) is one table row.
//
// Pure, so the server (lib/pipeline/activity.ts) and the Settings section
// (components/settings/AiActivity.tsx) share the same words. Unit tested in
// ai-activity.test.ts.

export const ACTIVITY_PAGE_SIZE = 25;
export const ACTIVITY_DAYS = [7, 30, 90] as const;
export type ActivityDays = (typeof ACTIVITY_DAYS)[number];
export const CLEAR_CONFIRM_TEXT = "This clears the log. Your calendar stays the same.";
export const ACTIVITY_EMPTY_TEXT = "Nothing yet. When you ask Tangent AI to plan or change things, you'll see what it did here.";

// ─── What Tangent understood ────────────────────────────────────────────────

export const TYPE_LABELS = {
  new_plan: "New plan",
  new_project: "New project",
  add_to_plan: "Add to a plan",
  single_task: "Single task",
  change: "Change tasks",
  remove: "Remove tasks",
  question: "Question",
  quick_capture: "Quick capture (no AI)",
  asked: "Asked you to choose",
  tangent: "Sent to Tangents",
} as const;
export type ActivityType = keyof typeof TYPE_LABELS;
export const ACTIVITY_TYPES = Object.keys(TYPE_LABELS) as ActivityType[];

type DecisionShape = { route: string; intent: string | null; via: string };

/** The request in plain words, from the router's route, intent and how it was decided. */
export function understoodAs(d: DecisionShape): ActivityType {
  if (d.via === "fast" || d.route === "fast") return "quick_capture";
  if (d.route === "clarify" || d.intent === "clarify") return "asked";
  if (d.route === "tangent" || d.intent === "tangent") return "tangent";
  if (d.route === "chat" || d.intent === "question") return "question";
  switch (d.intent) {
    case "new_plan":
      return "new_plan";
    case "new_project":
      return "new_project";
    case "add_to_plan":
      return "add_to_plan";
    case "add_task":
      return "single_task";
    case "delete_task":
    case "delete_plan_tasks":
      return "remove";
    case "change_plan":
    case "change_task":
    case "complete_task":
      return "change";
    default:
      return "question";
  }
}

// ─── Result ─────────────────────────────────────────────────────────────────

export const RESULT_LABELS = {
  answered: "Answered",
  waiting: "Waiting for you",
  added: "Added",
  removed: "Removed",
  discarded: "Discarded",
  undone: "Undone",
  instant: "Added instantly",
  failed: "Failed",
} as const;
export type ActivityResult = keyof typeof RESULT_LABELS;
export const ACTIVITY_RESULTS = Object.keys(RESULT_LABELS) as ActivityResult[];

/** The result chip, from the decision's outcome. A confirmed removal reads
 *  "Removed", not "Added". */
export function resultOf(d: DecisionShape & { outcome: string }): ActivityResult {
  const removes = understoodAs(d) === "remove";
  switch (d.outcome) {
    case "answered":
      return "answered";
    case "asked":
    case "drafted":
      return "waiting";
    case "confirmed":
      return removes ? "removed" : "added";
    case "applied_instantly":
      return removes ? "removed" : "instant";
    case "discarded":
      return "discarded";
    case "undone":
      return "undone";
    default:
      return "failed";
  }
}

// ─── Confidence and match strength ──────────────────────────────────────────

export type ConfidenceLevel = "high" | "mid" | "low";

/** The confidence dot: high from 0.85, mid from 0.6, low below. */
export function confidenceLevel(c: number | null | undefined): ConfidenceLevel | null {
  if (c === null || c === undefined || !Number.isFinite(c)) return null;
  return c >= 0.85 ? "high" : c >= 0.6 ? "mid" : "low";
}

export type MatchStrength = "strong" | "possible" | "weak";

/** The plan matcher's bands (lib/pipeline/match.ts): sure from 0.88, unsure from 0.6. */
export function matchStrength(score: number): MatchStrength {
  return score >= 0.88 ? "strong" : score >= 0.6 ? "possible" : "weak";
}

/** Who made the call, in plain words. */
export function whoDecided(via: string): string {
  switch (via) {
    case "router":
      return "Tangent AI";
    case "rules":
      return "Tangent's built-in rules";
    case "fast":
      return "Quick capture rules (no AI)";
    case "answer":
      return "You, by answering";
    default:
      return "Tangent";
  }
}

/** The question Tangent asked, from its stored shape (no titles are stored). */
export function questionText(q: { kind?: unknown; candidates?: unknown } | null | undefined): string | null {
  if (!q) return null;
  const n = typeof q.candidates === "number" ? q.candidates : 0;
  const choices = n > 0 ? ` (${n} choices)` : "";
  if (q.kind === "match") return `Which plan do you mean?${choices}`;
  if (q.kind === "intent") return `What did you mean?${choices}`;
  return `A quick question before going on${choices}`;
}

/** How the question ended, from the outcome and the plan that was chosen. */
export function answerText(outcome: string, chosenPlan: string | null): string {
  if (outcome === "asked") return "Not answered yet.";
  if (outcome === "discarded") return "You moved on or cancelled, so nothing changed.";
  if (outcome === "failed") return "Something went wrong after your answer. Nothing was changed.";
  if (chosenPlan) return `You picked ${chosenPlan}.`;
  return "You answered, and Tangent went on.";
}

// ─── Query and filters ──────────────────────────────────────────────────────

export type ActivityQuery = {
  page: number;
  result: ActivityResult | null;
  type: ActivityType | null;
  days: ActivityDays;
  q: string;
  /** Open this row: "id:<decision>", "cs:<change set>" or "action:<undo entry>". */
  focus: { by: "id" | "cs" | "action"; id: string } | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isActivityId = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/** Reads ?page=&result=&type=&days=&q=&focus= leniently: anything unknown falls back. */
export function parseActivityQuery(params: URLSearchParams): ActivityQuery {
  const page = Math.max(1, Math.min(1000, Math.floor(Number(params.get("page")) || 1)));
  const result = params.get("result");
  const type = params.get("type");
  const days = Number(params.get("days"));
  const [by, id] = (params.get("focus") ?? "").split(":");
  return {
    page,
    result: (ACTIVITY_RESULTS as string[]).includes(result ?? "") ? (result as ActivityResult) : null,
    type: (ACTIVITY_TYPES as string[]).includes(type ?? "") ? (type as ActivityType) : null,
    days: (ACTIVITY_DAYS as readonly number[]).includes(days) ? (days as ActivityDays) : 30,
    q: (params.get("q") ?? "").trim().slice(0, 100),
    focus: (by === "id" || by === "cs" || by === "action") && isActivityId(id) ? { by, id } : null,
  };
}

/** A search term safe inside an ILIKE pattern: % _ and \ match themselves. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function filterActivity<T extends DecisionShape & { outcome: string }>(
  rows: T[],
  f: { result: ActivityResult | null; type: ActivityType | null }
): T[] {
  return rows.filter((r) => (!f.result || resultOf(r) === f.result) && (!f.type || understoodAs(r) === f.type));
}

export function paginate<T>(rows: T[], page: number, size = ACTIVITY_PAGE_SIZE): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { items: rows.slice((p - 1) * size, p * size), page: p, pages };
}

// ─── Owner-only usage ───────────────────────────────────────────────────────

export type UsageLine = { createdAt: string; model: string; inputTokens: number; outputTokens: number; costUsd: number };
export type UsageTotals = { models: string[]; inputTokens: number; outputTokens: number; costUsd: number };

/** ai_usage rows carry no request id, so each one goes to the first decision
 *  written at or just after it: decision rows are recorded once the reply is
 *  known, so a request's AI calls come before its row (up to `beforeMs`), or
 *  just after when it asks a question first (`afterMs`). An estimate. */
export function attachUsage(
  decisions: { id: string; createdAt: string }[],
  usage: UsageLine[],
  beforeMs = 180_000,
  afterMs = 5_000
): Map<string, UsageTotals> {
  const sorted = [...decisions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const out = new Map<string, UsageTotals>();
  for (const u of usage) {
    const t = Date.parse(u.createdAt);
    const d = sorted.find((x) => {
      const at = Date.parse(x.createdAt);
      return t <= at + afterMs && t >= at - beforeMs;
    });
    if (!d) continue;
    const tot = out.get(d.id) ?? { models: [], inputTokens: 0, outputTokens: 0, costUsd: 0 };
    if (!tot.models.includes(u.model)) tot.models.push(u.model);
    tot.inputTokens += u.inputTokens;
    tot.outputTokens += u.outputTokens;
    tot.costUsd += u.costUsd;
    out.set(d.id, tot);
  }
  return out;
}

export function formatCost(usd: number): string {
  if (usd <= 0) return "$0";
  return usd < 0.01 ? `<$0.01` : `$${usd.toFixed(2)}`;
}

// ─── Rows as the API sends them ─────────────────────────────────────────────

export type ActivityRow = {
  id: string;
  createdAt: string;
  source: "typed" | "voice";
  request: string;
  type: ActivityType;
  confidence: number | null;
  plan: string | null;
  changes: number;
  result: ActivityResult;
  why: {
    intent: string | null;
    whoDecided: string;
    candidates: { title: string; score: number; strength: MatchStrength }[];
    chosen: string | null;
    chosenHow: string | null;
    question: string | null;
    answer: string | null;
    assumptions: string[];
    changes: string[];
    skippedDuplicates: number;
    /** Undo entry still undoable. */
    undo: { actionId: string; label: string } | null;
    /** A draft still waiting for Confirm on the AI page. */
    draftOpen: boolean;
  };
  /** Owner only (isOwnerEmail). */
  usage?: UsageTotals;
};

export type ActivityResponse = { ok: true; rows: ActivityRow[]; page: number; pages: number; total: number; owner: boolean; focusId: string | null };
