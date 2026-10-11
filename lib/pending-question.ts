// A question Tangent asked and is waiting on: "Which one should I delete?"
// with the tasks or plans it could mean. Pure (no store, no AI), so it is unit
// tested with plain Node (pending-question.test.ts). Pipeline flag on AND off.
//
// It rides on Juann's question card (components/console/ClarifyCard.tsx): the
// reply carries `questions` (one question, a button per candidate plus "All of
// these") and `pendingQuestion`; the client keeps it on the turn and sends it
// back with the next message, typed or tapped (app/api/chat). The answer is
// resolved here before routing, so it never becomes a plan or hits an
// unrelated fast path.
//
// Pipeline V2 (B1, B2, flag on only) adds "route" questions, answered in
// lib/pipeline/understand.ts: "What did you mean?" (kind "intent": Make a
// plan / Just add one task / Just talking) and "Which plan?" (kind "match":
// the close plans plus "New plan").

import { matchPlan } from "./pipeline/match";

export type Candidate = { id: string; title: string };

export type PendingQuestion = {
  /** What the answer completes: a delete (A1), or where a request goes
   *  (Pipeline V2: its intent, or which plan it adds to). */
  action: "delete" | "route";
  /** What the candidate ids are. Deletes: tasks or plans (a plan means its
   *  tasks); "scope" has no candidates: "Which tasks should I remove?"
   *  Route: "intent" (ids INTENT_CHOICE_IDS) or "match" (plan ids and
   *  NEW_PLAN_ID). */
  kind: "task" | "plan" | "scope" | "intent" | "match";
  candidates: Candidate[];
  /** Route "match": the student's words for the plan, saved as its nickname
   *  once they pick one (plan_aliases). */
  mention?: string;
  /** Route: the ai_decisions row this question belongs to. */
  decisionId?: string;
  /** The request that asked, for the log and the preview's request text. */
  request: string;
  /** ISO time; an answer after this is routed as a new request. */
  expiresAt: string;
  /** Times it has asked again after an unclear answer (at most once). */
  reasked: number;
};

export const PENDING_TTL_MS = 10 * 60 * 1000;
export const ALL_OF_THESE = "All of these";
export const CANCEL = "Cancel";
/** The ClarifyCard question id that marks an answer to a pending question. */
export const PENDING_QUESTION_ID = "pending";
/** Route "intent" candidate ids, in CLARIFY_OPTIONS order. */
export const INTENT_CHOICE_IDS = ["plan", "task", "talk"] as const;
/** Route "match": the "New plan" button's id. */
export const NEW_PLAN_ID = "new";

const ROUTE_KINDS: readonly string[] = ["intent", "match"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function makePendingQuestion(
  kind: PendingQuestion["kind"],
  candidates: readonly Candidate[],
  request: string,
  now: Date,
  extra: { mention?: string; decisionId?: string | null } = {}
): PendingQuestion {
  const q: PendingQuestion = {
    action: ROUTE_KINDS.includes(kind) ? "route" : "delete",
    kind,
    candidates: candidates.slice(0, 8).map((c) => ({ id: c.id, title: c.title })),
    request: request.slice(0, 500),
    expiresAt: new Date(now.getTime() + PENDING_TTL_MS).toISOString(),
    reasked: 0,
  };
  if (extra.mention) q.mention = extra.mention.slice(0, 200);
  if (extra.decisionId && UUID_RE.test(extra.decisionId)) q.decisionId = extra.decisionId;
  return q;
}

/** The card for it: one button per candidate, then "All of these" (deletes
 *  only, and only with more than one). The card's skip button is "Cancel". */
export function pendingQuestionCard(q: PendingQuestion, question: string): { id: string; question: string; options: string[] } {
  const options = q.candidates.map((c) => c.title);
  if (q.action === "delete" && q.candidates.length > 1) options.push(ALL_OF_THESE);
  return { id: PENDING_QUESTION_ID, question, options };
}

/** A pending question sent back by the client, or null when it is malformed
 *  or expired. The ids are only ever looked up among the student's own tasks
 *  and plans, so a tampered one can't reach anyone else's. */
export function parsePendingQuestion(raw: unknown, now: Date): PendingQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.action !== "delete" && r.action !== "route") return null;
  const kinds = r.action === "delete" ? ["task", "plan", "scope"] : ROUTE_KINDS;
  if (typeof r.kind !== "string" || !kinds.includes(r.kind)) return null;
  if (!Array.isArray(r.candidates) || r.candidates.length > 8) return null;
  const candidates: Candidate[] = [];
  for (const c of r.candidates) {
    if (!c || typeof c !== "object") return null;
    const { id, title } = c as Record<string, unknown>;
    if (typeof id !== "string" || typeof title !== "string" || !id || id.length > 64) return null;
    candidates.push({ id, title: title.slice(0, 200) });
  }
  if (typeof r.expiresAt !== "string") return null;
  const expires = Date.parse(r.expiresAt);
  if (!Number.isFinite(expires) || expires <= now.getTime() || expires > now.getTime() + PENDING_TTL_MS) return null;
  const q: PendingQuestion = {
    action: r.action,
    kind: r.kind as PendingQuestion["kind"],
    candidates,
    request: typeof r.request === "string" ? r.request.slice(0, 500) : "",
    expiresAt: r.expiresAt,
    reasked: r.reasked === 1 ? 1 : 0,
  };
  if (r.action === "route" && typeof r.mention === "string" && r.mention.trim()) q.mention = r.mention.slice(0, 200);
  if (r.action === "route" && typeof r.decisionId === "string" && UUID_RE.test(r.decisionId)) q.decisionId = r.decisionId;
  return q;
}

export type PendingAnswer =
  /** These candidates (one or more). */
  | { kind: "pick"; candidates: Candidate[] }
  | { kind: "cancel" }
  /** A new request, not an answer: drop the question and route it normally. */
  | { kind: "unrelated" }
  /** "Which tasks?" answered with words: delete what they name. */
  | { kind: "scope"; words: string }
  /** Can't tell: ask once more, then give up. */
  | { kind: "unclear" };

const norm = (s: string) =>
  s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const stem = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const FILLER = new Set(["the", "a", "an", "my", "one", "ones", "that", "this", "those", "these", "i", "mean", "meant", "it", "please", "just", "only", "task", "tasks", "plan", "stuff", "of", "for", "delete", "remove", "yes", "yeah", "ok", "okay"]);
const words = (s: string) => norm(s).split(" ").filter((w) => w && !FILLER.has(w)).map(stem);

const ALL_RE = /^(?:(?:yes|yeah|ok|okay)\s+)?(?:all|both|everything|all of (?:them|these|those|it)|all of these|all three|all the above|every one|each of them)(?:\s+(?:of them|please))?$/;
const CANCEL_RE = /^(?:cancel|never ?mind|nevermind|no|nope|nah|stop|forget it|dont|don t|none|none of them|neither|no thanks|leave (?:it|them)|keep (?:it|them|them all))(?:\s+(?:thanks|thank you|please))?$/;
/** Typed answers to "What did you mean?", by INTENT_CHOICE_IDS. */
const INTENT_ANSWERS: readonly (readonly [string, RegExp])[] = [
  ["talk", /^(?:(?:im |i m |i was )?just )?(?:talking|chatting|asking|thinking)\b|^(?:dont|don t|do not) add\b|^just (?:a )?question\b|^nothing\b/],
  ["task", /^(?:just )?(?:add )?(?:one|a|1|the|that) (?:single )?(?:task|thing|item)\b|^just (?:the |one )?(?:task|that|it)\b|^(?:a )?task\b|^one\b/],
  ["plan", /^(?:make |build )?(?:me )?(?:a |the )?(?:full |whole )?plan\b|^(?:a )?plan it\b/],
];

/** Starts like a new command or question rather than an answer. */
const NEW_REQUEST_RE = /^(?:add|create|make|schedule|plan|put|move|reschedule|complete|finish|mark|what|whats|when|how|why|who|can|could|should|will|would|do|does|is|are|help|show|list|tell|remind|set|i have|ive got|im|change|rename|update)\b/;

/**
 * What the student's reply means for this question. Matching is on whole
 * words: a candidate is picked when every word of the answer is in its title
 * (or the answer is its exact title); several fits are all returned only when
 * the answer names them all.
 */
export function resolvePendingAnswer(text: string, q: PendingQuestion): PendingAnswer {
  const s = norm(text);
  if (!s) return { kind: "unclear" };
  if (CANCEL_RE.test(s) || s === norm(CANCEL)) return { kind: "cancel" };
  // "All of these" completes a delete only: a route question has one answer.
  if (q.action === "delete" && q.candidates.length > 1 && (ALL_RE.test(s) || s === norm(ALL_OF_THESE))) {
    return { kind: "pick", candidates: [...q.candidates] };
  }

  const exact = q.candidates.filter((c) => norm(c.title) === s);
  if (exact.length === 1) return { kind: "pick", candidates: exact };

  // "What did you mean?": a typed answer in the student's words.
  if (q.kind === "intent") {
    const choice = INTENT_ANSWERS.find(([, re]) => re.test(s));
    const picked = choice && q.candidates.find((c) => c.id === choice[0]);
    if (picked) return { kind: "pick", candidates: [picked] };
  }

  // "the first one", "2", "second".
  const ordinal = ["first|1|1st|one", "second|2|2nd|two", "third|3|3rd|three", "fourth|4|4th|four"].findIndex((alts) =>
    new RegExp(`^(?:the\\s+)?(?:${alts})(?:\\s+one)?$`).test(s)
  );
  if (ordinal >= 0 && q.candidates[ordinal]) return { kind: "pick", candidates: [q.candidates[ordinal]] };
  if (/^(?:the\s+)?last(?:\s+one)?$/.test(s) && q.candidates.length) return { kind: "pick", candidates: [q.candidates[q.candidates.length - 1]] };

  const want = words(text);
  if (want.length && q.candidates.length) {
    const fits = q.candidates.filter((c) => {
      const have = new Set(norm(c.title).split(" ").map(stem));
      return want.every((w) => have.has(w));
    });
    if (fits.length === 1) return { kind: "pick", candidates: fits };
    // "SAT and ICF": each part names exactly one.
    const parts = s.split(/\s*(?:,|\band\b|\bplus\b|&)\s*/).filter(Boolean);
    if (parts.length > 1) {
      const picked = new Map<string, Candidate>();
      for (const part of parts) {
        const pw = words(part);
        const hit = q.candidates.filter((c) => pw.length && pw.every((w) => new Set(norm(c.title).split(" ").map(stem)).has(w)));
        if (hit.length !== 1) {
          picked.clear();
          break;
        }
        picked.set(hit[0].id, hit[0]);
      }
      if (picked.size > 0) return { kind: "pick", candidates: Array.from(picked.values()) };
    }
    if (fits.length > 1) return { kind: "unclear" };
  }

  // "Which plan?": the plan matcher's nicknames, typos and sound-alikes
  // ("eye see eff prep"), and only when it is sure.
  if (q.kind === "match" || q.kind === "plan") {
    const plans = q.candidates.filter((c) => c.id !== NEW_PLAN_ID);
    const m = matchPlan(text, plans, new Date());
    if (m.decision === "sure") {
      const hit = plans.find((c) => c.id === m.target.id);
      if (hit) return { kind: "pick", candidates: [hit] };
    }
  }

  if (NEW_REQUEST_RE.test(s)) return { kind: "unrelated" };
  // "Which tasks should I remove?" answered with what to remove ("my SAT tasks").
  if (q.kind === "scope" && want.length > 0 && want.length <= 6) return { kind: "scope", words: s };
  // A long reply that names none of them is more likely something new.
  if (want.length > 4) return { kind: "unrelated" };
  return { kind: "unclear" };
}

/** Tasks a spoken title could mean, for "Which one?": every word of it in the
 *  title (whole words), up to eight, soonest first. */
export function taskCandidates<T extends { id: string; title: string; date: string; completed?: boolean }>(
  tasks: readonly T[],
  spoken: string
): T[] {
  const want = norm(spoken).split(" ").filter((w) => w && !FILLER.has(w)).map(stem);
  if (want.length === 0) return [];
  return tasks
    .filter((t) => {
      const have = new Set(norm(t.title).split(" ").map(stem));
      return want.every((w) => have.has(w));
    })
    .sort((a, b) => Number(!!a.completed) - Number(!!b.completed) || a.date.localeCompare(b.date))
    .slice(0, 8);
}

/** Does the student ask which calendars they have? The model's get_calendars
 *  is only honoured then: "my SAT tasks" (an answer to "Which tasks?") once
 *  came back as a calendar list. */
export function asksForCalendars(text: string): boolean {
  return /\bcalendars?\b/i.test(text) && !/\b(?:delete|remove|clear|add|move)\b/i.test(text);
}
