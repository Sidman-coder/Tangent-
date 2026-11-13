// Onboarding answers → facts the student said (Round 4 Phase 6). Pure, so the
// wording can be tested; lib/store.ts saves them through addContextEntry,
// which still drops anything sensitive or too vague to plan with.
//
// Every fact gets an `onb…` slot key so redoing setup replaces the old ones
// instead of piling up next to them.

import { commitmentFact } from "./commitments";
import {
  labelFor,
  GRADE_OPTIONS,
  MATTER_OPTIONS,
  type BestTime,
  type OnboardingAnswers,
  type QuestionStep,
  type Slip,
  type PushStyle,
} from "./onboarding";
import { isVagueValue, legacyCategoryOf, type FactCategory, type LegacyCategory } from "./student/facts";
import { looksDistressed } from "./student/sensitive";

export type OnboardingFact = {
  slotKey: string;
  factCategory: FactCategory;
  category: LegacyCategory;
  fact: string;
};

/** Slot keys that mark a fact as written by onboarding. */
export const ONBOARDING_SLOT_PREFIX = "onb";

const SLIP_FACTS: Record<Slip, string> = {
  forget: "You tend to forget things when they aren't written down",
  freeze: "When there's too much, you freeze",
  putOff: "You put things off until the last minute",
  fade: "You start strong, then fade",
  whereToStart: "You often don't know where to start",
  perfect: "You get stuck making things perfect",
};

const BEST_TIME_FACTS: Record<BestTime, string> = {
  mornings: "You do your best work in the morning",
  afterSchool: "You do your best work after school",
  evenings: "You do your best work in the evening",
  lateNight: "You do your best work late at night",
};

/** The wording the planner's work-time windows understand (lib/context/flow.ts). */
export const BEST_TIME_SLOT: Record<BestTime, string> = {
  mornings: "mornings",
  afterSchool: "after school",
  evenings: "evenings",
  lateNight: "late night",
};

const PUSH_FACTS: Record<PushStyle, string> = {
  gentle: "You like gentle nudges",
  straight: "You want straight-up accountability",
  ask: "You only want reminders when you ask",
};

const MORE_CATEGORY: Record<QuestionStep, FactCategory> = {
  about: "identity",
  busy: "schedule",
  matters: "goals",
  slip: "whats_hard",
  bugging: "goals",
  brain: "how_you_work",
  toward: "future",
  push: "push_style",
};

const MORE_KEY: Record<QuestionStep, string> = {
  about: "onbMoreAbout",
  busy: "onbMoreBusy",
  matters: "onbMoreMatters",
  slip: "onbMoreSlip",
  bugging: "onbMoreBugging",
  brain: "onbMoreBrain",
  toward: "onbMoreToward",
  push: "onbMorePush",
};

/** Joins a list the way people say it: "a, b and c". */
function spoken(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function usable(text: string | null | undefined): text is string {
  return Boolean(text && text.trim() && !isVagueValue(text) && !looksDistressed(text));
}

const lower = (s: string) => (/^(AP|SAT)/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

export function onboardingFacts(answers: OnboardingAnswers): OnboardingFact[] {
  const out: OnboardingFact[] = [];
  const add = (slotKey: string, factCategory: FactCategory, fact: string) =>
    out.push({ slotKey, factCategory, category: legacyCategoryOf(factCategory), fact });

  if (answers.grade) {
    add(
      "onbGrade",
      "identity",
      answers.grade === "other" ? "You're in high school, but not in grades 9 to 12" : `You're in ${labelFor(GRADE_OPTIONS, answers.grade)} grade`
    );
  }

  for (const c of answers.commitments ?? []) add("onbBusy", "schedule", commitmentFact(c));

  if (answers.matters.length) {
    const names = answers.matters.map((m) => lower(labelFor(MATTER_OPTIONS, m) ?? m));
    add("onbMatters", "goals", `This year you care most about ${spoken(names)}`);
  }
  if (usable(answers.mattersText)) add("onbMattersText", "goals", `Also on your list this year: ${answers.mattersText}`);

  for (const s of answers.slips) add("onbSlip", "whats_hard", SLIP_FACTS[s]);

  if (usable(answers.bugging)) add("onbBugging", "goals", `On your mind right now: ${answers.bugging}`);

  if (answers.bestTime) add("preferredWorkTimes", "how_you_work", BEST_TIME_FACTS[answers.bestTime]);
  if (answers.focusLength) {
    const mins = answers.focusLength === "60" ? "an hour or more" : `about ${answers.focusLength} minutes`;
    add("focusLength", "how_you_work", `You can focus for ${mins} at a time`);
  }
  if (answers.schoolNightHours) {
    const h = answers.schoolNightHours;
    const amount = h === "4" ? "4 or more hours" : h === "1" ? "about 1 hour" : `about ${h} hours`;
    add("onbSchoolNight", "how_you_work", `You can handle ${amount} of work on a school night`);
  }

  const t = answers.toward;
  if (usable(t.major)) add("onbTowardMajor", "future", `You're thinking about majoring in ${t.major}`);
  if (usable(t.career)) add("onbTowardCareer", "future", `You'd like to work as ${/^(a|an|the)\s/i.test(t.career) ? "" : "a "}${t.career}`.replace(/ a ([aeiou])/i, " an $1"));
  if (usable(t.dream)) add("onbTowardDream", "future", `Your dream: ${t.dream}`);
  if (t.notSure && !usable(t.major) && !usable(t.career) && !usable(t.dream)) {
    add("onbTowardOpen", "future", "You're still figuring out what you're building toward, and that's fine");
  }

  if (answers.push) add("onbPush", "push_style", PUSH_FACTS[answers.push]);

  for (const [step, text] of Object.entries(answers.more) as [QuestionStep, string][]) {
    if (usable(text)) add(MORE_KEY[step], MORE_CATEGORY[step], text);
  }
  return out;
}

/** The two global planning slots onboarding fills, in the shape the planner reads. */
export function onboardingSlots(answers: Pick<OnboardingAnswers, "bestTime" | "focusLength">): {
  preferredWorkTimes?: string[];
  focusLength?: string;
} {
  const out: { preferredWorkTimes?: string[]; focusLength?: string } = {};
  if (answers.bestTime) out.preferredWorkTimes = [BEST_TIME_SLOT[answers.bestTime]];
  if (answers.focusLength) out.focusLength = answers.focusLength === "60" ? "1 hr" : `${answers.focusLength} min`;
  return out;
}
