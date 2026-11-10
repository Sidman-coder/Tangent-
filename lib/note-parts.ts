// Tangent's step notes come as "GOAL: … FOCUS: … TIME: …". Shown raw they read
// like a form; split, each part gets a plain label (the step sheet, the
// calendar's day panel).

export type NotePart = { label: string; text: string };

// Round 4 §3.4 adds "YOU'LL HAVE:" (the step's outcome) and "HOW IT WENT:"
// (the student's own check-in words).
const LABELS: Record<string, string> = { GOAL: "Goal", FOCUS: "What to do", TIME: "Time", "YOU'LL HAVE": "You'll have", "HOW IT WENT": "How it went" };

/**
 * The labelled parts, or null when the notes are just prose. By default one
 * lone label isn't enough to split on (the step sheet shows it as Notes);
 * `single` splits even "GOAL: …" alone, so no raw "GOAL:" is ever shown.
 */
export function noteParts(notes: string, single = false): NotePart[] | null {
  const re = /(GOAL|FOCUS|TIME|YOU'LL HAVE|HOW IT WENT):\s*/g;
  const hits = Array.from(notes.matchAll(re));
  const lead = notes.slice(0, hits[0]?.index ?? notes.length).trim();
  if (hits.length === 0 || hits.length < (lead || single ? 1 : 2)) return null;
  const parts = hits.map((h, i) => ({
    label: LABELS[h[1]],
    text: notes.slice((h.index ?? 0) + h[0].length, i + 1 < hits.length ? hits[i + 1].index : undefined).trim(),
  }));
  return [...(lead ? [{ label: "What to do", text: lead }] : []), ...parts].filter((p) => p.text);
}
