// Round 6 (item 5): a recurring busy time the student mentions ("I work at the
// bakery Wed 4-9pm and Sat-Sun 8am-2pm", "soccer Mon-Fri 3:30-5:30") becomes
// one offer: "Add bakery shifts as busy time?" → Yes / Not now. Yes saves it
// as a commitment through the existing path (lib/commitments.ts, `cmt_`
// series), so every later plan and capture keeps out of it. Nothing is added
// without the tap. Pure; safe in the client.

import { busyWindows, type BusyWindow } from "./plan-constraints";
import { MAX_BLOCKS, MAX_COMMITMENTS, type Commitment, type CommitmentKind, type TimeBlock } from "./commitments";

export type BusyOffer = {
  /** What it is, as the student said it: "bakery shifts", "soccer practice". */
  label: string;
  commitment: Commitment;
};

const WORK = /\b(?:shifts?|work|job|jobs|babysit\w*|volunteer\w*)\b/i;
const PRACTICE =
  /\b(?:practice|rehearsals?|games?|meets?|team|debate|soccer|basketball|football|volleyball|baseball|softball|tennis|hockey|lacrosse|wrestling|swimming|track|cross country|band|orchestra|choir|robotics|club)\b/i;
const LESSONS = /\b(?:lessons?|tutoring)\b/i;

function kindOf(label: string): CommitmentKind {
  if (WORK.test(label)) return "work";
  if (LESSONS.test(label)) return "lessons";
  if (PRACTICE.test(label)) return "practice";
  return "other";
}

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** True when a saved commitment already keeps this window busy (same day, overlapping time). */
function covered(w: BusyWindow, existing: readonly Commitment[]): boolean {
  return existing.some((c) =>
    c.blocks.some((b) => b.days.includes(w.weekday) && minutesOf(b.start) < w.end && w.start < minutesOf(b.end))
  );
}

/** The one busy-time offer for what the student typed, or null. */
export function busyOffer(text: string, existing: readonly Commitment[] = []): BusyOffer | null {
  if (existing.length >= MAX_COMMITMENTS) return null;
  // "busy time" means the sentence never said what it is ("not tue 3-5"): too vague to save as a commitment.
  const named = busyWindows(text).filter((w) => w.label !== "busy time");
  const label = named[0]?.label;
  if (!label) return null;
  const windows = named.filter((w) => w.label === label);
  if (windows.every((w) => covered(w, existing))) return null;
  // Same hours on several days are one block: "Sat-Sun 8am-2pm" → days [6, 0].
  const blocks: TimeBlock[] = [];
  for (const w of windows) {
    const start = hhmm(w.start);
    const end = hhmm(w.end);
    const same = blocks.find((b) => b.start === start && b.end === end);
    if (same) {
      if (!same.days.includes(w.weekday)) same.days.push(w.weekday);
    } else blocks.push({ days: [w.weekday], start, end });
  }
  return {
    label,
    commitment: {
      kind: kindOf(label),
      name: label.charAt(0).toUpperCase() + label.slice(1),
      repeat: { kind: "weekly" },
      blocks: blocks.slice(0, MAX_BLOCKS).map((b) => ({ ...b, days: [...b.days].sort((x, y) => x - y) })),
    },
  };
}

/** The offer's question: "Add bakery shifts as busy time?" */
export function busyOfferQuestion(o: BusyOffer): string {
  return `Add ${o.label} as busy time?`;
}
