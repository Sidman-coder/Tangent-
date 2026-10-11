// Deterministic cleanup for quick-add tasks (no AI). Pure so it is unit tested
// with plain Node; lib/voice-handler.ts applies it to every single-task add.

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
  /^add\s+(?:a|an)\s+/i,
  /^add\s+/i,
];

/**
 * "I have a dentists appointment" → "Dentists appointment". Strips one or more
 * lead-ins ("I have a", "I've got", "I need to", "remind me to", "there's a",
 * "don't forget to", "add"), trailing punctuation, then capitalizes the first
 * letter. Returns the original (trimmed) when nothing would be left.
 */
export function cleanTitle(raw: string): string {
  const original = raw.trim().replace(/[.!?,;:]+$/, "").trim();
  let s = original;
  for (let prev = ""; prev !== s; ) {
    prev = s;
    for (const re of LEAD_INS) s = s.replace(re, "");
    s = s.trim();
  }
  if (!s) s = original;
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
