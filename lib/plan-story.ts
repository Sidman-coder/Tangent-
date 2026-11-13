// Round 4 Phase 4: what the chat says beside a plan preview. The calendar
// preview shows the where; this says the what and the why in a few lines, so
// the talk on the left reads like Tangent explaining what it just did:
//
//   "Round 1 for Instagram Growth to 10K: 4 steps, Mon Nov 10 to Fri Nov 14.
//    Assumed you film after school. Nothing's on your calendar until you add it."
//
// Pure (no store, no model), so it's tested.

import type { ChangeSet } from "./pipeline/changeset";

const utcNoon = (ymd: string) => new Date(`${ymd}T12:00:00Z`);

function day(ymd: string): string {
  return utcNoon(ymd).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export type PlanStory = { lead: string; lines: string[] };

/** The lead sentence and a few short lines about a drafted ChangeSet. */
export function planStory(cs: Pick<ChangeSet, "ops" | "summary" | "assumptions">, planTitle?: string | null): PlanStory {
  const adds = cs.ops.filter((op) => op.op === "add_task");
  const created = cs.ops.find((op) => op.op === "create_plan");
  const moves = cs.ops.filter((op) => op.op === "move_task" || op.op === "update_task").length;
  const removes = cs.ops.filter((op) => op.op === "delete_task").length;
  const name = created?.title ?? planTitle ?? null;
  const summary = cs.summary.trim().replace(/\.?$/, ".");

  const lines: string[] = [];
  if (adds.length > 0) {
    const dates = adds.map((op) => op.date).sort();
    const span = dates[0] === dates[dates.length - 1] ? `on ${day(dates[0])}` : `${day(dates[0])} to ${day(dates[dates.length - 1])}`;
    const what = created ? `Round 1 for ${name}` : name ? `More for ${name}` : "Planned";
    lines.push(`${what}: ${plural(adds.length, "step")}, ${span}.`);
    const titles = adds.slice(0, 3).map((op) => op.title);
    if (adds.length > 1) lines.push(`Starting with ${titles.join(", ")}${adds.length > 3 ? ", and more" : ""}.`);
  }
  if (moves > 0) lines.push(`${plural(moves, "change")} to what's already planned.`);
  if (removes > 0) lines.push(`${plural(removes, "step")} removed.`);
  for (const a of cs.assumptions.slice(0, 2)) lines.push(/^assum/i.test(a) ? a : `Assumed: ${a}`);
  lines.push("Nothing's on your calendar until you add it. Ask for any change first.");
  return { lead: summary, lines };
}

/** The same story as one block of text for a chat line. */
export function planStoryText(cs: Pick<ChangeSet, "ops" | "summary" | "assumptions">, planTitle?: string | null): string {
  const s = planStory(cs, planTitle);
  return [s.lead, ...s.lines].join("\n");
}
