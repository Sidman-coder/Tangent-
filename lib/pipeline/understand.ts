// Pipeline V2 (B1, B2, B3, B9): the server half of the intent router. The
// pure classifier is lib/pipeline/intent.ts; this file makes its one model
// call, sends the request where the answer says, matches "my ICF plan" to a
// plan (lib/pipeline/match.ts plus saved nicknames), asks when it can't tell,
// and records one ai_decisions row per request (lib/pipeline/decisions.ts).
//
// Everything it hands off to is Juann's or already there:
//   new plan / new project   the plan generator (handleVoiceText forcePlan),
//                            with the project goal for a project;
//   needs questions          his clarifyQuestions card;
//   a tangent                his Tangents page (the client navigates);
//   adding to a plan         extend-plan.ts (his spacing and student context);
//   a question               planReply, the Plan-mode talk;
//   one task or a change     the voice pipeline, drafted as a preview card.
//
// Only reached with TANGENT_PIPELINE_V2 on (lib/pipeline/intake.ts).

import "server-only";
import { AI_TASKS, modelFor } from "../ai/models";
import { callClaude } from "../ai/call";
import { buildStudentContext } from "../ai/student-context";
import { clarifyQuestions } from "../ai/clarify";
import { extractStructuredJson } from "../anthropic-json";
import { calendarReply, planReply, type CalendarReplyOptions, type ChatMessage } from "../chat-reply";
import type { PlanProgress } from "../voice-handler";
import {
  makePendingQuestion,
  NEW_PLAN_ID,
  INTENT_CHOICE_IDS,
  pendingQuestionCard,
  resolvePendingAnswer,
  type Candidate,
  type PendingQuestion,
} from "../pending-question";
import { getAllPlans, getPlanAliases, getUserTimezone, recordDecision, savePlanAlias, setDecisionOutcome } from "../store";
import { localNow } from "../time";
import { outcomeForReply, type DecisionInput } from "./decisions";
import { logEvent } from "./events";
import { extendPlan } from "./extend-plan";
import { TANGENT_PIPELINE_V2 } from "./flags";
import { classifyIntent, CLARIFY_OPTIONS, confidenceBucket, ROUTER_JSON_SCHEMA, type Understanding } from "./intent";
import { matchPlan, type MatchResult } from "./match";
import { stripModeSwitchLine, isCompleteSchedule } from "./plan-text";

type Reply = Record<string, unknown>;

/** The router's one FAST call: its parsed JSON, or null when the call failed,
 *  the budget blocked it, or the answer wasn't JSON. */
export async function callIntentRouter(system: string, user: string): Promise<unknown | null> {
  const result = await callClaude(
    "intentRouter",
    { system, messages: [{ role: "user", content: user }] },
    { format: { type: "json_schema", schema: ROUTER_JSON_SCHEMA } }
  );
  if (!result.ok) {
    console.warn("[understand] router call failed:", result.status);
    return null;
  }
  try {
    return extractStructuredJson<unknown>(result.message);
  } catch {
    return null;
  }
}

export type UnderstandOptions = {
  source: "typed" | "voice";
  onProgress?: (event: PlanProgress) => void;
  /** The text the pipeline acts on (the request plus any answers). */
  pipelineText: string;
  /** The client can show Juann's question card ("grill me"). */
  clarify?: boolean;
};

const ROUTER_MODEL = () => modelFor(AI_TASKS.intentRouter.tier);
const EXTEND_MODEL = () => modelFor(AI_TASKS.extendPlan.tier);

/** A NextResponse from the drafting helpers, in the chat reply's shape. */
async function fromDraft(res: Response): Promise<Reply> {
  const data = (await res.json()) as Record<string, unknown>;
  if (data.ok !== true) return { message: String(data.response ?? data.error ?? "Sorry, I couldn't prepare that."), action: "error", ok: true };
  return { message: String(data.response ?? ""), action: "preview", changeSet: data.changeSet, preview: data.preview, ok: true };
}

async function talk(messages: ChatMessage[]): Promise<Reply> {
  const reply = stripModeSwitchLine(await planReply(messages, { followUp: true }));
  return { message: reply, action: isCompleteSchedule(reply) ? "plan_reply" : "chat_reply", ok: true };
}

/** Adds to a plan the student named (extend-plan.ts), as a preview card. */
async function addToPlan(planId: string, request: string, source: "typed" | "voice"): Promise<Reply> {
  const res = await extendPlan(planId, request, source);
  if (!res.ok) return { message: res.message, action: res.reason === "no_tasks" ? "chat_reply" : "error", ok: true };
  return fromDraft(res.response);
}

const changeSetIdOf = (reply: Reply) => {
  const cs = reply.changeSet as { id?: unknown } | undefined;
  return typeof cs?.id === "string" ? cs.id : null;
};
const actionIdOf = (reply: Reply) => (typeof reply.actionId === "string" ? reply.actionId : null);

/** "What did you mean?" with the three taps (CLARIFY_OPTIONS). */
function intentQuestion(request: string, decisionId: string | null): PendingQuestion {
  const candidates: Candidate[] = INTENT_CHOICE_IDS.map((id, i) => ({ id, title: CLARIFY_OPTIONS[i] }));
  return makePendingQuestion("intent", candidates, request, new Date(), { decisionId });
}

/** "Which plan?": the close plans, best first, then "New plan". */
function matchQuestion(request: string, match: MatchResult, mention: string, decisionId: string | null): PendingQuestion {
  const candidates: Candidate[] = match.candidates.slice(0, 3).map((c) => ({ id: c.id, title: c.title }));
  candidates.push({ id: NEW_PLAN_ID, title: "New plan" });
  return makePendingQuestion("match", candidates, request, new Date(), { mention, decisionId });
}

function asking(q: PendingQuestion, message: string): Reply {
  logEvent("clarify_shown", { reason: q.kind, options: q.candidates.length });
  return { message, action: "clarify", questions: [pendingQuestionCard(q, message)], pendingQuestion: q, ok: true };
}

/**
 * One request with the flag on, after "add this plan" and the "Just talking"
 * re-ask (lib/pipeline/intake.ts). Classifies it (fast path, router, or the
 * old rule), sends it on, and records the decision.
 */
export async function understandAndRoute(messages: ChatMessage[], userText: string, opts: UnderstandOptions): Promise<Reply> {
  const tz = await getUserTimezone();
  const today = localNow(tz).date;
  const plans = await getAllPlans().catch(() => []);
  const titles = [...plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((p) => p.title);

  const u: Understanding = await classifyIntent(userText, {
    flag: TANGENT_PIPELINE_V2,
    tz,
    today,
    planTitles: titles,
    caller: callIntentRouter,
  });
  logEvent("intent_classified", { intent: u.intent ?? "none", confidence_bucket: confidenceBucket(u.confidence), via: u.via, ...(u.fallback ? { fallback: u.fallback } : {}) });

  const base: DecisionInput = {
    source: opts.source,
    requestText: userText,
    route: u.route,
    intent: u.intent,
    confidence: u.confidence,
    via: u.via,
    models: u.via === "router" ? [ROUTER_MODEL()] : [],
    outcome: "answered",
  };
  /** Records the decision once the reply is known. */
  const done = async (reply: Reply, extra: Partial<DecisionInput> = {}): Promise<Reply> => {
    await recordDecision({ ...base, ...extra, changeSetId: changeSetIdOf(reply), actionId: actionIdOf(reply), outcome: outcomeForReply(reply) });
    return reply;
  };
  const voice = (extra: CalendarReplyOptions = {}) =>
    calendarReply(messages, opts.pipelineText, opts.onProgress, { source: opts.source, ...extra });

  switch (u.route) {
    case "fast":
      return done(await voice());
    case "chat":
      return done(await talk(messages));
    case "tangent":
      // Juann's Tangents page; the client hands the words over and navigates.
      return done({ message: "That sounds like a long-range goal, so I'll open it in Tangents.", action: "route_tangent", ok: true });
    case "clarify": {
      const id = await recordDecision({ ...base, pendingQuestion: { action: "route", kind: "intent", candidates: 3 }, outcome: "asked" });
      return asking(intentQuestion(userText, id), "What did you mean?");
    }
    case "draft":
      break;
  }

  // Juann's "grill me" card when the router says a plan needs answers first
  // and the client can show it (app/api/chat already asked when his own rule
  // fired, so this only adds the router's cases).
  if (u.needsQuestions && opts.clarify && (u.intent === "new_plan" || u.intent === "new_project")) {
    const picture = await buildStudentContext().catch(() => null);
    const questions = picture ? await clarifyQuestions(userText, picture.text, { askCapacity: !picture.capacityKnown }).catch(() => []) : [];
    if (questions.length > 0) return done({ ok: true, action: "clarify", message: "A few quick questions so this fits you.", questions });
  }

  switch (u.intent) {
    case "new_plan":
      return done(await voice({ project: { forcePlan: true } }));
    case "new_project":
      return done(await voice({ project: { forcePlan: true, projectGoal: userText.slice(0, 300) } }));
    case "add_to_plan":
    case "change_plan": {
      const aliases = await getPlanAliases();
      const mention = u.planMention ?? userText;
      const match = matchPlan(
        mention,
        plans.map((p) => ({ id: p.id, title: p.title, aliases: aliases.get(p.id) ?? [], activeAt: p.createdAt })),
        new Date()
      );
      logEvent("match_proposed", { decision: match.decision, candidates: match.candidates.length });
      const planMatch = { decision: match.decision, candidates: match.candidates.map((c) => ({ id: c.id, score: c.score })) };
      if (match.decision === "sure") {
        const reply = await addToPlan(match.target.id, opts.pipelineText, opts.source);
        return done(reply, { planMatch, chosenPlanId: match.target.id, models: [...(base.models ?? []), EXTEND_MODEL()] });
      }
      if (match.decision === "unsure") {
        const id = await recordDecision({ ...base, planMatch, pendingQuestion: { action: "route", kind: "match", candidates: Math.min(3, match.candidates.length) + 1 }, outcome: "asked" });
        const q = matchQuestion(userText, match, mention, id);
        return asking(q, `Which plan do you mean? ${q.candidates.slice(0, -1).map((c) => c.title).join(" or ")}?`);
      }
      // Names no plan they have: a change goes through the voice pipeline,
      // which asks or drafts; an add is a new plan of its own.
      return done(await voice(u.intent === "add_to_plan" ? { project: { forcePlan: true } } : {}), { planMatch });
    }
    default:
      // One task, or a change to tasks: never the plan generator.
      return done(await voice({ forceTask: true }));
  }
}

/**
 * The student's answer to a route question ("What did you mean?", "Which
 * plan?"), from app/api/chat before any other routing. Null when the answer
 * is a new request: the caller routes it as usual and the question is dropped.
 */
export async function routeAnswerReply(
  text: string,
  q: PendingQuestion,
  messages: ChatMessage[],
  opts: { source: "typed" | "voice"; tapped: boolean; onProgress?: (event: PlanProgress) => void }
): Promise<Reply | null> {
  const answer = resolvePendingAnswer(text, q);
  logEvent("pending_question_resolved", { how: answer.kind });
  const settle = async (reply: Reply, chosenPlanId?: string | null): Promise<Reply> => {
    await setDecisionOutcome({ id: q.decisionId }, outcomeForReply(reply), {
      changeSetId: changeSetIdOf(reply),
      actionId: actionIdOf(reply),
      chosenPlanId: chosenPlanId ?? null,
    });
    return reply;
  };

  switch (answer.kind) {
    case "unrelated":
      await setDecisionOutcome({ id: q.decisionId }, "discarded");
      return null;
    case "cancel":
      return settle({ message: "Okay, I left it.", action: "cancelled", ok: true });
    case "scope":
    case "unclear": {
      if (q.reasked >= 1) return settle({ message: "I still couldn't tell, so I left it.", action: "cancelled", ok: true });
      const again: PendingQuestion = { ...q, reasked: 1 };
      const options = q.candidates.map((c) => c.title).join(", ");
      return asking(again, `Sorry, which one? ${options}.`);
    }
    case "pick":
      break;
  }

  const pick = answer.candidates[0];
  const voice = (extra: CalendarReplyOptions) =>
    calendarReply(messages, q.request, opts.onProgress, { source: opts.source, ...extra });

  if (q.kind === "intent") {
    logEvent("clarify_answered", { choice: pick.id });
    // Talked through: the original request, not the tap, is what's discussed.
    if (pick.id === "talk") return settle(await talk([...messages.slice(0, -1), { role: "user", content: q.request }]));
    if (pick.id === "task") return settle(await voice({ forceTask: true }));
    return settle(await voice({ project: { forcePlan: true } }));
  }

  // "Which plan?": the first candidate was the matcher's best guess.
  const method = opts.tapped ? "tap" : "typed";
  if (pick.id === NEW_PLAN_ID) {
    logEvent("match_corrected", { method, to: "new" });
    return settle(await voice({ project: { forcePlan: true } }));
  }
  if (pick.id === q.candidates[0]?.id) logEvent("match_confirmed", { method });
  else logEvent("match_corrected", { method, to: "other" });
  const reply = await addToPlan(pick.id, q.request, opts.source);
  // Their words become the plan's nickname, so next time it's sure (B3).
  if (q.mention && reply.action === "preview") await savePlanAlias(pick.id, q.mention);
  return settle(reply, pick.id);
}
