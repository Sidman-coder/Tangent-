// Master fix Phase 4: chat titles and the new-topic suggestion. Pure, so the
// sessions route (server) and the console (browser) share them.

const MAX_WORDS = 6;
const MAX_CHARS = 48;

/** A model's (or project's) title made safe for the sidebar: no quotes,
 *  "Title:" prefix or end punctuation, at most 6 words. "" when nothing's left. */
export function cleanTitle(raw: string): string {
  let t = raw.replace(/\s+/g, " ").trim();
  t = t.replace(/^(?:chat\s+)?title\s*[:\-–]\s*/i, "");
  t = t.replace(/^["'“”‘’`*]+|["'“”‘’`*]+$/g, "").trim();
  t = t.replace(/[.!?:;,]+$/g, "").trim();
  const words = t.split(" ").filter(Boolean).slice(0, MAX_WORDS);
  t = words.join(" ");
  if (t.length > MAX_CHARS) t = t.slice(0, MAX_CHARS).replace(/\s+\S*$/, "").trim() || t.slice(0, MAX_CHARS);
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

const FILLER =
  /^(?:(?:hey|hi|ok|okay|so|um|tangent)[,!.]?\s+)*(?:(?:can|could|would|will) you\s+|please\s+|i\s+(?:want|need|would like|'d like)\s+(?:you\s+)?to\s+|i'd like to\s+|help me\s+(?:to\s+)?|let's\s+)*/i;

const PLAN_LEAD =
  /^(?:make|build|create|give|write|put together)\s+(?:me\s+)?(?:a|an|my)\s+(?:study\s+|full\s+|weekly\s+)?(?:plan|schedule|roadmap)\s+(?:for|to)\s+(?:the\s+|my\s+)?/i;

/** The first words of the request, when the model can't be asked. */
export function fallbackTitle(text: string): string {
  const firstLine = text.split("\n").find((l) => l.trim()) ?? "";
  // "make me a plan for the AP Bio exam" is about the AP Bio exam.
  const title = cleanTitle(firstLine.replace(FILLER, "").replace(PLAN_LEAD, ""));
  return title || "New chat";
}

// ─── New topic ──────────────────────────────────────────────────────────────

const STOP = new Set(
  "about above after again also another because been before being below between both could doing during each from further have having here into just like make more most much need only other over please same should some such than that their them then there these they this those through today tomorrow under until very want week what when where which while will with would your youre ".trim().split(/\s+/)
);

/** Opens like a reply to what was just said, not a new subject. */
const FOLLOW_UP =
  /^(?:and|also|but|ok(?:ay)?|yes|yeah|yep|no|nope|sure|thanks?|thank you|cool|great|then|so|instead|actually|wait|hmm|what about|how about|same|again|more|less|make it|change it|move it|do it|that|this|those|these|it|they|them)\b/i;
const REFERS_BACK = /\b(?:it|that|this|those|these|them|the plan|the project|the schedule|same|earlier|above|instead)\b/i;

function contentWords(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of text.toLowerCase().replace(/[’']/g, "").split(/[^a-z0-9]+/)) {
    if (w.length < 4 || STOP.has(w) || /^\d+$/.test(w)) continue;
    out.add(w.slice(0, 5)); // a crude stem: "studying" and "study" meet
  }
  return out;
}

/**
 * True when `next` looks like a different subject from the chat so far: the
 * chat has at least two exchanges, the message doesn't read as a follow-up,
 * and it shares no content word with the last three requests.
 */
export function isNewTopic(previousRequests: readonly string[], next: string): boolean {
  if (previousRequests.length < 2) return false;
  const text = next.trim();
  if (text.split(/\s+/).length < 4) return false;
  if (FOLLOW_UP.test(text) || REFERS_BACK.test(text)) return false;
  const words = contentWords(text);
  if (words.size < 2) return false;
  const before = contentWords(previousRequests.slice(-3).join(" "));
  for (const w of Array.from(words)) if (before.has(w)) return false;
  return true;
}
