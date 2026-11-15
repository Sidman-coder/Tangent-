// Round 5A R2 ("Since you mentioned…"): Sid wants Tangent's answers, plans
// and notifications to refer back to what the student told it (onboarding,
// the daily question, earlier chats), so they feel understood. Example: "Since
// you mentioned you're too sleepy to think in the morning, the morning steps
// are light ones."
//
// Pure. The facts come from the context pack (lib/ai/student-context.ts),
// which only ever holds what prepareFact let through: no health, mental-health
// or family-conflict details are stored, so none can be recalled.

export type RecallFact = { id: string; text: string };

/** Facts that make a good "since you mentioned": about how, when or why they
 *  work, not bare bookkeeping ("Grade: 11"). */
const PERSONAL =
  /\b(?:you(?:'re| are)?|your)\b.*\b(?:like|love|hate|prefer|don'?t|can'?t|struggle|tired|sleepy|energy|focus|morning|night|evening|after|before|weekend|because|so that|want|goal|dream|why|hard|easy|best|worst|usually|always|never|motivat\w*|nervous|excited|proud|lock(?:ed)? in|looks like|matters)\b/i;

export function recallable(facts: readonly RecallFact[], max = 6): RecallFact[] {
  const seen = new Set<string>();
  const out: RecallFact[] = [];
  for (const f of facts) {
    const t = f.text.trim();
    const key = t.toLowerCase();
    if (!t || seen.has(key) || !PERSONAL.test(t)) continue;
    seen.add(key);
    out.push({ id: f.id, text: t });
    if (out.length >= max) break;
  }
  return out;
}

/** The system-prompt block that asks the model to recall one thing, naturally. */
export function recallBlock(facts: readonly RecallFact[], max = 6): string {
  const picked = recallable(facts, max);
  if (picked.length === 0) return "";
  return [
    "WHAT THEY'VE TOLD YOU (their own words, from onboarding, daily questions and earlier chats):",
    ...picked.map((f) => `- [${f.id}] ${f.text}`),
    "",
    "Where one of these genuinely changes your advice, say so once, in plain words, and make the advice fit it. Start that sentence with \"Since you mentioned\" or \"You said\". Example: \"Since you mentioned you're too sleepy to think in the morning, keep mornings for light review and do the hard problems after school.\" Use at most two, only when they fit. Never quote anything about health, feelings or family.",
  ].join("\n");
}

/** One short "Since you mentioned…" clause for a notification, or "". */
export function recallClause(fact: RecallFact | undefined): string {
  if (!fact) return "";
  const t = fact.text.trim().replace(/[.!]+$/, "");
  if (!t) return "";
  const body = t.charAt(0).toLowerCase() + t.slice(1);
  return `Since you mentioned ${body}`;
}
