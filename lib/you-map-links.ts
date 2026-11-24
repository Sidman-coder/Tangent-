// Round 5B "You, mapped": the faint lines between facts, and between facts and
// the projects (satellites) that use them. Pure, so the map and the tests
// agree. The rules, all deliberately simple and explainable:
//
//   1. commitment ↔ how you work: they share a time band (morning, afternoon,
//      evening, night) or a weekday. "Robotics Tue/Thu until 6" ↔ "You focus
//      best in the evening".
//   2. goal ↔ project: the goal and the project title share a keyword.
//   3. what's hard ↔ goal: they share a keyword.
//   4. same question: two facts answering the same slot (slotKey).
//   5. project → fact: a confirmed plan for that project used the fact
//      (change_sets.facts_used).
//
// Each fact keeps at most MAX_LINKS fact-to-fact lines (strongest first), so
// a busy map stays readable.

import type { ContextEntry } from "./types";
import type { GroupedFacts, MapGroupKey } from "./you-map";
import type { FactUsage } from "./store";

export const MAX_LINKS = 3;

export type LinkKind = "time" | "goal-project" | "hard-goal" | "slot" | "used";

/** A line between two map points: fact ids, or `project:<id>` for a satellite. */
export type MapLink = { a: string; b: string; kind: LinkKind };

export type TimeBand = "morning" | "afternoon" | "evening" | "night";

const DAYS: [string, RegExp][] = [
  ["mon", /\bmon(day)?s?\b/],
  ["tue", /\btue(s|sday)?s?\b/],
  ["wed", /\bwed(nesday)?s?\b/],
  ["thu", /\bthu(r|rs|rsday)?s?\b/],
  ["fri", /\bfri(day)?s?\b/],
  ["sat", /\bsat(urday)?s?\b/],
  ["sun", /\bsun(day)?s?\b/],
];

/** Weekdays a fact mentions: "Tue/Thu", "Mondays", "weekends", "school nights". */
export function weekdaysOf(text: string): Set<string> {
  const t = text.toLowerCase();
  const out = new Set<string>();
  for (const [d, re] of DAYS) if (re.test(t)) out.add(d);
  if (/\bweekends?\b/.test(t)) ["sat", "sun"].forEach((d) => out.add(d));
  if (/\b(weekdays?|school (nights?|days?))\b/.test(t)) ["mon", "tue", "wed", "thu", "fri"].forEach((d) => out.add(d));
  return out;
}

function bandOfHour(h: number): TimeBand {
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

/** Times of day a fact mentions, by word ("after school", "mornings") or by
 *  hour ("until 6", "7am", "at 9pm"). A bare 1–7 with no am/pm is read as
 *  afternoon or evening, the way students write after-school times. */
export function timeBandsOf(text: string): Set<TimeBand> {
  const t = text.toLowerCase();
  const out = new Set<TimeBand>();
  if (/\bmornings?\b|\bbefore school\b|\bearly\b|\bbreakfast\b/.test(t)) out.add("morning");
  if (/\bafternoons?\b|\bafter school\b|\blunch\b/.test(t)) out.add("afternoon");
  if (/\bevenings?\b|\bafter dinner\b|\btonight\b|\bdinner\b/.test(t)) out.add("evening");
  if (/\bnights?\b|\blate\b|\bbedtime\b|\bmidnight\b/.test(t) && !/\bschool nights?\b/.test(t)) out.add("night");
  for (const m of Array.from(t.matchAll(/\b(?:at|until|till|til|by|from|after|before|around|to|-)\s*(\d{1,2})(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/g))) {
    let h = Number(m[1]);
    const ap = m[2]?.[0];
    if (h < 1 || h > 24) continue;
    if (ap === "p" && h < 12) h += 12;
    else if (ap === "a" && h === 12) h = 0;
    else if (!ap && h >= 1 && h <= 7) h += 12;
    out.add(bandOfHour(h));
  }
  for (const m of Array.from(t.matchAll(/\b(\d{1,2})(?::\d{2})?\s*(am|pm)\b/g))) {
    let h = Number(m[1]);
    if (m[2] === "pm" && h < 12) h += 12;
    if (m[2] === "am" && h === 12) h = 0;
    out.add(bandOfHour(h));
  }
  return out;
}

const STOP = new Set(
  "about after again also always because been before being best better between both could does doing done each even every from have having into just keep know like make more most much need only other over really should some still such than that their them then there these they thing things this those through time very want week weeks what when where which while will with would your youre you're year years get getting good great".split(" ")
);

/** Meaningful words: lowercase, 4+ letters, no stopwords, a trailing plural
 *  "s" dropped so "essays" meets "essay". */
export function keywordsOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of text.toLowerCase().match(/[a-z][a-z'+#]{2,}/g) ?? []) {
    const word = w.replace(/'s$/, "").replace(/'/g, "");
    if (word.length < 4 || STOP.has(word)) continue;
    out.add(word.length > 4 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word);
  }
  return out;
}

const overlaps = <T>(a: Set<T>, b: Set<T>) => {
  for (const x of Array.from(a)) if (b.has(x)) return true;
  return false;
};

type Fact = Pick<ContextEntry, "id" | "fact" | "slotKey">;

/** Fact-to-fact lines by rules 1, 3 and 4, at most MAX_LINKS per fact. */
export function factLinks(grouped: GroupedFacts): MapLink[] {
  const by = (k: MapGroupKey): Fact[] => grouped.find((g) => g.group.key === k)?.facts ?? [];
  const candidates: (MapLink & { score: number })[] = [];
  const seen = new Set<string>();
  const add = (a: string, b: string, kind: LinkKind, score: number) => {
    if (a === b) return;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ a, b, kind, score });
  };

  // 1. commitment ↔ how you work, by time band or weekday.
  for (const c of by("commitments")) {
    const cb = timeBandsOf(c.fact);
    const cd = weekdaysOf(c.fact);
    if (!cb.size && !cd.size) continue;
    for (const w of by("work")) {
      const both = overlaps(cb, timeBandsOf(w.fact)) || overlaps(cd, weekdaysOf(w.fact));
      if (both) add(c.id, w.id, "time", 2);
    }
  }
  // 3. what's hard ↔ goal, by keyword.
  for (const h of by("hard")) {
    const hk = keywordsOf(h.fact);
    for (const g of by("goals")) if (overlaps(hk, keywordsOf(g.fact))) add(h.id, g.id, "hard-goal", 2);
  }
  // 4. the same question answered twice.
  const all = grouped.flatMap((g) => g.facts);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (all[i].slotKey && all[i].slotKey === all[j].slotKey) add(all[i].id, all[j].id, "slot", 3);
    }
  }

  return capLinks(candidates);
}

/** Keeps the strongest lines first; a line is dropped once either end has MAX_LINKS. */
function capLinks(candidates: (MapLink & { score: number })[]): MapLink[] {
  const count = new Map<string, number>();
  const out: MapLink[] = [];
  for (const l of [...candidates].sort((x, y) => y.score - x.score)) {
    if ((count.get(l.a) ?? 0) >= MAX_LINKS || (count.get(l.b) ?? 0) >= MAX_LINKS) continue;
    count.set(l.a, (count.get(l.a) ?? 0) + 1);
    count.set(l.b, (count.get(l.b) ?? 0) + 1);
    out.push({ a: l.a, b: l.b, kind: l.kind });
  }
  return out;
}

export type PlanRef = { id: string; title: string };

/** Which plans used each fact: usage rows matched to plans by id, or by the
 *  new plan's title when the row has no plan id. Unknown plans are left out. */
export function usageByFact(usage: readonly FactUsage[], plans: readonly PlanRef[]): Record<string, PlanRef[]> {
  const byId = new Map(plans.map((p) => [p.id, p]));
  const byTitle = new Map(plans.map((p) => [p.title.trim().toLowerCase(), p]));
  const out: Record<string, PlanRef[]> = {};
  for (const u of usage) {
    const plan = (u.planId && byId.get(u.planId)) || (u.planTitle ? byTitle.get(u.planTitle.trim().toLowerCase()) : undefined);
    if (!plan) continue;
    for (const id of u.factIds) {
      const list = (out[id] ??= []);
      if (!list.some((p) => p.id === plan.id)) list.push(plan);
    }
  }
  return out;
}

/** Satellite lines: rule 2 (goal ↔ project by keyword) and rule 5 (a plan
 *  used the fact). Satellite ends are `project:<id>`. */
export function projectLinks(grouped: GroupedFacts, plans: readonly PlanRef[], used: Record<string, PlanRef[]>): MapLink[] {
  const out: MapLink[] = [];
  const seen = new Set<string>();
  const add = (fact: string, plan: string, kind: LinkKind) => {
    const key = `${fact}|${plan}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ a: fact, b: `project:${plan}`, kind });
  };
  const known = new Set(grouped.flatMap((g) => g.facts.map((f) => f.id)));
  for (const [factId, list] of Object.entries(used)) {
    if (!known.has(factId)) continue;
    for (const p of list) if (plans.some((x) => x.id === p.id)) add(factId, p.id, "used");
  }
  const goals = grouped.find((g) => g.group.key === "goals")?.facts ?? [];
  for (const p of plans) {
    const pk = keywordsOf(p.title);
    for (const g of goals) if (overlaps(pk, keywordsOf(g.fact))) add(g.id, p.id, "goal-project");
  }
  return out;
}
