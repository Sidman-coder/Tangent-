// Round 4 Phase 4: what a message typed into Home's box is, decided before
// any question is asked. Home used to grill nearly everything: "how do I get
// more views on my reels" with an Instagram project already on screen asked
// "What's your goal?" and "What is your Instagram about?". Now:
//
//   answer  a question, advice, or talk about what they already have. It's
//           answered right under the box, from their projects and the steps
//           they've finished. Nothing is added.
//   extend  more steps for a project they already have ("plan the next round
//           of my instagram"). Previewed, never grilled about what's known.
//   grill   they asked to be asked ("grill me on my chem plan").
//   plan    a new goal to plan. Questions until enough, then round 1.
//   add     everything else: a task, an event, a change. The calendar pipeline.
//   action  a bulk command: delete or clear all, move all, mark all done.
//           A confirm card with counts; never planned, never grilled.
//
// Pure and instant (no model), so it's testable and never costs a call.

import { CALENDAR_QUESTION, GOAL_CUE, QUESTION_START } from "../ask-route";
import { matchProject } from "../project-match";
import { parseBulkAction, type BulkAction } from "./bulk-action";
import { isPlanningRequest } from "./planning-intent";

export type HomeKind = "answer" | "extend" | "grill" | "plan" | "add" | "action";
/** `action` carries the parsed bulk action (lib/pipeline/bulk-action.ts). */
export type HomeRoute = { kind: HomeKind; projectId: string | null; action?: BulkAction };

type Project = { id: string; title: string };

const GRILL = /\b(?:grill me|quiz me|interview me|ask me (?:some |a few |more |any )?questions|question me)\b/i;

/** Asking for steps to be added to something that exists. */
const EXTEND =
  /^(?:(?:please|can you|could you)\s+)?(?:add|plan|schedule|make|build|create|break|extend|continue|give me|set up|map out)\b|\b(?:next round|next steps?|more steps|another round|round \d|keep going|what'?s next for)\b/i;

/** Asking for an opinion, an idea or a review, even without a question mark. */
const ADVICE =
  /\b(?:ideas?|tips?|advice|suggest(?:ion)?s?|thoughts?|feedback|review|recap|summar(?:y|i[sz]e)|how am i doing|how'?s (?:it|my|the) going|progress|what do you think|brainstorm|motivat\w*|stuck|overwhelmed|explain)\b/i;

/** Pointing at "it" when there's only one thing it could be. */
const POINTS_AT_PROJECT = /\b(?:my|this|the|that) (?:project|plan|goal|tangent)\b/i;

/** A when: a capture or an edit, not a talk. */
const WHEN =
  /\b(?:today|tonight|tomorrow|tmrw|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|next week|this week(?:end)?|at \d|\d{1,2}(?::\d\d)?\s*(?:am|pm)|every (?:day|week|mon|tue|wed|thu|fri|sat|sun))\b/i;

function tidy(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function isQuestion(s: string): boolean {
  if (CALENDAR_QUESTION.test(s)) return false;
  return s.endsWith("?") || QUESTION_START.test(s);
}

/** The project a message is about: named, or "my project" when there's one. */
export function projectFor(text: string, projects: readonly Project[]): Project | null {
  const named = matchProject(text, [...projects]);
  if (named) return named;
  if (projects.length === 1 && POINTS_AT_PROJECT.test(text)) return projects[0];
  return null;
}

/**
 * Where a Home message goes. `scoped` is the project the box is inside (a
 * project page): every message is about it.
 */
export function homeRoute(text: string, projects: readonly Project[], scoped: string | null = null): HomeRoute {
  const s = tidy(text);
  if (!s) return { kind: "add", projectId: scoped };
  // Round 5A 1.6: "delete all my tasks and projects", "mark all done" and the
  // like are commands, checked first: they never plan and never grill.
  const bulk = parseBulkAction(s);
  if (bulk) return { kind: "action", projectId: null, action: bulk };
  const project = scoped ? { id: scoped } : projectFor(s, projects);
  const projectId = project?.id ?? null;

  if (GRILL.test(s)) return { kind: "grill", projectId };

  const question = isQuestion(s);
  // "Can you add…", "what's due…": commands that read like questions.
  // Inside a project, "what's left" is answered from it and "can you add" extends it.
  if (CALENDAR_QUESTION.test(s)) {
    if (!projectId || WHEN.test(s)) return { kind: "add", projectId };
    return { kind: /^what/i.test(s) ? "answer" : "extend", projectId };
  }

  if (projectId) {
    // About a project they have. A question or a review is answered from it;
    // an ask for steps extends it; a task with a time joins the calendar.
    if (question || ADVICE.test(s)) return { kind: "answer", projectId };
    if (WHEN.test(s) && !EXTEND.test(s)) return { kind: "add", projectId };
    if (EXTEND.test(s) || isPlanningRequest(s)) return { kind: "extend", projectId };
    return { kind: "add", projectId };
  }

  // Nothing they have yet. "How do I get 10k followers" asks for a plan;
  // "how should I study for a quiz" and "any tips" ask for an answer.
  if (isPlanningRequest(s) && !/^(?:what|why|is|are|should|which)\b/i.test(s)) {
    return { kind: question && !GOAL_CUE.test(s) && ADVICE.test(s) ? "answer" : "plan", projectId: null };
  }
  if (question || ADVICE.test(s)) return { kind: "answer", projectId: null };
  return { kind: "add", projectId: null };
}
