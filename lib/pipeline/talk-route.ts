// Round 5A 2.1/2.5: one router for every place a student can type to Tangent
// (Home, /capture, a task or project chat, the calendar rail, the palette).
// Talk first: a goal like "help me get better at competitive programming" is
// answered, not planned. A plan is built only when the student asks for one in
// so many words ("plan it", "put this on my calendar", "make me a schedule for
// AP Chem") or presses "Plan this into my calendar" (`planThis`).
//
//   action  a bulk command (delete all, move all, mark all done)
//   add     a task, an event or a change: the calendar pipeline
//   answer  talk. `schedulable` says a "Plan this" row may follow the answer.
//   extend  explicit steps for a project they already have
//   grill   they asked to be asked
//   plan    an explicit request for a new plan
//   report  how a step went ("drafted the pitch, went fine"): logged on it
//
// Pure and instant, built on homeRoute (lib/pipeline/home-route.ts). The scope
// is recorded but never changes the kind: the same words get the same route
// wherever they're typed.

import { GOAL_CUE, HOWTO_DO } from "../ask-route";
import { homeRoute, projectFor, type HomeRoute } from "./home-route";
import { isPlanningRequest } from "./planning-intent";
import { isProgressReport } from "../progress-report";

export type TalkScope = "home" | "capture" | "task" | "project" | "rail" | "palette";
export type TalkKind = "action" | "add" | "answer" | "extend" | "grill" | "plan" | "report";

export type TalkRoute = {
  kind: TalkKind;
  projectId: string | null;
  /** answer only: the message is a goal, so offer "Plan this into my calendar". */
  schedulable: boolean;
  action?: HomeRoute["action"];
};

type Project = { id: string; title: string };

export type TalkOptions = {
  projects?: readonly Project[];
  /** The project the box sits inside (a project page or project chat). */
  scoped?: string | null;
  /** The "Plan this into my calendar" button. */
  planThis?: boolean;
  scope?: TalkScope;
};

/** Words that ask for a plan or a schedule outright. */
export const EXPLICIT_PLAN =
  /\b(?:plan (?:it|this|that)(?: (?:out|for me|into my (?:calendar|week)))?|plan (?:out )?my\b|(?:put|add|get) (?:it|this|that|these|them) (?:on|in|into|to) my (?:calendar|schedule|week)|(?:make|build|create|give|draw up|write)(?: me)? (?:a |an |my )?(?:study )?(?:schedule|plan|timetable|calendar)\b|schedule (?:it|this|that|them|these)\b|map (?:it |this |that )?out\b|map out\b|turn (?:it|this|that) into (?:a )?(?:plan|schedule|steps))/i;

/** "Plan the next round of…", "add more steps to…": explicit for a project. */
const EXTEND_EXPLICIT =
  /^(?:(?:please|can you|could you)\s+)?(?:add|plan|schedule|make|build|create|break|extend|continue|set up|map out)\b|\b(?:next round|next steps?|more steps|another round|round \d|keep going)\b/i;

/** A goal said as a wish ("I want to get better at chess"): talk, not a task. */
const GOAL_TALK =
  /^(?:(?:so|ok|okay)\s+)?(?:i (?:really )?(?:want|wanna|need|hope) to|i'?d like to|i would like to|i'?m trying to|trying to|help me)\s+(?:get better|improve|learn|grow|get good|master|start|build|become|get into|prepare|prep|study|practi[cs]e|work on|figure out|level up)\b/i;

/** "ok plan it", "yes put this on my calendar": the ask is the earlier message. */
const BARE_PLAN = /^(?:(?:ok|okay|yes|yeah|sure|so|great|cool|alright)[,!.]?\s+)?(?:please\s+)?(?:plan (?:it|this|that)|put (?:it|this|that) on my calendar|schedule (?:it|this|that)|map (?:it|this) out)\b[\s\w]{0,24}[.!]?$/i;


export type PlanAsk = {
  /** The message the "Plan this" row sat under (planThis), if any. */
  goal?: string | null;
  /** The answer to the brief's one question, with the question it answers. */
  answer?: { question: string; answer: string } | null;
};

/**
 * The text the planner gets. A bare "plan it" plans the message before it; an
 * answer to the brief's question rides along as "My answers to your
 * questions:", so the brief never asks again (lib/ai/plan-brief-call.ts).
 */
export function planRequestText(messages: readonly { role: string; content: string }[], ask: PlanAsk = {}): string {
  const users = messages.filter((m) => m.role === "user").map((m) => m.content.trim()).filter(Boolean);
  const last = users[users.length - 1] ?? "";
  let goal = ask.goal?.trim() || "";
  if (!goal) goal = BARE_PLAN.test(last) && users.length > 1 ? users[users.length - 2] : last;
  if (ask.answer && ask.answer.answer.trim()) {
    return `${goal}\n\nMy answers to your questions:\n- ${ask.answer.question.trim()} ${ask.answer.answer.trim()}`;
  }
  return goal;
}

export function routeMessage(text: string, opts: TalkOptions = {}): TalkRoute {
  const projects = opts.projects ?? [];
  const scoped = opts.scoped ?? null;
  const s = text.trim().replace(/\s+/g, " ");
  const base = homeRoute(s, projects, scoped);

  // A command is a command, even with the Plan button state left over.
  if (base.kind === "action") return { kind: "action", projectId: null, schedulable: false, action: base.action };

  const projectId = base.projectId ?? (scoped || projectFor(s, projects)?.id || null);

  if (opts.planThis) return { kind: projectId ? "extend" : "plan", projectId, schedulable: false };

  if (EXPLICIT_PLAN.test(s)) return { kind: projectId ? "extend" : "plan", projectId, schedulable: false };

  // Overnight 2 (Jordan sim): a report on a step is never new work.
  if (isProgressReport(s)) return { kind: "report", projectId, schedulable: false };

  const schedulable = isPlanningRequest(s) || GOAL_CUE.test(s) || GOAL_TALK.test(s) || HOWTO_DO.test(s);
  if (base.kind === "add" && GOAL_TALK.test(s)) return { kind: "answer", projectId, schedulable: true };
  switch (base.kind) {
    case "plan":
      // A goal, not yet a request to plan it: talk first.
      return { kind: "answer", projectId, schedulable: true };
    case "extend":
      // Only the explicit asks extend; "help me grow my instagram" is talk.
      return EXTEND_EXPLICIT.test(s) ? { kind: "extend", projectId, schedulable: false } : { kind: "answer", projectId, schedulable: true };
    case "answer":
      return { kind: "answer", projectId, schedulable };
    case "grill":
      return { kind: "grill", projectId, schedulable: false };
    default:
      return { kind: "add", projectId, schedulable: false };
  }
}
