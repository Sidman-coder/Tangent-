// Development-only sample facts for /dev/app/settings-context (Round 5B):
// "You, mapped" without an account. SAMPLE_KNOWS is a believable student;
// denseKnows() pads it to about 150 points for the 60fps check.

import type { ContextEntry } from "@/lib/types";
import type { FactUsage } from "@/lib/store";
import type { PlanRef } from "@/lib/you-map-links";

type Cat = NonNullable<ContextEntry["factCategory"]>;

const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n, 16)).toISOString();

let seq = 0;
const f = (fact: string, factCategory: Cat, extra: Partial<ContextEntry> = {}): ContextEntry => ({
  id: `k${++seq}`,
  timestamp: day(seq * 2),
  category: "preference",
  fact,
  source: "chat",
  factCategory,
  factSource: "said",
  ...extra,
});

export const SAMPLE_KNOWS_PLANS: PlanRef[] = [
  { id: "p1", title: "Robotics" },
  { id: "p2", title: "SAT prep" },
  { id: "p3", title: "College essay" },
];

const ENTRIES: ContextEntry[] = [
  f("You want to win regionals with the robotics team", "goals", { usedCount: 2 }),
  f("You're aiming for a 1450 on the SAT in March", "goals", { usedCount: 1 }),
  f("You want a college essay draft done by December", "goals"),
  f("You'd like to read one book a month", "goals", { source: "manual" }),
  f("You take AP Chem, APUSH and Calc AB", "classes_activities"),
  f("You're on the robotics build team", "classes_activities"),
  f("You play JV soccer in the fall", "classes_activities", { source: "voice" }),
  f("You tutor middle schoolers in math", "classes_activities"),
  f("Robotics Tue/Thu until 6", "schedule", { usedCount: 3 }),
  f("Soccer practice Mon/Wed after school", "schedule"),
  f("Tutoring on Saturdays at 10am", "schedule", { source: "voice" }),
  f("Family dinner most nights around 7", "schedule", { factSource: "seen" }),
  f("You focus best in the evening", "how_you_work", { usedCount: 4 }),
  f("You like 45 minute sessions with a short break", "how_you_work"),
  f("Tuesdays you're tired after practice", "how_you_work", { factSource: "seen" }),
  f("Mornings before school are good for flashcards", "how_you_work", { unconfirmed: true, factSource: "guessed" }),
  f("A gentle nudge works better than a hard deadline", "push_style"),
  f("Starting essays is hard", "whats_hard", { usedCount: 1 }),
  f("Long chem problem sets drag on", "whats_hard"),
  f("Your phone pulls you away after 9pm", "whats_hard", { source: "voice" }),
  f("SAT reading sections feel slow", "whats_hard", { unconfirmed: true, factSource: "guessed" }),
  f("You want to study mechanical engineering", "future", { slotKey: "career" }),
  f("Maybe robotics engineering at a state school", "future", { slotKey: "career" }),
  f("You'd like a summer internship next year", "future"),
];

const byText = (t: string) => ENTRIES.find((e) => e.fact.startsWith(t))!.id;

export const SAMPLE_KNOWS = {
  entries: ENTRIES,
  plans: SAMPLE_KNOWS_PLANS,
  usage: [
    { planId: "p1", planTitle: null, factIds: [byText("Robotics Tue"), byText("You focus best"), byText("You like 45")] },
    { planId: "p2", planTitle: null, factIds: [byText("You focus best"), byText("SAT reading"), byText("Mornings before")] },
    { planId: null, planTitle: "College essay", factIds: [byText("Starting essays"), byText("You focus best")] },
  ] satisfies FactUsage[],
};

const EXTRA_WORDS = ["notes", "reading", "practice", "review", "drills", "outline", "flashcards", "lab", "quiz", "project"];
const CATS: Cat[] = ["goals", "classes_activities", "schedule", "how_you_work", "whats_hard", "future"];

/** About 150 facts: the sample plus generated ones spread over every area. */
export function denseKnows() {
  const extra: ContextEntry[] = [];
  for (let i = 0; extra.length + ENTRIES.length < 150; i++) {
    const cat = CATS[i % CATS.length];
    const word = EXTRA_WORDS[i % EXTRA_WORDS.length];
    extra.push({
      id: `d${i}`,
      timestamp: day(i % 60),
      category: "preference",
      fact: `Sample ${cat.replace(/_/g, " ")} fact ${i + 1} about ${word}${i % 3 === 0 ? " on Tuesdays" : ""}`,
      source: "chat",
      factCategory: cat,
      factSource: i % 9 === 0 ? "guessed" : "said",
      unconfirmed: i % 9 === 0,
    });
  }
  return {
    ...SAMPLE_KNOWS,
    plans: [...SAMPLE_KNOWS_PLANS, { id: "p4", title: "Chem final" }, { id: "p5", title: "Summer internship" }, { id: "p6", title: "Reading list" }],
    entries: [...ENTRIES, ...extra],
  };
}
