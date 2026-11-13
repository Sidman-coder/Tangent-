// Layer 1 of the context engine (docs/tangent/CONTEXT-ENGINE.md): what Tangent
// knows about a student, as facts written to them. Pure, so it can be tested.
//
// Every fact reads in the second person ("You do your best work late at
// night"), never as a form label ("Does their best work: Late at night").
// A fact too vague to plan with ("Coming up that matters: A big test") isn't
// kept as knowledge; it becomes a follow-up question instead.

import { isSensitive } from "./sensitive";

export const FACT_CATEGORIES = [
  "identity",
  "schedule",
  "goals",
  "classes_activities",
  "how_you_work",
  "whats_hard",
  "future",
  "push_style",
] as const;
export type FactCategory = (typeof FACT_CATEGORIES)[number];

/** said: the student told Tangent. seen: Tangent watched it happen.
 *  guessed: Tangent inferred it; never shown as true until confirmed. */
export const FACT_SOURCES = ["said", "seen", "guessed"] as const;
export type FactSource = (typeof FACT_SOURCES)[number];

/** The older `context_entries.category` values, still enforced by its check. */
export type LegacyCategory = "preference" | "habit" | "commitment" | "goal" | "person" | "work" | "general";

/** Plain labels for Settings → What Tangent knows. */
export const FACT_CATEGORY_LABELS: Record<FactCategory, string> = {
  identity: "About you",
  schedule: "Your schedule",
  goals: "Goals",
  classes_activities: "Classes and activities",
  how_you_work: "How you work",
  whats_hard: "What's hard",
  future: "Your future",
  push_style: "How you like to be pushed",
};

export function isFactCategory(v: unknown): v is FactCategory {
  return typeof v === "string" && (FACT_CATEGORIES as readonly string[]).includes(v);
}

export function isFactSource(v: unknown): v is FactSource {
  return typeof v === "string" && (FACT_SOURCES as readonly string[]).includes(v);
}

const LEGACY_OF: Record<FactCategory, LegacyCategory> = {
  identity: "general",
  schedule: "commitment",
  goals: "goal",
  classes_activities: "work",
  how_you_work: "preference",
  whats_hard: "work",
  future: "goal",
  push_style: "preference",
};

/** The older category to write next to a new one (the column keeps its check). */
export function legacyCategoryOf(c: FactCategory): LegacyCategory {
  return LEGACY_OF[c];
}

const HINTS: [RegExp, FactCategory][] = [
  [/\b(push|nudge|remind(er)?s?|strict|gentle|tough love|hold me accountable|check on me)\b/i, "push_style"],
  [/\b(hard(est)?|struggl\w*|let\w* slip|procrastinat\w*|stuck|distract\w*|weak(est)?)\b/i, "whats_hard"],
  [/\b(college|university|major|career|after (high )?school|someday|future|dream)\b/i, "future"],
  [/\b(focus|best work|like to work|work best|study best|mornings?|evenings?|late at night|at a time|playlist|music while|school nights?|can handle about)\b/i, "how_you_work"],
  [/\b(every (mon|tues|wednes|thurs|fri|satur|sun)day|weekends?|school (starts|ends)|practice (is|at)|due|deadline|needs to be done|schedule)\b/i, "schedule"],
  [/\b(class(es)?|club|team|varsity|band|orchestra|choir|robotics|debate|job|works? at|ap |honors|course)\b/i, "classes_activities"],
  [/\b(goal|working toward|want to|trying to|followers|score)\b/i, "goals"],
];

/** A best guess at the new category for a fact written before Round 4. */
export function factCategoryFor(legacy: LegacyCategory | string, text: string): FactCategory {
  const hint = HINTS.find(([re]) => re.test(text));
  if (hint) return hint[1];
  switch (legacy) {
    case "preference":
    case "habit":
      return "how_you_work";
    case "commitment":
      return "schedule";
    case "goal":
      return "goals";
    case "work":
      return "classes_activities";
    default:
      return "identity";
  }
}

// ─── Wording ────────────────────────────────────────────────────────────────

export type FormattedFact = {
  /** The line to show and to give the AI; empty when the fact says nothing. */
  text: string;
  /** Too vague to plan with: keep the original, hide it, ask instead. */
  vague: boolean;
  /** The question to ask instead of keeping a vague fact. */
  followUp: string | null;
};

const VAGUE_VALUE = new RegExp(
  [
    // "a big test", "some stuff": a thing with no name or date
    String.raw`^(?:(?:a|an|some|the|my)\s+)?(?:(?:big|huge|important|major|real|few|couple)\s+)*(?:test|exam|thing|things|stuff|something|project|deadline|assignment|event|quiz)s?$`,
    // "a top result", "good grades": an aim with no measure
    String.raw`^(?:(?:a|an|some|the|my)\s+)?(?:(?:top|good|great|best|better|decent|solid|high|nice|strong)\s+)+(?:result|results|grade|grades|score|scores|mark|marks|outcome|outcomes|performance|rank|ranking)$`,
    // one-word answers and shrugs
    String.raw`^(?:good|great|better|best|ok|okay|fine|asap|as soon as possible|soon|a lot|lots|improve|get better|do well|succeed|success)$`,
    String.raw`^(?:no(?: real)? deadline|not sure|unsure|idk|i don'?t know|dunno|nothing|none|n\/?a|no|nope|maybe|whatever|nothing fixed|-+|\?+)$`,
  ].join("|"),
  "i",
);

/** The question that replaces a vague goal. "a top result" gets a specific one. */
function goalQuestion(project: string | null | undefined, value: string): string {
  const v = value.trim().replace(/[.!]+$/, "");
  if (/\b(result|results|grade|grades|score|scores|mark|marks|outcome|outcomes|performance|rank|ranking)$/i.test(v)) {
    return `What would ${v.toLowerCase()} look like${project ? ` for ${project}` : ""}: a score, a place, a rank?`;
  }
  return project ? `What does done look like for ${project}?` : "What are you aiming for?";
}

/** Whether an answer carries nothing Tangent could plan with. */
export function isVagueValue(value: string): boolean {
  return VAGUE_VALUE.test(value.trim().replace(/[.!]+$/, ""));
}

const TIME_PHRASE: Record<string, string> = {
  mornings: "in the morning",
  morning: "in the morning",
  "in the morning": "in the morning",
  "after school": "after school",
  evenings: "in the evening",
  evening: "in the evening",
  "late at night": "late at night",
  nights: "at night",
  "at night": "at night",
  weekends: "on weekends",
  "on weekends": "on weekends",
};

/** "Mornings, Evenings" → "in the morning and in the evening". */
function whenPhrase(value: string): string {
  const parts = value
    .split(/\s*,\s*|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => TIME_PHRASE[p.toLowerCase()] ?? lowerFirst(p));
  return joinAnd(parts);
}

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** Lowercases the first letter unless the word looks like a name or acronym. */
function lowerFirst(s: string): string {
  const t = s.trim();
  if (!t) return t;
  const first = t.split(/\s+/)[0];
  if (/^[A-Z]{2,}/.test(first) || /^[A-Z][a-z]+[A-Z]/.test(first) || /^I\b/.test(t)) return t;
  return t[0].toLowerCase() + t.slice(1);
}

function upperFirst(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function finish(s: string): string {
  return upperFirst(s.replace(/\s+/g, " ").trim().replace(/[.\s]+$/, ""));
}

// First person → second person, for facts the student typed ("I take soccer",
// "my practice runs late"). Capital "I" only counts when a lowercase word
// follows, so "World War I" and "Physics I" are left alone.
const FIRST_PERSON: [RegExp, string][] = [
  [/\bI'm\b/g, "you're"],
  [/\bI am\b/g, "you are"],
  [/\bI've\b/g, "you've"],
  [/\bI'll\b/g, "you'll"],
  [/\bI'd\b/g, "you'd"],
  // Not after a capitalised word: "World War I club", "Physics I class".
  [/(?<![A-Z][A-Za-z]*\s)\bI(?=\s+(?!and\b|or\b)[a-z])/g, "you"],
  [/\bmyself\b/g, "yourself"],
  [/\bmy\b/g, "your"],
  [/^My\b/, "Your"],
];
const HAS_FIRST_PERSON = /\bI(?:'m|'ve|'ll|'d)\b|\bI\s+(?!and\b|or\b)[a-z]|\bmy\b|\bmyself\b/;

function firstPerson(s: string): string {
  return FIRST_PERSON.reduce((t, [re, to]) => t.replace(re, to), s).replace(/\byou do you\b/gi, "you");
}

/** A clause about the student: "I take soccer" → "you take soccer"; a bare
 *  list ("soccer and TSA") → "you do soccer and TSA". */
function youClause(value: string, verb: string): string {
  const v = firstPerson(value.trim());
  return /^you(?:'re|'ve|'ll|'d)?\b/i.test(v) ? v.replace(/^You/, "you") : `you ${verb} ${lowerFirst(v)}`;
}

/** "end of term" → "by end of term"; "by Friday" and "Nov 20" read right as they are. */
function byPhrase(value: string): string {
  const v = lowerFirst(value.trim());
  return /^(?:by|before|on|in|at|after|within|next|this|the)\b/i.test(v) ? v : `by ${v}`;
}

const vague = (followUp: string): FormattedFact => ({ text: "", vague: true, followUp });
const plain = (text: string): FormattedFact => ({ text: finish(text), vague: false, followUp: null });

type Rule = { re: RegExp; to: (m: RegExpMatchArray) => FormattedFact };

const P = "(.{1,80}?)"; // a project title

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "Label( for P)?: value" → a sentence; vague values become `followUp`
 *  (or are dropped quietly when there's nothing worth asking). */
function labelled(label: string, render: (value: string, project: string | null) => string, followUp: string | null): Rule[] {
  return [
    {
      re: new RegExp(`^${escape(label)}(?: for ${P})?:\\s*(.+)$`, "i"),
      to: (m) => {
        if (isVagueValue(m[2]) || /^not sure yet$/i.test(m[2].trim())) {
          return followUp ? vague(followUp) : { text: "", vague: false, followUp: null };
        }
        return plain(render(m[2].trim(), m[1]?.trim() || null));
      },
    },
  ];
}

/** "3" → "3 hrs", "3–5" → "3–5 hrs", "4 hours" stays. */
function hoursText(v: string): string {
  const t = v.trim().replace(/\s*(a|per) week$/i, "");
  if (/h(ou)?rs?\b/i.test(t)) return t;
  return `${t} ${t === "1" ? "hr" : "hrs"}`;
}

/** Labels Tangent itself wrote before Round 4 (GetToKnowYou, slotToFact,
 *  factFromAnswer), mapped to second-person sentences. */
const RULES: Rule[] = [
  // GetToKnowYou
  { re: /^Working toward:\s*(.+)$/i, to: (m) => (isVagueValue(m[1]) ? vague("What are you working toward right now?") : plain(`You're working toward ${lowerFirst(m[1])}`)) },
  { re: /^Activities outside class:\s*(.+)$/i, to: (m) => (isVagueValue(m[1]) ? vague("What do you do outside class?") : plain(`Outside class, ${youClause(m[1], "do")}`)) },
  {
    re: /^Coming up that matters:\s*(.+)$/i,
    to: (m) => (isVagueValue(m[1]) ? vague(`What's the ${lowerFirst(m[1]).replace(/^(a|an|the|some)\s+/i, "")} that's coming up, and when is it?`) : plain(`Coming up for you: ${lowerFirst(m[1])}`)),
  },
  { re: /^Can handle about\s+(.+?)\s+of work on a school night$/i, to: (m) => plain(`You can handle about ${m[1]} of work on a school night`) },
  { re: /^Does their best work:\s*(.+)$/i, to: (m) => (isVagueValue(m[1]) ? vague("When do you do your best work?") : plain(`You do your best work ${whenPhrase(m[1])}`)) },
  { re: /^Tends to let slip:\s*(.+)$/i, to: (m) => (isVagueValue(m[1]) ? vague("What tends to slip when you get busy?") : plain(`You tend to let ${lowerFirst(m[1])} slip`)) },
  // slotToFact (lib/context/flow.ts, before Round 4)
  { re: new RegExp(`^Goal(?: for ${P})?:\\s*(.+)$`, "i"), to: (m) => (isVagueValue(m[2]) ? vague(goalQuestion(m[1], m[2])) : plain(m[1] ? `For ${m[1]}, you're aiming for: ${lowerFirst(m[2])}` : `You're aiming for: ${lowerFirst(m[2])}`)) },
  { re: new RegExp(`^Deadline(?: for ${P})?:\\s*(.+)$`, "i"), to: (m) => (isVagueValue(m[2]) ? vague(m[1] ? `Is there a date you'd like ${m[1]} done by?` : "Is there a date you'd like this done by?") : plain(m[1] ? `${m[1]} needs to be done ${byPhrase(m[2])}` : `Due ${byPhrase(m[2])}`)) },
  { re: new RegExp(`^Can give (.+?)(?: for ${P})?$`, "i"), to: (m) => plain(m[2] ? `You can give ${m[1]} to ${m[2]}` : `You can give ${m[1]}`) },
  { re: new RegExp(`^Level(?: for ${P})?:\\s*(.+)$`, "i"), to: (m) => (isVagueValue(m[2]) ? vague("Where are you starting from?") : plain(m[1] ? `On ${m[1]}, you're starting from: ${lowerFirst(m[2])}` : `You're starting from: ${lowerFirst(m[2])}`)) },
  { re: new RegExp(`^Hardest part(?: for ${P})?:\\s*(.+)$`, "i"), to: (m) => (isVagueValue(m[2]) ? vague("What's the hardest part?") : plain(m[1] ? `The hardest part of ${m[1]} for you: ${lowerFirst(m[2])}` : `The hardest part for you: ${lowerFirst(m[2])}`)) },
  { re: new RegExp(`^Plan around(?: for ${P})?:\\s*(.+)$`, "i"), to: (m) => (isVagueValue(m[2]) ? { text: "", vague: false, followUp: null } : plain(`You need to plan around ${lowerFirst(m[2])}${m[1] ? ` for ${m[1]}` : ""}`)) },
  { re: new RegExp(`^Best time to work(?: for ${P})?:\\s*(.+)$`, "i"), to: (m) => plain(m[1] ? `You like to work on ${m[1]} ${whenPhrase(m[2])}` : `You like to work ${whenPhrase(m[2])}`) },
  { re: /^Likes to work:\s*(.+)$/i, to: (m) => plain(`You like to work ${whenPhrase(m[1])}`) },
  { re: /^Can focus for about (.+?) at a time$/i, to: (m) => plain(`You can focus for about ${m[1]} at a time`) },
  { re: /^Weekends:\s*(.+)$/i, to: (m) => plain(`Your weekends are ${lowerFirst(m[1])}`) },
  // Round 4 question engine (SLOT_FACT_LABEL in lib/context/goal-slots.ts)
  ...labelled("Hours a week", (v, p) => `You can give ${hoursText(v)} a week${p ? ` to ${p}` : ""}`, "How many hours a week can you give this?"),
  ...labelled("Focus length", (v) => `You can focus for about ${lowerFirst(v)} at a time`, "How long can you focus in one go?"),
  ...labelled("Why it matters", (v, p) => `${p ? `${upperFirst(p)} matters to you` : "Why it matters to you"}: ${lowerFirst(v)}`, null),
  ...labelled("Tried before", (v, p) => `Your history with ${p ?? "this"}: ${lowerFirst(v)}`, null),
  ...labelled("Weakest parts", (v, p) => `Your weakest parts${p ? ` of ${p}` : ""}: ${lowerFirst(v)}`, "Which parts feel weakest?"),
  ...labelled("Platform", (v) => `You post on ${v}`, "Which platform do you post on?"),
  ...labelled("Followers", (v) => `You have about ${v} followers`, "About how many followers do you have now?"),
  ...labelled("Account is about", (v) => `Your account is about ${lowerFirst(v)}`, "What's your account about?"),
  ...labelled("Posts", (v) => `You post ${lowerFirst(v)}`, null),
  ...labelled("Best posts so far", (v) => `Your best posts so far: ${lowerFirst(v)}`, null),
  ...labelled("Needs approval from", (v, p) => `${p ? upperFirst(p) : "It"} needs approval from ${lowerFirst(v)}`, "Who needs to approve it?"),
  ...labelled("Members so far", (v, p) => `${p ? upperFirst(p) : "It"} has ${lowerFirst(v)} so far`.replace(/has just me so far$/, "is just you so far"), null),
  ...labelled("Advisor", (v, p) => `Your advisor${p ? ` for ${p}` : ""}: ${v}`, null),
  ...labelled("Essay prompt", (v, p) => `The prompt${p ? ` for ${p}` : ""}: ${lowerFirst(v)}`, "What's the prompt, roughly?"),
  ...labelled("Draft so far", (v, p) => `${p ? `On ${p}, you have` : "You have"}: ${lowerFirst(v)}`, null),
  // factFromAnswer (lib/grill-queue.ts): "SAT prep, hours a week: 3–5 hrs"
  { re: new RegExp(`^${P}, needs to be done:\\s*(.+)$`, "i"), to: (m) => (isVagueValue(m[2]) ? vague(`Is there a date you'd like ${m[1]} done by?`) : plain(`${m[1]} needs to be done ${byPhrase(m[2])}`)) },
  { re: new RegExp(`^${P}, hours a week:\\s*(.+)$`, "i"), to: (m) => plain(`You can give ${hoursText(m[2])} a week to ${m[1]}`) },
  { re: new RegExp(`^${P}, starting from:\\s*(.+)$`, "i"), to: (m) => plain(`On ${m[1]}, you're starting from: ${lowerFirst(m[2])}`) },
  { re: new RegExp(`^${P}, hardest part:\\s*(.+)$`, "i"), to: (m) => plain(`The hardest part of ${m[1]} for you: ${lowerFirst(m[2])}`) },
  { re: new RegExp(`^${P}, plan around:\\s*(.+)$`, "i"), to: (m) => (isVagueValue(m[2]) ? { text: "", vague: false, followUp: null } : plain(`You need to plan around ${lowerFirst(m[2])} for ${m[1]}`)) },
];

// Third person → second person, for facts the AI extracted ("Prefers to
// study in the morning", "The user has soccer on Tuesdays").
const SUBJECT = /^(?:the\s+)?(?:user|student|they|he|she)\s+/i;
const IRREGULAR: Record<string, string> = { is: "are", has: "have", does: "do", was: "were", "isn't": "aren't", "doesn't": "don't", "hasn't": "haven't", "wasn't": "weren't" };
const PRONOUNS: [RegExp, string][] = [
  [/\btheir own\b/gi, "your own"],
  [/\bthemselves\b/gi, "yourself"],
  [/\btheirs\b/gi, "yours"],
  [/\btheir\b/gi, "your"],
  [/\bthey're\b/gi, "you're"],
  [/\bthey've\b/gi, "you've"],
  [/\bthey'll\b/gi, "you'll"],
  [/\bthey\b/gi, "you"],
  [/\bthem\b/gi, "you"],
  [/\b(?:the )?(?:user|student)'s\b/gi, "your"],
];

/** "prefers" → "prefer", "watches" → "watch", "has" → "have". */
function baseVerb(word: string): string | null {
  const w = word.toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (/^[a-z]+(?:ss|us|is)$/.test(w)) return null; // "class", "focus", "this"
  if (/(?:sh|ch|x|z|ss|o)es$/.test(w)) return w.slice(0, -2);
  if (/[^aeiou]ies$/.test(w)) return w.slice(0, -3) + "y";
  if (/[a-z]s$/.test(w) && w.length > 3) return w.slice(0, -1);
  return null;
}

function secondPerson(raw: string): string | null {
  let s = raw.trim();
  const hadSubject = SUBJECT.test(s);
  s = s.replace(SUBJECT, "");
  const [first, ...rest] = s.split(/\s+/);
  const verb = first ? baseVerb(first.replace(/[^a-z']/gi, "")) : null;
  if (!verb && !hadSubject) return null;
  const body = verb ? [verb, ...rest].join(" ") : s;
  const swapped = PRONOUNS.reduce((t, [re, to]) => t.replace(re, to), body);
  return `You ${lowerFirst(swapped)}`;
}

const STARTS_WITH_VERB = /^(?:the\s+)?(?:user|student|they|he|she)\s+|^(?:prefers?|likes?|loves?|hates?|enjoys?|wants?|needs?|has|is|does|works?|studies|plays?|takes?|tends?|struggles?|finds?|goes|gets|feels?|uses?|wakes?|sleeps?|practices?|attends?|runs?|swims?|plans?|keeps?|forgets?|watch(?:es)?|babysits?|helps?|drives?|cares?|lives?|volunteers?|coach(?:es)?|teach(?:es)?|reads?|writes?|walks?|cooks?|spends?|stays?|skips?)\b/i;

/**
 * The fact as Tangent should say it to the student. Facts the student typed
 * themselves come back unchanged unless they're in the third person.
 */
export function formatFact(raw: string): FormattedFact {
  const text = raw.replace(/^\[[a-z_]+\]\s*/i, "").replace(/\s+/g, " ").trim();
  if (!text) return { text: "", vague: false, followUp: null };
  for (const rule of RULES) {
    const m = text.match(rule.re);
    if (m) return youify(rule.to(m));
  }
  // "What subject is hardest: Math" (a question with its answer).
  const qa = text.match(/^(what|when|where|how|which|who|do|does|are|is|anything)\b(.+?):\s*(.+)$/i);
  if (qa) {
    if (isVagueValue(qa[3])) return vague(`${text.slice(0, text.indexOf(":")).trim()}?`);
    return plain(`${qa[1]}${qa[2]}? ${qa[3]}`.replace(/\?\?/, "?"));
  }
  if (STARTS_WITH_VERB.test(text)) {
    const you = secondPerson(text);
    if (you) return plain(you);
  }
  return plain(PRONOUNS.slice(0, 3).reduce((t, [re, to]) => t.replace(re, to), text));
}

/** The student's own answer inside a label Tangent wrote ("Activities outside
 *  class: I take soccer") reads as "you". What they typed freely stays as typed. */
function youify(f: FormattedFact): FormattedFact {
  return f.text ? { ...f, text: finish(firstPerson(f.text)) } : f;
}

// ─── Duplicates ─────────────────────────────────────────────────────────────

/** The same fact written two ways compares equal: case, punctuation, spacing
 *  and "hours" / "hrs" / "per" don't count. */
export function normalizeFactText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(?:hours?|hrs?)\b/g, "hrs")
    .replace(/\bper\b/g, "a")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** One key per fact and project: two projects can both have "4 hrs a week". */
export function factKey(text: string, projectId?: string | null): string {
  return `${normalizeFactText(text)}|${projectId ?? ""}`;
}

/** Drops repeats of the same fact, keeping the first of each. */
export function dedupeFacts<T extends { fact: string; projectId?: string | null }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((f) => {
    const key = factKey(f.fact, f.projectId);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** A slot answer as a fact, in the student's second person. */
export function slotFactText(label: string, value: string, projectTitle?: string | null): FormattedFact {
  const about = projectTitle?.trim() ? ` for ${projectTitle.trim()}` : "";
  return formatFact(`${label}${about}: ${value}`);
}

// ─── Writing and reading facts ──────────────────────────────────────────────


export type FactWrite = {
  category: LegacyCategory;
  fact: string;
  source: "chat" | "voice" | "manual";
  factSource?: FactSource;
  factCategory?: FactCategory;
  confidence?: number;
  projectId?: string | null;
  slotKey?: string | null;
};

export type PreparedFact =
  | { ok: false; reason: "empty" | "sensitive" }
  /** Too vague to keep; `followUp` is the question to queue instead. */
  | { ok: false; reason: "vague"; followUp: string | null }
  | {
      ok: true;
      fact: string;
      display: string;
      factCategory: FactCategory;
      factSource: FactSource;
      confidence: number;
    };

/** How sure Tangent is by default, by where the fact came from. */
export function defaultConfidence(source: FactWrite["source"], factSource: FactSource): number {
  if (factSource === "guessed") return 0.4;
  if (factSource === "seen") return 0.8;
  return source === "manual" ? 1 : 0.7;
}

/**
 * Everything a fact goes through before it's saved. Sensitive details are
 * never kept, whatever the student typed. A vague answer to a question just
 * asked is dropped, not re-asked straight away (that would loop); Tangent
 * asks again later from what it already knows.
 */
export function prepareFact(input: FactWrite): PreparedFact {
  const fact = input.fact.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!fact) return { ok: false, reason: "empty" };
  if (isSensitive(fact)) return { ok: false, reason: "sensitive" };
  const formatted = formatFact(fact);
  if (formatted.vague) return { ok: false, reason: "vague", followUp: formatted.followUp };
  if (!formatted.text) return { ok: false, reason: "empty" };
  if (isSensitive(formatted.text)) return { ok: false, reason: "sensitive" };
  const factSource = input.factSource ?? "said";
  const confidence = Math.max(0, Math.min(1, input.confidence ?? defaultConfidence(input.source, factSource)));
  return {
    ok: true,
    fact,
    display: formatted.text.slice(0, 500),
    factCategory: input.factCategory ?? factCategoryFor(input.category, fact),
    factSource,
    confidence,
  };
}

export type StoredFact = {
  fact: string;
  displayText: string | null;
  factSource: FactSource | null;
};

export type FactView = {
  /** What to show and give the AI. */
  display: string;
  /** Never shown or used: vague, empty or sensitive. */
  hidden: boolean;
  /** For a vague fact: what to ask instead. */
  followUp: string | null;
  /** True when display_text should be saved (cleaned up for the first time). */
  needsCleanup: boolean;
  /** Tangent guessed it and the student hasn't confirmed it. */
  unconfirmed: boolean;
};

/** How a stored fact is shown. The original `fact` is never changed. */
export function factView(row: StoredFact): FactView {
  const unconfirmed = row.factSource === "guessed";
  if (isSensitive(row.fact)) return { display: "", hidden: true, followUp: null, needsCleanup: false, unconfirmed };
  // Wording saved before first-person facts were rewritten ("you do I take…"): say it again.
  if (row.displayText && !HAS_FIRST_PERSON.test(row.displayText)) return { display: row.displayText, hidden: false, followUp: null, needsCleanup: false, unconfirmed };
  const f = formatFact(row.fact);
  if (row.displayText && f.text && !f.vague) return { display: f.text, hidden: false, followUp: null, needsCleanup: f.text !== row.displayText, unconfirmed };
  if (row.displayText) return { display: row.displayText, hidden: false, followUp: null, needsCleanup: false, unconfirmed };
  if (f.vague || !f.text) return { display: "", hidden: true, followUp: f.followUp, needsCleanup: false, unconfirmed };
  return { display: f.text, hidden: false, followUp: null, needsCleanup: f.text !== row.fact.trim(), unconfirmed };
}
