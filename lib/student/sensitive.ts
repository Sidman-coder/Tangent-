// Privacy for teens: Tangent never keeps health, mental-health, family-conflict
// or other sensitive details as facts, even when a student types them. The
// check is a word list, so it leans toward not saving: a missed fact costs a
// question later, a kept sensitive one costs trust.

export type SensitiveKind = "health" | "mental_health" | "family_conflict" | "other";

const PATTERNS: [SensitiveKind, RegExp][] = [
  [
    "mental_health",
    /\b(suicid\w*|self[- ]?harm\w*|kill(ing)? my ?self|hurt(ing)? my ?self|cut(ting)? my ?self|want(ed)? to die|end it all|depress\w*|anxiety|anxious disorder|panic attacks?|bipolar|ocd|ptsd|adhd|autis\w*|eating disorder|anorexi\w*|bulimi\w*|binge\w*|therap(y|ist)|psychiatr\w*|psycholog(ist|ical)|mental (health|illness|breakdown)|nervous breakdown|trauma\w*|meds|medicat\w*|antidepress\w*|diagnos\w*)\b/i,
  ],
  [
    "health",
    /\b(illness|chronic|disease|diabet\w*|asthma|epilep\w*|seizures?|cancer|tumou?r|surgery|hospital\w*|injur(y|ies|ed)|concussion|disabilit\w*|allerg\w*|pregnan\w*|period cramps|migraines?|insomnia|sick(ness)?|doctor says|prescri\w*|inhaler|insulin|weight loss|lose weight|calorie\w*)\b/i,
  ],
  [
    "family_conflict",
    /\b(divorc\w*|(parents|mom and dad) (are |got )?separat\w*|custody|abus\w*|neglect\w*|hits? me|yell(s|ing)? at me|kicked (me )?out|foster (care|home|parents?)|homeless\w*|evict\w*|(mom|dad|mother|father|parents?|step\w*) (left|leaves|drinks?|fight|fights|fighting|argue|arguing|hate)|fight(s|ing)? with my (mom|dad|parents?)|in jail|in prison|arrested|deport\w*|undocumented)\b/i,
  ],
  [
    "other",
    /\b(gay|lesbian|bisexual|queer|transgender|trans(?=\s|$|[.,!?])|sexual\w*|sex\b|drugs?|alcohol|drunk|vap(e|es|ing)|weed|smok(e|es|ing)|religio\w*|my (ssn|social security)|password)\b/i,
  ],
];

/** The kind of sensitive detail the text holds, or null when it's safe to keep. */
export function sensitiveKind(text: string): SensitiveKind | null {
  for (const [kind, re] of PATTERNS) if (re.test(text)) return kind;
  return null;
}

export function isSensitive(text: string): boolean {
  return sensitiveKind(text) !== null;
}

/** Only clear signs of real distress, not "this test is killing me". */
const DISTRESS =
  /\b(kill(ing)? my ?self|want(ed)? to die|wanna die|suicid\w*|end (it all|my life)|hurt(ing)? my ?self|self[- ]?harm\w*|no reason to live|don'?t want to (be alive|live|exist)|better off without me|can'?t go on)\b/i;

export function looksDistressed(text: string): boolean {
  return DISTRESS.test(text);
}

/** What Tangent says instead of planning when a message shows real distress. */
export const DISTRESS_REPLY =
  "I'm really glad you told me. That sounds like a lot to carry, and you don't have to handle it alone. Please talk to a trusted adult today, like a parent, teacher or school counselor. If you're in the US, you can call or text 988 any time to reach someone who can help right now. If you're in danger, call 911. Your plans can wait.";
