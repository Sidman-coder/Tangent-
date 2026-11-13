// A project's description holds the student's goal and, for projects made by
// the planner, the brief it followed (lib/ai/plan-brief.ts briefNotes):
//
//   Get a 1450 on the SAT
//   Brief — Deadline: Dec 6 · Hours per week: 5
//   Assumed — Every section, weakest first · At your open times after school
//
// The project page shows the goal as text, what the student said as chips and
// the defaults in "How this was planned". Saving the goal keeps the brief
// lines as they were, so nothing the planner relies on is lost.

export type ProjectNotes = {
  goal: string;
  known: { label: string; value: string }[];
  assumed: string[];
  /** The brief lines as stored, put back after the goal on save. */
  briefLines: string[];
  /** Round 4 §3.4: the project's current round, when it was planned in rounds. */
  round: RoundInfo | null;
};

import { parseRoundLine, type RoundInfo } from "./rounds";

const BRIEF = /^Brief\s*[—–-]\s*(.*)$/;
const ASSUMED = /^Assumed\s*[—–-]\s*(.*)$/;

function items(rest: string): string[] {
  return rest
    .split(" · ")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function splitProjectNotes(description: string | null | undefined): ProjectNotes {
  const goal: string[] = [];
  const known: ProjectNotes["known"] = [];
  const assumed: string[] = [];
  const briefLines: string[] = [];
  let round: RoundInfo | null = null;
  for (const line of (description ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    const r = parseRoundLine(trimmed);
    if (r) {
      briefLines.push(trimmed);
      round = r;
      continue;
    }
    const brief = BRIEF.exec(trimmed);
    const assume = ASSUMED.exec(trimmed);
    if (brief) {
      briefLines.push(trimmed);
      for (const item of items(brief[1])) {
        const colon = item.indexOf(":");
        if (colon > 0 && item.slice(colon + 1).trim()) known.push({ label: item.slice(0, colon).trim(), value: item.slice(colon + 1).trim() });
        else known.push({ label: "", value: item });
      }
    } else if (assume) {
      briefLines.push(trimmed);
      assumed.push(...items(assume[1]));
    } else {
      goal.push(line);
    }
  }
  return { goal: goal.join("\n").trim(), known, assumed, briefLines, round };
}

/** The description to store when the goal changes: the new goal, then the brief lines as they were. */
export function joinProjectNotes(goal: string, briefLines: readonly string[]): string {
  return [goal.trim(), ...briefLines].filter(Boolean).join("\n");
}
