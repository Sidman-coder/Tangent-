// Master fix B5: typo-tolerant delete words and "the closest is …" for a name
// that matches no plan. Pure (no store, no AI), unit tested with plain Node
// (closest-match.test.ts). Used by lib/delete-scope.ts and
// lib/pending-question.ts; flag on AND off.
//
// "deltet my writing stuff for sat" with plans "SAT Reading Score Boost" and
// "SAT Math Geometry Sprint": "deltet" reads as delete, "sat" is in both so it
// tells them apart by nothing, and "writing" is a sibling of "reading", so the
// answer is "You don't have an SAT writing plan. The closest is SAT Reading
// Score Boost (reading & writing). Delete that?". It only ever suggests: the
// student confirms, and the delete is still a preview.

/** Misspellings seen in real messages, then edit distance 1 for the rest. */
const KNOWN_TYPOS: Record<string, string> = {
  deltet: "delete", delte: "delete", delet: "delete", dleete: "delete", deleet: "delete", deleete: "delete",
  delelte: "delete", deletee: "delete", deltee: "delete", dlete: "delete", deleate: "delete",
  remvoe: "remove", reomve: "remove", rmeove: "remove", remoev: "remove", remov: "remove", remvove: "remove", romove: "remove",
  cancle: "cancel", cancell: "cancel", cancl: "cancel", cacnel: "cancel", canel: "cancel", cancal: "cancel",
  erace: "erase", claer: "clear", clera: "clear",
};
const INTENT_WORDS = ["delete", "remove", "cancel", "erase", "clear"];
/** Real words one edit away from an intent word. */
const NOT_TYPOS = new Set([
  "remote", "delta", "cancer", "candle", "clean", "cleat", "eraser", "relate", "delved", "elite",
  "deleted", "removed", "canceled", "cancelled", "cleared", "erased", "deletes", "removes", "cancels", "clears", "erases",
  "remover", "clearer", "clever",
]);

/** Optimal string alignment distance (adjacent swaps count as one edit). */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** The intent word a misspelling stands for, or null. */
export function intentTypo(word: string): string | null {
  const w = word.toLowerCase();
  if (KNOWN_TYPOS[w]) return KNOWN_TYPOS[w];
  if (w.length < 5 || NOT_TYPOS.has(w) || INTENT_WORDS.includes(w)) return null;
  const hits = INTENT_WORDS.filter((t) => editDistance(w, t) === 1);
  return hits.length === 1 ? hits[0] : null;
}

/** "deltet my writing stuff" → "delete my writing stuff". Other words are untouched. */
export function fixIntentTypos(text: string): string {
  return text.replace(/[A-Za-z]+/g, (w) => intentTypo(w) ?? w);
}

/** Subjects that stand in for each other: the SAT's reading section is
 *  "Reading and Writing", geometry is math. Both directions. */
const GROUPS: readonly (readonly string[])[] = [
  ["writing", "reading", "english", "essay", "grammar", "verbal", "ela", "rw", "literature", "lit", "vocab", "vocabulary"],
  ["math", "maths", "geometry", "algebra", "calculus", "calc", "quant", "trig", "trigonometry", "stats", "statistics", "precalc", "arithmetic"],
  ["bio", "biology"],
  ["chem", "chemistry"],
  ["physics", "phys", "mechanics"],
  ["science", "sci", "research", "isef", "experiment"],
  ["history", "hist", "apush", "govt", "government", "civics"],
  ["code", "coding", "programming", "cs", "computer"],
  ["run", "running", "jog", "jogging", "cardio"],
  ["gym", "workout", "lifting", "strength", "boxing", "training"],
  ["piano", "music", "guitar", "violin"],
];
const RELATED = new Map<string, Set<string>>();
for (const g of GROUPS) for (const w of g) RELATED.set(w, new Set(Array.from(RELATED.get(w) ?? []).concat(g.filter((x) => x !== w))));

const norm = (s: string) =>
  s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const stem = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const tokens = (s: string) => norm(s).split(" ").filter(Boolean).map(stem);
const related = (a: string, b: string) => !!RELATED.get(a)?.has(b) || !!RELATED.get(stem(a))?.has(b);

export type CloseCandidate = { id: string; title: string; hint?: string };

export type Closest<C extends CloseCandidate> = {
  candidate: C;
  /** The student's words its title doesn't have ("writing"). */
  missing: string[];
  /** Why it is close, for the parenthesis: "reading & writing". */
  note?: string;
};

/**
 * The one candidate closest to the student's words, or null when none is
 * close or two tie. Words every candidate shares ("sat") tell them apart by
 * nothing and are ignored. A word in the title scores 3, a sibling of a title
 * word 2 ("writing" ~ "reading"), a word in the hint (its task titles) 1.
 */
export function closestMatch<C extends CloseCandidate>(words: readonly string[], candidates: readonly C[]): Closest<C> | null {
  if (candidates.length === 0) return null;
  const want = Array.from(new Set(words.flatMap((w) => tokens(w))));
  const titleTokens = candidates.map((c) => new Set(tokens(c.title)));
  const shared = candidates.length > 1 ? want.filter((w) => titleTokens.every((t) => t.has(w))) : [];
  const telling = want.filter((w) => !shared.includes(w));
  if (telling.length === 0) return null;

  const scored = candidates.map((c, i) => {
    const title = titleTokens[i];
    const hint = new Set(tokens(c.hint ?? ""));
    let score = 0;
    const notes: string[] = [];
    const missing: string[] = [];
    for (const w of telling) {
      if (title.has(w)) {
        score += 3;
        continue;
      }
      missing.push(w);
      const sib = Array.from(title).find((t) => related(w, t));
      if (sib) {
        score += 2;
        notes.push(`${sib} & ${w}`);
      } else if (hint.has(w)) {
        score += 1;
        notes.push(`has ${w}`);
      } else if (Array.from(hint).some((t) => related(w, t))) {
        score += 0.5;
      }
    }
    return { candidate: c, score, missing, note: notes[0] };
  });
  const best = Math.max(...scored.map((s) => s.score));
  if (best <= 0) return null;
  const top = scored.filter((s) => s.score === best);
  if (top.length !== 1) return null;
  const { candidate, missing, note } = top[0];
  return { candidate, missing, ...(note ? { note } : {}) };
}

/** "an SAT", "a SAT-free"…: "an" before a vowel sound, including acronyms
 *  read letter by letter (SAT, ICF, MIT). */
export function aOrAn(word: string): "a" | "an" {
  const w = word.trim();
  if (!w) return "a";
  const acronym = /^[A-Z]{2,}\b/.test(w);
  if (acronym) return "AEFHILMNORSX".includes(w[0]) ? "an" : "a";
  return /^[aeiou]/i.test(w) && !/^(?:uni|use|usu|eu|one|once)/i.test(w) ? "an" : "a";
}

/** How the student named it, cased like the plans: "SAT writing". */
export function mentionFor(words: readonly string[], candidates: readonly CloseCandidate[], missing: readonly string[]): string {
  const want = new Set(words.flatMap((w) => tokens(w)));
  const first = candidates[0];
  const sharedCased = first
    ? norm(first.title)
        .split(" ")
        .map((w, i) => ({ w: stem(w), raw: first.title.split(/\s+/)[i] ?? w }))
        .filter(({ w }) => want.has(w) && candidates.every((c) => tokens(c.title).includes(w)))
        .map(({ raw }) => raw.replace(/[^A-Za-z0-9]/g, ""))
    : [];
  return [...sharedCased, ...missing].join(" ").trim();
}

/** The question for a close miss. Plans: "You don't have an SAT writing plan.
 *  The closest is SAT Reading Score Boost (reading & writing). Delete that?" */
export function closestQuestion(kind: "plan" | "task", mention: string, title: string, note?: string): string {
  if (kind === "plan") {
    const lead = mention ? `You don't have ${aOrAn(mention)} ${mention} plan. ` : "";
    return `${lead}The closest is ${title}${note ? ` (${note})` : ""}. Delete that?`;
  }
  const lead = mention ? `I couldn't find "${mention}". ` : "";
  return `${lead}The closest is "${title}". Delete that?`;
}
