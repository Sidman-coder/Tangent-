// Round 4 Phase 4.4: "Start this" on a move kept in a Tangent. It becomes a
// project through Home's planning flow (questions only until enough, then
// Round 1), not a second planner here. What the Tangent already knows goes
// along in the message so Home never asks it again. Pure and client-safe.

import { isPlanningRequest } from "./pipeline/planning-intent";
import { splitNodeDetail } from "./path-format";

type Idea = { title: string; detail?: string; rationale?: string; effort?: string };
type TangentInfo = { title: string; target?: string; deadline?: string; hoursPerWeek?: number };

/** Home drops anything longer than this from planning (planning-intent.ts). */
const MAX = 560;

function sentence(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** The message Home plans from: "Plan: <move>. <what Tangent knows>." */
export function startIdeaMessage(idea: Idea, tangent: TangentInfo): string {
  const { summary, firstStep } = splitNodeDetail(idea.detail);
  const head = `Plan: ${idea.title.trim().replace(/[.!?]+$/, "")}.`;
  const parts = [
    sentence(`It's a move in my ${tangent.title.trim()} Tangent${tangent.target ? `, toward ${tangent.target.trim()}` : ""}`),
    sentence(summary),
    idea.rationale ? sentence(`Why: ${idea.rationale}`) : "",
    firstStep ? sentence(`First step: ${firstStep}`) : "",
    idea.effort ? sentence(`Commitment: ${idea.effort}`) : "",
    tangent.hoursPerWeek ? sentence(`I can give it about ${tangent.hoursPerWeek} hours a week`) : "",
    tangent.deadline ? sentence(`By ${tangent.deadline.trim()}`) : "",
  ].filter(Boolean);

  // Drop detail from the end until it fits; the title always stays.
  let message = [head, ...parts].join(" ");
  while (message.length > MAX && parts.length > 0) {
    parts.pop();
    message = [head, ...parts].join(" ");
  }
  return message.length > MAX ? head.slice(0, MAX) : message;
}

/** Sanity check used by the test: Home will treat it as planning. */
export function startsPlanning(message: string): boolean {
  return isPlanningRequest(message);
}
