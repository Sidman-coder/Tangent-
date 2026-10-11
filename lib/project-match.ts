// Does a new ask belong to a project the student already has? Matched in code
// rather than left to the model, which spotted "start a robotics club" inside
// "Launching a School Robotics Team" only some of the time.

const STOP = new Set([
  "a", "an", "the", "my", "our", "to", "for", "of", "at", "in", "on", "and", "or", "with", "school",
  "start", "starting", "launch", "launching", "make", "making", "build", "building", "plan", "planning",
  "new", "get", "getting", "do", "doing", "work", "working", "help", "me", "i", "project", "this", "that",
]);

/** Lower-case content words, with plural and -ing endings folded away. */
function words(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOP.has(raw)) continue;
    out.add(raw.replace(/(ing|es|s)$/, ""));
  }
  return out;
}

/** The project this request most plausibly belongs to, or null. One shared
 *  distinctive word (five letters or more, like "robotics") is enough; shorter
 *  words need a second one, so "AP Chem" alone doesn't capture every chem ask. */
export function matchProject<T extends { title: string }>(request: string, projects: T[]): T | null {
  const asked = words(request);
  let best: { project: T; score: number } | null = null;
  for (const project of projects) {
    const shared = Array.from(words(project.title)).filter((w) => asked.has(w));
    const score = shared.reduce((n, w) => n + (w.length >= 5 ? 2 : 1), 0);
    if (score >= 2 && (!best || score > best.score)) best = { project, score };
  }
  return best?.project ?? null;
}
