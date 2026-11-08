// Pipeline V2 (B1): what one message is asking for. Replaces the keyword rule
// in route-request.ts (still the fallback) and feeds the intake
// (lib/pipeline/intake.ts). Order, cheapest first:
//
//   (a) an answer to a pending question (A1): resolved in app/api/chat before
//       the intake runs, so it never reaches here;
//   (b) the no-AI fast paths (lib/ai/router.ts) and Juann's instant capture
//       (app/api/chat, body.capture): no model call;
//   (c) one FAST-tier call (Haiku, feature "intentRouter", about 200 output
//       tokens) returning strict JSON, checked again with zod here;
//   (d) the old rule (routeRequest) when the call fails, the budget blocks it,
//       or the JSON doesn't parse.
//
// With the flag off it never calls the model (the `flag` input, tested in
// intent.test.ts). Pure apart from the injected caller, so tests run without
// the AI; the real caller is lib/pipeline/understand.ts.

import { z } from "zod";
import { routeCommand } from "../ai/router";
import type { Intent } from "./changeset";
import { routeRequest } from "./route-request";
import { INTENT_SYSTEM } from "./intent-prompt";

export const ROUTER_INTENTS = [
  "new_plan",
  "new_project",
  "add_to_plan",
  "change_plan",
  "add_task",
  "change_task",
  "complete_task",
  "delete_task",
  "delete_plan_tasks",
  "tangent",
  "question",
  "clarify",
] as const;
export type RouterIntent = (typeof ROUTER_INTENTS)[number];

const Mention = z.string().trim().max(200).nullable();

/** The router's answer. Strict: an extra or missing field fails the parse. */
export const RouterOutputSchema = z.strictObject({
  intent: z.enum(ROUTER_INTENTS),
  confidence: z.number().min(0).max(1),
  plan_mention: Mention,
  task_mention: Mention,
  clean_title: Mention,
  needs_questions: z.boolean(),
  reason: z.string().max(300),
});
export type RouterOutput = z.infer<typeof RouterOutputSchema>;

/** The same shape for the API's structured output (output_config.format). */
export const ROUTER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "confidence", "plan_mention", "task_mention", "clean_title", "needs_questions", "reason"],
  properties: {
    intent: { type: "string", enum: [...ROUTER_INTENTS] },
    confidence: { type: "number" },
    plan_mention: { type: ["string", "null"] },
    task_mention: { type: ["string", "null"] },
    clean_title: { type: ["string", "null"] },
    needs_questions: { type: "boolean" },
    reason: { type: "string" },
  },
} as const;

/** Below this the student is asked what they meant (CLARIFY_OPTIONS). */
export const MIN_CONFIDENCE = 0.6;

/** The tap buttons on a low-confidence clarify, in order. */
export const CLARIFY_OPTIONS = ["Make a plan", "Just add one task", "Just talking"] as const;

/**
 * The change_sets.intent value for a router intent. The table's check
 * constraint and ChangeSet INTENTS stay as they are: a new project is a new
 * plan (a Project is a Plan), deleting a plan's tasks is a delete, and a
 * Tangent is answered outside the calendar.
 */
export function toChangeSetIntent(intent: RouterIntent): Intent {
  switch (intent) {
    case "new_project":
      return "new_plan";
    case "delete_plan_tasks":
      return "delete_task";
    case "tangent":
      return "question";
    default:
      return intent;
  }
}

/** Where the intake sends it:
 *  fast    a no-AI fast path acts now (receipt with Undo);
 *  chat    talked through, no ChangeSet (a question);
 *  tangent Juann's Tangents page (a long-range goal);
 *  clarify ask with tap buttons;
 *  draft   drafted and shown as a preview card. */
export type IntakeRoute = "fast" | "chat" | "tangent" | "clarify" | "draft";

export type Understanding = {
  /** How it was decided: a fast path, the model, or the fallback rule. */
  via: "fast" | "router" | "rules";
  route: IntakeRoute;
  /** null when the fallback rule decided: it knows only the route. */
  intent: RouterIntent | null;
  confidence: number | null;
  planMention: string | null;
  taskMention: string | null;
  cleanTitle: string | null;
  needsQuestions: boolean;
  /** Why the fallback ran, when it did ("flag_off", "call_failed", "bad_json"). */
  fallback?: "flag_off" | "call_failed" | "bad_json";
};

/** Calls the FAST model with this system prompt and user message and returns
 *  the parsed JSON, or null when the call failed or the budget blocked it. */
export type RouterCaller = (system: string, user: string) => Promise<unknown | null>;

export type ClassifyContext = {
  /** TANGENT_PIPELINE_V2. Off: the old rule, and the caller is never used. */
  flag: boolean;
  tz: string;
  /** YYYY-MM-DD in the student's timezone. */
  today: string;
  /** The student's plan and project titles, newest first. */
  planTitles: readonly string[];
  caller: RouterCaller;
  at?: Date;
};

/** The router's user message: the date, their plans and the request. */
export function routerUserMessage(text: string, today: string, planTitles: readonly string[]): string {
  const weekday = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const plans = planTitles.length ? planTitles.slice(0, 20).map((t) => `"${t.slice(0, 80)}"`).join(", ") : "none";
  return `Today: ${weekday}, ${today}\nTheir plans and projects: ${plans}\nMessage: ${text.slice(0, 1000)}`;
}

/** The route for a router answer. */
export function routeFor(out: Pick<RouterOutput, "intent" | "confidence">): IntakeRoute {
  if (out.intent === "clarify" || out.confidence < MIN_CONFIDENCE) return "clarify";
  if (out.intent === "question") return "chat";
  if (out.intent === "tangent") return "tangent";
  return "draft";
}

/** "low" | "mid" | "high", for events (never the raw number's noise). */
export function confidenceBucket(c: number | null): "none" | "low" | "mid" | "high" {
  if (c === null) return "none";
  return c < MIN_CONFIDENCE ? "low" : c < 0.85 ? "mid" : "high";
}

function fromRules(text: string, tz: string, at: Date | undefined, fallback: Understanding["fallback"]): Understanding {
  const route = routeRequest(text, tz, at);
  return {
    via: route === "fast" ? "fast" : "rules",
    route,
    intent: route === "chat" ? "question" : null,
    confidence: null,
    planMention: null,
    taskMention: null,
    cleanTitle: null,
    needsQuestions: false,
    fallback: route === "fast" ? undefined : fallback,
  };
}

/** Steps (b)–(d) above for one message. Never throws. */
export async function classifyIntent(text: string, ctx: ClassifyContext): Promise<Understanding> {
  if (!ctx.flag) return fromRules(text, ctx.tz, ctx.at, "flag_off");
  if (routeCommand(text, ctx.tz, ctx.at)) return fromRules(text, ctx.tz, ctx.at, undefined);

  let raw: unknown = null;
  try {
    raw = await ctx.caller(INTENT_SYSTEM, routerUserMessage(text, ctx.today, ctx.planTitles));
  } catch {
    raw = null;
  }
  if (raw === null) return fromRules(text, ctx.tz, ctx.at, "call_failed");
  const parsed = RouterOutputSchema.safeParse(raw);
  if (!parsed.success) return fromRules(text, ctx.tz, ctx.at, "bad_json");
  const out = parsed.data;
  return {
    via: "router",
    route: routeFor(out),
    intent: out.intent,
    confidence: out.confidence,
    planMention: out.plan_mention || null,
    taskMention: out.task_mention || null,
    cleanTitle: out.clean_title || null,
    needsQuestions: out.needs_questions,
  };
}
