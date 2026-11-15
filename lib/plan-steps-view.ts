// Round 5A 2.3: the step cards in Home's plan brief. Title, day and time come
// from the drafted add_task ops, so an edit (move, remove) shows at once; the
// "Why" and "You'll have" ride in each op's notes (WHY: / YOU'LL HAVE:, see
// lib/note-parts.ts), falling back to the brief's step at the same place.

import { noteParts } from "./note-parts";

type Op = { op: string; title?: string; date?: string; time?: string; notes?: string };
type BriefStep = { what: string; when: string; why: string; youllHave: string };

export type StepCard = {
  /** The op's index in the ChangeSet, for edits ({type:"remove", index}). */
  index: number;
  title: string;
  date: string;
  time: string;
  why: string;
  youllHave: string;
};

export function stepCards(ops: readonly Op[], briefSteps: readonly BriefStep[] = []): StepCard[] {
  const cards: StepCard[] = [];
  ops.forEach((op, index) => {
    if (op.op !== "add_task" || !op.title || !op.date) return;
    const parts = op.notes ? noteParts(op.notes, true) ?? [] : [];
    const part = (label: string) => parts.find((p) => p.label === label)?.text ?? "";
    const fallback = briefSteps[cards.length];
    cards.push({
      index,
      title: op.title,
      date: op.date,
      time: op.time ?? "",
      why: part("Why") || fallback?.why || "",
      youllHave: part("You'll have") || fallback?.youllHave || "",
    });
  });
  return cards;
}

/** "2026-11-16", "16:30" → "Mon, Nov 16 · 4:30 PM". */
export function whenLabel(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  if (!/^\d{1,2}:\d{2}$/.test(time)) return day;
  const [h, min] = time.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${day} · ${hour}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
