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
