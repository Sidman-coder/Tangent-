// Round 5A Phase 3: School and Work are projects, but a student only gets one
// when they told Tangent about it: an onboarding commitment of that kind, a
// connected Canvas (School), or saying so in chat. Never both by default.
// Pure, so the rule is tested without a database.

import type { PlanKind } from "./types";

export const AREA_TITLE: Record<PlanKind, string> = { school: "School", work: "Work" };

/** A job or shift, said in the student's own words. */
const WORK_MENTION =
  /\b(my (part[- ]time )?job|(a|my|the) (part[- ]time )?job at|i work (at|for|as)|work(ing)? (a |my )?shifts?|my shifts?|my boss|my manager|at work|after work|before work|got (a|the) job)\b/i;
/** School in their own words. Plain "school" alone is too common ("after
 *  school") to mean they want a School project, so it needs an owner. */
const SCHOOL_MENTION = /\b(my (classes|class schedule|teachers?|school|homework|courses?)|at school|in class|for class)\b/i;

export function mentionsJob(text: string): boolean {
  return WORK_MENTION.test(text);
}

export function mentionsSchool(text: string): boolean {
  return SCHOOL_MENTION.test(text);
}

export type AreaSignals = {
  /** Kinds of the onboarding commitments ("school", "work", "practice"…). */
  commitmentKinds?: string[];
  /** What the student said in chat. */
  chatMentions?: string[];
  canvasConnected?: boolean;
};

/** Which areas this student has said exist. Order: School, then Work. */
export function areasFor({ commitmentKinds = [], chatMentions = [], canvasConnected = false }: AreaSignals): PlanKind[] {
  const out: PlanKind[] = [];
  if (canvasConnected || commitmentKinds.includes("school") || chatMentions.some(mentionsSchool)) out.push("school");
  if (commitmentKinds.includes("work") || chatMentions.some(mentionsJob)) out.push("work");
  return out;
}

/** The areas still to create, given the plans the student already has. */
export function missingAreas(wanted: PlanKind[], plans: { kind?: PlanKind | null }[]): PlanKind[] {
  const have = new Set(plans.map((p) => p.kind).filter(Boolean));
  return wanted.filter((k, i) => !have.has(k) && wanted.indexOf(k) === i);
}
