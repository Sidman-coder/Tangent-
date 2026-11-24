// Tangent's step notes come as "GOAL: … FOCUS: … TIME: …". Shown raw they read
// like a form; split, each part gets a plain label (the step sheet, the
// calendar's day panel).

export type NotePart = { label: string; text: string };

// Round 4 §3.4 adds "YOU'LL HAVE:" (the step's outcome) and "HOW IT WENT:"
// (the student's own check-in words).
// Round 5A 2.3 adds "WHY:" (the step's reason, tied to the week or a fact).
// Overnight 2 Phase 3 adds "BECAUSE:" (the fact the why used, in the student's terms: lib/because.ts).
// Round 6 adds "WHEN:" (the step's if-then line, lib/if-then.ts). It shows under
// the title, not as a part, so noteParts skips it and whenPart reads it.
const LABELS: Record<string, string> = { GOAL: "Goal", FOCUS: "What to do", TIME: "Time", WHY: "Why", BECAUSE: "Because", "YOU'LL HAVE": "You'll have", "HOW IT WENT": "How it went" };

/**
 * The labelled parts, or null when the notes are just prose. By default one
 * lone label isn't enough to split on (the step sheet shows it as Notes);
 * `single` splits even "GOAL: …" alone, so no raw "GOAL:" is ever shown.
 */
export function noteParts(notes: string, single = false): NotePart[] | null {
  const re = /(GOAL|FOCUS|TIME|WHEN|WHY|BECAUSE|YOU'LL HAVE|HOW IT WENT):\s*/g;
  const hits = Array.from(notes.matchAll(re));
  const lead = notes.slice(0, hits[0]?.index ?? notes.length).trim();
  if (hits.length === 0 || hits.length < (lead || single ? 1 : 2)) return null;
  const parts = hits.map((h, i) => ({
    label: h[1] === "WHEN" ? "" : LABELS[h[1]],
    text: notes.slice((h.index ?? 0) + h[0].length, i + 1 < hits.length ? hits[i + 1].index : undefined).trim(),
  }));
  const shown = [...(lead ? [{ label: "What to do", text: lead }] : []), ...parts].filter((p) => p.label && p.text);
  return shown.length > 0 ? shown : null;
}

/** The step's if-then line (its WHEN: note line), or "". */
export function whenPart(notes: string | null | undefined): string {
  return /(?:^|\n)WHEN:\s*([^\n]+)/.exec(notes ?? "")?.[1].trim() ?? "";
}
