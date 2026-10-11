// Deterministic cleanup for quick-add tasks (no AI). Pure so it is unit tested
// with plain Node. Every path that makes a new task applies cleanTitle: quick
// adds, instant capture, AI single tasks, plan and project steps, and plans
// parsed from chat.

const LEAD_INS = [
  /^(?:please|ok|okay|so|um|uh|hey)\s+/i,
  /^i\s+(?:have|had|got)\s+(?:a|an)\s+/i,
  /^i\s+have\s+(?:to\s+)?/i,
  /^i(?:'|’)?ve\s+got\s+(?:(?:a|an|to)\s+)?/i,
  /^i\s+need\s+to\s+/i,
  /^i\s+(?:should|must|gotta)\s+/i,
  /^remind\s+me\s+(?:to|about)\s+/i,
  /^there(?:'|’)?s\s+(?:a|an)\s+/i,
  /^there\s+is\s+(?:a|an)\s+/i,
  /^(?:don(?:'|’)?t|do\s+not)\s+forget\s+(?:to|about)\s+/i,
];

/** "add", "schedule" and "put" ask Tangent to save something, unless the rest
 *  says where it goes: "Add math notes to binder" is the task itself. */
const SAVE_VERB = /^(?:add|schedule|put)\s+(?:(?:a|an)\s+)?/i;
const HAS_DESTINATION = /\b(?:to|into|in|on|onto|away|back|up|down|out)\b/i;

/** "...on my calendar", "...to my list": where it's saved, not what it is. */
const SAVE_TARGET = /\s+(?:to|on|in|into)\s+(?:my\s+|the\s+)?(?:calendar|schedule|planner|list|to-?do list|tasks)$/i;

// Full day names only: "SAT" is a test, not Saturday.
const DAY = String.raw`(?:mon|tues|wednes|thurs|fri|satur|sun)day`;
const CLOCK = String.raw`\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?`;
/** Words at the end that only say when, or nothing at all. The date and time
 *  already hold them, so they don't belong in the title. */
const TRAILING_WHEN = new RegExp(
  String.raw`\s+(?:` +
    [
      String.raw`coming\s+up`,
      "soon",
      "later",
      "tomorrow",
      "today",
      "tonight",
      String.raw`this\s+(?:morning|afternoon|evening|weekend|week)`,
      String.raw`(?:on\s+|every\s+)?weekdays`,
      String.raw`next\s+(?:week|month|weekend|${DAY})`,
      String.raw`(?:at|around|by)\s+(?:${CLOCK}|noon|midnight)`,
      String.raw`\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)`,
      String.raw`\d{1,2}:\d{2}`,
      String.raw`(?:on|by|this|before)\s+${DAY}`,
    ].join("|") +
    ")$",
  "i"
);

/** A bare day at the end ("chem quiz thursday"), unless it is what the task
 *  is for ("study for monday", "plans after friday"). */
const TRAILING_DAY = new RegExp(String.raw`(?<!\b(?:for|until|till|after|since|from|of))\s+${DAY}$`, "i");

/**
 * "I have a soccer coaching appointment coming up tomorrow 10pm" → "Soccer
 * coaching appointment". Strips lead-ins ("I have a", "I've got", "I need to",
 * "remind me to", "there's a", "don't forget to", "add", "schedule", "put"),
 * then trailing filler and when-words the date and time already hold
 * ("coming up", "tomorrow", "at 10pm", "on friday"), then capitalizes the first
 * letter. Keeps the original when fewer than 2 characters would be left.
 */
export function cleanTitle(raw: string): string {
  const original = raw.trim().replace(/[.!?,;:]+$/, "").trim();
  let s = original;
  for (let prev = ""; prev !== s; ) {
    prev = s;
    for (const re of LEAD_INS) s = s.replace(re, "");
    s = s.replace(SAVE_TARGET, "").replace(TRAILING_WHEN, "").replace(TRAILING_DAY, "").replace(/[\s,]+$/, "").trim();
    const verb = s.match(SAVE_VERB);
    if (verb && !HAS_DESTINATION.test(s.slice(verb[0].length))) s = s.slice(verb[0].length);
    s = s.trim();
  }
  if (s.length < 2) s = original;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const TIME_WORDS = new RegExp(
  [
    "\\b\\d{1,2}(?::\\d{2})?\\s*(?:a\\.?m\\.?|p\\.?m\\.?)(?![a-z])",
    "\\b\\d{1,2}:\\d{2}\\b",
    "\\b(?:at|by|around|from|until|till)\\s+\\d{1,2}\\b",
    "\\b\\d{1,2}\\s*o(?:'|’)?\\s*clock\\b",
    "\\b(?:noon|midnight|midday|morning|afternoon|evening|tonight|night|lunch|lunchtime|breakfast|dinner)\\b",
    "\\b(?:before|after)\\s+school\\b",
    "\\b(?:half|quarter)\\s+(?:past|to)\\b",
  ].join("|"),
  "i"
);

/** True when the request says when in the day, e.g. "at 4", "3:30", "tonight". */
export function hasTimeWords(text: string): boolean {
  return TIME_WORDS.test(text);
}
