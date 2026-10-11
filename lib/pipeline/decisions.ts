// Pipeline V2 (B9): the decision record, one ai_decisions row per intake
// request (flag on). It says what Tangent understood (route, intent,
// confidence, how), which plan it matched, what it asked, and how it ended.
// The outcome moves only along OUTCOME_TRANSITIONS: confirm, discard, undo and
// an answer to its question update it (app/api/changesets/*, app/api/undo,
// app/api/chat). Pure, unit tested in decisions.test.ts; the store writes it
// with the service role (students can read and delete their rows, not write).

export const OUTCOMES = ["answered", "drafted", "confirmed", "discarded", "undone", "applied_instantly", "asked", "failed"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** Where each outcome can go next. Terminal outcomes go nowhere. */
export const OUTCOME_TRANSITIONS: Readonly<Record<Outcome, readonly Outcome[]>> = {
  // Waiting on the student's tap or reply: any result of acting on it, or
  // asked again once.
  asked: ["asked", "answered", "drafted", "applied_instantly", "discarded", "failed"],
  drafted: ["confirmed", "discarded", "failed"],
  confirmed: ["undone"],
  applied_instantly: ["undone"],
  answered: [],
  discarded: [],
  undone: [],
  failed: [],
};

export function isOutcome(v: unknown): v is Outcome {
  return typeof v === "string" && (OUTCOMES as readonly string[]).includes(v);
}

export function canTransition(from: Outcome, to: Outcome): boolean {
  return OUTCOME_TRANSITIONS[from].includes(to);
}

/** Request text is kept short: at most this many characters. */
export const MAX_REQUEST_TEXT = 500;
/** Rows older than this are deleted: purge_old_ai_decisions() (migration
 *  20261012000000), run daily from /api/cron/proactive. */
export const RETENTION_DAYS = 90;

export type DecisionInput = {
  source: "typed" | "voice";
  requestText: string;
  route: string;
  intent: string | null;
  confidence: number | null;
  via: string;
  planMatch?: { decision: string; candidates: { id: string; score: number }[] } | null;
  chosenPlanId?: string | null;
  pendingQuestion?: { action: string; kind: string; candidates: number } | null;
  changeSetId?: string | null;
  actionId?: string | null;
  models?: string[];
  outcome: Outcome;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idOrNull = (v: string | null | undefined) => (v && UUID_RE.test(v) ? v : null);
const token = (s: string, max = 40) => s.replace(/[^a-z0-9_:.-]/gi, "").slice(0, max);

/** The row's columns (minus id, user_id and timestamps). Plan match holds
 *  ids and scores only, never titles; the pending question holds its shape. */
export function decisionColumns(d: DecisionInput) {
  const confidence = d.confidence === null || !Number.isFinite(d.confidence) ? null : Math.min(1, Math.max(0, Math.round(d.confidence * 100) / 100));
  return {
    source: d.source,
    request_text: d.requestText.slice(0, MAX_REQUEST_TEXT),
    route: token(d.route),
    intent: d.intent ? token(d.intent) : null,
    confidence,
    via: token(d.via),
    plan_match: d.planMatch
      ? {
          decision: token(d.planMatch.decision),
          candidates: d.planMatch.candidates.slice(0, 4).flatMap((c) => (idOrNull(c.id) ? [{ id: c.id, score: Math.round(c.score * 1000) / 1000 }] : [])),
        }
      : null,
    chosen_plan_id: idOrNull(d.chosenPlanId),
    pending_question: d.pendingQuestion
      ? { action: token(d.pendingQuestion.action), kind: token(d.pendingQuestion.kind), candidates: Math.max(0, Math.min(8, d.pendingQuestion.candidates)) }
      : null,
    change_set_id: idOrNull(d.changeSetId),
    action_id: idOrNull(d.actionId),
    models: (d.models ?? []).map((m) => token(m, 64)).filter(Boolean).slice(0, 4),
    outcome: d.outcome,
  };
}

/**
 * How a chat reply ended, for its decision row: a preview card is drafted, a
 * question is asked, a change made at once (it has an Undo entry) is
 * applied_instantly, a talked-through reply is answered, an error is failed.
 */
export function outcomeForReply(reply: { ok?: unknown; action?: unknown; actionId?: unknown; changeSet?: unknown }): Outcome {
  const action = typeof reply.action === "string" ? reply.action : "";
  if (reply.ok === false || action === "error") return "failed";
  if (action === "preview" && reply.changeSet) return "drafted";
  if (action === "clarify" || action === "confirm_required") return "asked";
  if (action === "cancelled") return "discarded";
  if (typeof reply.actionId === "string" && reply.actionId) return "applied_instantly";
  return "answered";
}
