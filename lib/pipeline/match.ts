// Pipeline V2 (B2): which existing plan or project a student means by the
// words they used ("my iCF prep", "eye see eff prep", "the SAT one"). Plans and
// Juann's Projects are the same rows (a Project is a Plan), so one list covers
// both. Pure (no store, no AI), unit tested in match.test.ts.
//
// How a mention is scored against one plan (best of):
//   1. a saved nickname (plan_aliases, B3) or the exact title       → 1.0
//   2. word by word on normalized text ("iCF" = "I.C.F." = "icf"):
//      exact words, then Jaro-Winkler for typos, then sound-alike
//      ("eye see eff" → "icf", Soundex for longer words)
//   3. a recency bonus for a plan touched in the last week
// Whole words only: a short word (under 4 letters) must match exactly, so
// "SAT" never matches "Saturday".
//
// Decision: "sure" → that plan is the target; "unsure" → ask with tap buttons
// (the pending question, A1); "none" → a new plan.

/** Every threshold in one place. Scores run 0–1. */
export const MATCH_THRESHOLDS = {
  /** Sure: the top plan scores at least this… */
  sure: 0.88,
  /** …and leads the runner-up by at least this much. */
  gap: 0.08,
  /** Below this nothing matches: the mention names a new plan. */
  unsure: 0.6,
  /** Every word the student said is a whole word of the title ("icf" in
   *  "ICF Prep"): at least this, so one plan with that word is sure. */
  contains: 0.9,
  /** Jaro-Winkler at or above this counts as the same word (typos). */
  fuzzyWord: 0.92,
  /** Credit for a word that only sounds alike (Soundex, spelled letters). */
  soundAlike: 0.85,
  /** Added for a plan created or changed in the last `recencyDays`. Small:
   *  it breaks near-ties but never makes an unsure match sure on its own. */
  recencyBonus: 0.04,
  recencyDays: 7,
  /** Words shorter than this must match exactly (whole words only). */
  minFuzzyLength: 4,
  /** At most this many candidates go on an "unsure" question. */
  maxCandidates: 4,
} as const;

export type MatchablePlan = {
  id: string;
  title: string;
  /** Saved nicknames for it (plan_aliases.alias_normalized). */
  aliases?: readonly string[];
  /** ISO time it was created or last changed, for the recency bonus. */
  activeAt?: string | null;
};

export type ScoredPlan = { id: string; title: string; score: number; via: "alias" | "exact" | "words" | "sound" };

export type MatchResult =
  | { decision: "sure"; target: ScoredPlan; candidates: ScoredPlan[] }
  | { decision: "unsure"; candidates: ScoredPlan[] }
  | { decision: "none"; candidates: ScoredPlan[] };

// Words that say "a plan" without naming one.
const GENERIC = new Set(["my", "the", "a", "an", "this", "that", "our", "plan", "plans", "project", "projects", "one", "stuff", "thing", "things", "for", "of", "to", "on", "in", "list", "schedule", "calendar", "tasks", "task", "please"]);

// Spelled letters as they come out of dictation ("eye see eff").
const LETTER_NAMES: Record<string, string> = {
  ay: "a", bee: "b", be: "b", see: "c", sea: "c", cee: "c", dee: "d", ee: "e", eff: "f", ef: "f",
  gee: "g", aitch: "h", eye: "i", aye: "i", jay: "j", kay: "k", el: "l", ell: "l", em: "m", en: "n",
  oh: "o", pee: "p", pea: "p", cue: "q", queue: "q", ar: "r", ess: "s", es: "s", tee: "t", tea: "t",
  you: "u", vee: "v", ex: "x", why: "y", zee: "z", zed: "z",
};

/** Lowercase words: "I.C.F." and "iCF" → "icf", "S.A.T. Prep" → "sat prep". */
export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\b([a-z])\.(?=[a-z]\.?)/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b((?:[a-z] ){1,}[a-z])\b/g, (run) => run.replace(/ /g, ""))
    .trim();
}

/** The words that name something, generic words left out. */
export function nameWords(s: string): string[] {
  return normalizeTitle(s).split(" ").filter((w) => w && !GENERIC.has(w));
}

/** "eye see eff prep" → "icf prep": runs of two or more spelled letters. */
export function collapseSpelledLetters(words: readonly string[]): string[] {
  const out: string[] = [];
  let run = "";
  let runWord = "";
  const flush = () => {
    if (run.length >= 2) out.push(run);
    else if (run.length === 1) out.push(runWord);
    run = "";
  };
  for (const w of words) {
    const letter = LETTER_NAMES[w];
    if (letter) {
      if (!run) runWord = w;
      run += letter;
    } else {
      flush();
      out.push(w);
    }
  }
  flush();
  return out;
}

/** Jaro-Winkler similarity, 0–1. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aHit = new Array<boolean>(a.length).fill(false);
  const bHit = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (bHit[j] || a[i] !== b[j]) continue;
      aHit[i] = bHit[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let t = 0;
  for (let i = 0, j = 0; i < a.length; i++) {
    if (!aHit[i]) continue;
    while (!bHit[j]) j++;
    if (a[i] !== b[j]) t++;
    j++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** American Soundex ("chemistry" → "C523"). */
export function soundex(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return "";
  const code = (c: string) =>
    "bfpv".includes(c) ? "1" : "cgjkqsxz".includes(c) ? "2" : "dt".includes(c) ? "3" : c === "l" ? "4" : "mn".includes(c) ? "5" : c === "r" ? "6" : "";
  let out = w[0].toUpperCase();
  let last = code(w[0]);
  for (let i = 1; i < w.length && out.length < 4; i++) {
    const c = w[i];
    const k = code(c);
    if (k && k !== last) out += k;
    if (c !== "h" && c !== "w") last = k;
  }
  return out.padEnd(4, "0");
}

/** How well one spoken word matches one title word, and how. */
function wordScore(m: string, t: string): { score: number; sound: boolean } {
  const T = MATCH_THRESHOLDS;
  if (m === t) return { score: 1, sound: false };
  // Plural or not ("checkpoint" = "checkpoints").
  if (m.length >= T.minFuzzyLength && (m === `${t}s` || t === `${m}s`)) return { score: 1, sound: false };
  if (m.length < T.minFuzzyLength || t.length < T.minFuzzyLength) return { score: 0, sound: false };
  const jw = jaroWinkler(m, t);
  if (jw >= T.fuzzyWord) return { score: jw, sound: false };
  if (soundex(m) === soundex(t) && Math.abs(m.length - t.length) <= 2) return { score: T.soundAlike, sound: true };
  return { score: 0, sound: false };
}

/** The score of one set of spoken words against one title. */
function wordsScore(mention: readonly string[], title: readonly string[]): { score: number; sound: boolean } {
  if (mention.length === 0 || title.length === 0) return { score: 0, sound: false };
  let sound = false;
  const used = new Set<number>();
  let total = 0;
  let allExact = true;
  for (const m of mention) {
    let best = { score: 0, sound: false, at: -1 };
    title.forEach((t, i) => {
      const s = wordScore(m, t);
      if (s.score > best.score) best = { ...s, at: i };
    });
    if (best.at >= 0) used.add(best.at);
    if (best.score < 1) allExact = false;
    if (best.sound) sound = true;
    total += best.score;
  }
  const mentionCover = total / mention.length;
  const titleCover = used.size / title.length;
  let score = 0.75 * mentionCover + 0.25 * titleCover;
  if (allExact && used.size === mention.length) score = Math.max(score, titleCover === 1 ? 1 : MATCH_THRESHOLDS.contains);
  return { score, sound };
}

/** One plan's score for a mention, before the recency bonus. */
function scorePlan(mention: string, plan: MatchablePlan): ScoredPlan {
  const base = { id: plan.id, title: plan.title };
  const said = normalizeTitle(mention);
  const saidWords = nameWords(mention);
  if ((plan.aliases ?? []).some((a) => a && (a === said || a === saidWords.join(" ")))) return { ...base, score: 1, via: "alias" };
  const titleWords = nameWords(plan.title);
  if (said === normalizeTitle(plan.title) || (saidWords.length > 0 && saidWords.join(" ") === titleWords.join(" "))) {
    return { ...base, score: 1, via: "exact" };
  }
  const plain = wordsScore(saidWords, titleWords);
  const spelled = collapseSpelledLetters(saidWords);
  const fromSpelling = spelled.join(" ") !== saidWords.join(" ") ? wordsScore(spelled, titleWords) : { score: 0, sound: false };
  if (fromSpelling.score > plain.score) return { ...base, score: fromSpelling.score, via: "sound" };
  return { ...base, score: plain.score, via: plain.sound ? "sound" : "words" };
}

/**
 * Which plan `mention` names. `now` sets the recency window. With no words
 * that name anything ("my plan"), the decision is "none" with no candidates:
 * the caller decides whether to ask.
 */
export function matchPlan(mention: string, plans: readonly MatchablePlan[], now: Date = new Date()): MatchResult {
  const T = MATCH_THRESHOLDS;
  if (nameWords(mention).length === 0 && !plans.some((p) => (p.aliases ?? []).includes(normalizeTitle(mention)))) {
    return { decision: "none", candidates: [] };
  }
  const recent = now.getTime() - T.recencyDays * 24 * 60 * 60 * 1000;
  const scored = plans
    .map((p) => {
      const s = scorePlan(mention, p);
      const active = p.activeAt ? Date.parse(p.activeAt) : NaN;
      const bonus = s.score > 0 && Number.isFinite(active) && active >= recent ? T.recencyBonus : 0;
      return { ...s, score: Math.min(1, Math.round((s.score + bonus) * 1000) / 1000) };
    })
    .filter((s) => s.score >= T.unsure)
    .sort((a, b) => b.score - a.score);
  const candidates = scored.slice(0, T.maxCandidates);
  if (candidates.length === 0) return { decision: "none", candidates: [] };
  const [top, next] = candidates;
  if (top.score >= T.sure && (!next || top.score - next.score >= T.gap)) return { decision: "sure", target: top, candidates };
  return { decision: "unsure", candidates };
}

/** What gets saved as a nickname for a plan the student tapped or confirmed:
 *  their words, normalized, generic words dropped. Empty when nothing names. */
export function aliasFor(mention: string): string {
  return nameWords(mention).join(" ").slice(0, 100);
}
