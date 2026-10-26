// Did the mic hear something to add, or just a sound? Voice in the Add box
// sends as soon as you stop, so a stray "wow" or "um" used to become a task.
// Anything thinner than two real words now waits in the box instead.

const FILLER = new Set([
  "um", "uh", "uhh", "umm", "hmm", "hm", "mm", "er", "ah", "oh", "wow", "whoa", "ok", "okay", "k", "yeah", "yep", "yes", "no", "nope",
  "hi", "hey", "hello", "bye", "thanks", "thank", "you", "cool", "nice", "huh", "what", "so", "like", "test", "testing", "the", "a",
  "and", "um,", "right", "sure", "lol", "haha", "oops", "alright",
]);

/** The words that carry meaning, lower-cased, punctuation and fillers removed. */
export function meaningfulWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9'’-]/g, ""))
    .filter((w) => w && !FILLER.has(w));
}

/** True when a transcript is worth sending straight away. */
export function heardSomethingToAdd(text: string): boolean {
  return meaningfulWords(text).length >= 2;
}

// Words that only ever talk about the conversation itself, never what the
// task is about. "listen to me" is three real words and no task at all.
const ABOUT_TALKING = new Set([
  "listen", "listening", "hear", "hearing", "say", "said", "saying", "talk", "talking", "speak", "speaking",
  "stop", "wait", "working", "know", "mean", "understand", "help", "tell",
]);
const GLUE = new Set([
  "to", "me", "i", "it", "this", "that", "is", "are", "am", "can", "do", "does", "there", "here", "my", "an",
  "im", "youre", "dont", "not", "please", "just", "be", "on", "now", "again", "something", "anything", "nothing",
  "mind", "never", "tangent", "us", "we", "your", "its", "was", "were",
]);
const AT_THE_APP = /^(?:(?:hey|hi|hello|ok|okay)\s+)?tangent\b|\bnever ?mind\b|\bare you (?:there|listening|working)\b|\bcan you hear\b|\bis (?:this|it) (?:on|working)\b|\bwhat can you do\b/;

/** False when what was said is aimed at the app ("listen to me", "is this
 *  working") rather than a thing to do: nothing is left once the filler and
 *  the words about talking are gone. The capture home asks before saving it. */
export function soundsLikeATask(text: string): boolean {
  const plain = text.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  if (!plain || AT_THE_APP.test(plain)) return false;
  return plain.split(" ").some((w) => !FILLER.has(w) && !GLUE.has(w) && !ABOUT_TALKING.has(w));
}
